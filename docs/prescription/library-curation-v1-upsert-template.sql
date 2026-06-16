-- =====================================================================================
-- TEMPLATE ONLY
-- DO NOT RUN WITHOUT HUMAN REVIEW
-- REPLACE VALUES FROM APPROVED MANIFEST ONLY
-- =====================================================================================
-- Arquivo:  docs/prescription/library-curation-v1-upsert-template.sql
-- Ordem:    ORDEM 028 (plano de aplicação) — ver library-curation-v1-application-plan.md
-- Fonte:    docs/prescription/library-curation-v1-consolidated-manifest.csv (215 linhas, 100% needs_review)
--
-- ESTE ARQUIVO NÃO APLICA NADA. Ele é um MOLDE. Por padrão:
--   (1) a tabela de staging fica VAZIA (nenhum dado real ativo);
--   (2) uma GUARDA `RAISE EXCEPTION` aborta a transação antes de qualquer escrita;
--   (3) o upsert vive dentro de BEGIN ... ROLLBACK (não persiste mesmo se rodar).
-- Para usar de verdade (FUTURO, com aprovação humana), o revisor deve, conscientemente:
--   - preencher o STAGING apenas com linhas `approved` do manifesto;
--   - rodar as VALIDAÇÕES (STEP 2/3) e o BACKUP (STEP 4) em STAGING;
--   - remover a GUARDA do STEP 5 e trocar ROLLBACK -> COMMIT SOMENTE em staging;
--   - repetir em produção, com backup e rollback prontos.
--
-- Schema real confirmado (information_schema + migration 20260614002903):
--   public.exercise_metadata(
--     exercise_id uuid PRIMARY KEY REFERENCES exercise_library(id) ON DELETE CASCADE,
--     contraindications      text[]  NOT NULL DEFAULT '{}',
--     regressions            text[]  NOT NULL DEFAULT '{}',
--     progressions           text[]  NOT NULL DEFAULT '{}',
--     equivalent_substitutes uuid[]  NOT NULL DEFAULT '{}',   -- !! UUID[]: nomes precisam virar ids
--     pain_limitation_tags   text[]  NOT NULL DEFAULT '{}',
--     notes                  text,
--     created_at, updated_at timestamptz)
--   public.exercise_library.equipment  text  (nullable)        -- Lote D vive AQUI (campo único, não array)
--   SCHEMA_GAP: movement_patterns (sem coluna), risk_regions (sem coluna; codificado em pain_limitation_tags)
-- =====================================================================================


-- =====================================================================================
-- STEP 1 — STAGING DE LINHAS APROVADAS  (editar conscientemente; VAZIO por padrão)
-- -------------------------------------------------------------------------------------
-- Tabela TEMP de sessão (some ao fim da conexão). Substitutos vão como NOMES (texto);
-- o STEP 3 resolve para uuid[]. Mantenha SOMENTE linhas com reviewer_status = 'approved'.
-- =====================================================================================
-- CREATE TEMP TABLE staging_approved (
--   exercise_id           uuid,
--   contraindications     text[],
--   pain_limitation_tags  text[],
--   regressions           text[],
--   progressions          text[],
--   substitute_names      text[],   -- NOMES reais (serão resolvidos para uuid no STEP 3)
--   notes                 text
-- ) ON COMMIT DROP;
--
-- ------------------------------------------------------------------------------------
-- EXEMPLO DE ESTRUTURA DE UMA LINHA (COMENTADO — não é dado aprovado, não ativar):
-- INSERT INTO staging_approved VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,        -- exercise_id (real, da exercise_library)
--   ARRAY['acute_shoulder_pain','painful_overhead_press']::text[],   -- contraindications
--   ARRAY['shoulder_pain','overhead_limitation']::text[],            -- pain_limitation_tags
--   ARRAY['Desenvolvimento Neutro Máquina']::text[],                 -- regressions (texto livre)
--   ARRAY['Desenvolvimento Militar']::text[],                        -- progressions (texto livre)
--   ARRAY['Desenvolvimento Máquina','Desenvolvimento Unilateral Landmine']::text[],  -- substitute_names
--   'P1 overhead: manter cautela de ombro; substitutos no mesmo padrão (empurrar_vertical).' -- notes
-- );
-- ------------------------------------------------------------------------------------
-- >>> POR PADRÃO NÃO HÁ NENHUMA LINHA. Não cole dados não-aprovados. <<<


