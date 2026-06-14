// Boneco de limitações no PERFIL do aluno (admin): busca a última avaliação funcional do aluno
// e mostra o mapa anatômico de limitações (muscular/articular/neural). Self-fetch por studentId.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Activity } from "lucide-react";
import { AssessmentBodyMap } from "./AssessmentBodyMap";
import { assessmentToBodyRegions } from "@/lib/assessmentBodyMap";

export function StudentAssessmentBodyMap({ studentId }: { studentId: string }) {
  const [json, setJson] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("functional_assessments")
        .select("assessment_json, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (on) {
        setJson((data as any)?.assessment_json ?? null);
        setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [studentId]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  let hasLimits = false;
  try { hasLimits = !!json && assessmentToBodyRegions(json).length > 0; } catch { hasLimits = false; }

  if (!hasLimits) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-6 text-center">
          <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {json
              ? "A última avaliação funcional não registrou limitações para mapear."
              : "Nenhuma avaliação funcional gerada para este aluno ainda."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Gere em Exercícios → Avaliação Funcional.</p>
        </CardContent>
      </Card>
    );
  }

  return <AssessmentBodyMap assessmentJson={json} />;
}
