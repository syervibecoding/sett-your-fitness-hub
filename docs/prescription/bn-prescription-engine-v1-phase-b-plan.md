# BN Prescription Engine v1 — Plano Técnico da Fase B

> **Status:** planejamento. **Nada implementado.** Fase A = `ACCEPT_PROVISIONAL`;
> Fase B = `NOT_AUTHORIZED_FOR_CUTOVER`. Este documento descreve COMO promover o engine com segurança.

---

## 1. Objetivo da Fase B

Promover `generateTrainingProgram` (engine determinístico, `src/lib/prescription/**`) como **gerador
principal** da prescrição de força na edge `ai-prescribe-workout`, mantendo a **IA generativa
(Anthropic) apenas como camada opcional** de explicação/refinamento (cues mais ricos, texto BNITO),
**nunca** como fonte de exercícios ou de decisões de segurança. Ordem de confiança:

```
engine determinístico (regras + biblioteca)  →  [opcional] IA refina texto/cues  →  validador  →  publicação
```

A IA deixa de "inventar o plano"; passa a comentar um plano que já nasce seguro, biblioteca-only e
dentro dos caps. O `buildEmergencyFallbackPlan` continua como rede de segurança final.

---

## 2. Arquivos a analisar (mapa do terreno — já levantado)

| Arquivo / símbolo | Papel hoje | Relevância p/ Fase B |
|---|---|---|
| `supabase/functions/ai-prescribe-workout/index.ts` (1413 linhas) | handler: lê payload (`req.json`, l.1124-1142), `assertTenantAccess`, carrega config+catálogo, monta prompt, chama Anthropic, valida, insere em `ai_strength_plans`, responde `{id, plan}` | host da Fase B — onde o engine entra |
| `buildEmergencyFallbackPlan` (l.784-883) | plano determinístico de emergência (sem Anthropic) | **referência de contrato de saída** e rede de rollback; o engine é o "fallback promovido a principal" |
| `pickCatalogExercise` antigo (l.723) / `fallbackExercise` (l.755) | seleção por keywords no fallback | serão **substituídos** pela seleção do engine (`exerciseScoring.ts`); manter só no caminho de emergência |
| `validatePrescriptionPlan` antigo (l.556) | validador pré-salvar da edge (duração 6sem, blocos, etc.) | reconciliar com o validador do engine (`validator.ts`); evitar dupla validação divergente |
| `loadExerciseCatalog` (l.276-289) | `select id,name,description,muscle_group,is_global,company_id` + targets + muscle_groups + overrides + `exercise_metadata` | **fonte do catálogo** do adapter de entrada. ⚠️ não traz `equipment`/`difficulty` hoje |
| `ai_strength_plans` (insert l.1390) | colunas: `id, company_id, student_id, cycle_name, objective, duration_weeks, biomechanical_notes, plan(jsonb), anamnese_id, bundle_id` | **contrato de saída persistido**; `plan` guarda o JSON inteiro |
| `src/lib/publishStrengthPlan.ts` | materializa `plan.workouts[]` em `training_cycles`+`workouts` p/ o app do aluno | consome `plan.{cycle_name,objective,duration_weeks,workouts[].{name,day_of_week,notes,exercises[].{exercise_id,exercise_name,muscle_group,sets,reps,rest_seconds|rest,cues|biomechanical_note,exercise_order}}}` |
| `src/lib/generatePDFs.ts` (`generateStrengthPDF` l.176-251) | PDF de musculação | lê `plan.{cycle_name,objective,duration_weeks,block/block_number,biomechanical_notes,weekly_structure,workouts[].exercises[].exercise_order,progression_protocol,warnings}` |
| `src/pages/admin/PrescriptionStudio.tsx` | invoca a edge (l.237), `data.plan`→`results.musculacao`, publica (l.361/380) | consumidor da response `{id, plan}` |
| `src/pages/admin/UnifiedPrescriber.tsx` | invoca a edge (l.325), lê `data.plan`/`data.id`, `bnito_after_generation` (l.486), `validator` em erro 422 (l.83/346) | consumidor; depende de `validator`/`bnito_after_generation` |

