import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";

export type CompanyTier = "basic" | "intermediate" | "advanced";

export interface CompanyFeatures {
  tier: CompanyTier;
  loading: boolean;
  // Prescription - all tiers
  hasPrescription: boolean;
  // Management - intermediate + advanced
  hasDashboard: boolean;
  hasRegistration: boolean;
  hasAnamnesis: boolean;
  hasStudents: boolean;
  hasAgenda: boolean;
  hasTeam: boolean;
  hasPlans: boolean;
  hasAppearance: boolean;
  // Financial - intermediate + advanced
  hasFinancial: boolean;
  // WhatsApp CRM - advanced only
  hasWhatsApp: boolean;
  hasAutomation: boolean;
}

const TIER_FEATURES: Record<CompanyTier, Omit<CompanyFeatures, "tier" | "loading">> = {
  basic: {
    hasPrescription: true,
    hasDashboard: true,
    hasRegistration: true,
    hasAnamnesis: true,
    hasStudents: true,
    hasAgenda: true,
    hasTeam: false,
    hasPlans: true,
    hasAppearance: false,
    hasFinancial: false,
    hasWhatsApp: false,
    hasAutomation: false,
  },
  intermediate: {
    hasPrescription: true,
    hasDashboard: true,
    hasRegistration: true,
    hasAnamnesis: true,
    hasStudents: true,
    hasAgenda: true,
    hasTeam: true,
    hasPlans: true,
    hasAppearance: true,
    hasFinancial: true,
    hasWhatsApp: false,
    hasAutomation: false,
  },
  advanced: {
    hasPrescription: true,
    hasDashboard: true,
    hasRegistration: true,
    hasAnamnesis: true,
    hasStudents: true,
    hasAgenda: true,
    hasTeam: true,
    hasPlans: true,
    hasAppearance: true,
    hasFinancial: true,
    hasWhatsApp: true,
    hasAutomation: true,
  },
};

export function useCompanyFeatures(): CompanyFeatures {
  const { user, role } = useAuth();
  const { viewingCompany, contextLoading } = useMaster();
  const [tier, setTier] = useState<CompanyTier>("basic");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (role === "master") {
      if (contextLoading) return;
      const companyTier = viewingCompany?.tier as CompanyTier | undefined;
      setTier(companyTier && companyTier in TIER_FEATURES ? companyTier : "advanced");
      setLoading(false);
      return;
    }

    const fetchTier = async () => {
      const { data } = await supabase
        .from("company_members")
        .select("company_id, companies(tier)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (data?.companies) {
        const companyTier = (data.companies as any).tier as CompanyTier;
        setTier(companyTier || "basic");
      }
      setLoading(false);
    };

    fetchTier();
  }, [contextLoading, role, user, viewingCompany]);

  return {
    tier,
    loading,
    ...TIER_FEATURES[tier],
  };
}
