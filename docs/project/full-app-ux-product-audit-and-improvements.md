# Full App UX/Product Audit & Improvements

**Data:** 04/07/2026 · **Branch:** `codex/claude-compat` (commit base `f09f5bf`)
**Ambiente:** sandbox Linux (Claude via chat), clone limpo do repo `bn`. Sem acesso a Deno, Supabase remoto, browser ou push.

---

## 1. Resumo executivo

**Status: ACCEPT_WITH_NOTES**

O app está saudável: build OK, typecheck limpo, 160/160 testes passando (incluindo 120/120 do motor de prescrição), scripts de curadoria 27/27 PASS. Todos os invariantes do BN Prescription Engine estão preservados. Os lotes 1–7 anteriores já implementaram a maior parte do que as Fases 3–4 desta ordem pedem (hero "Treino de hoje", timer de descanso robusto, sparklines, cards de atenção do professor, status de entrega sent→viewed, roadmap de periodização, versionamento de planos). As melhorias desta rodada foram conservadoras (lint auto-fix seguro, fora de edge functions). Pendências principais: dívida de lint (842 erros, quase todos `no-explicit-any` pré-existentes), chunks >500 kB, Deno indisponível no ambiente.

## 2. O que foi auditado

- **Pré-flight (Fase 0):** clone limpo; `git status` sem mudanças de terceiros; log dos últimos 10 commits revisado (lotes 1–7 + coordenação).
- **Funcional (Fase 2):** build, tsc, vitest (geral + motor), lint, scripts de curadoria. Deno indisponível → `deno check` registrado como pendência.
- **Motor/fallback (Fases 6–7):** verificação por grep + testes de contrato (`edge-safety-invariants`, `catalog-loader-contract`, `shadow-acceptance`).
- **Mapa do produto (Fase 1):** rotas por role (master/admin/coordinator/trainer/student + fluxos públicos), AICoachHub, UnifiedPrescriber, PrescriptionStudio, WorkoutBuilder, StudentPortal/StudentHome, publishStrengthPlan, generatePDFs.
- **UX aluno/professor (Fases 3–4):** varredura estática de loading states, empty states, guards de null, listas `.map`, `console.log`.
- **Visual/perf (Fases 5, 10):** análise de bundle e padrões de código.

## 3. Melhorias implementadas

| Área | Arquivo | Melhoria | Impacto | Risco | Validação |
|---|---|---|---|---|---|
| Qualidade de código | `DashboardAlerts.tsx`, `StudentGoalsManager.tsx`, `StatsCharts.tsx`, `AdminDashboard.tsx`, `ExerciseLibrary.tsx`, `StudentPortal.tsx`, `StudentWorkout.tsx` | `prefer-const` auto-fix (7 arquivos, 1 linha cada) | Higiene; zero mudança de comportamento | Mínimo | tsc ✅ · 160/160 testes ✅ · build ✅ |
| Documentação | `docs/project/full-app-ux-product-audit-and-improvements.md` | Este relatório | Rastreabilidade | Zero | — |

O fix equivalente em `supabase/functions/whatsapp-manager/index.ts` foi **revertido deliberadamente** para manter Edge = PRESERVED sem ambiguidade.

## 4. Bugs corrigidos

Nenhum bug funcional novo encontrado nesta varredura. Os bugs listados no documento de status antigo (dropdown `cid ?? ""`, páginas RunningPrescription/BodyCompositionsAdmin) **não existem mais nesta branch** — as páginas foram substituídas por AICoachHub/UnifiedPrescriber e o padrão `cid ?? ""` não aparece no código.

## 5. Melhorias visuais

Nenhuma alteração visual nesta rodada. Sem browser no ambiente, mudanças estéticas às cegas violariam a regra 17 (risco de quebrar responsividade/acessibilidade sem teste visual). Observações para backlog na seção 11.

## 6. Melhorias funcionais

Nenhuma nova nesta rodada — as auditorias das Fases 3/4/9 constataram que os itens de maior impacto já foram entregues nos lotes anteriores: treino de hoje em destaque, feedback pós-sessão, guia de aquecimento, avisos de dor/EVA, cards "precisa atenção", duplicação de treino, checagem de biblioteca antes de publicar, validação pré-publicação, mensagens de renovação.

## 7. Prescrição/fallback — verificação de preservação

| Invariante | Status | Evidência |
|---|---|---|
| Flag `PRESCRIPTION_ENGINE_V1` default off | ✅ | `index.ts:1431` — `?? "off"` |
| `buildEmergencyFallbackPlan` presente | ✅ | grep em `ai-prescribe-workout/index.ts` |
| Anthropic presente | ✅ | `ANTHROPIC_API_KEY` na edge |
| Shadow não muta resposta | ✅ | `shadow-acceptance.test.ts` PASS |
| Sem `.limit(700)` / catálogo paginado | ✅ | `catalog-loader-contract.test.ts` + `edge-safety-invariants.test.ts` PASS |
| Contrato `{ id, plan }` / TrainingProgram | ✅ | testes de contrato PASS; nenhum arquivo do motor alterado |
| Regras metodológicas (RIR 2–4, EVA, caps, blocos) | ✅ | zero diff em `_shared/prescription/**` e `src/lib/prescription/**` |
| Curadoria intocada | ✅ | pipeline 15/15 + return-guard 12/12 PASS; nada aprovado/aplicado |

