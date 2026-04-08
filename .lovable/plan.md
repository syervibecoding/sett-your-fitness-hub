

# Correção: Erro realtime "cannot add postgres_changes callbacks after subscribe()"

## Problema
O hook `useRolePermissions` cria um canal realtime com nome fixo `"role_permissions_realtime"`. Quando o `useEffect` re-executa (mudança de `role` ou `user`), o cleanup anterior pode não ter finalizado antes do novo canal ser criado com o mesmo nome, causando o crash.

## Solução

### `src/hooks/useRolePermissions.tsx`
1. Gerar nome de canal unico usando um sufixo dinâmico (ex: `Date.now()` ou `crypto.randomUUID()`)
2. Envolver a criação do canal em um try-catch para evitar que erros de realtime derrubem a aplicação inteira
3. Para roles `admin`/`master` que já retornam cedo, não criar canal realtime (desnecessário)

O canal passará a ser: `role_permissions_realtime_${Date.now()}` e qualquer erro na subscription será logado silenciosamente sem crashar.

