import { normalizeText } from "./presets";
import type { PrescriptionInput, RestrictionRule } from "./types";

const OHS_RULES: Record<string, RestrictionRule> = {
  dynamic_valgus: {
    key: "dynamic_valgus",
    label: "Valgo dinâmico",
    active: true,
    affectedRegions: ["joelho", "quadril"],
    avoidKeywords: ["salto", "pliometr", "agachamento profundo", "carga axial alta"],
    preferKeywords: ["gluteo", "abducao", "mini band", "unilateral", "step"],
    volumeMultiplier: 0.85,
    recommendation: "Priorizar glúteo médio, controle de joelho e amplitude sem dor antes de carga axial alta.",
    explanationCode: "priorizei_gluteo_por_valgo",
  },
  butt_wink: {
    key: "butt_wink",
    label: "Retroversão pélvica / butt wink",
    active: true,
    affectedRegions: ["lombar", "posterior", "quadril"],
    avoidKeywords: ["agachamento profundo", "terra pesado", "carga axial alta"],
    preferKeywords: ["caixa", "hip thrust", "ponte", "core", "mobilidade quadril"],
    volumeMultiplier: 0.9,
    recommendation: "Limitar amplitude de agachamento ao ponto de pelve neutra e reforçar core/cadeia posterior.",
    explanationCode: "reduzi_amplitude_por_butt_wink",
  },
  trunk_forward_lean: {
    key: "trunk_forward_lean",
    label: "Inclinação excessiva de tronco",
    active: true,
    affectedRegions: ["lombar", "tornozelo", "posterior"],
    avoidKeywords: ["terra pesado", "good morning", "carga axial alta"],
    preferKeywords: ["mobilidade tornozelo", "panturrilha", "core", "leg press", "goblet"],
    volumeMultiplier: 0.9,
    recommendation: "Reduzir demanda lombar e trabalhar mobilidade de tornozelo/posterior antes de padrões pesados.",
    explanationCode: "reduzi_carga_axial_por_inclinacao",
  },
  shoulder_protraction_kyphosis: {
    key: "shoulder_protraction_kyphosis",
    label: "Protrusão de ombro / cifose",
    active: true,
    affectedRegions: ["ombro", "toracica"],
    avoidKeywords: ["desenvolvimento pesado", "overhead pesado", "mergulho"],
    preferKeywords: ["remada", "face pull", "rotador", "escapula", "toracica"],
    volumeMultiplier: 0.9,
    recommendation: "Priorizar controle escapular, remadas e mobilidade torácica antes de overhead pesado.",
    explanationCode: "troquei_exercicio_por_restricao_ombro",
  },
  overhead_arm_asymmetry: {
    key: "overhead_arm_asymmetry",
    label: "Assimetria de braços no overhead",
    active: true,
    affectedRegions: ["ombro", "costas"],
    avoidKeywords: ["overhead pesado", "snatch", "jerk"],
    preferKeywords: ["unilateral", "rotador", "remada", "mobilidade ombro"],
    volumeMultiplier: 0.95,
    recommendation: "Evitar overhead pesado até estabilizar mobilidade e simetria escapular.",
    explanationCode: "evitei_overhead_por_assimetria",
  },
};

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function activeOhsKeys(input: PrescriptionInput) {
  const raw = input.assessmentContext as any;
  const candidates = [
    raw?.ohs_compensations,
    raw?.prescription_context?.ohs_compensations,
    raw?.assessment_json?.ohs_compensations,
  ].find(Array.isArray) || [];
  return candidates
    .filter((item: any) => item?.presente === true || item?.present === true)
    .map((item: any) => String(item.key || ""));
}

export function deriveRestrictionRules(input: PrescriptionInput): RestrictionRule[] {
  const text = normalizeText({
    restrictions: input.restrictions,
    assessment: input.assessmentContext,
    anamnese: input.anamneseContext,
    integration: input.prescriptionIntegration,
    notes: input.notes,
  });
  const rules: RestrictionRule[] = [];

  if (has(text, /joelho|valgo|patelar|condromalacia/)) {
    rules.push({
      key: "knee_pain",
      label: "Dor/restrição de joelho",
      active: true,
      affectedRegions: ["joelho"],
      avoidKeywords: ["salto", "pliometr", "agachamento profundo", "afundo profundo", "extensora pesada"],
      preferKeywords: ["gluteo", "posterior", "leg press", "caixa", "step", "isometria"],
      volumeMultiplier: 0.85,
      recommendation: "Controlar valgo, limitar amplitude dolorosa e priorizar quadril/glúteo antes de carga axial alta.",
      explanationCode: "reduzi_mmii_por_joelho",
    });
  }

  if (has(text, /lombar|ciatico|hernia|butt wink|retrovers/)) {
    rules.push({
      key: "low_back_pain",
      label: "Dor/restrição lombar",
      active: true,
      affectedRegions: ["lombar"],
      avoidKeywords: ["terra pesado", "agachamento livre pesado", "good morning", "carga axial alta"],
      preferKeywords: ["core", "pallof", "dead bug", "hip thrust", "leg press", "maquina"],
      volumeMultiplier: 0.85,
      recommendation: "Reduzir carga axial e reforçar core/hinge técnico sem dor.",
      explanationCode: "reduzi_carga_axial_por_lombar",
    });
  }

  if (has(text, /ombro|manguito|cervical|overhead|cifose|protrus/)) {
    rules.push({
      key: "shoulder_pain",
      label: "Dor/restrição de ombro",
      active: true,
      affectedRegions: ["ombro"],
      avoidKeywords: ["overhead pesado", "desenvolvimento pesado", "mergulho", "barra nuca"],
      preferKeywords: ["remada", "face pull", "rotador", "escapula", "pegada neutra"],
      volumeMultiplier: 0.9,
      recommendation: "Evitar overhead agressivo e priorizar estabilidade escapular/rotadores.",
      explanationCode: "troquei_exercicio_por_restricao_ombro",
    });
  }

  for (const key of activeOhsKeys(input)) {
    const rule = OHS_RULES[key];
    if (rule && !rules.some((existing) => existing.key === rule.key)) rules.push(rule);
  }

  return rules;
}
