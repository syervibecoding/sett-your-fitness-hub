

# Corrigir exibição de treinadores inconsistentes

## Problema
O detalhe do aluno (`StudentDetail.tsx`) mostra o treinador em dois lugares diferentes com fontes de dados distintas:
1. **Header do aluno** (linha 768): usa `student.assigned_trainer_id` — o treinador atribuído diretamente no cadastro do aluno
2. **Matrícula ativa / Programa** (linhas 834, 938): usa `enrollment.trainer_id` — o treinador vinculado à matrícula

Quando o aluno troca de treinador ou tem múltiplas matrículas, esses valores divergem, causando confusão.

## Solução

### 1. Usar o treinador da matrícula ativa como fonte principal
- No header do aluno, exibir o treinador da matrícula ativa (mais recente) em vez do `assigned_trainer_id`
- Se não houver matrícula ativa, usar o `assigned_trainer_id` como fallback

### 2. Sincronizar `assigned_trainer_id` ao criar/editar matrícula
- Quando uma nova matrícula for criada ou o treinador da matrícula for alterado, atualizar também o `assigned_trainer_id` do aluno para manter consistência

### Arquivos
- **Modificado**: `src/pages/admin/StudentDetail.tsx` — trocar a lógica do `trainerName` no header para usar o treinador da matrícula ativa, com fallback para `assigned_trainer_id`

