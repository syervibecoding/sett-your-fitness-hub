// Metodologias avançadas de treino + agrupamento visual.
// Persistidas em cada exercício do jsonb (workouts.exercises): group_id + method.
// - Métodos de AGRUPAMENTO (grouping): juntam vários exercícios num bloco (bi-set, tri-set…).
// - Técnicas de INTENSIDADE (single): tag num exercício só (drop-set, rest-pause, cluster).

export type MethodId =
  | "biset" | "triset" | "superset" | "giantset" | "circuito"
  | "dropset" | "restpause" | "cluster";

export const WORKOUT_METHODS: Record<MethodId, {
  label: string; short: string; grouping: boolean; minItems: number; hint: string;
}> = {
  biset:     { label: "Bi-set",         short: "BI-SET",     grouping: true,  minItems: 2, hint: "2 exercícios em sequência, sem descanso entre eles." },
  triset:    { label: "Tri-set",        short: "TRI-SET",    grouping: true,  minItems: 3, hint: "3 exercícios em sequência, sem descanso entre eles." },
  superset:  { label: "Super-set",      short: "SUPER-SET",  grouping: true,  minItems: 2, hint: "Pares antagonistas em sequência, sem descanso." },
  giantset:  { label: "Série gigante",  short: "GIANT-SET",  grouping: true,  minItems: 3, hint: "4+ exercícios em sequência, sem descanso." },
  circuito:  { label: "Circuito",       short: "CIRCUITO",   grouping: true,  minItems: 2, hint: "Estações em sequência; descanso só ao fim da volta." },
  dropset:   { label: "Drop-set",       short: "DROP-SET",   grouping: false, minItems: 1, hint: "Ao falhar, reduza a carga e continue sem descanso." },
  restpause: { label: "Rest-pause",     short: "REST-PAUSE", grouping: false, minItems: 1, hint: "Falhou? 10-15s de pausa e mais reps com a mesma carga." },
  cluster:   { label: "Cluster-set",    short: "CLUSTER",    grouping: false, minItems: 1, hint: "Mini-pausas (10-20s) dentro da mesma série." },
};

export const GROUPING_METHODS: MethodId[] = ["biset", "triset", "superset", "giantset", "circuito"];
export const SINGLE_METHODS: MethodId[] = ["dropset", "restpause", "cluster"];

export function isGroupingMethod(m?: string | null): boolean {
  return !!m && GROUPING_METHODS.includes(m as MethodId);
}

export interface MethodAware {
  group_id?: string | null;
  method?: string | null;
}

export interface ExGroup<T> {
  key: string;
  method: string | null;
  grouping: boolean;
  items: Array<{ ex: T; idx: number }>;
}

/** Agrupa exercícios consecutivos que compartilham group_id (método de agrupamento). */
export function groupWorkoutExercises<T extends MethodAware>(exs: T[]): ExGroup<T>[] {
  const out: ExGroup<T>[] = [];
  (exs || []).forEach((ex, idx) => {
    const gid = ex.group_id || null;
    const m = (ex.method || null) as MethodId | null;
    const grouping = isGroupingMethod(m) && !!gid;
    const last = out[out.length - 1];
    const lastGid = last && last.items.length ? (last.items[0].ex.group_id || null) : null;
    if (grouping && last && last.grouping && last.method === m && lastGid === gid) {
      last.items.push({ ex, idx });
    } else {
      out.push({ key: `g${idx}`, method: m, grouping, items: [{ ex, idx }] });
    }
  });
  return out;
}