## 8. Professor/admin

Já entregue (lotes anteriores): status de entrega sent→viewed, card de feedback de ciclo pendente, roadmap de periodização, validação fiscal NFS-e, aviso método×fase, checagem de biblioteca pré-publicação, AtRiskStudents, versionamento de planos com histórico. Backlog sugerido na seção 11.

## 9. Aluno

Já entregue: hero "Treino de hoje", histórico rico (RPE/tipo), sparkline por exercício, timer de descanso por relógio de parede, resumo inline, BNITO ciente do exercício, guia de aquecimento, XP anti-duplicação, celebração ao concluir.

## 10. Testes/comandos

| Comando | Resultado | Obs |
|---|---|---|
| `npm run build` | ✅ 20–26s | warning: chunks >500 kB (VideoAssessment 404 kB, recharts 504 kB) |
| `npx tsc --noEmit` | ✅ 0 erros | |
| `npm run test` | ✅ 160/160 (16 files) | |
| `npm run test -- src/lib/prescription` | ✅ 120/120 (9 files) | golden cases + contratos |
| `npm run lint` | ⚠️ 842 erros / 51 warnings | ~95% `no-explicit-any` pré-existente; 7 auto-fixes aplicados |
| `node scripts/prescription/test-curation-review-pipeline.mjs` | ✅ 15/15 | |
| `node scripts/prescription/test-curation-review-return-guard.mjs` | ✅ 12/12 | |
| `deno check …` | ⏸️ N/A | Deno indisponível no sandbox — pendência |
| `npm run test:e2e` | ⏸️ N/A | Playwright requer browser/servidor — rodar localmente |

## 11. Pendências (backlog)

**Precisa ambiente local/browser:**
- `deno check` das 6 edge functions de prescrição
- e2e Playwright
- Auditoria visual real (Fase 5) — contraste, responsividade mobile, dark mode

**Melhorias seguras para próxima ordem (front-only):**
- Code-splitting de `VideoAssessment` e `recharts` via `manualChunks` (build warning)
- Redução gradual da dívida de `any` (842 ocorrências) — priorizar `src/lib` e páginas críticas
- Empty states nos filtros do StudentsManager além do "Nenhum aluno encontrado" genérico

**Precisa backend/migration/deploy (NÃO executado):** nenhum novo identificado além do já documentado no Lote 6 (cron/analytics).

## 11b. Verificação LOCAL (Mac, 04/07/2026, HEAD `8500904` — fecha as pendências do sandbox)

Rodada no ambiente local (Claude Code) por cima do HEAD atual (inclui os 6 commits do Codex
`e883587..5f92adf` — promote engine v1, functional assessment engine, hardening):

| Item (pendência do sandbox) | Resultado local |
|---|---|
| `deno check` das 6 edges de prescrição (index, engine, shadow, 3 adapters) | ✅ **6/6 sem erros** (Deno 2.9.1 via npx, efêmero) |
| `npm run test` no HEAD atual | ✅ **170/170** (Codex adicionou 10) |
| `npm run test -- src/lib/prescription` | ✅ **120/120** |
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` | ✅ |
| Curadoria (pipeline + return-guard) | ✅ 15/15 + 12/12 |
| `npm run lint` | ⚠️ 901 erros (era 842; delta vem do trabalho em andamento não-commitado) |
| Flags no HEAD atual | ✅ `PRESCRIPTION_AI_FIRST ?? "off"` e `PRESCRIPTION_ENGINE_V1 ?? "off"` — defaults preservados após o "promote engine v1" do Codex |
| e2e Playwright | ⏸️ ainda pendente (requer browsers instalados + servidor) |

**🚨 ACHADO NOVO (fora do motor):** `ai-validate-prescription/index.ts:94` e
`ai-coach-pack/index.ts:232` ainda usam `.limit(700)` no catálogo. Com **917 exercícios** hoje,
essas duas edges enxergavam só 700 — **217 exercícios invisíveis** para a validação de prescrição e
para o coach pack. O motor (`ai-prescribe-workout`/catalogAdapter) está limpo (paginado; contratos
PASS). **RESOLVIDO (04/07/2026, autorização "total liberdade" do Matheus):** commit `05a1a9c` —
paginação `range()` espelhando o catalogAdapter (CATALOG_PAGE_SIZE=1000) nas duas edges; `deno check`
OK; **deployadas** em produção (smoke 401 OK). Motor intocado.

## 12. Riscos

- Ambiente de auditoria ≠ Mac local: versões de Node/npm podem diferir; recomenda-se rodar `npm run build && npm run test` localmente após aplicar o patch.
- Dívida de lint mascara erros novos — considerar CI com baseline.
- E2e e visual não cobertos nesta rodada.

## 13. Decisão final

- App UX/Product Improvements = **ACCEPT_WITH_NOTES**
- BN Prescription Engine = **PRESERVED**
- Edge Behavior = **PRESERVED** (fix em whatsapp-manager revertido por precaução)
- Deploy = **NOT_AUTHORIZED**
- Flag ON = **NOT_AUTHORIZED**
- Cutover = **NOT_AUTHORIZED**
- Banco = **UNCHANGED**
