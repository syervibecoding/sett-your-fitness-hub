-- =====================================================================================
-- TEMPLATE DE BACKUP (STAGING) — Curadoria da Biblioteca v1 (ORDEM 037)
-- SEGURO POR PADRÃO: contém SOMENTE comentários + SELECTs read-only.
-- NÃO contém INSERT / UPDATE / DELETE / ALTER / CREATE ativo.
-- RODAR APENAS EM STAGING, QUANDO AUTORIZADO PELA ATENA, ANTES DE QUALQUER UPSERT.
-- =====================================================================================
-- Objetivo: capturar o estado atual de exercise_metadata (e das linhas-alvo) para que um
-- rollback seja possível depois de uma aplicação futura em staging. Este arquivo NÃO altera
-- dados; ele apenas LÊ. A criação de tabelas de backup (CREATE TABLE ... AS) é descrita em
-- comentário e deve ser executada conscientemente por um humano, só em staging.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- 1) SNAPSHOT COMPLETO (read-only): exporte o resultado como CSV e guarde com timestamp.
--    Salvar como: backup_exercise_metadata_<YYYYMMDD_HHMM>.csv
-- -------------------------------------------------------------------------------------
SELECT *
FROM public.exercise_metadata
ORDER BY exercise_id;


-- -------------------------------------------------------------------------------------
-- 2) CONTAGEM ATUAL (read-only): registre o número de linhas antes da aplicação.
-- -------------------------------------------------------------------------------------
SELECT count(*) AS exercise_metadata_rows_before
FROM public.exercise_metadata;


-- -------------------------------------------------------------------------------------
-- 3) SNAPSHOT DAS LINHAS-ALVO (read-only): substitua a lista de IDs aprovados.
--    Placeholder: troque os UUIDs de exemplo pelos exercise_id do approved manifest.
--    Exporte como: backup_exercise_metadata_targets_<YYYYMMDD_HHMM>.csv
-- -------------------------------------------------------------------------------------
SELECT *
FROM public.exercise_metadata
WHERE exercise_id IN (
  -- <<< COLE AQUI OS exercise_id APROVADOS (um por linha, separados por vírgula) >>>
  '00000000-0000-0000-0000-000000000000'  -- placeholder (substituir; nada é aplicado por este SELECT)
)
ORDER BY exercise_id;


-- -------------------------------------------------------------------------------------
-- 4) EXERCÍCIOS-ALVO QUE AINDA NÃO TÊM METADATA (read-only): ajuda a prever INSERT vs UPDATE.
--    Mesma lista de IDs do item 3.
-- -------------------------------------------------------------------------------------
SELECT e.id AS exercise_id, e.name
FROM public.exercise_library e
WHERE e.id IN (
  '00000000-0000-0000-0000-000000000000'  -- placeholder (substituir)
)
AND NOT EXISTS (
  SELECT 1 FROM public.exercise_metadata m WHERE m.exercise_id = e.id
)
ORDER BY e.name;


-- =====================================================================================
-- 5) BACKUP FÍSICO (FUTURO, STAGING, CONSCIENTE) — descrito em COMENTÁRIO, NÃO ativo.
--    Só rodar em staging, autorizado, e depois de exportar os CSVs acima.
--    Substitua <TS> por timestamp UTC (ex.: 20260617_0145).
-- -------------------------------------------------------------------------------------
--   CREATE TABLE IF NOT EXISTS public.backup_exercise_metadata_<TS> AS
--     SELECT * FROM public.exercise_metadata;                       -- snapshot completo
--   CREATE TABLE IF NOT EXISTS public.backup_exercise_metadata_targets_<TS> AS
--     SELECT * FROM public.exercise_metadata
--     WHERE exercise_id IN ( /* ids aprovados */ );                 -- só linhas-alvo
-- =====================================================================================


-- =====================================================================================
-- 6) ROLLBACK CONCEITUAL (FUTURO) — descrito em COMENTÁRIO, NÃO ativo.
--    Se algo der errado APÓS um COMMIT real em staging:
--      BEGIN;
--        -- remove o que foi aplicado nas linhas-alvo:
--        -- DELETE FROM public.exercise_metadata
--        --   WHERE exercise_id IN (SELECT exercise_id FROM public.backup_exercise_metadata_targets_<TS>);
--        -- restaura o estado anterior das linhas-alvo:
--        -- INSERT INTO public.exercise_metadata
--        --   SELECT * FROM public.backup_exercise_metadata_targets_<TS>;
--      -- conferir contagens ANTES de COMMIT:
--      ROLLBACK;  -- trocar para COMMIT só após verificação humana.
--    Depois do rollback: rodar a reauditoria e registrar o incidente.
-- =====================================================================================
-- FIM DO TEMPLATE — nenhum statement ativo altera dados. Read-only + comentários.