**Conclusão do mapa:** a `TrainingProgram` do engine **já é shape-compatível** com `ai_strength_plans.plan`,
com o publicador, com o PDF e com as telas. O risco principal **não é contrato** — é **Deno-safety**,
**catálogo/metadados reais** e **paridade com o fluxo atual** (shadow).

---

## 3. Risco Deno / Supabase Edge

**Por que `src/lib/prescription` não importa direto na edge hoje:**
- Imports **sem extensão** (`import { x } from "./presets"`) — Deno exige `./presets.ts`.
- Path alias `@/...` (usado em outras libs do front) — Deno não resolve o alias do Vite.
- Risco de `import type` não isolado e de Node-isms. (O engine em si não usa Node API; usa `Date`/
  `crypto.randomUUID`, que são OK no runtime Deno da edge — o bloqueio é só de extensão/alias.)

**Opções:**
- **A. Mover o engine puro para `supabase/functions/_shared/prescription/`** (Deno-safe: extensões `.ts`,
  `import type`), e o front passa a importar de lá (alias do Vite `@/lib/prescription/*` → `_shared`).
  → 1 fonte de verdade, roda em Deno, mantém os 81 testes (repontando o import/alias).
- **B. Adapter Deno-safe** só na borda, mantendo o engine no front. → não resolve: o engine **em si**
  precisa rodar na edge; o adapter não elimina o problema de extensão/alias do core.
- **C. Manter `src/lib` como fonte e gerar cópia controlada em `_shared`.** → funciona, mas cria **drift**
  (duas cópias). Só aceitável como stopgap, com guard automatizado.

**Recomendação:** **Opção A** (fonte única em `_shared/prescription`, Deno-safe; front importa via alias;
testes repontados). Se a relocação não couber num único PR, usar **C como ponte temporária** com um
**teste de drift** que falhe se as duas cópias divergirem (hash/diff) — e migrar para A em seguida.

---

## 4. Adapter de entrada (`edgePayload → PrescriptionInput`)

Mapa direto (payload da edge, l.1124-1142 → `PrescriptionInput` de `types.ts`):

| PrescriptionInput | Origem no payload | Observação |
|---|---|---|
| `objective` | `objective` | — |
| `fitnessLevel` | `fitness_level` | — |
| `daysPerWeek` | `days_per_week` | engine já faz clamp 2–6 |
| `durationWeeks` | `duration_weeks` | engine resolve p/ 4 ou 6 |
| `equipment` | `equipment` | usado na seleção; ver §3/loadExerciseCatalog |
| `restrictions` | `restrictions` | texto de lesões/restrições |
| `injuries` | derivar de `restrictions`/`anamnese_context` | sem campo dedicado hoje |
| `assessmentContext` | `assessment_context` | OHS/`prescription_context`; alimenta severidade/regras |
| `anamneseContext` | `anamnese_context` | — |
| `prescriptionIntegration` | `prescription_integration` | prioridade máxima de contexto |
| `isEnduranceAthlete` | `is_endurance_athlete` | F2 |
| `runningDaysContext` | `running_days_context` `{days_per_week,sport}` | F2 (≥3x → reduz MMII) |
| `blockNumber` | `block_number` | gate de pliometria |
| `notes` | `notes` | — |
| `painReports` / `painEva` | **não existem no payload atual** | ver nota abaixo |
| `catalog` | `loadExerciseCatalog(...)` mapeado | ver mapeamento de catálogo |

**Nota sobre dor estruturada (F1):** o payload atual **não** carrega `painReports[]`/`painEva`. Hoje a
dor chega via `assessment_context` (OHS `severidade`) e `restrictions` (texto) — que o engine já lê
(`classifyPainSeverity` + `hasPainContext` pós-F1). **Decisão p/ Fase B:** (a) manter assim (suficiente
para o fluxo do professor), e/ou (b) estender o payload para repassar `painReports` quando vier do fluxo
aluno→BNITO (relato de dor). Recomendo (a) no cutover e (b) como melhoria.

**Mapeamento do catálogo (`loadExerciseCatalog` row → `ExerciseCatalogEntry`):**
`id, name, description, muscle_group` (diretos) · `targets` ← `exercise_muscle_targets` (já resolvido
por `muscle_groups.name`) · `contraindications/regressions/progressions/equivalent_substitutes/
pain_limitation_tags` ← `exercise_metadata` · `equipment/difficulty` ← **estender o `select` de
`loadExerciseCatalog`** (hoje não busca essas colunas e o engine usa `equipment` na pontuação) ·
`movement_pattern` ← se existir coluna/metadado; senão deixar `undefined` (o engine cai em keywords).

