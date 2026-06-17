// Central contract for the anatomical body map (boneco).
// Keeps a stable set of regions and maps them to the slugs used by
// `react-muscle-highlighter`. Designed to be tenant-agnostic: muscle group
// names cadastrados por cada empresa are matched to regions by normalized text.

import type { Slug } from "react-muscle-highlighter";

export type BodyRegionId =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearm"
  | "abs"
  | "trapezius"
  | "back"
  | "lower_back"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "calves";

export const BODY_REGION_IDS: BodyRegionId[] = [
  "chest",
  "shoulders",
  "biceps",
  "triceps",
  "forearm",
  "abs",
  "trapezius",
  "back",
  "lower_back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
];

export const REGION_LABEL: Record<BodyRegionId, string> = {
  chest: "Peito",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearm: "Antebraço",
  abs: "Abdômen",
  trapezius: "Trapézio",
  back: "Costas",
  lower_back: "Lombar",
  glutes: "Glúteos",
  quads: "Quadríceps",
  hamstrings: "Posterior de coxa",
  adductors: "Adutores",
  calves: "Panturrilha",
};

// Region → slug accepted by react-muscle-highlighter.
export const REGION_TO_SLUG: Record<BodyRegionId, Slug> = {
  chest: "chest",
  shoulders: "deltoids",
  biceps: "biceps",
  triceps: "triceps",
  forearm: "forearm",
  abs: "abs",
  trapezius: "trapezius",
  back: "upper-back",
  lower_back: "lower-back",
  glutes: "gluteal",
  quads: "quadriceps",
  hamstrings: "hamstring",
  adductors: "adductors",
  calves: "calves",
};

const SLUG_TO_REGION: Partial<Record<Slug, BodyRegionId>> = Object.fromEntries(
  (Object.entries(REGION_TO_SLUG) as [BodyRegionId, Slug][]).map(([r, s]) => [s, r]),
) as Partial<Record<Slug, BodyRegionId>>;

export function regionForSlug(slug?: Slug): BodyRegionId | null {
  if (!slug) return null;
  return SLUG_TO_REGION[slug] ?? null;
}

// Which view (front/back) a region naturally lives on. Used to auto-flip.
export const REGION_SIDE: Record<BodyRegionId, "front" | "back" | "both"> = {
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
  calves: "back",
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Keyword groups for fuzzy matching free-form muscle group names (PT/EN).
const REGION_KEYWORDS: Record<BodyRegionId, string[]> = {
  chest: ["peit", "chest", "pec"],
  shoulders: ["ombro", "deltoid", "shoulder", "delt"],
  biceps: ["biceps", "bicep"],
  triceps: ["triceps", "tricep"],
  forearm: ["antebraco", "forearm"],
  abs: ["abdom", "abdominal", "abs", "core"],
  trapezius: ["trapezio", "trapez", "trap"],
  back: ["dorsal", "costas", "back", "latiss", "dorso"],
  lower_back: ["lombar", "lower back", "lower-back", "eretor", "espinhal"],
  glutes: ["gluteo", "gluten", "glute", "bumbum"],
  quads: ["quadriceps", "quadricep", "quads", "coxa anterior"],
  hamstrings: ["posterior", "isquiotibi", "hamstring", "femoral", "coxa posterior"],
  adductors: ["adutor", "adduct"],
  calves: ["panturrilha", "calf", "calves", "gastroc", "soleo"],
};

// Match a tenant-defined muscle group name to a body region (or null).
export function muscleGroupToRegion(name: string): BodyRegionId | null {
  const n = normalize(name);
  if (!n) return null;
  for (const region of BODY_REGION_IDS) {
    if (REGION_KEYWORDS[region].some((kw) => n.includes(kw))) return region;
  }
  return null;
}
