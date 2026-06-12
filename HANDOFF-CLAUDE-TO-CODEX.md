# 📨 Handoff: Claude Code → Codex (2026-06-12)

Olá, Codex. Claude Code entrou no repo para trabalhar em paralelo com você. Resumo do que **já fiz e commitei** para você não duplicar nem colidir.

## Commit: `claude: fix WhatsApp/Student frontend bugs + harden payment & WhatsApp edge fns` (`2b326c3`)

Toquei **somente** nestes arquivos (escolhi áreas que NÃO estavam no seu diff). Deixei todo o seu WIP não-commitado intocado:

- `src/pages/admin/WhatsAppChat.tsx`, `src/pages/admin/WhatsAppCRM.tsx`
- `src/pages/student/StudentPortal.tsx`, `src/components/student/StatsCharts.tsx`, `src/components/student/ExerciseCard.tsx`
- `src/pages/PublicPayment.tsx`
- `supabase/functions/whatsapp-manager/index.ts`, `supabase/functions/asaas-integration/index.ts`
- `CLAUDE.md` (adicionei a seção "Multi-Agent Live Coordination")

### O que mudou
- **WhatsApp**: realtime não re-subscreve a cada conversa + dedupe de mensagem; stale closure do `loadContacts`; CRM abre a conversa certa (passa `chatId` via nav state); `break-words`.
- **Aluno**: `loadStudentData` com try/catch/finally (fim do spinner infinito); `saveCurrentLogs` trata erro de verdade + salva séries de peso corporal (0kg); guardas contra `NaN` no progresso; guarda contra `session_date` nulo; 0 reps/carga agora representável.
- **Pagamento público (C2)**: o `asaas-integration` agora deriva o valor do **preço do plano no banco** (ignora `value`/`installmentValue` do client), validado contra a empresa do aluno; polling do PIX para após ~15 min.
- **WhatsApp edge (C1)**: validação de tenant — não-master travado à própria empresa; checagem de `chatId` por empresa (service-role ignora RLS) — corrige IDOR cross-tenant.

## ⚠️ NÃO edite estes (são meus agora)
`WhatsApp*.tsx`, `src/pages/student/*`, `src/components/student/*`, `PublicPayment.tsx`, `whatsapp-manager`, `asaas-integration`. Se precisar mexer, fala comigo pelo `CLAUDE.md` (seção "Multi-Agent Live Coordination" → "In flight").

## 🙏 Preciso de você: C3 (é arquivo SEU)
`src/App.tsx:113` — a rota `/aluno/treino/:studentId` (`StudentWorkout`) **não tem `ProtectedRoute`** nem checagem de posse. Qualquer usuário autenticado da empresa abre a prescrição de qualquer aluno trocando o id. Como `App.tsx` está no seu diff, **por favor adicione o `ProtectedRoute` + checagem de posse** (filtrar pelo `students.user_id` do logado, ou restringir a trainer/admin da empresa). Não toquei pra não colidir com seu WIP.

## ⏳ Pendente (precisa aprovação do Matheus)
- **Deploy** das edge functions `whatsapp-manager` e `asaas-integration` no Supabase Bn-app (`zshrcgbyhzxpnlccssyz`). Corrigi o código, mas **não fiz deploy** — aguardando o Matheus aprovar.

## 📋 Follow-ups que NÃO fiz (precisam de decisão/contexto, não chutei)
- Divergência de preço de tier entre `MasterDashboard` (`basic 49.90`) e `CompaniesManager` (`R$ 199/mês`) — precisa da tabela de preços real.
- `CompaniesManager`: associação de proprietário por `ilike` em `full_name` (frágil) — precisa lookup de email/`user_id` exato (provável edge function no auth).

## 🎨 Design pass (commits `9cb1a5f`, `00f97a1`)
A pedido do Matheus, comecei a deixar o app "mais bonito e funcional" na minha alçada:
- **Redesign da home do aluno** (`StudentHome.tsx`): linguagem editorial (eyebrow mono + serif Fraunces) + **hero "Treino de hoje"** com CTA.
- **Bug de fonte corrigido**: a `'Bebas Neue'` usada inline em vários lugares **nunca foi carregada** (só Inter/Fraunces/JetBrains Mono estão no `index.html`), então caía em sans genérico. Troquei pelos tokens reais (`font-mono-data` p/ labels/números, `font-display` p/ títulos) nos MEUS arquivos.

### ⚠️ Codex: seus arquivos ainda têm a `'Bebas Neue'` quebrada — troque por `font-mono-data` p/ ficar consistente:
- `src/pages/admin/StudentDetail.tsx:1221`
- `src/pages/admin/WorkoutPrescriptions.tsx:157, 253`
(Não toquei pra não colidir com seu WIP.)

Abraço, Claude.
