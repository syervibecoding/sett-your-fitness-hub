-- ============================================================================
-- BN Prescription Engine v1 — Auditoria READ-ONLY da biblioteca de exercícios
-- ============================================================================
-- Objetivo: medir se exercise_library + exercise_muscle_targets + exercise_metadata
-- têm metadados suficientes para o engine rodar com BAIXA taxa de blocker no shadow.
--
-- ⚠️ 100% READ-ONLY. Só SELECT. NÃO roda UPDATE/DELETE/INSERT. NÃO cria migration.
-- Rodar no SQL editor do Supabase (projeto zshrcgbyhzxpnlccssyz) OU psql, manualmente.
--
-- ESCOPO: por padrão audita TODA a exercise_library. Para escopar a uma empresa (como o
-- engine faz: is_global OR company_id = X), troque a CTE `base` por:
--   with base as (select * from public.exercise_library where is_global or company_id = '<COMPANY_UUID>')
--
-- Notas de schema (confirmadas):
--   • exercise_library NÃO tem flag is_active/active  -> "ativos" = todos.
--   • exercise_library NÃO tem coluna movement_pattern -> inferido por keyword (bloco 4).
--   • grupo: exercise_library.muscle_group (texto) E exercise_muscle_targets (is_primary/role).
--   • metadados (arrays) vivem em exercise_metadata (left join; ausência = vazio).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. COBERTURA GERAL
-- ---------------------------------------------------------------------------
with base as (select * from public.exercise_library),
meta as (select * from public.exercise_metadata),
prim as (select distinct exercise_id from public.exercise_muscle_targets where is_primary = true)
select
  'cobertura_geral' as relatorio,
  (select count(*) from base) as total_exercicios,
  (select count(*) from base) as ativos_sem_flag_is_active, -- não há coluna is_active
  (select count(*) from base b where b.muscle_group is null or btrim(b.muscle_group) = '') as sem_muscle_group_texto,
  (select count(*) from base b where b.id not in (select exercise_id from prim)) as sem_target_primario,
  (select count(*) from base b where b.difficulty is null or btrim(b.difficulty) = '') as sem_difficulty,
  (select count(*) from base b where b.equipment is null or btrim(b.equipment) = '') as sem_equipment,
  (select count(*) from base b where b.id not in (select exercise_id from meta)) as sem_linha_metadata,
  'movement_pattern: coluna inexistente (ver bloco 4)' as nota_movement_pattern;

-- ---------------------------------------------------------------------------
-- 2. SEGURANÇA (contraindications / pain_limitation_tags / alto risco)
-- ---------------------------------------------------------------------------
with base as (select * from public.exercise_library),
meta as (select * from public.exercise_metadata)
select
  'seguranca' as relatorio,
  (select count(*) from base) as total,
  (select count(*) from base b
     left join meta m on m.exercise_id = b.id
     where coalesce(array_length(m.contraindications,1),0) = 0) as sem_contraindications,
  (select count(*) from base b
     left join meta m on m.exercise_id = b.id
     where coalesce(array_length(m.pain_limitation_tags,1),0) = 0) as sem_pain_tags,
  -- alto risco por heurística de nome, SEM contraindications
  (select count(*) from base b
     left join meta m on m.exercise_id = b.id
     where b.name ~* '(agachamento (livre )?profundo|atg|terra|deadlift|good ?morning|levantamento terra|desenvolvimento|overhead|barra (nuca|atras)|dips|salto|pliometr|snatch|clean|jerk|arremesso)'
       and coalesce(array_length(m.contraindications,1),0) = 0) as alto_risco_sem_contraindications,
  -- relevantes a joelho/lombar/ombro SEM pain tags
  (select count(*) from base b
     left join meta m on m.exercise_id = b.id
     where (b.name ~* '(joelho|agachamento|leg press|hack|afundo|extensora|lombar|terra|good ?morning|posterior|ombro|desenvolvimento|overhead|supino|dips|remada alta)'
            or b.muscle_group ~* '(quadr|posterior|lombar|ombro|peit)')
       and coalesce(array_length(m.pain_limitation_tags,1),0) = 0) as risco_articular_sem_pain_tags;