---

## 5. Adapter de saída (`TrainingProgram → plan persistido / consumido`)

**É quase identidade** — a `TrainingProgram` já contém os campos consumidos. Checklist 1:1:

| Campo consumido | Engine produz? | Ação do adapter |
|---|---|---|
| `cycle_name` | ✅ | pass-through (também vira coluna do insert) |
| `objective` | ✅ | pass-through (coluna) |
| `duration_weeks` | ✅ | pass-through (coluna) |
| `biomechanical_notes` | ✅ | pass-through (coluna) |
| `block` / `block_number` | ✅ (`block:"1"`) | pass-through (PDF lê com fallback) |
| `weekly_structure` | ✅ | pass-through |
| `progression_protocol` | ✅ | pass-through |
| `warnings` (string[]) | ✅ | pass-through |
| `workouts[].exercises[]` (`exercise_id,exercise_name,muscle_group,sets,reps,rest_seconds,cues,biomechanical_note,exercise_order`) | ✅ | pass-through (publicador + PDF já compatíveis) |
| `periodization_blocks` | ✅ | pass-through |
| `methodology_preset` `{key,label,why_selected,rules}` | ✅ | pass-through |
| `library_policy` `{only_library_exercises,catalog_count,gaps,validation}` | ✅ | pass-through |
| `validator.pre_save` | ✅ | pass-through; **replicar o 422** quando `validation.status==="blocked"` |
| `validation` | ✅ | pass-through (aditivo) |
| `bnito_after_generation` `{intent,question_to_teacher,suggested_message}` | ✅ | pass-through (telas leem) |
| `explanations` | ✅ (aditivo) | pass-through |
| `engineMeta` / `schemaVersion` | ✅ (aditivo) | pass-through |
| `generated_by` | ✅ (`bn_prescription_engine_v1`) | valor novo, campo presente |
| `prescription_integration` / `bnito_orchestration` (echo) | ❌ | **anexar pós-geração** (como a edge faz hoje, l.1371-1386) — aditivo |

