// Regras de volume semanal (séries por grupo) — landmarks simplificados (MEV–MAV).
import type {
  CanonicalMuscle,
  Experience,
  GeneratedWorkout,
  MuscleVolume,
  VolumeStatus,
} from "./types";
import { MUSCLE_LABEL } from "./muscles";

// Faixa-alvo de séries semanais (intermediário). Ajustada por nível.
const BASE_TARGET: Record<CanonicalMuscle, [number, number]> = {
  peito: [10, 18],
  costas: [12, 20],
  ombro: [10, 18],
  biceps: [8, 16],
  triceps: [8, 16],
  trapezio: [6, 12],
  antebraco: [4, 10],
  quadriceps: [10, 18],
  posterior: [8, 16],
  gluteo: [8, 16],
  panturrilha: [8, 16],
  adutores: [4, 10],
  abdomen: [6, 16],
};

function factor(experience: Experience): number {
  if (experience === "iniciante") return 0.7;
  if (experience === "avancado") return 1.15;
  return 1;
}

export function volumeTarget(
  muscle: CanonicalMuscle,
  experience: Experience,
): [number, number] {
  const [lo, hi] = BASE_TARGET[muscle];
  const f = factor(experience);
  return [Math.round(lo * f), Math.round(hi * f)];
}

function statusFor(sets: number, [lo, hi]: [number, number]): VolumeStatus {
  if (sets < lo) return "low";
  if (sets > hi) return "high";
  return "ok";
}

// Soma séries por grupo canônico em todos os treinos da semana.
export function computeWeeklyVolume(
  workouts: GeneratedWorkout[],
  experience: Experience,
): MuscleVolume[] {
  const totals = new Map<CanonicalMuscle, number>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (!ex.canonical) continue;
      const sets = parseInt(ex.sets, 10) || 0;
      totals.set(ex.canonical, (totals.get(ex.canonical) || 0) + sets);
    }
  }
  return Array.from(totals.entries())
    .map(([muscle, sets]) => {
      const target = volumeTarget(muscle, experience);
      return {
        muscle,
        label: MUSCLE_LABEL[muscle],
        sets,
        target,
        status: statusFor(sets, target),
      } as MuscleVolume;
    })
    .sort((a, b) => b.sets - a.sets);
}
