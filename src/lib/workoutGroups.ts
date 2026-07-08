// Definições compartilhadas de agrupamentos/técnicas de treino.
// Usadas no Montar Treino (WorkoutBuilder) e na Prescrição (UnifiedPrescriber).

export const GROUP_DEFS = {
  bi_set: { label: "Bi-set", short: "BI-SET", desc: "2 exercícios em sequência, sem descanso entre eles." },
  tri_set: { label: "Tri-set", short: "TRI-SET", desc: "3 exercícios em sequência, sem descanso." },
  super_set: { label: "Super-set", short: "SUPER-SET", desc: "2 exercícios de músculos antagonistas em sequência." },
  giant_set: { label: "Série gigante", short: "SÉRIE GIGANTE", desc: "4+ exercícios seguidos para o mesmo grupo." },
  circuit: { label: "Circuito", short: "CIRCUITO", desc: "Vários exercícios em sequência, descanso só ao final da volta." },
} as const;

export type GroupType = keyof typeof GROUP_DEFS;

export const GROUP_ORDER: GroupType[] = ["bi_set", "tri_set", "super_set", "giant_set", "circuit"];
