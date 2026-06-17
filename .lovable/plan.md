# Redesenho — Prescrição de Treinos

A tela atual (`/admin/prescriptions`) mistura fontes fora do padrão (`Bebas Neue`), tem hierarquia visual fraca e os cards de ciclo/treino ficam genéricos. O objetivo é deixá-la mais harmônica, respeitando o sistema de design já consolidado: **Paper (#FAFAF7) + Navy (#1D2D5C) + Ink**, **Fraunces** para acentos display, **Inter** para corpo e **JetBrains Mono** para eyebrows/dados.

Sem mudar nenhuma lógica de dados, queries ou navegação — apenas a camada visual e de layout.

## O que muda

### 1. Cabeçalho da página
- Trocar o título `Bebas Neue` por uma estrutura coerente: eyebrow mono ("PRESCRIÇÃO") + título em Inter peso semibold, com um destaque em Fraunces italic ("Treinos").
- Adicionar uma linha divisória sutil (`border-line`) abaixo, dando respiro.

### 2. Coluna de alunos (esquerda)
- Campo de busca mantém posição, mas com visual mais limpo e alinhado aos inputs do app.
- Cards de aluno mais enxutos: nome em destaque, plano + contagem de treinos como metadado mono discreto, e um indicador de "treinos" como chip pequeno.
- Estado selecionado mais claro (faixa lateral Navy + fundo paper-warm) em vez do `bg-primary/5` atual.
- Estados de loading/vazio com espaçamento consistente.

### 3. Detalhe do aluno (direita)
- Cabeçalho do aluno com nome em Fraunces/Inter, plano como eyebrow mono e um resumo (total de ciclos / total de treinos) em linha de métricas.
- Cards de ciclo redesenhados:
  - Faixa de status com cor semântica (`success` para ativo, `muted` para futuro, neutro para concluído) em vez do badge genérico.
  - Período do ciclo em mono, alinhado à direita.
  - Lista de treinos como itens em "trilho" limpo (sem o `bg-secondary/30` quebrado), com número do treino (A, B, C…), título e contagem de exercícios.
  - Botão de ação (Prescrever / Editar) com hierarquia clara.
- Estado vazio (sem ciclos / sem aluno selecionado) com ilustração tipográfica mais elegante e centrada.

### 4. Consistência de tokens
- Remover todos os usos de `Bebas Neue` e `font-sans` redundantes nesta tela.
- Usar exclusivamente tokens semânticos (`text-foreground`, `text-muted-foreground`, `border-line`, `bg-card`, `text-primary`) e as utilidades `.font-display`, `.text-eyebrow`, `.font-mono-data`.

## Fora de escopo
- Nenhuma alteração em queries Supabase, RLS, rotas ou na lógica de ciclos/treinos.
- Sem mudanças na tela de montagem de treino (`WorkoutBuilder`).

## Detalhes técnicos
- Arquivo único: `src/pages/admin/WorkoutPrescriptions.tsx`.
- Reuso de componentes existentes: `Card`, `Badge`, `Button`, `Input`, `ScrollArea`, `Skeleton` e ícones `lucide-react` já importados.
- Cores de status via tokens já existentes em `index.css` (`--success`, `--warning`, `--muted-foreground`).
- Layout mantém o grid `lg:grid-cols-3` (1 coluna alunos / 2 colunas detalhe), responsivo em telas menores.
