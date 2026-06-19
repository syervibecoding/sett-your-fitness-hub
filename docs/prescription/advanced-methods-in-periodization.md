# Sistemas de treinamento avançados no fallback (ao longo da periodização)

**Pedido do Matheus (2026-06-19):** o fallback determinístico de força deve **conhecer os sistemas de
treinamento avançados** que já existem no app (bi-set, tri-set, super-set, série gigante, circuito,
drop-set, rest-pause, cluster, isometria, pico de contração, pico de alongamento) e **aplicá-los ao
longo da periodização** — *não sempre*, só quando a fase/nível/segurança justificarem.

## O que o claude entregou (pronto p/ plugar)

`supabase/functions/_shared/prescription/advancedMethods.ts` — módulo Deno autocontido, sem dependências:

- `MethodId` + `GROUPING_METHODS`/`SINGLE_METHODS` — **espelham exatamente** `src/lib/workoutMethods.ts`,
  então o app do aluno e do professor **já renderizam** os blocos/badges (`MethodBadge` +
  `groupWorkoutExercises`) sem nenhuma mudança no front.
- `planAdvancedMethods(exercises, ctx)` — recebe os exercícios da sessão + o contexto da semana
  (microciclo, mesociclo, semana, nível, dor) e devolve a lista com `method` / `group_id` /
  `method_seconds` preenchidos conforme a doutrina abaixo. **Determinístico** (sem `random`), não muta a
  entrada.

### Contrato de saída (o que o app lê)
Cada exercício do `workouts.exercises` (jsonb) pode ter:
- `method: MethodId | null` — id do sistema (ex.: `"biset"`, `"dropset"`).
- `group_id: string | null` — agrupa exercícios consecutivos do mesmo bloco (bi-set/tri-set/giant);
  o app junta visualmente quem compartilha `group_id`.
- `method_seconds: number | null` — só p/ isometria/pico (tempo de sustentação).

## Doutrina de aplicação (resumo embutido no módulo)

| Situação | Métodos avançados? |
|---|---|
| Nível **iniciante** | ❌ Nunca (técnica + progressão simples) |
| Microciclo **regenerativo** (deload) | ❌ Nunca (semana de recuperação) |
| Mesociclo **base** | ❌ Nunca (adaptação/técnica) |
| Exercício com **dor / instável** | ❌ Nunca naquele exercício |
| **Acumulação** (ordinário) | ⚠️ Leve: 1 técnica de intensidade (rest-pause/drop-set) na última série de 1 isolador |
| **Intensificação / choque** | ✅ Pode agrupar (bi-set; tri-set/giant só avançado) + drop-set/cluster, em **no máx. 1–2** exercícios |

Regras adicionais:
- **Compostos pesados ficam retos** (agachamento/terra/supino/desenvolvimento/remada). Métodos vão nos
  **acessórios/isoladores**.
- **Troca de estímulo a cada 2 semanas:** o método rotaciona por bloco (semanas 1-2 / 3-4 / 5-6), pra
  variar o estímulo dentro da mesma fase — alinhado à doutrina de periodização já entregue.
- **Intermediário** libera até bi-set + drop-set/rest-pause; **avançado** libera tri-set/giant/cluster.
- "**Não sempre**": aplica a no máximo 1–2 exercícios por sessão; o resto fica reto.

## Estado atual do motor (verificado por workflow 2026-06-19)

