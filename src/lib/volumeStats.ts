// Agregações de volume de treino reutilizáveis (aluno e admin leem do mesmo jeito).
// Fonte: workout_logs (weight * reps_done = volume-load). O muscle_group vem dos ciclos
// (workout_id + exercise_index → exercise.muscle_group), igual ao StatsCharts.
import { parseISO, startOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface VolumeLogLike {
  weight?: number | string | null;
  reps_done?: number | string | null;
  session_date?: string | null;
  workout_id?: string;
  exercise_index?: number;
}

export interface ExerciseMeta {
  workoutId: string;
  index: number;
  name: string;
  muscleGroup: string;
}

export interface CycleLike {
  workouts: { id: string; exercises: { exercise_name: string; muscle_group: string }[] }[];
}

export interface WeeklyVolumePoint {
  weekStart: string; // ISO date (segunda-feira)
  label: string;     // "dd/MM"
  volume: number;    // kg (volume-load)
  sessions: number;  // nº de dias treinados na semana
}

export interface MuscleVolumePoint {
  group: string;
  volume: number;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;

/** Constrói o índice (workout_id, exercise_index) → metadados, a partir dos ciclos. */
export function buildExerciseMeta(cycles: CycleLike[] | undefined | null): ExerciseMeta[] {
  const meta: ExerciseMeta[] = [];
  (cycles ?? []).forEach((c) =>
    c.workouts?.forEach((w) =>
      (w.exercises ?? []).forEach((ex, idx) =>
        meta.push({ workoutId: w.id, index: idx, name: ex.exercise_name, muscleGroup: ex.muscle_group })
      )
    )
  );
  return meta;
}

/** Volume-load (kg) somado por semana ISO (segunda a domingo). */
export function volumeLoadByWeek(logs: VolumeLogLike[]): WeeklyVolumePoint[] {
  const byWeek: Record<string, { volume: number; days: Set<string> }> = {};
  for (const l of logs) {
    if (!l.session_date) continue;
    const d = parseISO(l.session_date);
    if (isNaN(d.getTime())) continue;
    const ws = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const vol = num(l.weight) * num(l.reps_done);
    if (!byWeek[ws]) byWeek[ws] = { volume: 0, days: new Set() };
    byWeek[ws].volume += vol;
    byWeek[ws].days.add(l.session_date);
  }
  return Object.entries(byWeek)
    .map(([weekStart, v]) => ({
      weekStart,
      label: format(parseISO(weekStart), "dd/MM", { locale: ptBR }),
      volume: Math.round(v.volume),
      sessions: v.days.size,
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

/** Volume-load (kg) por grupamento muscular (para a pizza). */
export function volumeByMuscleGroup(logs: VolumeLogLike[], meta: ExerciseMeta[]): MuscleVolumePoint[] {
  const find = (wid?: string, idx?: number) =>
    meta.find((m) => m.workoutId === wid && m.index === idx);
  const v: Record<string, number> = {};
  for (const l of logs) {
    const m = find(l.workout_id, l.exercise_index);
    if (!m?.muscleGroup) continue;
    const vol = num(l.weight) * num(l.reps_done);
    if (vol > 0) v[m.muscleGroup] = (v[m.muscleGroup] || 0) + vol;
  }
  return Object.entries(v)
    .map(([group, volume]) => ({ group, volume: Math.round(volume) }))
    .sort((a, b) => b.volume - a.volume);
}
