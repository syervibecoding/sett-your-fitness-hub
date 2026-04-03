

# Plano: Adicionar Tipo de Série, Check por Série, Adicionar Séries e PSE

## Resumo
Baseado nas imagens de referência, adicionar 4 funcionalidades ao portal do aluno e à prescrição do treinador:

1. **Tipo de série** — W (Aquecimento), Normal (1,2,3...), F (Falhada), D (Drop)
2. **Check por série** — Botão de checkmark individual por linha
3. **Adicionar/Remover séries** — Aluno pode adicionar séries extras além das prescritas
4. **PSE (Percepção de Esforço)** — Campo de RPE por série

## Mudanças

### 1. Migração SQL — novos campos em `workout_logs`
- Adicionar coluna `set_type` (text, default `'normal'`) — valores: `warmup`, `normal`, `failure`, `drop`
- Adicionar coluna `rpe` (smallint, nullable) — valor de PSE (1-10)
- Adicionar coluna `completed` (boolean, default false) — check individual

```sql
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS set_type text DEFAULT 'normal';
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rpe smallint;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;
```

### 2. ExerciseCard.tsx — redesign da tabela de séries
- Mudar grid de `[Série, Peso, Reps, icon]` para `[Série, Anterior, KG, Reps, PSE, ✓]` (como na imagem)
- O label da série mostra o tipo: **W** (amarelo), **1,2,3** (branco), **F** (vermelho), **D** (azul)
- Tocar no label da série abre um bottom sheet/drawer "Selecionar Tipo de Série" com opções:
  - W — Série de Aquecimento
  - 1 — Série Normal
  - F — Série Falhada
  - D — Série Drop
  - X — Remover Série
- Botão **PSE** por linha que abre seleção rápida (1-10)
- Botão **✓** (checkmark) que marca a série como concluída (fica verde quando checked, dispara rest timer)
- Botão **+ Adicionar Série** no final da lista

### 3. StudentPortal.tsx — gerenciar séries dinâmicas
- Estado `extraSets` para rastrear séries adicionadas pelo aluno além das prescritas
- Atualizar `updateLog` para aceitar campos `set_type`, `rpe`, `completed`
- Atualizar `saveCurrentLogs` para salvar os novos campos
- Séries adicionadas pelo aluno são salvas no `workout_logs` com `set_number` incremental

### 4. WorkoutBuilder.tsx — tipo de série na prescrição
- Na prescrição, permitir que o treinador defina o tipo de cada série (ex: 1 warmup + 3 normais + 1 drop)
- Adicionar ao `WorkoutExercise` um campo opcional `set_types: string[]` (ex: `["warmup", "normal", "normal", "normal"]`)
- UI: ao lado do número da série, dropdown/select para tipo

### 5. useWorkoutSession.ts — incluir novos campos no summary
- `finishSession` deve considerar `set_type` e `rpe` nos dados do `exercisesSummary`

## Detalhes Técnicos

**Estrutura de tipos de série:**
```typescript
type SetType = 'warmup' | 'normal' | 'failure' | 'drop';

const SET_TYPE_CONFIG = {
  warmup:  { label: 'W', color: 'text-yellow-400', name: 'Série de Aquecimento' },
  normal:  { label: '1', color: 'text-foreground', name: 'Série Normal' },
  failure: { label: 'F', color: 'text-red-400',    name: 'Série Falhada' },
  drop:    { label: 'D', color: 'text-blue-400',   name: 'Série Drop' },
};
```

**Layout da linha (mobile-first):**
```text
SÉRIE  ANTERIOR  ⊕KG  REPS  PSE  ✓
  W      -       10   12   PSE  ☑
  1      -       10   10   PSE  ☑
  2     10×10    10   10   PSE  ☐
  3     10×8     10    8   PSE  ☐
       [+ Adicionar Série]
```

## Arquivos alterados
- Nova migração SQL: `set_type`, `rpe`, `completed` em `workout_logs`
- `src/integrations/supabase/types.ts` — tipos atualizados automaticamente
- `src/components/student/ExerciseCard.tsx` — redesign completo da tabela de séries
- `src/pages/student/StudentPortal.tsx` — estado de séries extras, novos campos no log
- `src/pages/admin/WorkoutBuilder.tsx` — tipo de série na prescrição
- `src/hooks/useWorkoutSession.ts` — novos campos no summary