| Ponto | Verificado |
|---|---|
| `engine.ts::generateTrainingProgram` | existe (**L224**). Em **shadow/off** — não serve prod (flag `PRESCRIPTION_ENGINE_V1` em ai-prescribe-workout L1366). |
| `ai-prescribe-workout::buildEmergencyFallbackPlan` | existe (**L798**); monta exercícios via `fallbackExercise()` (L769-796) dentro de `makeWorkout()` (L822). **É o que SERVE em prod hoje** (`PRESCRIPTION_AI_FIRST=off`, L13). |
| Campos do exercício hoje | `phase, exercise_id, exercise_name, muscle_group, sets, reps, load_percent_1rm, rir, rest_seconds, tempo, exercise_order, cues, biomechanical_note, regression, progression`. **NÃO tem** `method`/`group_id`/`method_seconds`/`is_isolation` ainda (adicionar é trivial — campos extras no objeto). |
| Em escopo HOJE | ✅ `mesocycle` (via `presetKey`/`selectedPreset` no fallback; `stimulus`/`PeriodizationBlock` no engine) · ✅ `level` (`args.fitnessLevel`/`input.fitnessLevel`) · ✅ dor/restrição (`riskText`, `args.restrictions`/`assessmentContext`; `painReports`/`painEva` no engine). |
| **Faltando** no escopo | ❌ `microcycle` (não implementado) · ❌ número da `week` (fallback é template único de 6 sem, sem variação por semana). |

**Implicação:** o módulo já roda HOJE só com o que o motor tem (`mesocycle`+`level`+`hasPain`). `microcycle`/`week`
são **opcionais com default** (`ordinario`/semana 1 = bloco 0). Quando o motor passar a variar por semana,
a rotação de estímulo (2 em 2 semanas) e o skip de deload acendem sozinhos — sem mudar a assinatura.

## Como plugar (engine_chat — território do motor de força)

Chamar `planAdvancedMethods` **por sessão/workout** (o `group_id` é único dentro da lista renderizada;
passe `sessionKey` = workout_id/dia se combinar sessões). Mapear o que o motor já tem:

```ts
import { planAdvancedMethods } from "../_shared/prescription/advancedMethods.ts";

// em buildEmergencyFallbackPlan (prod) e/ou generateTrainingProgram, por workout:
workout.exercises = planAdvancedMethods(workout.exercises, {
  mesocycle,             // OBRIGATÓRIO — mapear presetKey/selectedPreset (ou stimulus) → base|acumulacao|intensificacao|polimento
  level,                 // OBRIGATÓRIO — fitnessLevel → iniciante|intermediario|avancado
  hasPain,               // recomendado — derivar de riskText/kneeRisk/backRisk/painReports (true → conservador)
  // opcionais (ligam a granularidade fina quando existirem):
  microcycle,            // default "ordinario"; passe "regenerativo" nas semanas de deload p/ zerar métodos
  week,                  // default 1; passe a semana 1-based p/ ativar a rotação 2-em-2
  sessionKey,            // ex.: workout_id — evita colisão de group_id entre sessões da mesma semana
});
```

Pontos de integração (arquivos do motor — **claude não edita**):
- `ai-prescribe-workout/index.ts` → `buildEmergencyFallbackPlan` / `fallbackExercise` (**prioridade: é o prod hoje**).
- `_shared/prescription/engine.ts` → `generateTrainingProgram` (quando o cutover V1 for ligado).

Notas:
- O fallback não tem `is_isolation`; a heurística por nome (`COMPOUND_RE`) cobre — mas se quiser precisão,
  derive `is_isolation` da `phase` (`forca_especifica` ≈ acessório/isolador) ou do `muscle_group`.
- `method_seconds` é setado p/ pico de contração/alongamento (técnicas com tempo) na fase de acumulação.
- O contrato de render foi confirmado: o app agrupa exercícios **consecutivos** com **mesmo `group_id` E mesmo
  `method`** (de agrupamento); `minItems` é validado só na criação, então o módulo manter o bloco íntegro basta.

## Por que isso é seguro
- É **aditivo**: sem chamada a `planAdvancedMethods`, nada muda (o fallback atual continua igual).
- Os ids são **idênticos** aos que o app já entende → zero mudança de front, zero migration.
- A doutrina já respeita os limites de segurança da metodologia (sem método em iniciante, deload, base,
  ou exercício com dor).

— claude (2026-06-19)
