## Objetivo

Garantir que cada empresa só veja e altere SEUS dados. Hoje a plataforma roda só com a BN Performance, mas existem várias políticas e fluxos amadores que vazam ou permitem cruzar empresas. Antes de abrir para novos clientes, precisamos fechar todas as brechas abaixo.

---

## Achados críticos da auditoria

### 1. Políticas RLS abertas para o público (anon) — vazamento e adulteração global

Hoje o papel `anon` (qualquer pessoa com a chave pública, ou seja, qualquer visitante) consegue:

| Tabela | Política | Impacto |
|---|---|---|
| `students` | `SELECT using true` | Lê **CPF, telefone, e-mail, endereço, foto** de TODOS os alunos de TODAS as empresas |
| `students` | `UPDATE using true` | Pode **alterar qualquer aluno** de qualquer empresa |
| `students` | `INSERT with check true` | Pode **criar alunos** em qualquer empresa (spam/lead falso) |
| `enrollments` | `SELECT using true` | Lê matrículas, planos, status financeiro de TODAS as empresas |
| `companies` | `SELECT using true` | Lê **stripe_customer_id, stripe_subscription_id, slug, tier** de todas as empresas concorrentes |
| `anamnesis` | `INSERT with check true` | Pode injetar anamnese em qualquer `student_id` |
| `platform_settings` | `SELECT using true` | Lê configurações de marca de todas (aceitável só para o login público) |

Causa raiz: as páginas `PublicRegistration`, `PublicAnamnesis` e `PublicPayment` chamam o Supabase com a chave anon e foram destravadas com `true` para "funcionar". Isso é uma falha grave de multi-tenant.

### 2. Edge function `manage-team-member` aceita `company_id` do body

O caller pode mandar `company_id` no payload e cair em outra empresa. A função usa `targetCompanyId = callerCompany?.company_id || requestCompanyId`. Um admin com `company_members` removido (ou master mal configurado) pode injetar membros em empresas alheias.

### 3. `exercise_library` e `form_fields` — admin de uma empresa altera dados globais

- `exercise_library`: políticas de UPDATE/DELETE permitem qualquer admin alterar/deletar exercícios `is_global = true`. Um cliente novo pode apagar a biblioteca compartilhada usada por todos.
- `form_fields`: UPDATE/DELETE permitem mexer em rows com `company_id IS NULL` (templates globais).

### 4. Master view via localStorage

`MasterContext` guarda `viewing_company` em `localStorage` e o frontend filtra por esse `effectiveCompanyId`. Isso não é privilege escalation (o RLS dá acesso ao master de qualquer forma), mas precisa de fallback claro: se o master não escolheu empresa, certas telas não devem listar dados misturados de várias empresas como se fossem de uma só.

### 5. Pontos OK que vamos confirmar

- `whatsapp_chats`, `whatsapp_messages`, `whatsapp_instances`, `whatsapp_labels`, `workouts`, `workout_sessions`, `workout_logs`, `payments`, `plans`, `student_evaluations`, `training_cycles` → políticas escopadas por `company_id` ou via `students`. OK.
- Triggers `set_anamnesis_company_id`, `set_enrollment_company_id`, `log_trainer_assignment_change` → garantem `company_id` mesmo se o cliente não mandar. OK.
- `useAuth` busca `company_members` corretamente.

---

## Plano de correção

### Fase A — Fechar o acesso anon (migration de RLS)

1. **Remover** todas as policies anon listadas acima (`Anon can read students`, `Anon can update students`, `Anon can insert students`, `Anon can read enrollments`, `Anon can read companies`, `Anon can insert anamnesis`).
2. **Manter apenas o estritamente necessário** para as páginas públicas:
   - `plans`: manter `SELECT` anon mas **filtrar por `is_active=true AND company_id = (slug recebido)`** via uma view ou função `get_public_plans(company_slug)`.
   - `form_fields`: idem (`is_active=true` por empresa).
   - `platform_settings`: idem por empresa (não global).
3. **Criar 3 edge functions públicas** que substituem o acesso direto do anon:
   - `public-registration` — recebe `{ company_slug, ...dados }`, valida slug, cria `students` + `enrollments` com `company_id` correto usando service role.
   - `public-anamnesis` — recebe `{ student_id, token, ...dados }`, valida que o student existe e (idealmente) um token de uso único antes de inserir.
   - `public-payment-link` — devolve só os campos necessários para o checkout, sem expor `stripe_customer_id`.
4. Atualizar `PublicRegistration.tsx`, `PublicAnamnesis.tsx`, `PublicPayment.tsx` para chamar as novas edge functions em vez de `supabase.from(...)` com anon.

### Fase B — Endurecer recursos globais

5. `exercise_library`: separar policy "modifica próprio" (`company_id = get_user_company_id`) da "modifica global" (`is_global = true AND has_role(master)`). Admin de empresa só insere/edita os seus.
6. `form_fields`: idem — só master mexe em `company_id IS NULL`.

### Fase C — Edge functions

7. `manage-team-member`: ignorar `company_id` do body. Sempre usar `callerCompany?.company_id` para admins; só master pode passar `company_id` explícito (verificar com `has_role(master)`).
8. Revisar `asaas-webhook` e `whatsapp-webhook` — já filtram por `company_id` derivado do recurso (instance/plan), parecem OK; só adicionar logs e validações defensivas.

### Fase D — Frontend / UX do master

9. Quando master não selecionou empresa (`viewingCompany == null`):
   - Em telas operacionais (Students, Workouts, WhatsApp, Financial), mostrar um aviso "Selecione uma empresa para operar" em vez de listar tudo.
   - Em telas de visão consolidada (Master Dashboard), agregar por empresa explicitamente.
10. Garantir que toda query nas páginas `admin/*` use `effectiveCompanyId` (já existe na maioria; precisa varredura final em `WhatsAppCRM`, `WhatsAppAutomation`, `AdminAgenda`).

### Fase E — Verificação

11. Rodar Supabase linter e auditar com 2 contas de teste (Empresa A admin e Empresa B admin) cada tela operacional.
12. Adicionar testes de RLS rápidos via SQL (`SET ROLE authenticated; SET request.jwt.claims = ...`) para students, enrollments, payments, whatsapp_messages, workouts.

---

## Notas técnicas (resumo)

```text
Risco              | Onde                                    | Severidade
-------------------|-----------------------------------------|------------
PII vazada (anon)  | RLS students/enrollments/companies      | Crítica
Adulteração anon   | RLS students UPDATE/INSERT              | Crítica
Cross-tenant write | manage-team-member (body company_id)    | Alta
Recursos globais   | exercise_library / form_fields          | Média
Master sem escopo  | MasterContext + telas operacionais      | Média
```

A Fase A sozinha já elimina o vetor mais grave (qualquer pessoa lendo/alterando alunos de qualquer empresa via chave anon pública).

---

## Como vamos executar

Sugiro implementar em 2 entregas:

1. **Entrega 1 — Fase A + C7** (fecha o vazamento crítico e protege a criação de membros). Inclui as 3 edge functions públicas e migração RLS.
2. **Entrega 2 — Fases B, D, E** (recursos globais, UX do master, verificação final).

Posso começar pela Entrega 1 assim que aprovar.