## Visão geral

Construir a landing page do Set Training App em `/` baseada no manual de marca (Paper-first, paleta Navy + Ink restrita, tipografia Fraunces + Inter + JetBrains Mono, tom editorial e técnico). No mesmo passe, migrar os tokens globais e o chrome do app (Sidebar + Topbar) para a nova identidade — modo light como padrão.

## Decisões de marca aplicadas

| Token | Valor |
|---|---|
| Set Navy (primary) | `#1D2D5C` → HSL `223 53% 27%` |
| Set Ink (foreground) | `#0A0A0A` → HSL `0 0% 4%` |
| Paper (background) | `#FAFAF7` → HSL `60 19% 98%` |
| Paper Warm (card/muted) | `#F2F0EA` → HSL `47 21% 93%` |
| Line (border) | `#D8D6CE` → HSL `45 12% 83%` |
| Muted (text secundário) | `#6B6A66` → HSL `45 2% 41%` |
| Ink Soft (dark surface) | `#1A1A1A` → HSL `0 0% 10%` |
| Display | Fraunces (200/300/400 italic) via Google Fonts |
| Sans | Inter (400/500/600/700) — substitui Calibri por web safety |
| Mono | JetBrains Mono (400/500/600) |
| Radius | `0.25rem` (mais editorial/sóbrio que o atual 0.5rem) |

Acentos italic Fraunces em palavras-chave (manifesto: "ciência", "verdade", "compromisso", "prova"). Régua tipográfica modular com `font-feature-settings: "ss01"` para opentype no Fraunces.

## Mudanças

### 1. Sistema de design (tokens)
- **`src/index.css`**: substituir todas as variáveis HSL para a nova paleta (light default). Remover dark forçado. Atualizar `body` para `font-family: 'Inter'`, criar utilitários `.font-display` (Fraunces), `.font-mono-data` (JetBrains). Adicionar `--paper-warm`, `--ink-soft`, `--line` como tokens semânticos extras. Ajustar `--radius` para `0.25rem`. Atualizar scrollbar para tons paper/line.
- **`tailwind.config.ts`**: adicionar `fontFamily: { display: ['Fraunces'], sans: ['Inter'], mono: ['JetBrains Mono'] }` e expor `paper-warm`, `ink-soft`, `line`, `navy`, `ink` como cores semânticas. Adicionar utilities para letter-spacing editorial.
- **`index.html`**: trocar preload de fontes — remover Bebas Neue, adicionar Fraunces (com itálicos), Inter, JetBrains Mono. Atualizar `<title>` e meta description com posicionamento do manual ("A plataforma onde o treino vira dado").

### 2. Landing page (nova)
- **`src/components/landing/`** (novos):
  - `LandingNav.tsx` — nav fina sticky com wordmark "SET" + link "Acessar" → `/auth`.
  - `Hero.tsx` — Headline "Treino é *ciência*. O resto é planilha." (italic Fraunces), eyebrow `— MANIFESTO / 01`, sub-copy técnica, dois CTAs (Começar / Ver planos). Métrica em JetBrains Mono ao lado direito ("Volume + 14% · ciclo 03").
  - `Differentials.tsx` — 3 colunas: Matriz de Volume Biomecânico, Log Real de Carga, Sobrecarga Progressiva Auditável. Cada uma com número 01/02/03 em mono, título em sans bold, descrição.
  - `Pricing.tsx` — 3 cards (Básico R$49,90 / Intermediário R$400 / Avançado R$799). Card do meio com borda Navy mais espessa. Lista de features por tier. CTA por card.
  - `ManifestoFooter.tsx` — bloco escuro (Ink) com "Volume é *verdade*. Carga é *compromisso*. Progressão é *prova*." em Fraunces italic large. Wordmark + links secundários + copyright.
- **`src/pages/Landing.tsx`** — compõe as seções acima.
- **`src/App.tsx`**: criar `RootRoute` — se `loading` mostra loader, se `user` faz o redirect por role (lógica atual de `RoleRedirect`), se não, renderiza `<Landing />`. Substituir `<Route path="/" element={<RoleRedirect />} />`.
- **`src/pages/Index.tsx`** — deletar (não usado).

### 3. Redesign do chrome interno
- **`src/components/AppSidebar.tsx`**: aplicar paleta nova — Paper Warm como fundo, divisores Line, item ativo com barra esquerda Navy 2px + fundo Paper, label em Inter 500, ícones lucide em Ink 70%. Wordmark "SET" no topo em Fraunces. Group labels em JetBrains Mono uppercase 11px tracking-wider muted.
- **`src/components/AppLayout.tsx`**: topbar mais alto (56px), border-bottom Line, breadcrumb mono opcional, espaçamento generoso (px-8 py-6 no main).
- **`src/components/ui/button.tsx`** (variants): ajustar `default` para Navy sólido com hover Navy 90%, `outline` com border Line + texto Ink, adicionar variant `editorial` (texto + seta unicode, sem fundo).
- **`src/components/ui/card.tsx`**: card com `bg-paper-warm` e `border-line`, sem sombra.

### 4. Atualização de memória
Atualizar `mem://index.md` Core: trocar "Dark theme default. Primary 220 70% 45%. Bebas Neue headings, Inter body." por "Light/Paper default (#FAFAF7). Set Navy primary (#1D2D5C, HSL 223 53% 27%). Fraunces display italic, Inter body, JetBrains Mono para dados. Tom editorial e técnico — sem motivacional."

## Fora de escopo (não vou mexer)

- Layout interno de páginas (StudentsManager, WorkoutBuilder, Dashboard…) — apenas herdam novos tokens.
- Auth/login UI além da aplicação automática dos tokens.
- Conteúdo de pricing além dos 3 tiers já citados (sem features por tier validadas com você — vou usar a descrição resumida do project knowledge).
- Dark mode toggle — fica para depois (o ThemeContext continua, mas default vira light).

## Referência

O repo `taste-skill` que você citou usa estética editorial parecida (serif + mono + paleta restrita); vou seguir o espírito (mucha typography, pouca cor, animações sutis) sem copiar componentes.

## Verificação

Depois de aplicar: navegar para `/` (deslogado), conferir hero/diferenciais/pricing/footer; entrar no `/admin` logado e conferir sidebar/topbar com nova paleta. Checar console de erros e ajustar contraste se algum token quebrar.