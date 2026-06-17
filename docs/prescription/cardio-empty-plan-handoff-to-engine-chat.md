# Handoff — Cardio (corrida/natação/ciclismo) salvando plano VAZIO

**De:** Claude (frontend / área do aluno)
**Para:** chat do motor de prescrição (owner de `supabase/functions/*`, edge, engine)
**Data:** 2026-06-17
**Severidade:** alta — o aluno "gera" cardio mas não vê treino nenhum.

## Sintoma
Master gera corrida/natação/pedal; no app do aluno a aba acende mas **não aparece treino** (sem semanas/sessões).

## Causa raiz (verificada no banco `zshrcgbyhzxpnlccssyz`)
- `running_plans`: **11 de 12 linhas com `weeks` NULL**, todas `model='polarizado'` (assinatura do fallback) e `warnings` citando `anthropic_400: ... Your credit balance is too low to access the Anthropic API`. Linha mais recente: **2026-06-17 15:31** (gerada hoje). A única linha com `weeks` real (Carlos Eduardo, 2026-06-14) foi uma chamada de IA bem-sucedida ANTES do saldo zerar.
- **Gatilho externo:** saldo da Anthropic zerado → a edge cai no fallback.
- **Defeito de código:** em `supabase/functions/ai-running-plan/index.ts`:
  - `fallbackCardioPlan()` (~linhas 88-113) e `normalizeCardioPlan()` (~115-121) **nunca definem `weeks`**.
  - O insert (~linha 523) grava `weeks: planJson.weeks` → `undefined` vira **NULL**, e o registro é salvo com **`status='active'`**, retornando **200**. O master acha que gerou; o aluno recebe uma casca vazia.

## Correções pedidas (engine_chat)
1. **Nunca persistir cardio sem `weeks`.** No fallback, construir um array `weeks` real (ex.: 6 semanas Z1–Z2 a partir de `days_per_week`/`session_duration`, com `sessions[]`), **ou** em `normalizeCardioPlan()`: se `!Array.isArray(plan.weeks) || plan.weeks.length===0`, derivar `weeks` a partir de `sample_week`.
2. **Falhar alto em vez de gravar casca.** Quando a IA falha por crédito/quota (400 "credit", 402, 429), retornar erro ao admin (`aiErrorResponse`) em vez de inserir plano `active` vazio. Alternativa: gravar com `status='draft'/'incomplete'` (nunca `'active'`).
3. **Rastreabilidade do bundle.** `PrescriptionStudio.tsx` gera vários cardios em loop e **não grava `running_plan_id` em `prescription_bundles`** (NULL em 10/10 bundles); `UnifiedPrescriber` grava. Padronizar (não é a causa do sintoma, mas é dívida de integridade).

## Mitigação já feita pelo Claude (área do aluno, em produção)
- `src/components/student/CardioPlanView.tsx`: se o plano existe mas `weeks`/sessões estão vazios, mostra **"Seu plano de {esporte} está sendo finalizado — fale com seu treinador"** em vez de um cabeçalho com acordeão vazio. Isso só melhora a UX; **não** cria conteúdo. O conteúdo real só volta com (a) crédito recarregado + (b) regeração.

## Limpeza de dados (após recarregar crédito e regerar)
As 11 cascas (`weeks` NULL) ficam como lixo na tabela. Como o app do aluno pega `limit(1)` por `(student_id, sport)` desc, basta **regerar** que o novo plano com conteúdo passa a aparecer. Remoção das cascas antigas é opcional e fica a critério do Matheus (ação destrutiva — não removo por conta própria).
