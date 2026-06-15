import { normalizeText } from "./presets";
import type { MethodologyPreset, PrescriptionInput, TrainingProgram, VolumeReview } from "./types";

export const IMPORTANT_GROUPS = ["quadriceps", "posterior", "gluteos", "costas", "peitoral", "core"];

export function normalizeMuscleGroup(group: unknown) {
  const text = normalizeText(group);
  if (/quad|coxa anterior/.test(text)) return "quadriceps";
  if (/posterior|isquio|hamstring/.test(text)) return "posterior";
  if (/glut/.test(text)) return "gluteos";
  if (/costas|dorsal|remada|lat/.test(text)) return "costas";
  if (/peit|chest|supino/.test(text)) return "peitoral";
  if (/core|abd|lombar/.test(text)) return "core";
  if (/ombro|delto/.test(text)) return "ombros";
  if (/panturr|calf/.test(text)) return "panturrilhas";
  return text || "geral";
}

export function targetVolumeRange(input: PrescriptionInput, preset: MethodologyPreset) {
  const level = normalizeText(input.fitnessLevel);
  const days = Math.min(6, Math.max(1, Number(input.daysPerWeek) || 3));
  const enduranceFactor = input.isEnduranceAthlete || input.runningDaysContext ? 0.8 : 1;
  const dayFactor = days <= 2 ? 0.85 : days >= 5 ? 1.1 : 1;
  const max = Math.round((level.includes("inic") ? preset.weeklySetRange.beginnerMax || preset.weeklySetRange.max : preset.weeklySetRange.max) * enduranceFactor * dayFactor);
  const min = Math.max(4, Math.round(preset.weeklySetRange.min * enduranceFactor * (days <= 2 ? 0.85 : 1)));
  return { min, max: Math.max(min, max) };
}

export function countWeeklySets(program: Pick<TrainingProgram, "workouts">) {
  const out = new Map<string, number>();
  for (const workout of program.workouts || []) {
    for (const exercise of workout.exercises || []) {
      const group = normalizeMuscleGroup(exercise.muscle_group);
      out.set(group, (out.get(group) || 0) + Number(exercise.sets || 0));
    }
  }
  return out;
}

export function reviewVolume(program: Pick<TrainingProgram, "workouts">, input: PrescriptionInput, preset: MethodologyPreset): VolumeReview[] {
  const range = targetVolumeRange(input, preset);
  const counts = countWeeklySets(program);
  const groups = new Set([...IMPORTANT_GROUPS, ...counts.keys()]);
  return [...groups].map((muscle_group) => {
    const weekly_sets = Math.round((counts.get(muscle_group) || 0) * 10) / 10;
    const status = weekly_sets === 0 || weekly_sets < Math.max(4, range.min - 2) ? "baixo" : weekly_sets > range.max ? "alto" : "ok";
    return {
      muscle_group,
      weekly_sets,
      status,
      note: status === "alto"
        ? `Acima do limite conservador (${range.max}) para o contexto.`
        : status === "baixo"
          ? "Volume baixo ou ausente; revisar se este grupo deveria entrar no ciclo."
          : "Volume dentro da faixa planejada.",
    };
  });
}
