// ============================================================================
// Functional Assessment — Avaliação Postural e Funcional (motor determinístico)
//   Sem IA / sem Anthropic. Gera laudo técnico a partir dos dados clínicos
//   (queixa principal, histórico de lesões, modalidade, nível) usando regras
//   da Metodologia BN. Mantém o mesmo JSON consumido pelo frontend.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clean = (s: string) => (s || "").replace(/[^\x20-\x7E\u00C0-\u017F]/g, "");
const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supa.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims;
}

// ─── BASE DE REGRAS (Metodologia BN) ───────────────────────────────────────────
type Rule = {
  id: string;
  keywords: string[];
  nome: string;
  localizacao: string;
  causa: string;
  impacto: string;
  encurtados: string[];
  fracos: string[];
  restricoes: string[];
  contraindicados: { exercicio: string; motivo: string }[];
  cautela: { exercicio: string; adaptacao: string }[];
  prioridade: string;
  score: { area: keyof ScorePostural | keyof ScoreFuncional; penalidade: number }[];
};

interface ScorePostural {
  total: number;
  cabeca_cervical: number;
  coluna_toracolombar: number;
  pelve_quadril: number;
  membros_inferiores: number;
  obs: string;
}
interface ScoreFuncional {
  total: number;
  mobilidade_tornozelo: number;
  mobilidade_quadril: number;
  estabilidade_lombar: number;
  controle_joelho: number;
  simetria_movimento: number;
  obs: string;
}

