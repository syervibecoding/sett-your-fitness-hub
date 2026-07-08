## Objetivo

1. Corrigir o "Ativar Acesso" para alunos com conta pré-existente (caso Renan).
2. Substituir os 4 placeholders "Em breve" da tela do aluno por funcionalidades reais.

---

## 1. Correção do "Ativar Acesso" (bug do Renan)

**Causa raiz confirmada nos dados:** a conta de autenticação do Renan já existia (criada em 08/04, de um cadastro anterior) e ele nunca logou. A edge function `activate-student-access` só define a senha quando **cria** um usuário novo. Quando o usuário já existe, ela vincula a conta mas devolve uma senha temporária que nunca foi aplicada — por isso a senha mostrada não funciona.

**Correção em `activate-student-access`:**
- Quando o e-mail já existe no Auth (ou quando o aluno já tem `user_id` vinculado), **redefinir a senha** da conta existente via `updateUserById({ password, email_confirm: true })` e retornar essa senha temporária que realmente funciona.
- Ajustar o bloqueio atual "Student already has access": em vez de recusar, tratar como "reativar/redefinir senha" — garante que sempre exista uma senha válida e devolvida ao treinador.
- Continuar garantindo papel `student`, vínculo em `students.user_id` e `company_members`.

Sem mudança de UI necessária (o botão "Ativar Acesso" já mostra a senha retornada).

---

## 2. Provas e Metas (aba Programa)

**Nova tabela `student_goals`:** `student_id`, `company_id`, `title`, `type` (prova/meta), `target_date`, `notes`, `status`.
- GRANTs + RLS company-scoped (equipe gerencia; aluno lê as próprias).

**UI:** substituir o placeholder por um card na aba "Programa" para adicionar/editar/excluir datas-alvo. As datas aparecem no calendário do aluno (`StudentCalendar`) como marcadores.

---

## 3. Linha do Tempo (aba Acompanhamento)

Novo componente que lê e mescla em ordem cronológica (sem tabela nova):
- Prescrições/treinos criados (`workouts`)
- Treinos realizados (`workout_sessions` concluídas)
- Anamnese enviada/preenchida (`student_anamneses`)
- Avaliações (`student_evaluations`)
- Matrículas (`enrollments`)

Renderizado como uma timeline vertical com ícone, data e descrição por evento.

---

## 4. Pasta do Aluno (aba Acompanhamento) — só equipe

**Novo bucket privado `student-documents`** + **nova tabela `student_documents`:** `student_id`, `company_id`, `file_path`, `file_name`, `mime_type`, `size`, `uploaded_by`, `notes`.
- GRANTs + RLS: apenas equipe da empresa (admin/coordinator/trainer) vê/insere/exclui. Aluno **não** acessa.

**UI:** card com upload de laudos/PDFs, lista com download (URL assinada) e exclusão.

---

## 5. Contato semanal por WhatsApp (aba Acompanhamento)

Sem IA — envio direto pelo WhatsApp da plataforma.
- Nova action `send-student-text` em `whatsapp-manager` (reaproveita o `sendText` já existente): recebe `studentId` + `message`, resolve o telefone do aluno e envia; registra em `whatsapp_messages`/`whatsapp_chats` quando houver chat.
- **UI:** card com campo de mensagem (ou modelos rápidos) e botão "Enviar no WhatsApp", com aviso se o WhatsApp não estiver conectado ou o aluno sem telefone.

---

## Detalhes técnicos

- **Migrations:** `student_goals` e `student_documents` (CREATE TABLE → GRANT authenticated/service_role → ENABLE RLS → POLICIES company-scoped; goals com leitura do próprio aluno, documents restrito à equipe). Trigger `set_company_id` no padrão existente e `update_updated_at_column`.
- **Storage:** criar bucket privado `student-documents`; políticas em `storage.objects` para equipe da empresa.
- **Edge functions:** editar `activate-student-access` e `whatsapp-manager` (deploy automático).
- **Frontend:** editar `src/pages/admin/StudentDetail.tsx` (substituir os 4 `ComingSoon`), novos componentes em `src/components/student`/`trainer` para timeline, metas, documentos e contato; integrar metas no `StudentCalendar`.

## Fora de escopo

- IA no contato semanal (é envio manual direto).
- Aluno visualizar documentos (mantido só para equipe).
- Automação/agendamento do contato semanal (é envio sob demanda).