-- =====================================================================================
-- STEP 2 — VALIDAÇÃO PRÉ-UPSERT (READ-ONLY; rodar em STAGING após preencher o STEP 1)
-- =====================================================================================
-- 2.1 — Todos os exercise_id existem na biblioteca? (esperado: 0 linhas)
-- SELECT s.exercise_id AS exercise_id_inexistente
-- FROM staging_approved s
-- LEFT JOIN public.exercise_library e ON e.id = s.exercise_id
-- WHERE e.id IS NULL;

-- 2.2 — Duplicatas por exercise_id? (esperado: 0 linhas)
-- SELECT exercise_id, count(*) FROM staging_approved GROUP BY exercise_id HAVING count(*) > 1;

-- 2.3 — Arrays com string vazia / nulos indevidos? (esperado: 0 linhas)
-- SELECT exercise_id FROM staging_approved
-- WHERE '' = ANY(contraindications) OR '' = ANY(pain_limitation_tags)
--    OR '' = ANY(regressions)       OR '' = ANY(progressions)
--    OR '' = ANY(substitute_names);

-- 2.4 — P1 (alto risco) precisa de contraindication. Liste P1 SEM contraindication.
--       (Marque o conjunto P1 a partir do manifesto/review-board; aqui checa o array vazio.)
-- SELECT exercise_id FROM staging_approved WHERE cardinality(contraindications) = 0;


-- =====================================================================================
-- STEP 3 — RESOLUÇÃO NOME -> UUID dos substitutos + checagem de não-resolvidos
-- =====================================================================================
-- 3.1 — Nomes de substituto que NÃO existem na exercise_library (esperado: 0 linhas).
--       Qualquer nome aqui BLOQUEIA a linha — corrigir o nome ou remover a sugestão.
-- SELECT s.exercise_id, n AS substituto_nao_resolvido
-- FROM staging_approved s
-- CROSS JOIN LATERAL unnest(s.substitute_names) AS n
-- WHERE NOT EXISTS (SELECT 1 FROM public.exercise_library e WHERE e.name = n);

-- 3.2 — Nomes que resolvem para MAIS de um id (ambíguo) — revisar antes de aplicar.
-- SELECT n AS nome, count(*) AS qtd_ids
-- FROM (SELECT DISTINCT unnest(substitute_names) AS n FROM staging_approved) x
-- JOIN public.exercise_library e ON e.name = x.n
-- GROUP BY n HAVING count(*) > 1;


-- =====================================================================================
-- STEP 4 — BACKUP (FUTURO; rodar antes do upsert real — NÃO executar nesta ordem)
-- -------------------------------------------------------------------------------------
-- Substitua <TS> por timestamp UTC (ex.: 20260616_1530). Guardar também: reviewer/aprovador
-- e o caminho+hash do manifest approved usado.
-- =====================================================================================
-- CREATE TABLE IF NOT EXISTS public.backup_exercise_metadata_<TS> AS
--   SELECT * FROM public.exercise_metadata;                       -- snapshot completo
-- -- snapshot só das linhas-alvo (antes), para diff:
-- CREATE TABLE IF NOT EXISTS public.backup_exercise_metadata_targets_<TS> AS
--   SELECT m.* FROM public.exercise_metadata m
--   WHERE m.exercise_id IN (SELECT exercise_id FROM staging_approved);


-- =====================================================================================
-- STEP 5 — UPSERT EM exercise_metadata
-- -------------------------------------------------------------------------------------
-- PROTEGIDO POR PADRÃO:
--   * GUARDA RAISE EXCEPTION aborta a transação (remover só após validar em staging);
--   * staging vazio -> 0 linhas; BEGIN/ROLLBACK -> nada persiste.
-- Remova a GUARDA e troque ROLLBACK -> COMMIT CONSCIENTEMENTE, só em staging primeiro.
-- =====================================================================================
BEGIN;

-- >>> GUARDA DE SEGURANÇA — REMOVER MANUALMENTE APÓS REVISÃO EM STAGING <<<
DO $$
BEGIN
  RAISE EXCEPTION 'TEMPLATE ONLY: remova esta guarda apos validar em staging (STEP 2/3) e backup (STEP 4).';
END $$;

