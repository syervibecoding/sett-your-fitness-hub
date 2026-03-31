

# Correção dos Ciclos — Athletic Club

## Situação Atual

**Aluna encontrada**: Ana Carolina Da Silva — Athletic Club Iniciante

| Campo | Valor Atual | Valor Correto |
|-------|-------------|---------------|
| `enrollment.cycle_duration_days` | 30 | 42 |
| `plan.duration_days` | 30 | 42 (6 semanas × 7) |
| Ciclos gerados | 3 (dois duplicados no ciclo 1) | 1 |

Mesmos problemas do BN PRO:
- **Ciclos duplicados**: 2 ciclos com `cycle_number = 1` (um de 30 dias, outro de 33 dias)
- `cycle_duration_days` da matrícula está 30 em vez de 42
- `duration_days` dos 3 planos Athletic está 30 em vez do correto

### Planos Athletic Club (todos com `cycle_duration_days = 42`, `duration_days = 30`):

```text
Plano                    | Semanas | duration_days correto | Ciclos esperados (42d)
-------------------------|---------|----------------------|----------------------
Athletic Club Iniciante  |    6    |  42                  |  1
Athletic Club Semestral  |   24    | 168                  |  4
Athletic Club Anual      |   48    | 336                  |  8
```

---

## Plano de Correção (Migration SQL)

### Passo 1: Corrigir `duration_days` dos 3 planos Athletic Club
```sql
UPDATE plans SET duration_days = duration_weeks * 7
WHERE name ILIKE '%athletic club%';
```

### Passo 2: Corrigir `cycle_duration_days` das matrículas Athletic
```sql
UPDATE enrollments e SET cycle_duration_days = p.cycle_duration_days
FROM plans p WHERE e.plan_id = p.id AND p.name ILIKE '%athletic club%';
```

### Passo 3: Deletar ciclos incorretos/duplicados
```sql
DELETE FROM training_cycles WHERE enrollment_id IN (
  SELECT e.id FROM enrollments e JOIN plans p ON p.id = e.plan_id
  WHERE p.name ILIKE '%athletic club%'
);
```

### Passo 4: Regenerar ciclos corretos
Forçar re-trigger atualizando `training_start_date` para o mesmo valor (o trigger `generate_training_cycles` regenera automaticamente).

### Observação
- Isso deve ser combinado com a correção do BN PRO num único migration, já que ambos têm o mesmo problema.
- Deve-se também corrigir o trigger e o frontend (`PlansManager.tsx` e `StudentDetail.tsx`) conforme já planejado anteriormente, para evitar reincidência.

### Resultado esperado para Ana Carolina (Iniciante):
- 1 único ciclo de 42 dias (09/02 a 22/03/2026)

