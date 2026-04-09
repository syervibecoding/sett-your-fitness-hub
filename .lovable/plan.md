

# Correção: Coordenador clica no aluno e página só recarrega

## Problema

No `DashboardAlerts.tsx` (linha 51), o `routePrefix` está definido assim:

```
role === "master" ? "admin" : role === "trainer" ? "trainer" : "admin"
```

Quando o role é `"coordinator"`, ele cai no else final e vira `"admin"`. O link gerado é `/admin/students/:id`, mas o coordinator não tem permissão para acessar rotas `/admin/*` — o `FeatureRoute` rejeita e redireciona de volta, causando o "recarregamento" sem navegar.

## Solução

### `src/components/DashboardAlerts.tsx` — Linha 51

Alterar o cálculo do `routePrefix` para usar o `role` diretamente (igual ao `AdminDashboard.tsx`):

```typescript
const routePrefix = role === "master" && isViewingCompany ? "admin" : role;
```

Isso gera `/coordinator/students/:id` para coordinator, `/trainer/students/:id` para trainer, `/admin/students/:id` para admin — todas rotas que já existem no `App.tsx`.

Alteração de 1 linha, sem efeitos colaterais.

