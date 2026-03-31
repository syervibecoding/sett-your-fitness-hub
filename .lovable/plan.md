

# Correção: Equipe não aparece para admin

## Problema
A tabela `user_roles` não tem política RLS que permita admins lerem as roles de outros membros da mesma empresa. Quando Bruna (admin) carrega a equipe, a query a `user_roles` só retorna a role dela mesma por causa da policy "Users can read own roles".

## Solução

### Migration SQL
Adicionar uma política RLS em `user_roles` para admins lerem roles dos membros da mesma empresa:

```sql
CREATE POLICY "Admin reads company member roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinator'::app_role))
  AND user_id IN (
    SELECT cm.user_id FROM public.company_members cm
    WHERE cm.company_id = get_user_company_id(auth.uid())
  )
);
```

Isso é suficiente — a policy é permissiva e faz OR com as existentes. Nenhuma mudança no frontend necessária.

### Resultado esperado
- Admin e coordenador vão conseguir ver todos os membros da equipe
- Novos membros criados aparecerão na lista após criação

