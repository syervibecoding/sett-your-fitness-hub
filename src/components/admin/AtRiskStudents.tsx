// Dashboard de evasão ("quem sumiu"): unifica os sinais de risco por aluno usando a máquina
// de status única (studentStatus). Componente novo e standalone (não edita DashboardAlerts).
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { deriveStudentStatus, riskReasons, STUDENT_STATUS_LABELS, STUDENT_STATUS_COLORS, type StudentStatus } from "@/lib/studentStatus";
import { cn } from "@/lib/utils";

interface RiskRow { id: string; name: string; status: StudentStatus; reasons: string[]; chatId?: string | null; }
const PAID = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];

export function AtRiskStudents() {
  const navigate = useNavigate();
  const { companyId, role } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const effectiveCompanyId = role === "master" ? (isViewingCompany ? viewingCompany?.id : null) : companyId;
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Sem empresa efetiva (master fora do company-view), não lista global de todas as empresas.
    if (!effectiveCompanyId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: students } = await supabase
        .from("students" as any).select("id, full_name, status")
        .neq("status", "inactive").eq("company_id", effectiveCompanyId);
      const ids = (students ?? []).map((s: any) => s.id);
      if (ids.length === 0) { setRows([]); setLoading(false); return; }

      const [{ data: pays }, { data: sessions }, { data: chats }, { data: cycles }] = await Promise.all([
        supabase.from("payments").select("student_id, status").in("student_id", ids).not("status", "in", `(${PAID.map((s) => `"${s}"`).join(",")})`),
        supabase.from("workout_sessions").select("student_id, completed_at").in("student_id", ids).eq("status", "completed"),
        supabase.from("whatsapp_chats").select("id, student_id").in("student_id", ids),
        supabase.from("training_cycles" as any).select("student_id, end_date, status").in("student_id", ids).eq("status", "active"),
      ]);

      const overdue = new Set((pays ?? []).map((p: any) => p.student_id));
      const lastSession: Record<string, string> = {};
      (sessions ?? []).forEach((s: any) => { if (s.completed_at && (!lastSession[s.student_id] || s.completed_at > lastSession[s.student_id])) lastSession[s.student_id] = s.completed_at; });
      const chatByStudent: Record<string, string> = {};
      (chats ?? []).forEach((c: any) => { chatByStudent[c.student_id] = c.id; });
      const cycleEnd: Record<string, string> = {};
      const activeCycle = new Set<string>();
      (cycles ?? []).forEach((c: any) => { activeCycle.add(c.student_id); if (c.end_date) cycleEnd[c.student_id] = c.end_date; });

      const now = Date.now();
      const out: RiskRow[] = [];
      for (const s of students as any[]) {
        const last = lastSession[s.id];
        const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
        const end = cycleEnd[s.id];
        const cycleEndsInDays = end ? Math.ceil((new Date(end).getTime() - now) / 86400000) : null;
        const signals = {
          baseStatus: s.status, hasAnamnesis: true, hasAssessment: true, hasActiveWorkout: activeCycle.has(s.id),
          daysSinceLastTraining: daysSince, paymentOverdue: overdue.has(s.id), cycleEndsInDays,
        };
        const status = deriveStudentStatus(signals);
        if (status === "risco" || status === "renovacao") {
          out.push({ id: s.id, name: s.full_name, status, reasons: riskReasons(signals), chatId: chatByStudent[s.id] });
        }
      }
      out.sort((a, b) => (a.status === "risco" ? -1 : 1) - (b.status === "risco" ? -1 : 1));
      setRows(out);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <p className="text-eyebrow mb-3 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Alunos em risco / renovação</p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum aluno em risco no momento. 👏</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                    <Badge className={cn("text-[10px]", STUDENT_STATUS_COLORS[r.status])}>{STUDENT_STATUS_LABELS[r.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.reasons.join(" · ")}</p>
                </div>
                {r.chatId && (
                  <button onClick={() => navigate("/admin/whatsapp-chat", { state: { chatId: r.chatId } })}
                    className="text-primary hover:bg-muted/60 rounded p-1.5 transition-colors" title="Abrir conversa">
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
