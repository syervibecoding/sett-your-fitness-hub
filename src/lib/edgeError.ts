// Lê o erro REAL de um supabase.functions.invoke que falhou. O supabase-js entrega non-2xx como
// FunctionsHttpError com `e.message` genérico ("Edge Function returned a non-2xx status code") e o
// corpo estruturado em `e.context` (uma Response). Aqui lemos esse corpo para mostrar a causa real —
// e, quando é um BLOQUEIO do validador, uma mensagem amigável.
export async function readEdgeError(e: any, data: any): Promise<string | null> {
  if (!e && !data?.error) return null;
  let body: any = null;
  try { if (e?.context && typeof e.context.json === "function") body = await e.context.json(); } catch { /* corpo não-JSON */ }

  const blockers = body?.validator?.blockers;
  if (body?.validator?.status === "blocked" || (Array.isArray(blockers) && blockers.length > 0)) {
    const reasons = (blockers || []).map((b: any) => b?.message || b?.recommendation || b?.code).filter(Boolean);
    return `Prescrição bloqueada pelo validador: ${reasons.join(" · ") || "a IA usou exercício(s) fora da biblioteca cadastrada"}. Ajuste a biblioteca ou gere novamente.`;
  }

  return body?.error || body?.details || body?.message || data?.error || e?.message || "Falha na geração.";
}
