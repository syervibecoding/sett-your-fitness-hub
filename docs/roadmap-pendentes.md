# Roadmap — itens adiados (com plano pronto)

Itens do roadmap de melhorias que foram **conscientemente adiados** porque exigem cirurgia
mais profunda, tabela nova com RLS própria, ou deploy de edge — incompatível com a fase atual
("rodar local, sem deploy"). Cada um tem o plano/SQL pronto pra executar quando aprovado.

> Migrations de **tabela nova** precisam de RLS escopada por `company_id` (senão a tabela fica
> aberta via anon key). Por isso não foram aplicadas ainda.

## P2 — Ciclos incompletos (breakdown ✓Força ✗Cardio ?Nutrição)
- **Por que adiado:** o link ciclo↔modalidade é fuzzy. `training_cycles` = força; cardio/natação/nutrição
  vivem em `prescription_bundles.has_*` e em outras tabelas, sem FK direta pro ciclo.
- **Plano:** ao publicar, gravar `modalities jsonb` no `training_cycles` (ou cruzar por janela de data com
  `prescription_bundles`). Depois, badge "Incompleto" + checklist no StudentDetail (linhas ~1065/1228).

## P5 — Preview de progressões/regressões na edição
- **Por que adiado:** não existe dataset de progressões/regressões por exercício na biblioteca.
- **Plano:** adicionar `progressions text[]` / `regressions text[]` em `exercise_library`, popular
  (curadoria ou seed), e mostrar card "Progressões/Regressões" no WorkoutBuilder ao selecionar exercício.

## P9 — Versionamento de planos (ai_plan_versions)
```sql
create table public.ai_plan_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  student_id uuid not null,
  cycle_id uuid references public.training_cycles(id) on delete set null,
  plan jsonb not null,
  edited boolean not null default false,
  edit_summary text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.ai_plan_versions enable row level security;
create policy "company can read versions" on public.ai_plan_versions for select
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "company can insert versions" on public.ai_plan_versions for insert
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));
```
- **Captura:** em `publishStrengthPlanToStudent`, inserir snapshot do plano publicado + `edited` (editPlan ≠ AI original) + `edit_summary` (nº de exercícios trocados/removidos — já dá pra computar no PrescriptionStudio).
- **UI:** lista/timeline de versões no StudentDetail (aba Programa).

## P15 — Log do "porquê" das edições do professor (retroalimenta presets)
- Reaproveita o `edit_summary` do P9 (ou tabela `prescription_edit_reasons`). Relatório agregado:
  "iniciantes recebem -15% de volume na edição" → ajustar presets do motor.

## P14 — Trilha de decisão do motor (ai_decision_logs)
- **Por que adiado:** o "porquê" do deload/regressão vive no motor (edge), não no client → exige deploy.
- **Plano:** o `explanations.ts`/`engine.ts` já produz justificativas; persistir num `ai_decision_logs`
  no fim da geração e exibir resumo antes de publicar.

## P10 — Anamnese versionada (comparar evolução)
- **Por que adiado:** o submit da anamnese (edge `public-anamnesis` + `StudioAnamnese`) hoje lê "latest";
  versionar exige `version` incremental no submit (deploy de edge) + view lado-a-lado.
- **Plano:** `student_anamneses.version` (default 1, ++ a cada submit) + aba "Histórico de Anamnese".

## P17 — Soft-delete + auditoria de trainer
```sql
alter table public.trainer_assignments_history add column if not exists deleted_at timestamptz;
-- + validação de data futura no TeamManager + botão restaurar (set deleted_at = null).
```

## G3 — Sincronização Musculação ↔ Cardio ↔ Nutrição
- **Por que adiado:** mexe na geração multimodal (mapa de conflito de dias + propagar kcal reais da
  edição do treino pra nutrição). Alto esforço/risco; toca PrescriptionStudio + prescriptionIntegration + motor.
