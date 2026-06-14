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

export async function assertTenantAccess(
  adminClient: any,
  claims: any,
  opts: { companyId?: unknown; studentId?: unknown; requireCompany?: boolean } = {},
): Promise<{ userId: string; companyId: string; isMaster: boolean; userCompanyId: string | null }> {
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

  const [masterResult, userCompanyResult] = await Promise.all([
    adminClient.rpc("has_role", { _user_id: userId, _role: "master" }),
    adminClient.rpc("get_user_company_id", { _user_id: userId }),
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

  const isMaster = !!masterResult.data;
  const userCompanyId = userCompanyResult.data ?? null;

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

  if (!isMaster) {
    if (!userCompanyId || !targetCompanyId || userCompanyId !== targetCompanyId) {
      throw new HttpError(403, "Forbidden: company mismatch.");
    }
    if (studentCompanyId && studentCompanyId !== userCompanyId) {
      throw new HttpError(403, "Forbidden: student mismatch.");
    }
  }

  if (!targetCompanyId) throw new HttpError(400, "Empresa não informada.");
  return { userId, companyId: targetCompanyId, isMaster: !!isMaster, userCompanyId: userCompanyId ?? null };
}
