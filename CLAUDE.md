# Claude Code Context

## Project

SETT Your Fitness Hub is a Vite + React + TypeScript fitness SaaS backed by Supabase. The app has role-based areas for master, admin, coordinator, trainer, and student users, plus public registration/payment/anamnesis flows.

## Stack

- Frontend: React 18, TypeScript, Vite, React Router, TanStack Query.
- UI: Tailwind CSS, shadcn/ui-style Radix components, lucide-react icons, Recharts, XY Flow.
- Backend: Supabase Auth, Postgres migrations, generated Supabase types, Edge Functions in `supabase/functions`.
- AI/Integrations: Anthropic-backed Supabase functions, Stripe, Asaas, WhatsApp manager/webhooks.

## Important Paths

- `src/App.tsx`: route tree and role/feature gating.
- `src/components/AppSidebar.tsx`: navigation definitions.
- `src/components/ui`: reusable UI primitives.
- `src/integrations/supabase/client.ts`: browser Supabase client.
- `src/pages/admin/AICoachHub.tsx`: consolidated AI pack UI for strength, running, nutrition, adaptive training, technique, body composition, injury triage, and secretary flows.
- `src/integrations/supabase/types.ts`: generated database types.
- `src/pages`: route-level screens by role.
- `supabase/functions`: Deno Edge Functions.
- `supabase/migrations`: database schema history.
- `.env.example`: safe local environment template.
- `.env.local`: local credentials only; ignored by Git.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

The Vite dev server defaults to `http://localhost:8080`.

## Environment Rules

