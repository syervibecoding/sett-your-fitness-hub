# Atribuição de treinadores no WhatsApp

## Objetivo
Na tela de **Conversas** do WhatsApp, todos (admin, Bruna, coordenador, treinador) continuam vendo todas as conversas da empresa, mas agora cada conversa mostra:
- **Qual treinador está atribuído** ao aluno (ou "Sem treinador").
- **Status do aluno**: Ativo, Pendente ou Aguardando renovação.

Além disso, adicionamos filtros para focar em um treinador específico, e um atalho **"Meus alunos"** para o treinador ver rapidamente só os clientes dele.

Nenhuma mudança de permissão/banco é necessária — a visibilidade continua igual (por empresa); apenas enriquecemos a tela e adicionamos filtros.

## O que muda na tela de Conversas

```text
┌───────────────────────────────┐
│ 🔍 Buscar conversa...          │
│ [Todas ▾] [Minhas] [S/ Treino] │
│ [Meus alunos] [Treinador ▾]    │  ← novos filtros
├───────────────────────────────┤
│ 👤 João Silva                  │
│    Última mensagem...          │
│    🟢 Ativo · 🏋 Treinador: Ana │  ← novas etiquetas
├───────────────────────────────┤
│ 👤 Maria Souza                 │
│    🟡 Pendente · Sem treinador │
└───────────────────────────────┘
```

- **Etiqueta de treinador**: badge com o nome do treinador atribuído ao aluno, ou "Sem treinador" quando `assigned_trainer_id` está vazio. Aparece apenas em conversas vinculadas a um aluno.
- **Etiqueta de status**: badge colorido com o status da matrícula/aluno (Ativo / Pendente / Aguardando renovação).
- **Filtro por treinador** (dropdown): lista os treinadores da empresa; ao escolher um, mostra só conversas de alunos daquele treinador. Inclui opção "Sem treinador".
- **Atalho "Meus alunos"**: filtra para conversas de alunos cujo `assigned_trainer_id` é o usuário logado. Útil principalmente para o treinador, mas disponível para todos.

## Detalhes técnicos

Arquivo principal: `src/pages/admin/WhatsAppChat.tsx` (a mesma tela é usada nas rotas de admin, coordenador e treinador).

1. **Carregar dados de atribuição** (estender `loadStudentData` / `loadChats`):
   - Buscar `students.assigned_trainer_id` para os alunos vinculados às conversas (já temos `student_id` em cada chat).
   - Buscar nomes dos treinadores em `profiles` (`user_id`, `full_name`) — já existe `loadSenderNames` que carrega `profiles`; reaproveitar/estender para mapear `trainerNamesById`.
   - Status do aluno: derivar do que já é carregado em `loadStudentData` (matrícula ativa, renovação) e/ou `students.status`. Já existem `enrollments` e pagamentos carregados ali; consolidar num campo `studentStatus` por chat.
   - Guardar em estados novos: `chatTrainer` (`Record<chatId, {id, name} | null>`) e `chatStatus` (`Record<chatId, 'ativo'|'pendente'|'renovar'>`).

2. **Renderização das etiquetas** (no bloco de cada conversa, ~linha 737-747): adicionar dois badges usando tokens do design system (sem cores hardcoded `text-white` cruas — usar variantes/`bg-primary`, `bg-muted`, `secondary`, `destructive`, e o padrão amber já presente para "Financeiro").

3. **Filtros** (estado `activeFilter` e novo estado `trainerFilter`):
   - Adicionar `"my-students"` ao tipo `FilterType` (atalho "Meus alunos").
   - Novo estado `trainerFilter: string | "all" | "none"` com um `DropdownMenu`/`Select` populado pela lista de treinadores da empresa.
   - Atualizar `filteredChats` (~linha 650) para aplicar:
     - `my-students`: manter só chats cujo aluno tem `assigned_trainer_id === user.id`.
     - `trainerFilter`: filtra por treinador escolhido (ou "Sem treinador").

4. **Lista de treinadores**: buscar membros da empresa com papel treinador. Reaproveitar abordagem de `TeamManager.tsx` (consulta `company_members` + `user_roles` + `profiles`) ou simplesmente derivar a partir dos `assigned_trainer_id` presentes nas conversas + nomes de `profiles`. Para um seletor completo, buscar treinadores via `user_roles`/`company_members`.

## Fora de escopo
- Sem mudanças de RLS ou migração de banco (todos continuam vendo as mesmas conversas).
- Sem mudanças na lógica de envio/recebimento de mensagens nem na vinculação aluno↔conversa (que já existe).

## Validação
- Como admin: ver todas as conversas com badge do treinador e status; testar filtro por treinador e "Sem treinador".
- Como treinador: usar "Meus alunos" e confirmar que aparecem só os alunos atribuídos a ele (sem deixar de ter acesso às demais conversas quando o filtro está em "Todas").
