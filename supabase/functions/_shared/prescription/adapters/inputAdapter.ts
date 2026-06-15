// B2 — Input adapter (puro, Deno-safe): payload da edge -> PrescriptionInput.
// Regras: defaults seguros, preservar dor estruturada (EVA>3) e endurance, NUNCA inventar dado.
import type { ExerciseCatalogEntry, PrescriptionInput } from "../types.ts";
import type { EdgePrescriptionPayload, InputAdapterResult } from "./types.ts";

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}
function asNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

type PainReport = { region?: string; eva?: number | null; severity?: string | null };

function normalizePainReports(payload: EdgePrescriptionPayload): PainReport[] | null {
  const raw = Array.isArray(payload.painReports)
    ? payload.painReports
    : Array.isArray(payload.pain_reports)
      ? payload.pain_reports
      : null;
  if (!raw) return null;
  const mapped: PainReport[] = raw
    .map((r: any) => ({
      region: asString(r?.region),
      eva: asNumber(r?.eva ?? r?.pain_eva),
      severity: asString(r?.severity) ?? null,
    }))
    .filter((r: PainReport) => Boolean(r.region) || r.eva != null || Boolean(r.severity));
  return mapped.length ? mapped : null;
}

export function buildPrescriptionInputFromEdgePayload(args: {
  payload: EdgePrescriptionPayload;
  catalog: ExerciseCatalogEntry[];
}): InputAdapterResult {
  const payload = args.payload ?? {};
  const catalog = Array.isArray(args.catalog) ? args.catalog : [];
  const warnings: string[] = [];

  const objective = asString(payload.objective);
  if (!objective) warnings.push("objective ausente; default conservador 'hipertrofia'.");

  const fitnessLevel = asString(payload.fitness_level);
  if (!fitnessLevel) warnings.push("fitness_level ausente; default conservador 'iniciante'.");

  const daysRaw = asNumber(payload.days_per_week);
  if (daysRaw == null) warnings.push("days_per_week ausente/invalido; default 3.");

  if (payload.assessment_context == null) {
    warnings.push("sem assessment_context; priorizacao corretiva da avaliacao reduzida.");
  }

  // Dor estruturada — preservada como veio (o engine classifica severidade: EVA>3 moderada, EVA>5 severa).
  const painReports = normalizePainReports(payload);
  const painEva = asNumber(payload.painEva ?? payload.pain_eva);

  // Endurance/corrida — preservar sinal mesmo sem frequência (vira warning de agenda no engine/validador).
  const running = (payload.running_days_context ?? null) as PrescriptionInput["runningDaysContext"];
  const enduranceFlag = Boolean(payload.is_endurance_athlete) || Boolean(running);
  const enduranceDays = asNumber(running?.days_per_week);
  if (enduranceFlag && (enduranceDays == null || enduranceDays <= 0)) {
    warnings.push("endurance presente sem frequencia (days_per_week); sinal preservado para warning de agenda.");
  }

  if (catalog.length === 0) warnings.push("catalogo vazio; o engine emitira blocker empty_exercise_library.");

  const input: PrescriptionInput = {
    studentName: payload.student_name,
    objective: objective ?? "hipertrofia",
    fitnessLevel: fitnessLevel ?? "iniciante",
    daysPerWeek: daysRaw ?? 3,
    durationWeeks: asNumber(payload.duration_weeks) ?? 6,
    equipment: payload.equipment ?? "academia_completa",
    restrictions: payload.restrictions ?? "",
    injuries: payload.injuries,
    painReports: painReports ?? null,
    painEva: painEva ?? null,
    isEnduranceAthlete: enduranceFlag,
    runningDaysContext: running,
    enduranceAgenda: payload.endurance_agenda,
    assessmentContext: payload.assessment_context,
    anamneseContext: payload.anamnese_context,
    prescriptionIntegration: payload.prescription_integration,
    blockNumber: asNumber(payload.block_number),
    notes: payload.notes,
    techniqueBreakdown: Boolean(payload.techniqueBreakdown ?? payload.technique_breakdown),
    deload: Boolean(payload.deload),
    catalog,
  };

  return { input, warnings };
}
