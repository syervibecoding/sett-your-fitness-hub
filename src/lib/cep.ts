// Busca de endereço por CEP (e CEP por endereço) via ViaCEP — grátis, sem chave.
export interface CepResult {
  cep: string;        // só dígitos
  logradouro: string; // rua
  bairro: string;
  cidade: string;
  uf: string;
}

// CEP → endereço
export async function lookupCep(cepRaw: string): Promise<CepResult | null> {
  const cep = (cepRaw || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || d.erro) return null;
    return {
      cep,
      logradouro: d.logradouro || "",
      bairro: d.bairro || "",
      cidade: d.localidade || "",
      uf: d.uf || "",
    };
  } catch {
    return null;
  }
}

// endereço (UF + cidade + rua) → CEP (pega a 1ª correspondência)
export async function lookupCepByAddress(uf: string, cidade: string, logradouro: string): Promise<CepResult | null> {
  const u = (uf || "").trim();
  const c = (cidade || "").trim();
  const l = (logradouro || "").trim();
  if (u.length !== 2 || c.length < 3 || l.length < 3) return null;
  try {
    const res = await fetch(
      `https://viacep.com.br/ws/${encodeURIComponent(u)}/${encodeURIComponent(c)}/${encodeURIComponent(l)}/json/`,
    );
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const d = arr[0];
    return {
      cep: (d.cep || "").replace(/\D/g, ""),
      logradouro: d.logradouro || "",
      bairro: d.bairro || "",
      cidade: d.localidade || "",
      uf: d.uf || "",
    };
  } catch {
    return null;
  }
}

// "12345678" → "12345-678"
export function formatCepMask(cepRaw: string): string {
  const d = (cepRaw || "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
