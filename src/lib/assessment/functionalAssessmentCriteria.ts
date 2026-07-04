// ============================================================================
// Cérebro DETERMINÍSTICO da Avaliação Funcional — Overhead Squat + Postura estática
// ----------------------------------------------------------------------------
// Fundamentação (segundo a PubMed):
//  - Vídeo > tempo real em confiabilidade (Rogers 2019, ICC 0.60–0.93 vs 0.50–0.61)
//    https://doi.org/10.1519/JSC.0000000000002175
//  - OHS observacional detecta valgo de joelho (MKD) de forma confiável
//    (Post 2016, κ 0.60–0.76) https://doi.org/10.1123/jsr.2015-0178
//  - Fotogrametria confiável p/ postura (Saad 2011 https://doi.org/10.1016/j.jbmt.2011.03.005;
//    Nonnenmacher 2023 https://doi.org/10.1016/j.jbmt.2023.04.078)
//  - Vídeo 2D ≈ 3D no OHS (Soylu 2025 https://doi.org/10.3390/life15010080)
// Framework corretivo: continuum Inibir → Alongar → Ativar → Integrar (NASM CES / Janda).
//
// Este módulo NÃO usa IA: recebe as compensações OBSERVADAS (marcadas pela IA de visão
// OU pelo professor no checklist) e mapeia, por regra, para músculos prováveis + plano
// corretivo com exercícios que existem na biblioteca. É o "avaliador barato e explicável".
// ============================================================================

export type Severity = "leve" | "moderada" | "severa";
export type AssessmentView =
  | "ohs_anterior" | "ohs_lateral" | "postura_anterior" | "postura_posterior" | "postura_lateral";

export interface Compensation {
  id: string;
  view: AssessmentView;
  /** Nome técnico (para o professor). */
  label: string;
  /** Linguagem de aluno (para o laudo). */
  plainLabel: string;
  /** Músculos provavelmente ENCURTADOS/hiperativos (inibir + alongar). */
  overactive: string[];
  /** Músculos provavelmente ALONGADOS/inibidos (ativar + fortalecer). */
  underactive: string[];
  /** O que isso significa, em linguagem simples, para o aluno. */
  meaning: string;
  /** Plano corretivo — nomes que existem na biblioteca (biblioteca-only). */
  corrective: { alongar: string[]; ativar: string[] };
  /** Se o aluno relata DOR nesse padrão, vira linha vermelha → handoff ao professor. */
  redFlagIfPain?: boolean;
}

// ── OVERHEAD SQUAT — vista ANTERIOR (de frente) ────────────────────────────
const OHS_ANTERIOR: Compensation[] = [
  {
    id: "ohs_knees_in",
    view: "ohs_anterior",
    label: "Joelhos migram para dentro (valgo dinâmico / MKD)",
    plainLabel: "Joelhos caindo para dentro no agachamento",
    overactive: ["Adutores", "Bíceps femoral (porção lateral)", "Tensor da fáscia lata (TFL)", "Vasto lateral"],
    underactive: ["Glúteo médio", "Glúteo máximo", "Vasto medial (VMO)"],
    meaning:
      "Seus joelhos tendem a ceder para dentro quando você agacha. Isso costuma indicar quadril (glúteos) pouco ativo e parte interna da coxa dominante — com o tempo sobrecarrega o joelho. É totalmente treinável.",
    corrective: {
      alongar: ["Along. Adutores Bilateral", "Along. Tensor da Fascia Lata Solo"],
      ativar: ["Ponte de glúteo com mini band", "Caminhada lateral com mini band", "Concha (clamshell) com banda", "Cadeira Abdutora"],
    },
    redFlagIfPain: true,
  },
  {
    id: "ohs_knees_out",
    view: "ohs_anterior",
    label: "Joelhos migram para fora (varo dinâmico)",
    plainLabel: "Joelhos abrindo para fora no agachamento",
    overactive: ["Piriforme", "Bíceps femoral", "TFL"],
    underactive: ["Adutores", "Isquiotibiais mediais", "Glúteo máximo"],
    meaning:
      "Seus joelhos abrem para fora ao agachar — geralmente rotadores externos do quadril dominantes e parte interna da coxa pouco ativa. Vamos equilibrar.",
    corrective: {
      alongar: ["Along. Glúteo Cruzado Solo", "Along. Pigeon"],
      ativar: ["Cadeira Adutora", "Prancha de Copenhagen"],
    },
  },
  {
    id: "ohs_feet_flatten",
    view: "ohs_anterior",
    label: "Pés giram para fora / arco desaba (pronação)",
    plainLabel: "Pés abrindo ou 'chapando' no chão",
    overactive: ["Sóleo", "Gastrocnêmio lateral", "Bíceps femoral (curto)"],
    underactive: ["Tibial anterior", "Tibial posterior", "Gastrocnêmio medial"],
    meaning:
      "O pé abre ou o arco desaba na descida. Trabalhar tornozelo e panturrilha melhora a base do agachamento e protege joelho e quadril.",
    corrective: {
      alongar: ["Along. Panturrilha Unilateral"],
      ativar: ["Fisio Tornozelo: dorsiflexão com banda", "Apoio unipodal (single-leg stance)"],
    },
  },
  {
    id: "ohs_asymmetry",
    view: "ohs_anterior",
    label: "Deslocamento assimétrico de peso / quadril",
    plainLabel: "Peso indo mais para um lado",
    overactive: ["Cadeia lateral do lado que recebe peso"],
    underactive: ["Glúteo médio do lado oposto"],
    meaning:
      "Você desloca mais peso para um lado ao agachar. Vale olhar mobilidade e força de um lado só; trabalho unilateral costuma resolver.",
    corrective: {
      alongar: ["Along. Iliopsoas"],
      ativar: ["Apoio unipodal (single-leg stance)", "Terra romeno unipodal (single-leg RDL)"],
    },
    redFlagIfPain: true,
  },
];

