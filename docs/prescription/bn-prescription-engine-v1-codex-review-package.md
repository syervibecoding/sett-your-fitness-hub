# BN Prescription Engine v1 — Pacote de Revisão para o Codex

> Para o Codex quando voltar (dono de `supabase/functions/**` + cérebro de IA/metodologia).
> Enquanto o Codex esteve offline, o Claude executou Fase A (hotfix) e B1–B7 em **lanes temporárias
> autorizadas pelo orquestrador**, sem cutover/deploy. Isto resume o que revisar e como validar.

## TL;DR
- Engine determinístico **pronto e aceito provisoriamente** (Fase A `ACCEPT_PROVISIONAL`).
- Fonte única Deno-safe em `supabase/functions/_shared/prescription/` + adapters + **shadow mode atrás de flag (default OFF)** na edge `ai-prescribe-workout`.
- **Nada ligado:** flag `PRESCRIPTION_ENGINE_V1` default off, resposta ao aluno intocada, `buildEmergencyFallbackPlan` e Anthropic intactos.
- **Bloqueador único para avançar:** `deno check` (Deno indisponível na máquina do Claude) + esta revisão.

## 1. Lane / por que revisar
O Claude tocou em áreas que normalmente são suas:
- **Hotfix no engine** (`progressionRules.ts`) — `ee4bfbe`.
- **Edit na edge** `ai-prescribe-workout/index.ts` (shadow) — `b917bb2`.
- **Realocação do engine** para `_shared` — `4b9a8bc`.
Por isso a Fase A é `ACCEPT_PROVISIONAL`: precisa do seu aval.

## 2. Timeline de commits
**Núcleo do engine (Codex):** `20e0448` core · `3eb24b4` align methodology · `9000d95` qa coverage.
**Claude (Fase A → B):**
| Commit | O quê |
|---|---|
| `dcb2d52` | QA spec metodológico |
| `2fd7dcf` | Auditoria do engine → `ACCEPT_WITH_FIXES` |
| `ee4bfbe` | **Hotfix F1–F4** (dor estruturada trava progressão; endurance ≥3x só MMII; textos teto v1; prova hard cap) |
| `469ce66`/`c60affd`/`d4c7486` | Plano + tickets + decisões da Fase B |
| `4b9a8bc` | **B1**: engine Deno-safe em `_shared/prescription` + shims em `src/lib` (fonte única) |
| `2cd4652`/`a817b4f` | **B2/B3/B4**: adapters input/catalog/output + testes (14) |
| `b917bb2` | **B5/B6**: shadow mode + feature flag na edge (default OFF) |
| `478967c` | **B7**: hardening do shadow (20 checks) + relatório |
| `f1c15bd` | Contrato PDF/publicação/portal contra plano real do engine |
| `75b46dc` | Checklist de pré-deploy local |

## 3. O que revisar (prioridade)
1. **`ee4bfbe` (hotfix engine)** — `progressionRules.ts::hasPainContext` agora considera `painReports`/`painEva`
   (reusa `classifyPainSeverity` de `restrictionRules.ts`; sem ciclo de import). Confirmar que a regra metodológica
   está correta (dor>3 trava progressão / bloqueia avançado mesmo com dor só em campo estruturado).
2. **`b917bb2` (edge shadow)** — bloco atrás de `if (engineFlag === "shadow" || engineFlag === "on")`, dynamic
   import do engine (só fora de off), try/catch que nunca quebra, log em `ai_decision_logs`. Confirmar que `off`
   é semanticamente idêntico ao anterior e que `on` **não** faz cutover.
3. **`4b9a8bc` (Deno-safe)** — viável porque `tsconfig.app.json` tem `allowImportingTsExtensions: true`; front
   importa `_shared` via shims; guard `shared-source.test.ts` prova fonte única (mesma referência).
4. **`2cd4652` (adapters)** — input/catalog/output puros; testes de pureza/independência da edge.

## 4. Checklist de AÇÃO para o Codex
- [ ] `deno check supabase/functions/_shared/prescription/engine.ts`
- [ ] `deno check supabase/functions/_shared/prescription/shadow.ts`
- [ ] `deno check supabase/functions/_shared/prescription/adapters/inputAdapter.ts catalogAdapter.ts outputAdapter.ts`
- [ ] `deno check supabase/functions/ai-prescribe-workout/index.ts`
- [ ] (opcional) `supabase functions serve ai-prescribe-workout` + smoke test com `PRESCRIPTION_ENGINE_V1=shadow`
- [ ] Revisar metodologicamente o hotfix `ee4bfbe` (decisões F1–F4).
- [ ] Revisar segurança do shadow (`b917bb2`): off intocado, erro isolado, sem dado sensível no log.
- [ ] Decidir os gates de cutover (B8) e se/quando ligar `shadow` em produção.

## 5. Gaps e decisões conhecidas (todas registradas)
- **Payload da edge não traz dor estruturada** (`painReports`/`painEva`): hoje a dor chega via
  `assessment_context`/`restrictions` (o engine lê). O input adapter já aceita os campos estruturados quando
  existirem → decidir estender o payload (fluxo aluno→BNITO).
- **`loadExerciseCatalog` não seleciona `equipment`/`difficulty`** → o catalog adapter marca `missing_field:equipment`.
  Estender o `select` quando wirar de verdade (não feito; fora de escopo das ordens).
- **`movement_pattern` não existe no schema** → fallback por keywords/grupo.
- **Shadow log:** `source='prescricao'` + `payload.kind='shadow_comparison'` (o `source` tem CHECK
  `IN ('prescricao','avaliacao','bnito')` → `prescricao_shadow` exigiria migration; **não criada**).
- **Fonte única `_shared`:** o front importa a edge-folder via shims (`allowImportingTsExtensions`). Acoplamento
  cross-folder incomum, mas elimina drift.

## 6. Inventário de testes (Vitest)
- `engine.test.ts` (41): GC-01..12 + R1..R10 + hotfix F1–F4.
- `adapters.test.ts` (14): B2/B3/B4 + pureza/independência.
- `shadow.test.ts` (6) + `shadow-acceptance.test.ts` (20): flag/comparação/segurança/contract estático da edge.
- `contract-pdf-portal.test.ts` (5): plano do engine → buildWorkoutRows + generateStrengthPDF.
- `shared-source.test.ts` (2): guard de fonte única (sem drift).
- Rodar: `npm run test` (128 verdes hoje) · `npm run build` · `npx tsc --noEmit`.
> ⚠️ Os testes da **edge Deno** são **estáticos** (leitura do arquivo) porque o Vitest não roda Deno.
> A validação real da edge depende do seu `deno check`.

## 7. Estado de autorização (NÃO mudar sem ordem)
- Flag `PRESCRIPTION_ENGINE_V1`: **default off** em todo ambiente.
- **Cutover = NOT_AUTHORIZED** · **Deploy = NOT_AUTHORIZED** · **Flag ON = NOT_AUTHORIZED**.
- `buildEmergencyFallbackPlan` e Anthropic: **não remover**.

## 8. Documentos da fase (em `docs/prescription/`)
`bn-prescription-engine-v1-qa.md` · `-audit.md` · `-hotfix-acceptance.md` · `-b1-acceptance.md` ·
`-phase-b-plan.md` · `-phase-b-tickets.md` · `-phase-b-decisions.md` · `-shadow-acceptance.md` ·
`-predeploy-checklist.md` · (este) `-codex-review-package.md`.
