export type OhsCompensationKey =
  | "dorsiflexion_limitation"
  | "dynamic_valgus"
  | "trunk_forward_lean"
  | "butt_wink"
  | "pelvic_drop_trendelenburg"
  | "shoulder_protraction_kyphosis"
  | "overhead_arm_asymmetry";

export type AssessmentSeverity = "ausente" | "incerta" | "leve" | "moderada" | "severa";

export interface FrameRef {
  frameId: string;
  vista: string;
}

export interface OhsCompensationDefinition {
  key: OhsCompensationKey;
  label: string;
  aliases: string[];
  visualSignals: string[];
  vistaKeywords: string[];
  likelyShortened: string[];
  likelyWeak: string[];
  movementRestrictions: string[];
  cautionPatterns: string[];
  trainingImplication: string;
}

export interface OhsCompensationResult {
  key: OhsCompensationKey;
  compensacao: string;
  presente: boolean;
  severidade: AssessmentSeverity;
  frame_referencia: string | null;
  vista_referencia: string | null;
  evidencia: string;
  implicacao_treino: string;
  musculos_encurtados?: string[];
  musculos_fracos?: string[];
  restricoes_movimento?: string[];
  padroes_cautela?: string[];
}

export interface BuildAssessmentInput {
  frameRefs: FrameRef[];
  queixa_principal?: unknown;
  historico_lesoes?: unknown;
  modalidade?: unknown;
  nivel?: unknown;
  peso_kg?: unknown;
  altura_cm?: unknown;
  cintura_cm?: unknown;
  percentual_gordura?: unknown;
  perimetros?: unknown;
  observacoes_tecnicas?: unknown;
  assessment_source?: unknown;
  protocol_hint?: unknown;
  expected_movements?: unknown;
  reason: string;
}

export interface NormalizeAssessmentOptions {
  fallbackReason?: string;
}
