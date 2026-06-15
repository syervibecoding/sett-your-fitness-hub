# BN Prescription Engine v1 — Tickets Executáveis da Fase B

> Baseado em `bn-prescription-engine-v1-phase-b-plan.md` (commit `469ce66`).
> **Nada aqui está implementado.** Cada ticket é pequeno, reversível e **não liga produção**.
> Pré-requisitos travados: Fase A = `ACCEPT_PROVISIONAL`; Cutover/Deploy = `NOT_AUTHORIZED`.

---

## 1. Visão geral

A Fase B é executada em **commits pequenos e reversíveis**, atrás de **feature flag** (`off`/`shadow`/`on`)
e validada por **shadow mode** antes de qualquer cutover. O engine determinístico
(`src/lib/prescription/**`) vira o **gerador principal**; a IA generativa (Anthropic) é **rebaixada** a
camada opcional de refinamento de texto; o `buildEmergencyFallbackPlan` permanece como **rede final**.
A ordem é: tornar o engine Deno-safe (B1) → adapters (B2/B3/B4) → shadow (B5) → flag/rollback (B6) →
testes (B7) → checklist de cutover (B8). O cutover (`on` em produção) é **etapa separada**, fora destes
tickets, e exige aprovação manual do orquestrador.

---

## 2. Ticket B1 — Deno-safe shared engine

**Objetivo:** disponibilizar o engine puro para `supabase/functions/_shared/prescription/` (rodar no runtime Deno da edge).

**Arquivos envolvidos:** `engine.ts`, `types.ts`, `methodology.ts`, `presets.ts`, `volumeRules.ts`,
`progressionRules.ts`, `restrictionRules.ts`, `exerciseScoring.ts`, `explanations.ts` (10 módulos puros).
`engine.test.ts` permanece como suíte.

**Estratégia de imports Deno-safe:**
- Imports relativos com **extensão explícita** `.ts` (`./presets.ts`, `./types.ts`).
- `import type { ... }` para imports só de tipo.
- **Sem** alias `@/` dentro do engine (já é tudo relativo — confirmar).
- O engine usa `Date`/`crypto.randomUUID` — OK no Deno edge (não usar APIs Node).

**Como manter os testes do front (fonte única, sem drift):**
- **Recomendado (Opção A):** mover o engine para `_shared/prescription/` e adicionar alias Vite/Vitest
  `@/lib/prescription/*` → `../supabase/functions/_shared/prescription/*`; o teste passa a importar do alias.
- **Stopgap (Opção C):** manter em `src/lib` e gerar cópia em `_shared` via script, **+ teste de drift**
  (hash/diff falha se divergirem). Migrar para A em seguida.

**Risco de duplicação:** alto se Opção C sem guard → mitigar com teste de drift. Opção A elimina o risco.

**Critério de aceite:** `deno check`/`deno test` do engine no caminho `_shared` verde; `npm run test`
(front) continua 81/81; 1 fonte de verdade (ou guard de drift ativo); nenhuma mudança de comportamento.

**Rollback:** reverter o commit (engine volta a `src/lib` apenas); como nada é importado pela edge ainda,
não afeta produção.

---

## 3. Ticket B2 — Input adapter (`edgePayload → PrescriptionInput`)

**Objetivo:** função pura `adaptEdgePayloadToPrescriptionInput(payload, catalog)` (em `_shared/prescription/` ou junto da edge).

**Arquivos:** novo `inputAdapter.ts` (lane Codex/edge). Lê tipos de `types.ts`.

**Mapa de campos** (payload da edge `ai-prescribe-workout`, l.1124-1142 → `PrescriptionInput`):

