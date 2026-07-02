import type {
  AssessmentSeverity,
  BuildAssessmentInput,
  EvidenceSignal,
  FrameRef,
  NormalizeAssessmentOptions,
  OhsCompensationDefinition,
  OhsCompensationResult,
} from "./types.ts";

export const ASSESSMENT_ENGINE_VERSION = "bn_functional_assessment_engine_v1";

// Method references used to turn findings into training-safe rules:
// - NASM Overhead Squat Assessment + solutions table (views, compensations, likely muscles).
// - Postural assessment literature: anterior/lateral/posterior visual review and photogrammetric framing.
// - BN internal sequence: posture, air/OH squat, toe touch, lunge, shoulder flexion, gait/march, single-leg balance.
export const ASSESSMENT_METHOD_SOURCES = [
  {
    id: "nasm_ohsa",
    label: "NASM Overhead Squat Assessment / solutions table",
    url: "https://blog.nasm.org/certified-personal-trainer/how-to-perform-an-overhead-squat-assessment-osa",
  },
  {
    id: "physiopedia_postural_assessment",
    label: "Sports screening postural assessment: anterior, lateral and posterior views",
    url: "https://www.physio-pedia.com/Sports_Screening%3A_Postural_Assessment",
  },
  {
    id: "pmc_postural_methods",
    label: "Postural assessment methods for sports persons / photographic views",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4064851/",
  },
  {
    id: "pmc_ohsa_running_kinematics",
    label: "Overhead squat assessment reflects ankle, knee, hip, pelvis and torso kinematics",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10515420/",
  },
  {
    id: "pmc_upper_body_photogrammetry",
    label: "Photogrammetric assessment of head, neck, shoulder and thoracic posture",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5446097/",
  },
  {
    id: "pubmed_forward_head_assessment",
    label: "Assessment of forward head posture in females",
    url: "https://pubmed.ncbi.nlm.nih.gov/23963268/",
  },
  {
    id: "pmc_sagittal_posture_misalignments",
    label: "Non-structural misalignments of body posture in the sagittal plane",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5836359/",
  },
  {
    id: "bn_historical_drive_dataset",
    label: "BN historical Drive folder, anonymized frame structure only",
    url: "https://drive.google.com/drive/folders/1Hj-zReZTuL7Oq7HS4LwNzIq6stTmX6xN",
  },
];

export const POSTURAL_COMPENSATIONS: OhsCompensationDefinition[] = [
  {
    key: "forward_head_posture",
    label: "Anteriorizacao da cabeca / cervical",
    aliases: ["cabeca anteriorizada", "anteriorizacao da cabeca", "forward head", "cervical anterior", "queixo a frente", "craniovertebral"],
    visualSignals: ["cabeca a frente", "queixo projetado", "cervical anteriorizada", "orelha a frente do ombro"],
    vistaKeywords: ["postura", "lateral", "vista lateral"],
    metricRules: [
      { field: "craniovertebral_angle_deg", direction: "lt", mild: 50, moderate: 46, severe: 42, message: "angulo craniovertebral reduzido" },
      { field: "head_forward_cm", direction: "gt", mild: 2, moderate: 4, severe: 6, message: "cabeca anteriorizada em relacao ao tronco" },
    ],
    likelyShortened: ["suboccipitais", "esternocleidomastoideo", "elevador da escapula"],
    likelyWeak: ["flexores profundos cervicais", "trapezio inferior"],
    movementRestrictions: ["controle cervical", "posicao de cabeca em empurrar/puxar"],
    cautionPatterns: ["carga axial alta com cervical projetada", "overhead pesado sem controle cervical"],
    trainingImplication: "Priorizar alinhamento cervical, controle de escápulas e cues de coluna neutra; evitar carga axial pesada se a cabeca projeta com fadiga.",
  },
  {
    key: "rounded_shoulders_kyphosis",
    label: "Ombros arredondados / cifose toracica",
    aliases: ["ombros arredondados", "ombros a frente", "cifose", "hipercifose", "toracica", "protrusao de ombro", "protração de ombro"],
    visualSignals: ["ombros projetados", "cifose aumentada", "dorso arredondado", "peitoral encurtado"],
    vistaKeywords: ["postura", "lateral", "posterior", "shoulder flexion"],
    metricRules: [
      { field: "thoracic_kyphosis_deg", direction: "gt", mild: 42, moderate: 50, severe: 60, message: "cifose toracica elevada" },
      { field: "shoulder_protraction_cm", direction: "gt", mild: 3, moderate: 5, severe: 8, message: "ombros projetados a frente" },
    ],
    likelyShortened: ["peitoral menor", "peitoral maior", "grande dorsal"],
    likelyWeak: ["trapezio medio", "trapezio inferior", "romboides", "serratil anterior"],
    movementRestrictions: ["extensao toracica", "controle escapular", "flexao de ombro"],
    cautionPatterns: ["dips", "remada alta", "desenvolvimento atras da nuca", "press overhead pesado"],
    trainingImplication: "Dar prioridade a mobilidade toracica, retração/depressão escapular e puxadas/remadas controladas antes de press overhead intenso.",
  },
  {
    key: "scapular_asymmetry_winging",
    label: "Assimetria escapular / escapula alada",
    aliases: ["escapula alada", "escapular", "assimetria escapular", "escapula alta", "escapula baixa", "winging"],
    visualSignals: ["escapula alada", "escapulas assimetricas", "borda medial aparente", "ombro desnivelado"],
    vistaKeywords: ["postura", "posterior", "shoulder flexion"],
    metricRules: [
      { field: "scapular_winging_score", direction: "gt", mild: 1, moderate: 2, severe: 3, message: "alteracao escapular observada" },
      { field: "shoulder_height_diff_cm", direction: "abs_gt", mild: 1.5, moderate: 3, severe: 5, message: "desnivel de ombros/escapulas" },
    ],
    likelyShortened: ["elevador da escapula", "peitoral menor"],
    likelyWeak: ["serratil anterior", "trapezio inferior", "manguito rotador"],
    movementRestrictions: ["ritmo escapulo-umeral", "estabilidade de ombro"],
    cautionPatterns: ["overhead instavel", "kipping", "dips", "remada alta"],
    trainingImplication: "Incluir serratil, trapézio inferior e controle escapular; preferir pegadas neutras e amplitude sem dor em empurrar/puxar.",
  },
  {
    key: "anterior_pelvic_tilt_hyperlordosis",
    label: "Anteversao pelvica / hiperlordose lombar",
    aliases: ["anteversao", "anteversão", "hiperlordose", "lordose aumentada", "pelve anterior", "anterior pelvic tilt"],
    visualSignals: ["pelve em anteversao", "lordose aumentada", "abdome projetado", "costelas abertas"],
    vistaKeywords: ["postura", "lateral", "vista lateral"],
    metricRules: [
      { field: "anterior_pelvic_tilt_deg", direction: "gt", mild: 10, moderate: 15, severe: 22, message: "anteversao pelvica elevada" },
      { field: "lumbar_lordosis_deg", direction: "gt", mild: 45, moderate: 55, severe: 65, message: "lordose lombar aumentada" },
    ],
    likelyShortened: ["flexores de quadril", "eretores lombares", "reto femoral"],
    likelyWeak: ["gluteo maximo", "abdome", "isquiotibiais"],
    movementRestrictions: ["controle lombo-pelvico", "extensao de quadril", "posicao de costelas"],
    cautionPatterns: ["hiperextensao lombar", "carga axial alta", "ponte lombar compensada"],
    trainingImplication: "Priorizar core anti-extensao, gluteo e controle costela-pelve; evitar progressao de carga com hiperextensao lombar.",
  },
  {
    key: "pelvic_obliquity",
    label: "Obliquidade pelvica / desnivel de pelve",
    aliases: ["pelve desnivelada", "obliquidade pelvica", "crista iliaca", "quadril mais alto", "pelve alta", "pelve baixa"],
    visualSignals: ["cristas iliacas desniveladas", "pelve inclinada", "quadril desnivelado"],
    vistaKeywords: ["postura", "posterior", "frontal", "vista posterior", "vista frontal"],
    metricRules: [
      { field: "pelvic_obliquity_deg", direction: "abs_gt", mild: 3, moderate: 6, severe: 10, message: "obliquidade pelvica elevada" },
      { field: "iliac_crest_height_diff_cm", direction: "abs_gt", mild: 1, moderate: 2, severe: 3.5, message: "desnivel entre cristas iliacas" },
    ],
    likelyShortened: ["quadrado lombar", "tfl", "adutores"],
    likelyWeak: ["gluteo medio", "gluteo minimo", "core lateral"],
    movementRestrictions: ["controle frontal de pelve", "apoio unilateral"],
    cautionPatterns: ["unilateral pesado", "corrida intensa", "saltos unilaterais"],
    trainingImplication: "Usar progressao unilateral com controle de pelve e fortalecimento de abdutores/core lateral antes de volume alto de corrida ou unilateral pesado.",
  },
  {
    key: "knee_hyperextension",
    label: "Hiperextensao de joelho / recurvatum",
    aliases: ["hiperextensao de joelho", "hiperextensão de joelho", "recurvatum", "joelho para tras", "joelho travado"],
    visualSignals: ["joelho hiperestendido", "joelho travado", "recurvatum em apoio"],
    vistaKeywords: ["postura", "lateral", "vista lateral"],
    metricRules: [
      { field: "knee_hyperextension_deg", direction: "gt", mild: 3, moderate: 6, severe: 10, message: "hiperextensao de joelho em apoio" },
    ],
    likelyShortened: ["gastrocnemio", "isquiotibiais distais"],
    likelyWeak: ["quadriceps controle terminal", "gluteo maximo", "soleo"],
    movementRestrictions: ["controle terminal de joelho", "propriocepcao em apoio"],
    cautionPatterns: ["travamento de joelho sob carga", "saltos sem controle", "leg press com hiperextensao"],
    trainingImplication: "Treinar controle terminal sem travar joelho, propriocepcao e cues de joelho suave em leg press/agachamento.",
  },
  {
    key: "foot_pronation",
    label: "Pronacao excessiva / arco medial baixo",
    aliases: ["pronacao", "pronação", "pronado", "pe pronado", "pé pronado", "pe plano", "pé plano", "arco baixo", "calcaneo valgo", "calcâneo valgo"],
    visualSignals: ["arco medial baixo", "pe colapsa", "pe pronado", "calcaneo em valgo", "pronacao excessiva"],
    vistaKeywords: ["postura", "posterior", "frontal", "vista posterior", "vista frontal"],
    metricRules: [
      { field: "rearfoot_valgus_deg", direction: "gt", mild: 5, moderate: 8, severe: 12, message: "valgo de retropé/pronacao elevada" },
      { field: "navicular_drop_mm", direction: "gt", mild: 8, moderate: 12, severe: 16, message: "queda navicular/arco medial reduzido" },
    ],
    likelyShortened: ["fibulares", "gastrocnemio lateral"],
    likelyWeak: ["tibial posterior", "intrinsecos do pe", "gluteo medio"],
    movementRestrictions: ["controle do arco plantar", "alinhamento pe-joelho"],
    cautionPatterns: ["saltos repetidos", "corrida intensa sem controle de pe", "agachamento com colapso medial"],
    trainingImplication: "Integrar controle do arco, pe tripode e alinhamento joelho-pe; cautela com impacto se vier junto de valgo/dor no joelho.",
  },
  {
    key: "foot_supination",
    label: "Supinacao excessiva / apoio lateral",
    aliases: ["supinacao", "supinação", "supinado", "pe supinado", "pé supinado", "apoio lateral", "arco alto", "pes cavos", "pé cavo", "calcaneo varo", "calcâneo varo"],
    visualSignals: ["apoio lateral", "arco alto", "retrope em varo", "pe rigido", "pe supinado"],
    vistaKeywords: ["postura", "posterior", "frontal", "vista posterior", "vista frontal"],
    metricRules: [
      { field: "rearfoot_varus_deg", direction: "gt", mild: 4, moderate: 7, severe: 11, message: "varo de retropé/supinacao elevada" },
      { field: "lateral_foot_loading_ratio", direction: "ratio_gt", mild: 0.6, moderate: 0.7, severe: 0.8, message: "apoio lateral excessivo do pe" },
    ],
    likelyShortened: ["tibial posterior", "gastrocnemio medial", "fascia plantar"],
    likelyWeak: ["fibulares", "intrinsecos do pe", "controle eversor"],
    movementRestrictions: ["mobilidade de tornozelo/pe", "absorção de impacto"],
    cautionPatterns: ["pliometria de alto impacto", "corrida com dor em canela/tornozelo", "mudanca de direcao"],
    trainingImplication: "Trabalhar mobilidade e controle eversor; reduzir impacto quando houver rigidez, dor em canela ou baixa absorcao.",
  },
];

