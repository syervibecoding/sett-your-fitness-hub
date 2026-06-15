// B4 — Output adapter (puro, Deno-safe): TrainingProgram -> shape de ai_strength_plans.plan +
// colunas do insert. É quase identidade: NÃO renomeia/remove campos, NÃO esconde blocker/handoff,
// NÃO remove warnings. Apenas deriva colunas e sinaliza `blocked`/`handoff` para a edge futura.
import type { PrescriptionValidationResult, TrainingProgram, ValidationWarning } from "../types.ts";
import type { AiStrengthPlanRecord, OutputAdapterResult } from "./types.ts";

const HANDOFF_BLOCKER_CODES = ["high_pain_requires_professional_review"];

export function adaptTrainingProgramForAiStrengthPlan(args: {
  program: TrainingProgram;
}): OutputAdapterResult {
  const program = args.program;

  const validation: PrescriptionValidationResult =
    program.validation ??
    program.validator?.pre_save ?? {
      status: "ok",
      warnings: [],
      corrections: [],
      blockers: [],
      volume_review: [],
    };

  const blockers: ValidationWarning[] = Array.isArray(validation.blockers) ? validation.blockers : [];
  const status = validation.status ?? "ok";
  const blocked = status === "blocked";
  // Handoff severo ao professor: blocker dedicado OU correção de teacher_alert. NÃO esconder.
  const handoff =
    blockers.some((b) => HANDOFF_BLOCKER_CODES.includes(b.code)) ||
    (validation.corrections ?? []).some((c) => /teacher_alert/.test(c.code));

  // Colunas de ai_strength_plans (iguais ao insert atual) + plan = JSON completo, intocado.
  const record: AiStrengthPlanRecord = {
    cycle_name: program.cycle_name,
    objective: program.objective,
    duration_weeks: program.duration_weeks,
    biomechanical_notes: program.biomechanical_notes ?? null,
    plan: program,
  };

  return {
    record,
    plan: program,
    status,
    blocked,
    handoff,
    blockers,
    warnings: Array.isArray(program.warnings) ? program.warnings : [],
  };
}
