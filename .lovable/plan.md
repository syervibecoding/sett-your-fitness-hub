## Objetivo

Fazer com que qualquer pessoa que efetivamente atende alunos apareça no filtro de treinadores do WhatsApp — incluindo o Matheus, que é coordenador mas também monta/atende treinos. Hoje o filtro só lista usuários com papel exatamente `trainer`, deixando coordenadores e admins de fora mesmo quando têm alunos atribuídos.

## Mudança

Arquivo: `src/pages/admin/WhatsAppChat.tsx` — função `loadTrainers` (linhas ~258-283).

A lista de treinadores deixa de ser baseada apenas no papel `trainer`. Ela passa a ser a **união** de:

1. Usuários da empresa com papel `trainer` (como hoje), **e**
2. Qualquer usuário que esteja efetivamente atribuído a algum aluno (`students.assigned_trainer_id`) na empresa — independente do papel ser `coordinator`, `admin` etc.

Assim, "quem faz treino aparece": se alguém tem pelo menos um aluno atribuído, entra no dropdown.

### Detalhes técnicos

- Buscar os `assigned_trainer_id` distintos de `students` da empresa (consulta já existe parcialmente no carregamento dos chats; aqui faremos uma consulta enxuta só dos IDs não nulos).
- Combinar esses IDs com os IDs de papel `trainer` num único `Set`, garantindo que todos sejam membros da empresa (`company_members`).
- Buscar `profiles.full_name` para todos esses IDs e montar a lista ordenada por nome.
- Sem alteração de RLS, banco ou lógica de negócio — apenas como a lista do dropdown é construída no frontend.

## Fora de escopo

- Nenhuma mudança em badges de status, atribuição ou nas políticas de acesso.
- Nenhuma migração de banco.