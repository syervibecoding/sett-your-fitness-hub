# Relatório de Risco do Prompt Externo — Periodização (BN Prescription Engine v1)

> **ORDEM 041.** Avalia o prompt enviado a outro chat do Claude (melhorar a exibição de periodização) e
> o que já foi commitado por ele, sem corrigir/reverter nada. **Nada foi alterado no engine/edge/UI/banco.**

## 1. Qual foi o prompt externo
Pedido: a montagem de treinos deve **exibir melhor a periodização** — microciclos (ordinário,
regenerativo, choque), mesociclos (base, polimento), fases do aluno e periodização por objetivo/datas.

**O que já foi commitado** (commit Codex `30adf86 — "feat: periodização no app do aluno…"`):
- `src/lib/periodization.ts` (NOVO helper de display, 122 linhas)
- `src/components/student/PeriodizationBanner.tsx` (NOVO componente do aluno)
- `src/pages/student/StudentPortal.tsx` (+12), `src/pages/admin/WorkoutLibrary.tsx` (+7/−2)
- `docs/prescription/periodization-methodology-v1.md`, `docs/prescription/periodization-handoff-to-engine-chat.md`
- `CLAUDE.md` (+1)

## 2. Auditoria de risco (Parte A)
| Ponto sensível | Houve alteração? | Tipo | Risco |
|---|---|---|---|
| `supabase/functions/ai-prescribe-workout/index.ts` (edge) | **Não** | — | nenhum |
| `supabase/functions/_shared/prescription/**` (engine) | **Não** | — | nenhum |
| `src/lib/prescription/**` (shims/tests) | **Não** | — | nenhum |
| `src/lib/generatePDFs.ts` | **Não** | — | nenhum |
| `src/lib/publishStrengthPlan.ts` | **Não** | — | nenhum |
| `src/pages/admin/PrescriptionStudio.tsx` / `UnifiedPrescriber.tsx` | **Não** | — | nenhum |
| `src/lib/periodization.ts` (novo) | Sim (novo) | **display-only** | baixo |
| `PeriodizationBanner.tsx` / `StudentPortal.tsx` / `WorkoutLibrary.tsx` | Sim | **display-only** (aluno) | baixo |

**Respostas:**
- **Houve alteração externa nos pontos sensíveis?** Engine/edge/contrato/PDF/portal/prescription-shims: **não**.
  Só camada de **exibição** do app do aluno (novo módulo + banner).
- **É só estética ou altera contrato?** **Só estética/display.** `periodization.ts` **deriva** o plano
  semana-a-semana de `objective`+`durationWeeks` (determinístico) e **não consome `plan.periodization_blocks`**
  → não acopla nem altera o contrato `TrainingProgram`.
- **Risco de quebrar o engine?** **Não** (engine intocado).
- **Risco de quebrar PDF/portal?** **Não** (PDF/publish não consomem `periodization_blocks`; o banner é UI separada).
- **Risco de mudar comportamento com flag off?** **Não** (a flag shadow e a edge estão intocadas; o helper é UI).
- **Risco de cutover acidental?** **Não** (nada de deploy/flag/edge).

## 3. O que é seguro
- O trabalho externo é **aditivo e isolado** (display do aluno) e **não tocou** o motor/contrato.
- A taxonomia do helper (ordinário/choque/regenerativo; base/acumulação/intensificação/polimento) é
  **compatível** com a do engine e pode ser reconciliada via o plano aditivo (extension-plan).

## 4. O que NÃO pode ser feito sem ATENA
- Estender `periodization_blocks`/contrato do engine.
- Alterar a edge `loadExerciseCatalog`/`index.ts`.
- Tornar a periodização do banner **fonte de verdade** da prescrição.
- Ligar flag / deploy / cutover.

## 5. Arquivos que outro Claude NÃO deve tocar
`supabase/functions/ai-prescribe-workout/index.ts`; `supabase/functions/_shared/prescription/**`;
`src/lib/prescription/**`; `src/lib/generatePDFs.ts`; `src/lib/publishStrengthPlan.ts`;
qualquer consumidor de `plan.periodization_blocks` sem teste de contrato.

## 6. Como alinhar periodização sem quebrar o engine
- Seguir o **plano aditivo** (`bn-prescription-engine-v1-periodization-extension-plan.md`): novos campos
  **opcionais** em `periodization_blocks`, testes de contrato **antes** do código, safety rules preservadas.
- **NOTE de segurança (display vs engine):** o `src/lib/periodization.ts` marca a semana pré-deload como
  **`choque` (RIR 1–2, "perto da falha")** **sem gate de nível/dor**. Como é **só banner** (não alimenta o
  engine), **não** quebra contrato/segurança da prescrição — mas é uma **inconsistência metodológica**: o
  aluno iniciante ou com dor poderia ver "choque/perto da falha". **Não corrigido nesta ordem** (arquivo
  não-Claude); recomenda-se, em ordem futura com gate ATENA, gatear o `choque` do banner por nível/dor
  (alinhado às safety rules) — sem tocar no engine.

## 7. Status
- **SAFE_TO_PLAN** ✅ — a extensão é compatível e está planejada de forma aditiva.
- **NOT_SAFE_TO_IMPLEMENT_DIRECTLY** ✅ — implementar (engine/contrato) exige gate ATENA + testes de contrato.

> Engine/edge/PDF/portal/contrato **intactos**. Trabalho externo = display-only, sem risco ao motor.
> Banco intocado; sem SQL; sem deploy/flag/cutover.
