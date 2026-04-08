

# Correção: Rota da Agenda faltando para Trainer e Coordinator

## Problema

O sidebar gera links para `/trainer/agenda` e `/coordinator/agenda`, mas no `App.tsx` só existe a rota `/admin/agenda`. Quando o Matheus (trainer) clica em "Agenda", cai na rota `*` → página 404.

## Solução

### `src/App.tsx`

Adicionar duas rotas novas, reutilizando o mesmo componente `AdminAgenda`:

1. **Linha ~125** (após rotas do coordinator): adicionar
   ```
   <Route path="/coordinator/agenda" element={<FeatureRoute allowedRoles={["coordinator"]} requiredFeature="hasAgenda"><AdminAgenda /></FeatureRoute>} />
   ```

2. **Linha ~133** (após rotas do trainer): adicionar
   ```
   <Route path="/trainer/agenda" element={<FeatureRoute allowedRoles={["trainer"]} requiredFeature="hasAgenda"><AdminAgenda /></FeatureRoute>} />
   ```

O componente `AdminAgenda` já suporta múltiplos roles — ele usa `useAuth()` para detectar o role e calcula o `rolePrefix` dinamicamente (`/coordinator`, `/trainer`, `/admin`).

### Verificação do FeatureRoute

A rota usa `requiredFeature="hasAgenda"`. Preciso confirmar que o `FeatureRoute` reconhece `hasAgenda` e que o `useRolePermissions` já inclui `"agenda"` nos defaults para trainer e coordinator — **sim, já inclui** (verificado no código: `DEFAULT_PERMISSIONS` lista `"agenda"` para ambos).

Nenhuma outra alteração necessária.

