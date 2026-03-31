

# Vincular aluno Syer ao portal

## Situação atual
- O aluno **Syer Rodrigues de Souza Filho** (`id: 3cb1cfae...`) já existe no banco
- Já tem `user_id: cd246049...` vinculado (conta auth já criada)
- Já está em `company_members` (company BN Performance)
- **Problema**: falta a role `student` em `user_roles` — sem isso, o login mostra "Aguardando liberação"

## O que será feito

### 1. Inserir role `student` via migration
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('cd246049-58c8-4541-9636-6ee6561d175f', 'student')
ON CONFLICT (user_id, role) DO NOTHING;
```

### 2. Resetar a senha do usuário
Usar a edge function ou o Supabase Admin API para definir a senha como `123456` (ou a que você preferir — `1234` não funciona pois o mínimo é 6 chars).

### Resultado
Após isso, o login com `syer.filho24@gmail.com` / `123456` levará direto ao portal do aluno (`/aluno`).

### Arquivos alterados
- Migration SQL (inserir role)
- Possível chamada à edge function `activate-student-access` para resetar senha (ou ajuste direto via admin API)