| PrescriptionInput | Origem | Obrigatório | Default seguro |
|---|---|---|---|
| `objective` | `objective` | sim | `"hipertrofia"` + warning |
| `fitnessLevel` | `fitness_level` | sim | `"iniciante"` (mais conservador) + warning |
| `daysPerWeek` | `days_per_week` | sim | `3` + warning |
| `durationWeeks` | `duration_weeks` | não | `6` |
| `equipment` | `equipment` | não | `"academia_completa"` |
| `restrictions` | `restrictions` | não | `""` |
| `injuries` | derivar de `restrictions`/`anamnese_context` | não | `[]` |
| `assessmentContext` | `assessment_context` | não | `undefined` (sem corretiva, warning informativo) |
| `anamneseContext` | `anamnese_context` | não | `undefined` |
| `prescriptionIntegration` | `prescription_integration` | não | `undefined` |
| `isEnduranceAthlete` | `is_endurance_athlete` | não | `false` |
| `runningDaysContext` | `running_days_context` | não | `null` |
| `blockNumber` | `block_number` | não | `1` |
| `notes` | `notes` | não | `undefined` |
| `painReports`/`painEva` | **não vem no payload atual** | não | `undefined` (dor lida via assessment/restrictions; ver risco §11) |
| `catalog` | saída do **B3** | sim | se vazio → engine já bloqueia (`empty_exercise_library`) |

**Warnings se informação ausente:** sem `assessment_context` → warning "sem avaliação funcional, priorização
corretiva reduzida"; sem `objective`/`fitness_level`/`days_per_week` → warning + default conservador.

**Casos severos EVA > 5:** o adapter **não decide** — apenas repassa `assessment_context`/`restrictions`/
(futuro) `painReports`; o engine classifica severidade e gera blocker + handoff. O adapter não deve
"limpar" sinais de dor.

**Critério de aceite:** teste unitário cobrindo todos os campos + defaults + warnings; payload mínimo
(só obrigatórios) gera `PrescriptionInput` válido; payload com dor severa preserva o sinal até o engine.

---

## 4. Ticket B3 — Catalog adapter (`exercise_library (+targets +metadata) → ExerciseCatalogEntry[]`)

**Objetivo:** converter o catálogo carregado pela edge em `ExerciseCatalogEntry[]` do engine.

**Arquivos:** novo `catalogAdapter.ts`. Fonte: `loadExerciseCatalog` (edge, l.276-289) + `exercise_muscle_targets`
+ `muscle_groups` + `exercise_metadata`.

**Campos mínimos (obrigatórios):** `id`, `name`. (Sem eles, descartar a linha — o engine já filtra em `normalizeCatalog`.)
**Campos importantes:** `muscle_group`, `equipment` ⚠️ (**estender o `select` de `loadExerciseCatalog`**:
hoje traz `id,name,description,muscle_group,is_global,company_id` — falta `equipment`/`difficulty`, usados na pontuação).
**Campos opcionais (de `exercise_metadata`):** `contraindications[]`, `regressions[]`, `progressions[]`,
`equivalent_substitutes[]`, `pain_limitation_tags[]`. **`targets[]`** ← `exercise_muscle_targets` resolvido por `muscle_groups.name`. **`movement_pattern`** ← coluna/metadado se existir; senão `undefined`.

**Tags necessárias para segurança:** `pain_limitation_tags` e `contraindications` (alimentam o ban por restrição/dor)
e `equivalent_substitutes` (substituição). Se vazias, o engine cai na seleção por keywords/região (degrada com segurança).

**Fallback quando metadado vazio:** arrays vazios (`[]`), nunca `undefined` quebrando o engine; `muscle_group`
ausente → manter o exercício mas contar como genérico (reduz precisão).

**Quando gerar warning:** taxa alta de exercícios sem `muscle_group`/`equipment`/metadados → warning de
"catálogo com metadados incompletos" (qualidade), pois eleva gaps/blockers.

**Quando gerar blocker:** catálogo vazio (0 exercícios) → o engine emite `empty_exercise_library` (blocker).
O adapter **não** inventa exercício; só converte.

**Critério de aceite:** teste com amostra real do `exercise_library` → `ExerciseCatalogEntry[]` válido;
metadados dobrados corretamente; sem exceção com metadados ausentes; medição de cobertura de metadados.

---

## 5. Ticket B4 — Output adapter (`TrainingProgram → plan persistido/consumido`)

**Objetivo:** garantir o shape salvo em `ai_strength_plans.plan` e consumido por PDF/telas/publicação. **É quase identidade** (a `TrainingProgram` já é compatível).

**Arquivos:** novo `outputAdapter.ts` (ou pass-through no handler). Consumidores: `ai_strength_plans` insert,
`publishStrengthPlan.ts`, `generatePDFs.ts`, `PrescriptionStudio.tsx`, `UnifiedPrescriber.tsx`.

