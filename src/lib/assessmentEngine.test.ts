import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_ENGINE_VERSION,
  buildDeterministicAssessmentJson,
  normalizeAssessmentJson,
  OHS_COMPENSATIONS,
} from "../../supabase/functions/_shared/assessment/engine.ts";

const frameRefs = [
  { frameId: "front_ohs", vista: "Vista Anterior OHS" },
  { frameId: "side_ohs", vista: "Vista Lateral OHS" },
  { frameId: "posterior_ohs", vista: "Vista Posterior OHS" },
  { frameId: "shoulder", vista: "Shoulder Flexion" },
];

describe("BN functional assessment deterministic engine", () => {
  it("always returns the 7 OHS compensations in contract order", () => {
    const result = buildDeterministicAssessmentJson({
      frameRefs,
      observacoes_tecnicas: "",
      reason: "test",
    });

    expect(result.generated_by).toBe(ASSESSMENT_ENGINE_VERSION);
    expect(result.ohs_compensations.map((item: any) => item.key)).toEqual(OHS_COMPENSATIONS.map((item) => item.key));
    expect(result.prescription_context.ohs_compensations).toHaveLength(7);
    expect(result.report_sections.contexto_prescricao).toBeTruthy();
  });

  it("turns teacher notes about valgus and butt wink into actionable prescription context", () => {
    const result = buildDeterministicAssessmentJson({
      frameRefs,
      observacoes_tecnicas: "Air squat com valgo direito moderado e butt wink no fundo. Limitar amplitude.",
      queixa_principal: "dor no joelho EVA 4",
      modalidade: "musculacao",
      reason: "test",
    });

    const dynamicValgus = result.ohs_compensations.find((item: any) => item.key === "dynamic_valgus");
    const buttWink = result.ohs_compensations.find((item: any) => item.key === "butt_wink");

    expect(dynamicValgus).toMatchObject({
      presente: true,
      severidade: "moderada",
      frame_referencia: "front_ohs",
    });
    expect(dynamicValgus.implicacao_treino).toContain("gluteo medio");
    expect(buttWink).toMatchObject({
      presente: true,
      frame_referencia: "side_ohs",
    });
    expect(result.prescription_context.weak_muscles).toContain("gluteo medio");
    expect(result.prescription_context.contraindicated_exercises.join(" ")).toMatch(/agachamento profundo|pelve neutra/);
    expect(result.criterios_progressao_bn.liberado_para_pliometria).toBe(false);
  });

  it("maps shoulder protraction and overhead asymmetry to shoulder cautions", () => {
    const result = buildDeterministicAssessmentJson({
      frameRefs,
      observacoes_tecnicas: "Postura lateral com cifose e protrusao de ombro. Shoulder flexion mostra braco direito mais baixo.",
      historico_lesoes: "dor no ombro ao elevar",
      reason: "test",
    });

    expect(result.ohs_compensations.find((item: any) => item.key === "shoulder_protraction_kyphosis")).toMatchObject({
      presente: true,
    });
    expect(result.ohs_compensations.find((item: any) => item.key === "overhead_arm_asymmetry")).toMatchObject({
      presente: true,
      frame_referencia: "shoulder",
    });
    expect(result.prescription_context.caution_exercises.join(" ")).toMatch(/press overhead|remada alta|desenvolvimento/);
    expect(result.exercicios_contraindicados.join(" ")).toMatch(/press overhead|dips/);
  });

  it("does not invent OHS findings from generic pain alone", () => {
    const result = buildDeterministicAssessmentJson({
      frameRefs,
      queixa_principal: "dor no joelho depois de correr",
      observacoes_tecnicas: "sem observacao visual ainda",
      reason: "test",
    });

    expect(result.ohs_compensations.every((item: any) => item.presente === false)).toBe(true);
    expect(result.prescription_context.movement_restrictions).toContain("dor/regiao sensivel: joelho");
    expect(result.prescription_context.summary_for_prescription).toContain("Regioes de atencao relatadas");
  });

  it("normalizes AI output and preserves explicit frame references", () => {
    const normalized = normalizeAssessmentJson({
      frame_findings: [
        { frameId: "front_ohs", vista: "Vista Anterior OHS", findings: [{ gravidade: "Moderada", descricao: "joelho entra em valgo" }] },
      ],
      ohs_compensations: [
        {
          key: "dynamic_valgus",
          presente: true,
          severidade: "moderada",
          frame_referencia: "front_ohs",
          evidencia: "joelho entra em valgo",
        },
      ],
    }, frameRefs);

    expect(normalized.ohs_compensations).toHaveLength(7);
    expect(normalized.ohs_compensations.find((item: any) => item.key === "dynamic_valgus")).toMatchObject({
      presente: true,
      frame_referencia: "front_ohs",
      vista_referencia: "Vista Anterior OHS",
    });
    expect(normalized.prescription_context.engine).toBe(ASSESSMENT_ENGINE_VERSION);
  });
});
