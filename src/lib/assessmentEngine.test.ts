import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_ENGINE_VERSION,
  buildDeterministicAssessmentJson,
  normalizeAssessmentJson,
  OHS_COMPENSATIONS,
  POSTURAL_COMPENSATIONS,
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

  it("detects OHS compensations from objective frame metrics", () => {
    const normalized = normalizeAssessmentJson({
      frame_findings: [
        {
          frameId: "front_ohs",
          vista: "Vista Anterior OHS",
          metrics: {
            knee_valgus_angle_deg: 20,
          },
        },
        {
          frameId: "side_ohs",
          vista: "Vista Lateral OHS",
          pose_metrics: {
            posterior_pelvic_tilt_delta_deg: 16,
          },
        },
      ],
    }, frameRefs);

    const valgus = normalized.ohs_compensations.find((item: any) => item.key === "dynamic_valgus");
    const buttWink = normalized.ohs_compensations.find((item: any) => item.key === "butt_wink");

    expect(valgus).toMatchObject({
      presente: true,
      severidade: "severa",
      frame_referencia: "front_ohs",
      confidence: "alta",
      rule_id: "dynamic_valgus",
    });
    expect(valgus.evidence_signals.some((signal: any) => signal.source === "metric")).toBe(true);
    expect(buttWink).toMatchObject({
      presente: true,
      severidade: "moderada",
      confidence: "alta",
    });
    expect(normalized.assessment_confidence.has_metric_evidence).toBe(true);
    expect(normalized.prescription_context.needs_teacher_review).toBe(true);
  });

  it("builds deterministic assessment with frame metrics without calling vision AI", () => {
    const result = buildDeterministicAssessmentJson({
      frameRefs,
      frame_findings: [
        {
          frameId: "posterior_ohs",
          vista: "Vista Posterior OHS",
          measurements: {
            pelvic_drop_deg: 8,
          },
        },
      ],
      observacoes_tecnicas: "aluna sem dor no teste",
      reason: "test_metric_fallback",
    });

    const pelvicDrop = result.ohs_compensations.find((item: any) => item.key === "pelvic_drop_trendelenburg");

    expect(pelvicDrop).toMatchObject({
      presente: true,
      severidade: "moderada",
      frame_referencia: "posterior_ohs",
      confidence: "alta",
    });
    expect(result.frame_findings.find((item: any) => item.frameId === "posterior_ohs").measurements.pelvic_drop_deg).toBe(8);
    expect(result.quality_gate.status).toMatch(/ready|needs_teacher_review/);
    expect(result.score_funcional.value).toBeLessThan(10);
    expect(result.report_sections.contexto_prescricao.assessment_confidence).toBeTruthy();
  });

  it("sets quality gate to professional clearance when red flags are present", () => {
    const result = buildDeterministicAssessmentJson({
      frameRefs,
      historico_lesoes: "dor lombar com formigamento e irradiação para perna",
      observacoes_tecnicas: "sem leitura visual automatica",
      reason: "test_red_flag",
    });

    expect(result.red_yellow_flags.length).toBeGreaterThan(0);
    expect(result.quality_gate.status).toBe("needs_professional_clearance");
    expect(result.quality_gate.can_prescribe).toBe(false);
    expect(result.prescription_context.quality_gate.can_prescribe).toBe(false);
  });

  it("returns common postural compensations in the deterministic contract", () => {
    const result = buildDeterministicAssessmentJson({
      frameRefs,
      observacoes_tecnicas: [
        "Postura lateral com cabeça anteriorizada, ombros arredondados e hiperlordose por anteversão pélvica.",
        "Vista posterior com escápula alada leve, pelve desnivelada, pé pronado direito e joelho travado em hiperextensão.",
      ].join(" "),
      reason: "test_postural_compensations",
    });

    expect(result.postural_compensations.map((item: any) => item.key)).toEqual(POSTURAL_COMPENSATIONS.map((item) => item.key));
    for (const key of [
      "forward_head_posture",
      "rounded_shoulders_kyphosis",
      "scapular_asymmetry_winging",
      "anterior_pelvic_tilt_hyperlordosis",
      "pelvic_obliquity",
      "knee_hyperextension",
      "foot_pronation",
    ]) {
      expect(result.postural_compensations.find((item: any) => item.key === key)).toMatchObject({
        presente: true,
        rule_id: key,
      });
    }
    expect(result.prescription_context.postural_compensations).toHaveLength(8);
    expect(result.prescription_context.weak_muscles).toEqual(expect.arrayContaining(["gluteo medio", "serratil anterior"]));
    expect(result.prescription_context.contraindicated_exercises.join(" ")).toMatch(/overhead|hiperextensao lombar|impacto/);
    expect(result.score_postural.value).toBeLessThan(10);
  });

  it("detects postural compensations from objective metrics", () => {
    const normalized = normalizeAssessmentJson({
      frame_findings: [
        {
          frameId: "side_ohs",
          vista: "Postura lateral",
          metrics: {
            craniovertebral_angle_deg: 41,
            anterior_pelvic_tilt_deg: 18,
          },
        },
        {
          frameId: "posterior_ohs",
          vista: "Postura posterior",
          metrics: {
            navicular_drop_mm: 14,
            shoulder_height_diff_cm: 3.5,
          },
        },
      ],
    }, frameRefs);

    expect(normalized.postural_compensations.find((item: any) => item.key === "forward_head_posture")).toMatchObject({
      presente: true,
      severidade: "severa",
      confidence: "alta",
    });
    expect(normalized.postural_compensations.find((item: any) => item.key === "anterior_pelvic_tilt_hyperlordosis")).toMatchObject({
      presente: true,
      severidade: "moderada",
    });
    expect(normalized.postural_compensations.find((item: any) => item.key === "foot_pronation")).toMatchObject({
      presente: true,
      severidade: "moderada",
    });
    expect(normalized.assessment_confidence.signals.metric).toBeGreaterThanOrEqual(4);
  });
});
