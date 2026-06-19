# Reforma da Anamnese — Design + Handoff (SETT / BN Performance)

**Autor:** ATENA (Claude) · **Data:** 2026-06-18 · **Empresa:** BN Performance (`dad65c62`)
**Decisões do Matheus (travadas):** liberação das prescrições = **MANUAL** (a IA pré-gera tudo, o professor revisa e libera cada uma). Defaults: nutrição = **só orientar** (não prescreve cardápio); anamneses antigas (`anamnesis` JSONB) = **cortar daqui pra frente** (legado read-only). pg_cron está habilitado, mas com liberação manual **não é necessário** cron de release.

## Os 4 pedidos
1. **Anamnese única** = a do estúdio integrado (`StudioAnamnese.tsx` / `student_anamneses`), colada na aba Admin "Anamnese", completa p/ todas modalidades + **gerar link e enviar no WhatsApp** do aluno selecionado.
2. **Sincronização** entre prescrições (anti-overtraining): ordem de fases **base(força) → ordinários** (reduz volume-load da musculação enquanto sobe o volume da modalidade), microciclos (ordinário/choque/regenerativo) + troca de estímulo a cada 2 semanas, **alinhados entre modalidades**.
3. **Anamnese intra-ciclo + NPS** ao fim de cada 6 semanas; a IA pré-gera o plano inteiro (ex.: 12 sem = 2 ciclos de 6) e o professor libera manualmente; o NPS aparece nessa revisão.
4. **Anamnese viva / condicional**: gates "tem nutri? quer dicas?" / "pratica corrida/pedal/natação?" antes de cada bloco.

## Divisão de ownership
- **claude (anamnese/UI/app aluno/WhatsApp/Central form):** itens 1 e 4 inteiros; a parte de UI/dados do item 3 (form de NPS + tabela `cycle_feedback`); novos campos no form da Central de IA (insumo do item 2).
- **engine_chat (motor/edges):** item 2 (orquestrador de periodização + volume-load cruzado) e a geração **multi-prescrição** do item 3.

---

## HANDOFF engine_chat (acionável)

### A) Orquestrador de sincronização (item 2)
Criar `supabase/functions/_shared/prescription/orchestration.ts`:
- `buildBnitoOrchestration(input)`: define a ORDEM de fases entre modalidades — base(força)/ordinário nas semanas 1-2, desenvolvimento 3-4, qualidade 5, deload 6 **sincronizado** entre força e cardio (reusar `src/lib/periodization.ts` que já dá microciclo/mesociclo por semana).
- `calculateCrossModalVolume(strengthWeek, cardioWeek)`: **volume-load cruzado** — conforme o volume da modalidade (corrida/pedal/natação) sobe, reduzir séries/aproximar RIR na musculação (e vice-versa), pra não somar dois picos. Usar `volumeRules.ts` + o `volumePct` da periodização.
- `syncMicrocycles(cardioWeeks[], strengthWeeks[])`: garantir que o tipo de microciclo e a semana de deload batem (máx 1 semana de defasagem na troca de estímulo).
- Integrar nas edges `ai-running-plan` e `ai-prescribe-workout` (substituir as regras locais soltas de anti-interferência por uma chamada ao orquestrador) + `src/lib/prescriptionIntegration.ts`.

### B) Multi-prescrição com liberação MANUAL (item 3)
- Ao gerar um plano de N semanas, criar `ceil(N/6)` ciclos de 6 (`prescription_bundles` × k). O **ciclo 1 nasce `active`**; os demais nascem em estado **`draft`/`scheduled`** (NÃO `active`, NÃO visível ao aluno).
- **NÃO precisa de cron de liberação** (decisão: manual). O professor libera pela UI (botão "Liberar" → muda status p/ `active`). Antes de liberar, a UI mostra o **NPS** do aluno (tabela `cycle_feedback`, abaixo) pro professor aplicar ajustes.
- Reaplicar ajustes: quando o professor edita/aprova, regenerar só o ciclo seguinte com os campos de `cycle_feedback` no contexto.
- Consumir, no contexto/prompt, os **novos campos** de `student_anamneses` (flags de gate + campos de conteúdo) e de `company_ai_config` (periodização — claude adiciona no form da Central).

### Contrato claude↔engine_chat
- **claude garante os DADOS:** `student_anamneses` (flags `wants_*`/`has_*`/`shown_blocks` já criados; campos de conteúdo a adicionar com o form), `company_ai_config` (campos de periodização), `cycle_feedback` (NPS + ajustes).
- **engine_chat garante o COMPORTAMENTO:** orquestração/sync, geração multi-ciclo com ciclos futuros em `draft`.
- Acordar o **shape de `cycle_feedback.answers`** e de `BnitoOrchestrationPlan.blocks[]`.

---

## CLAUDE — roteiro (minha área) — ✅ TUDO FEITO E DEPLOYADO (2026-06-18)
1. ✅ Migração `student_anamneses`: flags de gate (`wants_*`, `has_nutritionist`, `has_endurance_coach`, `shown_blocks`) — `anamnese_gate_flags_viva`.
2. ✅ `StudioAnamnese.tsx` = fonte única + **gates condicionais** (item 4): "tem nutri? quer dicas?" pula os passos de nutrição (fluxo de passos dinâmico); persiste flags + `shown_blocks`. Edge `public-anamnesis` whitelist atualizada + redeployada. (commit `c88d768`)
3. ✅ Aba Admin "Anamnese" (`AnamnesisManager.tsx`): painel da anamnese ÚNICA — seleciona aluno → gera link → **envia no WhatsApp (wa.me)** / copia. (commit `c88d768`)
4. ✅ Form da **Central de IA** (`CompanyOnboarding.tsx` + `companyAiConfig.ts` + migration `company_ai_config_periodization_fields`): seção **Periodização & integração** (`periodization_doctrine`, `strength_endurance_integration`). (commit `a2348bc`)
5. ✅ **NPS intra-ciclo**: `cycle_feedback` (tabela+RLS, `cycle_feedback_nps_intra_ciclo`); `CycleFeedbackBanner` virou mini-form NPS; `StudentCycleFeedbackCard` no perfil do aluno mostra o NPS+ajuste pro professor revisar (liberação manual). (commit `9ec8844`)

### ⚠️ Falta o engine_chat consumir (pra fechar item 2 e 3):
- **Edges** `ai-running-plan`/`ai-prescribe-workout`/`ai-nutrition-plan`: no `loadCompanyAiConfig` + `companyAiSystem`, **adicionar** `periodization_doctrine` e `strength_endurance_integration` ao select e ao prompt (hoje só leem os campos antigos). Sem isso, os campos novos da Central não chegam à prescrição.
- **Consumir** `student_anamneses` (flags `wants_*`/`has_*` → quais prescrições gerar; `shown_blocks` → o que foi coletado) e `cycle_feedback` (NPS/ajuste) no contexto.

## Riscos / decisões pendentes
- Padrão de plano (6/12/18 sem) define quantos ciclos a multi-prescrição cria — confirmar com Matheus.
- Trocar regras locais pelo orquestrador: manter `shadow.ts`/`validator.ts` ligados p/ não regredir a anti-interferência já validada.
- Multi-tenant: tudo por `company_id`; gates e colunas respeitam RLS por empresa.
