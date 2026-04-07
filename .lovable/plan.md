

# Correção: RLS bloqueando inserção em student_evaluations

## Problema
O treinador Matheus Loreto não consegue adicionar notas/avaliações porque os inserts na tabela `student_evaluations` não incluem o `company_id`. A política RLS exige que `company_id = get_user_company_id(auth.uid())`, mas como o campo não é enviado, fica `NULL` e a política rejeita.

## Solução
Adicionar `company_id` em todas as chamadas de insert na tabela `student_evaluations` dentro de `StudentDetail.tsx`.

## Arquivo alterado

### `src/pages/admin/StudentDetail.tsx`
- Na função `handleFileUpload` (linha 644): adicionar `company_id` ao objeto de insert, obtendo da variável `student.company_id` já disponível no componente
- Na função `handleSaveTextEval` (linha 693): mesmo ajuste — incluir `company_id`
- Verificar se o `student` já tem `company_id` carregado; caso contrário, buscar do perfil do usuário via `get_user_company_id` ou do próprio student

