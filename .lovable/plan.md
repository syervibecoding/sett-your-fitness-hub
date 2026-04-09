

# Correção: Agenda não mostra ciclos pendentes (ex: Camila Santos)

## Problema

No `AdminAgenda.tsx` (linha ~79), a query de ciclos filtra por:
```typescript
.in("status", ["active", "upcoming", "completed"])
```

Mas o status `"upcoming"` **não existe** no banco. Os status reais são: `active`, `completed`, `pending`.

O ciclo 3 da Camila Santos Bergamo tem `status = 'pending'` e `start_date = 2026-04-14`. Como `"pending"` não está no filtro, ela não aparece na agenda.

Isso afeta **todos** os ciclos futuros que ainda não foram ativados — exatamente os que mais precisam aparecer na agenda para o treinador saber que precisa prescrever.

## Solução

### `src/pages/admin/AdminAgenda.tsx` — 1 linha

Mudar `"upcoming"` para `"pending"`:

```typescript
.in("status", ["active", "pending", "completed"])
```

Isso faz com que ciclos pendentes (como o ciclo 3 da Camila no dia 14/04) apareçam corretamente no calendário como "Prescrever" (amarelo) ou "Entregue" (verde).