export const OHS_COMPENSATIONS: OhsCompensationDefinition[] = [
  {
    key: "dorsiflexion_limitation",
    label: "Limitacao de dorsiflexao de tornozelo",
    aliases: ["dorsiflex", "tornozelo", "adm tornozelo", "mobilidade tornozelo", "calcanhar sobe", "heel rise", "ankle"],
    visualSignals: ["calcanhar sobe", "pe roda para fora", "profundidade limitada", "tibia vertical", "tornozelo limitado"],
    vistaKeywords: ["lateral ohs", "air squat", "squat", "vista lateral", "toe touch"],
    metricRules: [
      { field: "ankle_dorsiflexion_deg", direction: "lt", mild: 38, moderate: 32, severe: 25, message: "dorsiflexao de tornozelo abaixo do esperado" },
      { field: "heel_rise", direction: "truthy", mild: 1, moderate: 1, severe: 1, message: "calcanhar perde contato no agachamento" },
      { field: "squat_depth_ratio", direction: "lt", mild: 0.9, moderate: 0.75, severe: 0.6, message: "profundidade limitada em padrao de agachar" },
    ],
    likelyShortened: ["soleo", "gastrocnemio", "isquiotibiais"],
    likelyWeak: ["tibial anterior", "gluteo maximo"],
    movementRestrictions: ["dorsiflexao de tornozelo", "profundidade de agachamento"],
    cautionPatterns: ["agachamento profundo carregado", "pliometria de alto impacto", "corrida intensa se houver dor"],
    trainingImplication: "Priorizar mobilidade de tornozelo e variacoes de agachamento com menor exigencia de dorsiflexao; considerar elevacao provisoria de calcanhar e evitar progressao agressiva de carga axial.",
  },
  {
    key: "dynamic_valgus",
    label: "Valgo dinamico de joelho",
    aliases: ["valgo", "joelho entra", "colapso medial", "valgus", "joelho medial", "joelhos para dentro"],
    visualSignals: ["joelho colapsa", "joelho entra", "valgo bilateral", "valgo direito", "valgo esquerdo"],
    vistaKeywords: ["anterior ohs", "vista anterior", "air squat", "lunge", "step down"],
    metricRules: [
      { field: "knee_valgus_angle_deg", direction: "gt", mild: 8, moderate: 12, severe: 18, message: "angulo de valgo dinamico acima do esperado" },
      { field: "knee_to_foot_deviation_deg", direction: "abs_gt", mild: 8, moderate: 12, severe: 18, message: "joelho desalinhado em relacao ao pe" },
      { field: "knee_distance_ratio", direction: "lt", mild: 0.92, moderate: 0.84, severe: 0.74, message: "distancia entre joelhos reduz em relacao ao quadril/pe" },
    ],
    likelyShortened: ["adutores", "tfl", "biceps femoral cabeca curta", "gastrocnemio lateral"],
    likelyWeak: ["gluteo medio", "gluteo maximo", "vasto medial", "rotadores externos"],
    movementRestrictions: ["controle frontal de joelho", "controle de quadril"],
    cautionPatterns: ["afundo pesado", "agachamento profundo carregado", "saltos", "mudanca de direcao"],
    trainingImplication: "Adicionar ativacao/fortalecimento de gluteo medio e rotadores externos, controle motor com cue de joelhos para fora e cautela com agachamentos/afundos pesados.",
  },
  {
    key: "trunk_forward_lean",
    label: "Inclinacao excessiva de tronco",
    aliases: ["inclinacao", "inclinação", "tronco a frente", "tronco muito a frente", "forward lean", "tibiotronco", "tibia tronco"],
    visualSignals: ["tronco muito a frente", "angulo tibiotronco alterado", "inclina excessivamente"],
    vistaKeywords: ["lateral ohs", "air squat", "vista lateral"],
    metricRules: [
      { field: "trunk_tibia_angle_diff_deg", direction: "abs_gt", mild: 12, moderate: 18, severe: 28, message: "tronco e tibia deixam de ficar aproximadamente paralelos" },
      { field: "trunk_forward_angle_deg", direction: "gt", mild: 35, moderate: 45, severe: 58, message: "inclinacao anterior de tronco elevada" },
    ],
    likelyShortened: ["soleo", "gastrocnemio", "flexores de quadril", "reto abdominal"],
    likelyWeak: ["tibial anterior", "gluteo maximo", "eretores de espinha"],
    movementRestrictions: ["controle lombo-pelvico", "dorsiflexao de tornozelo", "extensao de quadril"],
    cautionPatterns: ["carga axial alta", "terra pesado", "agachamento livre pesado"],
    trainingImplication: "Reduzir braco de momento lombar, priorizar core lombo-pelvico e variacoes mais verticalizadas/estaveis antes de carga livre pesada.",
  },
  {
    key: "butt_wink",
    label: "Retroversao pelvica / butt wink",
    aliases: ["butt wink", "retrovers", "pelve no fundo", "pelve_fundo", "perde coluna neutra", "arredonda lombar"],
    visualSignals: ["retroversao no fundo", "arredonda lombar", "pelve roda no final", "perde neutro"],
    vistaKeywords: ["lateral ohs", "vista lateral", "air squat"],
    metricRules: [
      { field: "posterior_pelvic_tilt_delta_deg", direction: "gt", mild: 8, moderate: 14, severe: 22, message: "retroversao pelvica aumenta no fundo do agachamento" },
      { field: "lumbar_flexion_delta_deg", direction: "gt", mild: 8, moderate: 14, severe: 22, message: "coluna lombar perde neutralidade no fundo" },
    ],
    likelyShortened: ["isquiotibiais", "adutores", "posterior de coxa"],
    likelyWeak: ["core profundo", "gluteo maximo", "estabilizadores lombares"],
    movementRestrictions: ["amplitude de agachamento", "mobilidade de quadril", "estabilidade lombar"],
    cautionPatterns: ["agachamento abaixo do ponto neutro", "carga axial alta", "terra pesado"],
    trainingImplication: "Limitar amplitude ao ponto de controle pelvico, trabalhar mobilidade de quadril/isquiotibiais e evitar sobrecarga axial com perda de coluna neutra.",
  },
  {
    key: "pelvic_drop_trendelenburg",
    label: "Drop de pelve / Trendelenburg funcional",
    aliases: ["drop", "trendelenburg", "pelve cai", "queda da pelve", "quadril cai", "instabilidade pelvica"],
    visualSignals: ["pelve cai", "drop direito", "drop esquerdo", "trendelenburg", "perde nivel pelvico"],
    vistaKeywords: ["posterior ohs", "vista posterior", "lunge", "equilibrio", "unipodal", "marcha"],
    metricRules: [
      { field: "pelvic_drop_deg", direction: "abs_gt", mild: 4, moderate: 7, severe: 11, message: "queda/inclinacao pelvica acima do esperado" },
      { field: "single_leg_pelvic_drop_deg", direction: "abs_gt", mild: 4, moderate: 7, severe: 11, message: "queda pelvica em apoio unipodal" },
    ],
    likelyShortened: ["tfl", "adutores"],
    likelyWeak: ["gluteo medio", "gluteo minimo", "abdutores de quadril"],
    movementRestrictions: ["controle unilateral de pelve", "estabilidade de quadril"],
    cautionPatterns: ["unilateral pesado", "corrida intensa", "saltos unilaterais"],
    trainingImplication: "Priorizar abdutores de quadril e exercicios unilaterais progressivos, com regressao quando houver perda de alinhamento pelvico.",
  },
  {
    key: "shoulder_protraction_kyphosis",
    label: "Protrusao de ombro / cifose toracica",
    aliases: ["protrusao", "protrusão", "cifose", "toracica", "torácica", "ombros a frente", "escapula alada", "escapular"],
    visualSignals: ["ombros projetados", "cifose aumentada", "escapula alada", "protrusao bilateral"],
    vistaKeywords: ["postura", "lateral", "shoulder flexion", "posterior"],
    metricRules: [
      { field: "thoracic_kyphosis_deg", direction: "gt", mild: 42, moderate: 50, severe: 60, message: "cifose toracica elevada" },
      { field: "shoulder_protraction_cm", direction: "gt", mild: 3, moderate: 5, severe: 8, message: "protrusao de ombros aumentada" },
      { field: "scapular_winging_score", direction: "gt", mild: 1, moderate: 2, severe: 3, message: "alteracao escapular observada" },
    ],
    likelyShortened: ["peitoral menor", "grande dorsal", "elevador da escapula"],
    likelyWeak: ["trapezio medio", "trapezio inferior", "romboides", "serrtil anterior", "manguito rotador"],
    movementRestrictions: ["mobilidade toracica", "controle escapular", "flexao de ombro"],
    cautionPatterns: ["press overhead pesado", "dips", "remada alta", "barra atras da nuca"],
    trainingImplication: "Adicionar trabalho escapular, mobilidade toracica e fortalecimento de trapezio inferior/romboides/serratil; cautela com pressoes intensas se houver limitacao overhead.",
  },
  {
    key: "overhead_arm_asymmetry",
    label: "Assimetria de bracos no overhead",
    aliases: ["assimetria de braco", "assimetria de braço", "braco mais baixo", "bracos assimetricos", "overhead assimetrico", "ombro mais baixo"],
    visualSignals: ["um braco cai", "braco direito mais baixo", "braco esquerdo mais baixo", "assimetria overhead"],
    vistaKeywords: ["shoulder flexion", "overhead", "anterior ohs", "posterior ohs"],
    metricRules: [
      { field: "arm_elevation_diff_deg", direction: "abs_gt", mild: 8, moderate: 14, severe: 22, message: "diferenca de elevacao entre bracos" },
      { field: "shoulder_flexion_left_deg", direction: "lt", mild: 170, moderate: 155, severe: 140, message: "flexao de ombro esquerdo limitada" },
      { field: "shoulder_flexion_right_deg", direction: "lt", mild: 170, moderate: 155, severe: 140, message: "flexao de ombro direito limitada" },
    ],
    likelyShortened: ["grande dorsal", "peitoral menor", "capsula posterior de ombro"],
    likelyWeak: ["manguito rotador", "serrtil anterior", "trapezio inferior"],
    movementRestrictions: ["flexao de ombro", "rotacao externa de ombro", "mobilidade toracica"],
    cautionPatterns: ["desenvolvimento pesado", "snatch", "overhead squat carregado"],
    trainingImplication: "Avaliar mobilidade unilateral de ombro/toracica, incluir mobilidade do lado limitado e exercicios unilaterais para equalizar o padrao.",
  },
];

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function clean(value: unknown) {
  return String(value ?? "").replace(/[^\x20-\x7E\u00C0-\u017F]/g, "");
}

