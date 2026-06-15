import { normalizeText } from "./presets";
import type { PeriodizationBlock, PrescriptionInput } from "./types";

export function hasPainContext(input: PrescriptionInput) {
  return /(dor|lesao|joelho|lombar|ombro|eva\s*[4-9]|valgo|butt)/.test(normalizeText({
    restrictions: input.restrictions,
    assessment: input.assessmentContext,
    anamnese: input.anamneseContext,
  }));
}

export function resolveDurationWeeks(input: PrescriptionInput) {
  const requested = Number(input.durationWeeks) || 6;
  return requested === 4 ? 4 : 6;
}

export function buildPeriodizationBlocks(input: PrescriptionInput): PeriodizationBlock[] {
  const duration = resolveDurationWeeks(input);
  const level = normalizeText(input.fitnessLevel);
  const pain = hasPainContext(input);
  const advancedAllowed = !pain && !level.includes("inic");

  if (duration === 4) {
    return [
      { weeks: "1-2", stimulus: "adaptacao/base tecnica", methods: ["tempo controlado", "progressao dupla leve"], progression_rule: "Aumentar reps mantendo RIR 3 e técnica limpa." },
      { weeks: "3-4", stimulus: "progressao conservadora", methods: advancedAllowed ? ["piramide leve em padrao estavel"] : ["sem metodos avancados"], progression_rule: "Subir carga 2-5% apenas se sem dor e sem compensação." },
    ];
  }

  return [
    { weeks: "1-2", stimulus: "adaptacao/base tecnica", methods: ["sem metodos avancados", "tempo controlado"], progression_rule: "Aumentar reps dentro da faixa mantendo RIR 3-4 e dor <= 3." },
    { weeks: "3-4", stimulus: "progressao", methods: ["progressao dupla", "aumento discreto de series se tolerado"], progression_rule: "Aumentar 1 serie em exercicios estaveis ou carga leve se tecnica estiver limpa." },
    { weeks: "5-6", stimulus: "intensificacao controlada", methods: advancedAllowed ? ["up-set ou piramide leve em exercicio estavel"] : ["sem metodos avancados"], progression_rule: "Consolidar cargas, evitar falha e preparar reavaliacao." },
  ];
}

export function progressionProtocol(input: PrescriptionInput) {
  return hasPainContext(input)
    ? "Progredir reps antes de carga; regredir amplitude/carga se dor > 3 ou perda técnica. Métodos avançados bloqueados."
    : "Progredir reps antes de carga; usar métodos avançados apenas no bloco final e em padrões estáveis.";
}
