import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, ClipboardList, FileText, UserPlus, Target, Trophy, CheckCircle2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  studentId: string;
}

type TimelineEvent = {
  id: string;
  date: string;
  icon: "workout_done" | "workout_created" | "anamnesis" | "evaluation" | "enrollment" | "goal";
  title: string;
  description?: string;
};

const ICONS = {
  workout_done: CheckCircle2,
  workout_created: Dumbbell,
  anamnesis: ClipboardList,
  evaluation: FileText,
  enrollment: UserPlus,
  goal: Target,
} as const;

function fmt(value: string) {
  try {
    const d = parseISO(value);
    return isValid(d) ? format(d, "dd MMM yyyy · HH:mm", { locale: ptBR }) : "—";
  } catch {
    return "—";
  }
}

export function StudentTimeline({ studentId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const load = async () => {
    setLoading(true);
    const collected: TimelineEvent[] = [];

    // Treinos realizados
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("id, status, session_date, completed_at, created_at, total_volume")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(100);
    (sessions || []).forEach((s: any) => {
      const done = s.status === "completed";
      collected.push({
        id: `session-${s.id}`,
        date: s.completed_at || s.session_date || s.created_at,
        icon: "workout_done",
        title: done ? "Treino concluído" : "Treino iniciado",
        description: s.total_volume ? `Volume total: ${Math.round(Number(s.total_volume))} kg` : undefined,
      });
    });

    // Anamnese
    const { data: anamneses } = await supabase
      .from("student_anamneses")
      .select("id, objective, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20);
    (anamneses || []).forEach((a: any) => {
      collected.push({
        id: `anamnesis-${a.id}`,
        date: a.created_at,
        icon: "anamnesis",
        title: "Anamnese registrada",
        description: a.objective || undefined,
      });
    });

    // Avaliações
    const { data: evals } = await supabase
      .from("student_evaluations")
      .select("id, type, evaluation_date, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50);
    (evals || []).forEach((e: any) => {
      collected.push({
        id: `eval-${e.id}`,
        date: e.evaluation_date || e.created_at,
        icon: "evaluation",
        title: "Avaliação registrada",
        description: e.type ? `Tipo: ${e.type}` : undefined,
      });
    });

    // Matrículas + treinos criados (via ciclos)
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("id, created_at, training_start_date, status")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(30);
    const enrollmentIds = (enrollments || []).map((e: any) => e.id);
    (enrollments || []).forEach((e: any) => {
      collected.push({
        id: `enroll-${e.id}`,
        date: e.created_at,
        icon: "enrollment",
        title: "Matrícula criada",
        description: e.training_start_date ? `Início do treino: ${fmt(e.training_start_date)}` : undefined,
      });
    });

    if (enrollmentIds.length > 0) {
      const { data: cycles } = await supabase
        .from("training_cycles")
        .select("id, enrollment_id")
        .in("enrollment_id", enrollmentIds);
      const cycleIds = (cycles || []).map((c: any) => c.id);
      if (cycleIds.length > 0) {
        const { data: workouts } = await supabase
          .from("workouts")
          .select("id, name, title, created_at")
          .in("cycle_id", cycleIds)
          .order("created_at", { ascending: false })
          .limit(100);
        (workouts || []).forEach((w: any) => {
          collected.push({
            id: `workout-${w.id}`,
            date: w.created_at,
            icon: "workout_created",
            title: "Treino prescrito",
            description: w.title || w.name || undefined,
          });
        });
      }
    }

    // Provas e metas
    const { data: goals } = await supabase
      .from("student_goals")
      .select("id, title, type, target_date")
      .eq("student_id", studentId)
      .order("target_date", { ascending: false })
      .limit(50);
    (goals || []).forEach((g: any) => {
      collected.push({
        id: `goal-${g.id}`,
        date: g.target_date,
        icon: "goal",
        title: g.type === "prova" ? "Prova" : "Meta",
        description: g.title,
      });
    });

    collected.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEvents(collected);
    setLoading(false);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-primary text-lg">LINHA DO TEMPO</CardTitle>
        <p className="text-xs text-muted-foreground font-sans">Histórico de prescrições, treinos realizados, anamnese, avaliações e matrículas.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground font-sans text-sm py-4">Nenhum evento registrado ainda.</p>
        ) : (
          <ol className="relative border-l border-border ml-3 space-y-5">
            {events.map((ev) => {
              const Icon = ICONS[ev.icon];
              return (
                <li key={ev.id} className="ml-6">
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-4 ring-card">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <p className="text-sm font-medium text-foreground">{ev.title}</p>
                  <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">{fmt(ev.date)}</p>
                  {ev.description && <p className="text-xs font-sans text-muted-foreground mt-0.5">{ev.description}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
