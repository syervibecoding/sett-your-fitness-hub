// Divisões (splits) e esquemas de séries/reps/descanso/RPE por objetivo e nível.
import type { CanonicalMuscle, Experience, Objective } from "./types";

export interface SplitSlot {
  muscle: CanonicalMuscle;
  exercises: number; // quantos exercícios desse grupo no dia
}

export interface SplitDay {
  label: string; // A, B, C...
  focus: string; // ex.: "Empurrar (peito/ombro/tríceps)"
  slots: SplitSlot[];
}

const LABELS = ["A", "B", "C", "D", "E", "F"];

// Templates base de split por nº de dias. Para iniciantes priorizamos full-body.
function fullBody(days: number): SplitDay[] {
  // distribui os principais grupos em cada dia, variando a ênfase
  const base: SplitSlot[] = [
    { muscle: "quadriceps", exercises: 1 },
    { muscle: "posterior", exercises: 1 },
    { muscle: "peito", exercises: 1 },
    { muscle: "costas", exercises: 1 },
    { muscle: "ombro", exercises: 1 },
    { muscle: "abdomen", exercises: 1 },
  ];
  const extra: SplitSlot[][] = [
    [{ muscle: "biceps", exercises: 1 }, { muscle: "gluteo", exercises: 1 }],
    [{ muscle: "triceps", exercises: 1 }, { muscle: "panturrilha", exercises: 1 }],
    [{ muscle: "gluteo", exercises: 1 }, { muscle: "biceps", exercises: 1 }],
  ];
  return Array.from({ length: days }, (_, i) => ({
    label: LABELS[i],
    focus: "Corpo inteiro",
    slots: [...base, ...(extra[i % extra.length] || [])],
  }));
}

const PPL: Record<"push" | "pull" | "legs", SplitDay> = {
  push: {
    label: "",
    focus: "Empurrar — peito, ombro e tríceps",
    slots: [
      { muscle: "peito", exercises: 3 },
      { muscle: "ombro", exercises: 2 },
      { muscle: "triceps", exercises: 2 },
    ],
  },
  pull: {
    label: "",
    focus: "Puxar — costas, trapézio e bíceps",
    slots: [
      { muscle: "costas", exercises: 3 },
      { muscle: "trapezio", exercises: 1 },
      { muscle: "biceps", exercises: 2 },
      { muscle: "antebraco", exercises: 1 },
    ],
  },
  legs: {
    label: "",
    focus: "Pernas — quadríceps, posterior, glúteo e panturrilha",
    slots: [
      { muscle: "quadriceps", exercises: 2 },
      { muscle: "posterior", exercises: 2 },
      { muscle: "gluteo", exercises: 1 },
      { muscle: "panturrilha", exercises: 1 },
      { muscle: "abdomen", exercises: 1 },
    ],
  },
};

const UPPER: SplitDay = {
  label: "",
  focus: "Superiores — peito, costas, ombro e braços",
  slots: [
    { muscle: "peito", exercises: 2 },
    { muscle: "costas", exercises: 2 },
    { muscle: "ombro", exercises: 1 },
    { muscle: "biceps", exercises: 1 },
    { muscle: "triceps", exercises: 1 },
  ],
};

const LOWER: SplitDay = {
  label: "",
  focus: "Inferiores — quadríceps, posterior, glúteo e panturrilha",
  slots: [
    { muscle: "quadriceps", exercises: 2 },
    { muscle: "posterior", exercises: 2 },
    { muscle: "gluteo", exercises: 1 },
    { muscle: "panturrilha", exercises: 1 },
    { muscle: "abdomen", exercises: 1 },
  ],
};

function withLabels(days: SplitDay[]): SplitDay[] {
  return days.map((d, i) => ({ ...d, label: LABELS[i] }));
}

export interface BuiltSplit {
  name: string;
  days: SplitDay[];
}

// Decide o split a partir de dias/semana e nível.
export function buildSplit(daysPerWeek: number, experience: Experience): BuiltSplit {
  const d = Math.max(2, Math.min(6, Math.round(daysPerWeek)));

  if (experience === "iniciante" || d <= 2) {
    return { name: `Full Body ${d}x`, days: fullBody(d) };
  }

  switch (d) {
    case 3:
      return { name: "Push / Pull / Legs", days: withLabels([PPL.push, PPL.pull, PPL.legs]) };
    case 4:
      return {
        name: "Upper / Lower (2x)",
        days: withLabels([UPPER, LOWER, UPPER, LOWER]),
      };
    case 5:
      return {
        name: "Push / Pull / Legs + Upper / Lower",
        days: withLabels([PPL.push, PPL.pull, PPL.legs, UPPER, LOWER]),
      };
    case 6:
    default:
      return {
        name: "Push / Pull / Legs (2x)",
        days: withLabels([PPL.push, PPL.pull, PPL.legs, PPL.push, PPL.pull, PPL.legs]),
      };
  }
}

// Esquema de carga por objetivo.
export interface Scheme {
  reps: string;
  restSec: number;
  rpe: string;
}

export function schemeFor(objective: Objective, isCompound: boolean): Scheme {
  switch (objective) {
    case "forca":
      return isCompound
        ? { reps: "3-5", restSec: 180, rpe: "8" }
        : { reps: "6-8", restSec: 120, rpe: "8" };
    case "performance":
      return isCompound
        ? { reps: "4-6", restSec: 150, rpe: "8" }
        : { reps: "8-10", restSec: 90, rpe: "8" };
    case "emagrecimento":
      return isCompound
        ? { reps: "10-12", restSec: 60, rpe: "8" }
        : { reps: "12-15", restSec: 45, rpe: "8-9" };
    case "saude":
      return { reps: "10-15", restSec: 60, rpe: "6-7" };
    case "hipertrofia":
    default:
      return isCompound
        ? { reps: "6-10", restSec: 90, rpe: "8" }
        : { reps: "10-15", restSec: 60, rpe: "8-9" };
  }
}

// Séries por exercício por objetivo + nível + tipo.
export function setsFor(
  objective: Objective,
  experience: Experience,
  isCompound: boolean,
): number {
  let base = isCompound ? 4 : 3;
  if (objective === "forca" || objective === "performance") base = isCompound ? 5 : 3;
  if (objective === "saude") base = isCompound ? 3 : 2;
  if (experience === "iniciante") base = Math.max(2, base - 1);
  if (experience === "avancado") base = base + 1;
  return Math.max(2, Math.min(6, base));
}
