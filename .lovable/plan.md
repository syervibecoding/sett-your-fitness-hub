

# Melhorias no Financeiro: Histórico Completo + Comparativo Mês a Mês

## O que será feito

### 1. Sync histórico de 6 meses no Asaas
A edge function `asaas-integration` (action `sync-payments`) será atualizada para aceitar um parâmetro `syncAll: true` que busca cobranças dos últimos 6 meses usando paginação (offset), não apenas as mais recentes. Um botão "Sync Completo" será adicionado ao lado do botão atual.

**Arquivo:** `supabase/functions/asaas-integration/index.ts`
- Adicionar parâmetro `dateCreated[ge]` = 6 meses atrás quando `syncAll = true`
- Paginar com `offset` para buscar além do limit de 100

### 2. Histórico completo de pagamentos com filtros
Substituir a tabela "Pagamentos Recentes" (top 10) por uma tabela completa com:
- **Filtros:** período (data início/fim), status (todos/confirmado/pendente/atrasado), método de pagamento, busca por nome do aluno
- **Paginação:** mostrar 20 por página com navegação
- **Ordenação:** por data, valor ou status

**Arquivo:** `src/pages/admin/FinancialDashboard.tsx`

### 3. Comparativo mês a mês nos cards
Nos cards de Faturamento, Caixa e Ticket Médio, adicionar:
- Variação percentual vs mês anterior (ex: "+12%" ou "-5%")
- Seta de tendência (verde para cima, vermelho para baixo)
- Valor do mês anterior em texto menor para referência

**Arquivo:** `src/pages/admin/FinancialDashboard.tsx`
- Calcular valores do mês anterior a partir dos dados já carregados (sem query extra)
- Exibir badge com `↑ +12%` ou `↓ -5%` ao lado do valor principal

---

## Detalhes técnicos

### Edge function — sync histórico
```
GET /payments?customer={id}&limit=100&offset={n}&dateCreated[ge]=2025-10-01
```
Loop de paginação até `hasMore === false` ou `totalCount` atingido.

### Frontend — filtros
Novos estados: `filterStatus`, `filterDateFrom`, `filterDateTo`, `filterSearch`, `currentPage`. Filtro aplicado client-side sobre `recentPayments` (que passa a conter todos os pagamentos já sincronizados).

### Frontend — comparativo
Reutilizar `billingMap` e `cashChartMap` já calculados para extrair o valor do mês anterior e calcular a variação percentual.

### Arquivos alterados
1. `supabase/functions/asaas-integration/index.ts` — sync com paginação e filtro de data
2. `src/pages/admin/FinancialDashboard.tsx` — tabela com filtros, paginação, comparativo nos cards

