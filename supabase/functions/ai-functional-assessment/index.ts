import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Visão postural: melhor Sonnet por padrão (env-overridable; pode trocar p/ claude-opus-4-8)
const MODEL = Deno.env.get("ANTHROPIC_MODEL_VISION") || Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5-20250929";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clean = (s: unknown) => String(s || "").replace(/[^\x20-\x7EÀ-ſ]/g, "");

function extractJson(raw: string): any {
  if (!raw) throw new Error("Resposta vazia da IA");
  let s = raw.replace(/```json|```/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

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

function aiErrorResponse(status: number) {
  const msg =
    status === 429 ? "Limite de requisições da IA atingido. Tente novamente em instantes." :
    status === 401 ? "Chave da Anthropic inválida. Verifique a ANTHROPIC_API_KEY." :
    status === 402 ? "Créditos da Anthropic esgotados." :
    "Erro ao chamar a IA.";
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
Você é um especialista em avaliação postural e funcional da BN Performance Training.
Sua função é analisar imagens de avaliação postural estática e overhead squat e gerar
um laudo técnico completo que será usado para prescrição de treino individualizado.

METODOLOGIA BN PERFORMANCE:
A BN Performance Training avalia cada aluno em dois momentos:
1. POSTURA ESTÁTICA — fotos de frente, lado e costas com grid de alinhamento
2. MOVIMENTO FUNCIONAL — overhead squat de frente, lado e costas

O objetivo é identificar compensações, disfunções e restrições que impactam
tanto a performance (corrida, triathlon, musculação) quanto a estética corporal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE BN ANONIMIZADA — VÍDEOS E PROTOCOLOS HISTÓRICOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A base histórica da BN aparece como pastas de avaliações completas com cortes de
vídeo e imagens, normalmente em conjuntos de 6 a 9 cortes por avaliação. Use este
padrão como referência técnica, mas NUNCA cite nomes, rostos, datas, pastas ou
qualquer dado pessoal. A saída deve conter somente achados técnicos anonimizados.

Quando receber frames rotulados como "Postura inicial", "Air Squat", "Toe Touch",
"Lunge alternado", "Shoulder Flexion", "Marcha estacionaria" e "Equilibrio
unipodal", trate como vídeo completo da sequência oficial BN.

SEQUÊNCIA OFICIAL BN — VÍDEO COMPLETO:
1. Air Squat — avaliar mobilidade de tornozelo, joelho e quadril; controle de tronco; 3 repetições controladas.
2. Toe Touch — verificar flexibilidade de cadeia posterior; 1 repetição lenta.
3. Lunge alternado — checar controle unilateral, equilíbrio, alinhamento de joelho e quadril; 2 repetições por perna.
4. Shoulder Flexion — observar mobilidade torácica e de ombros; 2 repetições lentas.
5. Marcha estacionaria — avaliar coordenação e ativação de core durante deslocamento vertical; 10 segundos contínuos.
6. Equilíbrio unipodal — verificar estabilidade de tornozelo, joelho e quadril; 10 segundos por perna.

REGISTRO OBRIGATÓRIO NA SEQUÊNCIA BN:
□ dor relatada ou sinal visual de proteção
□ tremor, instabilidade ou perda de controle
□ valgo/varo dinâmico
□ inclinação lateral ou rotação de tronco/quadril
□ assimetria direita/esquerda
□ limitação clara de amplitude
□ compensação que muda a prescrição

Se o vídeo não trouxer Overhead Squat clássico com braços acima da cabeça, use o
Air Squat como principal movimento de agachar, preencha overhead_squat de forma
conservadora e explique nas observações que a inferência veio do Air Squat.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRECIONAMENTO DE PROTOCOLO BN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Escalas de registro:
□ DOR: 0 = sem dor, 10 = dor insuportável.
□ ADM: 0 = muita amplitude, 3 = pouca amplitude.

PROTOCOLO 1 — PADRÃO:
Use quando não houver queixa principal relevante e o agachamento não mostrar
disfunção importante. Testes a recomendar quando necessário: FADIR, Thomas,
Craig, estabilidade lombar, estabilidade cervical, Lunge Test, rotação interna e
externa de ombro.

PROTOCOLO 2 — MMII:
Use quando houver queixa de membros inferiores ou disfunção clara em squat, lunge,
toe touch, marcha ou equilíbrio. Testes a recomendar: FADIR, Thomas, KEA Test,
Craig, estabilidade lombar, Step Down Test e Lunge Test.

PROTOCOLO 3 — MMSS:
Use quando houver queixa de membros superiores, limitação de shoulder flexion,
alteração escapular, torácica ou de cervical. Testes a recomendar: coluna
(flexão, extensão, inclinação e rotação), flexão de ombros, rotação interna e
externa de ombros, elevação lateral, testes escapulares e cervical.

PROTOCOLO 4 — RADICULOPATIA:
Use como adicional quando houver sinais compatíveis com irradiação, formigamento,
perda de força, dor neurológica ou dor cervical/lombar relevante. Para MMII,
recomende LASEG e SLUMP. Para MMSS, diferencie suspeita cervical discal/facetária
e recomende encaminhamento quando houver red flag.

TRANSFERÊNCIA PARA TREINO — METODOLOGIA BN:
□ Ordem base: Mobilidade → Ativação → Controle motor → Pliometria/Potência quando apropriado → Força.
□ Primeiro treino deve validar a avaliação, observar resposta e evitar sobrecargas extremas.
□ Pliometria só entra quando movimentos básicos estão sem dor e com alinhamento, o aluno tem pelo menos 6 semanas de base, aterrissa bem e recupera sem dor articular.
□ Se houver dor EVA acima de 3, reduza amplitude/carga/braço de momento e não progrida o padrão doloroso.
□ Dor aguda, edema importante, piora progressiva, perda de força, formigamento, dor torácica, tontura/desmaio ou suspeita de fratura por estresse exigem cautela e encaminhamento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOLO DE ANÁLISE — POSTURA ESTÁTICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VISTA FRONTAL (com grid):
□ Alinhamento da cabeça (inclinação lateral, rotação)
□ Nível dos ombros (ombro mais alto/baixo, protração bilateral ou unilateral)
□ Nível das cristas ilíacas (pelve mais alta de um lado)
□ Joelhos (valgo/varo bilateral ou unilateral)
□ Pés (pronação, supinação, rotação externa/interna)
□ Simetria geral direita vs esquerda

VISTA LATERAL:
□ Posição da cabeça (anteriorização, retificação cervical)
□ Ombros (protrusão anterior, cifose torácica)
□ Coluna torácica (hipercifose, retificação)
□ Coluna lombar (hiperlordose, retificação)
□ Pelve (anteversão = hiperlordose lombar / retroversão = lordose reduzida)
□ Quadril (flexão de quadril — hip flexors encurtados)
□ Joelhos (hiperextensão, flexão)
□ Tornozelos (flexão plantar compensatória)

VISTA POSTERIOR (com grid):
□ Alinhamento da coluna (escoliose funcional ou estrutural)
□ Nível de escápulas (abdução, elevação)
□ Altura das cristas ilíacas (drop da pelve em repouso)
□ Joelhos (valgo/varo, rotação tibial)
□ Calcanhares (pronação = calcâneo valgum)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOLO DE ANÁLISE — OVERHEAD SQUAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VISTA FRONTAL:
□ Assimetria de braços (um lado mais baixo/rotado)
□ Inclinação lateral do tronco
□ Joelhos: valgo bilateral ou unilateral (indica fraqueza de glúteo médio/rotadores externos)
□ Pés: pronação excessiva, rotação externa compensatória
□ Drop da pelve (um lado cai — Trendelenburg funcional)
□ Deslocamento do peso para um lado

VISTA LATERAL:
□ Inclinação excessiva do tronco à frente
  — Ângulo do tronco vs ângulo da tíbia (devem ser aproximadamente paralelos)
  — Inclinação desproporcional indica: encurtamento de tornozelo (ADM limitada),
    fraqueza de glúteos ou encurtamento de hip flexors
□ Falta de ADM (amplitude de dorsiflexão do tornozelo)
  — Identificar se limitação é de tornozelo ou de mobilidade de quadril
□ Retroversão pélvica ao final do movimento ("butt wink")
  — Indica encurtamento de isquiotibiais e limitação de dorsiflexão
□ Aumento da lordose lombar durante o movimento
  — Indica fraqueza de core + hip flexors encurtados
□ Profundidade do agachamento (ADM total do movimento)

VISTA POSTERIOR:
□ Drop da pelve (um lado cai durante o agachamento)
□ Assimetria de braços overhead
□ Desvio lateral da coluna durante o movimento
□ Rotação de quadril assimétrica

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISFUNÇÕES E SUAS CAUSAS PROVÁVEIS (para referenciar no laudo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INCLINAÇÃO EXCESSIVA DO TRONCO NO SQUAT:
→ Causa 1: Falta de ADM de tornozelo (dorsiflexão limitada)
→ Causa 2: Fraqueza de glúteos/quadríceps
→ Causa 3: Encurtamento de hip flexors (psoas/reto femoral)
→ Impacto corrida: aumento de sobrecarga posterior, risco de lesão lombar

DROP DA PELVE:
→ Causa: Fraqueza de glúteo médio e pequeno (abdutores do quadril)
→ Impacto corrida: síndrome do estresse tibial, STIC, dor no TFL/IT band
→ Impacto musculação: desalinhamento nos agachamentos e levantamentos

RETROVERSÃO PÉLVICA (BUTT WINK):
→ Causa 1: Encurtamento de isquiotibiais
→ Causa 2: Falta de mobilidade de quadril
→ Causa 3: Fraqueza de core na estabilização lombar
→ Impacto: sobrecarga lombar em cargas axiais

VALGO DE JOELHO:
→ Causa 1: Fraqueza de glúteo médio + rotadores externos
→ Causa 2: Pronação excessiva de tornozelo
→ Causa 3: Fraqueza de vasto medial
→ Impacto corrida: risco elevado de STIC e dor patelofemoral
→ Lado afetado sempre deve ser indicado (D, E ou bilateral)

ASSIMETRIA DE BRAÇOS NO OVERHEAD:
→ Causa 1: Limitação de mobilidade de ombro (geralmente o lado mais baixo)
→ Causa 2: Desequilíbrio de trapézio/serrátil anterior
→ Causa 3: Restrição de mobilidade torácica

PROTRUSÃO DE OMBROS (postura estática):
→ Causa: Peitoral menor encurtado + romboides/trapézio inferior fracos
→ Impacto: limitação de mobilidade overhead, risco de impacto subacromial

HIPERLORDOSE LOMBAR (postura estática):
→ Causa: Psoas/reto femoral encurtados + core e glúteos fracos
→ Impacto corrida: síndrome do piriforme, dor sacroilíaca, stress lombar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO DE SAÍDA — RESPONDA APENAS COM JSON VÁLIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada imagem vem rotulada com a VISTA e um identificador [frameId=XYZ].
Você deve retornar EXATAMENTE este JSON, sem texto adicional, sem markdown:

{
  "frame_findings": [
    {
      "frameId": "copie EXATAMENTE o frameId rotulado naquela imagem",
      "vista": "a vista rotulada",
      "findings": [
        { "gravidade": "Leve | Moderada | Severa", "descricao": "compensação objetiva observada NAQUELE frame" }
      ]
    }
  ],
  "postura_estatica": {
    "vista_frontal": { "cabeca": "descrição ou null", "ombros": "descrição ou null", "pelve": "descrição ou null", "joelhos": "descrição ou null", "pes": "descrição ou null", "observacoes": "outras observações" },
    "vista_lateral": { "cabeca_pescoco": "descrição ou null", "ombros": "descrição ou null", "coluna_toracica": "descrição ou null", "coluna_lombar": "descrição ou null", "pelve": "descrição ou null", "joelhos": "descrição ou null", "observacoes": "outras observações" },
    "vista_posterior": { "coluna": "descrição ou null", "escapulas": "descrição ou null", "pelve": "descrição ou null", "joelhos_calcanhares": "descrição ou null", "observacoes": "outras observações" }
  },
  "overhead_squat": {
    "vista_frontal": { "bracos": "simétrico | assimetria direita | assimetria esquerda", "joelhos": "sem alteração | valgo bilateral | valgo direito | valgo esquerdo | varo", "pelve": "estável | drop direito | drop esquerdo", "tronco": "centralizado | desvio direito | desvio esquerdo", "observacoes": "outras observações" },
    "vista_lateral": { "inclinacao_tronco": "adequada | excessiva", "angulo_tibiotronco": "paralelo | tronco muito a frente", "adm_tornozelo": "adequada | limitada", "pelve_fundo": "neutra | retroversao | anteversao", "lordose_lombar": "mantida | aumentada | reduzida", "profundidade_squat": "completa | parcial | limitada", "observacoes": "outras observações" },
    "vista_posterior": { "drop_pelve": "ausente | direito | esquerdo", "assimetria_bracas": "ausente | presente direito | presente esquerdo", "desvio_coluna": "ausente | presente", "observacoes": "outras observações" }
  },
  "composicao_corporal": {
    "peso_kg": 0,
    "altura_cm": 0,
    "cintura_cm": 0,
    "percentual_gordura_informado": 0,
    "imc": 0,
    "leitura_tecnica": "leitura conservadora das medidas e fotos quando disponíveis",
    "confianca": "baixa | media | alta",
    "prioridades_de_acompanhamento": ["medidas ou fotos que devem ser acompanhadas"]
  },
  "analise_tecnica_movimento": [
    {
      "movimento": "overhead squat | postura | exercício descrito | corrida | outro",
      "achado": "compensação ou ponto técnico observado",
      "impacto": "como afeta treino/performance/composição",
      "cue_ou_ajuste": "correção prática ou próximo teste",
      "confianca": "baixa | media | alta"
    }
  ],
  "sequencia_bn_video": [
    {
      "movimento": "Postura inicial | Air Squat | Toe Touch | Lunge alternado | Shoulder Flexion | Marcha estacionaria | Equilibrio unipodal D | Equilibrio unipodal E",
      "objetivo_observacao": "o que esse movimento avalia na metodologia BN",
      "achados": ["achados tecnicos objetivos"],
      "compensacoes": [
        { "gravidade": "Leve | Moderada | Severa", "descricao": "compensação observada", "lado": "direito | esquerdo | bilateral | nao_aplica" }
      ],
      "score": 0,
      "cue_ou_teste": "cue pratico ou teste complementar indicado"
    }
  ],
  "direcionamento_protocolo": {
    "protocolo": "padrao | MMII | MMSS | radiculopatia | combinado",
    "motivo": "por que esse protocolo foi escolhido",
    "testes_recomendados": ["testes complementares pela metodologia BN"],
    "escalas": { "dor_eva": "0-10", "adm": "0-3" },
    "prioridade_reavaliacao": "baixa | media | alta"
  },
  "red_yellow_flags": [
    {
      "tipo": "yellow | red",
      "sinal": "ponto de atencao observado ou relatado",
      "conduta": "ajuste conservador ou encaminhamento"
    }
  ],
  "criterios_progressao_bn": {
    "sequencia_treino": ["mobilidade", "ativacao", "controle_motor", "pliometria_ou_potencia_quando_apropriado", "forca"],
    "liberado_para_pliometria": false,
    "motivo": "criterios atendidos ou pendentes",
    "primeiro_treino": ["prioridades praticas para validar a avaliacao"]
  },
  "disfuncoes_identificadas": [
    { "nome": "nome da disfunção", "localizacao": "bilateral | direito | esquerdo", "gravidade": "leve | moderada | severa", "causa_provavel": "descrição da causa", "impacto_treino": "como isso afeta o treino" }
  ],
  "musculos_encurtados": ["lista de músculos provavelmente encurtados"],
  "musculos_fracos": ["lista de músculos provavelmente fracos/inibidos"],
  "restricoes_movimento": ["lista de restrições de amplitude/mobilidade"],
  "prioridades_corretivas": ["1ª prioridade de intervenção", "2ª prioridade", "3ª prioridade"],
  "exercicios_contraindicados": [ { "exercicio": "nome do exercício", "motivo": "por que contraindicar" } ],
  "exercicios_cautela": [ { "exercicio": "nome do exercício", "adaptacao": "como adaptar para tornar seguro" } ],
  "score_postural": { "total": 0, "cabeca_cervical": 0, "coluna_toracolombar": 0, "pelve_quadril": 0, "membros_inferiores": 0, "obs": "escala de 0 a 10 onde 10 é ideal" },
  "score_funcional": { "total": 0, "mobilidade_tornozelo": 0, "mobilidade_quadril": 0, "estabilidade_lombar": 0, "controle_joelho": 0, "simetria_movimento": 0, "obs": "escala de 0 a 10 onde 10 é ideal" },
  "relatorio_para_aluno": "Texto em português claro, acolhedor e motivador (3-5 parágrafos). Explica o que foi encontrado em linguagem acessível, sem termos técnicos excessivos. Tom: profissional e encorajador.",
  "resumo_para_prescricao": "Texto técnico resumido (2-3 parágrafos) para quem vai prescrever: principais disfunções, músculos a priorizar, restrições e orientações por modalidade."
}

REGRAS:
- SEMPRE preencha "frame_findings" com um item por imagem recebida, copiando o frameId rotulado. Se uma vista não tiver compensação, use findings: [].
- Baseie "disfuncoes_identificadas" no conjunto de TODAS as imagens.
- Se os frames seguirem a sequência oficial BN, preencha "sequencia_bn_video", "direcionamento_protocolo", "red_yellow_flags" e "criterios_progressao_bn" mesmo que algumas vistas clássicas de postura/OHS estejam ausentes.
- Nunca invente dor, diagnóstico ou dado clínico. Se uma dor não foi informada, escreva que não foi relatada e use baixa/média confiança.
`.trim();

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada. Adicione o segredo para usar a IA." }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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
      assessment_id,        // se presente → fluxo de fotos: a função persiste no banco
      frames,               // fluxo VÍDEO: [{ vista, data(base64), frameId }]
      image_postura_frente, image_postura_lado, image_postura_costas,
      image_squat_frente, image_squat_lado, image_squat_costas,
      queixa_principal = "",
      historico_lesoes = "",
      modalidade = "",
      nivel = "",
      peso_kg = "",
      altura_cm = "",
      cintura_cm = "",
      percentual_gordura = "",
      perimetros = "",
      observacoes_tecnicas = "",
      assessment_source = "",
      protocol_hint = "",
      expected_movements = [],
    } = await req.json();

    // Monta o conteúdo de imagens, rotulando cada uma com vista + frameId
    const imageContent: any[] = [];
    const pushImage = (label: string, frameId: string, dataUrlOrB64: string) => {
      if (!dataUrlOrB64) return;
      imageContent.push({ type: "text", text: `\n--- ${label} [frameId=${frameId}] ---` });
      imageContent.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: dataUrlOrB64.replace(/^data:image\/\w+;base64,/, "") },
      });
    };

    if (Array.isArray(frames) && frames.length > 0) {
      frames.forEach((fr: any, i: number) =>
        pushImage(fr.vista || `Frame ${i + 1}`, fr.frameId || `frame_${i}`, fr.data || fr.base64 || ""));
    } else {
      [
        { key: image_postura_frente, label: "POSTURA ESTÁTICA — VISTA FRONTAL", id: "postura_frente" },
        { key: image_postura_lado,   label: "POSTURA ESTÁTICA — VISTA LATERAL", id: "postura_lado" },
        { key: image_postura_costas, label: "POSTURA ESTÁTICA — VISTA POSTERIOR", id: "postura_costas" },
        { key: image_squat_frente,   label: "OVERHEAD SQUAT — VISTA FRONTAL", id: "squat_frente" },
        { key: image_squat_lado,     label: "OVERHEAD SQUAT — VISTA LATERAL", id: "squat_lado" },
        { key: image_squat_costas,   label: "OVERHEAD SQUAT — VISTA POSTERIOR", id: "squat_costas" },
      ].forEach((s) => pushImage(s.label, s.id, s.key));
    }

    const hasTextAssessmentData = [
      peso_kg,
      altura_cm,
      cintura_cm,
      percentual_gordura,
      perimetros,
      observacoes_tecnicas,
      queixa_principal,
      historico_lesoes,
    ].some((value) => String(value || "").trim());

    if (imageContent.length === 0 && !hasTextAssessmentData) {
      return new Response(JSON.stringify({ error: "Nenhuma imagem recebida para análise." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anamneseText = `
DADOS DO ALUNO:
Nome: ${clean(student_name || "não informado")}
Modalidade: ${clean(modalidade || "não informada")}
Nível: ${clean(nivel || "não informado")}
Queixa principal: ${clean(queixa_principal || "nenhuma")}
Histórico de lesões: ${clean(historico_lesoes || "nenhum")}
Peso: ${clean(peso_kg || "não informado")}
Altura: ${clean(altura_cm || "não informada")}
Cintura: ${clean(cintura_cm || "não informada")}
Percentual de gordura informado: ${clean(percentual_gordura || "não informado")}
Perímetros/dobras/outros dados de composição: ${clean(perimetros || "não informado")}
Observações técnicas do professor: ${clean(observacoes_tecnicas || "nenhuma")}
Origem da avaliação: ${clean(assessment_source || "não informada")}
Pista de protocolo: ${clean(protocol_hint || "não informada")}
Movimentos esperados no vídeo: ${Array.isArray(expected_movements) ? expected_movements.map(clean).join(", ") : clean(expected_movements || "não informado")}

${imageContent.length > 0
  ? "Analise TODAS as imagens acima e retorne o JSON conforme instruído, incluindo um item em frame_findings para CADA imagem (use o frameId rotulado)."
  : "Sem imagens nesta avaliação. Gere uma leitura conservadora baseada somente nos dados informados; use frame_findings como array vazio e marque baixa confiança nos achados visuais."}
    `.trim();
    imageContent.push({ type: "text", text: anamneseText });

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: imageContent }] }),
    });

    if (!aiResponse.ok) return aiErrorResponse(aiResponse.status);

    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text ?? "";

    let assessmentJson: any = null;
    let reportText = "";
    let resumoPrescricao = "";
    let frameFindings: any[] = [];
    try {
      assessmentJson = extractJson(rawText);
      reportText = assessmentJson.relatorio_para_aluno || "";
      resumoPrescricao = assessmentJson.resumo_para_prescricao || "";
      frameFindings = assessmentJson.frame_findings || [];
    } catch {
      reportText = "Análise concluída. Revise os achados por frame e ajuste se necessário.";
    }

    // Persiste só no fluxo de fotos (assessment_id presente). No vídeo, o frontend grava após edição.
    if (assessment_id) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await supabase.from("functional_assessments").upsert({
        id: assessment_id, company_id, student_id,
        queixa_principal: clean(queixa_principal), historico_lesoes: clean(historico_lesoes),
        modalidade: clean(modalidade), nivel: clean(nivel),
        ai_raw_response: rawText, report_text: reportText, assessment_json: assessmentJson, status: "completed",
      });
    }

    return new Response(
      JSON.stringify({
        id: assessment_id || null,
        report_text: reportText,
        assessment_json: assessmentJson,
        resumo_prescricao: resumoPrescricao,
        frame_findings: frameFindings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
