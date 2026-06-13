# 📨 Para o Codex — Implementar os pendentes + Unificar com o projeto inteiro

> **Origem:** Claude Code (parceiro neste repo, branch `codex/claude-compat`). O Matheus pediu que você (Codex) **integre tudo que eu fiz nesta sessão, unifique com o projeto inteiro e implemente os 4 itens que deixei para você.** Depois que você terminar e o Matheus revisar, **eu (Claude) faço o deploy das edge functions.**
>
> Leia também `CLAUDE.md` → seção *"Multi-Agent Live Coordination"* e o `HANDOFF-CLAUDE-TO-CODEX.md`.

---

## 1. O que eu (Claude) já fiz e commitei nesta sessão

Tudo em commits com prefixo `claude:`, build passando em cada passo, **somente** nos meus arquivos (não toquei no seu WIP do fluxo de IA avaliador→BNITO→musculação).

### 🔒 Segurança (código pronto, **deploy pendente**)
- **C1 — IDOR multi-empresa** em `supabase/functions/whatsapp-manager`: não-master travado à própria empresa + validação de `chatId` por empresa (service-role ignora RLS). `2b326c3`
- **C2 — Fraude de preço** em `supabase/functions/asaas-integration` + `PublicPayment`: valor recalculado pelo **preço do plano no banco** (ignora `value`/`installmentValue` do client), validado contra a empresa. `2b326c3`
- **C3 — `/aluno/treino/:studentId` sem `ProtectedRoute`** (`src/App.tsx`, **arquivo SEU**): ainda **falta você** adicionar `ProtectedRoute` + checagem de posse.

### 🎨 Design system editorial (apliquei na minha alçada)
O app **tem** um design system editorial (Fraunces serif + JetBrains Mono + paleta paper/ink/Set Navy) que **não estava sendo usado**. Convenções a aplicar no projeto INTEIRO:
- **Títulos/headings** → classe `font-display` (Fraunces serif).
- **Números, datas, specs, labels em caixa alta** → `font-mono-data` (JetBrains Mono tabular).
- **Kicker/eyebrow** (rótulo pequeno acima do título) → `text-eyebrow`.
- ⚠️ **A fonte `'Bebas Neue'` usada inline em vários lugares NUNCA foi carregada** (`index.html` só tem Inter/Fraunces/JetBrains Mono) — ela cai em sans genérico. **Troque por `font-mono-data`.** Eu corrigi nos meus arquivos; **faltam os SEUS:**
  - `src/pages/admin/StudentDetail.tsx:1221`
  - `src/pages/admin/WorkoutPrescriptions.tsx:157` e `:253`
- Commits de design: `9cb1a5f` (home do aluno + hero "Treino de hoje"), `00f97a1` (rollout + headers WhatsApp), `930ad78` (card de exercício), `72338e1` (Estatísticas/Calendário/Histórico/balões).

### 🏋️ Atleta (novas features)
- `StudentHome`: hero **"Treino de hoje"** com CTA + onboarding para aluno sem ciclo.
- Som + vibração no fim do descanso com **mudo** (`src/lib/feedback.ts`, `RestTimer.tsx`).
- **Wake-lock** durante a sessão (`src/hooks/useWakeLock.ts`).
- **Celebração de recorde** ao bater carga (`ExerciseCard.tsx`).
- **PWA instalável + offline shell** (`public/manifest.webmanifest`, `public/sw.js`, `public/icon.svg`, registro em `src/main.tsx` **só em produção**, tags em `index.html`).
- **Autosave + backup offline** dos logs (`StudentPortal.tsx`). Commits `b5dab8a`, `d57cf75`.

### 🧑‍🏫 Coach (novas features)
- Templates com variáveis ricas (`src/lib/templateVars.ts`): `{{nome}} {{primeiro_nome}} {{plano}} {{vencimento}} {{valor}} {{dias_restantes}}` + chips na UI de Templates.
- **Broadcast por segmento** no CRM + filtros acionáveis (Todos/Sem treino/Inadimplentes), com confirmação e progresso. Commits `a2e7080`, `c0d886a`.

### 🌱 Aquisição (novas features)
- White-label na **anamnese** e no **pagamento** (logo/tema da empresa). `public-payment-context` passou a retornar `branding` (**deploy pendente**).
- Sinais de confiança no checkout + microcópia de sucesso + CTA cadastro→pagamento.
- Defaults de marca de `AppearanceSettings` alinhados ao `ThemeContext`. Commits `1327d6f`, `b1baee4`, `6b193e2`.

**Novos arquivos meus:** `src/lib/feedback.ts`, `src/hooks/useWakeLock.ts`, `src/lib/templateVars.ts`, `public/{manifest.webmanifest,sw.js,icon.svg}`.
**Temporário a remover:** `student-home-preview.html`, `src/preview-student-home.tsx` (preview da home; pode apagar).

---

## 2. TAREFA A — Unificar com o projeto inteiro

1. **Commite seu WIP** (o fluxo avaliador→BNITO→musculação) para a base ficar limpa.
2. **Aplique o design system editorial nas SUAS telas** (fluxo de IA, dashboards admin/coordenador/trainer, prescrição, avaliação): `font-display` em títulos, `font-mono-data` em números/labels, `text-eyebrow` em kickers — para o app inteiro ficar coeso com o que entreguei no aluno/WhatsApp.
3. **Corrija a `Bebas Neue` quebrada** nos seus arquivos (StudentDetail, WorkoutPrescriptions) → `font-mono-data`.
4. **Resolva o C3**: `ProtectedRoute` + checagem de posse em `/aluno/treino/:studentId` (`src/App.tsx`).
5. **Não altere os arquivos que são meus** sem necessidade (ver lista acima / `CLAUDE.md`); se precisar, mantenha o comportamento. Rode `npm run build` e `npm run test` e garanta verde.

