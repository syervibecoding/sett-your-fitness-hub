import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AssistantInfo {
  name: string;
  enabled: boolean;
  studentEnabled: boolean;
  staffEnabled: boolean;
  loading: boolean;
}

/**
 * Resolves the current company's AI assistant branding/availability.
 * Relies on RLS: a non-master user only sees their own company's config row.
 */
export function useAssistantName(): AssistantInfo {
  const { user, role } = useAuth();
  const [info, setInfo] = useState<AssistantInfo>({
    name: "Setty",
    enabled: false,
    studentEnabled: false,
    staffEnabled: false,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    if (!user || role === "master") {
      setInfo((p) => ({ ...p, loading: false }));
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("company_ai_config")
        .select("assistant_name, enabled, student_assistant_enabled, staff_assistant_enabled")
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setInfo({
        name: data?.assistant_name || "Setty",
        enabled: data?.enabled ?? false,
        studentEnabled: data?.student_assistant_enabled ?? false,
        staffEnabled: data?.staff_assistant_enabled ?? false,
        loading: false,
      });
    })();
    return () => {
      active = false;
    };
  }, [user, role]);

  return info;
}