function normalizeText(value: unknown) {
  const raw = typeof value === "string" ? value : stringifyForSearch(value);
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");
}

function stringifyForSearch(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyForSearch).join(" ");
  if (isRecord(value)) return Object.values(value).map(stringifyForSearch).join(" ");
  return "";
}

function normalizeSeverity(value: unknown): AssessmentSeverity {
  const raw = normalizeText(value);
  if (/(sever|grave|alto|alta|evidente|acentuad)/.test(raw)) return "severa";
  if (/(moder|medio|media|parcial|claro)/.test(raw)) return "moderada";
  if (/(leve|baixo|baixa|discret)/.test(raw)) return "leve";
  if (/(ausente|sem alteracao|nao observado|normal|adequad|estavel|simetric)/.test(raw)) return "ausente";
  if (/(incert|duvid|baixa confianca|insuficiente)/.test(raw)) return "incerta";
  return raw ? "moderada" : "incerta";
}

const severityRank: Record<AssessmentSeverity, number> = {
  ausente: 0,
  incerta: 0,
  leve: 1,
  moderada: 2,
  severa: 3,
};

function strongestSeverity(values: AssessmentSeverity[]) {
  return values.reduce<AssessmentSeverity>((best, current) =>
    severityRank[current] > severityRank[best] ? current : best, "ausente");
}

