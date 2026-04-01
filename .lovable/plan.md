

# Plano: Desvincular WeeklyBar do tipo de treino

## Problema
Atualmente, a barra semanal vincula cada dia da semana a um treino específico. Se o aluno perder um dia, não consegue repor o treino perdido — ele fica preso ao treino do dia. O comportamento correto é: a barra semanal deve servir apenas como **visualização de frequência** (quais dias treinou/não treinou), sem forçar qual treino fazer. O aluno escolhe livremente o treino via as abas (Treino A, B, C...).

## Solução

### 1. WeeklyBar vira componente de frequência (somente leitura)
- Remover o vínculo dia → treino específico
- Mostrar todos os 7 dias (Seg-Dom) como potenciais dias de treino
- Marcar com ✅ os dias que o aluno já treinou na semana (baseado nos logs, independente do workout)
- Destacar o dia atual com anel visual
- **Remover o onClick** que seleciona treino — a barra fica apenas informativa
- Mostrar ícone de haltere nos dias com qualquer treino agendado (baseado em `day_of_week`), mas não bloquear clique

### 2. Manter abas de treino como seletor principal
- As abas (Treino A, B, C, D, E) continuam sendo o meio de seleção do treino
- Auto-seleção inicial: se hoje tem treino agendado, pré-seleciona, senão seleciona o primeiro treino não concluído da semana
- Aluno pode escolher qualquer treino a qualquer momento

### 3. Alterações nos arquivos

**`src/components/student/WeeklyBar.tsx`**
- Simplificar props: receber `trainedDays: Set<number>` (dias com log na semana) e `scheduledDays: Set<number>` (dias com treino agendado)
- Remover `onDayClick`, `selectedDayOfWeek`
- Todos os dias clicáveis removidos — componente fica puramente visual
- Adicionar contador: "3/5 treinos esta semana"

**`src/pages/student/StudentPortal.tsx`**
- Ajustar integração com WeeklyBar simplificado
- Manter abas de treino como seletor principal
- `completedDays` passa a ser calculado por data do log (dia da semana do `session_date`), não pelo `day_of_week` do workout

## Detalhes técnicos
- `completedDays` será calculado pegando o `getDay()` de cada `session_date` dos logs da semana atual, em vez de mapear pelo `day_of_week` do workout
- Isso significa: se o aluno treinou na quarta, a quarta aparece como concluída, independente de qual treino ele fez

