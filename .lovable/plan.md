

# Correção: Duplicatas da Viviane + Navegação clicável no Dashboard

## Problema 1 — Viviane Araújo duplicada

A Viviane tem **13 matrículas ativas** para o mesmo `student_id` (`a82e7dce`). Apenas 1 tem `training_start_date` preenchida, as outras 12 são duplicatas sem data. No card "Definir Data de Treino", cada matrícula sem data gera uma linha, por isso ela aparece tantas vezes.

**Solução**: Criar uma migration para deletar as 12 matrículas duplicadas, mantendo apenas a que tem `training_start_date` definida (`41cb01e3`).

## Problema 2 — Navegação para página do aluno

Atualmente os itens do dashboard (alertas, renovação, troca de treino) não são clicáveis. O usuário quer clicar no nome de qualquer aluno e ir direto para `/admin/students/:id`.

**Solução**: Tornar clicáveis os itens em:

### `src/components/DashboardAlerts.tsx`
- **Definir Data de Treino**: cada item navega para o StudentDetail usando o `student_id` (precisa trazer o `student_id` da enrollment junto)
- **Aguardando Treinador**: navega para `/${prefix}/students/${student_id}`
- **Sem Matrícula Ativa**: navega para `/${prefix}/students/${student_id}`
- **Sem Treino no Ciclo**: navega para `/${prefix}/students/${student_id}` (precisa trazer o student_id via enrollment)
- **Aniversários**: navega para `/${prefix}/students/${student_id}` (precisa trazer o `id` do student)
- Adicionar `useNavigate` e calcular o `prefix` baseado no role

### `src/pages/admin/AdminDashboard.tsx`
- **Renovação**: cada contrato clicável → `/${routePrefix}/students/${student_id}` (precisa trazer `student_id` da enrollment)
- **Troca de Treino**: cada item clicável → `/${routePrefix}/students/${student_id}` (precisa trazer `student_id` via enrollment)

## Detalhes técnicos

### Migration
```sql
DELETE FROM enrollments 
WHERE student_id = 'a82e7dce-e27d-4f23-ba2f-f832d8d0ce1e' 
AND id != '41cb01e3-c04b-4ec2-af0e-87d15bfffa68';
```

### DashboardAlerts.tsx
- Adicionar `useNavigate` do react-router-dom
- Receber `routePrefix` como prop (ou calculá-lo internamente via `useAuth`)
- Alterar interfaces para incluir `student_id` em todos os tipos (Birthday, AwaitingTrainingDate, MissingWorkout)
- Nas queries, trazer `student_id` junto (enrollment → students.id)
- Envolver cada item com `onClick={() => navigate(...)}` e `cursor-pointer`

### AdminDashboard.tsx
- Na seção "Renovação", trazer `student_id` da enrollment e adicionar `onClick` + `cursor-pointer`
- Na seção "Troca de Treino", trazer `student_id` via enrollment e adicionar `onClick` + `cursor-pointer`

