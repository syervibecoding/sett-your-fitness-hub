// White-label: configuração da "IA-coração" por empresa.
// Fonte de verdade da persona/metodologia/nome do assistente que o BNITO (e as edge functions)
// devem usar. Fallback = comportamento BN atual (assistente "BNITO").
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyAiConfig {
  assistant_name: string;
  consultancy_name: string | null;
  methodology: string | null;
  plans_payment: string | null;
  tone: string | null;
  onboarding_completed: boolean;
}

// Fallback BN — usado quando a empresa ainda não preencheu o onboarding.
export const BN_AI_CONFIG: CompanyAiConfig = {
  assistant_name: "BNITO",
  consultancy_name: "BN Performance Training",
  methodology: null,
  plans_payment: null,
  tone: null,
  onboarding_completed: false,
};

export async function fetchCompanyAiConfig(companyId: string | null | undefined): Promise<CompanyAiConfig> {
  if (!companyId) return BN_AI_CONFIG;
  const { data } = await (supabase as any)
    .from("company_ai_config")
    .select("assistant_name, consultancy_name, methodology, plans_payment, tone, onboarding_completed")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return BN_AI_CONFIG;
  return { ...BN_AI_CONFIG, ...data };
}

export async function saveCompanyAiConfig(
  companyId: string,
  patch: Partial<CompanyAiConfig>,
): Promise<{ error: string | null }> {
  const { error } = await (supabase as any)
    .from("company_ai_config")
    .upsert({ company_id: companyId, ...patch }, { onConflict: "company_id" });
  return { error: error?.message ?? null };
}

/** Hook React: carrega a config da empresa (com fallback BN). */
export function useCompanyAiConfig(companyId: string | null | undefined) {
  const [config, setConfig] = useState<CompanyAiConfig>(BN_AI_CONFIG);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCompanyAiConfig(companyId).then((c) => {
      if (active) {
        setConfig(c);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [companyId]);
  return { config, loading };
}
