import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clean = (s: unknown) => String(s || "").replace(/[^\x20-\x7E\u00C0-\u017F]/g, "");

function normalizeText(value: unknown) {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? {});
  return clean(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

// ─── CATÁLOGO DE EXERCÍCIOS ───────────────────────────────────────────────────
interface ExerciseCatalogEntry {
  id: string;
  name: string;
  description: string | null;
  muscle_group: string | null;
  contraindications: string[];
  regressions: string[];
  progressions: string[];
  equivalent_substitutes: string[];
  pain_limitation_tags: string[];
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

async function selectByExerciseIdChunks(
  supabase: any,
  table: string,
  columns: string,
  exerciseIds: string[],
  options: { companyId?: string | null; chunkSize?: number } = {},
) {
  const rows: any[] = [];
  for (const ids of chunkArray(exerciseIds, options.chunkSize ?? 80)) {
    let query = supabase.from(table).select(columns).in("exercise_id", ids);
    if (options.companyId) query = query.eq("company_id", options.companyId);
    const { data, error } = await query;
    if (error) return { data: rows, error };
    rows.push(...((data ?? []) as any[]));
  }
  return { data: rows, error: null };
}

async function loadExerciseCatalog(
  supabase: any,
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

  const exerciseRows = (exercises ?? []) as any[];
  const exerciseIds = exerciseRows.map((exercise) => exercise.id as string).filter(Boolean);

  const [targetsResult, groupsResult, overridesResult, metadataResult] = await Promise.all([
    exerciseIds.length
      ? selectByExerciseIdChunks(
          supabase,
          "exercise_muscle_targets",
          "exercise_id, muscle_group_id, role, volume_percentage",
          exerciseIds,
        )
      : Promise.resolve({ data: [], error: null }),
    supabase.from("muscle_groups").select("id, name"),
    companyId && exerciseIds.length
      ? selectByExerciseIdChunks(
          supabase,
          "company_exercise_volumes",
          "exercise_id, muscle_group_id, volume_percentage",
          exerciseIds,
          { companyId },
        )
      : Promise.resolve({ data: [], error: null }),
    exerciseIds.length
      ? selectByExerciseIdChunks(
          supabase,
          "exercise_metadata",
          "exercise_id, contraindications, regressions, progressions, equivalent_substitutes, pain_limitation_tags",
          exerciseIds,
        )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (targetsResult.error) throw new Error(`Falha ao carregar alvos musculares: ${targetsResult.error.message}`);
  if (groupsResult.error) throw new Error(`Falha ao carregar grupos musculares: ${groupsResult.error.message}`);
  if (overridesResult.error) throw new Error(`Falha ao carregar volumes da empresa: ${overridesResult.error.message}`);
  if (metadataResult.error) {
    console.warn("exercise_metadata skipped:", metadataResult.error.message);
  }

  const groupNames = new Map<string, string>();
  for (const group of ((groupsResult.data ?? []) as any[])) {
    groupNames.set(group.id as string, group.name as string);
  }

  const volumeOverrides = new Map<string, number>();
  for (const override of ((overridesResult.data ?? []) as any[])) {
    volumeOverrides.set(
      `${override.exercise_id as string}:${override.muscle_group_id as string}`,
      override.volume_percentage as number,
    );
  }

  const targetsByExercise = new Map<string, ExerciseCatalogEntry["targets"]>();
  for (const target of ((targetsResult.data ?? []) as any[])) {
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

  const metadataByExercise = new Map<string, {
    contraindications: string[];
    regressions: string[];
    progressions: string[];
    equivalent_substitutes: string[];
    pain_limitation_tags: string[];
  }>();
  if (!metadataResult.error) {
    for (const row of ((metadataResult.data ?? []) as any[])) {
      metadataByExercise.set(row.exercise_id as string, {
        contraindications: asTextArray(row.contraindications),
        regressions: asTextArray(row.regressions),
        progressions: asTextArray(row.progressions),
        equivalent_substitutes: asTextArray(row.equivalent_substitutes),
        pain_limitation_tags: asTextArray(row.pain_limitation_tags),
      });
    }
  }

  return {
    company_id: companyId,
    total: exerciseRows.length,
    exercises: exerciseRows.map((exercise) => ({
      id: exercise.id as string,
      name: exercise.name as string,
      description: (exercise.description as string | null) ?? null,
      muscle_group: (exercise.muscle_group as string | null) ?? null,
      contraindications: metadataByExercise.get(exercise.id as string)?.contraindications ?? [],
      regressions: metadataByExercise.get(exercise.id as string)?.regressions ?? [],
      progressions: metadataByExercise.get(exercise.id as string)?.progressions ?? [],
      equivalent_substitutes: metadataByExercise.get(exercise.id as string)?.equivalent_substitutes ?? [],
      pain_limitation_tags: metadataByExercise.get(exercise.id as string)?.pain_limitation_tags ?? [],
      targets: targetsByExercise.get(exercise.id as string) ?? [],
    })),
  };
}

// ─── PRESETS METODOLÓGICOS BN ─────────────────────────────────────────────────
const METHODOLOGY_PRESETS = {
  hipertrofia_iniciante: {
    label: "Hipertrofia iniciante",
    target_weekly_sets: "8-12 series efetivas por grupo prioritario; maximo conservador de 14-16 para MMII quando houver boa recuperacao",
    reps: "8-12 nos multiarticulares, 10-15 nos acessorios",
    rir: "2-3",
  },
  hipertrofia_intermediario: {
    label: "Hipertrofia intermediario",
    target_weekly_sets: "10-16 series efetivas por grupo prioritario; 16-20 apenas com justificativa e boa tolerancia",
    reps: "6-12 nos multiarticulares, 10-15 nos acessorios",
    rir: "1-3",
  },
  emagrecimento: {
    label: "Emagrecimento",
    target_weekly_sets: "8-14 series por grupo, mantendo tecnica e recuperacao para aderencia",
    reps: "8-15 com descansos moderados e densidade controlada",
    rir: "2-4",
  },
  recomposicao: {
    label: "Recomposicao corporal",
    target_weekly_sets: "10-16 series por grupo prioritario com controle de fadiga",
    reps: "6-12 forca/hipertrofia + 12-15 acessorios",
    rir: "2-3",
  },
  forca: {
    label: "Forca",
    target_weekly_sets: "6-12 series efetivas nos padroes principais; acessorios suficientes para suporte tecnico",
    reps: "3-6 em forca global, 8-12 em suporte",
    rir: "1-3, nunca falha sistematica",
  },
  retorno_lesao: {
    label: "Retorno de lesao",
    target_weekly_sets: "6-10 series por grupo afetado, progressao por tolerancia e dor <= 3",
    reps: "10-15 com amplitude livre de dor; isometria/tempo quando seguro",
    rir: "3-4",
  },
  corrida_musculacao: {
    label: "Corrida + musculacao",
    target_weekly_sets: "6-12 series MMII, 8-14 MMSS/core, reduzindo 20% vs nao corredor",
    reps: "4-8 forca global, 8-12 acessorios, foco unilateral/excentrico",
    rir: "2-3",
  },
};

function selectMethodologyPreset(
  objective: unknown,
  fitnessLevel: unknown,
  restrictions: unknown,
  assessmentContext: unknown,
  isEnduranceAthlete: unknown,
): keyof typeof METHODOLOGY_PRESETS {
  const objectiveText = normalizeText(objective);
  const levelText = normalizeText(fitnessLevel);
  const riskText = normalizeText({ restrictions, assessmentContext });
  if (riskText.match(/lesao|lesoes|dor|eva|retorno|pos[- ]?operatorio|cirurgia|radicul|formigamento/)) return "retorno_lesao";
  if (isEnduranceAthlete) return "corrida_musculacao";
  if (objectiveText.includes("forca")) return "forca";
  if (objectiveText.includes("emagrec") || objectiveText.includes("perda") || objectiveText.includes("gordura")) return "emagrecimento";
  if (objectiveText.includes("recompos")) return "recomposicao";
  if (objectiveText.includes("hipertrof")) return levelText.includes("inic") ? "hipertrofia_iniciante" : "hipertrofia_intermediario";
  return levelText.includes("inic") ? "hipertrofia_iniciante" : "recomposicao";
}

// ─── SELEÇÃO DE EXERCÍCIOS POR REGRAS ─────────────────────────────────────────
function exerciseText(exercise: ExerciseCatalogEntry) {
  return normalizeText([
    exercise.name,
    exercise.description,
    exercise.muscle_group,
    exercise.targets.map((target) => target.muscle_group).join(" "),
    exercise.pain_limitation_tags.join(" "),
  ].join(" "));
}

function pickCatalogExercise(
  catalog: ExerciseCatalog,
  keywords: string[],
  usedIds: Set<string>,
  riskText: string,
): ExerciseCatalogEntry | null {
  const normalizedKeywords = keywords.map(normalizeText).filter(Boolean);
  const riskTerms = ["joelho", "lombar", "ombro", "tornozelo", "quadril"].filter((term) => riskText.includes(term));
  const scored = catalog.exercises.map((exercise) => {
    const text = exerciseText(exercise);
    const metadataText = normalizeText([exercise.contraindications, exercise.pain_limitation_tags]);
    const riskPenalty = riskTerms.some((term) => metadataText.includes(term)) ? 8 : 0;
    const usedPenalty = usedIds.has(exercise.id) ? 4 : 0;
    const score = normalizedKeywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 3 : 0), 0) - riskPenalty - usedPenalty;
    return { exercise, score };
  }).sort((a, b) => b.score - a.score);

  return scored.find((item) => item.score > -4)?.exercise || catalog.exercises.find((exercise) => !usedIds.has(exercise.id)) || catalog.exercises[0] || null;
}

type FallbackExerciseSpec = {
  phase: string;
  keywords: string[];
  sets: number;
  reps: string;
  rest: number;
  rir: string;
  cue: string;
  note: string;
  tempo?: string;
};

function fallbackExercise(
  catalog: ExerciseCatalog,
  usedIds: Set<string>,
  riskText: string,
  params: FallbackExerciseSpec & { order: number },
) {
  const exercise = pickCatalogExercise(catalog, params.keywords, usedIds, riskText);
  if (!exercise) return null;
  usedIds.add(exercise.id);
  return {
    phase: params.phase,
    exercise_id: exercise.id,
    exercise_name: exercise.name,
    library_exercise_name: exercise.name,
    muscle_group: exercise.muscle_group || exercise.targets[0]?.muscle_group || "geral",
    sets: params.sets,
    reps: params.reps,
    load_percent_1rm: null,
    rir: params.rir,
    rest_seconds: params.rest,
    tempo: params.tempo || "3010",
    exercise_order: params.order,
    cues: params.cue,
    biomechanical_note: params.note,
    regression: exercise.regressions[0] || "Reduzir amplitude/carga e manter dor <= 3.",
    progression: exercise.progressions[0] || "Progredir reps antes de carga, mantendo técnica.",
  };
}

function buildPrescriptionPlan(args: {
  catalog: ExerciseCatalog;
  presetKey: keyof typeof METHODOLOGY_PRESETS;
  selectedPreset: typeof METHODOLOGY_PRESETS[keyof typeof METHODOLOGY_PRESETS];
  studentName: unknown;
  objective: unknown;
  fitnessLevel: unknown;
  daysPerWeek: unknown;
  restrictions: unknown;
  assessmentContext: unknown;
}) {
  const days = Math.min(4, Math.max(2, Number(args.daysPerWeek) || 3));
  const riskText = normalizeText({
    restrictions: args.restrictions,
    assessmentContext: args.assessmentContext,
  });
  const kneeRisk = riskText.includes("joelho") || riskText.includes("valgo");
  const backRisk = riskText.includes("lombar") || riskText.includes("butt") || riskText.includes("retrovers");
  const usedIds = new Set<string>();

  const makeWorkout = (name: string, day: number, focus: string, specs: FallbackExerciseSpec[]) => ({
    name,
    day_of_week: day,
    duration_min: 50,
    split_focus: focus,
    exercises: specs
      .map((spec, index) => fallbackExercise(args.catalog, usedIds, riskText, { ...spec, order: index + 1 }))
      .filter(Boolean),
    volume_load_estimate: "Conservador; usar RIR 2-4 e dor <= 3.",
    notes: "Plano gerado automaticamente pela metodologia BN: revisar antes de publicar se houver dor importante ou restrição clínica.",
  });

  const workouts = [
    makeWorkout("Treino A - Base tecnica de membros inferiores", 1, "mobilidade, core, controle de quadril e força global leve", [
      { phase: "mobilidade", keywords: ["mobilidade tornozelo quadril", "alongamento", "tornozelo", "quadril"], sets: 2, reps: "8-10", rest: 30, rir: "4", cue: "Amplitude sem dor e respiração calma.", note: kneeRisk ? "Preparar tornozelo/quadril para reduzir estresse no joelho." : "Preparar amplitude antes da força." },
      { phase: "ativacao_core", keywords: ["prancha", "dead bug", "core", "pallof"], sets: 2, reps: "20-30s", rest: 45, rir: "3-4", cue: "Trave costelas e pelve, sem prender o ar.", note: "Aumenta estabilidade lombo-pélvica antes da carga." },
      { phase: "ativacao_especifica", keywords: ["gluteo medio", "gluteo", "abducao", "mini band"], sets: 2, reps: "12-15", rest: 45, rir: "3", cue: "Joelho alinhado ao pé, sem colapsar.", note: kneeRisk ? "Prioriza controle de valgo dinâmico." : "Ativa quadril para padrões de agachar." },
      { phase: "controle_motor", keywords: ["agachamento", "goblet", "squat", "caixa"], sets: 2, reps: "8-10", rest: 60, rir: "3-4", cue: "Desça até onde mantém pelve e joelho alinhados.", note: backRisk ? "Limitar amplitude para manter coluna neutra." : "Reforça padrão técnico antes de carga." },
      { phase: "forca_global", keywords: backRisk ? ["leg press", "hack", "maquina", "agachamento"] : ["agachamento", "leg press", "goblet", "squat"], sets: 3, reps: "8-10", rest: 90, rir: "2-3", cue: "Empurre o chão sem perder alinhamento.", note: "Força global com margem de segurança." },
      { phase: "forca_especifica", keywords: ["posterior", "mesa flexora", "isquiotibiais", "gluteo"], sets: 2, reps: "10-12", rest: 75, rir: "2-3", cue: "Controle a volta e evite compensar lombar.", note: "Equilibra cadeia posterior para proteger joelho/quadril." },
    ]),
    makeWorkout("Treino B - Postura, puxar e empurrar", 3, "mobilidade torácica, escápula, puxar e empurrar técnico", [
      { phase: "mobilidade", keywords: ["mobilidade toracica", "ombro", "shoulder", "toracica"], sets: 2, reps: "8-10", rest: 30, rir: "4", cue: "Movimento suave, sem forçar amplitude.", note: "Prepara ombro e coluna torácica para membros superiores." },
      { phase: "ativacao_core", keywords: ["pallof", "prancha", "core", "dead bug"], sets: 2, reps: "20-30s", rest: 45, rir: "3-4", cue: "Mantenha tronco estável.", note: "Estabilidade para puxadas e empurradas." },
      { phase: "ativacao_especifica", keywords: ["escapula", "face pull", "rotador", "manguito"], sets: 2, reps: "12-15", rest: 45, rir: "3", cue: "Ombros longe das orelhas.", note: "Melhora controle escapular." },
      { phase: "controle_motor", keywords: ["remada", "row", "puxada"], sets: 2, reps: "10", rest: 60, rir: "3", cue: "Puxe com cotovelos, sem jogar tronco.", note: "Ensina trajetória e controle escapular." },
      { phase: "forca_global", keywords: ["supino", "press", "empurrar", "chest"], sets: 3, reps: "8-10", rest: 90, rir: "2-3", cue: "Escápulas firmes e punho neutro.", note: "Empurrar global com controle." },
      { phase: "forca_especifica", keywords: ["remada", "puxada", "costas", "dorsal"], sets: 3, reps: "8-12", rest: 90, rir: "2-3", cue: "Controle a volta sem perder postura.", note: "Equilibra ombro e postura." },
    ]),
    makeWorkout("Treino C - Corpo inteiro e unilateral leve", 5, "integração full body, unilateral e acessórios", [
      { phase: "mobilidade", keywords: ["mobilidade quadril", "tornozelo", "alongamento"], sets: 2, reps: "8-10", rest: 30, rir: "4", cue: "Busque amplitude confortável.", note: "Abre movimento antes do unilateral." },
      { phase: "ativacao_core", keywords: ["bird dog", "perdigueiro", "core", "prancha"], sets: 2, reps: "8-10 por lado", rest: 45, rir: "3-4", cue: "Quadril parado e coluna neutra.", note: "Controle anti-rotação." },
      { phase: "controle_motor", keywords: ["afundo", "lunge", "step", "unilateral"], sets: 2, reps: "8 por lado", rest: 60, rir: "3-4", cue: "Joelho acompanha o pé.", note: kneeRisk ? "Usar amplitude curta e sem dor." : "Integra equilíbrio e controle." },
      { phase: "forca_global", keywords: backRisk ? ["hip thrust", "gluteo", "ponte"] : ["terra romeno", "rdl", "levantamento", "hip hinge"], sets: 3, reps: "8-10", rest: 90, rir: "2-3", cue: "Dobre quadril sem arredondar lombar.", note: "Fortalece cadeia posterior com controle." },
      { phase: "forca_global", keywords: ["remada", "puxada", "costas"], sets: 3, reps: "10-12", rest: 75, rir: "2-3", cue: "Postura alta e controle de escápulas.", note: "Complementa postura e tronco." },
      { phase: "forca_especifica", keywords: ["panturrilha", "calf", "abdomen", "core"], sets: 2, reps: "12-15", rest: 60, rir: "2-3", cue: "Controle total da fase excêntrica.", note: "Acessório leve para suporte do ciclo." },
    ]),
  ].slice(0, days);

  return {
    cycle_name: `Plano BN - ${clean(args.studentName || "Aluno")}`,
    objective: clean(args.objective || "base tecnica e consistencia"),
    duration_weeks: 6,
    block: "1",
    methodology_preset: {
      key: args.presetKey,
      label: args.selectedPreset.label,
      why_selected: "Selecionado automaticamente por objetivo, nivel, restricoes e avaliacao.",
    },
    generated_by: "bn_deterministic_engine",
    biomechanical_notes: "Plano conservador com técnica antes de carga, controle motor, RIR 2-4, sem pliometria e sem métodos avançados.",
    workouts,
    library_policy: {
      only_library_exercises: true,
      catalog_count: args.catalog.total,
      gaps: [],
    },
    periodization_blocks: [
      { weeks: "1-2", stimulus: "base tecnica e tolerancia", methods: ["sem metodos avancados"], progression_rule: "Aumentar reps dentro da faixa mantendo RIR 3-4 e dor <= 3." },
      { weeks: "3-4", stimulus: "progressao conservadora", methods: ["progressao dupla"], progression_rule: "Aumentar 1 serie em exercicios estaveis ou carga leve se tecnica estiver limpa." },
      { weeks: "5-6", stimulus: "consolidacao", methods: ["piramide leve apenas se tecnica estavel"], progression_rule: "Consolidar cargas, sem falha, e preparar reavaliacao." },
    ],
    weekly_structure: `${workouts.length} sessões/semana alternadas, evitando dias consecutivos de MMII pesado.`,
    progression_protocol: "Progredir reps antes de carga; regredir amplitude/carga se dor > 3 ou perda técnica.",
    warnings: [
      "Plano gerado automaticamente pela metodologia BN; professor deve revisar antes de usar em caso de dor importante.",
      "Sem pliometria e sem métodos avançados no início do ciclo.",
    ],
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const {
      student_id, student_name, company_id,
      objective,
      fitness_level,
      days_per_week,
      restrictions,
      is_endurance_athlete,
      assessment_context,
      anamnese_id,
      bundle_id,
    } = await req.json();

    const exerciseCatalog = await loadExerciseCatalog(supabase, company_id ?? null);
    if (!exerciseCatalog.total) {
      return new Response(
        JSON.stringify({ error: "Nenhum exercício na biblioteca. Cadastre exercícios na Biblioteca antes de gerar a prescrição." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const presetKey = selectMethodologyPreset(
      objective,
      fitness_level,
      restrictions,
      assessment_context,
      is_endurance_athlete,
    );
    const selectedPreset = METHODOLOGY_PRESETS[presetKey];

    const planJson = buildPrescriptionPlan({
      catalog: exerciseCatalog,
      presetKey,
      selectedPreset,
      studentName: student_name,
      objective,
      fitnessLevel: fitness_level,
      daysPerWeek: days_per_week,
      restrictions,
      assessmentContext: assessment_context,
    });

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
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
