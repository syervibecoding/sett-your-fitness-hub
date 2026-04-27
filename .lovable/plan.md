## Coordenador não consegue atribuir treinadores — diagnóstico

### O que verifiquei

- **RLS de `students`**: a policy `Admin company update` (apesar do nome) permite UPDATE para QUALQUER usuário autenticado da mesma `company_id`. Coordenador deveria conseguir.
- **RLS de `user_roles`**: a policy `Admin reads company member roles` libera leitura para `admin` E `coordinator` da mesma company. OK.
- **RLS de `profiles`**: `Company profiles readable` libera quem está em `company_members` da mesma company. Os 2 trainers (Thalia, Bárbara) estão registrados corretamente em `company_members` da company da Bruna.
- **Permissões de módulo**: o coordenador "Matheus" tem registros em `role_permissions` apenas para `appearance`, `plans`, `whatsapp`. Como não há registro para `students`, o `useRolePermissions` cai no default (`students` está incluído) — então a tela abre normalmente.
- **Rota `/coordinator/students`**: existe e está liberada via `FeatureRoute allowedRoles={["coordinator"]}`.
- **Logs do Postgres**: sem erros recentes.

### Hipótese mais provável

O coordenador abre a tela e vê alunos, mas o **dropdown de treinadores aparece vazio** ou o `update` em `students.assigned_trainer_id` retorna erro silencioso. Causas possíveis:

1. **Lista de trainers vazia**: o `loadData` busca `user_roles` SEM filtrar por company. Como a policy filtra por company, deveria vir só os da company dele — mas se o coordenador não tem a role corretamente reconhecida no momento do fetch, pode vir vazio. (Já houve relato de race condition no `useAuth.companyId`.)
2. **`effectiveCompanyId` nulo no momento do fetch** (companyId ainda carregando) → query roda sem `.eq("company_id", ...)`, mas o `loadData` é re-disparado quando muda. Pode estar OK.
3. **Toast de erro suprimido** ou usuário não nota a mensagem.

### Plano de correção (3 mudanças seguras)

**1. Tornar o carregamento de trainers explícito por company e robusto**
   - Em `StudentsManager.loadData`, juntar `user_roles` com `company_members` filtrando por `effectiveCompanyId` para garantir que apenas trainers/coordenadores da empresa atual apareçam.
   - Não disparar `loadData` enquanto `effectiveCompanyId` for `null` (early return), evitando estado vazio.

**2. Logar e exibir o erro real do update**
   - Em `handleAssignTrainer` e `handleChangePlan`, fazer `console.error(error)` e mostrar `error.message` + `error.code` no toast — assim o Matheus me manda o erro exato se persistir.

**3. Renomear/ajustar policies de `students` (defesa em profundidade — opcional, mas recomendado)**
   - Hoje `Admin company update/delete/insert` permitem QUALQUER autenticado da company. Isso é permissivo demais para `delete`, mas é exatamente o que faz o coordenador conseguir atribuir trainer. **Não vou mexer agora** para não regredir; só anoto que o nome da policy está enganoso.

### Detalhes técnicos

- **Arquivo tocado**: `src/pages/admin/StudentsManager.tsx` (função `loadData` + handlers de update).
- **DB tocado**: nenhum (só leitura para diagnóstico).
- **Sem migração necessária** a menos que o teste pós-deploy mostre erro RLS — nesse caso adiciono uma policy explícita `Coordinator company update on students for assignment`.

### Próximo passo após implementação

Pedir ao Matheus para tentar atribuir um treinador novamente. Se ainda falhar, ele me manda o texto do toast (que agora terá `code` + `message`) e eu identifico se é RLS, dado faltando ou bug de UI.
