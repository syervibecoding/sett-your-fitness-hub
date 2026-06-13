// Painel central do aluno: a linha do tempo única (anamnese → avaliação → prescrição →
// pagamentos → treinos → arquivos). Reutilizável no detalhe do aluno.
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ClipboardList, Activity, Dumbbell, DollarSign, CheckCircle2, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useStudentTimeline, type TimelineKind } from "@/hooks/useStudentTimeline";

const ICON: Record<TimelineKind, React.ComponentType<{ className?: string }>> = {
  anamnese: ClipboardList,
  avaliacao: Activity,
  prescricao: Dumbbell,
  pagamento: DollarSign,
  treino: CheckCircle2,
  arquivo: FileText,
};
const TINT: Record<TimelineKind, string> = {
  anamnese: "text-blue-600 bg-blue-500/10",
  avaliacao: "text-purple-600 bg-purple-500/10",
  prescricao: "text-primary bg-primary/10",
  pagamento: "text-amber-600 bg-amber-500/10",
  treino: "text-emerald-600 bg-emerald-500/10",
  arquivo: "text-muted-foreground bg-muted",
};

export function StudentTimeline({ studentId }: { studentId: string }) {
  const { events, loading } = useStudentTimeline(studentId);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <p className="text-eyebrow mb-3">Linha do tempo</p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem eventos ainda — anamnese, avaliação, prescrição, pagamentos e treinos aparecem aqui.</p>
        ) : (
          <div className="relative pl-2">
            {events.map((e, i) => {
              const Icon = ICON[e.kind];
              let when = "";
              try { when = format(parseISO(e.date), "dd/MM/yy", { locale: ptBR }); } catch { /* ignore */ }
              return (
                <div key={e.id} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", TINT[e.kind])}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {i < events.length - 1 && <span className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0 -mt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                      <span className="font-mono-data text-[11px] text-muted-foreground shrink-0">{when}</span>
                    </div>
                    {e.subtitle && <p className="text-xs text-muted-foreground truncate">{e.subtitle}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
