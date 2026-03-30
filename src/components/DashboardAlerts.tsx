import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cake, Dumbbell, UserCheck, CalendarDays } from "lucide-react";
import { differenceInDays, setYear } from "date-fns";

interface Birthday {
  full_name: string;
  birth_date: string;
  daysUntil: number;
}


interface MissingWorkout {
  student_name: string;
  cycle_number: number;
  cycle_id: string;
  start_date: string;
  end_date: string;
}

interface AwaitingTrainingDate {
  student_name: string;
  enrollment_id: string;
}

interface AwaitingTrainer {
  student_name: string;
  student_id: string;
}


interface MissingEnrollment {
  student_name: string;
  student_id: string;
}

interface Props {
  trainerId?: string;
}

export function DashboardAlerts({ trainerId }: Props) {
  const { role, companyId } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const effectiveCompanyId = role === "master" ? (isViewingCompany ? viewingCompany?.id : null) : companyId;

  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  
  const [missingWorkouts, setMissingWorkouts] = useState<MissingWorkout[]>([]);
  const [awaitingTrainer, setAwaitingTrainer] = useState<AwaitingTrainer[]>([]);
  
  const [awaitingTrainingDate, setAwaitingTrainingDate] = useState<AwaitingTrainingDate[]>([]);
  const [missingEnrollment, setMissingEnrollment] = useState<MissingEnrollment[]>([]);

  useEffect(() => { loadAlerts(); }, [trainerId, effectiveCompanyId]);

  const loadAlerts = async () => {
    const today = new Date();

    // Helper to add company filter
    const addCompanyFilter = (query: any) => {
      if (effectiveCompanyId) return query.eq("company_id", effectiveCompanyId);
      return query;
    };

    // Build parallel queries based on role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queries: any[] = [
      // 0: Students with birthdays
      addCompanyFilter(supabase.from("students").select("id, full_name, birth_date, assigned_trainer_id, status")
        .not("birth_date", "is", null).eq("status", "active")),
    ];

    if (!trainerId) {
      // 1: Awaiting trainer
      queries.push(addCompanyFilter(supabase.from("students").select("id, full_name, assigned_trainer_id")
        .in("status", ["active", "pending"]).is("assigned_trainer_id", null)));
      // 2: Awaiting training date
      queries.push(addCompanyFilter(supabase.from("enrollments").select("id, students(full_name)")
        .in("status", ["active", "awaiting_training"]).is("training_start_date", null)));
      // 3: Active students
      queries.push(addCompanyFilter(supabase.from("students").select("id, full_name").eq("status", "active")));
      // 4: All enrollments for missing enrollment check (no company filter — students already filtered)
      queries.push(supabase.from("enrollments").select("student_id").in("status", ["active", "awaiting_training"]));
    }

    // 5/1: Active enrollments for cycles
    let enrollQuery = supabase.from("enrollments").select("id, students(full_name)")
      .eq("status", "active") as any;
    if (trainerId) enrollQuery = enrollQuery.eq("trainer_id", trainerId);
    if (effectiveCompanyId) enrollQuery = enrollQuery.eq("company_id", effectiveCompanyId);
    queries.push(enrollQuery);

    const results = await Promise.all(queries);

    // Process birthdays (index 0)
    const students = results[0].data;
    if (students) {
      const upcoming: Birthday[] = [];
      students.forEach((s: any) => {
        if (!s.birth_date) return;
        const bd = new Date(s.birth_date);
        const thisYear = setYear(bd, today.getFullYear());
        let diff = differenceInDays(thisYear, today);
        if (diff < 0) {
          const nextYear = setYear(bd, today.getFullYear() + 1);
          diff = differenceInDays(nextYear, today);
        }
        if (diff <= 30) upcoming.push({ full_name: s.full_name, birth_date: s.birth_date, daysUntil: diff });
      });
      setBirthdays(upcoming.sort((a, b) => a.daysUntil - b.daysUntil));
    }

    let nextIdx: number;
    if (!trainerId) {
      // Awaiting trainer (index 1)
      setAwaitingTrainer((results[1].data || []).map((s: any) => ({ student_name: s.full_name, student_id: s.id })));
      // Awaiting training date (index 2)
      setAwaitingTrainingDate((results[2].data || []).map((e: any) => ({
        student_name: e.students?.full_name || "—", enrollment_id: e.id,
      })));
      // Missing enrollment (index 3 + 4)
      const activeStudents = results[3].data || [];
      const enrolledIds = new Set((results[4].data || []).map((e: any) => e.student_id));
      setMissingEnrollment(activeStudents.filter((s: any) => !enrolledIds.has(s.id))
        .map((s: any) => ({ student_name: s.full_name, student_id: s.id })));
      nextIdx = 5;
    } else {
      setAwaitingTrainingDate([]);
      setMissingEnrollment([]);
      nextIdx = 1;
    }

    // Cycle alerts
    const enrollments = results[nextIdx].data;
    if (enrollments && enrollments.length > 0) {
      const enrollIds = enrollments.map((e: any) => e.id);
      const enrollMap: Record<string, string> = {};
      enrollments.forEach((e: any) => { enrollMap[e.id] = e.students?.full_name || "—"; });

      const { data: allCycles } = await supabase
        .from("training_cycles").select("*")
        .in("enrollment_id", enrollIds).in("status", ["active"]);

      const activeCycleIds: string[] = [];

      (allCycles || []).forEach((c: any) => {
        activeCycleIds.push(c.id);
      });

      if (activeCycleIds.length > 0) {
        const { data: workouts } = await supabase.from("workouts").select("cycle_id").in("cycle_id", activeCycleIds);
        const cyclesWithWorkout = new Set((workouts || []).map((w: any) => w.cycle_id));
        const missing: MissingWorkout[] = [];
        (allCycles || []).forEach((c: any) => {
          if (!cyclesWithWorkout.has(c.id)) {
            missing.push({ student_name: enrollMap[c.enrollment_id], cycle_number: c.cycle_number, cycle_id: c.id, start_date: c.start_date, end_date: c.end_date });
          }
        });
        // Keep only the first pending cycle per student (lowest cycle_number)
        const firstPerStudent = new Map<string, MissingWorkout>();
        missing.forEach((m) => {
          const key = m.student_name + "_" + m.cycle_id.substring(0, 8); // use student_name as grouping key
          const existing = firstPerStudent.get(m.student_name);
          if (!existing || m.cycle_number < existing.cycle_number) {
            firstPerStudent.set(m.student_name, m);
          }
        });
        // Sort by start_date (most urgent first)
        const sorted = Array.from(firstPerStudent.values())
          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
        setMissingWorkouts(sorted);
      }
    }
  };

  const hasContent = birthdays.length > 0 || missingWorkouts.length > 0 || awaitingTrainer.length > 0 || awaitingTrainingDate.length > 0 || missingEnrollment.length > 0;
  if (!hasContent) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {awaitingTrainingDate.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-primary text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />DEFINIR DATA DE TREINO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-auto">
              {awaitingTrainingDate.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-warning/5 border border-warning/20">
                  <p className="text-sm font-sans text-foreground">{a.student_name}</p>
                  <span className="text-xs font-sans font-medium px-2 py-0.5 rounded bg-warning/20 text-warning">Sem data</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {awaitingTrainer.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-primary text-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5" />AGUARDANDO TREINADOR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-auto">
              {awaitingTrainer.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-warning/5 border border-warning/20">
                  <p className="text-sm font-sans text-foreground">{a.student_name}</p>
                  <span className="text-xs font-sans font-medium px-2 py-0.5 rounded bg-warning/20 text-warning">Sem treinador</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {missingEnrollment.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-destructive text-lg flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />SEM MATRÍCULA ATIVA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-auto">
              {missingEnrollment.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-sans text-foreground">{m.student_name}</p>
                  <span className="text-xs font-sans font-medium px-2 py-0.5 rounded bg-destructive/20 text-destructive">Pendente</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {birthdays.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-primary text-lg flex items-center gap-2">
              <Cake className="h-5 w-5" />ANIVERSÁRIOS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-auto">
              {birthdays.map((b, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm font-sans text-foreground">{b.full_name}</p>
                  <span className={`text-xs font-sans font-medium px-2 py-0.5 rounded ${b.daysUntil === 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {b.daysUntil === 0 ? "🎉 Hoje!" : `em ${b.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {missingWorkouts.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-primary text-lg flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />SEM TREINO NO CICLO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-auto">
              {missingWorkouts.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div>
                    <p className="text-sm font-sans text-foreground">{m.student_name}</p>
                    <p className="text-xs text-muted-foreground font-sans">Ciclo {m.cycle_number} — {new Date(m.start_date).toLocaleDateString("pt-BR")} a {new Date(m.end_date).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-xs font-sans font-medium px-2 py-0.5 rounded bg-destructive/20 text-destructive">Sem treino</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
