import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

// Mostra ao professor as respostas das PERGUNTAS EXTRAS (custom) que ele adicionou à anamnese.
// Lê student_anamneses.custom_answers (preenchido pelo aluno no passo extra do StudioAnamnese).
export function StudentCustomAnswersCard({ studentId }: { studentId: string }) {
  const [answers, setAnswers] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!studentId) return;
    (supabase as any)
      .from("student_anamneses")
      .select("custom_answers")
      .eq("student_id", studentId)
      .maybeSingle()
      .then(({ data }: any) => setAnswers(data?.custom_answers || null));
  }, [studentId]);

  const entries = answers
    ? Object.values(answers).filter((a: any) => a && (a.value ?? "") !== "" && !(Array.isArray(a.value) && a.value.length === 0))
    : [];
  if (!entries.length) return null;

  return (
    <Card className="bg-card border-border mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-primary text-base">
          <HelpCircle className="h-4 w-4" /> PERGUNTAS EXTRAS (suas)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm font-sans">
        {entries.map((a: any, i: number) => (
          <div key={i}>
            <span className="font-medium text-foreground">{a.label || "Pergunta"}:</span>{" "}
            <span className="text-muted-foreground">{Array.isArray(a.value) ? a.value.join(", ") : String(a.value)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
