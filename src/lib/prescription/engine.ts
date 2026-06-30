// Motor determinístico: gera o plano de prescrição a partir da entrada + biblioteca.
import type {
  CanonicalMuscle,
  ExercisePoolItem,
  GeneratedExercise,
  GeneratedWorkout,
  PrescriptionInput,
  PrescriptionPlan,
} from "./types";
import { MUSCLE_LABEL } from "./muscles";
import { buildSplit, schemeFor, setsFor } from "./presets";
import { computeWeeklyVolume } from "./volumeRules";
import { analyzeRestrictions, isExerciseAllowed } from "./restrictionRules";
import { weeklyProgressionNotes } from "./progressionRules";
import { experienceLabel, validatePlan } from "./validator";

const LABELS = ["A", "B", "C", "D", "E", "F"];

// Agrupa o pool por grupo canônico, compostos primeiro, ordenado por nome (determinístico).
function poolByMuscle(
  pool: ExercisePoolItem[],
): Map<CanonicalMuscle, ExercisePoolItem[]> {
  const map = new Map<CanonicalMuscle, ExercisePoolItem[]>();
  for (const item of pool) {
    if (!item.canonical) continue;
    const arr = map.get(item.canonical) || [];
    arr.push(item);
    map.set(item.canonical, arr);
  }
  for (const [k, arr] of map) {
    arr.sort((a, b) => {
      if (a.is_compound !== b.is_compound) return a.is_compound ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    map.set(k, arr);
  }
  return map;
}

export function generatePrescription(input: PrescriptionInput): PrescriptionPlan {
  const durationWeeks = Math.max(1, Math.min(24, input.durationWeeks || 6));
  const restriction = analyzeRestrictions(input.restrictions);

  // Pool permitido por grupo
  const allowedPool = input.pool.filter((p) => isExerciseAllowed(p, restriction));
  const byMuscle = poolByMuscle(allowedPool);

  // Índice rotativo por grupo, para variar exercícios entre os dias
  const cursor = new Map<CanonicalMuscle, number>();
  const missing = new Set<CanonicalMuscle>();

  const split = buildSplit(input.daysPerWeek, input.experience);

  const workouts: GeneratedWorkout[] = split.days.map((day, di) => {
    const exercises: GeneratedExercise[] = [];
    for (const slot of day.slots) {
      const list = byMuscle.get(slot.muscle) || [];
      if (list.length === 0) {
        missing.add(slot.muscle);
        continue;
      }
      for (let n = 0; n < slot.exercises; n++) {
        const idx = (cursor.get(slot.muscle) || 0) % list.length;
        cursor.set(slot.muscle, (cursor.get(slot.muscle) || 0) + 1);
        const item = list[idx];
        const scheme = schemeFor(input.objective, item.is_compound);
        const sets = setsFor(input.objective, input.experience, item.is_compound);
        exercises.push({
          exercise_id: item.id,
          exercise_name: item.name,
          muscle_group: item.muscle_group,
          canonical: item.canonical,
          video_url: item.video_url ?? null,
          video_path: item.video_path ?? null,
          sets: String(sets),
          reps: scheme.reps,
          rest: `${scheme.restSec}s`,
          rpe: scheme.rpe,
          notes: "",
        });
      }
    }
    return {
      label: LABELS[di] || `${di + 1}`,
      title: `Treino ${LABELS[di] || di + 1} — ${day.focus}`,
      focus: day.focus,
      description: day.focus,
      exercises,
    };
  });

  const weeklyVolume = computeWeeklyVolume(workouts, input.experience);

  const rationale: string[] = [
    `Split: ${split.name} (${input.daysPerWeek}x/semana) — escolhido pelo nível ${experienceLabel(
      input.experience,
    )} e disponibilidade.`,
    `Objetivo "${input.objective}": esquema de séries/reps/descanso ajustado (compostos mais pesados, isoladores em faixas maiores).`,
    `Ciclo de ${durationWeeks} semanas com progressão de carga e periodização (deload incluso).`,
    ...weeklyProgressionNotes(input.objective, durationWeeks).slice(0, durationWeeks),
  ];
  for (const note of restriction.notes) rationale.push(`Restrição aplicada — ${note}`);

  const warnings: string[] = [];
  for (const m of missing) {
    warnings.push(
      `Sem exercícios na biblioteca para ${MUSCLE_LABEL[m]} (após filtros de restrição). Cadastre exercícios desse grupo.`,
    );
  }

  const plan: PrescriptionPlan = {
    input,
    splitName: split.name,
    durationWeeks,
    workouts,
    weeklyVolume,
    rationale,
    warnings,
  };
  plan.warnings = [...warnings, ...validatePlan(plan, input)];
  return plan;
}
