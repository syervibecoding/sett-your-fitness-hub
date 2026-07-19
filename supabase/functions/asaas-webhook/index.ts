import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { businessDateYmd } from "../_shared/business-date.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function claimEvent(eventId: string, eventType: string) {
  const { error } = await supabaseAdmin.from("integration_webhook_events").insert({
    provider: "asaas",
    event_id: eventId,
    event_type: eventType,
    status: "processing",
  });
  if (!error) return true;
  if (error.code !== "23505") throw new Error(`Falha ao registrar evento Asaas: ${error.message}`);

  const { data: existing } = await supabaseAdmin.from("integration_webhook_events")
    .select("status")
    .eq("provider", "asaas")
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing?.status !== "failed") return false;

  await supabaseAdmin.from("integration_webhook_events").update({
    status: "processing",
    error: null,
    received_at: new Date().toISOString(),
    processed_at: null,
  }).eq("provider", "asaas").eq("event_id", eventId);
  return true;
}

async function createInvoice(asaasPaymentId: string) {
  try {
    const today = businessDateYmd();
    const res = await fetch(`${ASAAS_BASE_URL}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        payment: asaasPaymentId,
        serviceDescription: "Consultoria em educação física",
        observations: "Nota fiscal referente ao plano BN Performance Training",
        effectiveDate: today,
        municipalServiceId: "8446",
        municipalServiceCode: "8599-6/04",
        municipalServiceName: "8.02 - TREINAMENTO EM DESENVOLVIMENTO PROFISSIONAL E GERENCIAL",
        taxes: {
          retainIss: false,
          iss: 0,
          cofins: 0,
          csll: 0,
          inss: 0,
          ir: 0,
          pis: 0,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Erro ao emitir NFS-e:", JSON.stringify(data));
      return null;
    }
    console.log("NFS-e agendada com sucesso:", JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("Falha ao criar NFS-e:", err);
    return null;
  }
}

async function ensureEnrollmentExists(studentId: string) {
  // Check if active enrollment already exists
  const { data: existing } = await supabaseAdmin
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .in("status", ["active", "awaiting_training"])
    .maybeSingle();

  if (existing) {
    console.log(`Enrollment already exists for student ${studentId}`);
    return existing.id;
  }

  // Get student's selected plan and company
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("selected_plan_id, assigned_trainer_id, company_id")
    .eq("id", studentId)
    .single();

  if (!student?.selected_plan_id) {
    console.error(`Student ${studentId} has no selected_plan_id, cannot auto-create enrollment`);
    return null;
  }

  // Resolve company_id: fallback to plan's company if student has none
  let studentCompanyId = student.company_id;
  if (!studentCompanyId && student.selected_plan_id) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("company_id")
      .eq("id", student.selected_plan_id)
      .single();
    if (plan?.company_id) {
      studentCompanyId = plan.company_id;
      // Also fix the student record
      await supabaseAdmin
        .from("students")
        .update({ company_id: studentCompanyId })
        .eq("id", studentId);
      console.log(`Fixed student ${studentId} company_id to ${studentCompanyId} via plan`);
    }
  }

  // Get plan duration
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("duration_weeks")
    .eq("id", student.selected_plan_id)
    .single();

  if (!plan) {
    console.error(`Plan ${student.selected_plan_id} not found`);
    return null;
  }

  const today = new Date(`${businessDateYmd()}T12:00:00Z`);
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + plan.duration_weeks * 7 - 1);

  const { data: enrollment, error } = await supabaseAdmin
    .from("enrollments")
    .insert({
      student_id: studentId,
      plan_id: student.selected_plan_id,
      trainer_id: student.assigned_trainer_id || null,
      start_date: businessDateYmd(today),
      end_date: businessDateYmd(endDate),
      payment_status: "paid",
      payment_date: businessDateYmd(today),
      status: "active",
      company_id: studentCompanyId || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error auto-creating enrollment:", error);
    return null;
  }

  console.log(`Auto-created enrollment ${enrollment.id} for student ${studentId}`);
  return enrollment.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let claimedEventId: string | null = null;
  try {
    if (!ASAAS_WEBHOOK_TOKEN || !ASAAS_API_KEY) {
      throw new HttpError(503, "Asaas webhook is not configured");
    }

    const token = req.headers.get("asaas-access-token");
    if (token !== ASAAS_WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = await req.json();
    const { event: eventType, payment } = event;

    if (!payment?.id) {
      console.log("No payment data in event, ignoring");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asaasPaymentId = payment.id;
    const remotePaymentResponse = await fetch(`${ASAAS_BASE_URL}/payments/${encodeURIComponent(asaasPaymentId)}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    if (!remotePaymentResponse.ok) {
      throw new HttpError(502, `Falha ao confirmar pagamento no Asaas (HTTP ${remotePaymentResponse.status})`);
    }
    const remotePayment = await remotePaymentResponse.json();
    if (remotePayment?.id !== asaasPaymentId) throw new HttpError(400, "Pagamento Asaas divergente");
    const newStatus = remotePayment.status;
    const eventId = String(event.id || `${eventType}:${asaasPaymentId}:${newStatus}`);
    claimedEventId = eventId;
    if (!(await claimEvent(eventId, String(eventType || "payment")))) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Asaas webhook", JSON.stringify({ eventType, asaasPaymentId, newStatus }));

    // Update payment status in our database
    const { data: localPayment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .update({ status: newStatus })
      .eq("asaas_payment_id", asaasPaymentId)
      .select("student_id")
      .single();

    if (paymentError) {
      console.error("Error updating payment:", paymentError);
      await supabaseAdmin.from("integration_webhook_events").update({
        status: "completed",
        processed_at: new Date().toISOString(),
      }).eq("provider", "asaas").eq("event_id", eventId);
      return new Response(
        JSON.stringify({ received: true, error: "Payment not found locally" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const studentId = localPayment.student_id;

    // Handle status transitions
    if (
      newStatus === "RECEIVED" ||
      newStatus === "CONFIRMED" ||
      newStatus === "RECEIVED_IN_CASH"
    ) {
      await supabaseAdmin
        .from("students")
        .update({ status: "active" })
        .eq("id", studentId);

      // Ensure enrollment exists (auto-create if missing)
      await ensureEnrollmentExists(studentId);

      // Update existing enrollment payment status
      await supabaseAdmin
        .from("enrollments")
        .update({
          payment_status: "paid",
          payment_date: businessDateYmd(),
        })
        .eq("student_id", studentId)
        .eq("status", "active");

      console.log(
        `Student ${studentId} activated after payment ${asaasPaymentId}`
      );

      // Emitir NFS-e automaticamente
      await createInvoice(asaasPaymentId);
    } else if (newStatus === "OVERDUE") {
      await supabaseAdmin
        .from("enrollments")
        .update({ payment_status: "overdue" })
        .eq("student_id", studentId)
        .eq("status", "active");

      console.log(`Student ${studentId} payment overdue`);
    } else if (
      newStatus === "REFUNDED" ||
      newStatus === "DELETED" ||
      newStatus === "REFUND_REQUESTED"
    ) {
      await supabaseAdmin
        .from("students")
        .update({ status: "pending" })
        .eq("id", studentId);

      await supabaseAdmin
        .from("enrollments")
        .update({ payment_status: "refunded" })
        .eq("student_id", studentId)
        .eq("status", "active");

      console.log(`Student ${studentId} deactivated after refund/delete`);
    }

    await supabaseAdmin.from("integration_webhook_events").update({
      status: "completed",
      processed_at: new Date().toISOString(),
    }).eq("provider", "asaas").eq("event_id", eventId);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    if (claimedEventId) {
      await supabaseAdmin.from("integration_webhook_events").update({
        status: "failed",
        error: message.slice(0, 1000),
        processed_at: new Date().toISOString(),
      }).eq("provider", "asaas").eq("event_id", claimedEventId);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