**Persistência:** `insert` em `ai_strength_plans` igual ao atual (`cycle_name/objective/duration_weeks/
biomechanical_notes/plan=programa`); **response** `{ id, plan }` igual. **Sem remoção/renomeação** de
campos → contrato aditivo preservado (decisão #1).

---

## 6. Shadow mode (obrigatório antes do cutover)

Rodar o engine **em paralelo** ao caminho atual (IA/fallback), **sem** mostrar ao aluno:

1. No handler, após gerar o plano atual (IA ou fallback), chamar também `generateTrainingProgram(adaptInput(...))`.
2. **Não** publicar nem retornar o plano do engine; apenas **logar** comparativo em `ai_decision_logs`
   (source `prescricao_shadow`) ou tabela dedicada: `{ student_id, company_id, engine_version, current_vs_engine }`.
3. Métricas comparadas por geração: **volume por grupo**, **nº/códigos de blockers**, **nº/códigos de
   warnings**, **exercícios inexistentes** (ids fora do catálogo — esperado 0 no engine), **tempo de
   geração** (engine deve ser ~instantâneo vs IA), **taxa de blocker por metadados incompletos**
   (`safe_alternative_unavailable`, `no_optional_accessory_available`).
4. Rodar por N gerações reais (definir amostra, ex.: ≥30 alunos variados) antes de habilitar o flag.
5. Critério para avançar: **0 exercício inventado** no engine; taxa de blocker explicável (não causada
   por bug, e sim por catálogo/metadado faltando); sem divergência crítica de segurança vs o esperado.

---

## 7. Feature flag / rollback

- **Flag:** `company_ai_config.use_prescription_engine_v1` (boolean por empresa) **+** override global por
  env (`PRESCRIPTION_ENGINE_V1=on/off/shadow`). Estados: `off` (fluxo atual), `shadow` (§6), `on` (engine principal).
- **Ordem de decisão no handler:** `engine on?` → engine; senão IA; **catch/erro/`blocked` inesperado →
  `buildEmergencyFallbackPlan`** (rede final, intacta).
- **Rollback imediato:** virar a flag para `off` (volta ao caminho IA/fallback atual) — sem deploy, por config.
- **Logs mínimos p/ auditoria:** por geração, registrar `engine_version`, `path` (engine|ia|fallback),
  `validator.status`, contagem de blockers/warnings, `library_policy.gaps`, duração. Sem dados clínicos crus além do necessário.
- **Quando voltar para fallback:** qualquer exceção do engine; `validation.status==="blocked"` por bug (não
  por segurança legítima); divergência crítica detectada no shadow; pico de blockers por catálogo.

---

## 8. Testes necessários na Fase B

- **Unitários do adapter de entrada** — payload da edge → `PrescriptionInput` (todos os campos da §4; catálogo mapeado com metadados).
- **Unitários do adapter de saída** — `TrainingProgram` → shape do `plan` (todas as chaves da §5; nada removido).
- **Teste com catálogo real** — usar export do `exercise_library` de produção; medir gaps/blockers.
- **Teste de edge local** (`supabase functions serve` / `deno test`) — engine importa e roda no runtime Deno (valida §3).
- **Teste de contrato PDF** — `generateStrengthPDF(enginePlan)` não quebra e preenche cabeçalho/sessões/warnings.
- **Teste de publicação para aluno** — `buildWorkoutRows(enginePlan,...)` gera linhas válidas; `publishStrengthPlanToStudent` materializa ciclo/treinos.
- **Teste de caso severo EVA > 5** — engine → 422 + handoff; edge não publica.
- **Teste biblioteca sem substituto** — blocker `safe_alternative_unavailable`; nenhum id inventado.
- **Teste de renderização no portal** — aluno de teste recebe o ciclo publicado e o `StudentPortal` renderiza (E2E manual/automatizado).
- **Teste de shadow/paridade** — engine vs fallback no mesmo input: sem exercício fora da biblioteca; caps respeitados.

---

## 9. Critério de aceite da Fase B (gates)

Promover para `on` só com **todos**:
- ✅ Todos os testes verdes (front + adapter + edge/deno + contrato PDF + publicação).
- ✅ Shadow mode sem regressão crítica (amostra ≥ N; relatório comparativo aprovado).
- ✅ **Zero exercício inventado** (100% dos `exercise_id` resolvem no catálogo).
- ✅ **Zero quebra de contrato** (PDF/telas/publicação consomem sem campo faltante).
- ✅ Handoff severo (EVA>5/compensação severa) preservado (blocker + alerta professor).
- ✅ Volume caps preservados (iniciante ≤12 / interm-avançado ≤16 no output).
- ✅ PDF e portal renderizam o plano do engine.
- ✅ **Rollback testado** (flag `on→off` volta ao fluxo anterior sem deploy).
- ✅ Revisão independente do Codex no hotfix `ee4bfbe` e neste plano.

---

## 10. Plano de commits sugerido (sequência)

1. `codex/claude: add deno-safe prescription adapter`
   — relocar engine p/ `_shared/prescription` (Opção A) + adapters in/out + repontar imports/testes. Sem ligar nada.
2. `codex/claude: add prescription engine shadow mode`
   — rodar engine em paralelo + logs comparativos (§6). Aluno não vê nada.
3. `codex/claude: promote prescription engine behind flag`
   — flag `off/shadow/on` + ordem de decisão + rollback p/ `buildEmergencyFallbackPlan` (§7).
4. `codex/claude: verify prescription engine pdf portal contract`
   — testes de contrato PDF/publicação/portal + caso severo + biblioteca sem substituto (§8).

> Cutover (virar a flag `on` em produção) é etapa **separada**, fora destes commits, só após os gates da §9.

---

### Recomendação central
**Opção A** (engine como fonte única em `supabase/functions/_shared/prescription`, Deno-safe, front via alias) +
**adapters finos** (entrada com mapeamento de catálogo/metadados; saída quase identidade) +
**shadow mode obrigatório** + **feature flag com rollback para o fallback atual**. O contrato de saída já é
compatível; o trabalho real é Deno-safety, qualidade de metadados do catálogo real e paridade comprovada.