const RULES: Rule[] = [
  {
    id: "joelho",
    keywords: ["joelho", "patela", "patelar", "valgo", "menisco", "condromalacia", "femoropatelar"],
    nome: "Valgo dinâmico / sobrecarga de joelho",
    localizacao: "bilateral",
    causa: "Fraqueza de glúteo médio e rotadores externos do quadril + possível pronação de tornozelo",
    impacto: "Risco elevado de dor patelofemoral e síndrome do estresse tibial; exige controle de joelho em agachamentos",
    encurtados: ["Tensor da fáscia lata (TFL)", "Adutores", "Banda iliotibial"],
    fracos: ["Glúteo médio", "Rotadores externos do quadril", "Vasto medial oblíquo"],
    restricoes: ["Controle de joelho no agachamento", "Estabilidade de membro inferior unipodal"],
    contraindicados: [
      { exercicio: "Agachamento com carga máxima sem controle de técnica", motivo: "Reforça o padrão de valgo sob carga" },
      { exercicio: "Leg press com joelhos em colapso medial", motivo: "Sobrecarrega a articulação femoropatelar" },
    ],
    cautela: [
      { exercicio: "Agachamento livre", adaptacao: "Reduzir carga, priorizar técnica e amplitude controlada" },
      { exercicio: "Afundo / passada", adaptacao: "Foco no alinhamento joelho-pé, volume progressivo" },
    ],
    prioridade: "Fortalecer glúteo médio e rotadores externos para corrigir o controle de joelho",
    score: [{ area: "controle_joelho", penalidade: 3 }, { area: "membros_inferiores", penalidade: 2 }],
  },
  {
    id: "lombar",
    keywords: ["lombar", "lombalgia", "coluna", "hiperlordose", "lordose", "hernia", "disco", "costas baixa", "sacro"],
    nome: "Instabilidade lombar / hiperlordose",
    localizacao: "central",
    causa: "Encurtamento de psoas e reto femoral + fraqueza de core e glúteo máximo",
    impacto: "Sobrecarga lombar em cargas axiais; risco de dor sacroilíaca e lombalgia",
    encurtados: ["Psoas (flexores do quadril)", "Eretores da espinha", "Reto femoral"],
    fracos: ["Transverso do abdômen / core", "Glúteo máximo", "Multífidos"],
    restricoes: ["Estabilidade lombo-pélvica", "Dissociação quadril-lombar"],
    contraindicados: [
      { exercicio: "Levantamento terra pesado sem domínio técnico", motivo: "Risco de sobrecarga lombar em flexão" },
      { exercicio: "Agachamento com carga axial elevada", motivo: "Compressão lombar com core instável" },
    ],
    cautela: [
      { exercicio: "Stiff / good morning", adaptacao: "Amplitude parcial e carga leve até estabilizar o core" },
      { exercicio: "Agachamento", adaptacao: "Priorizar bracing abdominal e neutralidade pélvica" },
    ],
    prioridade: "Estabilização de core e alongamento de flexores do quadril",
    score: [{ area: "estabilidade_lombar", penalidade: 3 }, { area: "coluna_toracolombar", penalidade: 2 }],
  },
  {
    id: "ombro",
    keywords: ["ombro", "manguito", "impacto", "protrusao", "cifose", "torax", "supraespinhal", "escapula"],
    nome: "Protrusão de ombros / disfunção escapular",
    localizacao: "bilateral",
    causa: "Encurtamento de peitoral menor + fraqueza de romboides e trapézio inferior",
    impacto: "Limitação de mobilidade overhead e risco de impacto subacromial",
    encurtados: ["Peitoral menor", "Peitoral maior", "Trapézio superior"],
    fracos: ["Romboides", "Trapézio inferior", "Manguito rotador"],
    restricoes: ["Mobilidade overhead", "Estabilidade escapular"],
    contraindicados: [
      { exercicio: "Desenvolvimento atrás da nuca", motivo: "Posição de risco para impacto subacromial" },
      { exercicio: "Supino com pegada muito aberta", motivo: "Estresse anterior de ombro com escápula instável" },
    ],
    cautela: [
      { exercicio: "Desenvolvimento overhead", adaptacao: "Reduzir amplitude e priorizar estabilidade escapular" },
      { exercicio: "Crucifixo", adaptacao: "Limitar amplitude posterior para proteger a cápsula anterior" },
    ],
    prioridade: "Mobilidade torácica e fortalecimento de retratores escapulares",
    score: [{ area: "coluna_toracolombar", penalidade: 2 }, { area: "cabeca_cervical", penalidade: 1 }],
  },
  {
    id: "tornozelo",
    keywords: ["tornozelo", "dorsiflexao", "entorse", "panturrilha", "aquiles", "calcaneo", "fascite"],
    nome: "Restrição de dorsiflexão de tornozelo",
    localizacao: "bilateral",
    causa: "Encurtamento de gastrocnêmio/sóleo ou restrição capsular do tornozelo",
    impacto: "Inclinação excessiva de tronco no agachamento e compensação lombar",
    encurtados: ["Gastrocnêmio", "Sóleo"],
    fracos: ["Tibial anterior", "Fibulares"],
    restricoes: ["Dorsiflexão de tornozelo", "Profundidade de agachamento"],
    contraindicados: [
      { exercicio: "Agachamento profundo sem calço com tornozelo restrito", motivo: "Força compensação lombar e valgo" },
    ],
    cautela: [
      { exercicio: "Agachamento profundo", adaptacao: "Usar calço/anilha sob o calcanhar até ganhar mobilidade" },
    ],
    prioridade: "Ganho de mobilidade de tornozelo (dorsiflexão)",
    score: [{ area: "mobilidade_tornozelo", penalidade: 3 }, { area: "membros_inferiores", penalidade: 1 }],
  },
  {
    id: "quadril",
    keywords: ["quadril", "pelve", "drop", "trendelenburg", "gluteo", "piriforme", "abdutor"],
    nome: "Drop de pelve / fraqueza de abdutores",
    localizacao: "bilateral",
    causa: "Fraqueza de glúteo médio e mínimo (abdutores do quadril)",
    impacto: "Desalinhamento em agachamentos/levantamentos e sobrecarga no IT band",
    encurtados: ["Adutores", "Tensor da fáscia lata (TFL)"],
    fracos: ["Glúteo médio", "Glúteo mínimo"],
    restricoes: ["Mobilidade de quadril", "Estabilidade pélvica unipodal"],
    contraindicados: [],
    cautela: [
      { exercicio: "Agachamento unilateral", adaptacao: "Reduzir amplitude e garantir nível pélvico" },
    ],
    prioridade: "Fortalecimento de abdutores do quadril e estabilidade pélvica",
    score: [{ area: "mobilidade_quadril", penalidade: 2 }, { area: "pelve_quadril", penalidade: 2 }],
  },
  {
    id: "cervical",
    keywords: ["cervical", "pescoco", "cabeca", "anteriorizacao", "cefaleia", "trapezio"],
    nome: "Anteriorização da cabeça",
    localizacao: "central",
    causa: "Encurtamento de suboccipitais e peitoral + fraqueza de flexores profundos do pescoço",
    impacto: "Tensão cervical e limitação de mobilidade torácica",
    encurtados: ["Suboccipitais", "Esternocleidomastóideo", "Peitoral menor"],
    fracos: ["Flexores profundos do pescoço", "Trapézio inferior"],
    restricoes: ["Extensão torácica"],
    contraindicados: [],
    cautela: [
      { exercicio: "Encolhimento (shrug) pesado", adaptacao: "Carga moderada e foco postural" },
    ],
    prioridade: "Reeducação postural cervical e mobilidade torácica",
    score: [{ area: "cabeca_cervical", penalidade: 3 }],
  },
  {
    id: "pe",
    keywords: ["pe", "pes", "pronacao", "supinacao", "chapado", "plano", "arco"],
    nome: "Pronação excessiva de pé",
    localizacao: "bilateral",
    causa: "Colapso do arco plantar e fraqueza de musculatura intrínseca do pé",
    impacto: "Cadeia ascendente: contribui para valgo de joelho e drop de pelve",
    encurtados: ["Fibulares"],
    fracos: ["Tibial posterior", "Musculatura intrínseca do pé"],
    restricoes: ["Estabilidade do pé na fase de apoio"],
    contraindicados: [],
    cautela: [
      { exercicio: "Saltos / pliometria", adaptacao: "Volume progressivo com foco no alinhamento do apoio" },
    ],
    prioridade: "Fortalecimento de tibial posterior e controle do arco plantar",
    score: [{ area: "membros_inferiores", penalidade: 2 }],
  },
];

