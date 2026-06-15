import { normalizeText } from "./presets";
import { hasPainContext } from "./progressionRules";
import { IMPORTANT_GROUPS, reviewVolume } from "./volumeRules";
import type {
  ExerciseCatalogEntry,
  MethodologyPreset,
  PrescriptionInput,
  PrescriptionValidationResult,
  TrainingProgram,
  ValidationCorrection,
  ValidationWarning,
} from "./types";

function collectExerciseIds(program: TrainingProgram) {
  return program.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.exercise_id));
}

function hasAdvancedMethod(program: TrainingProgram) {
  return /(drop[- ]?set|cluster[- ]?set|piramide|up[- ]?set|rest[- ]?pause)/.test(normalizeText(program));
}

function hasHeavyLowerNearEndurance(program: TrainingProgram) {
  const lowerDays = new Set(
    program.workouts
      .filter((workout) => /quadr|posterior|glut|membros inferiores|mmii/.test(normalizeText([workout.split_focus, workout.exercises])))
      .map((workout) => workout.day_of_week),
  );
  if (lowerDays.size === 0) return false;
  return [...lowerDays].some((day) => day === 6 || day === 7);
}

export function validateTrainingProgram(args: {
  program: TrainingProgram;
  input: PrescriptionInput;
  preset: MethodologyPreset;
  catalog: ExerciseCatalogEntry[];
  corrections?: ValidationCorrection[];
}): PrescriptionValidationResult {
  const warnings: ValidationWarning[] = [];
  const blockers: ValidationWarning[] = [];
  const corrections = [...(args.corrections || [])];
  const add = (warning: ValidationWarning) => {
    if (warning.severity === "blocker") blockers.push(warning);
    else warnings.push(warning);
  };

  const validIds = new Set(args.catalog.map((exercise) => exercise.id));
  const ids = collectExerciseIds(args.program);
  const invalid = ids.filter((id) => !validIds.has(id));
  if (args.catalog.length === 0) {
    add({
      severity: "blocker",
      code: "empty_exercise_library",
      message: "A biblioteca de exercícios está vazia; o motor não pode inventar exercícios.",
      recommendation: "Cadastre exercícios na biblioteca antes de gerar a prescrição.",
      source: "biblioteca",
    });
  } else if (invalid.length > 0) {
    add({
      severity: "blocker",
      code: "exercise_outside_library",
      message: "O treino contém exercício fora da biblioteca.",
      recommendation: "Substituir por exercise_id real da biblioteca.",
      source: "biblioteca",
    });
  }

  const volume_review = reviewVolume(args.program, args.input, args.preset);
  for (const review of volume_review) {
    if (review.status === "alto") {
      add({
        severity: "warning",
        code: `high_volume_${review.muscle_group}`,
        message: `${review.muscle_group}: ${review.weekly_sets} séries/semana.`,
        recommendation: "Reduzir séries ou distribuir melhor se houver dor, fadiga ou iniciante.",
        source: "volume",
      });
    }
  }

  const presentGroups = new Set(volume_review.filter((item) => item.weekly_sets > 0).map((item) => item.muscle_group));
  const missingImportant = IMPORTANT_GROUPS.filter((group) => !presentGroups.has(group));
  if (args.catalog.length > 0 && missingImportant.includes("core")) {
    add({
      severity: "warning",
      code: "missing_core",
      message: "Core não apareceu claramente no plano.",
      recommendation: "Adicionar ativação/estabilidade de core em pelo menos 1-2 sessões.",
      source: "metodologia_bn",
    });
  }

  const context = normalizeText(args.input);
  const planText = normalizeText(args.program);
  if (/joelho|valgo/.test(context) && /salto|pliometr|agachamento profundo/.test(planText)) {
    add({
      severity: "warning",
      code: "knee_conflict",
      message: "Há possível conflito entre dor/valgo de joelho e exercício ou método agressivo.",
      recommendation: "Usar amplitude sem dor, priorizar glúteo e remover impacto/pliometria.",
      source: "anamnese",
    });
  }
  if (/lombar|butt|retrovers/.test(context) && /terra pesado|good morning|carga axial alta/.test(planText)) {
    add({
      severity: "warning",
      code: "low_back_conflict",
      message: "Há possível conflito entre lombar/butt wink e carga axial/hinge agressivo.",
      recommendation: "Reduzir carga axial, usar máquinas/hip thrust/core e limitar amplitude.",
      source: "avaliacao_funcional",
    });
  }
  if (/ombro|overhead|cifose|protrus/.test(context) && /overhead pesado|desenvolvimento pesado|barra nuca/.test(planText)) {
    add({
      severity: "warning",
      code: "shoulder_conflict",
      message: "Há possível conflito entre restrição de ombro e overhead agressivo.",
      recommendation: "Priorizar remada, face pull, rotadores e pegada neutra.",
      source: "anamnese",
    });
  }

  if ((args.input.isEnduranceAthlete || args.input.runningDaysContext) && hasHeavyLowerNearEndurance(args.program)) {
    add({
      severity: "warning",
      code: "endurance_lower_body_conflict",
      message: "Treino pesado de MMII pode conflitar com corrida/endurance no fim da semana.",
      recommendation: "Separar MMII pesado de longos/tiros e reduzir volume de pernas em cerca de 20%.",
      source: "periodizacao",
    });
  }

  if (hasPainContext(args.input) && hasAdvancedMethod(args.program)) {
    add({
      severity: "warning",
      code: "advanced_method_with_pain",
      message: "Método avançado apareceu em contexto com dor/restrição.",
      recommendation: "Remover método avançado até estabilizar dor e técnica.",
      source: "nivel",
    });
  }

  return {
    status: blockers.length ? "blocked" : warnings.some((warning) => warning.severity === "warning") ? "warnings" : "ok",
    warnings,
    corrections,
    blockers,
    volume_review,
  };
}