function confidenceRank(value: EvidenceSignal["confidence"]) {
  return value === "alta" ? 3 : value === "media" ? 2 : 1;
}

function strongestConfidence(signals: EvidenceSignal[]) {
  if (signals.some((signal) => confidenceRank(signal.confidence) >= 3)) return "alta" as const;
  if (signals.some((signal) => confidenceRank(signal.confidence) >= 2)) return "media" as const;
  return "baixa" as const;
}

function splitList(value: unknown): string[] {
  return clean(value)
    .split(/[;\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function flattenUnique(values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map(clean).filter(Boolean))];
}

function readPath(root: unknown, path: string[]) {
  let current = root;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function metricContainers(frame: any) {
  return [
    frame?.metrics,
    frame?.measurements,
    frame?.pose_metrics,
    frame?.landmark_metrics,
    frame?.analysis_metrics,
    frame?.metadata?.metrics,
  ].filter(isRecord);
}

function readMetric(frame: any, field: string): unknown {
  const aliases = [
    field,
    field.replace(/_/g, ""),
    field.replace(/_deg$/, ""),
    field.replace(/_cm$/, ""),
  ];
  for (const container of metricContainers(frame)) {
    for (const alias of aliases) {
      if (container[alias] != null) return container[alias];
    }
    const nested = readPath(container, field.split("."));
    if (nested != null) return nested;
  }
  return undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function metricSeverity(value: unknown, rule: NonNullable<OhsCompensationDefinition["metricRules"]>[number]): AssessmentSeverity | null {
  if (rule.direction === "truthy") {
    const truthy = value === true || /true|sim|presente|observado|sobeu|perdeu/.test(normalizeText(value));
    return truthy ? "moderada" : null;
  }
  const n = numberValue(value);
  if (n == null) return null;
  const v = rule.direction === "abs_gt" ? Math.abs(n) : n;
  if (rule.direction === "lt" || rule.direction === "lte" || rule.direction === "ratio_lt") {
    if (v <= rule.severe) return "severa";
    if (v <= rule.moderate) return "moderada";
    if (v <= rule.mild) return "leve";
    return null;
  }
  if (rule.direction === "gt" || rule.direction === "gte" || rule.direction === "abs_gt" || rule.direction === "ratio_gt") {
    if (v >= rule.severe) return "severa";
    if (v >= rule.moderate) return "moderada";
    if (v >= rule.mild) return "leve";
  }
  return null;
}

function findFrameReference(definition: OhsCompensationDefinition, frameRefs: FrameRef[], explicitFrameId?: unknown) {
  const explicit = typeof explicitFrameId === "string" ? frameRefs.find((fr) => fr.frameId === explicitFrameId) : null;
  if (explicit) return explicit;
  let match: FrameRef | undefined;
  for (const keyword of definition.vistaKeywords) {
    const normalizedKeyword = normalizeText(keyword);
    match = frameRefs.find((fr) => normalizeText(fr.vista).includes(normalizedKeyword));
    if (match) break;
  }
  return match || frameRefs[0] || { frameId: null, vista: null };
}

function explicitBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = normalizeText(value);
  if (/^(true|sim|presente|observado)/.test(text)) return true;
  if (/^(false|nao|ausente|normal|sem alteracao)/.test(text)) return false;
  return undefined;
}

function findExplicitCompensation(assessmentJson: any, definition: OhsCompensationDefinition) {
  const candidates = [
    ...(Array.isArray(assessmentJson?.ohs_compensations) ? assessmentJson.ohs_compensations : []),
    ...(Array.isArray(assessmentJson?.postural_compensations) ? assessmentJson.postural_compensations : []),
    ...(Array.isArray(assessmentJson?.compensacoes_posturais) ? assessmentJson.compensacoes_posturais : []),
    ...(Array.isArray(assessmentJson?.compensacoes_ohs) ? assessmentJson.compensacoes_ohs : []),
    ...(Array.isArray(assessmentJson?.disfuncoes_identificadas) ? assessmentJson.disfuncoes_identificadas : []),
  ];
  return candidates.find((item) => {
    const text = normalizeText(item);
    return text.includes(definition.key.replace(/_/g, " ")) ||
      text.includes(normalizeText(definition.label)) ||
      definition.aliases.some((alias) => text.includes(normalizeText(alias)));
  });
}

function findFrameFinding(assessmentJson: any, definition: OhsCompensationDefinition) {
  if (!Array.isArray(assessmentJson?.frame_findings)) return null;
  for (const frame of assessmentJson.frame_findings) {
    const text = normalizeText(frame);
    if (definition.visualSignals.some((signal) => text.includes(normalizeText(signal))) ||
      definition.aliases.some((alias) => text.includes(normalizeText(alias)))) {
      return frame;
    }
  }
  return null;
}

function findTeacherTextSignal(text: string, definition: OhsCompensationDefinition) {
  if (!text) return "";
  const signals = [...definition.visualSignals, ...definition.aliases];
  return signals.find((signal) => text.includes(normalizeText(signal))) || "";
}

function metricSignalsFor(assessmentJson: any, definition: OhsCompensationDefinition): EvidenceSignal[] {
  if (!Array.isArray(assessmentJson?.frame_findings) || !definition.metricRules?.length) return [];
  const signals: EvidenceSignal[] = [];
  for (const frame of assessmentJson.frame_findings) {
    for (const rule of definition.metricRules) {
      const value = readMetric(frame, rule.field);
      const severity = metricSeverity(value, rule);
      if (!severity) continue;
      signals.push({
        source: "metric",
        severity,
        frameId: typeof frame?.frameId === "string" ? frame.frameId : null,
        message: `${rule.message}: ${String(value)}`,
        confidence: "alta",
        value: typeof value === "number" || typeof value === "string" || typeof value === "boolean" ? value : null,
      });
    }
  }
  return signals;
}

function sortEvidenceSignals(signals: EvidenceSignal[]) {
  return [...signals].sort((a, b) => {
    const confidenceDiff = confidenceRank(b.confidence) - confidenceRank(a.confidence);
    if (confidenceDiff) return confidenceDiff;
    return severityRank[b.severity] - severityRank[a.severity];
  });
}

function evidenceFrom(source: any, fallback: string) {
  if (isRecord(source)) {
    return clean(
      source.evidencia ??
      source.descricao ??
      source.achado ??
      source.nome ??
      source.observacao ??
      source.observacoes ??
      source.findings?.[0]?.descricao ??
      fallback,
    );
  }
  return fallback;
}

function inferOhsCompensation(args: {
  assessmentJson: any;
  definition: OhsCompensationDefinition;
  frameRefs: FrameRef[];
  teacherSignalText: string;
}): OhsCompensationResult {
  const { assessmentJson, definition, frameRefs, teacherSignalText } = args;
  const explicit = findExplicitCompensation(assessmentJson, definition);
  const frameFinding = findFrameFinding(assessmentJson, definition);
  const textSignal = findTeacherTextSignal(teacherSignalText, definition);
  const explicitPresent = explicitBoolean(explicit?.presente ?? explicit?.present);
  const evidenceSignals: EvidenceSignal[] = [
    ...(explicit ? [{
      source: "explicit" as const,
      severity: normalizeSeverity(explicit?.severidade ?? explicit?.gravidade ?? explicit?.severity ?? explicit?.presente ?? explicit?.present),
      frameId: typeof (explicit?.frame_referencia ?? explicit?.frameId ?? explicit?.frame_id) === "string"
        ? explicit.frame_referencia ?? explicit.frameId ?? explicit.frame_id
        : null,
      message: evidenceFrom(explicit, "Achado estruturado recebido no laudo."),
      confidence: "alta" as const,
    }] : []),
    ...(frameFinding ? [{
      source: "frame_finding" as const,
      severity: normalizeSeverity(frameFinding?.gravidade ?? frameFinding?.severity ?? frameFinding?.severidade ?? frameFinding),
      frameId: typeof frameFinding?.frameId === "string" ? frameFinding.frameId : null,
      message: evidenceFrom(frameFinding, "Achado identificado nas observacoes do frame."),
      confidence: "media" as const,
    }] : []),
    ...(textSignal ? [{
      source: "teacher_note" as const,
      severity: normalizeSeverity(textSignal),
      frameId: null,
      message: `Sinal textual do professor: ${textSignal}.`,
      confidence: "media" as const,
    }] : []),
    ...metricSignalsFor(assessmentJson, definition),
  ];
  const sortedSignals = sortEvidenceSignals(evidenceSignals);
  const severity = strongestSeverity(evidenceSignals.map((signal) => signal.severity));
  const presente = explicitPresent ?? evidenceSignals.some((signal) => signal.severity !== "ausente" && signal.severity !== "incerta");
  const primarySignal = sortedSignals[0] || null;
  const explicitFrameId = explicit?.frame_referencia ?? explicit?.frameId ?? explicit?.frame_id ?? frameFinding?.frameId ?? primarySignal?.frameId;
  const frame = findFrameReference(definition, frameRefs, explicitFrameId);
  const noObservation = frameRefs.length
    ? "Nao observado nos frames/observacoes disponiveis."
    : "Sem frames para confirmar visualmente.";
  const evidence = presente
    ? primarySignal?.message || evidenceFrom(explicit || frameFinding, textSignal ? `Sinal textual do professor: ${textSignal}.` : "Inferido do laudo estruturado.")
    : severity === "incerta"
      ? "Imagem/contexto insuficiente para confirmar este achado."
      : noObservation;

  return {
    key: definition.key,
    compensacao: definition.label,
    presente,
    severidade: presente ? severity : severity === "incerta" ? "incerta" : "ausente",
    frame_referencia: frame.frameId,
    vista_referencia: frame.vista,
    evidencia: evidence,
    implicacao_treino: clean(explicit?.implicacao_treino ?? explicit?.impacto_treino ?? definition.trainingImplication),
    evidence_signals: sortedSignals,
    confidence: evidenceSignals.length ? strongestConfidence(evidenceSignals) : "baixa",
    rule_id: definition.key,
    musculos_encurtados: definition.likelyShortened,
    musculos_fracos: definition.likelyWeak,
    restricoes_movimento: definition.movementRestrictions,
    padroes_cautela: definition.cautionPatterns,
  };
}

function ensureFrameFindings(assessmentJson: any, frameRefs: FrameRef[]) {
  const current = Array.isArray(assessmentJson?.frame_findings) ? assessmentJson.frame_findings : [];
  const byId = new Map<string, any>(current.map((item: any) => [item?.frameId, item]));
  return frameRefs.map((frame) => {
    const existing = byId.get(frame.frameId);
    return {
      ...existing,
      frameId: frame.frameId,
      vista: existing?.vista || frame.vista,
      findings: Array.isArray(existing?.findings) ? existing.findings : [],
      observacao: existing?.observacao ?? existing?.observacoes ?? null,
    };
  });
}

function painRegionsFromText(...values: unknown[]): string[] {
  const text = normalizeText(values);
  const out: string[] = [];
  if (/joelho|patel|condrom|menisc|ligamento/.test(text)) out.push("joelho");
  if (/lomb|coluna|ciatic|sacro|quadrad/.test(text)) out.push("lombar");
  if (/ombro|manguito|cervic|escap/.test(text)) out.push("ombro/cervical");
  if (/tornoz|aquiles|panturr|canela|tibia/.test(text)) out.push("tornozelo/panturrilha");
  if (/quadril|glute|piriforme|tfl|iliotibial/.test(text)) out.push("quadril");
  return [...new Set(out)];
}

function buildPostureStaticFromText(text: string, visualNote: string) {
  return {
    vista_frontal: {
      cabeca: /cabeca|cervical/.test(text) ? "revisar alinhamento de cabeca/cervical descrito nas observacoes" : null,
      ombros: /ombro|escap|protrus|cifose/.test(text) ? "revisar nivel/protrusao de ombros" : null,
      pelve: /pelve|crista iliaca|quadril/.test(text) ? "revisar nivel de pelve/quadril" : null,
      joelhos: /joelho|valgo|varo/.test(text) ? "revisar alinhamento de joelhos" : null,
      pes: /pe |pes |tornoz|pronacao|supinacao/.test(text) ? "revisar apoio e rotacao dos pes" : null,
      observacoes: visualNote,
    },
    vista_lateral: {
      cabeca_pescoco: /cabeca|cervical|anteriorizacao/.test(text) ? "possivel alteracao cervical descrita" : null,
      ombros: /ombro|protrus|cifose|torac/.test(text) ? "possivel protrusao/cifose descrita" : null,
      coluna_toracica: /cifose|torac/.test(text) ? "revisar mobilidade toracica" : null,
      coluna_lombar: /lomb|lordose|retrovers|antevers/.test(text) ? "revisar controle lombo-pelvico" : null,
      pelve: /pelve|antevers|retrovers|quadril/.test(text) ? "revisar posicao da pelve" : null,
      joelhos: /joelho|hiperextens/.test(text) ? "revisar joelho em vista lateral" : null,
      observacoes: visualNote,
    },
    vista_posterior: {
      coluna: /coluna|escoliose|desvio/.test(text) ? "revisar simetria da coluna" : null,
      escapulas: /escap|ombro/.test(text) ? "revisar simetria escapular" : null,
      pelve: /drop|pelve|quadril/.test(text) ? "revisar nivel pelvico" : null,
      joelhos_calcanhares: /joelho|tornoz|calcanhar|pronacao/.test(text) ? "revisar joelhos/calcanhares" : null,
      observacoes: visualNote,
    },
  };
}

function buildOverheadSquatFromCompensations(compensations: OhsCompensationResult[], visualNote: string) {
  const byKey = new Map(compensations.map((item) => [item.key, item]));
  const isPresent = (key: string) => Boolean(byKey.get(key as any)?.presente);
  return {
    vista_frontal: {
      bracos: isPresent("overhead_arm_asymmetry") ? "assimetria overhead a revisar" : "sem alteracao confirmada",
      joelhos: isPresent("dynamic_valgus") ? "valgo dinamico observado/relatado" : "sem alteracao confirmada",
      pelve: isPresent("pelvic_drop_trendelenburg") ? "drop/instabilidade pelvica observado/relatado" : "sem alteracao confirmada",
      tronco: "centralizado salvo observacao do professor",
      observacoes: visualNote,
    },
    vista_lateral: {
      inclinacao_tronco: isPresent("trunk_forward_lean") ? "excessiva" : "nao confirmada",
      angulo_tibiotronco: isPresent("trunk_forward_lean") ? "tronco muito a frente" : "nao confirmado",
      adm_tornozelo: isPresent("dorsiflexion_limitation") ? "limitada" : "nao confirmada",
      pelve_fundo: isPresent("butt_wink") ? "retroversao" : "nao confirmada",
      lordose_lombar: "nao confirmada",
      profundidade_squat: isPresent("dorsiflexion_limitation") || isPresent("butt_wink") ? "limitar ate controle tecnico" : "nao confirmada",
      observacoes: visualNote,
    },
    vista_posterior: {
      drop_pelve: isPresent("pelvic_drop_trendelenburg") ? "presente" : "ausente/nao confirmado",
      assimetria_bracas: isPresent("overhead_arm_asymmetry") ? "presente" : "ausente/nao confirmado",
      desvio_coluna: "nao confirmado",
      observacoes: visualNote,
    },
  };
}

function buildStaticPostureFromCompensations(
  basePosture: ReturnType<typeof buildPostureStaticFromText>,
  posturalCompensations: OhsCompensationResult[],
) {
  const byKey = new Map(posturalCompensations.map((item) => [item.key, item]));
  const has = (key: string) => Boolean(byKey.get(key as any)?.presente);
  return {
    vista_frontal: {
      ...basePosture.vista_frontal,
      cabeca: has("forward_head_posture") ? "cabeca anteriorizada; confirmar por vista lateral" : basePosture.vista_frontal.cabeca,
      ombros: has("rounded_shoulders_kyphosis") || has("scapular_asymmetry_winging")
        ? "ombros/escapulas com assimetria ou protrusao"
        : basePosture.vista_frontal.ombros,
      pelve: has("pelvic_obliquity") ? "desnivel/obliquidade pelvica" : basePosture.vista_frontal.pelve,
      joelhos: has("knee_hyperextension") ? "hiperextensao/travamento de joelho em apoio" : basePosture.vista_frontal.joelhos,
      pes: has("foot_pronation") ? "pronacao/arco medial baixo" : has("foot_supination") ? "supinacao/apoio lateral" : basePosture.vista_frontal.pes,
    },
    vista_lateral: {
      ...basePosture.vista_lateral,
      cabeca_pescoco: has("forward_head_posture") ? "anteriorizacao de cabeca/cervical" : basePosture.vista_lateral.cabeca_pescoco,
      ombros: has("rounded_shoulders_kyphosis") ? "ombros arredondados/protrusao" : basePosture.vista_lateral.ombros,
      coluna_toracica: has("rounded_shoulders_kyphosis") ? "cifose toracica aumentada ou dorso arredondado" : basePosture.vista_lateral.coluna_toracica,
      coluna_lombar: has("anterior_pelvic_tilt_hyperlordosis") ? "hiperlordose/anteversao a revisar" : basePosture.vista_lateral.coluna_lombar,
      pelve: has("anterior_pelvic_tilt_hyperlordosis") ? "anteversao pelvica" : basePosture.vista_lateral.pelve,
      joelhos: has("knee_hyperextension") ? "hiperextensao de joelho" : basePosture.vista_lateral.joelhos,
    },
    vista_posterior: {
      ...basePosture.vista_posterior,
      escapulas: has("scapular_asymmetry_winging") ? "assimetria escapular/escapula alada" : basePosture.vista_posterior.escapulas,
      pelve: has("pelvic_obliquity") ? "obliquidade/desnivel pelvico" : basePosture.vista_posterior.pelve,
      joelhos_calcanhares: has("foot_pronation") ? "pronacao/calcaneo valgo" : has("foot_supination") ? "supinacao/calcaneo varo" : basePosture.vista_posterior.joelhos_calcanhares,
    },
  };
}

function contraindicationsFor(painRegions: string[], compensations: OhsCompensationResult[]) {
  const present = compensations.filter((item) => item.presente);
  const out = new Set<string>();
  if (painRegions.includes("lombar")) out.add("evitar flexao lombar carregada e carga axial alta sem controle");
  if (painRegions.includes("joelho") || present.some((item) => item.key === "dynamic_valgus")) out.add("evitar agachamento profundo/afundo pesado com dor ou valgo sem controle");
  if (painRegions.includes("ombro/cervical") || present.some((item) => ["shoulder_protraction_kyphosis", "overhead_arm_asymmetry", "forward_head_posture", "rounded_shoulders_kyphosis", "scapular_asymmetry_winging"].includes(String(item.key)))) out.add("evitar press overhead pesado, dips, remada alta e barra atras da nuca se houver dor/limitacao");
  if (present.some((item) => item.key === "butt_wink")) out.add("limitar agachamento ao ponto de pelve neutra; evitar carga axial no fundo");
  if (present.some((item) => item.key === "anterior_pelvic_tilt_hyperlordosis")) out.add("evitar hiperextensao lombar e carga axial alta sem controle costela-pelve");
  if (present.some((item) => item.key === "knee_hyperextension")) out.add("evitar travar joelho em leg press/agachamento e impactos sem controle terminal");
  if (present.some((item) => ["foot_pronation", "foot_supination"].includes(String(item.key)))) out.add("reduzir impacto/corrida intensa se pe-tornozelo nao controla alinhamento");
  return [...out];
}

function protocolFor(painRegions: string[], text: string, protocolHint: unknown) {
  if (/formig|irradi|perda de for|radicul|ciatic/.test(text)) return "protocolo_4_radic_investigar_se_sintomas_neurais";
  if (painRegions.some((region) => ["joelho", "tornozelo/panturrilha", "quadril"].includes(region))) return "protocolo_2_mmii";
  if (painRegions.includes("ombro/cervical")) return "protocolo_3_mmss";
  return clean(protocolHint) || "protocolo_1_padrao";
}

function redFlagsFrom(text: string) {
  const flags = [];
  if (/formig|irradi|perda de for|dormencia/.test(text)) {
    flags.push({ tipo: "yellow", sinal: "relato de sintoma neural/irradiado", conduta: "avisar professor e nao progredir padrao doloroso sem revisao" });
  }
  if (/edema|incha|dor torac|tont|desma|fratura|cirurg|agud/.test(text)) {
    flags.push({ tipo: "red", sinal: "relato de sinal de alerta", conduta: "exigir revisao profissional antes de progressao agressiva" });
  }
  return flags;
}

function progressionCriteria(compensations: OhsCompensationResult[], painRegions: string[]) {
  const present = compensations.filter((item) => item.presente);
  return {
    sequencia_treino: ["mobilidade", "ativacao", "controle_motor", "pliometria_ou_potencia_quando_apropriado", "forca"],
    liberado_para_pliometria: present.length === 0 && painRegions.length === 0,
    motivo: present.length || painRegions.length
      ? "adiar pliometria ate dor <=3/10, controle de joelho/quadril/tronco e amplitude tecnica estavel"
      : "sem restricao relevante confirmada no fallback",
    primeiro_treino: [
      "validar dor e amplitude antes de carga",
      "priorizar mobilidade/ativacao relacionada aos achados",
      "progredir somente com tecnica estavel",
    ],
  };
}

function severityPenalty(severity: AssessmentSeverity) {
  if (severity === "severa") return 2.2;
  if (severity === "moderada") return 1.4;
  if (severity === "leve") return 0.7;
  if (severity === "incerta") return 0.25;
  return 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function buildAssessmentConfidence(compensations: OhsCompensationResult[], frameRefs: FrameRef[]) {
  const evidenceSignals = compensations.flatMap((item) => item.evidence_signals || []);
  const metricSignals = evidenceSignals.filter((signal) => signal.source === "metric").length;
  const explicitSignals = evidenceSignals.filter((signal) => signal.source === "explicit").length;
  const teacherSignals = evidenceSignals.filter((signal) => signal.source === "teacher_note").length;
  const frameSignals = evidenceSignals.filter((signal) => signal.source === "frame_finding").length;
  const present = compensations.filter((item) => item.presente);
  const confidenceScore = Math.min(1, (
    metricSignals * 0.22 +
    explicitSignals * 0.18 +
    frameSignals * 0.12 +
    teacherSignals * 0.09 +
    Math.min(frameRefs.length, 6) * 0.04
  ));
  return {
    level: confidenceScore >= 0.7 ? "alta" : confidenceScore >= 0.35 ? "media" : "baixa",
    score: Math.round(confidenceScore * 100) / 100,
    has_metric_evidence: metricSignals > 0,
    signals: {
      metric: metricSignals,
      explicit: explicitSignals,
      frame_finding: frameSignals,
      teacher_note: teacherSignals,
    },
    present_compensations: present.length,
    missing_visual_review: metricSignals === 0 && frameSignals === 0 && present.length > 0,
  };
}

function buildQualityGate(args: {
  compensations: OhsCompensationResult[];
  frameRefs: FrameRef[];
  painRegions: string[];
  redYellowFlags: any[];
  assessmentJson: any;
}) {
  const { compensations, frameRefs, painRegions, redYellowFlags, assessmentJson } = args;
  const present = compensations.filter((item) => item.presente);
  const severe = present.filter((item) => item.severidade === "severa");
  const uncertain = compensations.filter((item) => item.severidade === "incerta");
  const hasRedFlag = redYellowFlags.some((flag) => normalizeText(flag?.tipo ?? flag).includes("red"));
  const hasNeuralFlag = redYellowFlags.some((flag) => /(neural|irradi|formig|dormencia|perda de for)/.test(normalizeText(flag)));
  const hasVideoOrFrame = frameRefs.length > 0 || Array.isArray(assessmentJson?.frame_findings) && assessmentJson.frame_findings.length > 0;
  const metricEvidence = present.some((item) => item.evidence_signals?.some((signal) => signal.source === "metric"));
  const needsTeacherReview = hasRedFlag || hasNeuralFlag || severe.length > 0 || painRegions.length > 0 || (!hasVideoOrFrame && present.length > 0);
  const canPrescribe = !hasRedFlag && !hasNeuralFlag;
  return {
    status: hasRedFlag || hasNeuralFlag ? "needs_professional_clearance" : needsTeacherReview ? "needs_teacher_review" : "ready",
    can_prescribe: canPrescribe,
    needs_teacher_review: needsTeacherReview,
    reasons: [
      hasRedFlag ? "red_flag_detected" : null,
      hasNeuralFlag ? "neural_symptom_reported" : null,
      severe.length ? "severe_compensation_detected" : null,
      painRegions.length ? "pain_reported" : null,
      !metricEvidence && present.length ? "visual_metric_evidence_missing" : null,
      uncertain.length >= 4 ? "many_uncertain_findings" : null,
    ].filter(Boolean),
    required_review: [
      hasRedFlag ? "encaminhar/revisar antes de progressao" : null,
      severe.length ? "professor deve revisar compensacoes severas nos frames" : null,
      painRegions.length ? "manter dor <=3/10 e ajustar padrao doloroso" : null,
    ].filter(Boolean),
  };
}

function buildFunctionalScore(compensations: OhsCompensationResult[], painRegions: string[], redYellowFlags: any[]) {
  const presentPenalty = compensations
    .filter((item) => item.presente)
    .reduce((total, item) => total + severityPenalty(item.severidade), 0);
  const painPenalty = Math.min(2.5, painRegions.length * 0.7);
  const flagPenalty = redYellowFlags.some((flag) => normalizeText(flag?.tipo ?? flag).includes("red")) ? 3 : 0;
  return {
    value: clampScore(10 - presentPenalty - painPenalty - flagPenalty),
    scale: "0-10",
    interpretation: "Quanto maior, mais pronto para progressao. A pontuacao e tecnica e nao clinica.",
    drivers: compensations
      .filter((item) => item.presente)
      .map((item) => ({ key: item.key, severity: item.severidade, penalty: severityPenalty(item.severidade) })),
  };
}

function buildPosturalScore(assessmentJson: any, compensations: OhsCompensationResult[]) {
  const posturePenalty = compensations
    .filter((item) => item.presente)
    .reduce((total, item) => total + severityPenalty(item.severidade), 0);
  const text = normalizeText(assessmentJson?.postura_estatica);
  const staticPenalty = /(cifose|protrus|escap|pelve|coluna|assimetr)/.test(text) ? 0.8 : 0;
  return {
    value: clampScore(10 - posturePenalty - staticPenalty),
    scale: "0-10",
    interpretation: "Triagem postural para orientar mobilidade, controle escapular e escolhas de exercicios.",
  };
}

function buildReportSections(assessmentJson: any) {
  return {
    postura: assessmentJson?.postura_estatica || {},
    overhead_squat: assessmentJson?.overhead_squat || {},
    laudo: {
      texto_aluno: assessmentJson?.relatorio_para_aluno || "",
      disfuncoes_identificadas: assessmentJson?.disfuncoes_identificadas || [],
      compensacoes_posturais: assessmentJson?.postural_compensations || [],
      prioridades_corretivas: assessmentJson?.prioridades_corretivas || [],
      red_yellow_flags: assessmentJson?.red_yellow_flags || [],
    },
    contexto_prescricao: {
      resumo: assessmentJson?.resumo_para_prescricao || "",
      musculos_encurtados: assessmentJson?.musculos_encurtados || [],
      musculos_fracos: assessmentJson?.musculos_fracos || [],
      restricoes_movimento: assessmentJson?.restricoes_movimento || [],
      exercicios_contraindicados: assessmentJson?.exercicios_contraindicados || [],
      exercicios_cautela: assessmentJson?.exercicios_cautela || [],
      assessment_confidence: assessmentJson?.assessment_confidence || null,
      quality_gate: assessmentJson?.quality_gate || null,
      score_funcional: assessmentJson?.score_funcional || null,
      score_postural: assessmentJson?.score_postural || null,
    },
  };
}

export function normalizeAssessmentJson(assessmentJson: any, frameRefs: FrameRef[] = [], options: NormalizeAssessmentOptions = {}) {
  if (!isRecord(assessmentJson)) assessmentJson = {};
  const frame_findings = ensureFrameFindings(assessmentJson, frameRefs);
  const teacherSignalText = normalizeText({
    frame_findings,
    observacoes_tecnicas: assessmentJson.observacoes_tecnicas,
    postura_estatica: assessmentJson.postura_estatica,
    overhead_squat: assessmentJson.overhead_squat,
    disfuncoes_identificadas: assessmentJson.disfuncoes_identificadas,
    ohs_compensations: assessmentJson.ohs_compensations,
    postural_compensations: assessmentJson.postural_compensations,
  });
  const ohs_compensations = OHS_COMPENSATIONS.map((definition) => inferOhsCompensation({
    assessmentJson: { ...assessmentJson, frame_findings },
    definition,
    frameRefs,
    teacherSignalText,
  }));
  const postural_compensations = POSTURAL_COMPENSATIONS.map((definition) => inferOhsCompensation({
    assessmentJson: { ...assessmentJson, frame_findings },
    definition,
    frameRefs,
    teacherSignalText,
  }));
  const allCompensations = [...ohs_compensations, ...postural_compensations];
  const present = allCompensations.filter((item) => item.presente);
  const painRegions = painRegionsFromText(
    assessmentJson.queixa_principal,
    assessmentJson.historico_lesoes,
    assessmentJson.observacoes_tecnicas,
    assessmentJson.resumo_para_prescricao,
    assessmentJson.relatorio_para_aluno,
  );
  const redYellowFlags = Array.isArray(assessmentJson.red_yellow_flags) ? assessmentJson.red_yellow_flags : [];
  const assessment_confidence = assessmentJson.assessment_confidence || buildAssessmentConfidence(allCompensations, frameRefs);
  const quality_gate = assessmentJson.quality_gate || buildQualityGate({
    compensations: allCompensations,
    frameRefs,
    painRegions,
    redYellowFlags,
    assessmentJson,
  });
  const score_funcional = assessmentJson.score_funcional || buildFunctionalScore(ohs_compensations, painRegions, redYellowFlags);
  const score_postural = assessmentJson.score_postural || buildPosturalScore(assessmentJson, postural_compensations);
  const shortened = flattenUnique([
    assessmentJson.musculos_encurtados,
    ...present.map((item) => item.musculos_encurtados || []),
  ]);
  const weak = flattenUnique([
    assessmentJson.musculos_fracos,
    ...present.map((item) => item.musculos_fracos || []),
  ]);
  const restrictions = flattenUnique([
    assessmentJson.restricoes_movimento,
    ...present.map((item) => item.restricoes_movimento || []),
  ]);
  const caution = flattenUnique([
    assessmentJson.exercicios_cautela,
    ...present.map((item) => item.padroes_cautela || []),
  ]);
  const prescription_context = {
    contract: "bn_functional_assessment_v1",
    engine: ASSESSMENT_ENGINE_VERSION,
    source: "ai-functional-assessment",
    ohs_compensations,
    postural_compensations,
    posture_static: assessmentJson.postura_estatica || null,
    overhead_squat: assessmentJson.overhead_squat || null,
    protocol_direction: assessmentJson.direcionamento_protocolo || null,
    red_yellow_flags: redYellowFlags,
    progression_criteria: assessmentJson.criterios_progressao_bn || null,
    corrective_priorities: assessmentJson.prioridades_corretivas || [],
    shortened_muscles: shortened,
    weak_muscles: weak,
    movement_restrictions: restrictions,
    contraindicated_exercises: assessmentJson.exercicios_contraindicados || [],
    caution_exercises: caution,
    summary_for_prescription: assessmentJson.resumo_para_prescricao || "",
    assessment_confidence,
    quality_gate,
    score_funcional,
    score_postural,
    needs_teacher_review: quality_gate.needs_teacher_review,
  };

  return {
    ...assessmentJson,
    schema: "bn_functional_assessment_v1",
    assessment_contract_version: "2026-07-02.assessment-engine-v1",
    generated_by: assessmentJson.generated_by || ASSESSMENT_ENGINE_VERSION,
    fallback_reason: assessmentJson.fallback_reason || options.fallbackReason || null,
    methodology_sources: assessmentJson.methodology_sources || ASSESSMENT_METHOD_SOURCES,
    frame_findings,
    ohs_compensations,
    postural_compensations,
    assessment_confidence,
    quality_gate,
    score_funcional,
    score_postural,
    musculos_encurtados: shortened,
    musculos_fracos: weak,
    restricoes_movimento: restrictions,
    exercicios_cautela: caution,
    report_sections: assessmentJson.report_sections || buildReportSections({
      ...assessmentJson,
      musculos_encurtados: shortened,
      musculos_fracos: weak,
      restricoes_movimento: restrictions,
      exercicios_cautela: caution,
      assessment_confidence,
      quality_gate,
      score_funcional,
      score_postural,
    }),
    prescription_context,
  };
}

export function buildDeterministicAssessmentJson(args: BuildAssessmentInput) {
  const incomingFrameFindings = Array.isArray(args.frame_findings) ? args.frame_findings : [];
  const text = normalizeText({
    queixa_principal: args.queixa_principal,
    historico_lesoes: args.historico_lesoes,
    observacoes_tecnicas: args.observacoes_tecnicas,
    protocol_hint: args.protocol_hint,
    expected_movements: args.expected_movements,
    frame_findings: incomingFrameFindings,
  });
  const painRegions = painRegionsFromText(args.queixa_principal, args.historico_lesoes, args.observacoes_tecnicas);
  const visualNote = args.frameRefs.length
    ? "Motor deterministico: frames recebidos; sem leitura de pose automatica nesta execucao. Achados visuais dependem de observacao textual/rotulos ou IA Vision."
    : "Motor deterministico baseado em dados textuais, sem imagens.";

  const preliminary = OHS_COMPENSATIONS.map((definition) => inferOhsCompensation({
    assessmentJson: { frame_findings: incomingFrameFindings },
    definition,
    frameRefs: args.frameRefs,
    teacherSignalText: text,
  }));
  const posturalPreliminary = POSTURAL_COMPENSATIONS.map((definition) => inferOhsCompensation({
    assessmentJson: { frame_findings: incomingFrameFindings },
    definition,
    frameRefs: args.frameRefs,
    teacherSignalText: text,
  }));
  const combinedPreliminary = [...preliminary, ...posturalPreliminary];
  const present = combinedPreliminary.filter((item) => item.presente);
  const contraindicated = contraindicationsFor(painRegions, combinedPreliminary);
  const red_yellow_flags = redFlagsFrom(text);
  const priorities = [
    ...present.map((item) => `${item.key}: ${item.implicacao_treino}`),
    ...painRegions.map((region) => `${region}: manter dor <=3/10, reduzir amplitude/carga no padrao doloroso e avisar professor se houver piora`),
  ].slice(0, 8);
  const shortened = flattenUnique(present.map((item) => item.musculos_encurtados || []));
  const weak = flattenUnique([
    ...present.map((item) => item.musculos_fracos || []),
    painRegions.includes("joelho") || painRegions.includes("quadril") ? ["gluteo medio"] : [],
  ]);
  const restrictions = flattenUnique([
    ...present.map((item) => item.restricoes_movimento || []),
    ...painRegions.map((region) => `dor/regiao sensivel: ${region}`),
  ]);
  const caution = flattenUnique([
    ...present.map((item) => item.padroes_cautela || []),
    painRegions.includes("tornozelo/panturrilha") ? ["pliometria e tiros se houver dor"] : [],
  ]);
  const protocol = protocolFor(painRegions, text, args.protocol_hint);
  const posture = buildStaticPostureFromCompensations(buildPostureStaticFromText(text, visualNote), posturalPreliminary);
  const ohs = buildOverheadSquatFromCompensations(preliminary, visualNote);
  const composition = {
    peso_kg: clean(args.peso_kg) || null,
    altura_cm: clean(args.altura_cm) || null,
    cintura_cm: clean(args.cintura_cm) || null,
    percentual_gordura_informado: clean(args.percentual_gordura) || null,
    prioridades_de_acompanhamento: splitList(args.perimetros),
  };
  const summary = [
    `Avaliacao deterministica para ${clean(args.modalidade || "treino")}.`,
    present.length ? `Compensacoes/prioridades descritas: ${present.map((item) => item.compensacao).join("; ")}.` : "Sem compensacao OHS confirmada por texto/rotulo.",
    painRegions.length ? `Regioes de atencao relatadas: ${painRegions.join(", ")}.` : "Sem dor/regiao critica relatada.",
    "Usar como triagem tecnica; professor deve revisar frames antes de progressao agressiva.",
  ].join(" ");
  const studentReport = [
    "Sua avaliacao foi organizada em modo tecnico conservador.",
    present.length
      ? `Os principais pontos para guiar o treino foram: ${present.map((item) => item.compensacao).join(", ")}.`
      : "Nao houve compensacao confirmada de forma suficiente pelo motor deterministico.",
    painRegions.length ? `Tambem vamos respeitar as regioes relatadas: ${painRegions.join(", ")}.` : "Como nao houve queixa relevante informada, a progressao segue pelo controle tecnico.",
    "O plano deve comecar com mobilidade, ativacao e controle antes de aumentar carga ou impacto.",
  ].join(" ");

  return normalizeAssessmentJson({
    generated_by: ASSESSMENT_ENGINE_VERSION,
    fallback_reason: args.reason,
    queixa_principal: args.queixa_principal,
    historico_lesoes: args.historico_lesoes,
    observacoes_tecnicas: args.observacoes_tecnicas,
    confianca_visual: present.length ? "media" : "baixa",
    composicao_corporal: composition,
    frame_findings: args.frameRefs.map((frame) => ({
      ...(incomingFrameFindings.find((item: any) => item?.frameId === frame.frameId) || {}),
      frameId: frame.frameId,
      vista: frame.vista,
      findings: Array.isArray(incomingFrameFindings.find((item: any) => item?.frameId === frame.frameId)?.findings)
        ? incomingFrameFindings.find((item: any) => item?.frameId === frame.frameId)?.findings
        : [],
      observacao: incomingFrameFindings.find((item: any) => item?.frameId === frame.frameId)?.observacao || visualNote,
    })),
    postura_estatica: posture,
    overhead_squat: ohs,
    ohs_compensations: preliminary,
    postural_compensations: posturalPreliminary,
    direcionamento_protocolo: protocol,
    red_yellow_flags,
    prioridades_corretivas: priorities,
    restricoes_movimento: restrictions,
    exercicios_contraindicados: contraindicated,
    exercicios_cautela: caution,
    musculos_encurtados: shortened,
    musculos_fracos: weak,
    resumo_para_prescricao: summary,
    relatorio_para_aluno: studentReport,
    criterios_progressao_bn: progressionCriteria(preliminary, painRegions),
    sequencia_bn_video: Array.isArray(args.expected_movements) ? args.expected_movements.map(clean).filter(Boolean) : splitList(args.expected_movements),
  }, args.frameRefs, { fallbackReason: args.reason });
}