-- Upsert: lê do staging, resolve substitutos para uuid[], grava colunas reais.
-- Por padrão o staging não existe/está vazio -> este bloco é inócuo.
INSERT INTO public.exercise_metadata AS m (
  exercise_id, contraindications, pain_limitation_tags,
  regressions, progressions, equivalent_substitutes, notes
)
SELECT
  s.exercise_id,
  COALESCE(s.contraindications, '{}')::text[],
  COALESCE(s.pain_limitation_tags, '{}')::text[],
  COALESCE(s.regressions, '{}')::text[],
  COALESCE(s.progressions, '{}')::text[],
  -- resolve NOMES -> uuid[] (somente nomes que existem; STEP 3.1 deve ter dado 0 não-resolvidos)
  COALESCE((
    SELECT array_agg(e.id)
    FROM unnest(s.substitute_names) AS n
    JOIN public.exercise_library e ON e.name = n
  ), '{}')::uuid[],
  s.notes
FROM staging_approved s
ON CONFLICT (exercise_id) DO UPDATE SET
  contraindications      = EXCLUDED.contraindications,
  pain_limitation_tags   = EXCLUDED.pain_limitation_tags,
  regressions            = EXCLUDED.regressions,
  progressions           = EXCLUDED.progressions,
  equivalent_substitutes = EXCLUDED.equivalent_substitutes,
  notes                  = EXCLUDED.notes,
  updated_at             = now();

-- Mantém ROLLBACK por padrão. Trocar para COMMIT só após validação consciente em staging.
ROLLBACK;
-- COMMIT;  -- <- habilitar apenas em staging revisado e, depois, em produção com backup pronto.


-- =====================================================================================
-- STEP 6 — EQUIPMENT (Lote D) — alvo é exercise_library.equipment (campo TEXT único)
-- -------------------------------------------------------------------------------------
-- NÃO é exercise_metadata e NÃO é array. Template comentado; mesma disciplina de guarda/backup.
-- =====================================================================================
-- BEGIN;
--   DO $$ BEGIN RAISE EXCEPTION 'TEMPLATE ONLY: equipment update'; END $$;  -- remover após revisão
--   -- backup: CREATE TABLE public.backup_exercise_equipment_<TS> AS
--   --   SELECT id, equipment FROM public.exercise_library
--   --   WHERE id IN (SELECT exercise_id FROM staging_equipment);
--   -- UPDATE public.exercise_library e
--   --   SET equipment = se.equipment, updated_at = now()
--   --   FROM staging_equipment se
--   --   WHERE e.id = se.exercise_id;
-- ROLLBACK;  -- COMMIT só após revisão.


-- =====================================================================================
-- STEP 7 — REAUDITORIA PÓS-UPSERT (READ-ONLY; rodar após COMMIT futuro)
-- =====================================================================================
-- 7.1 — Cobertura geral (esperado: total > 0 após aplicar).
-- SELECT count(*) AS metadata_rows FROM public.exercise_metadata;

-- 7.2 — Quantas linhas-alvo ficaram preenchidas (não-vazias).
-- SELECT
--   count(*) FILTER (WHERE cardinality(contraindications)      > 0) AS com_contra,
--   count(*) FILTER (WHERE cardinality(pain_limitation_tags)   > 0) AS com_pain,
--   count(*) FILTER (WHERE cardinality(equivalent_substitutes) > 0) AS com_subs
-- FROM public.exercise_metadata
-- WHERE exercise_id IN (SELECT exercise_id FROM staging_approved);

-- 7.3 — Rodar a auditoria oficial e conferir o veredito:
--   docs/prescription/bn-prescription-engine-v1-library-metadata-audit.sql
--   Metas: high_risk_without_contraindications = 0; padroes essenciais >= 3 seguros;
--          status BLOCKED_FOR_SHADOW -> ACCEPT_WITH_NOTES/ACCEPT.


-- =====================================================================================
-- STEP 8 — ROLLBACK PLAN (em comentário)
-- -------------------------------------------------------------------------------------
-- Se algo der errado APÓS um COMMIT real:
--   A) Restaurar tudo a partir do snapshot completo:
--      BEGIN;
--        DELETE FROM public.exercise_metadata
--          WHERE exercise_id IN (SELECT exercise_id FROM public.backup_exercise_metadata_<TS>);
--        INSERT INTO public.exercise_metadata
--          SELECT * FROM public.backup_exercise_metadata_<TS>;
--      COMMIT;   -- conferir contagens antes de COMMIT.
--   B) Restaurar SOMENTE as linhas-alvo a partir de backup_exercise_metadata_targets_<TS>.
--   C) Equipment: restaurar de backup_exercise_equipment_<TS> via UPDATE.
--   D) Registrar incidente: o que foi aplicado, por quem, manifest hash, e resultado da reauditoria.
-- =====================================================================================
-- FIM DO TEMPLATE — nenhuma linha ativa aplica dados. Use apenas com aprovação humana.
