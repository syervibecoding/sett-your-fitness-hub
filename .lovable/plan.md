

# Prescrever treinos e simular semana do Syer

## Dados existentes
- Aluno: Syer Rodrigues de Souza Filho (`3cb1cfae-...`)
- Enrollment ativo: `e2000001-...-01`
- Ciclo 1: `6fe83096-69d8-4460-b516-1bd2209ef303` (01/mar - 11/abr) — sem treinos ainda
- 461 exercícios na biblioteca, incluindo "Supino Inclinado Halteres" (`5c3558f8-...`)

## O que será feito

### 1. Inserir 5 treinos (A-E) no ciclo 1

Divisão Push/Pull/Legs clássica com foco em hipertrofia:

**Treino A — Peito + Tríceps**
| Exercício | Séries | Reps | Descanso |
|-----------|--------|------|----------|
| Supino Inclinado Halteres | 4 | 8-12 | 90s |
| Supino Reto Barra | 4 | 8-12 | 90s |
| Cross Over Polia Alta | 3 | 12-15 | 60s |
| Crucifixo Inclinado Halteres | 3 | 12-15 | 60s |
| Tríceps Polia Corda | 3 | 12-15 | 60s |
| Tríceps Polia Barra | 3 | 12-15 | 60s |

**Treino B — Costas + Bíceps**
| Exercício | Séries | Reps | Descanso |
|-----------|--------|------|----------|
| Puxada Pronada Polia | 4 | 8-12 | 90s |
| Remada Curvada Pronada Barra | 4 | 8-12 | 90s |
| Remada Baixa Neutra | 3 | 10-12 | 60s |
| Pulldown Unilateral | 3 | 12-15 | 60s |
| Rosca Direta Barra W | 3 | 10-12 | 60s |
| Rosca Martelo Halteres | 3 | 12-15 | 60s |

**Treino C — Quadríceps + Panturrilha**
| Exercício | Séries | Reps | Descanso |
|-----------|--------|------|----------|
| Agachamento Livre | 4 | 8-10 | 120s |
| Leg Press 45 | 4 | 10-12 | 90s |
| Cadeira Extensora | 3 | 12-15 | 60s |
| Afundo Halteres | 3 | 10-12 | 60s |
| Panturrilha em Pé Máquina | 4 | 12-15 | 45s |

**Treino D — Ombros + Tríceps**
| Exercício | Séries | Reps | Descanso |
|-----------|--------|------|----------|
| Desenvolvimento Halteres Sentado | 4 | 8-12 | 90s |
| Elevação Lateral Halteres | 4 | 12-15 | 60s |
| Crucifixo Invertido Curvado | 3 | 12-15 | 60s |
| Elevação Frontal Halteres Neutra | 3 | 12-15 | 60s |
| Supino Fechado Barra | 3 | 8-12 | 60s |

**Treino E — Posterior de Coxa + Glúteo**
| Exercício | Séries | Reps | Descanso |
|-----------|--------|------|----------|
| Stiff Barra | 4 | 8-10 | 120s |
| Mesa Flexora | 4 | 10-12 | 60s |
| Cadeira Flexora | 3 | 12-15 | 60s |
| Agachamento Búlgaro | 3 | 10-12 | 90s |
| Panturrilha Sentado Máquina | 4 | 12-15 | 45s |

### 2. Simular 1 semana de treino (workout_logs)
Inserir logs para 5 dias (24/mar a 28/mar — seg a sex):
- Cada log com `exercise_index`, `set_number`, `weight` (cargas realistas), `reps_done`, `session_date`
- Exemplo: Supino Inclinado Halteres — 22kg, 24kg, 26kg, 26kg (4 séries, 10-12 reps)

### Execução técnica
- 5 `INSERT INTO workouts` com o JSONB de exercícios no formato que o WorkoutBuilder usa
- ~90 `INSERT INTO workout_logs` (5 treinos × ~5-6 exercícios × 3-4 séries cada)
- Tudo via `supabase--insert` (dados, não schema)

### Resultado esperado
- O aluno Syer verá os treinos A-E no portal do aluno (`/aluno/treino/{studentId}`)
- Os logs aparecerão como histórico de treinos realizados
- O volume semanal por grupamento muscular será calculado automaticamente no WorkoutBuilder

