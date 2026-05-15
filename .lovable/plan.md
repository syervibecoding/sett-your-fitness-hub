## Objetivo

Exibir os blocos **RENOVAÇÃO** e **TROCA DE TREINO** (hoje exclusivos do `AdminDashboard`) também no dashboard do coordenador (`/coordinator`).

## Abordagem

Extrair a lógica de busca e os dois cards visuais do `AdminDashboard.tsx` para um componente compartilhado e reutilizá-lo em ambos os dashboards. Isso evita duplicação e mantém a paridade visual/funcional automaticamente em alterações futuras.

## Passos

1. **Criar `src/components/dashboard/RenewalsAndCyclesPanel.tsx`**
   - Recebe props: `effectiveCompanyId: string | null`, `routePrefix: string`.
   - Move para dentro:
     - função `fetchRenewalsAndCycles` (parte do `fetchDashboardData` referente a `expiringContracts`, `cycleCountdowns` e `trainerMap`).
     - `useQuery` próprio com chave `["renewals-cycles", effectiveCompanyId ?? "all"]`.
     - JSX dos dois `Card` (RENOVAÇÃO + TROCA DE TREINO) idêntico ao atual, incluindo navegação para `/${routePrefix}/students/${id}`.

2. **Refatorar `src/pages/admin/AdminDashboard.tsx`**
   - Remover a parte de renovação/ciclos do `fetchDashboardData` e o JSX correspondente.
   - Renderizar `<RenewalsAndCyclesPanel effectiveCompanyId={effectiveCompanyId} routePrefix={routePrefix} />` no mesmo lugar (mantendo o card "PLANOS MAIS VENDIDOS" ao lado do bloco RENOVAÇÃO via grid de 2 colunas, ou ajustando o layout para colocar o painel abaixo do gráfico).

3. **Atualizar `src/pages/coordinator/CoordinatorDashboard.tsx`**
   - Importar e renderizar `<RenewalsAndCyclesPanel effectiveCompanyId={companyId} routePrefix="coordinator" />` logo após `<DashboardAlerts />`.
   - Sem mudanças nas demais seções (Matrículas, fila de alunos).

## Detalhes técnicos

- O coordenador já está sob `FeatureRoute requiredFeature="hasDashboard"`, então não há novo gating necessário.
- RLS nas tabelas `enrollments` / `training_cycles` / `students` / `profiles` já permite leitura por membros da empresa, então o coordenador consegue carregar os mesmos dados.
- Os links de navegação devem usar `routePrefix="coordinator"` para apontar a `/coordinator/students/:id`.
- Sem alterações em backend, RLS, edge functions ou schema.

## Validação

- `/coordinator` exibe os dois novos painéis com os mesmos dados que o admin vê para a mesma empresa.
- `/admin` continua funcionando igual (apenas refatorado).
- Cliques navegam corretamente para o detalhe do aluno em cada perfil.
