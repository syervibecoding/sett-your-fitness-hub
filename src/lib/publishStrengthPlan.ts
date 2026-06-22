// Publica a prescrição de FORÇA gerada no Studio (que vive em ai_strength_plans / results.musculacao)
// para o app do ALUNO. O app do aluno lê de `workouts` via `training_cycles` de uma `enrollment` ativa —
// então gerar a prescrição NÃO basta: é preciso materializar o plano nessas tabelas. Este helper faz isso
// client-side (RLS permite insert de admin/master escopado por empresa):
//   1) acha a matrícula ATIVA do aluno (ou cria uma);
//   2) encerra ciclos ativos anteriores da matrícula e cria um ciclo novo ativo;
//   3) insere um `workout` por sessão do plano, com os exercícios no formato que o app do aluno espera.
import { supabase } from "@/integrations/supabase/client";

// Formato que o app do aluno (StudentPortal/StudentWorkout) consome em workouts.exercises[].
export interface StudentWorkoutExercise {
  exercise_id: string | null;
  exercise_name: string;
  muscle_group: string;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
  set_types?: string[];
  method?: string | null;
  group_id?: string | null;
  method_seconds?: number | null;
}

export interface StudentWorkoutRow {
  cycle_id: string;
  name: string;
  title: string;
  description: string | null;
  day_of_week: number | null;
  sort_order: number;
  company_id: string;
  exercises: StudentWorkoutExercise[];
}

export interface PublishResult {
  enrollmentId: string;
  cycleId: string;
  workoutsCreated: number;
  createdEnrollment: boolean;
}

// Converte um exercício do plano da IA -> formato do app do aluno (tudo string, como o app espera).
export function mapStrengthExercise(e: any): StudentWorkoutExercise {
  const restSeconds = e?.rest_seconds;
  return {
    exercise_id: e?.exercise_id ?? null,
    exercise_name: e?.exercise_name ?? e?.library_exercise_name ?? "Exercício",
    muscle_group: e?.muscle_group ?? "",
    sets: e?.sets != null ? String(e.sets) : "",
    reps: e?.reps != null ? String(e.reps) : "",
    rest: restSeconds != null && restSeconds !== "" ? `${restSeconds}s` : (e?.rest != null ? String(e.rest) : ""),
    notes: [e?.notes, (e?.cues && String(e.cues).trim()) || e?.biomechanical_note].filter(Boolean).join("\n"),
    set_types: Array.isArray(e?.set_types) ? e.set_types : undefined,
    method: e?.method ?? null,
    group_id: e?.group_id ?? null,
    method_seconds: e?.method_seconds ?? null,
  };
}

