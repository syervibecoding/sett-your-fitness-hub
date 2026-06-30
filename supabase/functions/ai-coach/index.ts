import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function calcAge(birth?: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  const diff = Date.now() - b.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401);

    // Verify the caller's identity with their JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) return jsonResponse({ error: "Mensagem vazia" }, 400);
    // Keep only the trailing window to bound token usage.
    const history = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12);

    // Service-role client for reads (always scoped to the verified user below).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve student row (if the caller is a student) and/or company membership.
    const { data: studentRow } = await admin
      .from("students")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const { data: memberRow } = await admin
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const isStudent = !!studentRow;
    const companyId = studentRow?.company_id ?? memberRow?.company_id ?? null;
    if (!companyId) return jsonResponse({ error: "Empresa não encontrada" }, 403);

    const { data: config } = await admin
      .from("company_ai_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!config || config.enabled === false) {
      return jsonResponse({ error: "O assistente de IA não está ativo para sua empresa." }, 403);
    }
    if (isStudent && config.student_assistant_enabled === false) {
      return jsonResponse({ error: "O assistente não está disponível para alunos." }, 403);
    }
    if (!isStudent && config.staff_assistant_enabled === false) {
      return jsonResponse({ error: "O assistente não está disponível para a equipe." }, 403);
    }

    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    const assistantName = config.assistant_name || "Setty";
    const companyName = company?.name || "sua consultoria";

    // ---- Build the persona system prompt ----
    const personaLines: string[] = [
      `Você é ${assistantName}, o assistente de IA da ${companyName}, especializado em treino de força e hipertrofia (bodybuilding) com rigor técnico em carga e volume.`,
    ];
    if (config.methodology) personaLines.push(`Metodologia da casa: ${config.methodology}`);
    if (config.tone) personaLines.push(`Tom de voz: ${config.tone}`);
    if (config.doctrine) personaLines.push(`Doutrina / princípios inegociáveis: ${config.doctrine}`);
    if (config.ethical_limits) personaLines.push(`Limites éticos: ${config.ethical_limits}`);
    personaLines.push(
      "Regras gerais: nunca dê diagnóstico ou prescrição médica; em dores agudas, lesões ou sintomas, oriente procurar um profissional de saúde. Não recomende fármacos ou substâncias proibidas. Responda em português do Brasil, de forma objetiva, técnica e prática. Use markdown curto quando ajudar.",
    );

    // ---- Student context (data-aware) ----
    if (isStudent) {
      const ctx: string[] = [];
      const age = calcAge(studentRow.birth_date);
      ctx.push(
        `Aluno: ${studentRow.full_name ?? "—"}${age ? `, ${age} anos` : ""}${studentRow.gender ? `, ${studentRow.gender}` : ""}.`,
      );
      if (studentRow.weekly_workout_goal) ctx.push(`Meta semanal de treinos: ${studentRow.weekly_workout_goal}.`);

      try {
        const { data: bm } = await admin
          .from("body_measurements")
          .select("*")
          .eq("student_id", studentRow.id)
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bm) {
          const parts = Object.entries(bm)
            .filter(([k, v]) => !["id", "student_id", "company_id", "created_at", "updated_at", "notes"].includes(k) && v != null)
            .map(([k, v]) => `${k}: ${v}`);
          if (parts.length) ctx.push(`Medidas mais recentes — ${parts.join(", ")}.`);
        }
      } catch (_) { /* ignore */ }

      try {
        const { data: cycles } = await admin
          .from("training_cycles")
          .select("id, cycle_number, status, start_date, end_date, enrollment_id, enrollments!inner(student_id)")
          .eq("enrollments.student_id", studentRow.id)
          .eq("status", "active")
          .limit(1);
        const cycle = cycles?.[0];
        if (cycle) {
          ctx.push(`Ciclo ativo: #${cycle.cycle_number} (${cycle.start_date} a ${cycle.end_date}).`);
          const { data: workouts } = await admin
            .from("workouts")
            .select("name, exercises")
            .eq("cycle_id", cycle.id)
            .limit(8);
          if (workouts?.length) {
            const summary = workouts
              .map((w: any) => {
                const exs = Array.isArray(w.exercises)
                  ? w.exercises.map((e: any) => e.exercise_name).filter(Boolean).slice(0, 8).join(", ")
                  : "";
                return `• ${w.name}${exs ? `: ${exs}` : ""}`;
              })
              .join("\n");
            ctx.push(`Treinos do ciclo atual:\n${summary}`);
          }
        }
      } catch (_) { /* ignore */ }

      try {
        const { data: logs } = await admin
          .from("workout_logs")
          .select("*")
          .eq("student_id", studentRow.id)
          .order("created_at", { ascending: false })
          .limit(12);
        if (logs?.length) {
          const summary = logs
            .map((l: any) => {
              const name = l.exercise_name ?? "exercício";
              const w = l.weight ?? l.load ?? l.actual_weight;
              const reps = l.reps ?? l.actual_reps;
              return `${name}${w ? ` ${w}kg` : ""}${reps ? ` x${reps}` : ""}`;
            })
            .join("; ");
          ctx.push(`Últimos registros de carga: ${summary}.`);
        }
      } catch (_) { /* ignore */ }

      personaLines.push(
        "\nUse os dados reais do aluno abaixo para personalizar a resposta (progressão de carga/volume, dúvidas sobre execução, ajustes). Se faltar dado, peça com clareza. Nunca invente números que não estejam no contexto.\n--- CONTEXTO DO ALUNO ---\n" +
          ctx.join("\n"),
      );
    } else {
      personaLines.push(
        "\nVocê está atendendo um membro da equipe (treinador/coordenador/admin). Ajude com raciocínio de prescrição, metodologia, periodização e distribuição de volume biomecânico, seguindo a doutrina da casa.",
      );
    }

    const systemPrompt = personaLines.join("\n");

    // ---- Call Lovable AI Gateway ----
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...history],
      }),
    });

    if (aiResp.status === 429) {
      return jsonResponse({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
    }
    if (aiResp.status === 402) {
      return jsonResponse({ error: "Créditos de IA esgotados. Avise o administrador da plataforma." }, 402);
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return jsonResponse({ error: "Falha ao consultar a IA." }, 500);
    }

    const aiData = await aiResp.json();
    const reply = aiData?.choices?.[0]?.message?.content ?? "Desculpe, não consegui responder agora.";

    return jsonResponse({ reply, assistantName });
  } catch (e) {
    console.error("ai-coach error", e);
    return jsonResponse({ error: "Erro interno." }, 500);
  }
});