- Use `.env.local` for local values.
- Never commit real service keys, provider tokens, or webhook secrets.
- Frontend code may use only `VITE_*` variables.
- Edge Function secrets belong in Supabase project secrets:
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`,
  `ASAAS_API_KEY`, and `ASAAS_WEBHOOK_TOKEN`.
- The Supabase anon key is public by design, but keep it out of hardcoded source so environments can rotate cleanly.

## Working Agreement For Agents

- Prefer existing component, hook, and routing patterns before adding abstractions.
- Keep UI changes consistent with the current shadcn/Tailwind system.
- Treat `src/integrations/supabase/types.ts` as generated; update it from Supabase instead of hand-editing when schema changes.
- For Supabase Edge Functions, keep Deno APIs and CORS behavior consistent with neighboring functions.
- Before handoff, run the narrowest useful checks. For broad app changes, run `npm run build` and `npm run test`.
- If credentials are needed, ask for environment setup rather than placing secrets in tracked files.

## Current Local Handoff Notes

- Local workspace: `/Users/macbookpro/Documents/Marquito/sett-your-fitness-hub`.
- Branch prepared for agent work: `codex/claude-compat`.
- This clone is based on `syervibecoding/sett-your-fitness-hub` `main`.
- Old local GitHub token remotes found in abandoned copies were replaced with clean GitHub URLs.
- AI refinement pack was found in `/Users/macbookpro/Downloads/app bn/sett-your-fitness-hub` and integrated as `supabase/functions/ai-coach-pack` plus the `/admin/ia`, `/coordinator/ia`, and `/trainer/ia` routes.
- Current verified checks: `npm run build` passes, `npm run test` passes, and `npm audit --omit=dev` reports 0 vulnerabilities.
- `npm run lint` currently fails on inherited project debt, mostly `@typescript-eslint/no-explicit-any`, hook dependency warnings, Fast Refresh warnings, and a few `prefer-const`/empty-interface issues. Do not treat the existing lint baseline as a regression unless your change adds new violations.
- Full `npm audit` still reports a Vite/esbuild development-server advisory that requires `npm audit fix --force` and a breaking Vite major upgrade. Do not force that upgrade casually.
- `npx update-browserslist-db@latest` currently tries to use `bun` because the repo includes Bun lockfiles, but Bun is not installed on this machine. The warning is non-blocking for build/test.

## Multi-Agent Live Coordination (Claude Code ⇄ Codex)

Both agents work on this same repo. To avoid clobbering each other's edits, treat this section as the shared blackboard — read it before starting, update it when you claim or release work.

**Rules of the road:**
1. One file, one owner at a time. Before editing a file, check the "In flight" list below. If another agent owns it, don't touch it — pick something else or coordinate via the user.
2. Announce your claim by adding a line under "In flight" with: `agent — files/area — what — started <time>`.
3. Release by removing your line (and ideally committing) when done.
4. Prefer committing in small, labeled chunks so the other agent can pull a clean base. Use commit prefixes `claude:` / `codex:` so authorship is obvious in `git log`.
5. Generated files (`src/integrations/supabase/types.ts`, lockfiles) are regenerated, not hand-merged — coordinate before regenerating.

**In flight (update me):**
- codex — avaliador → BNITO → musculação flow (`FunctionalAssessment.tsx`, `ai-functional-assessment`, `ai-prescribe-workout`, `UnifiedPrescriber`/`WorkoutBuilder`, BNITO assistant) — large uncommitted diff as of 2026-06-12 ~15:56. Claude: do not edit these until committed/released.
- claude — OWNS: WhatsApp module (`src/pages/admin/WhatsApp*.tsx`) + Student area (`src/pages/student/*`, `src/components/student/*`). Frontend high-severity fixes DONE (build passing): WhatsApp realtime no-resubscribe+dedupe, loadContacts stale closure, CRM→chat nav with chatId, break-words; Student loadStudentData try/catch (no more infinite spinner), saveCurrentLogs error handling + bodyweight sets, progress NaN guards, StatsCharts null session_date guards. Files touched by claude (uncommitted): WhatsAppChat.tsx, WhatsAppCRM.tsx, StudentPortal.tsx, StatsCharts.tsx. Codex: please don't edit these. Updated 2026-06-12 ~16:10.
- PENDING (need approval/coordination): C1 WhatsApp IDOR in `supabase/functions/whatsapp-manager` (needs deploy), C2 payment price forgery in PublicPayment+`asaas-integration` (needs deploy), C3 `/aluno/treino/:studentId` missing ProtectedRoute in `src/App.tsx` (CODEX-OWNED file — Codex please add ProtectedRoute + ownership check).
- ✅ claude — FALLBACK-FIRST IMPLEMENTADO + DEPLOYADO (2026-06-18, por ordem direta do Matheus "faça tudo"): CARDIO (`_shared/prescription/cardio/cardioEngine.ts` + `ai-running-plan` determinístico-first), NUTRIÇÃO (`_shared/nutrition/nutritionEngine.ts` + `ai-nutrition-plan` sem 503 + migration aditiva que corrige o bug do meals), FORÇA (`ai-prescribe-workout` determinístico-first por padrão via emergency fallback; reversível com PRESCRIPTION_AI_FIRST=on; modelo via env). Migrations aditivas: `nutrition_plans` (meals/target_*/goal/context) + `company_ai_config` (ai_text_refinement_enabled default false). Todas as edges deployadas + smoke 401 OK; 136 testes front passam; build OK. **NÃO flipei o cutover do engine.ts de força** (gate documentado do time — segue p/ engine_chat autorizar). Refino IA (refine_text) NÃO ligado (refino off por decisão do Matheus). Detalhes/status no spec.
- 📨 claude → engine_chat — SPEC "FALLBACK-FIRST" (2026-06-17): `docs/prescription/fallback-first-prescriptions-spec.md`. Tornar TODAS as prescrições completas em fallback determinístico (IA só refina texto, Haiku, gateável) p/ baratear. Ordem: A) CARDIO (criar `_shared/prescription/cardio/cardioEngine.ts` + `assertPlanComplete` no insert do `ai-running-plan` — para o sangramento da casca vazia), B) FORÇA (cutover do `engine.ts` modo 'on' da flag PRESCRIPTION_ENGINE_V1), C) NUTRIÇÃO (`_shared/nutrition/engine.ts` + remover 503 + bug schema meals), D) IA-enriquecimento+gating (migration aditiva `company_ai_config`). ✅ Decisões do Matheus FECHADAS: refino IA **off por padrão** (opt-in), TMB **Mifflin-St Jeor** (Katch se %gordura), **não apagar** as 11 cascas (só prevenir+regerar), refino **assíncrono**, natação/ciclismo **na v1**, implementação pelo **engine_chat**. **Claude não edita edges/migrations** — só render do aluno. engine_chat: pode começar pelo item A (cardio).
- 🚨 claude — CARDIO VAZIO (diag 2026-06-17): corrida/natação/pedal salvam plano em `running_plans` com `weeks=NULL` (11/12 linhas; mais recente hoje 15:31) → aba acende mas SEM treino. Gatilho: **saldo Anthropic zerado** (warnings `anthropic_400 credit balance too low`) → `ai-running-plan/index.ts` cai no fallback que NÃO preenche `weeks` e grava `status='active'` retornando 200. 📨 HANDOFF engine_chat: `docs/prescription/cardio-empty-plan-handoff-to-engine-chat.md` (corrigir `fallbackCardioPlan()`/`normalizeCardioPlan()` p/ nunca persistir sem `weeks`, ou falhar 402/429; + `running_plan_id` no bundle do PrescriptionStudio). Claude já mitigou no app do aluno (`CardioPlanView.tsx`: estado "plano em finalização" em vez de casca vazia). **NÃO toquei na edge.** Matheus: recarregar crédito Anthropic + regerar.
- claude — PERIODIZAÇÃO (frontend, área do aluno) DONE + deployed 2026-06-17: novo `src/lib/periodization.ts` + `src/components/student/PeriodizationBanner.tsx` (microciclos ordinário/choque/regenerativo + mesociclos base/acumulação/intensificação/polimento), derivado de objetivo+datas do ciclo; banner na aba Treino do `StudentPortal.tsx`; `WorkoutLibrary.generate()` grava resumo das fases. **NÃO toquei no motor.** 📨 HANDOFF para o chat do motor de prescrição: `docs/prescription/periodization-handoff-to-engine-chat.md` (+ metodologia em `docs/prescription/periodization-methodology-v1.md`) — pedido: nomear microciclo/mesociclo em `methodology.ts`/`progressionRules.ts` mantendo os ids `ordinario|choque|regenerativo` / `base|acumulacao|intensificacao|polimento`. Codex/engine-chat: por favor leiam o handoff.
