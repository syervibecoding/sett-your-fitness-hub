export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function assertBundleAccess(
  adminClient: any,
  bundleId: unknown,
  companyId: string,
  studentId: unknown,
): Promise<string | null> {
  if (bundleId == null || bundleId === "") return null;
  if (!isUuid(bundleId)) throw new HttpError(400, "bundle_id inválido.");
  if (!isUuid(studentId)) throw new HttpError(400, "student_id inválido.");

  const { data: bundle, error } = await adminClient
    .from("prescription_bundles")
    .select("id")
    .eq("id", bundleId)
    .eq("company_id", companyId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw new HttpError(500, `Falha ao validar pacote integrado: ${error.message}`);
  if (!bundle) throw new HttpError(403, "Forbidden: bundle mismatch.");
  return bundleId;
}

export async function assertTenantAccess(
  adminClient: any,
  claims: any,
  opts: { companyId?: unknown; studentId?: unknown; requireCompany?: boolean; requireStaff?: boolean } = {},
): Promise<{
  userId: string;
  companyId: string;
  isMaster: boolean;
  isStaff: boolean;
  userCompanyId: string | null;
  actorStudentId: string | null;
}> {
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) throw new HttpError(401, "Unauthorized");

  const requestedCompanyId = opts.companyId == null || opts.companyId === "" ? null : String(opts.companyId);
  const requestedStudentId = opts.studentId == null || opts.studentId === "" ? null : String(opts.studentId);

  if (requestedCompanyId && !isUuid(requestedCompanyId)) {
    throw new HttpError(400, "company_id inválido.");
  }
  if (requestedStudentId && !isUuid(requestedStudentId)) {
    throw new HttpError(400, "student_id inválido.");
  }

  const [masterResult, userCompanyResult, actorStudentResult] = await Promise.all([
    adminClient.rpc("has_role", { _user_id: userId, _role: "master" }),
    adminClient.rpc("get_user_company_id", { _user_id: userId }),
    adminClient
      .from("students")
      .select("id, company_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (masterResult.error) {
    console.error("tenant-auth: has_role(master) RPC failed", {
      userId,
      message: masterResult.error.message,
      code: masterResult.error.code,
      details: masterResult.error.details,
    });
    throw new HttpError(503, `Falha ao validar permissões do usuário: ${masterResult.error.message}`);
  }
  if (userCompanyResult.error) {
    console.error("tenant-auth: get_user_company_id RPC failed", {
      userId,
      message: userCompanyResult.error.message,
      code: userCompanyResult.error.code,
      details: userCompanyResult.error.details,
    });
    throw new HttpError(503, `Falha ao resolver empresa do usuário: ${userCompanyResult.error.message}`);
  }
  if (actorStudentResult.error) {
    console.error("tenant-auth: student ownership lookup failed", {
      userId,
      message: actorStudentResult.error.message,
      code: actorStudentResult.error.code,
      details: actorStudentResult.error.details,
    });
    throw new HttpError(503, `Falha ao validar vínculo do aluno: ${actorStudentResult.error.message}`);
  }

  const isMaster = !!masterResult.data;
  const userCompanyId = userCompanyResult.data ?? null;
  const actorStudentId = actorStudentResult.data?.id ?? null;
  const actorStudentCompanyId = actorStudentResult.data?.company_id ?? null;

  let studentCompanyId: string | null = null;
  if (requestedStudentId) {
    const { data: student, error } = await adminClient
      .from("students")
      .select("id, company_id")
      .eq("id", requestedStudentId)
      .maybeSingle();
    if (error) throw new HttpError(500, `Falha ao validar aluno: ${error.message}`);
    if (!student?.company_id) throw new HttpError(404, "Aluno não encontrado.");
    studentCompanyId = student.company_id;
  }

  const targetCompanyId = requestedCompanyId || studentCompanyId || userCompanyId || null;
  if (!targetCompanyId && opts.requireCompany !== false) {
    throw new HttpError(400, "Empresa não informada.");
  }
  if (targetCompanyId && !isUuid(targetCompanyId)) {
    throw new HttpError(400, "company_id inválido.");
  }
  if (requestedCompanyId && studentCompanyId && requestedCompanyId !== studentCompanyId) {
    throw new HttpError(403, "Forbidden: aluno não pertence à empresa informada.");
  }

  if (!targetCompanyId) throw new HttpError(400, "Empresa não informada.");

  const staffResult = await adminClient.rpc("is_company_staff", {
    _user_id: userId,
    _company_id: targetCompanyId,
  });
  if (staffResult.error) {
    console.error("tenant-auth: is_company_staff RPC failed", {
      userId,
      targetCompanyId,
      message: staffResult.error.message,
      code: staffResult.error.code,
      details: staffResult.error.details,
    });
    throw new HttpError(503, `Falha ao validar acesso da equipe: ${staffResult.error.message}`);
  }
  const isStaff = !!staffResult.data;

  if (opts.requireStaff && !isStaff) {
    throw new HttpError(403, "Forbidden: staff access required.");
  }

  if (!isStaff) {
    if (!actorStudentId || !actorStudentCompanyId) {
      throw new HttpError(403, "Forbidden: company staff or student ownership required.");
    }
    if (actorStudentCompanyId !== targetCompanyId) {
      throw new HttpError(403, "Forbidden: company mismatch.");
    }
    if (requestedStudentId && requestedStudentId !== actorStudentId) {
      throw new HttpError(403, "Forbidden: student mismatch.");
    }
  }

  return {
    userId,
    companyId: targetCompanyId,
    isMaster,
    isStaff,
    userCompanyId: userCompanyId ?? null,
    actorStudentId,
  };
}