**Campos garantidos (não podem ser removidos/renomeados — contrato aditivo):**
`cycle_name`, `objective`, `duration_weeks`, `block`/`block_number`, `biomechanical_notes`, `weekly_structure`,
`progression_protocol`, `warnings`, `workouts[].exercises[]` (`exercise_id,exercise_name,muscle_group,sets,reps,
rest_seconds,cues,biomechanical_note,exercise_order`), `periodization_blocks`, `methodology_preset`,
`library_policy`, `validator.pre_save`, `bnito_after_generation`.

**Campos novos permitidos (aditivos):** `schemaVersion`, `engineMeta`, `validation`, `explanations`,
`generated_by` (valor `bn_prescription_engine_v1`), echos opcionais `prescription_integration`/`bnito_orchestration`.

**Comportamento obrigatório:** replicar o **422** quando `validation.status === "blocked"` (igual ao handler
atual, l.1360-1368), retornando `{ error, validator, plan }`; persistir em `ai_strength_plans` com as mesmas
colunas; responder `{ id, plan }`.

**Critério de aceite:** teste verifica presença de TODOS os campos garantidos; `publishStrengthPlan.buildWorkoutRows`
e `generateStrengthPDF` consomem o output sem campo faltante; 422 preservado em caso bloqueado.

---

## 6. Ticket B5 — Shadow mode

**Objetivo:** rodar o engine **em paralelo** ao caminho atual (IA/fallback), **sem** alterar a resposta ao usuário.

**Arquivos:** handler `ai-prescribe-workout` (atrás de flag `shadow`), gravação em log dedicado.

**Logs comparativos (antigo vs novo), por geração:**
- volume por grupo (antigo vs engine)
- nº/códigos de **blockers**
- nº/códigos de **warnings**
- **exercícios inexistentes** (ids fora do catálogo — esperado 0 no engine)
- **tempo de geração** (engine ~instantâneo vs IA)
- **diferenças de split** (label/qtde de sessões)
- taxa de **`safe_alternative_unavailable`**
- taxa de **handoff** (`high_pain_requires_professional_review`)

**Critério:**
- **Não altera a resposta ao usuário** (continua IA/fallback).
- **Não altera o banco principal** — só grava em estrutura de log dedicada (reusar `ai_decision_logs` com
  `source="prescricao_shadow"` se couber; senão planejar tabela própria via ticket de migration **separado**).
- **Sem deploy de cutover.**

**Rollback:** flag volta a `off` (engine nem roda em paralelo).

---

## 7. Ticket B6 — Feature flag / rollback

**Objetivo:** controlar `off` / `shadow` / `on`.

**Variável sugerida:** env `PRESCRIPTION_ENGINE_V1` (`off`|`shadow`|`on`) **+** override por empresa
`company_ai_config.use_prescription_engine_v1` (boolean) para rollout gradual.

**Comportamento por modo:**
- `off`: fluxo atual (IA → fallback). Engine não roda.
- `shadow`: fluxo atual responde; engine roda em paralelo e loga (B5).
- `on`: engine é o gerador principal; IA opcional refina texto; validador roda; persiste/responde.

**Fallback automático para `buildEmergencyFallbackPlan` antigo:** qualquer exceção do engine, ou
`validation.status==="blocked"` por **bug** (não por segurança legítima) → cair no fallback. O fallback
**não é removido**.

**Quando desligar (`on→off`):** divergência crítica no shadow, pico de blockers por catálogo, exceção
recorrente do engine, ou ordem do orquestrador. Rollback é só virar a flag (sem deploy).

**Logs mínimos:** por geração — `engine_version`, `path` (engine|ia|fallback), `validator.status`,
contagem blockers/warnings, `library_policy.gaps`, duração. Sem dados clínicos crus além do necessário.

---

## 8. Ticket B7 — Tests

