// ============================================================================
// FunctionalAssessment — página standalone da Avaliação Postural e Funcional.
//   Seletor de aluno + FunctionalAssessmentPanel (miolo reutilizável).
// ============================================================================
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import FunctionalAssessmentPanel from "@/components/admin/FunctionalAssessmentPanel";

interface Student { id: string; full_name: string; }

export default function FunctionalAssessment() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [students, setStudents]   = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase.from("company_members")
        .select("company_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m) return;
      setCompanyId(m.company_id);
      const { data: list } = await supabase.from("students")
        .select("id, full_name").eq("company_id", m.company_id).order("full_name");
      setStudents(list || []);
    })();
  }, []);

  const student = students.find(s => s.id === studentId);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Avaliação</p>
        <h1 className="font-display text-3xl">Avaliação Funcional</h1>
        <p className="text-sm text-muted-foreground">Laudo por fotos (Metodologia BN) ou avaliação manual por vídeo · contexto para a prescrição</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aluno</CardTitle></CardHeader>
        <CardContent>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {studentId && (
        <FunctionalAssessmentPanel
          studentId={studentId}
          companyId={companyId}
          studentName={student?.full_name}
        />
      )}
    </div>
  );
}
