# BN Prescription Engine v1 — Auditoria de Metadados da Biblioteca (READ-ONLY)

> Mede se `exercise_library` + `exercise_muscle_targets` + `exercise_metadata` têm metadados
> suficientes para o engine rodar com **baixa taxa de blocker** (`safe_alternative_unavailable`,
> `empty_exercise_library`, gaps) no shadow. **Nada altera o banco.** SQL em
> `bn-prescription-engine-v1-library-metadata-audit.sql` (100% read-only).

## Achados estruturais (já confirmados por introspecção read-only do schema)
- **Não há flag `is_active`/`active`** em `exercise_library` → "ativos" = todos os exercícios.
- **Não há coluna `movement_pattern`** → o engine infere padrão por keyword (nome/grupo). O bloco 4 do
  SQL aproxima a cobertura por padrão via keyword.
- Grupo muscular vem em **dois lugares**: `exercise_library.muscle_group` (texto, usado pelo engine na
  seleção) **e** `exercise_muscle_targets` (`is_primary`, `role`, `volume_percentage`).
- Metadados de segurança/substituição (`contraindications`, `pain_limitation_tags`, `regressions`,
  `progressions`, `equivalent_substitutes`) vivem em **`exercise_metadata`** (arrays). Exercício sem linha
  em `exercise_metadata` = sem nenhum desses metadados.

## 1. Cobertura geral (bloco SQL 1)
Total; sem `muscle_group` (texto); sem **target primário** (`is_primary`); sem `difficulty`; sem
`equipment`; sem linha em `exercise_metadata`. (`movement_pattern` → ver bloco 4.)

## 2. Segurança (bloco 2)
Sem `contraindications`; sem `pain_limitation_tags`; **alto risco sem contraindications** (heurística de
nome: agachamento profundo/ATG, terra, good morning, desenvolvimento/overhead, dips, salto/pliometria,
snatch/clean/jerk); **relevantes a joelho/lombar/ombro sem pain tags**.

## 3. Substituição (bloco 3)
Sem `equivalent_substitutes`; sem `regressions`; sem `progressions`. Impacta diretamente a substituição
do engine (e, em falta de alternativa segura para padrão essencial, gera blocker).

## 4. Padrões de movimento (bloco 4)
Cobertura inferida por keyword para os 9 padrões do engine (`joelho_dominante`, `quadril_dominante`,
`empurrar_horizontal`, `empurrar_vertical`, `puxar_horizontal`, `puxar_vertical`, `core`, `unilateral`,
`isolado_acessorio`), com quantos têm metadado de segurança vs não.

## 5. Equipamentos (bloco 5)
Buckets por `equipment` (texto livre): academia completa, halteres, casa mínimo/elástico, máquinas,
cabos, peso corporal, e **equipment ausente**.

## 6. Regiões de risco (bloco 6)
Para **joelho / lombar / ombro**: nº de exercícios relevantes e quantos têm `pain_limitation_tags`,
`contraindications` e `equivalent_substitutes`.

## 7. Thresholds sugeridos (bloco 7 calcula o veredito)
- **BLOCKED_FOR_SHADOW** se **qualquer**:
  - `> 20%` dos exercícios sem **target primário**;
  - **alto risco sem `contraindications`** (qualquer ocorrência);
  - algum **padrão essencial** (joelho_dominante, quadril_dominante, empurrar_horizontal,
    puxar_horizontal, puxar_vertical) com **< 3 exercícios "seguros"** (com pain tags ou contraindications).
- **ACCEPT_WITH_NOTES** se `equipment` ausente em `> 30%` (e nenhum critério de BLOCKED).
- **ACCEPT** caso contrário.

> O bloco 7 já devolve `status_sugerido` direto. Pain tags ausentes em alto risco caem em
> **BLOCKED_FOR_SHADOW** (via `alto_risco_sem_contraindications` + bloco 2 para revisão manual).

## 8. Como usar
- **Onde rodar:** SQL editor do Supabase (projeto **`zshrcgbyhzxpnlccssyz`**) ou `psql`, manualmente.
  Para escopar a uma empresa (como o engine: `is_global OR company_id = X`), editar a CTE `base`
  conforme o comentário no topo do `.sql`.
- **Como interpretar:** rode os 7 blocos; o bloco 7 dá o veredito. Os blocos 1–6 mostram **onde** está o
  buraco para priorizar correção.
- **O que corrigir primeiro (ordem de impacto no shadow):**
  1. **Alto risco sem `contraindications`/`pain_tags`** (segurança + evita handoff/blocker errado).
  2. **Padrões essenciais com < 3 alternativas seguras** (evita `safe_alternative_unavailable`).
  3. **`equivalent_substitutes`/`regressions`** nos compostos principais (melhora substituição).
  4. **`equipment`** ausente (melhora seleção por equipamento; hoje o `loadExerciseCatalog` nem traz
     `equipment` no `select` — ver gap de B3).
  5. **`muscle_group`/target primário** ausentes (melhora agrupamento/volume).
- **Impacto no shadow:** metadados ausentes → mais `gaps`/`safe_alternative_unavailable_count` e mais
  `handoff` indevido nas métricas do `shadow_comparison`. Subir a cobertura **antes** de ligar `shadow`
  em produção reduz ruído e torna a comparação engine × IA/fallback confiável.

## 9. Não fazer (explícito)
- **Não** rodar `UPDATE`/`DELETE`/`INSERT` — o `.sql` é só `SELECT`.
- **Não** criar migration nesta ordem.
- **Não** editar dados em produção sem um plano aprovado (preenchimento de metadados é uma ordem futura,
  idealmente com seed/curadoria revisada — não fake).
- Esta auditoria **não** altera banco, edge, engine, UI nem liga flag.
