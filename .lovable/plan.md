

# Novo Visual do Portal do Aluno — Tela Inicial com Menu

## Situação Atual
Após o login, o aluno cai direto no treino com tabs "Treino" e "Estatísticas". Tudo em uma única página monolítica (`StudentPortal.tsx` — 723 linhas).

## Nova Experiência

Após o login, o aluno vê uma **tela inicial (Home)** com saudação e cards grandes para navegar:

```text
┌────────────────────────────┐
│  Olá, João!                │
│  Plano X • Ciclo 3 (Atual) │
│  ████████████░░░ 72%       │
├────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ │
│  │ 🏋️ TREINO │ │ 📊 STATS │ │
│  │  Treino A │ │ Volume   │ │
│  │  do dia   │ │ e força  │ │
│  └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ │
│  │ 📅 CALEN │ │ 📜 HIST. │ │
│  │ Agenda   │ │ Sessões  │ │
│  │ semanal  │ │ passadas │ │
│  └──────────┘ └──────────┘ │
└────────────────────────────┘
```

Cada card navega para uma "view" dentro do portal (mantendo tudo no `StudentPortal.tsx` com state interno, sem novas rotas).

## Plano Técnico

### 1. Criar estado de navegação interna
Adicionar `activeView: "home" | "treino" | "stats" | "calendario" | "historico"` ao `StudentPortal.tsx`. Default: `"home"`.

### 2. Criar componente `StudentHome.tsx`
Nova tela inicial com:
- Saudação com nome do aluno
- Barra de progresso do plano
- Grid 2x2 de cards com ícones grandes (Treino, Estatísticas, Calendário, Histórico)
- Card de Treino mostra qual treino é do dia
- WeeklyBar integrado

### 3. Criar componente `StudentCalendar.tsx`
Calendário visual mostrando os dias de treino da semana (quais treinos em quais dias), baseado no `day_of_week` dos workouts.

### 4. Criar componente `StudentHistory.tsx`
Lista de sessões passadas agrupadas por data, mostrando qual treino foi feito, duração e volume total.

### 5. Refatorar `StudentPortal.tsx`
- Extrair a lógica de treino atual para continuar funcionando como view "treino"
- Extrair estatísticas como view "stats" (já usa `StatsCharts`)
- Adicionar header com botão voltar quando não está na home
- Manter toda a lógica de dados existente (logs, cycles, etc.)

### Arquivos
- **Novo**: `src/components/student/StudentHome.tsx`
- **Novo**: `src/components/student/StudentCalendar.tsx`
- **Novo**: `src/components/student/StudentHistory.tsx`
- **Modificado**: `src/pages/student/StudentPortal.tsx`

Sem mudanças no banco de dados ou rotas.

