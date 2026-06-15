import type { PrescriptionExplanation, RestrictionRule, ValidationCorrection } from "./types";

export function explanationsFromRestrictions(rules: RestrictionRule[]): PrescriptionExplanation[] {
  return rules.filter((rule) => rule.active).map((rule) => ({
    code: rule.explanationCode,
    title: rule.label,
    reason: rule.recommendation,
    applied_to: rule.affectedRegions,
    source: "anamnese",
  }));
}

export function enduranceExplanation(enabled: boolean): PrescriptionExplanation[] {
  if (!enabled) return [];
  return [{
    code: "reduzi_mmii_por_corrida",
    title: "Volume de membros inferiores ajustado",
    reason: "Aluno com corrida/endurance junto da musculação; reduzi volume de MMII e evitei excesso de fadiga.",
    applied_to: ["quadriceps", "posterior", "gluteos"],
    source: "periodizacao",
  }];
}

export function progressionExplanation(advancedAllowed: boolean): PrescriptionExplanation {
  return advancedAllowed
    ? {
        code: "metodo_avancado_controlado",
        title: "Métodos avançados controlados",
        reason: "Métodos avançados só entram no bloco final e em exercícios estáveis.",
        source: "metodologia_bn",
      }
    : {
        code: "evitei_metodo_avancado_por_dor_ou_nivel",
        title: "Métodos avançados evitados",
        reason: "Iniciante ou contexto com dor/restrição; priorizei progressão dupla e técnica.",
        source: "nivel",
      };
}

export function correctionsToExplanations(corrections: ValidationCorrection[]): PrescriptionExplanation[] {
  return corrections.map((correction) => ({
    code: correction.code,
    title: "Correção automática",
    reason: correction.message,
    source: correction.source,
  }));
}
