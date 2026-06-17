# Handoff — Periodização para o motor de prescrição (fallback)

**De:** Claude (frontend / área do aluno)
**Para:** chat que cuida do motor/fallback de prescrição (owner de `supabase/functions/_shared/prescription/*` e `UnifiedPrescriber`)
**Data:** 2026-06-17
**Status:** frontend já em produção; motor **não foi tocado** por mim (respeitando a divisão de ownership do CLAUDE.md).

## O que eu fiz (frontend, área do aluno — meu ownership)
- Novo módulo `src/lib/periodization.ts`: modelo determinístico de periodização (microciclos
  ordinário/choque/regenerativo + mesociclos base/acumulação/intensificação/polimento), derivado de
  `objetivo` + `duração/datas` do ciclo. Alinhado a `PROGRESSION_BLOCKS` e `DELOAD_RULES`.
- Novo componente `src/components/student/PeriodizationBanner.tsx` + wiring em `StudentPortal.tsx`
  (aba Treino): o aluno vê a fase atual e a linha do tempo das semanas.
- `WorkoutLibrary.generate()` grava um resumo das fases na descrição do template.
- Doc da metodologia: `docs/prescription/periodization-methodology-v1.md`.

## O que peço ao motor (quando vocês puderem, sem urgência)
Hoje o frontend **deriva** a periodização client-side. Para a fonte da verdade ficar no motor:

1. **Nomear as fases no motor.** `methodology.ts`/`progressionRules.ts` já têm `PROGRESSION_BLOCKS`
   (base/accumulation/intensification) e `DELOAD_RULES`, mas não expõem os **tipos de microciclo**
   (ordinário/choque/regenerativo) nem o rótulo **polimento**. Sugiro adicionar esses rótulos ao
   `buildPeriodizationBlocks()` (ou um novo `buildPeriodizationPlan()`), seguindo exatamente as regras do
   `periodization-methodology-v1.md` (deload em blocos de 4 / última semana; choque na véspera do deload;
   polimento na última semana para objetivos de performance).
2. **Persistir o plano** (opcional, futuro): hoje `training_cycles` tem `objective` + `duration_weeks` +
   datas — suficiente para o frontend derivar. Se um dia quiserem gravar a fase por semana, dá para
   adicionar uma coluna `periodization jsonb` em `training_cycles` (sem migration agora; só quando decidirem).
3. **Manter contrato.** Se o motor passar a devolver `periodization_blocks` com `microcycle_type` e
   `mesocycle_phase`, o frontend pode consumir isso em vez de derivar. Mantenham os mesmos identificadores
   (`ordinario|choque|regenerativo` e `base|acumulacao|intensificacao|polimento`) para não quebrar o banner.

## Garantias do meu lado
- Não toquei em `supabase/functions/**`, engine, edge, migrations nem no banco.
- Sem deploy do motor; meu deploy foi só do frontend (`bn-performance-webapp-matheus.netlify.app`).
