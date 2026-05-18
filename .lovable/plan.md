## Aplicar logo Set Training App

### 1. Adicionar o arquivo
- Copiar `user-uploads://Logo_Settapp.jpg` para `src/assets/logo-set.png` (mantendo PNG para uso com fundo claro/escuro).
- Como o logo original tem traço Navy + Ink em fundo branco, ele funciona perfeitamente sobre Paper (`#FAFAF7`). Para o footer Ink (fundo escuro), criar/exportar uma variação em branco via CSS (`filter: invert + brightness`) ou usar o mesmo arquivo com `mix-blend-mode`.

### 2. Componente reutilizável `<Logo />`
Criar `src/components/Logo.tsx` com props `size` (sm/md/lg) e `variant` (default/inverted) — encapsula `<img>` + wordmark "Set" em Fraunces italic ao lado.

### 3. Pontos de aplicação
- **LandingNav** — substitui o atual texto "Set" pelo símbolo + wordmark.
- **ManifestoFooter** — versão invertida (branca) sobre Ink.
- **AppSidebar** (header do sidebar interno) — símbolo + "Set" no topo.
- **Auth, PublicRegistration, PublicAnamnesis** — substitui qualquer placeholder textual.
- **index.html favicon** — copiar também para `public/favicon.png` e atualizar `<link rel="icon">`. Remover `public/favicon.ico` antigo.

### 4. ThemeContext / AppearanceSettings
- Atualizar `DEFAULTS.logo_url` (se existir) para apontar para o novo asset.
- O `platform_logo_url` salvo no banco continua sobrescrevendo via Appearance — sem mudança de schema.

### Nada de backend/lógica
Mudança puramente visual: assets + 1 componente novo + substituições nos 5 lugares listados.
