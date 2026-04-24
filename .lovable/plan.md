

## Estatísticas do Syer estão fracas — diagnóstico e correção

### Causa raiz

O Syer tem **13 sessões registradas** (24/03 → 20/04) com progressão real de carga (ex: Supino 60→67,5kg; Agachamento 80→87,5kg). Os dados estão ótimos. Os gráficos é que estão errados:

**1. BodyMap vazio** — Todos os exercícios dos 3 treinos do Syer estão com `muscle_group = NULL` no JSONB de `workouts.exercises`. O `BodyMap.tsx` depende desse campo para colorir as regiões. Sem ele, nenhum músculo acende. Os nomes dos treinos têm a info ("Peito/Tríceps", "Costas/Bíceps", "Pernas") mas isso não é lido.

**2. Gráficos "horríveis" — agrupados por ciclo, não por sessão** — `StatsCharts.tsx` (linhas 41-77) faz `cycles.map(c => ...)` retornando um ponto **por ciclo**. O Syer só tem 1 ciclo → "Evolução de Carga" mostra **1 ponto** e "Tonelagem por Ciclo" mostra **1 barra**. Visualmente é uma linha reta sem informação. A progressão sessão-a-sessão (que existe e é o ouro do dado) é jogada fora.

### Correções

**A. Backfill dos `muscle_group` dos exercícios do Syer (migração)**

Atualizar o JSONB `workouts.exercises` dos 3 treinos do Syer preenchendo `muscle_group` por nome de exercício, usando lookup na `exercise_library` (ou inferindo do nome quando não houver match):

| Exercício | muscle_group |
|---|---|
| Supino Reto Barra | Peitoral |
| Elevação Lateral Halteres | Deltoides |
| Rosca Direta | Bíceps |
| Puxada Frontal | Costas |
| Levantamento Terra | Costas |
| Agachamento Livre | Quadríceps |
| Leg Press 45 | Quadríceps |

Migração `UPDATE workouts SET exercises = ...` mirando os 3 workout IDs já identificados.

**B. Trigger preventivo (migração)**

Criar `set_workout_exercise_muscle_group()` BEFORE INSERT/UPDATE em `workouts`: para cada item do array `exercises` que estiver com `muscle_group` vazio/null, buscar de `exercise_library` por nome (case-insensitive). Garante que isso não se repita em treinos futuros, independente do builder.

**C. Reformar `StatsCharts.tsx` para granularidade por sessão**

- **Aba "Carga" (evolução)**: trocar o eixo X de "ciclo" para **data de sessão**. Para cada `session_date` distinto em `allLogs`, plotar o **maior peso** por exercício. Dropdown "Todos exercícios" passa a mostrar os 3-5 com mais sessões. Vai exibir 13 pontos com curva clara de progressão.
- **Aba "Volume" (tonelagem)**: trocar de "por ciclo" para **por sessão** (barras), mantendo "C{n}" só como agrupamento visual opcional. Adicionar card extra "Tonelagem total acumulada" e "Tonelagem média/sessão".
- Adicionar fallback: se houver muitas sessões (>20), agrupar por semana (`YYYY-WW`).
- Resumo (cards inferiores): manter "Sessões registradas" e "PRs", adicionar "Tonelagem total (kg)" e "Maior PR".

**D. Remover aluno duplicado do Syer (migração)**

Existem 2 students "Syer Rodrigues de Souza Filho" (`b7f23db8…` sem dados, `3cb1cfae…` com 145 logs). Apagar o vazio `b7f23db8…` (delete cascata na enrollment órfã).

### Resultado esperado

- BodyMap acende Peitoral, Deltoides, Bíceps, Costas e Quadríceps com cores proporcionais à tonelagem.
- "Evolução de Carga" vira uma curva ascendente real (24/03 → 20/04) por exercício.
- "Tonelagem por Sessão" mostra 13 barras ao invés de 1, evidenciando volume crescente.
- Cards de resumo refletem 13 sessões, ~7 PRs, tonelagem total ~80.000 kg.
- Próximos treinos cadastrados não terão mais `muscle_group` nulo.

### Detalhes técnicos

- **DB tocado**: `workouts` (UPDATE backfill + trigger novo), `students`/`enrollments` (DELETE do duplicado).
- **Arquivos tocados**: `src/components/student/StatsCharts.tsx` (refatoração da agregação por sessão).
- **Não toca**: `BodyMap.tsx` (já funciona, basta ter `muscle_group`), RLS, demais alunos.

