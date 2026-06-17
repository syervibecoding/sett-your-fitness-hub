# Spec — Prescrições "fallback-first" (determinístico completo, IA só complementa)

**De:** Claude (frontend / área do aluno) — diagnóstico via workflow de 5 agentes
**Para:** chat do motor de prescrição (dono de `supabase/functions/*`, `_shared/prescription/*`, edges, migrations)
**Data:** 2026-06-17
**Objetivo do Matheus:** baratear a operação — toda prescrição deve rodar **perfeita em fallback determinístico**; a IA **só complementa** (quando houver crédito). Musculação já roda em fallback (emergency fallback); replicar para cardio e nutrição.

---

## 1. Princípios de arquitetura (duros)
1. **Determinístico é o gerador PRIMÁRIO.** O motor TS puro (`engine.ts` força, novo `cardioEngine.ts`, novo `nutrition/engine.ts`) produz um plano 100% completo e enviável **sem nenhuma chamada de IA**. A IA nunca cria estrutura.
2. **IA = enriquecimento opcional e isolado.** Depois do plano pronto, a IA (Haiku, `max_tokens ~1500`) só reescreve **texto livre** numa whitelist: `notes`, `cues`, `general_tips`, `nutrition_alert`, `biomechanical_notes`. O merge valida que **nenhum campo estrutural** mudou (`sets/reps/dias/zonas/kcal/macros/exercise_id/weeks`). IA off / sem crédito / falha = textos determinísticos seguem intactos.
3. **NUNCA persistir casca.** Invariante `assertPlanComplete(plan)` antes de QUALQUER insert:
   - cardio: `weeks.length>0` **e** cada week com `sessions.length>0`;
   - força: `workouts.length>0` **e** cada workout com `exercises.length>0`;
   - nutrição: `target_kcal>0` **e** macros `>0` **e** `meals.length>0`.
   - Falhar alto (5xx, sem inserir) é aceitável; **persistir casca não é**.
4. **Zero duplicação de regra.** A metodologia BN (Karvonen, regra dos 10%, MEV/MAV/MRV, Mifflin/Katch/Harris, pisos de kcal, linhas vermelhas TSB/EVA) hoje vive **só como texto** dentro dos SYSTEM_PROMPTs. Portar para código TS em `_shared/` e parar de pagar tokens caros pra IA reproduzir regra fixa.
5. **IA barata e gateável.** Trocar `claude-sonnet-4-5` (hardcoded) por modelo via env; refino em Haiku; flag por empresa + kill-switch global.

---

## 2. Por modalidade

### 2.1 Força / Musculação (`ai-prescribe-workout`) — CUTOVER (esforço médio)
- **Hoje:** `buildEmergencyFallbackPlan` (index.ts:784) já serve um plano completo quando a IA falha. O motor canônico `generateTrainingProgram` (`_shared/prescription/engine.ts`) é mais rico (split 2-6 dias, 7 presets, deload/EVA/restrições, validator com blockers, explanations) mas roda **só em shadow** atrás da flag `PRESCRIPTION_ENGINE_V1` (index.ts:1352; `resolveEngineFlag` em `_shared/prescription/shadow.ts`). Modo `'on'` implementado, **não autorizado**.
- **Fazer:** cutover do `engine.ts` para caminho PRIMÁRIO (promover o modo `'on'` já validado em shadow); manter `buildEmergencyFallbackPlan` como rede final; validator `pre_save` continua governando (blocked → 422). Remover duplicação inline de presets/validators (index.ts:116-741) importando do `_shared` canônico. Trocar modelo hardcoded `claude-sonnet-4-5-20250929` (index.ts:9) por env; `max_tokens 16000 → ~1500` no modo refino.
- **Mitigação de risco:** comparar `ai_decision_logs` (`payload.kind='shadow_comparison'`) antes de virar `'on'`.

