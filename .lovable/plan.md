

# Plano: Redesenho do Portal do Aluno

## Contexto
O portal atual (`StudentPortal.tsx`, 717 linhas) tem tabs de Treino e Evolução com input de cargas e histórico básico. A tabela `workout_logs` já possui campos `duration_minutes`, `completed_at` e `exercises_data` que estão prontos mas não utilizados. Faltam: cronômetro de treino, resumo pós-treino, e estatísticas avançadas com body map.

---

## Etapa 1: Nova tabela `workout_sessions` + migração

Criar tabela dedicada para sessões de treino (separada dos logs por série):

```sql
CREATE TABLE workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  workout_id uuid NOT NULL REFERENCES workouts(id),
  company_id uuid,
  session_date date DEFAULT CURRENT_DATE,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  total_volume numeric DEFAULT 0,      -- peso × reps total
  total_sets_completed integer DEFAULT 0,
  status text DEFAULT 'in_progress',   -- in_progress | completed | abandoned
  notes text,
  created_at timestamptz DEFAULT now()
);
-- RLS: student own + company scoped + master full
```

Isso separa a "sessão" (cronômetro, duração, resumo) dos "logs por série" já existentes.

---

## Etapa 2: Cronômetro de Treino

**Novo componente `WorkoutTimer.tsx`**

- Botão "Iniciar Treino" cria um `workout_session` com `started_at = now()` e `status = in_progress`
- Cronômetro visível no topo (hh:mm:ss), persistente enquanto navega entre exercícios
- Timer de descanso entre séries: ao preencher uma série, inicia contagem regressiva do tempo de descanso prescrito (ex: 60s)
- Vibração/som ao fim do descanso
- Botão "Finalizar Treino" → salva `completed_at`, calcula `duration_seconds`, muda status para `completed`
- Estado do cronômetro persiste via `localStorage` (para não perder se fechar o app)

---

## Etapa 3: Resumo Pós-Treino

**Novo componente `WorkoutSummary.tsx`** — Modal/tela exibida ao finalizar:

- Duração total (ex: "47min 23s")
- Volume total (tonelagem = Σ peso × reps)
- Séries completadas vs prescritas (ex: "18/20")
- PRs batidos (novos recordes de carga por exercício, comparando com sessões anteriores)
- Lista de exercícios com resumo compacto (peso máx, volume)
- Botão "Compartilhar" (screenshot / texto para WhatsApp)
- Dados salvos no `workout_sessions` para consulta futura

---

## Etapa 4: Redesenho da Tab "Treino"

Refatorar `StudentPortal.tsx` para experiência mobile-first otimizada:

- **Antes de iniciar**: tela mostra treinos A/B/C/D com preview (exercícios, séries) — botão "Iniciar" em cada
- **Durante treino**: cronômetro fixo no topo, exercícios como cards expansíveis com inputs de carga/reps por série, indicador de série completada (checkbox), timer de descanso integrado
- **Indicadores visuais de progressão**: seta verde ↑ quando carga > última sessão, seta vermelha ↓ quando menor
- **Auto-preenchimento**: ao expandir uma série, pré-preenche com valores da última sessão (editáveis)

---

## Etapa 5: Tab "Estatísticas" Avançadas

Substituir a tab "Evolução" atual por uma mais completa com 3 sub-seções:

### 5a. Body Map (Volume por Grupamento)
- Silhueta SVG do corpo humano (frente + costas)
- Cada grupo muscular colorido por intensidade de volume (escala de cor: frio → quente)
- Baseado nos dados de `exercise_muscle_targets` (já existente) × logs executados
- Período selecionável (semana atual, ciclo atual, último mês)

### 5b. Evolução de Carga
- Gráfico de linha por exercício (já existe, melhorar)
- Filtro por exercício específico
- Indicador de PR por exercício

### 5c. Volume e Frequência
- Gráfico de barras: tonelagem por semana/ciclo
- Frequência de treino (dias treinados por semana)
- Séries por grupamento muscular (volume semanal vs recomendado)

---

## Etapa 6: Visão do Treinador (Volume Executado vs Prescrito)

**No `StudentDetail.tsx`** (painel admin), adicionar nova seção:

- Tabela comparativa: volume prescrito (séries × exercícios) vs volume executado (logs reais)
- Por grupamento muscular: séries prescritas vs séries feitas
- Aderência ao treino: % de sessões completadas no período
- Alertas: grupamentos sub-treinados (< 10 séries/semana) ou super-treinados (> 20)

---

## Estrutura de Arquivos

```text
src/components/student/
  WorkoutTimer.tsx          -- Cronômetro + timer descanso
  WorkoutSummary.tsx        -- Modal resumo pós-treino
  BodyMap.tsx               -- SVG body map com heat map
  ExerciseCard.tsx          -- Card de exercício com inputs
  RestTimer.tsx             -- Countdown de descanso
  StatsCharts.tsx           -- Gráficos de evolução/volume

src/hooks/
  useWorkoutSession.ts      -- Hook gerenciando sessão ativa

src/pages/student/
  StudentPortal.tsx          -- Refatorado (orquestrador)
```

---

## Detalhes Importantes

- A tabela `exercise_muscle_targets` já mapeia exercício → grupamento muscular com `volume_percentage`, essencial para o body map
- Os campos `duration_minutes`, `completed_at`, `exercises_data` em `workout_logs` podem ser depreciados em favor da nova `workout_sessions`
- O body map SVG será criado inline (sem dependência externa), com ~15 regiões clicáveis mapeadas aos `muscle_groups` do banco
- Timer de descanso usa `ex.rest` (já prescrito como "60s", "90s" etc.)
- `localStorage` key: `sett_active_session_{student_id}` para persistir estado do cronômetro