-- ---------------------------------------------------------------------------
-- 3. SUBSTITUIÇÃO (equivalent_substitutes / regressions / progressions)
-- ---------------------------------------------------------------------------
with base as (select * from public.exercise_library),
meta as (select * from public.exercise_metadata)
select
  'substituicao' as relatorio,
  (select count(*) from base b left join meta m on m.exercise_id=b.id
     where coalesce(array_length(m.equivalent_substitutes,1),0)=0) as sem_equivalent_substitutes,
  (select count(*) from base b left join meta m on m.exercise_id=b.id
     where coalesce(array_length(m.regressions,1),0)=0) as sem_regressions,
  (select count(*) from base b left join meta m on m.exercise_id=b.id
     where coalesce(array_length(m.progressions,1),0)=0) as sem_progressions;

-- ---------------------------------------------------------------------------
-- 4. PADRÕES DE MOVIMENTO (inferidos por keyword no nome/grupo — não há coluna)
--    "seguros" = têm pain_limitation_tags OU contraindications (cobertura corretiva).
-- ---------------------------------------------------------------------------
with base as (select * from public.exercise_library),
meta as (select * from public.exercise_metadata),
classified as (
  select b.id, b.name, b.muscle_group,
    case
      when b.name ~* '(agachamento|leg press|hack|afundo|extensora|step ?up)' or b.muscle_group ~* 'quadr' then 'joelho_dominante'
      when b.name ~* '(terra|rdl|romeno|hip ?thrust|ponte|flexora|stiff)' or b.muscle_group ~* '(posterior|glut)' then 'quadril_dominante'
      when b.name ~* '(supino|chest press|flex(ã|a)o de bra|crucifixo)' or b.muscle_group ~* 'peit' then 'empurrar_horizontal'
      when b.name ~* '(desenvolvimento|overhead|landmine|elevac|eleva(ç|c)(ã|a)o lateral)' or b.muscle_group ~* 'ombro' then 'empurrar_vertical'
      when b.name ~* '(remada|row)' then 'puxar_horizontal'
      when b.name ~* '(puxada|barra fixa|pulldown|pull ?up)' then 'puxar_vertical'
      when b.name ~* '(prancha|dead ?bug|pallof|bird ?dog|abdominal|abdomen)' or b.muscle_group ~* '(core|abd)' then 'core'
      when b.name ~* '(unilateral|lunge|afundo|b(ú|u)lgaro)' then 'unilateral'
      else 'isolado_acessorio'
    end as pattern,
    (coalesce(array_length(m.pain_limitation_tags,1),0) > 0 or coalesce(array_length(m.contraindications,1),0) > 0) as seguro
  from base b left join meta m on m.exercise_id = b.id
)
select 'movimento' as relatorio, pattern,
  count(*) as total,
  count(*) filter (where seguro) as com_metadado_seguranca,
  count(*) filter (where not seguro) as sem_metadado_seguranca
from classified
group by pattern
order by total desc;

-- ---------------------------------------------------------------------------
-- 5. EQUIPAMENTOS (equipment é texto livre — buckets por ILIKE)
-- ---------------------------------------------------------------------------
with base as (select * from public.exercise_library)
select 'equipamentos' as relatorio,
  count(*) filter (where equipment ~* '(academia|completa|gym)') as academia_completa,
  count(*) filter (where equipment ~* '(halter|dumbbell)') as halteres,
  count(*) filter (where equipment ~* '(casa|m(í|i)nimo|elastic|el(á|a)stic|band|minimal)') as casa_minimo,
  count(*) filter (where equipment ~* '(m(á|a)quina|machine|smith|leg press|hack)') as maquinas,
  count(*) filter (where equipment ~* '(cabo|cable|polia|crossover)') as cabos,
  count(*) filter (where equipment ~* '(peso corporal|livre|bodyweight|sem equip|nenhum)') as peso_corporal,
  count(*) filter (where equipment is null or btrim(equipment)='') as equipment_ausente,
  count(*) as total
from base;

