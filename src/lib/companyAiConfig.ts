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
  // Campos completos para moldar a IA ao dono da unidade:
  owner_credentials: string | null;
  niche_audience: string | null;
  exercise_preferences: string | null;
  progression_model: string | null;
  assessment_protocol: string | null;
  red_lines: string | null;
  communication_style: string | null;
  nutrition_scope: string | null;
  ethical_limits: string | null;
  onboarding_completed: boolean;
}

// Fallback BN — usado quando a empresa ainda não preencheu o onboarding.
export const BN_AI_CONFIG: CompanyAiConfig = {
  assistant_name: "BNITO",
  consultancy_name: "BN Performance Training",
  methodology: null,
  plans_payment: null,
  tone: null,
  owner_credentials: null,
  niche_audience: null,
  exercise_preferences: null,
  progression_model: null,
  assessment_protocol: null,
  red_lines: null,
  communication_style: null,
  nutrition_scope: null,
  ethical_limits: null,
  onboarding_completed: false,
};

export async function fetchCompanyAiConfig(companyId: string | null | undefined): Promise<CompanyAiConfig> {
  if (!companyId) return BN_AI_CONFIG;
  const { data } = await (supabase as any)
    .from("company_ai_config")
    .select("assistant_name, consultancy_name, methodology, plans_payment, tone, owner_credentials, niche_audience, exercise_preferences, progression_model, assessment_protocol, red_lines, communication_style, nutrition_scope, ethical_limits, onboarding_completed")
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
