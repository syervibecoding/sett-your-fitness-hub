import type {
  AssessmentSeverity,
  BuildAssessmentInput,
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
    id: "bn_historical_drive_dataset",
    label: "BN historical Drive folder, anonymized frame structure only",
    url: "https://drive.google.com/drive/folders/1Hj-zReZTuL7Oq7HS4LwNzIq6stTmX6xN",
  },
];

export const OHS_COMPENSATIONS: OhsCompensationDefinition[] = [
  {
    key: "dorsiflexion_limitation",
    label: "Limitacao de dorsiflexao de tornozelo",
    aliases: ["dorsiflex", "tornozelo", "adm tornozelo", "mobilidade tornozelo", "calcanhar sobe", "heel rise", "ankle"],
    visualSignals: ["calcanhar sobe", "pe roda para fora", "profundidade limitada", "tibia vertical", "tornozelo limitado"],
    vistaKeywords: ["lateral ohs", "air squat", "squat", "vista lateral", "toe touch"],
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
  const presentSource = explicit || frameFinding || textSignal;
  const explicitPresent = explicitBoolean(explicit?.presente ?? explicit?.present);
  const severity = presentSource
    ? normalizeSeverity(explicit?.severidade ?? explicit?.gravidade ?? explicit?.severity ?? frameFinding?.gravidade ?? frameFinding?.severity ?? teacherSignalText)
    : "ausente";
  const presente = explicitPresent ?? Boolean(presentSource && severity !== "ausente" && severity !== "incerta");
  const frame = findFrameReference(definition, frameRefs, explicit?.frame_referencia ?? explicit?.frameId ?? explicit?.frame_id ?? frameFinding?.frameId);
  const noObservation = frameRefs.length
    ? "Nao observado nos frames/observacoes disponiveis."
    : "Sem frames para confirmar visualmente.";
  const evidence = presente
    ? evidenceFrom(explicit || frameFinding, textSignal ? `Sinal textual do professor: ${textSignal}.` : "Inferido do laudo estruturado.")
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

function contraindicationsFor(painRegions: string[], compensations: OhsCompensationResult[]) {
  const present = compensations.filter((item) => item.presente);
  const out = new Set<string>();
  if (painRegions.includes("lombar")) out.add("evitar flexao lombar carregada e carga axial alta sem controle");
  if (painRegions.includes("joelho") || present.some((item) => item.key === "dynamic_valgus")) out.add("evitar agachamento profundo/afundo pesado com dor ou valgo sem controle");
  if (painRegions.includes("ombro/cervical") || present.some((item) => ["shoulder_protraction_kyphosis", "overhead_arm_asymmetry"].includes(item.key))) out.add("evitar press overhead pesado, dips, remada alta e barra atras da nuca se houver dor/limitacao");
  if (present.some((item) => item.key === "butt_wink")) out.add("limitar agachamento ao ponto de pelve neutra; evitar carga axial no fundo");
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

function buildReportSections(assessmentJson: any) {
  return {
    postura: assessmentJson?.postura_estatica || {},
    overhead_squat: assessmentJson?.overhead_squat || {},
    laudo: {
      texto_aluno: assessmentJson?.relatorio_para_aluno || "",
      disfuncoes_identificadas: assessmentJson?.disfuncoes_identificadas || [],
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
  });
  const ohs_compensations = OHS_COMPENSATIONS.map((definition) => inferOhsCompensation({
    assessmentJson: { ...assessmentJson, frame_findings },
    definition,
    frameRefs,
    teacherSignalText,
  }));
  const present = ohs_compensations.filter((item) => item.presente);
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
    posture_static: assessmentJson.postura_estatica || null,
    overhead_squat: assessmentJson.overhead_squat || null,
    protocol_direction: assessmentJson.direcionamento_protocolo || null,
    red_yellow_flags: assessmentJson.red_yellow_flags || [],
    progression_criteria: assessmentJson.criterios_progressao_bn || null,
    corrective_priorities: assessmentJson.prioridades_corretivas || [],
    shortened_muscles: shortened,
    weak_muscles: weak,
    movement_restrictions: restrictions,
    contraindicated_exercises: assessmentJson.exercicios_contraindicados || [],
    caution_exercises: caution,
    summary_for_prescription: assessmentJson.resumo_para_prescricao || "",
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
    }),
    prescription_context,
  };
}

export function buildDeterministicAssessmentJson(args: BuildAssessmentInput) {
  const text = normalizeText({
    queixa_principal: args.queixa_principal,
    historico_lesoes: args.historico_lesoes,
    observacoes_tecnicas: args.observacoes_tecnicas,
    protocol_hint: args.protocol_hint,
    expected_movements: args.expected_movements,
  });
  const painRegions = painRegionsFromText(args.queixa_principal, args.historico_lesoes, args.observacoes_tecnicas);
  const visualNote = args.frameRefs.length
    ? "Motor deterministico: frames recebidos; sem leitura de pose automatica nesta execucao. Achados visuais dependem de observacao textual/rotulos ou IA Vision."
    : "Motor deterministico baseado em dados textuais, sem imagens.";

  const preliminary = OHS_COMPENSATIONS.map((definition) => inferOhsCompensation({
    assessmentJson: {},
    definition,
    frameRefs: args.frameRefs,
    teacherSignalText: text,
  }));
  const present = preliminary.filter((item) => item.presente);
  const contraindicated = contraindicationsFor(painRegions, preliminary);
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
  const posture = buildPostureStaticFromText(text, visualNote);
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
    confianca_visual: present.length ? "media" : "baixa",
    composicao_corporal: composition,
    frame_findings: args.frameRefs.map((frame) => ({
      frameId: frame.frameId,
      vista: frame.vista,
      findings: [],
      observacao: visualNote,
    })),
    postura_estatica: posture,
    overhead_squat: ohs,
    ohs_compensations: preliminary,
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
