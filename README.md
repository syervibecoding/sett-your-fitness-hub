# SETT Your Fitness Hub

Fitness hub built with Vite, React, TypeScript, shadcn/ui, Tailwind CSS, and Supabase.

## AI Pack

The local refinement branch includes a consolidated AI pack at:

- App routes: `/admin/ia`, `/coordinator/ia`, `/trainer/ia`
- Frontend: `src/pages/admin/AICoachHub.tsx`
- Supabase function: `supabase/functions/ai-coach-pack`

Available modes: strength training, running prescription, nutrition, adaptive training, technique analysis, body composition, injury triage, and AI secretary.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs on `http://localhost:8080` by default.

## Environment

Frontend variables live in `.env.local`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Supabase Edge Functions read server-side secrets from Supabase, not from the Vite bundle. Expected function secrets include:

```bash
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
```

Optional:

```bash
ANTHROPIC_MODEL
```

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Agent Handoff

Claude Code should read `CLAUDE.md` first. Codex and Claude should keep secrets out of source, use `.env.local` for local credentials, and run at least `npm run build` before handing off frontend changes.
