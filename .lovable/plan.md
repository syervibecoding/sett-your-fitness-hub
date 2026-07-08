# Seletor de biblioteca unificado na Prescrição

## Problema
Na etapa **"4. Editar treino"** da Prescrição (`UnifiedPrescriber`), os exercícios só podem ser digitados em campos de texto. Não existe o seletor da biblioteca com abas por categoria, filtro por região, multi-seleção, agrupamentos (bi-set/tri-set/etc.), painel BNITO nem limitações da anamnese — recursos que só estão no Montar Treino (`WorkoutBuilder`), e mesmo lá com um visual diferente do desejado.

## Objetivo
1. Criar **um seletor de biblioteca reutilizável** com o visual da referência: abas de categoria, chip de região muscular, grade de cards com miniatura de vídeo e rodapé de multi-seleção.
2. Usar esse seletor **na Prescrição e no Montar Treino** (padronização).
3. Trazer para a Prescrição **todos os recursos**: multi-seleção, agrupamentos, BNITO (placeholder) e limitações reais da anamnese.

## Componentes a criar

### 1. `src/components/trainer/ExerciseLibraryPicker.tsx` (novo)
Diálogo reutilizável de seleção de exercícios.
- **Abas de categoria** (a partir do campo `category` de `exercise_library`): Todos, Mobilidade, Controle Motor, Ativação, Core, Performance, Base, Fisioterapia, Pesos Livres, Peso Corporal, Máquinas, Pliometria (rótulos amigáveis mapeados dos valores do banco).
- **Chip de região muscular** (Peitoral, Dorsal, etc.) com botão "Limpar" — usa o mapeamento `bodyMap` já existente; opção de manter o boneco anatômico atrás de um botão "Selecionar pelo boneco".
- **Busca** por nome.
- **Grade de cards** com miniatura (`thumbnail_url`/capa do vídeo via `exerciseCover`), nome, badge de músculo e checkbox de seleção; item já adicionado fica esmaecido.
- **Rodapé fixo**: "N exercício(s) selecionado(s)" + botão "Adicionar (N)".
- Recebe `alreadyAddedIds` e dispara `onAdd(exercises[])`; não conhece o modelo de treino (reutilizável).

### 2. `src/hooks/useStudentLimitations.ts` (novo)
Extrai a lógica de carregar `student_body_limitations` (já usada no WorkoutBuilder) para reuso na Prescrição.

## Alterações

### `src/pages/admin/WorkoutBuilder.tsx`
- Substituir o diálogo de biblioteca atual pelo `ExerciseLibraryPicker`, mantendo `addSelectedExercises`.
- Reaproveitar `useStudentLimitations`.

### `src/pages/admin/UnifiedPrescriber.tsx` (etapa "Editar treino")
- Adicionar botão **"Adicionar da biblioteca"** por treino, abrindo o `ExerciseLibraryPicker`; os exercícios escolhidos entram em `editableWorkouts[wi].exercises` já com `exercise_id`, `exercise_name`, `muscle_group`, `video_url`, `video_path` (os campos de texto manuais continuam disponíveis para ajustes).
- Adicionar a **barra de agrupamento** (aparece com 2+ exercícios marcados): Bi-set, Tri-set, Super-set, Série gigante, Circuito + Desagrupar, com tooltip explicativo de cada técnica. Grava `group_id`/`group_type` em cada exercício.
- Adicionar **card BNITO — Copiloto técnico** (placeholder, botão "Auditar treino" desabilitado, sem chamada de IA).
- Adicionar **painel de limitações** (somente leitura) via `useStudentLimitations`, destacando limitações severas.
- Ajustar `publishWorkout` para gravar também `group_id` e `group_type` no JSONB de `workouts.exercises`, garantindo que os agrupamentos apareçam no app do aluno (já suportado no `StudentPortal`).

## Detalhes técnicos
- Sem migração de banco: `category`, `thumbnail_url` e `video_*` já existem em `exercise_library`; agrupamentos ficam no JSONB de `workouts.exercises`.
- Modelo de dados da Prescrição (`sets` número, `rest_seconds`, `cues`) é preservado; o picker preenche apenas identidade do exercício, mídia e agrupamento.
- Reuso de helpers existentes: `bodyMap` (região), `exerciseCover` (capa), `GROUP_DEFS` (movido para módulo compartilhado, ex.: `src/lib/workoutGroups.ts`, e importado nos dois lugares).
- Sem alterações de RLS, edge functions ou conexão real do BNITO.

## Fora de escopo
- Conectar o BNITO a uma IA (segue placeholder).
- Redesenhar as demais etapas da Prescrição.
