

# Plano: Corrigir bugs nas Avaliações e Financeiro

## Problemas identificados

### Bug 1: Erro ao salvar avaliação (foto/áudio/texto)
A tabela `student_evaluations` **não possui** a coluna `created_by`. O código em `StudentDetail.tsx` tenta inserir `created_by: session.user.id` nas linhas 646 e 694, causando erro no banco.

### Bug 2: Erro ao salvar informações financeiras
A tabela `enrollments` **não possui** as colunas `financial_notes`, `payment_date` e `payment_method`. O código tenta fazer update dessas colunas (linha 608-611), causando o erro visível no screenshot: *"Could not find the 'financial_notes' column of 'enrollments'"*.

## Solução

### Migração SQL — adicionar colunas faltantes

```sql
-- Avaliações: adicionar evaluator_id que já existe, mas created_by não
ALTER TABLE public.student_evaluations
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Financeiro: adicionar colunas ao enrollments
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS financial_notes text,
ADD COLUMN IF NOT EXISTS payment_date date,
ADD COLUMN IF NOT EXISTS payment_method text;
```

### Código — nenhuma alteração necessária
O código já está correto; apenas faltam as colunas no banco. Após a migração, tudo funcionará.

## Arquivos alterados
- Nova migração SQL (colunas `created_by` em `student_evaluations`, `financial_notes`/`payment_date`/`payment_method` em `enrollments`)

