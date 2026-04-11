

# Calendário em formato Agenda com detalhes ao clicar

## Situação Atual
O `StudentCalendar` já mostra uma agenda semanal, mas ao clicar num dia com treino, ele navega para a view "Treino" (muda de tela). O usuário quer clicar no dia e ver os detalhes do treino **ali mesmo**, sem sair do calendário.

## Nova Experiência

Ao clicar num card de dia que tem treino, ele **expande** mostrando:
- Nome do treino
- Lista de exercícios com séries × repetições
- Se já treinou naquele dia: carga e reps realizadas
- Botão "Ir para o treino" para abrir na view treino

```text
┌─────────────────────────────────┐
│ [Seg] Segunda                 ✅ │
│  Treino A • 6 exercícios        │
├─────────────────────────────────┤
│  1. Agachamento — 4×12          │
│     Último: 80kg × 12           │
│  2. Leg Press — 3×15            │
│     Último: 120kg × 15          │
│  ...                            │
│  [Ir para o treino →]           │
└─────────────────────────────────┘
│ [Ter] Terça                   🏋️ │  ← colapsado
│  Treino B • 5 exercícios        │
```

## Plano Técnico — `StudentCalendar.tsx`

### 1. Adicionar estado de dia expandido
`expandedDay: number | null` — ao clicar num card, expande/colapsa.

### 2. Receber logs do treino como prop
Adicionar prop `allLogs` para mostrar a última carga registrada de cada exercício.

### 3. Expandir card com detalhes
Quando expandido, mostrar lista de exercícios do treino daquele dia:
- Nome do exercício e grupo muscular
- Séries × Reps prescritas
- Último registro de carga (se houver)

### 4. Botão "Ir para o treino"
Mantém o `onSelectWorkout` existente como ação secundária dentro do card expandido.

### 5. Atualizar `StudentPortal.tsx`
Passar `allLogs` como prop para `StudentCalendar`.

### Arquivos
- **Modificado**: `src/components/student/StudentCalendar.tsx`
- **Modificado**: `src/pages/student/StudentPortal.tsx` (apenas passar nova prop)

