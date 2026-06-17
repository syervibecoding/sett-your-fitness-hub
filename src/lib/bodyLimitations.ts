// Pure, framework-free logic for student body limitations.
// Kept separate from the React component so it can be unit-tested.

import type { BodyRegionId } from "@/lib/bodyMap";

export type LimitationType = "muscular" | "articular" | "neural";
export type Severity = "leve" | "moderada" | "severa";

export interface Limitation {
  id: string;
  region: BodyRegionId;
  type: LimitationType;
  severity: Severity;
  note: string | null;
}

export const LIMITATION_TYPES: LimitationType[] = ["muscular", "articular", "neural"];
export const SEVERITIES: Severity[] = ["leve", "moderada", "severa"];

export const TYPE_LABEL: Record<LimitationType, string> = {
  muscular: "Muscular",
  articular: "Articular",
  neural: "Neural",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  leve: "Leve",
  moderada: "Moderada",
  severa: "Severa",
};

// Severity → design token used for the body fill and the badge.
export const SEVERITY_TOKEN: Record<Severity, string> = {
  leve: "--warning",
  moderada: "--warning",
  severa: "--destructive",
};

export const SEVERITY_ALPHA: Record<Severity, number> = {
  leve: 0.4,
  moderada: 0.7,
  severa: 1,
};

export const SEVERITY_BADGE: Record<Severity, string> = {
  leve: "bg-warning/15 text-warning border-warning/30",
  moderada: "bg-warning/25 text-warning border-warning/40",
  severa: "bg-destructive/15 text-destructive border-destructive/30",
};

// Build a region → limitation lookup. Later entries win (matches Map semantics),
// which keeps a single limitation per region in the UI.
export function buildLimitationsByRegion(
  limitations: Limitation[],
): Map<BodyRegionId, Limitation> {
  const map = new Map<BodyRegionId, Limitation>();
  for (const l of limitations) map.set(l.region, l);
  return map;
}

export interface LimitationPayload {
  student_id: string;
  region: BodyRegionId;
  type: LimitationType;
  severity: Severity;
  note: string | null;
  created_by: string | null;
}

// Normalize form values into a DB payload. Empty notes become null.
export function buildLimitationPayload(input: {
  studentId: string;
  region: BodyRegionId;
  type: LimitationType;
  severity: Severity;
  note: string;
  createdBy: string | null;
}): LimitationPayload {
  return {
    student_id: input.studentId,
    region: input.region,
    type: input.type,
    severity: input.severity,
    note: input.note.trim() || null,
    created_by: input.createdBy,
  };
}

// Resolve the SVG fill for a region using an injected HSL resolver (DOM-free for tests).
export function getRegionFill(
  byRegion: Map<BodyRegionId, Limitation>,
  region: BodyRegionId,
  resolve: (token: string, alpha: number) => string,
): string | undefined {
  const lim = byRegion.get(region);
  if (!lim) return undefined;
  return resolve(SEVERITY_TOKEN[lim.severity], SEVERITY_ALPHA[lim.severity]);
}
