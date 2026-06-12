// ============================================================================
// validation.ts — Helpers de sanitização de input para mitigar XSS stored.
// Aplicado nos campos de texto livre antes de gravar no Supabase.
// ============================================================================

/**
 * Sanitiza texto livre: remove os caracteres < > " (que habilitam injeção de
 * HTML/atributos), normaliza espaços em branco nas bordas e trunca no
 * comprimento máximo. Retorna string vazia para entradas nulas/indefinidas.
 */
export function sanitizeText(input: unknown, maxLen = 2000): string {
  if (input === null || input === undefined) return "";
  const str = String(input).replace(/[<>"]/g, "").trim();
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * Sanitiza um campo curto (nomes, rótulos). Mesma limpeza, limite menor.
 */
export function sanitizeShort(input: unknown, maxLen = 200): string {
  return sanitizeText(input, maxLen);
}