function severityFromContext(text: string): "leve" | "moderada" | "severa" {
  const t = normalize(text);
  if (/(cirurgia|hernia|ruptura|grave|severa|forte|cronic|nao consigo|impossivel|lesao recente)/.test(t)) return "severa";
  if (/(dor|desconforto|limitacao|leve dor|incomodo|recorrente)/.test(t)) return "moderada";
  return "leve";
}

function buildAssessment(input: {
  student_name: string;
  queixa_principal: string;
  historico_lesoes: string;
  modalidade: string;
  nivel: string;
  imagesProvided: string[];
}) {
  const haystack = normalize(`${input.queixa_principal} ${input.historico_lesoes} ${input.modalidade}`);
  const matched = RULES.filter((r) => r.keywords.some((k) => haystack.includes(normalize(k))));

  const sev = severityFromContext(`${input.queixa_principal} ${input.historico_lesoes}`);

  // Scores base (10 = ideal), penalizados por disfunção
  const sp: ScorePostural = {
    total: 10, cabeca_cervical: 10, coluna_toracolombar: 10, pelve_quadril: 10,
    membros_inferiores: 10, obs: "Escala de 0 a 10 onde 10 é ideal.",
  };
  const sf: ScoreFuncional = {
    total: 10, mobilidade_tornozelo: 10, mobilidade_quadril: 10, estabilidade_lombar: 10,
    controle_joelho: 10, simetria_movimento: 10, obs: "Escala de 0 a 10 onde 10 é ideal.",
  };
  const sevMult = sev === "severa" ? 1.4 : sev === "moderada" ? 1 : 0.6;

  const encurtados = new Set<string>();
  const fracos = new Set<string>();
  const restricoes = new Set<string>();
  const contraindicados: { exercicio: string; motivo: string }[] = [];
  const cautela: { exercicio: string; adaptacao: string }[] = [];
  const prioridades: string[] = [];
  const disfuncoes = matched.map((r) => {
    r.encurtados.forEach((x) => encurtados.add(x));
    r.fracos.forEach((x) => fracos.add(x));
    r.restricoes.forEach((x) => restricoes.add(x));
    r.contraindicados.forEach((x) => contraindicados.push(x));
    r.cautela.forEach((x) => cautela.push(x));
    if (!prioridades.includes(r.prioridade)) prioridades.push(r.prioridade);
    for (const s of r.score) {
      const pen = Math.round(s.penalidade * sevMult);
      if (s.area in sp) (sp as any)[s.area] = Math.max(0, (sp as any)[s.area] - pen);
      if (s.area in sf) (sf as any)[s.area] = Math.max(0, (sf as any)[s.area] - pen);
    }
    return {
      nome: r.nome,
      localizacao: r.localizacao,
      gravidade: sev,
      causa_provavel: r.causa,
      impacto_treino: r.impacto,
    };
  });

  // Recalcula totais
  sp.total = Math.round((sp.cabeca_cervical + sp.coluna_toracolombar + sp.pelve_quadril + sp.membros_inferiores) / 4);
  sf.total = Math.round(
    (sf.mobilidade_tornozelo + sf.mobilidade_quadril + sf.estabilidade_lombar + sf.controle_joelho + sf.simetria_movimento) / 5
  );

  if (prioridades.length === 0) {
    prioridades.push("Manutenção da boa mecânica de movimento e progressão de carga controlada");
  }

  const nome = clean(input.student_name || "O aluno");
  const modalidade = clean(input.modalidade || "treinamento");
  const nivel = clean(input.nivel || "intermediário");

  let relatorio: string;
  if (disfuncoes.length === 0) {
    relatorio =
      `${nome}, sua avaliação não apontou disfunções relevantes a partir das informações fornecidas. ` +
      `Isso é um ótimo ponto de partida para o seu programa de ${modalidade}.\n\n` +
      `O foco do trabalho será manter a boa mecânica de movimento e aplicar a sobrecarga progressiva de forma segura, ` +
      `respeitando o seu nível (${nivel}). Continuamos monitorando postura e padrões de movimento a cada ciclo.`;
  } else {
    const listaDisf = disfuncoes.map((d) => `• ${d.nome} (${d.gravidade})`).join("\n");
    relatorio =
      `${nome}, com base na sua queixa e histórico, identificamos alguns pontos de atenção que vamos trabalhar ao longo do programa:\n\n` +
      `${listaDisf}\n\n` +
      `Esses pontos são comuns e totalmente trabalháveis. O programa de ${modalidade} vai priorizar a correção desses padrões, ` +
      `combinando fortalecimento das estruturas mais fracas, ganho de mobilidade onde há restrição e ajuste técnico nos exercícios. ` +
      `Tudo respeitando o seu nível atual (${nivel}) e evoluindo de forma segura.\n\n` +
      `A prioridade inicial será: ${prioridades[0].toLowerCase()}. Vamos acompanhar a evolução a cada ciclo.`;
  }

  const resumo =
    `Avaliação determinística (Metodologia BN) — ${nome}.\n` +
    `Disfunções: ${disfuncoes.length ? disfuncoes.map((d) => d.nome).join("; ") : "nenhuma relevante identificada"}.\n` +
    `Músculos a priorizar (fortalecer): ${[...fracos].join(", ") || "—"}.\n` +
    `Músculos a alongar/liberar: ${[...encurtados].join(", ") || "—"}.\n` +
    `Restrições: ${[...restricoes].join(", ") || "—"}.\n` +
    `Prioridades corretivas: ${prioridades.join(" → ")}.\n` +
    `Score postural ${sp.total}/10 · Score funcional ${sf.total}/10.`;

  return {
    fonte: "bn_deterministic_engine",
    imagens_recebidas: input.imagesProvided,
    postura_estatica: {
      vista_frontal: { observacoes: "Análise baseada em dados clínicos informados (sem leitura automática de imagem)." },
      vista_lateral: { observacoes: "Análise baseada em dados clínicos informados (sem leitura automática de imagem)." },
      vista_posterior: { observacoes: "Análise baseada em dados clínicos informados (sem leitura automática de imagem)." },
    },
    overhead_squat: {
      vista_frontal: { observacoes: "Avaliar manualmente com as fotos enviadas." },
      vista_lateral: { observacoes: "Avaliar manualmente com as fotos enviadas." },
      vista_posterior: { observacoes: "Avaliar manualmente com as fotos enviadas." },
    },
    disfuncoes_identificadas: disfuncoes,
    musculos_encurtados: [...encurtados],
    musculos_fracos: [...fracos],
    restricoes_movimento: [...restricoes],
    prioridades_corretivas: prioridades,
    exercicios_contraindicados: contraindicados,
    exercicios_cautela: cautela,
    score_postural: sp,
    score_funcional: sf,
    relatorio_para_aluno: relatorio,
    resumo_para_prescricao: resumo,
  };
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const claims = await requireUser(req);
  if (!claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      student_id,
      student_name,
      company_id,
      assessment_id,
      image_postura_frente,
      image_postura_lado,
      image_postura_costas,
      image_squat_frente,
      image_squat_lado,
      image_squat_costas,
      queixa_principal = "",
      historico_lesoes = "",
      modalidade = "",
      nivel = "",
    } = await req.json();

    const imagesProvided: string[] = [];
    if (image_postura_frente) imagesProvided.push("Postura — Frontal");
    if (image_postura_lado) imagesProvided.push("Postura — Lateral");
    if (image_postura_costas) imagesProvided.push("Postura — Posterior");
    if (image_squat_frente) imagesProvided.push("Overhead Squat — Frontal");
    if (image_squat_lado) imagesProvided.push("Overhead Squat — Lateral");
    if (image_squat_costas) imagesProvided.push("Overhead Squat — Posterior");

    const assessmentJson = buildAssessment({
      student_name: student_name || "",
      queixa_principal,
      historico_lesoes,
      modalidade,
      nivel,
      imagesProvided,
    });

    const reportText = assessmentJson.relatorio_para_aluno;
    const resumoPrescricao = assessmentJson.resumo_para_prescricao;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const id = assessment_id || crypto.randomUUID();

    await supabase.from("functional_assessments").upsert({
      id,
      company_id,
      student_id,
      queixa_principal: clean(queixa_principal),
      historico_lesoes: clean(historico_lesoes),
      modalidade: clean(modalidade),
      nivel: clean(nivel),
      ai_raw_response: JSON.stringify({ generated_by: "bn_deterministic_engine" }),
      report_text: reportText,
      assessment_json: assessmentJson,
      status: "completed",
    });

    return new Response(
      JSON.stringify({
        id,
        report_text: reportText,
        assessment_json: assessmentJson,
        resumo_prescricao: resumoPrescricao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
