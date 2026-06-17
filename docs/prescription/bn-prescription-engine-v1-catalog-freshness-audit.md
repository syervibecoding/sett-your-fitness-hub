# Auditoria de Freshness do Catálogo (BN Prescription Engine v1)

> **ORDEM 040.** Medição **read-only** do catálogo atual de `exercise_library` após o usuário adicionar
> muitos exercícios novos. **Nenhum dado foi alterado** (somente `SELECT`). Baseline anterior (ORDEM 021)
> = **447** exercícios.

## 1. Métricas (read-only, banco `zshrcgbyhzxpnlccssyz`)
| # | Métrica | Valor |
|---|---|---|
| 1 | Total atual em `exercise_library` | **749** |
| 2 | Com `muscle_group` | 749 (100%) |
| 3 | Com **target primário** (`exercise_muscle_targets.role='primary'`) | **381** (51%) |
| — | Sem target primário | **368** (49%) |
| 4 | Com metadata (`exercise_metadata`) | **0** |
| 5 | Sem metadata | **749** (100%) |
| 6 | Com `equipment` | **302** (40%) |
| 7 | Sem `equipment` | **447** (60%) |
| 8 | Com `contraindications` | **0** (metadata vazia) |
| 9 | Com `pain_limitation_tags` | **0** (metadata vazia) |
| 10 | Com `equivalent_substitutes`/`regressions`/`progressions` | **0** (metadata vazia) |
| 11 | Na library mas **fora do manifesto consolidado** (215) | **534** |
| 12 | Na library mas **fora de qualquer pacote humano P1/P2/P3** | **534** (os pacotes = o mesmo conjunto de 215) |
| 13 | Criados após a auditoria anterior (`created_at >= 2026-06-16`) | **302** |
| 13b | Atualizados após 2026-06-16 (`updated_at`) | 749 (todos) |

- `min(created_at)` = 2026-03-22 · `max(created_at)` = 2026-06-17 02:34 · `max(updated_at)` = 2026-06-17 02:51.
- Todos os 749 são `is_global = true` (0 com `company_id`), então o filtro multi-tenant da edge inclui todos.

## 2. Delta vs baseline
| | Baseline (ORDEM 021) | Atual | Delta |
|---|---|---|---|
| Total de exercícios | 447 | **749** | **+302** |
| Fora do manifesto (215) | — | **534** | — |
| Sem metadata | 447 (100%) | 749 (100%) | +302 |
| Sem target primário | 66 | **368** | +302 |
| Sem equipment | 100% ausente | **447** | — |

O delta de **+302** bate exatamente com `created_at >= 2026-06-16 = 302`: são **exercícios novos**.

## 3. Natureza dos exercícios novos (amostra de 50 — ver CSV)
A grande maioria dos 302 novos é de **Performance / pliometria / potência**: depth jumps, drop jumps,
bounds, hops reativos, med ball throws/slams, sprints resistidos, sled push, wall drives, aterrissagens.
Todos com `muscle_group = "Performance"`, **sem target primário** e **sem metadata**.

> Arquivo: `bn-prescription-engine-v1-catalog-freshness-audit.csv` — 50 exemplos com colunas
> `exercise_id, exercise_name, muscle_group, has_primary_target, has_metadata, metadata_gap, needs_curation`.
> Para os 50 exemplos: `has_metadata=false`, `metadata_gap=true`, `needs_curation=true`.

## 4. Implicações
- **Runtime (engine/adapter):** considera **todos** os exercícios recebidos no catálogo (pool de
  candidatos) — confirmado por código e testes (ver `bn-prescription-engine-v1-catalog-coverage-report.md`).
- **Edge `loadExerciseCatalog`:** tem **`.limit(700)`**; com **749 > 700**, ~49 exercícios (ordenados por
  `muscle_group, name`) podem ser **cortados antes** de chegar ao engine → **BLOCKER** para "usar todos"
  (correção de edge fora do escopo desta ordem).
- **Curadoria desatualizada:** o manifesto/pacotes humanos cobrem só 215; **534** exercícios (incl. 302
  novos) estão **fora** e precisam de curadoria — pliometria exige cautela `high_skill/impact` e regra de
  "sem pliometria nas semanas 1–2".

## 5. Confirmação
Somente `SELECT` read-only via conector. **Sem** INSERT/UPDATE/DELETE/ALTER/CREATE, migration, alteração
de engine/edge/UI, deploy ou flag. Nenhum metadado aprovado/aplicado.
