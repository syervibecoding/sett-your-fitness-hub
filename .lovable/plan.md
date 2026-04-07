

# Correção: Matrícula automática falhando no webhook Asaas

## Diagnóstico

A Taísa Madiã tem:
- **Pagamento**: CONFIRMED ✅
- **Status do aluno**: active ✅ (o webhook atualizou)
- **Matrícula**: NÃO EXISTE ❌

O problema está na função `ensureEnrollmentExists` dentro de `supabase/functions/asaas-webhook/index.ts`. Na linha 137, o insert tenta inserir um campo `created_by` que **não existe** na tabela `enrollments`. Isso causa um erro silencioso e a matrícula nunca é criada.

## Solução

### 1. Corrigir `supabase/functions/asaas-webhook/index.ts`
- Remover o campo `created_by` do insert na função `ensureEnrollmentExists` (linhas 104-113 e 137)
- Remover toda a lógica de buscar `owner_user_id` da company, que só servia para popular esse campo inexistente

### 2. Criar matrícula manualmente para a Taísa
- Usar o insert tool para criar a matrícula da Taísa agora, já que o webhook já passou e não vai disparar novamente

## Detalhes técnicos

**Arquivo**: `supabase/functions/asaas-webhook/index.ts`

O insert corrigido ficará:
```ts
.insert({
  student_id: studentId,
  plan_id: student.selected_plan_id,
  trainer_id: student.assigned_trainer_id || null,
  start_date: today.toISOString().split("T")[0],
  end_date: endDate.toISOString().split("T")[0],
  payment_status: "paid",
  payment_date: today.toISOString().split("T")[0],
  status: "active",
  company_id: studentCompanyId || null,
})
```

A matrícula da Taísa será inserida com os dados: `student_id`, `plan_id` (88faf03c), `company_id` (c051e80e), status active, payment_status paid.

