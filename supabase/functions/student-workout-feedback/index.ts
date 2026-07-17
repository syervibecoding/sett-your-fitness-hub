// student-workout-feedback — o aluno responde "como foi o treino?" no app e o feedback chega PRA NÓS
// no WhatsApp: é registrado como mensagem RECEBIDA na conversa do aluno (cria a conversa se não houver)
// e incrementa o "não lido", aparecendo na CRM de WhatsApp do treinador.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function getSub(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await supa.auth.getClaims(auth.replace("Bearer ", ""));
  return error ? null : (typeof data?.claims?.sub === "string" ? data.claims.sub : null);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sub = await getSub(req);
  if (!sub) return json({ error: "Unauthorized" }, 401);

  try {
    const { student_id, feedback, rating, workout_title, workout_session_id } = await req.json();
    const text = typeof feedback === "string" ? feedback.trim().slice(0, 1000) : "";
    if (!student_id) return json({ error: "student_id obrigatório" }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: student } = await db.from("students").select("id, company_id, user_id, full_name, whatsapp, phone").eq("id", student_id).maybeSingle();
    if (!student) return json({ error: "Aluno não encontrado" }, 404);
    if (student.user_id !== sub) return json({ error: "Forbidden" }, 403); // só o próprio aluno

    const firstName = String(student.full_name || "Aluno").split(/\s+/)[0];
    const ratingLine = rating ? `Avaliação: ${String(rating).slice(0, 40)}\n` : "";
    const titleLine = workout_title ? ` (${String(workout_title).slice(0, 60)})` : "";
    const content = `📋 Feedback de treino${titleLine} — ${firstName}\n${ratingLine}${text || "(sem comentário)"}`;

    const ratingDifficulty: Record<string, number> = { "Difícil": 8, "Bom": 5, "Ótimo": 3 };
    const painAreas = ["joelho", "lombar", "ombro", "quadril", "tornozelo", "punho", "cotovelo", "pescoço"]
      .filter((area) => text.toLocaleLowerCase("pt-BR").includes(area));

    // Persist first. WhatsApp is an optional delivery channel, never the source of truth.
    const { data: savedFeedback, error: feedbackError } = await db.from("workout_feedback").insert({
      student_id,
      company_id: student.company_id,
      workout_session_id: typeof workout_session_id === "string" ? workout_session_id : null,
      difficulty: ratingDifficulty[String(rating || "")] ?? null,
      pain_areas: painAreas,
      notes: [rating ? `Percepção: ${String(rating).slice(0, 40)}` : null, text || null].filter(Boolean).join("\n") || null,
    }).select("id").single();
    if (feedbackError || !savedFeedback) {
      throw new Error(`Falha ao registrar feedback: ${feedbackError?.message || "registro não retornado"}`);
    }

    const { data: enrollment } = await db.from("enrollments")
      .select("id, trainer_id")
      .eq("student_id", student_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await db.from("admin_alerts").insert({
      company_id: student.company_id,
      type: painAreas.length ? "workout_feedback_pain" : "workout_feedback",
      severity: painAreas.length ? "warning" : "info",
      target_role: enrollment?.trainer_id ? "trainer" : "admin",
      target_user_id: enrollment?.trainer_id ?? null,
      student_id,
      enrollment_id: null,
      title: painAreas.length ? "Aluno relatou desconforto no treino" : "Novo feedback de treino",
      message: content,
      action_url: `/admin/students/${student_id}`,
    });

    // Conversa do aluno; cria se não houver (precisa de instância + número).
    let { data: chat } = await db.from("whatsapp_chats").select("id, unread_count").eq("student_id", student_id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();

    if (!chat) {
      const digits = String(student.whatsapp || student.phone || "").replace(/\D/g, "");
      const { data: inst } = await db.from("whatsapp_instances").select("id").eq("company_id", student.company_id).order("status").limit(1).maybeSingle();
      if (digits && (inst as any)?.id) {
        const remoteJid = `${digits.startsWith("55") ? digits : "55" + digits}@s.whatsapp.net`;
        const { data: created } = await db.from("whatsapp_chats").insert({
          company_id: student.company_id, instance_id: (inst as any).id, remote_jid: remoteJid,
          student_id, contact_name: student.full_name,
        }).select("id, unread_count").maybeSingle();
        chat = created as any;
      }
    }

    if (!chat) {
      return json({ ok: true, persisted: true, delivered: false, feedback_id: savedFeedback.id });
    }

    const nowIso = new Date().toISOString();
    const { error: messageError } = await db.from("whatsapp_messages").insert({
      chat_id: (chat as any).id, company_id: student.company_id,
      content, type: "text", source: "incoming", is_from_me: false,
      status: "received", timestamp: nowIso, sender_id: student_id,
    });
    if (messageError) throw new Error(`Feedback salvo, mas falhou no WhatsApp: ${messageError.message}`);
    const { error: chatError } = await db.from("whatsapp_chats").update({
      unread_count: (((chat as any).unread_count as number) || 0) + 1,
      last_message: content.slice(0, 120),
      last_message_at: nowIso,
    }).eq("id", (chat as any).id);
    if (chatError) throw new Error(`Feedback salvo, mas falhou ao atualizar conversa: ${chatError.message}`);

    return json({ ok: true, persisted: true, delivered: true, feedback_id: savedFeedback.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
