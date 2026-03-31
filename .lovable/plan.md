

## Diagnóstico

### Problema 1: Parcelas aparecendo como "à vista"
A API do Asaas, ao listar cobranças (`GET /payments`), retorna cada parcela como um pagamento individual. Cada um tem o campo `installment` (ID do grupo de parcelamento), mas **não** retorna `installmentCount` diretamente. O sync atual usa `ap.installmentCount` que é `undefined`, resultando em `1` (à vista) para todos.

### Problema 2: Mês mostrando fevereiro
O `new Date()` deveria retornar março, mas pode haver dados concentrados em fevereiro. Vou garantir que o mês corrente seja exibido corretamente nos cards e tabs.

---

## Plano

### 1. Corrigir sync de parcelas na edge function `asaas-integration`

Na função `syncPayments`:
- Ao iterar os pagamentos do Asaas, agrupar por `ap.installment` (ID do parcelamento)
- Para cada grupo com `installment` preenchido, contar quantos pagamentos pertencem ao mesmo grupo = `installmentCount`
- Salvar `installment_count` correto em cada pagamento do grupo
- Pagamentos sem `installment` (à vista) mantêm `installment_count = 1`

### 2. Corrigir cálculo do caixa no frontend

Em `FinancialDashboard.tsx`, a lógica de `distributeCash` já está correta — ela distribui parcelas pelos meses futuros usando `installment_count` e `addMonths`. O problema é que os dados no banco estão com `installment_count = 1`. Após corrigir o sync, os dados ficarão corretos.

### 3. Garantir mês correto

- Verificar e forçar que a label "(atual)" nos tabs de caixa use `new Date()` consistentemente
- No card "Faturamento do Mês" e "Caixa do Mês", adicionar o nome do mês corrente para clareza (ex: "Faturamento — Mar/26")

### Arquivos alterados
- `supabase/functions/asaas-integration/index.ts` — corrigir `syncPayments` para agrupar parcelas e calcular `installment_count`
- `src/pages/admin/FinancialDashboard.tsx` — exibir nome do mês nos cards de faturamento/caixa
- Deploy da edge function

