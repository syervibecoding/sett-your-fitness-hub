

# Plano: Melhorias na aba Equipe

## Problema 1: Alunos aparecendo na lista da Equipe
A função `loadTeam()` carrega todos os `company_members` e seus `user_roles`, filtrando apenas masters. Alunos com `user_id` (que tiveram acesso ativado) aparecem na lista da equipe com badge "student". O login do aluno já está no `StudentDetail.tsx` — então basta filtrar alunos fora da lista de equipe.

### Mudança em `TeamManager.tsx`
- Na função `loadTeam()`, após buscar os roles (linha ~137), filtrar também os user_ids que possuem **apenas** o role `student` — ou seja, se o usuário tem role `student` e nenhum outro role (admin/coordinator/trainer), não mostrar na lista.
- Ajustar o loop que constrói `grouped` para ignorar entries com role `"student"`.

## Problema 2: Performance só mostra treinadores
A função `loadPerformance()` filtra apenas `role = "trainer"` (linha 198). Coordenadores e admins que também prescrevem treinos ficam de fora.

### Mudança em `TeamManager.tsx`
- Na função `loadPerformance()`, buscar roles `trainer`, `coordinator` e `admin` em vez de apenas `trainer`.
- Usar `.in("role", ["trainer", "coordinator", "admin"])` na query de `user_roles`.
- Ajustar o label da aba/mensagem vazia de "Nenhum treinador encontrado" para "Nenhum membro encontrado".
- Adicionar um badge com o role de cada membro no card de performance para diferenciar.

## Arquivos alterados
- `src/pages/admin/TeamManager.tsx` — único arquivo modificado

## Resultado
- Lista de equipe mostra apenas admin, coordenador e treinador (sem alunos)
- Quadro de performance inclui admin, coordenador e treinador