// ── OVERHEAD SQUAT — vista LATERAL (de lado) ───────────────────────────────
const OHS_LATERAL: Compensation[] = [
  {
    id: "ohs_forward_lean",
    view: "ohs_lateral",
    label: "Inclinação excessiva de tronco à frente",
    plainLabel: "Tronco caindo muito para frente",
    overactive: ["Sóleo", "Gastrocnêmio", "Flexores do quadril", "Reto abdominal"],
    underactive: ["Tibial anterior", "Glúteo máximo", "Eretores da espinha"],
    meaning:
      "Seu tronco inclina bastante à frente no agachamento — normalmente tornozelo/panturrilha travados e glúteo pouco ativo. Mobilidade de tornozelo + ativação de glúteo deixam o agachamento mais ereto.",
    corrective: {
      alongar: ["Along. Panturrilha Unilateral", "Along. Iliopsoas"],
      ativar: ["Ponte de glúteo com mini band", "Fisio Tornozelo: dorsiflexão com banda"],
    },
  },
  {
    id: "ohs_lowback_arch",
    view: "ohs_lateral",
    label: "Lombar arqueia / anteversão pélvica",
    plainLabel: "Lombar arqueando (bumbum 'empinado')",
    overactive: ["Flexores do quadril", "Eretores da espinha", "Latíssimo do dorso"],
    underactive: ["Glúteo máximo", "Isquiotibiais", "Core profundo (transverso)"],
    meaning:
      "Sua lombar arqueia demais na descida — flexores do quadril encurtados e core/glúteo pouco ativos. Vamos soltar a frente do quadril e ativar o centro para proteger a coluna.",
    corrective: {
      alongar: ["Along. Iliopsoas", "Along. Reto Femoral Solo"],
      ativar: ["Prancha frontal", "Dead bug", "Ponte de glúteo com mini band"],
    },
    redFlagIfPain: true,
  },
  {
    id: "ohs_lowback_round",
    view: "ohs_lateral",
    label: "Lombar arredonda / retroversão pélvica ('butt wink')",
    plainLabel: "Lombar arredondando embaixo do agachamento",
    overactive: ["Isquiotibiais", "Adutor magno", "Reto abdominal"],
    underactive: ["Flexores do quadril", "Eretores da espinha"],
    meaning:
      "No fim da descida sua lombar arredonda ('butt wink'). Costuma ser isquiotibiais/mobilidade de quadril e controle do core. Ajustamos amplitude e mobilidade.",
    corrective: {
      alongar: ["Along. Posterior Unilateral Solo", "Along. Adutores Flexionado (Frog)"],
      ativar: ["Bird dog", "Perdigueiro Alternado"],
    },
    redFlagIfPain: true,
  },
  {
    id: "ohs_arms_fall",
    view: "ohs_lateral",
    label: "Braços caem à frente",
    plainLabel: "Braços caindo para frente (não ficam acima da cabeça)",
    overactive: ["Latíssimo do dorso", "Peitoral maior", "Peitoral menor", "Redondo maior"],
    underactive: ["Trapézio médio e inferior", "Rombóides", "Manguito rotador"],
    meaning:
      "Seus braços não sustentam acima da cabeça e caem à frente — típico de peito/dorsal encurtados e músculos das costas/ombro pouco ativos. Melhora muito a postura de ombro no dia a dia também.",
    corrective: {
      alongar: ["Along. Peitoral Bilateral Espaldar", "Along. Dorsal Unilateral Espaldar"],
      ativar: ["Face pull com banda", "Band pull-apart", "Rotação externa de ombro com banda", "Wall slides (deslizar na parede)"],
    },
  },
];

