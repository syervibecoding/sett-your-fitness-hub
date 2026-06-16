// Nome do assistente da empresa em foco (Central de IA). Padrão do app = "Setty".
// Master vendo uma empresa → nome dela; senão a do próprio usuário.
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { useCompanyAiConfig } from "@/lib/companyAiConfig";

export function useAssistantName(): string {
  const { role, companyId } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const effectiveCompanyId =
    role === "master" ? (isViewingCompany ? viewingCompany?.id ?? null : null) : companyId;
  const { config } = useCompanyAiConfig(effectiveCompanyId);
  return config.assistant_name || "Setty";
}
