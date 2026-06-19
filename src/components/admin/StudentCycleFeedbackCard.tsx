import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquareHeart, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mostra ao professor o último NPS/feedback de fim de ciclo do aluno — para aplicar na
// hora de liberar a próxima prescrição (liberação manual). Item 3 da reforma da anamnese.
interface Feedback {
  id: string; nps: number | null; goals_aligned: boolean | null;
  wants_adjustment: boolean | null; adjustment_notes: string | null;
  applied: boolean; created_at: string;
}

export function StudentCycleFeedbackCard({ studentId }: { studentId: string }) {
  const [fb, setFb] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (supabase as any)
      .from("cycle_feedback")
      .select("id, nps, goals_aligned, wants_adjustment, adjustment_notes, applied, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => { if (alive) { setFb(data || null); setLoading(false); } });
    return () => { alive = false; };
  }, [studentId]);

  if (loading || !fb) return null;

  const markApplied = async () => {
    const { error } = await (supabase as any).from("cycle_feedback").update({ applied: true }).eq("id", fb.id);
    if (!error) setFb({ ...fb, applied: true });
  };

  const npsColor = fb.nps == null ? "text-muted-foreground" : fb.nps >= 9 ? "text-green-600" : fb.nps >= 7 ? "text-amber-600" : "text-red-600";

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <MessageSquareHeart className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Feedback de fim de ciclo</span>
              <span className="text-[11px] text-muted-foreground">{format(parseISO(fb.created_at), "dd/MM/yy", { locale: ptBR })}</span>
              {fb.applied ? (
                <Badge variant="outline" className="border-green-500/40 text-green-600 text-[10px]">aplicado</Badge>
              ) : fb.wants_adjustment ? (
                <Badge className="bg-amber-500 text-[10px] text-white">ajuste pedido</Badge>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm">
              <span>NPS: <span className={`font-mono-data font-bold ${npsColor}`}>{fb.nps ?? "—"}</span></span>
              <span className="text-muted-foreground">Objetivos: <span className="text-foreground">{fb.goals_aligned == null ? "—" : fb.goals_aligned ? "iguais" : "mudaram"}</span></span>
            </div>
            {fb.wants_adjustment && fb.adjustment_notes && (
              <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-foreground">
                <span className="font-medium text-amber-700">Ajuste pedido: </span>{fb.adjustment_notes}
              </p>
            )}
            {!fb.applied && (
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={markApplied}>
                <Check className="mr-1 h-3.5 w-3.5" /> Marcar como revisado
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
