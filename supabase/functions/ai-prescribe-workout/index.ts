import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MODEL = "claude-sonnet-4-5-20250929";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clean = (s: string) => (s || "").replace(/[^\x20-\x7E\u00C0-\u017F]/g, "");

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

interface ExerciseCatalogEntry {
  id: string;
  name: string;
  description: string | null;
  muscle_group: string | null;
  targets: Array<{
    muscle_group: string;
    role: string | null;
    volume_percentage: number | null;
  }>;
}

interface ExerciseCatalog {
  company_id: string | null;
  total: number;
  exercises: ExerciseCatalogEntry[];
}

function compactJson(value: unknown, maxLength = 20000) {
  return JSON.stringify(value ?? {}, null, 2).slice(0, maxLength);
}

async function loadExerciseCatalog(
  supabase: ReturnType<typeof createClient>,
  companyId: string | null,
): Promise<ExerciseCatalog> {
  let exerciseQuery = supabase
    .from("exercise_library")
    .select("id, name, description, muscle_group, is_global, company_id")
    .order("muscle_group", { ascending: true })
    .order("name", { ascending: true })
    .limit(700);

  exerciseQuery = companyId
    ? exerciseQuery.or(`is_global.eq.true,company_id.eq.${companyId}`)
    : exerciseQuery.eq("is_global", true);

  const { data: exercises, error: exerciseError } = await exerciseQuery;
  if (exerciseError) {
    throw new Error(`Falha ao carregar biblioteca de exercicios: ${exerciseError.message}`);
  }

  const exerciseRows = exercises ?? [];
  const exerciseIds = exerciseRows.map((exercise) => exercise.id as string).filter(Boolean);

  const [targetsResult, groupsResult, overridesResult] = await Promise.all([
    exerciseIds.length
      ? supabase
          .from("exercise_muscle_targets")
          .select("exercise_id, muscle_group_id, role, volume_percentage")
          .in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("muscle_groups").select("id, name"),
    companyId && exerciseIds.length
      ? supabase
          .from("company_exercise_volumes")
          .select("exercise_id, muscle_group_id, volume_percentage")
          .eq("company_id", companyId)
          .in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (targetsResult.error) throw new Error(`Falha ao carregar alvos musculares: ${targetsResult.error.message}`);
  if (groupsResult.error) throw new Error(`Falha ao carregar grupos musculares: ${groupsResult.error.message}`);
  if (overridesResult.error) throw new Error(`Falha ao carregar volumes da empresa: ${overridesResult.error.message}`);

  const groupNames = new Map<string, string>();
  for (const group of groupsResult.data ?? []) {
    groupNames.set(group.id as string, group.name as string);
  }

  const volumeOverrides = new Map<string, number>();
  for (const override of overridesResult.data ?? []) {
    volumeOverrides.set(
      `${override.exercise_id as string}:${override.muscle_group_id as string}`,
      override.volume_percentage as number,
    );
  }

  const targetsByExercise = new Map<string, ExerciseCatalogEntry["targets"]>();
  for (const target of targetsResult.data ?? []) {
    const exerciseId = target.exercise_id as string;
    const muscleGroupId = target.muscle_group_id as string;
    const targets = targetsByExercise.get(exerciseId) ?? [];
    targets.push({
      muscle_group: groupNames.get(muscleGroupId) ?? muscleGroupId,
      role: (target.role as string | null) ?? null,
      volume_percentage:
        volumeOverrides.get(`${exerciseId}:${muscleGroupId}`) ??
        ((target.volume_percentage as number | null) ?? null),
    });
    targetsByExercise.set(exerciseId, targets);
  }

  return {
    company_id: companyId,
    total: exerciseRows.length,
    exercises: exerciseRows.map((exercise) => ({
      id: exercise.id as string,
      name: exercise.name as string,
      description: (exercise.description as string | null) ?? null,
      muscle_group: (exercise.muscle_group as string | null) ?? null,
      targets: targetsByExercise.get(exercise.id as string) ?? [],
    })),
  };
}

function formatExerciseCatalog(catalog: ExerciseCatalog) {
  return compactJson(
    {
      total_available: catalog.total,
      company_id: catalog.company_id,
      exercises: catalog.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        group: exercise.muscle_group ?? "nao_informado",
        targets: exercise.targets
          .map((target) =>
            [
              target.muscle_group,
              target.role ? `role:${target.role}` : null,
              target.volume_percentage !== null ? `volume:${target.volume_percentage}%` : null,
            ]
              .filter(Boolean)
              .join(" "),
          )
          .join("; "),
        description: exercise.description ? clean(exercise.description).slice(0, 120) : undefined,
      })),
    },
    20000,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePlanLibraryUsage(plan: unknown, validExerciseIds: Set<string>) {
  if (!isRecord(plan)) return null;
  const workouts = Array.isArray(plan.workouts) ? plan.workouts : [];
  const missing: string[] = [];
  const invalid: string[] = [];

  workouts.forEach((workout, workoutIndex) => {
    if (!isRecord(workout)) return;
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    exercises.forEach((exercise, exerciseIndex) => {
      if (!isRecord(exercise)) return;
      const label = `workouts[${workoutIndex}].exercises[${exerciseIndex}]`;
      const exerciseId = exercise.exercise_id;
      if (typeof exerciseId !== "string" || !exerciseId.trim()) {
        missing.push(label);
        return;
      }
      if (!validExerciseIds.has(exerciseId)) invalid.push(`${label}:${exerciseId}`);
    });
  });

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

// ─── SYSTEM PROMPT — METODOLOGIA BN MUSCULAÇÃO ───────────────────────────────
const SYSTEM_PROMPT = `
Você é o Expert de BN Musculação/Força e Biomecânica da BN Performance Training.
Seu papel é prescrever treinos de força utilizando biomecânica de precisão, controlando
a distribuição de torque articular e o alinhamento de vetores de força.

REGRA ZERO — BIBLIOTECA DE EXERCÍCIOS DO APP:
Toda prescrição deve usar EXCLUSIVAMENTE os exercícios fornecidos no contexto
"BIBLIOTECA DE EXERCÍCIOS DO APP". Não invente nomes, variações, máquinas ou exercícios.
Cada exercício deve conter exercise_id real e exercise_name exatamente igual ao nome da biblioteca.
Se não houver opção segura na biblioteca para uma necessidade específica, marque a lacuna em
library_policy.gaps e não substitua por exercício inexistente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILOSOFIA BN FORÇA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Envelope de Função: otimizar a relação entre estresse mecânico aplicado e capacidade
de carga dos tecidos articulares e miotendíneos.
TÉCNICA > CARGA: o movimento deve respeitar braços de momento, cinemática articular ideal
e controle motor ANTES de qualquer progressão de volume ou intensidade.
Objetivo BN: unir estética e funcionalidade — treino que melhora a forma E a performance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOMADA DE DECISÃO CLÍNICA — ANÁLISE DO OVERHEAD SQUAT (OHS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ajuste OBRIGATÓRIO da seleção de exercícios baseado nas falhas de movimento:

LIMITAÇÃO DE DORSIFLEXÃO DE TORNOZELO
(joelhos não passam a linha dos pés / perda de equilíbrio):
→ Prescrever mobilidade de tornozelo (calf stretch, ankle circles, wall drill)
→ No agachamento global: elevação de calcanhares provisória (calcanhar wedge ou anilha)
   para manter tronco verticalizado e reduzir torque de flexão lombar
→ Priorizar: leg press 45°, RDL unilateral, split squat com calcanhar elevado

VALGO DINÂMICO DE JOELHO (colapso medial durante agachamento):
→ Prescrever fortalecimento isolado de abdutores de quadril:
   clamshell, side-lying abduction, fire hydrant, monster walk
→ Técnica RNT (Reactive Neuromuscular Training):
   miniband ao redor dos joelhos durante agachamentos para feedback proprioceptivo
→ Priorizar: box squat com controle, leg press com cue de joelhos para fora
→ Evitar: agachamentos com carga axial alta até correção do valgo

INCLINAÇÃO EXCESSIVA DO TRONCO (perda de controle lombo-pélvico):
→ Substituir Back Squat por variações anteriores que diminuem braço de momento lombar:
   Front Squat, Goblet Squat, Zercher Squat, hack squat na máquina
→ Essas variações favorecem recrutamento de quadríceps e reduzem sobrecarga lombar
→ Fortalecer core lombo-pélvico: pranchas, bird dog, Pallof press, dead bug

RETROVERSÃO PÉLVICA / "BUTT WINK" PRECOCE:
→ Limitar amplitude do agachamento ao ponto anterior à perda do controle pélvico
→ PROIBIDO sobrecarga axial com perda de alinhamento neutro da coluna
→ Trabalhar mobilidade de quadril e isquiotibiais antes do agachamento
→ Box squat com box na altura de segurança (acima do ponto de perda de controle)

DROP DA PELVE (Trendelenburg funcional):
→ Priorizar exercícios unilaterais de quadril: step-up, single-leg press, split squat
→ Adicionar abdutores isolados no início da sessão
→ Progressão gradual antes de retornar ao agachamento bilateral com carga

PROTRUSÃO DE OMBROS / CIFOSE:
→ Adicionar trabalho específico de escápulas: remada curvada, face pull, W-raise
→ Evitar pressão horizontal horizontal intensa até correção postural
→ Priorizar: remadas, pull-ups, puxadas na polia com retração escapular

ASSIMETRIA DE BRAÇOS NO OHS:
→ Abordar mobilidade do ombro comprometido antes das séries de peso
→ Incluir exercícios unilaterais para equalizar o desequilíbrio
→ Rack stretch, sleeper stretch, rotação externa com elástico

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINHAS VERMELHAS — INEGOCIÁVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVA > 3 (dor ativa):
→ Identificar o padrão que desencadeia a dor
→ Modificar braços de momento (mudar ângulo, amplitude ou posicionamento)
→ Reduzir amplitude de movimento até zona livre de dor
→ Substituir por variações com menor estresse cisalhante/compressivo
→ NUNCA progredir carga em padrão que gera dor

PLIOMETRIA PROIBIDA NO 1º BLOCO (primeiras 6 semanas):
→ Nenhum aluno em fase inicial pode realizar pliometria
→ Foco do 1º bloco: base de força e coordenação motora
→ Pliometria apenas a partir do 2º bloco / 2ª prescrição

INSTABILIDADE LOMBO-PÉLVICA ATIVA:
→ Butt wink precoce = PROIBIDA sobrecarga axial
→ Limitar amplitude até ponto seguro
→ Substituir qualquer exercício que exija alinhamento neutro que não consegue manter

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FÓRMULAS DE INTENSIDADE (Belmiro de Salles & Jonato Prestes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Volume Load (VL) = Séries × Repetições × Carga

Estimativa de 1RM (Brzycki):
1RM = Carga / (1,0278 - (0,0278 × Repetições))

ZONAS DE PRESCRIÇÃO:
Força Máxima:      ≥ 85% 1RM | 1-5 reps  | Pausa 3-5 min
Hipertrofia:       65-85% 1RM | 6-12 reps | Pausa 1,5-2 min
Resistência Força: < 60% 1RM  | ≥ 15 reps | Pausa 30-60s

RPE/RIR (Repetições de Reserva):
RIR 0 = falha concêntrica
RIR 1 = 1 rep reserva
RIR 2-3 = estimulante e seguro para treino de hipertrofia
RIR 4+ = aquecimento / técnica

Para atletas de corrida/triathlon: preferir RIR 2-3 para preservar recuperação aeróbica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUTURA OBRIGATÓRIA DA SESSÃO (7 ETAPAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TODA sessão DEVE seguir exatamente esta sequência:

1. MOBILIDADE
   Soltura articular específica com foco nas limitações identificadas no OHS/avaliação
   Ex: mobilidade de tornozelo → 3 séries de 10 ankle circles + wall drill

2. ATIVAÇÃO GERAL — CORE
   Rigidez lombo-pélvica: pranchas, perdigueiro (bird dog), Pallof press, dead bug
   Objetivo: ativar os estabilizadores antes de qualquer carga axial

3. ATIVAÇÃO ESPECÍFICA
   Despertar neuromuscular de sinergistas: glúteo médio, manguito rotador, serrátil
   Ex: clamshell + miniband → glúteo médio | Y-T-W → manguito rotador

4. CONTROLE MOTOR
   Educativos técnicos com baixa carga (< 40% 1RM)
   Foco em padrão de movimento, não em carga
   Ex: goblet squat com 8kg → padrão | RDL com halteres leves → cadeia posterior

5. PLIOMETRIA (APENAS a partir do 2º bloco / 2ª prescrição)
   Nunca no 1º bloco. Iniciar com variações de baixa intensidade
   Ex: box jump baixo → broad jump → saltos unilaterais progressivos

6. FORÇA GLOBAL — MULTIARTICULARES LIVRES (PRIORIDADE BN)
   Exercícios compostos livres são o NÚCLEO da metodologia
   Agachamentos, terra (DL/RDL), pressão, remada, avanços
   Seleção baseada na avaliação funcional disponível

7. FORÇA ESPECÍFICA — ACESSÓRIOS ESTRATÉGICOS
   Uniarticulares, máquinas ou elásticos para equalizar desequilíbrios
   Isquiotibiais, rotadores, abdutores, extensores, bíceps/tríceps
   Volume menor — finalizadores funcionais

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTEGRAÇÃO CORRIDA/TRIATHLON + FORÇA (anti-interferência)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para atletas de endurance: minimizar efeito interferente
→ Força ANTES do cardio no mesmo dia (nunca depois de cardio intenso)
→ Priorizar força excêntrica e unilateral (transferência direta para corrida)
→ Preservar força explosiva de quadril e glúteos (potência de corrida)
→ Semana de deload na corrida = reduzir volume de força em 20%
→ Volume semanal de força: 2-3x/semana é suficiente para endurance athletes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO DE SAÍDA — APENAS JSON VÁLIDO, SEM TEXTO ADICIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "cycle_name": "Nome do ciclo/mesociclo",
  "objective": "Objetivo do ciclo",
  "duration_weeks": N,
  "block": "1 | 2 | 3",
  "biomechanical_notes": "Principais adaptações biomecânicas aplicadas com base na avaliação",
  "workouts": [
    {
      "name": "Treino A — Padrão de Empurrar + Puxar",
      "day_of_week": 1,
      "duration_min": 60,
      "split_focus": "descricao do foco muscular/padrão",
      "exercises": [
        {
          "phase": "mobilidade | ativacao_core | ativacao_especifica | controle_motor | pliometria | forca_global | forca_especifica",
          "exercise_id": "uuid exato da biblioteca",
          "exercise_name": "Nome exato do exercício na biblioteca",
          "library_exercise_name": "Nome exato do exercício na biblioteca",
          "muscle_group": "Grupo muscular primário",
          "sets": N,
          "reps": "8-10 | 5 | 15+ | 30s",
          "load_percent_1rm": "65-75% (ou null se não aplicável)",
          "rir": "2-3 (Repetições de Reserva)",
          "rest_seconds": N,
          "tempo": "3010 (excêntrico-pausa-concêntrico-pausa — ex: 3010 = 3s desce, 0 pausa, 1s sobe)",
          "exercise_order": N,
          "cues": "Cue técnico principal de execução",
          "biomechanical_note": "Razão biomecânica para a escolha deste exercício (se relevante)",
          "regression": "Regressão caso o aluno não consiga executar",
          "progression": "Progressão para próximo bloco"
        }
      ],
      "volume_load_estimate": "VL estimado da sessão (séries × reps × carga média)",
      "notes": "Observações gerais da sessão"
    }
  ],
  "library_policy": {
    "only_library_exercises": true,
    "catalog_count": N,
    "gaps": ["necessidades sem opção segura na biblioteca, se houver"]
  },
  "periodization_blocks": [
    {
      "weeks": "1-2",
      "stimulus": "base tecnica | volume | intensidade | consolidacao",
      "methods": ["metodos usados no bloco"],
      "progression_rule": "como progredir dentro do bloco"
    }
  ],
  "weekly_structure": "Descrição da estrutura semanal e ordem dos treinos",
  "progression_protocol": "Como progredir no próximo bloco",
  "warnings": ["Alertas específicos baseados nas limitações identificadas"]
}
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const {
      student_id, student_name, company_id,
      objective,          // "hipertrofia" | "forca" | "emagrecimento" | "performance"
      fitness_level,      // "iniciante" | "intermediario" | "avancado"
      days_per_week,      // dias disponíveis para musculação
      duration_weeks,
      equipment,          // "academia_completa" | "casa_halteres" | "funcional"
      restrictions,       // lesões e restrições
      block_number,       // 1 | 2 | 3 (para liberar pliometria)
      is_endurance_athlete, // true/false — atleta de corrida/triathlon
      assessment_context,   // JSON da avaliação funcional BN
      anamnese_context,     // JSON bruto/resumido da anamnese
      prescription_integration, // resultado integrado anamnese + avaliação
      bnito_orchestration, // contrato do BNITO para sincronizar agentes
      running_days_context, // { days_per_week, sport } — anti-interferência
      anamnese_id,
      bundle_id,
      notes,
    } = await req.json();

    const exerciseCatalog = await loadExerciseCatalog(supabase, (company_id as string | null) ?? null);
    const exerciseCatalogText = formatExerciseCatalog(exerciseCatalog);

    const athleteContext = `
DADOS DO ATLETA:
Nome: ${clean(student_name || "não informado")}
Objetivo: ${clean(objective)}
Nível: ${clean(fitness_level)}
Dias disponíveis para força: ${days_per_week}
Duração do ciclo: ${duration_weeks} semanas
Bloco atual: ${block_number || 1} (pliometria ${block_number >= 2 ? "PERMITIDA" : "PROIBIDA"})
Equipamentos: ${clean(equipment || "academia completa")}
É atleta de endurance (corrida/triathlon): ${is_endurance_athlete ? "SIM — aplicar protocolo anti-interferência" : "NÃO"}
Restrições/Lesões: ${clean(restrictions || "nenhuma")}
Observações adicionais: ${clean(notes || "")}

RESULTADO INTEGRADO ANAMNESE + AVALIAÇÃO (PRIORIDADE MÁXIMA):
${prescription_integration
  ? compactJson(prescription_integration, 12000)
  : "Sem resultado integrado — usar anamnese e avaliação separadamente, com cautela."}

ORQUESTRAÇÃO BNITO — CONTRATO ENTRE AGENTES:
${bnito_orchestration
  ? compactJson(bnito_orchestration, 9000)
  : "Sem orquestracao explicita — ainda assim prescrever 6 semanas em 3 blocos de 2 semanas."}

ANAMNESE E CONTEXTO CLÍNICO/ROTINA:
${anamnese_context ? compactJson(anamnese_context, 8000) : "Sem anamnese estruturada adicional."}

BIBLIOTECA DE EXERCÍCIOS DO APP:
${exerciseCatalogText}

REGRA DE MAPA PARA O APP:
Use somente os exercícios acima. Para cada exercício prescrito, retorne exercise_id e exercise_name exatamente como aparecem na biblioteca.
Se a metodologia BN pedir um padrão que não exista na biblioteca, registre a lacuna em library_policy.gaps e escolha a alternativa mais segura já cadastrada quando houver.

INTEGRAÇÃO COM CORRIDA (anti-interferência):
${running_days_context
  ? `O atleta TAMBÉM tem ${running_days_context.days_per_week} dias/semana de ${running_days_context.sport}.
     REGRAS OBRIGATÓRIAS DE ANTI-INTERFERÊNCIA:
     1. NÃO agendar treino pesado de MMII (agachamento, terra, afundo) no mesmo dia nem no dia ANTERIOR a corridas longas
     2. Semana de deload da musculação = semana 4 de cada bloco (sincronizada com a corrida)
     3. Volume de MMII reduzido em 20% vs atleta sem corrida
     4. Preferir RIR 2-3 em todos os exercícios (preservar recuperação aeróbica)
     5. Separar força de MMII por no mínimo 6h de qualquer corrida Z4/Z5`
  : "Sem plano de corrida — prescrever sem restrições de anti-interferência"}


AVALIAÇÃO FUNCIONAL BN (PRIORIDADE MÁXIMA — adapte TODOS os exercícios):
${assessment_context ? JSON.stringify(assessment_context) : "Sem avaliação funcional disponível — presumir boa mobilidade, aplicar protocolo padrão"}

Se a avaliação trouxer "sequencia_bn_video", "direcionamento_protocolo",
"red_yellow_flags" ou "criterios_progressao_bn", esses campos têm prioridade
sobre inferências genéricas. Use o protocolo indicado para definir mobilidade,
ativação, controle motor, cautelas, restrições e liberação ou bloqueio de
pliometria/potência.

INSTRUÇÕES:
1. Comece pelo RESULTADO INTEGRADO: ele resolve conflitos entre objetivo, anamnese, dor, recuperação e avaliação funcional.
2. Analise a avaliação funcional e ajuste CADA exercício conforme as disfunções encontradas.
3. O ciclo deve ter EXATAMENTE 6 semanas, dividido em semanas 1-2, 3-4 e 5-6.
4. Troque o estimulo a cada 2 semanas: series, repeticoes, intensidade, descanso ou metodo.
5. Metodos avancados permitidos somente se coerentes com nivel/risco: up-set, piramide, cluster-set e drop-set seletivo. Nunca use metodo avancado em padrao doloroso ou instavel.
6. Siga obrigatoriamente a estrutura de 7 etapas em CADA sessão.
7. Pliometria apenas se block_number >= 2 E criterios_progressao_bn/liberações do resultado integrado permitirem.
8. Inclua cues técnicos específicos baseados nas falhas do OHS e nos riscos da anamnese.
9. Para atleta de endurance: preferir RIR 2-3, volume moderado, força excêntrica.
10. Use somente exercícios cadastrados na biblioteca do app.
11. Retorne exercise_id em todos os itens de treino.
12. Retorne APENAS o JSON, sem texto adicional, sem markdown.
    `.trim();

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: clean(athleteContext) }],
      }),
    });

    if (!aiResponse.ok) return aiErrorResponse(aiResponse.status);

    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text ?? "";

    let planJson = null;
    try {
      planJson = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch {
      return new Response(
        JSON.stringify({ error: "Falha ao parsear JSON", raw: rawText.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const libraryValidation = validatePlanLibraryUsage(
      planJson,
      new Set(exerciseCatalog.exercises.map((exercise) => exercise.id)),
    );
    planJson.library_policy = {
      ...(isRecord(planJson.library_policy) ? planJson.library_policy : {}),
      only_library_exercises: true,
      catalog_count: exerciseCatalog.total,
      validation: libraryValidation,
    };
    if (prescription_integration) {
      planJson.prescription_integration = {
        readiness: prescription_integration.readiness ?? null,
        coach_summary: prescription_integration.coach_summary ?? null,
        risk_screening: prescription_integration.risk_screening ?? null,
        prescription_decision: prescription_integration.prescription_decision ?? null,
      };
    }
    if (bnito_orchestration) {
      planJson.bnito_orchestration = {
        duration_weeks: bnito_orchestration.duration_weeks ?? 6,
        block_length_weeks: bnito_orchestration.block_length_weeks ?? 2,
        blocks: bnito_orchestration.blocks ?? null,
        synchronization_rules: bnito_orchestration.synchronization_rules ?? null,
      };
    }

    // Salva o plano de força gerado pela IA (JSON, desacoplado da execução)
    const planId = crypto.randomUUID();
    await supabase.from("ai_strength_plans").insert({
      id: planId,
      company_id, student_id,
      cycle_name: planJson.cycle_name,
      objective: planJson.objective,
      duration_weeks: planJson.duration_weeks,
      biomechanical_notes: planJson.biomechanical_notes,
      plan: planJson,
      anamnese_id: anamnese_id ?? null,
      bundle_id: bundle_id ?? null,
    });

    return new Response(
      JSON.stringify({ id: planId, plan: planJson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
