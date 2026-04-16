

# Corrigir erro "created_by" ao criar matrícula

## Problema
Na função `handleCreateEnrollment` (linha ~467 de `StudentDetail.tsx`), o insert na tabela `enrollments` inclui o campo `created_by: session.user.id`. Porém, a tabela `enrollments` **não possui** a coluna `created_by`, causando o erro:

> Could not find the 'created_by' column of 'enrollments' in the schema cache

## Solução
Remover o campo `created_by` do objeto de insert da matrícula na linha 469 de `StudentDetail.tsx`. A tabela `enrollments` não precisa dessa coluna — ela já rastreia `trainer_id` e `student_id`.

### Arquivo
- **Modificado**: `src/pages/admin/StudentDetail.tsx` — remover `created_by: session.user.id` do insert de enrollment (linha 469)

Sem alterações no banco de dados.

