import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = new Set([
  "https://www.settapp.com.br",
  "https://settapp.com.br",
  "https://bn-performance-webapp-matheus.netlify.app",
  "http://localhost:8080",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new HttpError(401, "No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new HttpError(401, `Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new HttpError(401, "User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { data: isMaster, error: roleError } = await supabaseClient.rpc("has_role", { _user_id: user.id, _role: "master" });
    if (roleError) throw new HttpError(503, "Unable to verify user role");
    if (!isMaster) throw new HttpError(403, "Only master users can open the billing portal");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new HttpError(503, "Stripe is not configured");

    const { companyId } = await req.json();
    if (!companyId) throw new HttpError(400, "companyId is required");
    if (!UUID_RE.test(companyId)) throw new HttpError(400, "Invalid companyId");

    // Get Stripe customer id from restricted billing table
    const { data: billing, error: billingError } = await supabaseClient
      .from("company_billing")
      .select("stripe_customer_id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (billingError || !billing?.stripe_customer_id) {
      throw new Error("Company not found or no Stripe customer");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const requestOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : "https://www.settapp.com.br";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${origin}/master/companies`,
    });

    logStep("Portal session created", { sessionId: portalSession.id });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof HttpError ? error.status : 500,
    });
  }
});
