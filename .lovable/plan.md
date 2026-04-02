
# Plano: Corrigir cálculo de ciclos de treino

## Problema
A função `generate_training_cycles` gera ciclos demais porque usa `end_date` da matrícula (data financeira/contratual) em vez de calcular o fim baseado na `duration_days` do plano a partir da `training_start_date`.

Exemplo da Adrielly:
- `training_start_date` = 22/02/2026
- `end_date` (financeiro) = 13/02/2027
- Plano: 48 semanas = 336 dias, ciclos de 42 dias → **deveria ter 8 ciclos** (336 / 42 = 8)
- Mas como `end_date` é 21 dias depois de `training_start_date + 336`, gera **9 ciclos** (o 9º parcial)

Outros afetados: Beatriz Dutra, Bianca Borges, e outros com `training_start_date` diferente de `start_date`.

## Solução

### Migração SQL — corrigir a função `generate_training_cycles`
Remover a linha que sobrescreve `v_end` com `NEW.end_date`. Os ciclos devem ser calculados exclusivamente com base em:
- **Início**: `training_start_date`
- **Fim**: `training_start_date + duration_days - 1` (do plano)

Isso separa corretamente:
- **Ciclos de treino**: baseados no plano (duração + ciclo)
- **Data de renovação financeira**: `start_date` / `end_date` na matrícula

### Recalcular ciclos existentes
Após corrigir a função, executar um recálculo dos ciclos que estão errados (onde `cycle_count > duration_days / cycle_duration_days`). Isso será feito via UPDATE no `training_start_date` para o mesmo valor, o que dispara o trigger e recalcula.

## Arquivos alterados
- Nova migração SQL: atualiza `generate_training_cycles()` e recalcula ciclos existentes