// Pure: monta as linhas de `workouts` a partir do plano. Testável sem rede.
export function buildWorkoutRows(plan: any, cycleId: string, companyId: string): StudentWorkoutRow[] {
  const workouts = Array.isArray(plan?.workouts) ? plan.workouts : [];
  return workouts.map((w: any, i: number) => {
    const exs = Array.isArray(w?.exercises) ? w.exercises : [];
    const ordered = [...exs].sort(
      (a, b) => (Number(a?.exercise_order) || 0) - (Number(b?.exercise_order) || 0),
    );
    return {
      cycle_id: cycleId,
      name: w?.name ?? `Treino ${i + 1}`,
      title: w?.name ?? `Treino ${i + 1}`,
      description: w?.notes ?? null,
      day_of_week: typeof w?.day_of_week === "number" ? w.day_of_week : null,
      sort_order: i + 1,
      company_id: companyId,
      exercises: ordered.map(mapStrengthExercise),
    };
  });
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// P15 — resumo das edições do professor vs. plano original da IA.
function summarizePlanEdits(orig: any, edited: any): { edited: boolean; text: string } {
  const flat = (p: any) => ((p?.workouts || []) as any[]).flatMap((w) => ((w?.exercises || []) as any[]).map((e) => e?.exercise_name || e?.library_exercise_name || ""));
  const a = flat(orig), b = flat(edited);
  const setA = new Set(a.filter(Boolean)), setB = new Set(b.filter(Boolean));
  const added = [...setB].filter((x) => !setA.has(x));
  const removed = [...setA].filter((x) => !setB.has(x));
  const changed = JSON.stringify(orig?.workouts || []) !== JSON.stringify(edited?.workouts || []);
  const parts: string[] = [];
  if (added.length) parts.push(`${added.length} adicionado(s)`);
  if (removed.length) parts.push(`${removed.length} removido(s)`);
  if (changed && !parts.length) parts.push("ajustes de séries/reps/obs");
  return { edited: changed, text: changed ? parts.join(", ") || "ajustes" : "sem edições" };
}

export async function publishStrengthPlanToStudent(opts: {
  plan: any;
  studentId: string;
  companyId: string;
  createdBy?: string | null;
  aiOriginal?: any; // P9/P15 — plano original da IA, para versionar/diff.
}): Promise<PublishResult> {
  const { plan, studentId, companyId, createdBy } = opts;
  const db = supabase as any;

  const workouts = Array.isArray(plan?.workouts) ? plan.workouts : [];
  if (workouts.length === 0) throw new Error("O plano de força não tem treinos para publicar.");
  const durationWeeks = Number(plan?.duration_weeks) > 0 ? Number(plan.duration_weeks) : 6;

  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + durationWeeks * 7 - 1);

  // 1) Matrícula ativa (mais recente) ou cria uma.
  const { data: enr } = await db
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let enrollmentId: string | undefined = enr?.id;
  let createdEnrollment = false;
  if (!enrollmentId) {
    const { data: createdEnr, error: enrErr } = await db
      .from("enrollments")
      .insert({
        company_id: companyId,
        student_id: studentId,
        status: "active",
        start_date: ymd(today),
        end_date: ymd(end),
        training_start_date: ymd(today),
        notes: "Criada automaticamente ao publicar prescrição do Studio.",
      })
      .select("id")
      .single();
    if (enrErr) throw new Error(`Falha ao criar matrícula: ${enrErr.message}`);
    enrollmentId = createdEnr.id;
    createdEnrollment = true;
  }

  // 2) Encerra ciclos ativos antigos e cria o novo ciclo ativo (cycle_number incremental).
  await db.from("training_cycles").update({ status: "completed" }).eq("enrollment_id", enrollmentId).eq("status", "active");
  const { data: maxc } = await db
    .from("training_cycles")
    .select("cycle_number")
    .eq("enrollment_id", enrollmentId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cycleNumber = (Number(maxc?.cycle_number) || 0) + 1;

  const { data: cycle, error: cycErr } = await db
    .from("training_cycles")
    .insert({
      enrollment_id: enrollmentId,
      cycle_number: cycleNumber,
      start_date: ymd(today),
      end_date: ymd(end),
      status: "active",
      company_id: companyId,
      student_id: studentId,
      name: plan?.cycle_name ?? "Ciclo de treino",
      objective: plan?.objective ?? null,
      duration_weeks: durationWeeks,
      delivery_status: "sent", // P6 — entrega: vira "viewed" quando o aluno abre o ciclo.
    })
    .select("id")
    .single();
  if (cycErr) throw new Error(`Falha ao criar ciclo: ${cycErr.message}`);

  // 3) Treinos (um por sessão do plano).
  const rows = buildWorkoutRows(plan, cycle.id, companyId).map((r) =>
    createdBy ? { ...r, created_by: createdBy } : r,
  );
  const { error: wErr } = await db.from("workouts").insert(rows);
  if (wErr) throw new Error(`Falha ao criar treinos: ${wErr.message}`);

  // P9/P15 — versiona o plano publicado (best-effort; nunca bloqueia a publicação).
  try {
    const sum = opts.aiOriginal ? summarizePlanEdits(opts.aiOriginal, plan) : { edited: false, text: "sem edições" };
    await db.from("ai_plan_versions").insert({
      company_id: companyId,
      student_id: studentId,
      cycle_id: cycle.id,
      plan,
      edited: sum.edited,
      edit_summary: sum.text,
      created_by: createdBy ?? null,
    });
  } catch { /* versionamento opcional */ }

  return { enrollmentId: enrollmentId!, cycleId: cycle.id, workoutsCreated: rows.length, createdEnrollment };
}
