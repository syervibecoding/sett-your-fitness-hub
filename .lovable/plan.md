

# Calendário em formato de grade mensal com detalhes ao clicar

## Problema
O calendário atual é uma lista vertical dos 7 dias da semana — parece uma agenda simples, não um calendário real. Todos os dias mostram "Descanso" porque os treinos provavelmente não têm `day_of_week` atribuído ou o ciclo não tem treinos.

## Nova Experiência

Calendário mensal em grid, mostrando o mês atual com as datas do ciclo. Cada dia mostra se teve treino, qual treino era, e se foi completado. Ao clicar num dia, expande um painel com detalhes.

```text
       Abril 2026
 Seg Ter Qua Qui Sex Sáb Dom
       1   2   3   4   5   6
  7   8   9  10  11  12  13
 14  15  16  17  18  19  20
 21  22  23  24  25  26  27
 28  29  30

 ● = treino prescrito  ✅ = treinado
```

Ao clicar num dia com treino → painel abaixo do calendário com:
- Nome do treino
- Lista de exercícios com séries × reps
- Última carga registrada (se houver)
- Botão "Ir para o treino"

## Plano Técnico

### 1. Reescrever `StudentCalendar.tsx`
- Substituir a lista semanal por um grid de calendário mensal
- Usar `date-fns` (já instalado) para gerar dias do mês, navegação entre meses
- Estado: `selectedMonth` (Date) e `selectedDate` (string | null)
- Mapear treinos por `day_of_week` para saber quais dias da semana têm treino prescrito
- Mapear `allLogs` por `session_date` para saber quais datas foram treinadas
- Ao clicar num dia: mostrar painel de detalhes abaixo do grid (exercícios, cargas, botão)
- Botões `<` `>` para navegar entre meses
- Destacar: hoje (ring primary), dias treinados (verde), dias com treino prescrito (dot)

### 2. Atualizar props se necessário
- Adicionar prop `cycleStartDate` e `cycleEndDate` para destacar o período do ciclo no calendário
- `StudentPortal.tsx`: passar essas datas do `selectedCycle`

### Arquivos
- **Reescrito**: `src/components/student/StudentCalendar.tsx`
- **Modificado**: `src/pages/student/StudentPortal.tsx` (passar datas do ciclo)

