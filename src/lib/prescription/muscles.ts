// Normalização de grupos musculares e heurística de exercício composto.
import type { CanonicalMuscle, ExercisePoolItem } from "./types";

export const MUSCLE_LABEL: Record<CanonicalMuscle, string> = {
  peito: "Peito",
  costas: "Costas",
  ombro: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  trapezio: "Trapézio",
  antebraco: "Antebraço",
  quadriceps: "Quadríceps",
  posterior: "Posterior de coxa",
  gluteo: "Glúteo",
  panturrilha: "Panturrilha",
  adutores: "Adutores",
  abdomen: "Abdômen",
};

// remove acentos + minúsculas
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Mapeia o texto livre de muscle_group para um grupo canônico (ou null = ignorar p/ força).
export function toCanonical(raw: string): CanonicalMuscle | null {
  const t = norm(raw);
  if (!t) return null;
  // ignorados na prescrição de força
  if (
    t.includes("along") ||
    t.includes("mobilidade") ||
    t.includes("cardio") ||
    t.includes("aquec")
  )
    return null;

  if (t.includes("peit") || t === "peito") return "peito";
  if (t.includes("costas") || t.includes("dorsal") || t.includes("puxad")) return "costas";
  if (t.includes("trap")) return "trapezio";
  if (t.includes("ombro") || t.includes("deltoid") || t.includes("mangu")) return "ombro";
  if (t.includes("biceps") || t.includes("braquio")) return "biceps";
  if (t.includes("triceps")) return "triceps";
  if (t.includes("antebra")) return "antebraco";
  if (t.includes("quadr") || t.includes("reto femoral")) return "quadriceps";
  if (t.includes("posterior") || t.includes("isquio") || t.includes("femoral")) return "posterior";
  if (t.includes("glut")) return "gluteo";
  if (t.includes("pantur") || t.includes("tibial")) return "panturrilha";
  if (t.includes("adutor")) return "adutores";
  if (t.includes("abdo") || t.includes("core") || t.includes("lombar") || t.includes("eretor"))
    return "abdomen";
  if (t.includes("perna")) return "quadriceps"; // genérico "pernas" → quad
  return null;
}

const COMPOUND_PATTERNS = [
  "agachament",
  "leg press",
  "terra",
  "stiff",
  "supino",
  "desenvolvimento",
  "remada",
  "puxada",
  "barra fixa",
  "afundo",
  "passada",
  "avanco",
  "paralelas",
  "levantament",
  "clean",
  "arranco",
];

export function isCompoundName(name: string): boolean {
  const t = norm(name);
  return COMPOUND_PATTERNS.some((p) => t.includes(p));
}

// Normaliza uma linha da exercise_library em ExercisePoolItem.
export function normalizePoolItem(row: {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  video_url?: string | null;
  video_path?: string | null;
}): ExercisePoolItem {
  return {
    id: row.id,
    name: row.name,
    muscle_group: row.muscle_group,
    canonical: toCanonical(row.muscle_group),
    equipment: row.equipment ?? null,
    video_url: row.video_url ?? null,
    video_path: row.video_path ?? null,
    is_compound: isCompoundName(row.name),
  };
}
