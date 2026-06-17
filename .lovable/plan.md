## Objetivo

Transformar a tela de prescrição de treino (`src/pages/admin/WorkoutBuilder.tsx`) para exibir **todos os treinos lado a lado em colunas** (estilo quadro/Kanban), em vez de abas que mostram um treino por vez. Assim você visualiza Treino A, B, C... simultaneamente e consegue montar um ligado ao outro, com **rolagem horizontal** quando houver muitos treinos.

## Como vai ficar

```text
┌─────────────────────────────────────────────────────────────┐  ┌──────────┐
│  ◀──── rolagem horizontal ────▶                              │  │ VOLUME   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐ │  │ SEMANAL  │
│ │ Treino A │ │ Treino B │ │ Treino C │ │ Treino D │ │  +  │ │  │ (lateral)│
│ │ ──────── │ │ ──────── │ │ ──────── │ │ ──────── │ │ nova│ │  │          │
│ │ título   │ │ título   │ │ título   │ │ título   │ │coluna│ │  │ barras   │
│ │ descr.   │ │ descr.   │ │ descr.   │ │ descr.   │ │     │ │  │ por      │
│ │ [exerc.] │ │ [exerc.] │ │ [exerc.] │ │ [exerc.] │ │     │ │  │ músculo  │
│ │ [exerc.] │ │ [exerc.] │ │ [exerc.] │ │ [exerc.] │ │     │ │  │          │
│ │ + Add    │ │ + Add    │ │ + Add    │ │ + Add    │ │     │ │  │          │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────┘ │  └──────────┘
└─────────────────────────────────────────────────────────────┘
```

- Cada treino vira uma **coluna** com largura fixa (≈ 320px), com cabeçalho (título + descrição + botão remover), lista de exercícios e botão "Adicionar exercício".
- Container com **scroll horizontal** quando os treinos não couberem na tela.
- Botão **"+"** para criar nova coluna (novo treino) ao final da fileira.
- A barra lateral de **Volume Semanal** continua igual, fixa à direita (continua somando o volume de todos os treinos).
- O cabeçalho da página (voltar, título, botão Volume, "Salvar Tudo") permanece o mesmo.

## Mudanças técnicas

Arquivo único: `src/pages/admin/WorkoutBuilder.tsx`

1. **Remover o sistema de abas** (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) e o estado `activeTab`/`currentWorkout`/`currentIdx` baseado nele.
2. **Renderizar as colunas**: substituir o bloco de `Tabs` por um wrapper `flex gap-4 overflow-x-auto pb-4`, mapeando `workouts` para colunas com `min-w-[320px] w-[320px] shrink-0`. Cada coluna reaproveita o mesmo conteúdo de detalhes do treino + lista de exercícios já existente.
3. **Adicionar exercício por coluna**: introduzir estado `targetWorkoutIdx` (substitui o uso de `activeTab` em `addExercise`). Cada botão "Adicionar" da coluna define `targetWorkoutIdx` antes de abrir a biblioteca; `addExercise` insere no treino certo. O check de "já adicionado" no diálogo passa a usar `workouts[targetWorkoutIdx]`.
4. **Ajustar o card de exercício** ao espaço mais estreito da coluna: a grade de Séries/Reps/Descanso/Observação passa de 4 colunas para 2 colunas (`grid-cols-2`), mantendo todos os campos e os "Tipos de Série".
5. **Botão de nova coluna**: card vertical fino com ícone `+` (reusa `addWorkout`, mantendo o limite de 7 treinos / labels A–G).
6. Manter intactos: carregamento (`loadExisting`, `loadLibrary`, `loadMuscleTargets`), salvamento (`handleSaveAll`), cálculo de `weeklyVolume`, diálogo da Biblioteca (com o boneco/BodyMap) e o modal de vídeo.

## Comportamento responsivo

- Desktop: várias colunas visíveis, scroll horizontal quando passar da largura.
- Mobile/telas estreitas: as colunas mantêm largura fixa e o usuário rola horizontalmente entre os treinos (a barra de Volume vai para baixo, como já acontece hoje no layout `flex-col lg:flex-row`).

## Fora de escopo

- Nenhuma mudança no banco de dados, na área do aluno ou na lógica de volume.
- Não será adicionado arrastar-e-soltar de exercícios entre treinos nesta etapa (posso fazer depois, se quiser).
