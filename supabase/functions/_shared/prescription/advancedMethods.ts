// advancedMethods.ts — Sistemas de treinamento avançados aplicados AO LONGO DA PERIODIZAÇÃO.
// Espelha EXATAMENTE os ids de src/lib/workoutMethods.ts, então o app já renderiza os blocos/badges
// (MethodBadge + groupWorkoutExercises) sem mudança no front. O fallback determinístico de força
// chama planAdvancedMethods() por semana e os exercícios saem com method/group_id/method_seconds.
//
// DOUTRINA (não usar sempre — só quando faz sentido):
//   - iniciante                         → NUNCA método avançado (técnica + progressão simples).
//   - microciclo regenerativo (deload)  → NUNCA (semana de recuperação).
//   - mesociclo BASE                    → NUNCA (adaptação/técnica).
//   - dor / exercício instável          → NUNCA naquele exercício.
//   - acumulação (ordinário)            → leve: 1 técnica de intensidade (rest-pause/drop-set) na
//                                         última série de 1 isolador estável.
//   - intensificação / choque           → pode agrupar (bi-set; tri-set/giant só avançado) e/ou
//                                         drop-set/cluster; aplica a no MÁXIMO 1–2 exercícios da sessão.
//   - troca de estímulo a cada 2 semanas → o método rotaciona por bloco (semanas 1-2 / 3-4 / 5-6),
//                                         pra variar o estímulo dentro da fase.
// Os compostos pesados (agachamento/terra/supino) ficam RETOS; os métodos vão nos acessórios/isoladores.

export type MethodId =
  | "biset" | "triset" | "superset" | "giantset" | "circuito"
  | "dropset" | "restpause" | "cluster"
  | "isometria" | "pico_contracao" | "pico_alongamento";

export const GROUPING_METHODS: MethodId[] = ["biset", "triset", "superset", "giantset", "circuito"];
export const SINGLE_METHODS: MethodId[] = ["dropset", "restpause", "cluster", "isometria", "pico_contracao", "pico_alongamento"];

export interface MethodAwareExercise {
  exercise_id?: string | null;
  exercise_name?: string | null;
  muscle_group?: string | null;
  is_isolation?: boolean;      // isolador (preferível p/ métodos) vs composto pesado
  painful?: boolean;           // dor/restrição → nunca aplicar
  // saída:
  method?: MethodId | null;
  group_id?: string | null;
  method_seconds?: number | null;
}

export interface AdvancedMethodCtx {
  // O motor JÁ tem estes hoje (mapear presetKey/stimulus → mesocycle; fitnessLevel → level):
  mesocycle: "base" | "acumulacao" | "intensificacao" | "polimento";
  level: "iniciante" | "intermediario" | "avancado";
  // OPCIONAIS — o motor ainda NÃO rastreia microciclo/semana. Com default a função já roda hoje;
  // quando o motor passar week/microcycle, ligam a rotação por bloco + o skip de deload.
  microcycle?: "ordinario" | "choque" | "regenerativo"; // default "ordinario"
  week?: number;                                         // 1-based; default 1 (bloco 0)
  hasPain?: boolean;                                     // dor relevante → conservador (nenhum método)
  sessionKey?: string;                                   // ex.: workout_id/dia — evita colisão de group_id entre sessões
  groupIdFor?: (i: number) => string;                    // override do gerador de id (sem random)
}

// Heurística simples de isolador quando o motor não marca is_isolation.
const COMPOUND_RE = /(agachamento|terra|levantamento|supino|desenvolvimento|remada|barra fixa|leg press|stiff|avanço|afundo|clean|snatch|push press|thruster)/i;
function isIsolation(ex: MethodAwareExercise): boolean {
  if (typeof ex.is_isolation === "boolean") return ex.is_isolation;
  return !COMPOUND_RE.test(ex.exercise_name || "");
}

/**
 * Aplica sistemas avançados aos exercícios da sessão conforme a fase/microciclo/nível.
 * Não muta a entrada — retorna uma nova lista. Determinístico (sem random).
 */
export function planAdvancedMethods<T extends MethodAwareExercise>(exercises: T[], ctx: AdvancedMethodCtx): T[] {
  const out = (exercises || []).map((e) => ({ ...e }));
  const micro = ctx.microcycle ?? "ordinario";   // motor ainda não rastreia microciclo → ordinário
  const week = ctx.week ?? 1;                     // nem semana → bloco 0 (sem rotação) até passarem
  // group_id único DENTRO da lista da sessão (o app só agrupa consecutivos numa lista).
  // sessionKey (ex.: workout_id) evita colisão se o motor combinar sessões da mesma semana.
  const gid = ctx.groupIdFor || ((i: number) => `m${ctx.sessionKey ? ctx.sessionKey + "_" : ""}${week}_${i}`);

  // Bloqueios duros: nada de método avançado.
  if (ctx.level === "iniciante" || micro === "regenerativo" || ctx.mesocycle === "base" || ctx.hasPain) {
    return out;
  }

  // Candidatos: isoladores, sem dor. Preferimos os ACESSÓRIOS (parte final da sessão).
  const idxs = out
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e.painful && isIsolation(e))
    .map(({ i }) => i);
  if (idxs.length === 0) return out;

  const block = Math.floor((week - 1) / 2); // troca de estímulo a cada 2 semanas
  const adv = ctx.level === "avancado";
  const choque = micro === "choque" || ctx.mesocycle === "intensificacao";

  // Catálogo permitido por nível + intensidade da fase, rotacionado por bloco.
  const grouping: MethodId[] = adv ? ["biset", "triset", "giantset"] : ["biset"];
  const single: MethodId[] = choque
    ? (adv ? ["dropset", "cluster", "restpause"] : ["dropset", "restpause"])
    : ["pico_contracao", "restpause", "pico_alongamento", "dropset"]; // acumulação = hipertrofia/controle (picos usam method_seconds)

  if (choque) {
    // Intensificação/choque: tenta 1 bi-set (par de isoladores consecutivos) + 1 técnica single.
    const gm = grouping[block % grouping.length];
    const need = gm === "triset" ? 3 : gm === "giantset" ? 4 : 2;
    // pega os ÚLTIMOS `need` isoladores consecutivos como bloco agrupado
    const tail = idxs.slice(-need);
    const consecutive = tail.length === need && tail.every((v, k) => k === 0 || v === tail[k - 1] + 1);
    if (consecutive) {
      const g = gid(tail[0]);
      for (const i of tail) { out[i].method = gm; out[i].group_id = g; }
    }
    // técnica single num isolador anterior ao bloco (se sobrar)
    const rest = idxs.filter((i) => !(consecutive && tail.includes(i)));
    if (rest.length) {
      const sm = single[block % single.length];
      const target = rest[rest.length - 1];
      out[target].method = sm;
      if (sm === "isometria" || sm === "pico_contracao" || sm === "pico_alongamento") out[target].method_seconds = 3;
    }
  } else {
    // Acumulação (ordinário): só 1 técnica de intensidade leve no último isolador.
    const sm = single[block % single.length];
    const target = idxs[idxs.length - 1];
    out[target].method = sm;
    if (sm === "isometria" || sm === "pico_contracao" || sm === "pico_alongamento") out[target].method_seconds = 3;
  }

  return out;
}