**Obrigatórios:**
- **adapter input** (B2): payload → `PrescriptionInput`, defaults, warnings, preserva dor severa.
- **adapter output** (B4): `TrainingProgram` → shape completo; 422 em bloqueado.
- **catalog adapter** (B3): `exercise_library`+targets+metadata → `ExerciseCatalogEntry[]`; metadados vazios.
- **edge local** (`deno test`/`supabase functions serve`): engine importa e roda no runtime Deno.
- **PDF contract**: `generateStrengthPDF(enginePlan)` não quebra; cabeçalho/sessões/warnings preenchidos.
- **publishStrengthPlan contract**: `buildWorkoutRows(enginePlan)` gera linhas válidas; materialização ok.
- **portal render smoke**: ciclo publicado renderiza no `StudentPortal` (aluno de teste).
- **EVA > 5 handoff**: engine 422 + alerta professor; edge não publica.
- **biblioteca sem substituto**: blocker `safe_alternative_unavailable`; 0 id inventado.
- **endurance ≥3x**: reduz MMII, preserva superiores, warning de agenda.
- **dor estruturada EVA > 3**: trava progressão + bloqueia avançado (regressão F1).
- **rollback**: flag `on→off` volta ao fluxo anterior sem deploy.

---

## 9. Ticket B8 — Cutover checklist (antes de ligar `on` em produção)

- [ ] Codex revisou o hotfix `ee4bfbe` (e este pacote da Fase B).
- [ ] Todos os testes verdes (front + adapters + edge/deno + contrato PDF + publicação).
- [ ] Shadow mode rodou com **amostra real** (≥ N gerações; relatório aprovado).
- [ ] **Zero exercício inventado** (100% dos ids resolvem no catálogo).
- [ ] **Caps preservados** (iniciante ≤12 / interm-avançado ≤16 no output).
- [ ] **Handoff preservado** (EVA>5/compensação severa → blocker + alerta professor).
- [ ] **PDF e portal** renderizam o plano do engine.
- [ ] **Rollback testado** (`on→off` por config, sem deploy).
- [ ] **Aprovação manual do orquestrador** (ordem explícita para ligar `on`).

---

## 10. Sequência recomendada de commits

1. `codex/claude: add deno-safe prescription shared engine` (B1)
2. `codex/claude: add prescription edge input adapter` (B2)
3. `codex/claude: add prescription catalog adapter` (B3)
4. `codex/claude: add prescription output adapter` (B4)
5. `codex/claude: add prescription shadow mode` (B5)
6. `codex/claude: add prescription feature flag rollback` (B6)
7. `codex/claude: add prescription contract tests` (B7)
8. `codex/claude: promote prescription engine behind flag` (B6/B8 — liga só `shadow`; **não** `on`)

> Ligar `on` em produção (cutover) é etapa separada destes commits, só após o checklist B8.

---

## 11. Riscos e bloqueios

| Risco | Mitigação |
|---|---|
| **Deno imports** (extensão/alias) | B1 Opção A (fonte única `_shared`, `.ts` + `import type`); validar com `deno check` |
| **Metadados incompletos** no catálogo real | B3 mede cobertura + warning; shadow mede taxa de blocker/gap antes do `on` |
| **Divergência fallback/engine** | shadow compara saídas; fallback permanece como rede |
| **Dor estruturada ausente no payload** | hoje dor vem via `assessment_context`/`restrictions` (engine lê); decidir estender payload p/ `painReports` no fluxo aluno→BNITO |
| **Quebra de contrato** PDF/telas | B4 garante campos; B7 testa contrato PDF/publicação/portal |
| **Shadow logs sem tabela** | reusar `ai_decision_logs` (`source=prescricao_shadow`) ou ticket de migration **separado** |
| **Ligar `on` cedo demais** | bloqueado pelo checklist B8 + aprovação manual; default é `off`/`shadow` |
| **Catálogo sem `equipment`/`difficulty`** | estender `select` do `loadExerciseCatalog` (B3) |

---

## 12. Definição de "não fazer" (explícito)

- **Não ligar a flag `on`** sem ordem explícita do orquestrador.
- **Não remover** o `buildEmergencyFallbackPlan` (rede de segurança permanece).
- **Não remover a Anthropic/IA** ainda — apenas **rebaixar** o papel para refino de texto opcional.
- **Não mudar UI/componentes** junto destes tickets (Fase B é edge/engine; UI fica para depois, se preciso).
- **Não fazer migration** sem necessidade — só se o shadow exigir tabela de log dedicada (ticket separado).
- **Não deployar** (edge/Netlify) sem ordem explícita.
- **Não promover** o engine ao caminho principal fora da flag.
