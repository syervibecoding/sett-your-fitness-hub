

# Calendário com detalhes de treino e desempenho

## Problema identificado
O calendário recebe apenas os treinos do ciclo ativo (`selectedCycle.workouts`). Se o aluno navega para um mês anterior, os logs existem mas o componente não encontra o treino correspondente porque ele pertence a outro ciclo. Resultado: clica no dia e não vê nada.

Além disso, o painel de detalhes pode ser enriquecido com mais métricas de desempenho.

## Solução

### 1. Passar todos os treinos de todos os ciclos ao calendário
Em `StudentPortal.tsx`, trocar `selectedCycle.workouts` por todos os workouts de todos os ciclos, para que qualquer log encontre seu treino correspondente.

### 2. Enriquecer o painel de detalhes com desempenho
Quando o aluno clica num dia treinado, mostrar:
- Nome do treino
- Cada exercício com: séries completadas / prescritas, melhor carga x reps
- **Volume total da sessão** (soma de peso x reps de todas as séries)
- **Duração da sessão** (se disponível nos `workout_sessions`)
- Badge de comparação: se o volume foi maior/menor que a sessão anterior do mesmo treino

### 3. Passar `workoutSessions` ao calendário
Para mostrar a duração, passar o array de `workout_sessions` como prop adicional.

### Arquivos
- **Modificado**: `src/pages/student/StudentPortal.tsx` — passar `allWorkouts` (de todos os ciclos) e `workoutSessions`
- **Modificado**: `src/components/student/StudentCalendar.tsx` — enriquecer painel com volume total, séries completadas, duração, e comparação com sessão anterior

