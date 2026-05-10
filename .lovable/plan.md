## Diagnóstico de performance

Fiz uma varredura na plataforma. As rotas **já são lazy-loaded** (bom!), mas existem vários pontos que estão pesando bastante na navegação e no carregamento inicial. Os principais ofensores:

### 1. React Query sem cache configurado
`src/App.tsx` cria `new QueryClient()` sem `staleTime`/`gcTime`. Resultado: a cada troca de aba, tudo é refazendo do zero (refetch on focus, on mount). Para um SaaS com Supabase, isso é a maior causa de lentidão percebida.

### 2. Dashboard e Alertas não usam React Query
- `AdminDashboard.tsx` e `DashboardAlerts.tsx` usam `useState + useEffect` puros, fazendo **15–20 queries em paralelo** toda vez que se entra em `/admin`. Sem cache, sem deduplicação, sem `enabled`.
- Várias dessas queries poderiam virar uma única RPC ou usar `count: exact, head: true` agregado.

### 3. Bundles gigantes em algumas páginas
Tamanho dos arquivos críticos:
```
StudentDetail.tsx ........ 97 KB / 1630 linhas
WhatsAppChat.tsx ......... 62 KB
TeamManager.tsx .......... 51 KB
FinancialDashboard.tsx ... 37 KB
WorkoutBuilder.tsx ....... 31 KB
StudentPortal.tsx ........ 31 KB
ExerciseLibrary.tsx ...... 25 KB
```
Como cada um vira um chunk único, a primeira visita à página congela enquanto baixa/parseia. Quebrar em sub-componentes lazy (abas, modais, gráficos) reduz drasticamente o tempo até interativo.

### 4. Dependência morta no bundle
`three` (~600 KB) está em `package.json` mas **não é importada em nenhum lugar do `src/`**. Mesmo lazy, infla o `node_modules` e o tree-shake do Vite. Pode ser removida.

### 5. Recharts carregado em rotas leves
`recharts` (~300 KB) é importado direto no topo de `AdminDashboard` e `FinancialDashboard`. Como esses dashboards são a página inicial do admin, o gráfico entra no chunk crítico. Lazy-loading apenas dos gráficos melhora muito o TTI.

### 6. Fontes Google bloqueantes
`src/index.css` faz `@import` de Bebas Neue + Inter com 5 pesos. O `@import` em CSS é **render-blocking** e serial. Mover para `<link rel="preconnect">` + `<link>` no `index.html` (com `display=swap`) e reduzir para 2–3 pesos do Inter melhora o FCP.

### 7. Realtime do WhatsApp em rotas pesadas
A subscription do `realtime.messages` em `WhatsAppChat.tsx` re-renderiza a árvore inteira (sem `useMemo`/`React.memo` nas listas de chats/mensagens). Para lojas com muitos contatos, vira lag visível.

### 8. Queries N+1 em `DashboardAlerts`
Há trechos que fazem uma query por aluno/ciclo dentro de loops. Em empresas com muitos alunos isso explode.

---

## Plano de otimização (em ordem de impacto / esforço)

### Fase 1 — Ganhos rápidos (alto impacto, baixo risco)
1. **Configurar `QueryClient`** com `staleTime: 60_000`, `gcTime: 5*60_000`, `refetchOnWindowFocus: false`. Reduz drasticamente refetches.
2. **Remover dependência `three`** não usada (`bun remove three`).
3. **Mover fontes do `@import` CSS para `<link>` no `index.html`** com `preconnect` e reduzir pesos do Inter para 400/500/600.
4. **Lazy-load gráficos do Recharts** (`AdminDashboard`, `FinancialDashboard`, `StatsCharts`) com `React.lazy` + `Suspense` interno.
5. **Adicionar `manualChunks` no `vite.config.ts`** separando: `react-vendor`, `radix`, `recharts`, `xyflow`, `supabase`. Isso permite cache de longo prazo entre deploys.

### Fase 2 — Refatorar dashboard inicial (impacto direto no que o usuário sente em `/admin`)
6. **Migrar `AdminDashboard` e `DashboardAlerts` para `useQuery`** com `queryKey` por `companyId`. Compartilha cache entre componentes irmãos e elimina refetches.
7. **Consolidar contagens** (`students` ativos/pendentes/inativos) numa única RPC `dashboard_counts(company_id)` no Supabase. 1 round-trip em vez de 4–6.
8. **Adicionar índices** se faltarem em `enrollments(status, expires_at)`, `training_cycles(enrollment_id, status)`, `payments(student_id, status)` — verifico no plano de execução.

### Fase 3 — Quebrar páginas gigantes
9. **`StudentDetail.tsx` (97 KB)**: separar cada aba (Treinos, Pagamentos, Anamnese, Histórico) em arquivos próprios e carregar com lazy quando a aba é aberta.
10. **`WhatsAppChat.tsx`**: extrair `MessageList`, `ChatList`, `MessageComposer` em componentes memoizados (`React.memo`) com `useMemo` para filtros. Virtualizar a lista de mensagens se >100 itens (pode ser feito numa fase posterior).
11. **`TeamManager`, `FinancialDashboard`, `WorkoutBuilder`**: extrair modais/dialogs grandes em arquivos lazy.

### Fase 4 — Polimento
12. Adicionar `<link rel="prefetch">` para as 3 rotas mais visitadas a partir do dashboard.
13. Habilitar `vite build --minify=esbuild` (padrão) e revisar `target: 'es2020'` para reduzir polyfills.
14. Auditar `useEffect` que fazem fetch sem `AbortController` — em rotas com troca rápida estão gerando race conditions e setState em componentes desmontados.

---

## Detalhes técnicos (para referência)

- **Onde os refetches acontecem hoje**: qualquer `useQuery` sem `staleTime` é considerado "stale" imediatamente, então um simples blur/focus na janela dispara nova requisição.
- **Tamanho estimado do bundle inicial atual**: ~700–900 KB (sem incluir chunks lazy). Após as otimizações da Fase 1, esperado ~400–500 KB.
- **Métricas para validar antes/depois**: posso rodar `browser--performance_profile` em `/admin` antes de começar e depois de cada fase para comparar Web Vitals (LCP, INP) e número de long tasks.

---

## Como tocar isso

Sugiro implementar **Fase 1 inteira de uma vez** (são edits cirúrgicos, baixo risco, melhora perceptível imediata), e depois decidirmos se atacamos Fase 2 e 3 — essas mexem em código de negócio e merecem ser feitas com mais calma, página por página.

Quer que eu comece pela Fase 1?
