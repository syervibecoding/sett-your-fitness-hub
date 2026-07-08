## Objetivo

Permitir que cada exercício da Biblioteca tenha **mais de uma categoria** (Mobilidade, Controle Motor, Ativação, Core, Performance, Base, Fisioterapia, Máquinas, etc.), já que muitos exercícios servem para várias finalidades. Hoje cada exercício aceita só uma.

## Banco de dados (migração)

Na tabela `exercise_library`:

- Adicionar coluna `categories text[]` com default `'{}'`.
- Backfill: para os 1024 exercícios já categorizados, preencher `categories` com a categoria única atual (ex.: `{maquinas}`, `{mobilidade}`). Os 182 sem categoria ficam com `{}`.
- Manter a coluna `category` existente para compatibilidade; a partir de agora ela guarda a primeira categoria da lista (para não quebrar nada que ainda a leia).

## Tela: Biblioteca de Exercícios (`ExerciseLibrary.tsx`)

**Formulário (criar/editar):**
- Trocar o `Select` único de "Categoria" por uma seleção múltipla — lista de opções (as mesmas de `CATEGORY_LABELS`) onde é possível marcar várias, exibidas como chips/badges clicáveis.
- Ao salvar, gravar o array em `categories` e sincronizar `category` com o primeiro item.
- Ao editar, pré-carregar as categorias marcadas a partir de `categories` (com fallback para `category` em registros antigos).

**Listagem e filtros:**
- Nos cards, exibir todos os badges de categoria do exercício, não só um.
- No filtro "Categoria" do topo, um exercício aparece se **qualquer** uma das suas categorias bater com a selecionada.

## Seletor de exercícios (`ExerciseLibraryPicker.tsx`)

- As abas por categoria (Mobilidade, Controle Motor, Core, etc.) passam a considerar o array: o exercício aparece na aba se a categoria estiver **contida** em `categories`.
- Um mesmo exercício que abrange várias finalidades aparecerá em todas as abas correspondentes.

## Detalhes técnicos

- A migração roda via ferramenta de migração; depois os tipos do Supabase (`types.ts`) são regenerados automaticamente para incluir `categories`.
- Apenas telas de frontend que usam `category` são ajustadas (`ExerciseLibrary.tsx`, `ExerciseLibraryPicker.tsx`). O motor de prescrição e o WarmupGuide não dependem dessa coluna, então não mudam.
- Sem alteração nas regras de acesso (RLS) — a coluna nova herda as políticas já existentes de `exercise_library`.

Sem pré-classificação automática: a marcação de múltiplas categorias nos exercícios existentes será feita manualmente por você conforme necessário.