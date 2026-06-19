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

## Como plugar (engine_chat — território do motor de força)

Chamar `planAdvancedMethods` **por semana**, depois de montar os exercícios da sessão e **já conhecendo
a fase** (o motor já nomeia microciclo/mesociclo — ver `periodization-handoff-to-engine-chat.md`):

```ts
import { planAdvancedMethods } from "../_shared/prescription/advancedMethods.ts";

// dentro de generateTrainingProgram() e/ou buildEmergencyFallbackPlan(),
// por sessão/semana:
session.exercises = planAdvancedMethods(session.exercises, {
  microcycle,            // "ordinario" | "choque" | "regenerativo"
  mesocycle,             // "base" | "acumulacao" | "intensificacao" | "polimento"
  week,                  // 1-based dentro do ciclo
  level,                 // "iniciante" | "intermediario" | "avancado" (da anamnese)
  hasPain,               // se a anamnese sinaliza dor relevante → conservador
});
```

Pontos de integração nas edges (arquivos do motor — **claude não edita**):
- `supabase/functions/_shared/prescription/engine.ts` → `generateTrainingProgram`.
- `supabase/functions/ai-prescribe-workout/index.ts` → `buildEmergencyFallbackPlan` (o que serve em prod hoje).

Se o motor já marca `is_isolation` por exercício, passe-o no objeto (a heurística por nome é só fallback).
Para `painful`, marque o exercício a partir das restrições/dores da anamnese.

## Por que isso é seguro
- É **aditivo**: sem chamada a `planAdvancedMethods`, nada muda (o fallback atual continua igual).
- Os ids são **idênticos** aos que o app já entende → zero mudança de front, zero migration.
- A doutrina já respeita os limites de segurança da metodologia (sem método em iniciante, deload, base,
  ou exercício com dor).

— claude (2026-06-19)
