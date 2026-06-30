// Motor determinístico de prescrição (D1) — tipos compartilhados.
// Tudo aqui é puro/determinístico: mesma entrada ⇒ mesma saída.

export type Objective =
  | "hipertrofia"
  | "emagrecimento"
  | "forca"
  | "performance"
  | "saude";

export type Experience = "iniciante" | "intermediario" | "avancado";

export type Equipment =
  | "academia_completa"
  | "halteres"
  | "casa_basica"
  | "peso_corporal";

/** Grupos musculares canônicos usados pelo motor (independentes do texto da biblioteca). */
export type CanonicalMuscle =
  | "peito"
  | "costas"
  | "ombro"
  | "biceps"
  | "triceps"
  | "trapezio"
  | "antebraco"
  | "quadriceps"
  | "posterior"
  | "gluteo"
  | "panturrilha"
  | "adutores"
  | "abdomen";

/** Exercício disponível (vem da exercise_library, normalizado). */
export interface ExercisePoolItem {
  id: string;
  name: string;
  muscle_group: string; // texto bruto da biblioteca
  canonical: CanonicalMuscle | null;
  equipment?: string | null;
  video_url?: string | null;
  video_path?: string | null;
  is_compound: boolean; // heurística pelo nome
}

export interface PrescriptionInput {
  objective: Objective;
  experience: Experience;
  daysPerWeek: number; // 2..6
  sessionDurationMin: number; // ex.: 60
  equipment: Equipment;
  restrictions?: string; // texto livre de lesões/dores
  durationWeeks?: number; // default 6
  pool: ExercisePoolItem[];
}

export interface GeneratedExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  canonical: CanonicalMuscle | null;
  video_url: string | null;
  video_path: string | null;
  sets: string;
  reps: string;
  rest: string;
  rpe: string;
  notes: string;
}

export interface GeneratedWorkout {
  label: string; // "A", "B", ...
  title: string; // "Treino A — Peito e Tríceps"
  focus: string;
  description: string;
  exercises: GeneratedExercise[];
}

export type VolumeStatus = "low" | "ok" | "high";

export interface MuscleVolume {
  muscle: CanonicalMuscle;
  label: string;
  sets: number;
  target: [number, number];
  status: VolumeStatus;
}

export interface PrescriptionPlan {
  input: PrescriptionInput;
  splitName: string;
  durationWeeks: number;
  workouts: GeneratedWorkout[];
  weeklyVolume: MuscleVolume[];
  rationale: string[];
  warnings: string[];
}
