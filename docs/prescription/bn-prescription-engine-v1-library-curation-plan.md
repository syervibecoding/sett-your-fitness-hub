# BN Prescription Engine v1 — Plano de Curadoria de Metadados da Biblioteca

## 1. Resumo executivo
A biblioteca tem **boa base estrutural** (447 exercícios, 100% com `muscle_group`/`difficulty`, 836 linhas
de `exercise_muscle_targets`, todos os 9 padrões de movimento presentes). Porém **`exercise_metadata` está
vazia (0 linhas)** e **`equipment` está 100% ausente** → o **shadow de paridade está `BLOCKED_FOR_SHADOW`**
(20 exercícios de alto risco sem contraindications; todos os padrões essenciais com 0 alternativas
"seguras"). O próximo gargalo **não é código** — é **curadoria de dados** (preencher metadados de segurança
e substituição). Este plano define como fazer isso de forma segura, sem aplicar nada no banco agora.

## 2. Objetivo da curadoria
Preparar a biblioteca para o engine rodar com baixa taxa de blocker:
- **seleção biblioteca-only** com qualidade (grupos/targets corretos);
- **substituição segura** (`equivalent_substitutes`/`regressions` reais);
- **restrições de joelho/lombar/ombro** (pain tags + contraindications);
- **equipamento limitado** (casa/halteres/academia) via `equipment`;
- **progressões/regressões** úteis;
- **reduzir `safe_alternative_unavailable`** garantindo ≥3 alternativas seguras por padrão essencial.

## 3. Campos a preencher (schema real)
| Campo | Onde | Tipo | Estado atual | Ação |
|---|---|---|---|---|
| `contraindications` | `exercise_metadata` | text[] | 0% | **preencher** |
| `pain_limitation_tags` | `exercise_metadata` | text[] | 0% | **preencher** |
| `equivalent_substitutes` | `exercise_metadata` | text[] | 0% | **preencher** (ver nota) |
| `regressions` | `exercise_metadata` | text[] | 0% | **preencher** |
| `progressions` | `exercise_metadata` | text[] | 0% | **preencher** |
| `equipment` | `exercise_library` | text (livre) | 100% ausente | **preencher** (texto; padronizar via taxonomia §4) |
| `difficulty`/level | `exercise_library` | text | 100% presente | revisar consistência (não urgente) |
| `muscle_group` (texto) | `exercise_library` | text | 100% presente | ok |
| target primário (`is_primary`) | `exercise_muscle_targets` | bool | 85% | completar os 66 sem primário |
| **`movement_pattern`** | — | — | **não existe** | **`SCHEMA_GAP`** — engine infere por keyword; criar coluna seria migration futura (fora desta fase) |

> **Nota `equivalent_substitutes`:** é `text[]`. O conteúdo pode ser **nome** ou **exercise_id** real — a
> curadoria deve usar **somente itens existentes na biblioteca** (buscados via SELECT). O engine resolve
> substitutos casando texto/keywords; preferir referenciar nomes reais e/ou ids.
>
> **`SCHEMA_GAP` registrados:** (1) `movement_pattern` não tem coluna (inferência por keyword permanece);
> (2) `equipment` é texto livre em `exercise_library` (não enum) e o `loadExerciseCatalog` da edge **nem o
> seleciona** hoje (gap B3) — a curadoria de `equipment` só terá efeito no engine após estender esse select.

## 4. Taxonomia recomendada (valores padronizados)
**Pain limitation tags:** `knee_pain`, `low_back_pain`, `shoulder_pain`, `cervical_pain`, `hip_pain`,
`wrist_pain`, `dynamic_valgus`, `butt_wink`, `trunk_lean`, `shoulder_impingement`, `overhead_limitation`.

**Contraindications:** `acute_knee_pain`, `acute_low_back_pain`, `acute_shoulder_pain`,
`loaded_spinal_flexion`, `deep_loaded_knee_flexion`, `painful_overhead_press`, `high_skill_plyometric`,
`unstable_beginner_variation`.

**Equipment:** `bodyweight`, `dumbbells`, `barbell`, `machine`, `cable`, `band`, `bench`, `kettlebell`,
`pullup_bar`, `minimal_home`, `full_gym`.

