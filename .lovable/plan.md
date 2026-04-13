

# Corrigir treinador na Agenda — usar `assigned_trainer_id`

## Problema
A agenda busca o treinador via `enrollments.trainer_id` (join nos training_cycles). Mas quando o treinador do aluno é alterado no cadastro (`assigned_trainer_id`), a matrícula antiga não é atualizada, causando divergência.

## Solução

### 1. Agenda: usar `assigned_trainer_id` do aluno como fonte do treinador
Em `AdminAgenda.tsx`, ao montar os eventos de ciclos, buscar o treinador via `students.assigned_trainer_id` em vez de `enrollments.trainer_id`. Isso garante que a agenda mostra o treinador atual do aluno.

**Mudança na query de ciclos (linha 80)**:
- Adicionar join até `students` para pegar `assigned_trainer_id`
- Buscar nomes dos treinadores usando `assigned_trainer_id` em vez de `enrollment.trainer_id`

### 2. (Opcional) Corrigir dados existentes
Criar uma migration que sincronize `enrollments.trainer_id` com `students.assigned_trainer_id` para matrículas ativas, eliminando a divergência histórica.

### Arquivos
- **Modificado**: `src/pages/admin/AdminAgenda.tsx` — trocar fonte do treinador de `enrollment.trainer_id` para `student.assigned_trainer_id`