---

## 3. TAREFA B — Implementar os 4 itens que deixei para você

> Eu parei nestes de propósito: exigem migração/cron/deploy na produção compartilhada (Bn-app `zshrcgbyhzxpnlccssyz`) e/ou tocam dados sensíveis — melhor você desenhar com cuidado e o Matheus revisar antes de ligar.

**B1 — Anamnese em passos (frontend, sem deploy):** `src/pages/PublicAnamnesis.tsx` hoje é ~20 campos obrigatórios numa tela só. Quebrar em 3–4 passos com barra de progresso e validação por seção (apontando o campo que faltou, não um toast genérico). Mantenha todos os campos/validações atuais.

**B2 — Fotos de progresso do aluno (precisa migração + deploy):** galeria antes/depois junto às Medidas (`src/components/student/BodyMeasurements.tsx`). Requer **bucket** dedicado + tabela `progress_photos (student_id, company_id, photo_path, taken_at)` com **RLS estrita por dono** (aluno só vê/sobe as próprias; staff da empresa vê) — é imagem pessoal, capriche na RLS.

**B3 — Gatilhos de automação (precisa cron + deploy, ALTO risco):** os disparadores `no_workout_7d` e `payment_pending` existem na UI (`WhatsAppAutomation`) mas **nenhum job os roda**. Adicionar um scan diário (no cron que já roda `process_enrollment_lifecycle`) que injeta `flow_sessions` para alunos que batem a condição. ⚠️ Auto-envia WhatsApp a clientes reais — teste com cuidado.

**B4 — Recuperação de cadastro/carrinho abandonado:** registrar evento "iniciou pagamento / abandonou" em `/pagamento/:studentId` para disparar follow-up no WhatsApp CRM.

---

## 4. Quando terminar
Avise o Matheus. Aí **eu (Claude) faço o deploy** das edge functions `whatsapp-manager`, `asaas-integration` e `public-payment-context` (via `supabase functions deploy <slug> --project-ref zshrcgbyhzxpnlccssyz --use-api`), e validamos juntos.

## 🐛 Achados pós-deploy (Claude, 2026-06-13) — 2 bugs pra você resolver

Durante a verificação, o seed de dados de referência tinha ficado para trás no Bn-app (schema veio, dados não). Já semeei via `scripts/seed-reference.mjs` (commit claude): **447 exercícios + 28 grupos + 836 alvos (globais)** e **8 planos + 32 form_fields + 19 whatsapp_labels + 5 role_permissions** na empresa `dad65c62…` (Academia Fitness Pro, 16 alunos). Tive que **conceder `service_role`** nas tabelas (o projeto não tinha esse grant — vale revisar por que). Mas achei 2 bugs que são SEUS pra corrigir:

1. **`scripts/replica-export.mjs` corrompe UUIDs.** A redação de privacidade (anti-telefone) troca sequências de dígitos **dentro de uuids** pela string literal `[redacted-phone]`, quebrando `id`/FKs (4 grupos, 44 exercícios, 66 alvos, 20 nós de automação no export atual). Conserto necessário: a redação deve ser **field-aware** (nunca tocar colunas uuid) ou validar uuid antes/depois. Enquanto não consertar, toda réplica nova nasce quebrada. (Reparei no import com remap consistente, mas é paliativo.)

2. **Tabela `achievements` não existe no schema do Bn-app.** A gamificação do aluno (XP/conquistas — `award_xp`, `check_and_unlock_achievements`, `AchievementsPanel`) referencia `achievements`, que não foi criada. Falta a migration dela (+ seed: a réplica tem 8 conquistas globais). `automation_flows`/nodes/edges também ficaram de fora do seed (nós corrompidos + baixo valor) — opcional.

## 🧱 Fundação pronta (Claude, 2026-06-13) — CONTRATOS que você consome

Construí o esqueleto (schema + libs + UI) que destrava suas fases. Tudo aplicado no Bn-app (aditivo) + commitado:
- **`company_ai_config`** (tabela + RLS): white-label por empresa — campos `assistant_name`, `consultancy_name`, `methodology`, `plans_payment`, `tone`, `onboarding_completed`. Lib `src/lib/companyAiConfig.ts` (`fetchCompanyAiConfig(companyId)` → fallback BN/"BNITO"). **Fase 4: consuma esses campos nos prompts das `ai-*`** (nome da IA, metodologia, tom). UI do onboarding já existe: `CompanyOnboarding.tsx`.
- **`student_files`** (tabela) + bucket privado **`student-files`** (path `{company_id}/{student_id}/...`): a pasta automática do aluno. Lib `src/lib/studentFiles.ts` (`saveStudentFile`, `listStudentFiles`). **Fase 1: o relatório da avaliação deve ser salvo aqui** (eu faço o wiring na integração; você só entrega o JSON/representação do relatório).
- **`students.weekly_contact_enabled`** (boolean): toggle do contato semanal. **Fase 3 #9: sua automação `weekly_contact` deve respeitar esse campo.** UI: `WeeklyContactToggle.tsx`.
- **`src/lib/studentStatus.ts`**: máquina de status única (`deriveStudentStatus`) — use os mesmos estados para qualquer lógica de status do aluno.

Não toquei em `App.tsx`/`StudentDetail`/`AppSidebar` (seus) — o wiring dos meus componentes nas rotas/telas eu faço na **integração final**.

Valeu! — Claude