- **Plano:** (a) detectar conflito de dias (ex.: cardio pesado véspera de MMII) e alertar; (b) substituir
  o `700 kcal/h` fixo da nutrição pelo gasto estimado dos treinos realmente prescritos.

## P16 — Sincronização contínua Asaas
- **Por que adiado:** baixo valor vs. esforço; o ideal é webhook (backend) e não polling.
- **Plano:** auto-refresh + "última sync há X min" no FinancialDashboard, ou webhook Asaas → tabela local.

## P18 (parcial) — logo + cores no PDF
- **Feito:** `professional`, `cref` e agora `company` são configuráveis no rodapé (`PDFMeta`).
- **Falta (adiado):** logo (imagem inline) + paleta por empresa, e **passar** company/professional/cref reais
  da sessão nos call-sites (hoje caem no default "Matheus Loreto / BN"). Wiring simples nos `generate*PDF`.

## Lote 6 — Backend de inteligência (cron/analytics) — exige DEPLOY + tabela com RLS
> Todos abaixo só funcionam deployados (edge/cron) e com tabela nova RLS-escopada → fora da fase
> "rodar local". Especificados aqui prontos pra implementar quando o deploy for liberado.

### Q2/T1 — Reativação automática de inativos (delta)
- **Já existe:** `AtRiskStudents` (client) já detecta dias sem treino via `studentStatus.ts`, e o dashboard
  tem contador de inativos. **Falta (deploy):** cron diário (`detect-inactive-students`) que, para alunos com
  ciclo ativo e 7+ dias sem `workout_logs`, gera mensagem de reativação pronta (WhatsApp) — opcionalmente
  numa tabela `admin_alerts`.

### G1/T5 — Feedback do aluno retroalimenta o motor
- **Já existe:** `cycle_feedback` (nps/wants_adjustment/applied) + `student-workout-feedback` (feedback por
  treino → WhatsApp do treinador) + card de pendências (novo).
- **Falta (deploy):** `feedback-aggregator` — ao fim do ciclo, consolida nps + dor + aderência e RECOMENDA o
  preset do próximo ciclo (ex.: "nps baixo + dor → -1 nível de volume"). Grava num campo do ciclo / `ai_decision_logs`.

### G2/T6 — Coorte / churn (RPC SQL)
```sql
create or replace function public.cohort_adherence(_company_id uuid)
returns table(bucket text, alunos int, completou_ciclo numeric, churn numeric)
language sql stable security definer as $$
  -- agrupa por dor inicial / nps / nível; cruza cycle_feedback + training_cycles + workout_logs.
  -- (corpo a definir conforme as métricas finais desejadas)
  select 'todos'::text, count(*)::int, 0::numeric, 0::numeric from public.students where company_id = _company_id;
$$;
-- expor no AICoachHub: "alunos com dor inicial = 60% churn → prescreva conservador".
```

### A10/A11 — Lembrete de fim de ciclo + check-in semanal
- **Falta (deploy):** cron que, ao atingir `training_cycles.end_date`, dispara push/WhatsApp "como foi o ciclo?"
  (alimenta G1); e um check-in semanal (segunda-feira) com link de feedback. Push real depende de inscrição
  Web Push (o SW já existe; falta o fluxo de subscription + VAPID).

---
**Já entregue (não estava claro no roadmap original):**
- **PWA** já completo: `manifest.webmanifest` linkado, Service Worker real (`public/sw.js`,
  network-first p/ HTML + cache-first p/ assets) registrado em `main.tsx`, ícones 192/512. Sem dívida.
- **P11** (linha do tempo + auditoria por aluno) já existia: `useStudentTimeline` + `StudentTimeline`
  na aba "Visão 360". Enriquecido com o status de entrega (P6).
- **P8** (rotação de estímulo por semana) entregue via `blockNote` objetivo+semana (motor) +
  `PeriodizationBanner` (app do aluno) + novo `PeriodizationRoadmap` (professor).
