

# Remover lógica de `day_of_week` — Treinos não são fixados em dias

## Problema
O sistema assume que o treinador atribui treinos a dias da semana (`day_of_week`). Na realidade, o treinador apenas prescreve Treino A, B, C, D etc. O aluno escolhe quando fazer cada treino. Isso afeta:
- **WeeklyBar**: mostra dias "agendados" baseado em `day_of_week` (que provavelmente é sempre `null`)
- **StudentHome**: mostra "treino de hoje" baseado no dia da semana
- **StudentCalendar**: mapeia treinos a dias da semana no grid mensal

## Solução

### 1. `StudentHome.tsx` — Simplificar
- Remover props `scheduledDays`, `trainedDays`, `currentDayOfWeek`, `todaysWorkoutTitle`
- Adicionar props: `workoutCount` (total de treinos no ciclo), `weeklySessionCount` (sessões feitas esta semana)
- Card "Treino" mostra "X treinos disponíveis" em vez de "Treino A hoje"
- Remover `WeeklyBar` da home (ou substituir por um resumo simples: "2 sessões esta semana")

### 2. `WeeklyBar.tsx` — Refatorar para mostrar sessões reais
- Em vez de mostrar dias "agendados" vs "treinados", mostrar apenas os dias que o aluno realmente treinou esta semana (marcados com ✅)
- Remover conceito de `scheduledDays`
- Props simplificadas: `trainedDays: Set<number>`, `currentDayOfWeek: number`

### 3. `StudentCalendar.tsx` — Baseado em logs reais
- Remover mapeamento `workoutByDow` (que liga treino a dia da semana)
- Dias com treino registrado (logs com `session_date`) ficam verdes com ✅
- Ao clicar num dia treinado: mostrar qual treino foi feito (buscar `workout_id` dos logs daquele dia) e os detalhes
- Ao clicar num dia sem treino: mostrar lista dos treinos disponíveis no ciclo com botão "Iniciar treino"
- Remover indicador de "treino prescrito" por dia da semana (o dot azul)

### 4. `StudentPortal.tsx` — Limpar computações
- Remover `scheduledDays` (useMemo baseado em `day_of_week`)
- Remover `todaysWorkoutTitle` (baseado em `day_of_week`)
- Simplificar `trainedDays` 
- Atualizar props passadas aos componentes filhos

### Arquivos
- **Modificado**: `src/components/student/StudentHome.tsx`
- **Modificado**: `src/components/student/WeeklyBar.tsx`
- **Modificado**: `src/components/student/StudentCalendar.tsx`
- **Modificado**: `src/pages/student/StudentPortal.tsx`

Sem mudanças no banco de dados.

