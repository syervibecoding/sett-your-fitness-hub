export type FitnessLevel = "iniciante" | "intermediario" | "avancado" | string;
export type PrescriptionObjective = "hipertrofia" | "forca" | "emagrecimento" | "recomposicao" | "performance" | string;
export type ValidationSeverity = "info" | "warning" | "blocker";
export type ValidationSource =
  | "biblioteca"
  | "volume"
  | "anamnese"
  | "avaliacao_funcional"
  | "objetivo"
  | "nivel"
  | "periodizacao"
  | "metodologia_bn";

export interface ExerciseTarget {
  muscle_group: string;
  role?: string | null;
  volume_percentage?: number | null;
}

export interface ExerciseCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  muscle_group?: string | null;
  difficulty?: string | null;
  equipment?: string | null;
  contraindications?: string[];
  regressions?: string[];
  progressions?: string[];
  equivalent_substitutes?: string[];
  pain_limitation_tags?: string[];
  targets?: ExerciseTarget[];
}

export interface PrescriptionInput {
  studentName?: unknown;
  objective?: PrescriptionObjective;
  fitnessLevel?: FitnessLevel;
  daysPerWeek?: number | string | null;
  durationWeeks?: number | string | null;
  equipment?: unknown;
  restrictions?: unknown;
  isEnduranceAthlete?: boolean;
  assessmentContext?: unknown;
  anamneseContext?: unknown;
  prescriptionIntegration?: unknown;
  runningDaysContext?: { days_per_week?: number | string | null; sport?: string | null } | null;
  blockNumber?: number | string | null;
  notes?: unknown;
  catalog: ExerciseCatalogEntry[];
}

export interface MethodologyPreset {
  key: string;
  label: string;
  target_weekly_sets: string;
  reps: string;
  rir: string;
  methods_by_block: Record<string, string[]>;
  weeklySetRange: { min: number; max: number; beginnerMax?: number };
}

export interface RestrictionRule {
  key: string;
  label: string;
  active: boolean;
  affectedRegions: string[];
  avoidKeywords: string[];
  preferKeywords: string[];
  volumeMultiplier?: number;
  recommendation: string;
  explanationCode: string;
}

export interface TrainingExercise {
  phase: string;
  exercise_id: string;
  exercise_name: string;
  library_exercise_name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  load_percent_1rm: number | null;
  rir: string;
  rest_seconds: number;
  tempo: string;
  exercise_order: number;
  cues: string;
  biomechanical_note: string;
  regression?: string;
  progression?: string;
}

export interface TrainingWorkout {
  name: string;
  day_of_week: number;
  duration_min: number;
  split_focus: string;
  exercises: TrainingExercise[];
  volume_load_estimate: string;
  notes: string;
}

export interface ValidationWarning {
  severity: ValidationSeverity;
  code: string;
  message: string;
  recommendation: string;
  source: ValidationSource;
}

export interface ValidationCorrection {
  code: string;
  message: string;
  applied: boolean;
  source: ValidationSource;
}

export interface VolumeReview {
  muscle_group: string;
  weekly_sets: number;
  status: "baixo" | "ok" | "alto";
  note: string;
}

export interface PrescriptionValidationResult {
  status: "ok" | "warnings" | "blocked";
  warnings: ValidationWarning[];
  corrections: ValidationCorrection[];
  blockers: ValidationWarning[];
  volume_review: VolumeReview[];
}

export interface PrescriptionExplanation {
  code: string;
  title: string;
  reason: string;
  applied_to?: string[];
  source: ValidationSource | "engine";
}

export interface PeriodizationBlock {
  weeks: string;
  stimulus: string;
  methods: string[];
  progression_rule: string;
}

export interface TrainingProgram {
  cycle_name: string;
  objective: string;
  duration_weeks: number;
  block: string;
  methodology_preset: {
    key: string;
    label: string;
    why_selected: string;
    rules: MethodologyPreset;
  };
  generated_by: "bn_prescription_engine_v1";
  biomechanical_notes: string;
  workouts: TrainingWorkout[];
  library_policy: {
    only_library_exercises: true;
    catalog_count: number;
    gaps: string[];
    validation?: unknown;
  };
  periodization_blocks: PeriodizationBlock[];
  weekly_structure: string;
  progression_protocol: string;
  warnings: string[];
  validator: {
    pre_save: PrescriptionValidationResult;
  };
  explanations: PrescriptionExplanation[];
  bnito_after_generation: {
    intent: "notify_student_prescription_ready";
    question_to_teacher: string;
    suggested_message: string;
  };
}

export interface PrescriptionEngineResult {
  program: TrainingProgram;
  explanations: PrescriptionExplanation[];
  validation: PrescriptionValidationResult;
}
