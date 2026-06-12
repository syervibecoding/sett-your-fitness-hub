// Interpolação de variáveis em templates de mensagem do WhatsApp.
// Mantém `{{variavel}}` desconhecida intacta e troca as conhecidas por dados do aluno.

export interface TemplateVars {
  nome?: string;
  primeiro_nome?: string;
  plano?: string;
  vencimento?: string;
  valor?: string;
  dias_restantes?: string | number;
}

const KNOWN_KEYS: (keyof TemplateVars)[] = [
  "nome",
  "primeiro_nome",
  "plano",
  "vencimento",
  "valor",
  "dias_restantes",
];

/** Lista para a UI de templates documentar o que está disponível. */
export const TEMPLATE_VARIABLES: { key: keyof TemplateVars; label: string }[] = [
  { key: "nome", label: "Nome completo" },
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "plano", label: "Nome do plano" },
  { key: "vencimento", label: "Vencimento" },
  { key: "valor", label: "Valor do plano" },
  { key: "dias_restantes", label: "Dias restantes do ciclo" },
];

export function interpolateTemplate(content: string, vars: TemplateVars): string {
  return content.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, rawKey: string) => {
    const key = rawKey.toLowerCase() as keyof TemplateVars;
    if (!KNOWN_KEYS.includes(key)) return match;
    const val = vars[key];
    return val === undefined || val === null || val === "" ? "" : String(val);
  });
}
