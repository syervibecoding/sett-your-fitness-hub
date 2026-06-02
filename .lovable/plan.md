# Transições de página suaves (master e demais painéis)

## Problema
Hoje **cada página** (`/master`, `/admin/...`, `/coordinator/...`, `/trainer/...`) renderiza o próprio `<AppLayout>` (sidebar + cabeçalho) por dentro. Como o layout está dentro da página carregada via `lazy()`, toda navegação:

1. Mostra um **spinner de tela cheia** (`PageLoader`) enquanto o novo arquivo carrega.
2. **Desmonta e remonta a sidebar inteira**, causando o "piscar"/recarregamento que você sente como master.

O `RouteTransition` não resolve porque o shell inteiro está sendo destruído a cada clique.

## Solução
Tornar o shell (sidebar + cabeçalho) **persistente**. Ele monta uma vez e só a área de conteúdo troca, com um spinner pequeno apenas dentro do conteúdo (não na tela toda).

```text
Antes:  [clique] -> tela branca + spinner cheio -> sidebar remonta -> página
Depois: [clique] -> sidebar fica parada -> só o conteúdo faz fade/troca
```

## Mudanças

### 1. `AppLayout` vira shell de rota persistente
- `AppLayout` passa a renderizar `<Outlet />` (do React Router) em vez de receber `children`.
- O `<Suspense>` das páginas lazy é movido para **dentro** da área de conteúdo, com fallback discreto (spinner pequeno centralizado na área, sem `min-h-screen`).
- O `RouteTransition` permanece envolvendo só o conteúdo (keyed por pathname).
- Suporte a `noPadding` por página passa a ser controlado pela própria página (wrapper interno) ou por uma rota; manter o comportamento atual para WhatsApp Chat e Automação.

### 2. `App.tsx` — agrupar rotas sob o layout persistente
- Criar uma rota-pai com `element={<AppLayout />}` que envolve todas as rotas de painel (master, admin, coordinator, trainer). A sidebar já se adapta ao papel internamente, então um único shell serve a todos.
- Cada rota-filha mantém seus guards atuais (`ProtectedRoute` / `FeatureRoute` com `allowedRoles`, `requiredFeature`, `requiredModule`) envolvendo apenas o elemento da página.
- Rotas públicas (`/`, `/auth`, `/inscricao`, `/anamnese`, `/pagamento`, `/aluno...`) ficam **fora** do shell, como hoje.

### 3. Remover `<AppLayout>` de dentro das páginas (≈25 arquivos)
Cada página passa a retornar só o seu conteúdo (sem o wrapper de layout). Arquivos:
- Master: `MasterDashboard`, `CompaniesManager`, e a Biblioteca em `/master/exercises`.
- Admin: `AdminDashboard`, `RegistrationManager`, `AnamnesisManager`, `PlansManager`, `TeamManager`, `StudentsManager`, `StudentDetail`, `AdminAgenda`, `FinancialDashboard`, `WhatsAppSettings/Chat/CRM/Automation/Templates`, `AppearanceSettings`, `ExerciseLibrary`, `WorkoutPrescriptions`, `WorkoutBuilder`, `UnifiedPrescriber`, `FunctionalAssessment`, `Announcements`.
- Coordinator: `CoordinatorDashboard`.
- Trainer: `TrainerDashboard`.
- Páginas com `noPadding` (`WhatsAppChat`, `WhatsAppAutomation`): preservar o comportamento sem padding via wrapper próprio.

### 4. Manter animação de troca
- O `RouteTransition` (fade + slide curto, respeitando `prefers-reduced-motion`) continua, agora só na área de conteúdo, então a sidebar não pisca.
- O destaque ativo da sidebar (`layoutId="sidebar-active"`) passa a animar de forma contínua, já que a sidebar não remonta mais.

## Resultado esperado
- Sem spinner de tela cheia entre páginas; no máximo um spinner pequeno na área de conteúdo em primeira carga de um chunk.
- Sidebar e cabeçalho permanecem fixos; só o conteúdo troca com transição suave.
- Vale para todos os papéis, incluindo master.

## Observações técnicas
- Refator mecânico em ~25 páginas (remoção do wrapper), concentrando o risco em `App.tsx` e `AppLayout.tsx`.
- Sem mudanças de schema, RLS, edge functions ou lógica de negócio — apenas estrutura de layout/rotas.
- Guards de acesso (`FeatureRoute`/`ProtectedRoute`) e regras de tier/permissão ficam idênticos.
