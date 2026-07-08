import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BodyLimitation {
  id: string;
  region: string;
  type: string | null;
  severity: string | null;
  note: string | null;
}

// Carrega as limitações corporais (anamnese) de um aluno.
export function useStudentLimitations(studentId: string | null | undefined) {
  const [limitations, setLimitations] = useState<BodyLimitation[]>([]);

  useEffect(() => {
    let active = true;
    if (!studentId) {
      setLimitations([]);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("student_body_limitations")
        .select("id, region, type, severity, note")
        .eq("student_id", studentId);
      if (active) setLimitations((data as BodyLimitation[]) || []);
    })();
    return () => {
      active = false;
    };
  }, [studentId]);

  return limitations;
}
