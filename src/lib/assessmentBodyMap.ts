import {
  type BodyRegionId,
  LIBRARY_GROUP_TO_REGION,
  type RegionLimitation,
} from "@/lib/bodyMap";

type LimitationType = RegionLimitation["type"];
type Severity = NonNullable<RegionLimitation["severity"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeSeverity(value: unknown): Severity | undefined {
  const text = normalizeText(value);
  if (text.includes("sever")) return "severa";
  if (text.includes("moder")) return "moderada";
  if (text.includes("leve")) return "leve";
  return undefined;
}

const MUSCLE_ALIASES: Array<[BodyRegionId, string[]]> = [
  ["chest", ["peitoral", "peitorais", "pectoralis", "peitoral menor", "peitoral maior"]],
  ["shoulders", ["ombro", "ombros", "deltoide", "deltoides", "manguito", "rotador", "supraespinhal", "infraespinhal"]],
  ["biceps", ["biceps", "bicipital"]],
  ["triceps", ["triceps"]],
  ["forearm", ["antebraco", "antebracos", "punho", "punhos"]],
  ["abs", ["abdomen", "abdominal", "abdominais", "core", "reto abdominal", "transverso"]],
  ["trapezius", ["trapezio", "romboide", "romboides", "escapula", "escapular", "serrtil", "serratil"]],
  ["back", ["costas", "dorsal", "dorsais", "latissimo", "grande dorsal", "toracica", "toracico"]],
  ["lower_back", ["lombar", "eretores", "eretor", "quadrado lombar", "coluna lombar"]],
  ["glutes", ["gluteo", "gluteos", "gluteo medio", "gluteo maximo", "gluteo minimo", "rotadores externos", "abdutores de quadril"]],
  ["quads", ["quadriceps", "vasto medial", "vasto lateral", "reto femoral"]],
  ["hamstrings", ["isquiotibiais", "posterior de coxa", "posteriores de coxa", "biceps femoral", "semitendinoso", "semimembranoso"]],
  ["adductors", ["adutor", "adutores", "virilha"]],
  ["calves", ["panturrilha", "panturrilhas", "gastrocnemio", "soleo", "triceps sural", "tornozelo", "dorsiflexao"]],
];

const OHS_REGION_MAP: Record<string, { regions: BodyRegionId[]; type: LimitationType; note: string }> = {
  dorsiflexion_limitation: {
    regions: ["calves"],
    type: "articular",
    note: "Limitação de dorsiflexão de tornozelo no OHS.",
  },
  dynamic_valgus: {
    regions: ["quads", "glutes"],
    type: "articular",
    note: "Valgo dinâmico sugere revisar controle de joelho/quadril.",
  },
  trunk_forward_lean: {
    regions: ["calves", "hamstrings"],
    type: "articular",
    note: "Inclinação excessiva de tronco sugere revisar mobilidade posterior e tornozelo.",
  },
  butt_wink: {
    regions: ["lower_back", "hamstrings"],
    type: "articular",
    note: "Retroversão pélvica no fundo do agachamento.",
  },
  pelvic_drop_trendelenburg: {
    regions: ["glutes"],
    type: "neural",
    note: "Drop de pelve/Trendelenburg funcional sugere controle neuromotor de quadril.",
  },
  shoulder_protraction_kyphosis: {
    regions: ["chest", "trapezius", "shoulders"],
    type: "articular",
    note: "Protrusão de ombro/cifose torácica afeta organização escapular.",
  },
  overhead_arm_asymmetry: {
    regions: ["shoulders", "back"],
    type: "articular",
    note: "Assimetria de braços no overhead sugere restrição unilateral de ombro/torácica.",
  },
};

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readPath(root: unknown, path: string[]) {
  let current = root;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function regionsForMuscleName(name: unknown): BodyRegionId[] {
  const text = normalizeText(name);
  if (!text) return [];

  const direct = LIBRARY_GROUP_TO_REGION[text];
  if (direct) return [direct];

  const regions = new Set<BodyRegionId>();
  for (const [region, aliases] of MUSCLE_ALIASES) {
    if (aliases.some((alias) => text.includes(alias))) regions.add(region);
  }
  return Array.from(regions);
}

function pushLimitation(
  out: RegionLimitation[],
  seen: Set<string>,
  region: BodyRegionId,
  type: LimitationType,
  severity: Severity | undefined,
  note: string,
) {
  const key = `${region}:${type}:${severity ?? ""}:${note}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ region, type, severity, note });
}

function addMuscleList(
  out: RegionLimitation[],
  seen: Set<string>,
  values: unknown[],
  notePrefix: string,
) {
  for (const value of values) {
    const label = isRecord(value)
      ? value.nome ?? value.musculo ?? value.name ?? value.grupo ?? JSON.stringify(value)
      : value;
    const severity = isRecord(value) ? normalizeSeverity(value.gravidade ?? value.severidade ?? value.severity) : undefined;
    for (const region of regionsForMuscleName(label)) {
      pushLimitation(out, seen, region, "muscular", severity, `${notePrefix}: ${String(label)}`);
    }
  }
}

function addMovementRestrictions(out: RegionLimitation[], seen: Set<string>, values: unknown[]) {
  for (const value of values) {
    const text = isRecord(value)
      ? String(value.restricao ?? value.nome ?? value.descricao ?? value.name ?? JSON.stringify(value))
      : String(value ?? "");
    const severity = isRecord(value) ? normalizeSeverity(value.gravidade ?? value.severidade ?? value.severity) : undefined;
    for (const region of regionsForMuscleName(text)) {
      pushLimitation(out, seen, region, "articular", severity, `Restrição de movimento: ${text}`);
    }
  }
}

export function assessmentToBodyRegions(assessmentJson: unknown): RegionLimitation[] {
  const out: RegionLimitation[] = [];
  const seen = new Set<string>();
  const root = isRecord(assessmentJson) ? assessmentJson : {};
  const prescriptionContext = isRecord(root.prescription_context) ? root.prescription_context : {};

  addMuscleList(
    out,
    seen,
    [
      ...arrayFrom(prescriptionContext.shortened_muscles),
      ...arrayFrom(root.musculos_encurtados),
    ],
    "Músculo encurtado",
  );
  addMuscleList(
    out,
    seen,
    [
      ...arrayFrom(prescriptionContext.weak_muscles),
      ...arrayFrom(root.musculos_fracos),
    ],
    "Músculo fraco/inibido",
  );
  addMovementRestrictions(
    out,
    seen,
    [
      ...arrayFrom(prescriptionContext.movement_restrictions),
      ...arrayFrom(root.restricoes_movimento),
    ],
  );

  const ohsCompensations = [
    ...arrayFrom(root.ohs_compensations),
    ...arrayFrom(readPath(root, ["prescription_context", "ohs_compensations"])),
  ];
  for (const item of ohsCompensations) {
    if (!isRecord(item) || item.presente !== true || typeof item.key !== "string") continue;
    const map = OHS_REGION_MAP[item.key];
    if (!map) continue;
    const severity = normalizeSeverity(item.severidade ?? item.gravidade ?? item.severity);
    const evidence = typeof item.evidencia === "string" && item.evidencia.trim()
      ? ` ${item.evidencia.trim()}`
      : "";
    for (const region of map.regions) {
      pushLimitation(out, seen, region, map.type, severity, `${map.note}${evidence}`);
    }
  }

  return out;
}
