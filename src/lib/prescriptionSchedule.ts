export type PrescriptionScheduleMode = "single" | "remaining";

export interface PrescriptionScheduleCycle {
  id: string;
  enrollment_id: string | null;
  cycle_number: number;
  start_date: string;
  end_date: string;
  status: string;
  has_workouts?: boolean;
  has_bundle?: boolean;
}

export type LongitudinalPhase = "base" | "acumulacao" | "intensificacao" | "consolidacao";

const DAY_MS = 86_400_000;

function utcDay(value: string | Date): number {
  if (value instanceof Date) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, Math.max(0, month - 1), day);
}

export function isCycleCurrent(cycle: PrescriptionScheduleCycle, today = new Date()): boolean {
  const now = utcDay(today);
  return now >= utcDay(cycle.start_date) && now <= utcDay(cycle.end_date);
}

export function isCycleFuture(cycle: PrescriptionScheduleCycle, today = new Date()): boolean {
  return utcDay(cycle.start_date) > utcDay(today);
}

export function daysUntilCycleEnd(cycle: PrescriptionScheduleCycle, today = new Date()): number {
  return Math.ceil((utcDay(cycle.end_date) - utcDay(today)) / DAY_MS);
}

export function longitudinalPhase(cycleNumber: number): LongitudinalPhase {
  const index = ((Math.max(1, cycleNumber) - 1) % 4) + 1;
  if (index === 1) return "base";
  if (index === 2) return "acumulacao";
  if (index === 3) return "intensificacao";
  return "consolidacao";
}

export function selectPrescriptionTargets(args: {
  cycles: PrescriptionScheduleCycle[];
  mode: PrescriptionScheduleMode;
  selectedCycleId?: string | null;
  today?: Date;
  includeAlreadyPrepared?: boolean;
}): PrescriptionScheduleCycle[] {
  const today = args.today ?? new Date();
  const ordered = [...args.cycles].sort((a, b) => a.cycle_number - b.cycle_number);

  if (args.mode === "single") {
    const selected = ordered.find((cycle) => cycle.id === args.selectedCycleId);
    return selected ? [selected] : [];
  }

  return ordered.filter((cycle) => {
    if (!isCycleCurrent(cycle, today) && !isCycleFuture(cycle, today)) return false;
    if (args.includeAlreadyPrepared) return true;
    return !cycle.has_workouts && !cycle.has_bundle;
  });
}

export function describeLongitudinalPhase(phase: LongitudinalPhase): string {
  if (phase === "base") return "Base técnica e calibração do novo mesociclo";
  if (phase === "acumulacao") return "Acúmulo progressivo de volume com exercícios estáveis";
  if (phase === "intensificacao") return "Intensificação controlada sem perder a técnica";
  return "Consolidação, redução de fadiga e preparação da próxima evolução";
}

