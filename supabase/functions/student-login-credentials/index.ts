// student-login-credentials
// Gera/redefine a credencial de acesso do ALUNO e devolve {email, password} para o professor
// copiar/enviar (WhatsApp). Funciona tanto para conta nova quanto para aluno já vinculado
// (nesse caso REDEFINE a senha para um valor conhecido). Autorização por empresa (staff/master).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertTenantAccess, HttpError } from "../_shared/tenant-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// senha forte, legível e fácil de digitar no celular (sem caracteres ambíguos)
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let core = "";
  for (const b of bytes) core += alphabet[b % alphabet.length];
  return core + "@7a"; // garante símbolo + dígito + minúscula → passa em qualquer policy
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const callerId = claimsData.claims.sub as string;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { student_id } = await req.json().catch(() => ({}));
    if (!student_id) return json(400, { error: "student_id required" });

    // Autorização por empresa (master ou staff da mesma empresa do aluno)
    await assertTenantAccess(adminClient, claimsData.claims, { studentId: student_id, requireStaff: true });
    const { data: callerRoles } = await adminClient.from("user_roles").select("role").eq("user_id", callerId);
    const roles = (callerRoles || []).map((r: any) => r.role);
    if (!roles.some((r: string) => ["admin", "master", "coordinator", "trainer"].includes(r))) {
      return json(403, { error: "Forbidden" });
    }

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, email, full_name, user_id, company_id")
      .eq("id", student_id)
      .single();
    if (studentError || !student) return json(404, { error: "Student not found" });
    if (!student.email) return json(400, { error: "Aluno precisa ter um email cadastrado" });

    const password = generatePassword();
    let userId = student.user_id as string | null;
    let needsLink = false;

    // 1) Se já tem user_id, confirma que a conta de auth ainda existe (pode ser órfã = foi apagada).
    if (userId) {
      const { data: got, error: getErr } = await adminClient.auth.admin.getUserById(userId);
      if (getErr || !got?.user) userId = null; // órfão → re-resolve pelo e-mail
    }

    // 2) Sem conta válida → acha pelo e-mail (já existe) ou cria.
    if (!userId) {
      const { data: list } = await adminClient.auth.admin.listUsers();
      const existing = list?.users?.find(
        (u: any) => (u.email || "").toLowerCase() === String(student.email).toLowerCase(),
      );
      if (existing) {
        userId = existing.id;
      } else {
        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email: student.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: student.full_name },
        });
        if (createError || !created?.user) return json(400, { error: createError?.message || "Falha ao criar conta" });
        userId = created.user.id;
      }
      // Guarda contra duplicado: esse login já pertence a OUTRO cadastro?
      const { data: others } = await adminClient
        .from("students").select("id").eq("user_id", userId).neq("id", student_id);
      if (others && others.length) {
        return json(409, {
          error: "Este e-mail já tem login vinculado a OUTRO cadastro deste aluno (cadastro duplicado). Use o cadastro principal ou consolide os cadastros.",
        });
      }
      needsLink = true;
    }

    // 3) Redefine a senha (valor conhecido) na conta resolvida.
    {
      const { error } = await adminClient.auth.admin.updateUserById(userId!, { password, email_confirm: true });
      if (error) return json(400, { error: error.message });
    }

    // 4) Vincula (se mudou) + papel de aluno + empresa.
    if (needsLink) {
      const { error: linkError } = await adminClient.from("students").update({ user_id: userId }).eq("id", student_id);
      if (linkError) console.error("students link error", linkError);
    }
    await adminClient.from("user_roles").upsert({ user_id: userId, role: "student" }, { onConflict: "user_id,role" });
    if (student.company_id) {
      await adminClient
        .from("company_members")
        .upsert({ user_id: userId, company_id: student.company_id }, { onConflict: "user_id" });
    }

    return json(200, { email: student.email, password, user_id: userId });
  } catch (err) {
    const status = err instanceof HttpError ? (err as HttpError).status : 500;
    console.error("student-login-credentials error", err);
    return json(status, { error: (err as Error).message });
  }
});