// ── POSTURA ESTÁTICA — vista LATERAL ───────────────────────────────────────
const POSTURA_LATERAL: Compensation[] = [
  {
    id: "post_forward_head",
    view: "postura_lateral",
    label: "Cabeça anteriorizada (forward head)",
    plainLabel: "Cabeça projetada para frente",
    overactive: ["Trapézio superior", "Elevador da escápula", "Esternocleidomastóideo", "Suboccipitais"],
    underactive: ["Flexores profundos do pescoço"],
    meaning:
      "Sua cabeça fica projetada à frente da linha dos ombros — muito comum por celular/computador. Fortalecer o pescoço profundo e soltar a nuca alivia tensão e dor de cabeça.",
    corrective: {
      alongar: ["Along. Levantador da Escápula"],
      ativar: ["Fisio Cervical: chin tuck (retração cervical)", "Fisio Cervical: flexores profundos do pescoço"],
    },
  },
  {
    id: "post_kyphosis",
    view: "postura_lateral",
    label: "Ombros protraídos / hipercifose torácica",
    plainLabel: "Ombros arredondados / costas curvadas para frente",
    overactive: ["Peitoral maior", "Peitoral menor", "Latíssimo do dorso", "Trapézio superior"],
    underactive: ["Trapézio médio e inferior", "Rombóides", "Serrátil anterior"],
    meaning:
      "Seus ombros rolam para frente e a parte de cima das costas arredonda. Abrir o peito e fortalecer as costas melhora a postura, a respiração e o desempenho em puxadas/desenvolvimento.",
    corrective: {
      alongar: ["Along. Peitoral Bilateral Espaldar", "Along. Peitoral Menor"],
      ativar: ["Face pull com banda", "Band pull-apart", "Extensão Y-T", "Wall slides (deslizar na parede)"],
    },
  },
  {
    id: "post_apt",
    view: "postura_lateral",
    label: "Anteversão pélvica (lordose lombar aumentada)",
    plainLabel: "Quadril 'empinado' / lombar arqueada em pé",
    overactive: ["Flexores do quadril", "Eretores da espinha", "Reto femoral"],
    underactive: ["Glúteo máximo", "Isquiotibiais", "Core profundo (transverso)"],
    meaning:
      "Em pé, seu quadril tende a inclinar à frente e a lombar arqueia. Soltar a frente do quadril e ativar glúteo/core alivia a lombar e melhora o agachamento.",
    corrective: {
      alongar: ["Along. Iliopsoas", "Along. Reto Femoral Solo"],
      ativar: ["Ponte de glúteo com mini band", "Prancha frontal", "Dead bug"],
    },
    redFlagIfPain: true,
  },
];

// ── POSTURA ESTÁTICA — vista ANTERIOR / POSTERIOR ──────────────────────────
const POSTURA_FRENTE_COSTAS: Compensation[] = [
  {
    id: "post_shoulder_asym",
    view: "postura_anterior",
    label: "Ombros/escápulas em altura assimétrica",
    plainLabel: "Um ombro mais alto que o outro",
    overactive: ["Trapézio superior do lado elevado"],
    underactive: ["Estabilizadores escapulares do lado oposto"],
    meaning:
      "Um ombro fica mais alto que o outro. Costuma ser hábito postural / lado dominante; trabalho de estabilização escapular equilibra.",
    corrective: {
      alongar: ["Along. Levantador da Escápula"],
      ativar: ["Face pull com banda", "Serrote em pé"],
    },
  },
  {
    id: "post_pelvis_asym",
    view: "postura_posterior",
    label: "Assimetria de quadril / báscula pélvica lateral",
    plainLabel: "Quadril mais alto de um lado",
    overactive: ["Quadrado lombar do lado elevado", "Adutores do lado oposto"],
    underactive: ["Glúteo médio do lado que desce"],
    meaning:
      "Seu quadril fica mais alto de um lado. Fortalecer o glúteo médio e mobilizar a lateral do tronco costuma nivelar.",
    corrective: {
      alongar: ["Along. Dorsal e Quadrado Lombar Unilateral Espaldar"],
      ativar: ["Caminhada lateral com mini band", "Prancha Lateral"],
    },
    redFlagIfPain: true,
  },
  {
    id: "post_knee_valgus_static",
    view: "postura_anterior",
    label: "Joelhos em valgo estático (em X)",
    plainLabel: "Joelhos apontando para dentro em pé",
    overactive: ["Adutores", "TFL"],
    underactive: ["Glúteo médio", "Glúteo máximo"],
    meaning:
      "Em pé seus joelhos já apontam levemente para dentro. Fortalecer o quadril alinha a coluna do joelho e reduz risco em corrida e agachamento.",
    corrective: {
      alongar: ["Along. Adutores Bilateral"],
      ativar: ["Ponte de glúteo com mini band", "Concha (clamshell) com banda"],
    },
  },
];