### 2.2 Cardio / Corrida-Natação-Ciclismo (`ai-running-plan`) — 🔴 PRIORIDADE MÁXIMA (esforço alto)
- **Hoje (quebrado):** `fallbackCardioPlan` (index.ts:88-113) **nunca define `weeks[]`** — só `fc_zones` fixas (110-185, ignora idade/FCmax/FCrep, sem Karvonen) e um `sample_week` genérico. `normalizeCardioPlan` (115-121) não materializa `weeks`. Insert (514-534) grava `weeks:undefined → NULL`, retorna 200; `running_plans` **não tem coluna status** → a casca vira "plano ativo". Verificado: **11/12 linhas com `weeks` NULL**, warnings "anthropic_400 credit balance too low". Toda a regra está como texto no SYSTEM_PROMPT (147-329).
- **Fazer:**
  1. Criar `supabase/functions/_shared/prescription/cardio/cardioEngine.ts::buildCardioProgram(input)`:
     - `computeFcZones` por **Karvonen** (FCmax = informado || 220−idade; FCrep = informado || 65; FCreserva; `estimated:true` se faltou dado; z1–z5 por %FCreserva);
     - `pickModel` (polarizado/piramidal por nível/distância/TSB);
     - `buildWeeks` = exatamente `duration_weeks` (default 6), cada week `{week_number, type(base/desenvolvimento/qualidade/deload), volume_km|volume_hours, sessions[]}`; cada session `{day,type,title,sport,warmup/main/cooldown,total_min,distance_km,zone,fc_target,intervals,notes}`; **progressão regra 10%**, **deload na semana 4**, **taper na 6**;
     - **alinhar à periodização** já exposta ao aluno: microciclos ordinário/choque/regenerativo, mesociclos base→acumulação→intensificação→polimento (ver `docs/prescription/periodization-methodology-v1.md` + `src/lib/periodization.ts`);
     - `buildSafetyCheck`: TSB<−20 corta Z3–Z5; EVA≥5 só regeneração; EVA≥7 contraindica; sync com `strength_plan_context.has_heavy_legs` (sem Z4/Z5 no dia/véspera de MMII pesado).
     - Unidades por esporte: corrida em km; **natação/ciclismo** em min/voltas/distância adequada (decisão aberta abaixo).
  2. Reescrever `fallbackCardioPlan` para chamar `buildCardioProgram` como **caminho primário**; `normalizeCardioPlan` materializa `weeks[]` de `sample_week` quando faltar.
  3. `assertPlanComplete` antes do insert: **nunca** gravar `weeks` NULL/vazio → retornar 5xx sem inserir.
  4. **Contrato de saída tem que bater EXATAMENTE** com o que `src/components/student/CardioPlanView.tsx` lê (campos acima — já confirmados no componente).

### 2.3 Nutrição (`ai-nutrition-plan` + `ai-nutrition-meals`) — (esforço alto)
- **Hoje:** `fallbackNutritionPlan` (ai-nutrition-plan:106-175) usa kcal fixo (2200/2800) e macros `peso*2/*3.5/*0.9` — ignora idade/altura/sexo/%gordura/atividade. TMB/GET/fatores/carb cycling/hidratação/pisos vivem só no SYSTEM_PROMPT (200-408). **Sem `ANTHROPIC_API_KEY` o edge retorna 503 ANTES do fallback (414-418)** → não há caminho 100% determinístico hoje. `fallbackMeals` (ai-nutrition-meals:32-44) é raso. **Bug de schema:** `ai-nutrition-meals` lê `goal/target_calories/target_protein_g/meals` que **não existem** na migration `20260612150500` (tabela tem `objective/total_calories/protein_g`, sem `meals`) → provável causa de meals sempre cair no fallback.
- **Fazer:** criar `_shared/nutrition/` (`energy.ts` Mifflin+Katch+Harris, `macros.ts` por objetivo, `carbCycling.ts`, `hydration.ts` peso×35-40ml, `restrictions.ts` com alérgenos, `safety.ts` pisos 1200/1500, `engine.ts::buildNutritionPlan`). Rodar `buildNutritionPlan` **sempre** (remover o 503). Corrigir a divergência de schema (migration aditiva alinhando nomes / adicionando `meals` + `target_*`).

---

