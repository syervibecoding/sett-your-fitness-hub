
# Plano: Sincronizar "Troca de Treino" no Dashboard

## Problema
O campo "TROCA DE TREINO" no dashboard mostra dados desatualizados porque:

1. **Ciclos nunca avançam de status**: A função `generate_training_cycles` cria o ciclo 1 como `active` e todos os demais como `pending`. Não existe nenhum mecanismo (trigger, cron, ou lógica no front) que mude o ciclo 2 para `active` quando o ciclo 1 vence.
2. **Dashboard não recarrega**: O `loadData()` só roda no mount ou quando `effectiveCompanyId` muda — navegar para alunos e voltar não atualiza.

## Solução

### 1. Migração SQL — função para avançar ciclos automaticamente
Criar uma função `advance_training_cycles()` que:
- Marca como `completed` todos os ciclos com `status = 'active'` e `end_date < CURRENT_DATE`
- Ativa o próximo ciclo (`pending` com menor `cycle_number`) da mesma matrícula
- É chamada via trigger (BEFORE SELECT não existe no PG), então a melhor abordagem é chamá-la no front-end antes de renderizar o dashboard

Alternativamente (mais confiável): executar a lógica de avanço diretamente no front-end ao carregar o dashboard, com uma chamada RPC.

```sql
CREATE OR REPLACE FUNCTION public.advance_training_cycles()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  -- Mark expired active cycles as completed
  UPDATE training_cycles SET status = 'completed'
  WHERE status = 'active' AND end_date < CURRENT_DATE;

  -- Activate next pending cycle for each enrollment
  UPDATE training_cycles tc SET status = 'active'
  FROM (
    SELECT DISTINCT ON (enrollment_id) id
    FROM training_cycles
    WHERE status = 'pending'
    AND enrollment_id IN (
      SELECT enrollment_id FROM training_cycles
      WHERE status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM training_cycles tc2
        WHERE tc2.enrollment_id = training_cycles.enrollment_id AND tc2.status = 'active'
      )
    )
    ORDER BY enrollment_id, cycle_number
  ) next_cycle
  WHERE tc.id = next_cycle.id;
END;
$$;
```

### 2. Código — chamar `advance_training_cycles()` no dashboard
Em `AdminDashboard.tsx`, no início de `loadData()`, adicionar:
```ts
await supabase.rpc("advance_training_cycles");
```

Isso garante que ao abrir o dashboard, os ciclos vencidos são finalizados e os próximos ativados antes de exibir os countdowns.

### 3. Código — forçar refresh ao voltar para o dashboard
Adicionar listener de `visibilitychange` ou usar `useEffect` com dependência na rota para recarregar dados quando o usuário navega de volta ao dashboard.

## Arquivos alterados
- Nova migração SQL: cria `advance_training_cycles()`
- `src/pages/admin/AdminDashboard.tsx`: chama RPC no início de `loadData()` + adiciona refresh automático
- `src/pages/trainer/TrainerDashboard.tsx`: mesmo tratamento (se usar ciclos)