export const OHS_COMPENSATIONS: Compensation[] = [...OHS_ANTERIOR, ...OHS_LATERAL];
export const POSTURE_COMPENSATIONS: Compensation[] = [...POSTURA_LATERAL, ...POSTURA_FRENTE_COSTAS];
export const ALL_COMPENSATIONS: Compensation[] = [...OHS_COMPENSATIONS, ...POSTURE_COMPENSATIONS];

const BY_ID: Record<string, Compensation> = Object.fromEntries(ALL_COMPENSATIONS.map((c) => [c.id, c]));
export const getCompensation = (id: string): Compensation | undefined => BY_ID[id];

export interface DetectedCompensation { id: string; severity: Severity; note?: string; hasPain?: boolean; }

/** Resumo de desequilíbrios musculares (dedup) a partir das compensações observadas. */
export function muscleImbalanceSummary(detected: DetectedCompensation[]): { encurtados: string[]; inibidos: string[] } {
  const enc = new Set<string>(), ini = new Set<string>();
  for (const d of detected) {
    const c = BY_ID[d.id];
    if (!c) continue;
    c.overactive.forEach((m) => enc.add(m));
    c.underactive.forEach((m) => ini.add(m));
  }
  return { encurtados: [...enc], inibidos: [...ini] };
}

/** Plano corretivo consolidado (dedup), priorizando o que mais aparece. */
export function buildCorrectivePlan(detected: DetectedCompensation[]): { alongar: string[]; ativar: string[] } {
  const along = new Map<string, number>(), ativ = new Map<string, number>();
  const sevW: Record<Severity, number> = { leve: 1, moderada: 2, severa: 3 };
  for (const d of detected) {
    const c = BY_ID[d.id];
    if (!c) continue;
    const w = sevW[d.severity] || 1;
    c.corrective.alongar.forEach((e) => along.set(e, (along.get(e) || 0) + w));
    c.corrective.ativar.forEach((e) => ativ.set(e, (ativ.get(e) || 0) + w));
  }
  const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([e]) => e);
  return { alongar: top(along, 6), ativar: top(ativ, 6) };
}

/** Há linha vermelha? (dor num padrão marcado como red flag → handoff). */
export function hasRedFlag(detected: DetectedCompensation[]): boolean {
  return detected.some((d) => d.hasPain && BY_ID[d.id]?.redFlagIfPain);
}

/** Nota geral 0–100 do movimento (didática, não diagnóstica): penaliza por severidade. */
export function movementScore(detected: DetectedCompensation[]): number {
  const pen: Record<Severity, number> = { leve: 4, moderada: 9, severa: 16 };
  const total = detected.reduce((s, d) => s + (pen[d.severity] || 0), 0);
  return Math.max(40, 100 - total);
}

export const ASSESSMENT_CITATIONS = [
  { ref: "Rogers et al., 2019 — vídeo é mais confiável que avaliação em tempo real", doi: "10.1519/JSC.0000000000002175" },
  { ref: "Post et al., 2016 — OHS observacional detecta valgo de joelho (MKD)", doi: "10.1123/jsr.2015-0178" },
  { ref: "Saad et al., 2011 — fotogrametria confiável para desvios posturais", doi: "10.1016/j.jbmt.2011.03.005" },
  { ref: "Soylu et al., 2025 — vídeo 2D concorda com 3D no OHS", doi: "10.3390/life15010080" },
];
