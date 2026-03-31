

# Correção: Lista de Treinadores no Seletor

## Problema
O seletor de treinador nas páginas de Alunos e Detalhe do Aluno busca apenas usuários com `role = 'trainer'` na tabela `user_roles`. Isso causa:
- **Bruna** (admin) e **Matheus** não aparecem porque têm role `admin`/`coordinator`
- **Syer** aparece porque tem role `trainer` no banco (possivelmente cadastrado incorretamente)

## Solução

### 1. Corrigir a query de treinadores (2 arquivos)
Em `StudentsManager.tsx` (linha 95) e `StudentDetail.tsx` (linha 423), trocar:
```ts
supabase.from("user_roles").select("user_id").eq("role", "trainer")
```
Por uma query que busca **todos os membros da empresa** com roles `admin`, `coordinator` ou `trainer`:
```ts
supabase.from("user_roles").select("user_id, role").in("role", ["admin", "coordinator", "trainer"])
```
Isso já vai ser filtrado pela RLS para mostrar apenas membros da mesma empresa.

### 2. Verificar/corrigir role do Syer no banco
Rodar uma query para checar se Syer tem role `trainer` indevidamente. Se sim, remover via migration.

### Resultado esperado
- Bruna, Matheus e qualquer admin/coordinator/trainer da empresa aparecem no seletor
- Syer (se for aluno) não aparece mais