## 3. Contrato IA-enriquecimento (as 3 edges)
Após o determinístico montar o plano válido, **se** `ANTHROPIC_API_KEY && flag`:
- chamar `action='refine_text'` em **Haiku** (`max_tokens ~1500`) com instrução: *"plano JÁ VÁLIDO, NÃO altere estrutura, devolva só `notes/cues/general_tips/nutrition_alert` melhores"*;
- merge **só** da whitelist de texto, validando que a estrutura está intacta;
- falha/`!ok`/sem crédito = manter textos determinísticos e setar `plan.enrichment = {status:'skipped'|'failed', reason}`.

---

## 4. Gating + migrations aditivas
- `ALTER TABLE company_ai_config ADD COLUMN ai_text_refinement_enabled boolean DEFAULT false, ADD COLUMN use_prescription_engine_v1 boolean DEFAULT true;` (refino **desligado por padrão** — decisão do Matheus; opt-in por empresa).
- `loadCompanyAiConfig` lê as flags; env global `AI_REFINEMENT` (off|on) como kill-switch (precedência: **global off vence empresa on** — decisão aberta).
- Aplicar a MESMA flag ao `ai-running-plan` (hoje não tem nenhuma).
- (Opcional, defesa em profundidade) `running_plans ADD COLUMN status text DEFAULT 'active'`, gravando `'incomplete'` em vez de casca visível.

---

## 5. Contrato de saída para o render do aluno (Claude)
Expor consistentemente nas 3 edges: `generated_by` (ex.: `bn_cardio_fallback`/`bn_prescription_engine_v1`), `fallback_reason`, `enrichment:{status}`, `fc_zones[].estimated`. Com isso o app do aluno sinaliza "plano base gerado automaticamente — em revisão pelo treinador" (render-only, Claude faz quando o contrato existir).

---

## 6. Ordem de implementação
- **A) CARDIO** (sangrando em produção): invariante `assertPlanComplete` no insert (para o sangramento já) → `cardioEngine.ts` → reescrever fallback/normalize como primários.
- **B) FORÇA:** cutover do `engine.ts` (modo `'on'`), manter emergency como rede, remover duplicação.
- **C) NUTRIÇÃO:** `_shared/nutrition/engine.ts`, remover 503, corrigir bug de schema do meals.
- **D) IA-enriquecimento + gating** (aditivo).
- **E) TESTES** unitários para cardio e nutrição (espelhar `src/lib/prescription/*.test.ts`).

---

## 7. Decisões do Matheus (✅ FECHADAS 2026-06-17)
1. **Refino por IA:** **DESLIGADO por padrão** (`ai_text_refinement_enabled DEFAULT false`); opt-in por empresa + kill-switch global. Operação roda 100% determinística (custo de IA ~zero).
2. **Fórmula de TMB oficial BN:** **Mifflin-St Jeor** (Katch-McArdle quando houver %gordura; Harris-Benedict como secundária/comparação).
3. **Cascas já gravadas (11/12 `running_plans` vazios):** **só prevenir daqui pra frente + regerar manual.** NÃO apagar retroativamente (ação destrutiva — fica a critério do Matheus depois).
4. **Refino:** **assíncrono** — o plano determinístico volta na hora; o refino de texto (quando ligado) aplica depois via update (o front recarrega).
5. **Natação/ciclismo:** entram **já na v1** do `cardioEngine`, com unidade própria (min/voltas/distância) e articulações de risco por esporte.
6. **Quem implementa:** o **chat do motor de prescrição** (dono das edges/migrations) implementa e faz deploy; o **Claude** faz só o render do app do aluno quando o contrato de saída existir.

---

## 8. O que o Claude (área do aluno) já fez / fará
- ✅ `CardioPlanView.tsx`: plano sem `weeks`/sessões → estado "em finalização" (não mostra casca).
- ⏳ Quando o contrato (`generated_by`/`fallback_reason`/`enrichment`) existir: badge "plano base — em revisão"; leitura defensiva dos campos novos; destaque de FC estimada e `safety_check.restrictions`.
- **Não toco** em `supabase/functions/*`, migrations, nem faço deploy de edge — isso é do chat do motor.
