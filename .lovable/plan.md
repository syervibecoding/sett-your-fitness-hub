

# Correção: Amanda com 2 ciclos em vez de 1

## Problema
O plano "BN PRO Iniciante" tem `duration_weeks = 6` e `cycle_duration_days = 42` (6 semanas). Quando a matrícula é criada, o frontend calcula `end_date = addWeeks(startDate, 6)` que dá **14/04** (Mar 3 + 6 semanas). Porém o trigger `generate_training_cycles` calcula internamente `v_end = start + 42 - 1 = 13/04`. Como `NEW.end_date (14/04)` sobrescreve, sobra 1 dia extra, gerando um ciclo 2 de 1 dia só (14/04 a 14/04).

## Causa raiz
Na linha 444 do `StudentDetail.tsx`:
```ts
const computedEndDate = addWeeks(startDate, selectedPlan.duration_weeks);
```
Isso calcula a data **exclusiva** (dia seguinte ao último dia), mas o sistema trata `end_date` como **inclusiva**.

## Solução
Trocar o cálculo de `end_date` para usar `duration_days` (que é mais preciso) e subtrair 1 dia para ser inclusivo:

```ts
const computedEndDate = selectedPlan
  ? addDays(startDate, (selectedPlan.duration_days || selectedPlan.duration_weeks * 7) - 1)
  : null;
```

Isso faz `end_date = 13/04` para Amanda, alinhando com o trigger e gerando apenas 1 ciclo.

## Correção dos dados existentes
Migration para deletar o ciclo 2 espúrio da Amanda e ajustar o `end_date` da matrícula:

```sql
-- Remove ciclo 2 de 1 dia
DELETE FROM training_cycles
WHERE enrollment_id = '225637a1-2133-44e1-9ac7-5cfb89d8dfd9' AND cycle_number = 2;

-- Corrige end_date da matrícula
UPDATE enrollments SET end_date = '2026-04-13'
WHERE id = '225637a1-2133-44e1-9ac7-5cfb89d8dfd9';
```

## Arquivos alterados
- `src/pages/admin/StudentDetail.tsx` — corrigir cálculo de `computedEndDate`
- Migration SQL — limpar dados da Amanda

