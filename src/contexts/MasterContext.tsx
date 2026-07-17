import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  MASTER_COMPANY_STORAGE_KEY,
  parseStoredViewingCompany,
  resolveViewingCompany,
  type ViewingCompany,
} from "@/lib/masterCompanyContext";

interface MasterContextType {
  viewingCompany: ViewingCompany | null;
  setViewingCompany: (company: ViewingCompany | null) => void;
  isViewingCompany: boolean;
  contextLoading: boolean;
  contextError: string | null;
  exitCompanyView: () => void;
}

const MasterContext = createContext<MasterContextType | undefined>(undefined);

export function MasterProvider({ children }: { children: ReactNode }) {
  const { role, loading: authLoading } = useAuth();
  const [viewingCompany, setViewingCompanyState] = useState<ViewingCompany | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (authLoading) {
      setContextLoading(true);
      return () => {
        active = false;
      };
    }

    if (role !== "master") {
      localStorage.removeItem(MASTER_COMPANY_STORAGE_KEY);
      setViewingCompanyState(null);
      setContextError(null);
      setContextLoading(false);
      return () => {
        active = false;
      };
    }

    const validateStoredCompany = async () => {
      setContextLoading(true);
      setContextError(null);

      const rawStored = localStorage.getItem(MASTER_COMPANY_STORAGE_KEY);
      const stored = parseStoredViewingCompany(rawStored);

      if (!stored) {
        if (rawStored) localStorage.removeItem(MASTER_COMPANY_STORAGE_KEY);
        if (active) {
          setViewingCompanyState(null);
          setContextLoading(false);
        }
        return;
      }

      try {
        const candidates: ViewingCompany[] = [];
        const { data: exactCompany, error: exactError } = await supabase
          .from("companies")
          .select("id, name, tier, slug")
          .eq("id", stored.id)
          .maybeSingle();

        if (exactError) throw exactError;
        if (exactCompany) candidates.push(exactCompany);

        if (!exactCompany && stored.slug) {
          const { data: slugCompanies, error: slugError } = await supabase
            .from("companies")
            .select("id, name, tier, slug")
            .eq("slug", stored.slug)
            .limit(2);

          if (slugError) throw slugError;
          candidates.push(...(slugCompanies || []));
        }

        if (candidates.length === 0) {
          const { data: nameCompanies, error: nameError } = await supabase
            .from("companies")
            .select("id, name, tier, slug")
            .eq("name", stored.name)
            .limit(2);

          if (nameError) throw nameError;
          candidates.push(...(nameCompanies || []));
        }

        const resolved = resolveViewingCompany(stored, candidates);
        if (!active) return;

        if (resolved) {
          localStorage.setItem(MASTER_COMPANY_STORAGE_KEY, JSON.stringify(resolved));
          setViewingCompanyState(resolved);
        } else {
          localStorage.removeItem(MASTER_COMPANY_STORAGE_KEY);
          setViewingCompanyState(null);
        }
      } catch (error) {
        console.error("Failed to validate master company context:", error);
        if (!active) return;
        setViewingCompanyState(null);
        setContextError("Não foi possível validar a empresa selecionada. Tente novamente.");
      } finally {
        if (active) setContextLoading(false);
      }
    };

    void validateStoredCompany();

    return () => {
      active = false;
    };
  }, [authLoading, role]);

  const setViewingCompany = (company: ViewingCompany | null) => {
    if (company) {
      localStorage.setItem(MASTER_COMPANY_STORAGE_KEY, JSON.stringify(company));
    } else {
      localStorage.removeItem(MASTER_COMPANY_STORAGE_KEY);
    }
    setContextError(null);
    setViewingCompanyState(company);
  };

  const exitCompanyView = () => {
    setViewingCompany(null);
  };

  return (
    <MasterContext.Provider
      value={{
        viewingCompany,
        setViewingCompany,
        isViewingCompany: !!viewingCompany,
        contextLoading,
        contextError,
        exitCompanyView,
      }}
    >
      {children}
    </MasterContext.Provider>
  );
}

export function useMaster() {
  const context = useContext(MasterContext);
  if (context === undefined) {
    throw new Error("useMaster must be used within a MasterProvider");
  }
  return context;
}