**Movement patterns (inferidos):** `joelho_dominante`, `quadril_dominante`, `empurrar_horizontal`,
`empurrar_vertical`, `puxar_horizontal`, `puxar_vertical`, `core`, `unilateral`, `isolado_acessorio`.

> Padronizar os valores facilita o matching do engine (keywords) e futuras regras. As tags em inglês
> (snake_case) batem com o vocabulário já usado no engine/avaliação (ex.: `dynamic_valgus`, `butt_wink`).

## 5. Priorização
- **P1 (segurança):** os **20 exercícios de alto risco sem contraindications** + todos os relevantes a
  **joelho (54) / lombar (51) / ombro (100)** sem pain tags.
- **P2 (substituição):** compostos principais sem `regressions`/`equivalent_substitutes`; garantir **≥3
  alternativas seguras** por padrão essencial.
- **P3 (completude):** `equipment`, `progressions`, e dados cosméticos/explicativos (`notes`), os 66 sem
  target primário.

## 6. Estratégia de segurança (regra: na dúvida, tag conservadora)
- Exercício de **alto risco** → **precisa** de contraindication.
- **Carga axial** (terra, agachamento livre pesado, good morning) → `low_back_pain` + `loaded_spinal_flexion`.
- **Overhead/desenvolvimento** → `shoulder_pain` + `painful_overhead_press`/`overhead_limitation`.
- **Joelho profundo/carregado** (ATG, agachamento profundo) → `knee_pain` + `deep_loaded_knee_flexion`.
- **Pliometria/salto** → `high_skill_plyometric` + impacto.
- Toda tag clínica é **sugestão** até validação humana (professor/curador).

## 7. Critérios para liberar shadow real (thresholds mínimos)
- **0** exercício de alto risco sem contraindication.
- **Cada padrão essencial com ≥3 alternativas seguras** (joelho_dominante, quadril_dominante,
  empurrar_horizontal, puxar_horizontal, puxar_vertical).
- **Joelho/lombar/ombro** com cobertura mínima de pain tags nos compostos/maior carga (meta inicial: ≥60%
  dos relevantes de alto risco taggeados).
- `equivalent_substitutes`/`regressions` presentes nos **compostos principais**.
- `equipment` preenchido o suficiente para não quebrar os cenários **casa / halteres / academia**.
- Releitura do `audit.sql` → bloco 7 `status_sugerido` deve sair de `BLOCKED_FOR_SHADOW`.

## 8. Plano de execução (lotes)
- **Lote A — Alto risco:** os 20 (desenvolvimentos/overhead, encolhimento overhead, levantamento terra).
- **Lote B — Regiões de risco:** joelho/lombar/ombro relevantes (pain tags + contraindications).
- **Lote C — Compostos principais:** agachamento, leg press, hip thrust/RDL, remada, puxada, supino
  (`equivalent_substitutes`/`regressions`, garantir ≥3 seguras/padrão).
- **Lote D — Equipment:** preencher `exercise_library.equipment` (+ estender o select da edge, gap B3).
- **Lote E — Progressions/regressions globais:** completar o restante.

## 9. Controle de qualidade
- **Rodar `audit.sql` antes e depois** de cada lote e **comparar `status_sugerido`** + as métricas (bloco 7).
- Medir, no shadow diagnóstico, `safe_alternative_unavailable_count` e `handoff_count` (devem cair).
- **Revisão manual** dos exercícios críticos (alto risco + compostos) por professor/curador.
- Tags clínicas **só viram verdade após aprovação humana** (campo `reviewer_status` na worksheet).

## 10. Não fazer
- **Não inventar metadado** sem revisão humana.
- **Não rodar `UPDATE` em produção** sem backup/plano aprovado.
- **Não ligar shadow de paridade** antes da curadoria mínima (§7).
- **Não usar IA para decidir clinicamente sozinha** — sugestão + validação humana.
- **Não remover blockers do engine** só para "passar" a auditoria — corrigir o **dado**, não a régua.

## 11. Próxima etapa
Preparar um **pacote de curadoria inicial** para os **20 exercícios de alto risco** (worksheet
`library-curation-high-risk-v1.md` + `.csv`), com tags **sugeridas** e `reviewer_status=needs_review` —
**documento/worksheet, não aplicado no banco** (ORDEM 024).
