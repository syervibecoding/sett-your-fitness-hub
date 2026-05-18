## Objetivo

1. Separar o acesso na landing em dois caminhos: **Sou Aluno** e **Sou Treinador**, passando o papel via query string para `/auth`.
2. Substituir o logo antigo da BN (`@/assets/bn-logo.png`) pelo novo `<Logo />` em `Auth.tsx`, `PublicRegistration.tsx` e `PublicAnamnesis.tsx`.

---

## Parte 1 — CTAs na landing

### LandingNav (`src/components/landing/LandingNav.tsx`)
Substituir o único botão "Acessar →" por dois links discretos no padrão editorial:

- `Sou Aluno` → `/auth?as=student`
- `Sou Treinador` → `/auth?as=trainer` (visualmente destacado, borda preenchida)

Em mobile (< sm), colapsar em um único botão "Acessar" que abre menu ou só prioriza "Sou Treinador" — manter simples mostrando ambos como pílulas pequenas.

### Hero (`src/components/landing/Hero.tsx`)
Trocar o atual "Começar agora" por **dois CTAs lado a lado**:

- Primário (Navy preenchido): `Sou Treinador — começar agora` → `/auth?as=trainer`
- Secundário (borda Ink): `Sou Aluno — acessar meu treino` → `/auth?as=student`

Manter "Ver planos" como link âncora menor abaixo.

### Pricing (`src/components/landing/Pricing.tsx`)
CTAs dos 3 tiers passam a apontar para `/auth?as=trainer` (planos são para treinadores).

### ManifestoFooter
Adicionar dois links discretos no final: "Sou Aluno" / "Sou Treinador" apontando para `/auth?as=...`.

---

## Parte 2 — Auth lê o parâmetro

### `src/pages/Auth.tsx`
- Ler `searchParams.get('as')` ('student' | 'trainer') na montagem.
- Usar para:
  - Pré-selecionar a aba **Login** (default) e mostrar um eyebrow no topo: "Acesso do Aluno" ou "Acesso do Treinador".
  - No fluxo de **cadastro** (se a tab "Cadastrar" existir lá), pré-marcar o tipo de conta. Se Auth.tsx hoje só faz login (cadastro de treinador é via outro caminho/onboarding de empresa), apenas o eyebrow visual + sem mudança funcional.
- O roteamento pós-login continua orientado por `role` real no banco (não confia no query param) — o `as` é apenas contexto visual.

---

## Parte 3 — Troca de logo

### `src/pages/Auth.tsx` (linhas 10, 57)
Remover `import bnLogo` e substituir o `<img>` pelo componente:
```tsx
<Logo size="lg" sublabel="Training App" />
```

### `src/pages/PublicRegistration.tsx` (linhas 12, 72, 73, 183)
- Remover `import bnLogo`.
- `logoSrc = branding?.logo_url || null` (sem fallback para o asset antigo).
- `titleText` fallback passa a ser `"Set Training App"`.
- Se `branding?.logo_url` existir, mantém `<img>` (logo da empresa). Caso contrário, renderiza `<Logo size="lg" sublabel={titleText} />`.

### `src/pages/PublicAnamnesis.tsx` (linhas 13, 48, 85, 178)
- Mesma estratégia: estado `logoSrc` inicia `null`; só seta quando vem do branding da empresa. Fallback usa `<Logo />`.

### Asset
Não deletar `src/assets/bn-logo.png` ainda (pode ter referências residuais). Marcar para limpeza futura.

---

## Detalhes técnicos

- Todos os links usam `<Link to="/auth?as=trainer">` do `react-router-dom`.
- Não há mudança de lógica de auth/role no backend — o redirecionamento pós-login continua sendo decidido por `role` real.
- Tokens: continuar usando `bg-navy`, `text-paper`, `border-foreground`, `text-eyebrow` — sem cores hardcoded.
- Acessibilidade: cada CTA com `aria-label` claro ("Acessar como aluno", "Acessar como treinador").
