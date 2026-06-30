// Regras de restrição: filtra exercícios a partir do texto de lesões/dores.
import type { CanonicalMuscle, ExercisePoolItem } from "./types";

interface RestrictionRule {
  keywords: string[];
  avoidMuscles: CanonicalMuscle[];
  avoidNamePatterns: string[];
  note: string;
}

const RULES: RestrictionRule[] = [
  {
    keywords: ["joelho", "patela", "menisco", "ligamento cruzado", "lca"],
    avoidMuscles: [],
    avoidNamePatterns: ["agachament", "leg press", "afundo", "passada", "avanco", "cadeira extensora"],
    note: "Joelho: evitados exercícios de alto impacto/cisalhamento no joelho.",
  },
  {
    keywords: ["ombro", "manguito", "bursite", "impacto", "labrum"],
    avoidMuscles: [],
    avoidNamePatterns: ["desenvolvimento", "supino inclinado", "elevacao lateral", "elevacao frontal", "paralelas"],
    note: "Ombro: evitados movimentos overhead e abdução com carga.",
  },
  {
    keywords: ["lombar", "coluna", "hernia", "hérnia", "disco", "ciatica", "ciática"],
    avoidMuscles: [],
    avoidNamePatterns: ["terra", "stiff", "remada curvada", "agachamento livre", "bom dia"],
    note: "Lombar: evitados exercícios com carga axial e flexão lombar sob carga.",
  },
  {
    keywords: ["punho", "cotovelo", "epicondilite", "tendinite"],
    avoidMuscles: [],
    avoidNamePatterns: ["rosca direta", "rosca scott", "triceps testa"],
    note: "Cotovelo/punho: reduzidos exercícios de flexão/extensão sob carga direta.",
  },
  {
    keywords: ["quadril", "labrum quadril", "trocanter"],
    avoidMuscles: [],
    avoidNamePatterns: ["afundo", "agachamento profundo", "passada"],
    note: "Quadril: evitados movimentos de grande amplitude sob carga.",
  },
];

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface RestrictionResult {
  avoidMuscles: Set<CanonicalMuscle>;
  avoidNamePatterns: string[];
  notes: string[];
}

export function analyzeRestrictions(text?: string | null): RestrictionResult {
  const t = norm(text || "");
  const avoidMuscles = new Set<CanonicalMuscle>();
  const avoidNamePatterns: string[] = [];
  const notes: string[] = [];
  if (!t.trim()) return { avoidMuscles, avoidNamePatterns, notes };

  for (const rule of RULES) {
    if (rule.keywords.some((k) => t.includes(norm(k)))) {
      rule.avoidMuscles.forEach((m) => avoidMuscles.add(m));
      avoidNamePatterns.push(...rule.avoidNamePatterns);
      notes.push(rule.note);
    }
  }
  return { avoidMuscles, avoidNamePatterns, notes };
}

export function isExerciseAllowed(
  item: ExercisePoolItem,
  r: RestrictionResult,
): boolean {
  if (item.canonical && r.avoidMuscles.has(item.canonical)) return false;
  const n = norm(item.name);
  return !r.avoidNamePatterns.some((p) => n.includes(norm(p)));
}