-- ---------------------------------------------------------------------------
-- 6. REGIÕES DE RISCO (joelho / lombar / ombro)
--    relevantes = nome/grupo casa a região; mede pain tags / contraindications / substitutos.
-- ---------------------------------------------------------------------------
with base as (select * from public.exercise_library),
meta as (select * from public.exercise_metadata),
reg as (
  select 'joelho' as regiao, b.id, m.pain_limitation_tags, m.contraindications, m.equivalent_substitutes
    from base b left join meta m on m.exercise_id=b.id
    where b.name ~* '(joelho|agachamento|leg press|hack|afundo|extensora|step ?up)' or b.muscle_group ~* 'quadr'
  union all
  select 'lombar', b.id, m.pain_limitation_tags, m.contraindications, m.equivalent_substitutes
    from base b left join meta m on m.exercise_id=b.id
    where b.name ~* '(lombar|terra|good ?morning|rdl|romeno|stiff|hip ?thrust|posterior)' or b.muscle_group ~* '(posterior|lombar|glut)'
  union all
  select 'ombro', b.id, m.pain_limitation_tags, m.contraindications, m.equivalent_substitutes
    from base b left join meta m on m.exercise_id=b.id
    where b.name ~* '(ombro|desenvolvimento|overhead|supino|dips|remada alta|barra nuca)' or b.muscle_group ~* '(ombro|peit)'
)
select 'regiao_risco' as relatorio, regiao,
  count(*) as relevantes,
  count(*) filter (where coalesce(array_length(pain_limitation_tags,1),0) > 0) as com_pain_tags,
  count(*) filter (where coalesce(array_length(contraindications,1),0) > 0) as com_contraindications,
  count(*) filter (where coalesce(array_length(equivalent_substitutes,1),0) > 0) as com_substituto
from reg
group by regiao
order by regiao;

-- ---------------------------------------------------------------------------
-- 7. VEREDITO POR THRESHOLD (computa um status sugerido)
--    BLOCKED_FOR_SHADOW se: >20% sem target primário; pain tags ausentes em alto risco;
--                           algum padrão essencial com <3 exercícios "seguros".
--    ACCEPT_WITH_NOTES se: equipment ausente em >30% (ou outros sinais médios).
--    ACCEPT caso contrário.
-- ---------------------------------------------------------------------------
with base as (select * from public.exercise_library),
meta as (select * from public.exercise_metadata),
prim as (select distinct exercise_id from public.exercise_muscle_targets where is_primary = true),
m as (
  select
    (select count(*) from base) as total,
    (select count(*) from base b where b.id not in (select exercise_id from prim))::numeric as sem_primario,
    (select count(*) from base b where b.equipment is null or btrim(b.equipment)='')::numeric as sem_equip,
    (select count(*) from base b left join meta mm on mm.exercise_id=b.id
       where b.name ~* '(agachamento profundo|atg|terra|good ?morning|desenvolvimento|overhead|dips|salto|pliometr)'
         and coalesce(array_length(mm.contraindications,1),0)=0) as alto_risco_sem_contra,
    -- padrões essenciais com <3 exercícios "seguros" (com pain tags ou contraind.)
    (select count(*) from (
        select case
          when b.name ~* '(agachamento|leg press|hack|afundo|extensora)' then 'joelho_dominante'
          when b.name ~* '(terra|rdl|romeno|hip ?thrust|ponte|flexora)' then 'quadril_dominante'
          when b.name ~* '(supino|chest press|crucifixo)' then 'empurrar_horizontal'
          when b.name ~* '(remada|row)' then 'puxar_horizontal'
          when b.name ~* '(puxada|barra fixa|pulldown|pull ?up)' then 'puxar_vertical'
          else null end as pattern
        , (coalesce(array_length(mm.pain_limitation_tags,1),0)>0 or coalesce(array_length(mm.contraindications,1),0)>0) as seguro
        from base b left join meta mm on mm.exercise_id=b.id
      ) t
      where pattern is not null
      group by pattern
      having count(*) filter (where seguro) < 3
    ) as padroes_essenciais_sem_3_seguros
)
select 'veredito' as relatorio,
  total,
  round(100*sem_primario/nullif(total,0),1) as pct_sem_target_primario,
  round(100*sem_equip/nullif(total,0),1) as pct_sem_equipment,
  alto_risco_sem_contra,
  padroes_essenciais_sem_3_seguros,
  case
    when sem_primario/nullif(total,0) > 0.20
      or alto_risco_sem_contra > 0
      or padroes_essenciais_sem_3_seguros > 0
      then 'BLOCKED_FOR_SHADOW'
    when sem_equip/nullif(total,0) > 0.30
      then 'ACCEPT_WITH_NOTES'
    else 'ACCEPT'
  end as status_sugerido
from m;
