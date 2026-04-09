

# Correção: Matrículas duplicadas pelo webhook Asaas

## Causa raiz

A função `ensureEnrollmentExists` no webhook Asaas verifica apenas `status = 'active'` (linha 65). As matrículas existentes desses alunos têm status `awaiting_training`, então o webhook não as encontra e cria uma nova duplicada sem `training_start_date`.

## Alunos afetados (7 com duplicatas)

| Aluno | Enrollment antiga (com data) | Enrollment nova (sem data, duplicada) |
|-------|------------------------------|---------------------------------------|
| Andrielly | fa1295a0 (awaiting_training) | 94632e22 (active) |
| Beatriz Dutra | 8882d9d2 (awaiting_training) | 6930d5a2 (active) |
| Bianca | c5a00f4b (awaiting_training) | 5a945790 (active) |
| Jaqueline | b27d15e0 (awaiting_training) | 9286fed0 (active) |
| Juliana | 6eba16b2 (awaiting_training) | 8174407b (active) |
| Renan | 17ce6afb (awaiting_training) | 58b64291 (active) |
| Victoria | 10dc3e49 (awaiting_training) | 113068b9 (active) |

## Solução

### 1. Migration — Limpar duplicatas
Deletar as 7 matrículas novas (sem data) e atualizar as antigas para status `active`:

```sql
-- Deletar as duplicatas sem training_start_date
DELETE FROM enrollments WHERE id IN (
  '94632e22-03db-4686-aaed-822041a8987d',
  '6930d5a2-cc90-47a7-860e-3f49dfa2281a',
  '5a945790-77aa-46da-b260-38b07e56ab67',
  '9286fed0-8ddc-45d8-9087-fc5f4f0133c0',
  '8174407b-f836-46fc-867d-dd0bcbb127ea',
  '58b64291-76d6-41e6-acc4-88699ff00706',
  '113068b9-508a-411d-a6b6-f1a3afd9e464'
);

-- Reativar as matrículas originais
UPDATE enrollments SET status = 'active' WHERE id IN (
  'fa1295a0-dae7-4067-891a-3537ff4dcff9',
  '8882d9d2-6329-459c-8a96-8be7629a41f1',
  'c5a00f4b-0c75-4071-8e52-8b4b8e3a6ad3',
  'b27d15e0-e9e9-4793-9245-a3373fa8c676',
  '6eba16b2-8b70-4a11-b181-c2ec23df50d1',
  '17ce6afb-d1ff-41c7-8423-ea00f19a2bd3',
  '10dc3e49-f638-4b92-8b43-834aab0cae04'
);
```

### 2. Fix webhook — Prevenir futuras duplicatas

**Arquivo: `supabase/functions/asaas-webhook/index.ts`**

Linha 65: mudar `.eq("status", "active")` para `.in("status", ["active", "awaiting_training"])`.

Assim, se já existir matrícula em qualquer estado ativo, o webhook reutiliza em vez de criar nova.

