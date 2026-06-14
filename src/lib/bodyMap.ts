// ============================================================================
// CONTRATO COMPARTILHADO do Boneco Anatômico (features novas: seleção de exercício
// no WorkoutBuilder + visualização de limitações na Avaliação + dashboards).
// Fonte da verdade dos IDs de região que TODO mundo usa igual:
//   - GPT: desenha o SVG com <path id="region-<id>"> usando EXATAMENTE estes ids.
//   - Codex: mapeia assessment_json -> regiões usando estes ids (assessmentBodyMap.ts).
//   - Claude: componente BodyMap + integrações importam daqui.
// Taxonomia derivada da biblioteca real (exercise_library.muscle_group, em PT).
// ============================================================================

export type BodyRegionId =
  | "chest"        // peitoral
  | "shoulders"    // ombro / deltoide
  | "biceps"       // bíceps
  | "triceps"      // tríceps
  | "forearm"      // antebraço
  | "abs"          // abdômen
  | "trapezius"    // trapézio
  | "back"         // costas (dorsais/latíssimo)
  | "lower_back"   // lombar / eretores
  | "glutes"       // glúteo
  | "quads"        // quadríceps
  | "hamstrings"   // posterior de coxa
  | "adductors"    // adutores
  | "calves";      // panturrilha

export const BODY_REGION_IDS: BodyRegionId[] = [
  "chest", "shoulders", "biceps", "triceps", "forearm", "abs", "trapezius",
  "back", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves",
];

export const BODY_REGION_LABELS: Record<BodyRegionId, string> = {
  chest: "Peitoral",
  shoulders: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearm: "Antebraço",
  abs: "Abdômen",
  trapezius: "Trapézio",
  back: "Costas",
  lower_back: "Lombar",
  glutes: "Glúteo",
  quads: "Quadríceps",
  hamstrings: "Posterior de coxa",
  adductors: "Adutores",
  calves: "Panturrilha",
};

// Em qual vista a região é primariamente mostrada/clicável.
export const BODY_REGION_VIEW: Record<BodyRegionId, "front" | "back" | "both"> = {
  chest: "front",
  shoulders: "both",
  biceps: "front",
  triceps: "back",
  forearm: "both",
  abs: "front",
  trapezius: "back",
  back: "back",
  lower_back: "back",
  glutes: "back",
  quads: "front",
  hamstrings: "back",
  adductors: "front",
  calves: "both",
};

// Região -> muscle_group(s) da biblioteca (exercise_library.muscle_group, lower-case PT).
export const REGION_TO_LIBRARY_GROUPS: Record<BodyRegionId, string[]> = {
  chest: ["peitoral"],
  shoulders: ["ombro"],
  biceps: ["bíceps"],
  triceps: ["tríceps"],
  forearm: ["antebraço"],
  abs: ["abdômen"],
  trapezius: ["trapézio"],
  back: ["costas"],
  lower_back: ["lombar"],
  glutes: ["glúteo"],
  quads: ["quadríceps"],
  hamstrings: ["posterior de coxa"],
  adductors: ["adutores"],
  calves: ["panturrilha"],
};

// Reverso: muscle_group da biblioteca (lower-case) -> região.
export const LIBRARY_GROUP_TO_REGION: Record<string, BodyRegionId> = (() => {
  const m: Record<string, BodyRegionId> = {};
  (Object.keys(REGION_TO_LIBRARY_GROUPS) as BodyRegionId[]).forEach((r) => {
    for (const g of REGION_TO_LIBRARY_GROUPS[r]) m[g.toLowerCase()] = r;
  });
  return m;
})();

// Grupos da biblioteca que NÃO são regiões anatômicas (categorias) — vão num filtro "Outros".
export const NON_REGION_LIBRARY_GROUPS = ["alongamento", "mobilidade", "cardio"];

export function regionForLibraryGroup(muscleGroup: string | null | undefined): BodyRegionId | null {
  if (!muscleGroup) return null;
  return LIBRARY_GROUP_TO_REGION[muscleGroup.trim().toLowerCase()] ?? null;
}

// Tipo de limitação usado na visualização da Avaliação (cor por tipo no boneco).
export type LimitationType = "muscular" | "articular" | "neural";

export interface RegionLimitation {
  region: BodyRegionId;
  type: LimitationType;
  severity?: "leve" | "moderada" | "severa";
  note?: string;
}

// Normaliza o vocabulário de gênero (anamnese usa "M"/"F"/"masculino"; portal usa "male"/"female").
export function normalizeGender(g: string | null | undefined): "male" | "female" | null {
  if (!g) return null;
  const s = g.trim().toLowerCase();
  if (["male", "m", "masculino", "homem"].includes(s)) return "male";
  if (["female", "f", "feminino", "mulher"].includes(s)) return "female";
  return null;
}
