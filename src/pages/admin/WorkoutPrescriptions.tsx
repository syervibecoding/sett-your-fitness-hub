import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, Dumbbell, ChevronRight, Calendar, Plus, Edit, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkoutSummary {
  id: string;
  title: string;
  exerciseCount: number;
}

interface CycleSummary {
  id: string;
  cycle_number: number;
  start_date: string;
  end_date: string;
  status: string;
  workouts: WorkoutSummary[];
}

interface StudentWithCycles {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
  plan_name: string | null;
  enrollment_id: string | null;
  cycles: CycleSummary[];
}

const WORKOUT_LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Ativo", dot: "bg-success", text: "text-success" },
  completed: { label: "Concluído", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  future: { label: "Futuro", dot: "bg-warning", text: "text-warning" },
};

export default function WorkoutPrescriptions() {
  const { role, companyId } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const navigate = useNavigate();
  const effectiveCompanyId = (role === "master" && isViewingCompany) ? viewingCompany?.id : companyId;

  const [students, setStudents] = useState<StudentWithCycles[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithCycles | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const prefix = (role === "master" && isViewingCompany) ? "/admin" : `/${role}`;

  useEffect(() => {
    if (effectiveCompanyId) loadStudents();
  }, [effectiveCompanyId]);

  const loadStudents = async () => {
    setLoading(true);

    // Get students with active enrollments
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, full_name, email, status")
      .eq("company_id", effectiveCompanyId!)
      .order("full_name");

    if (!studentsData || studentsData.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    // Get active enrollments for these students
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("id, student_id, plan_id, plans(name)")
      .eq("company_id", effectiveCompanyId!)
      .eq("status", "active");

    // Get all training cycles
    const enrollmentIds = enrollments?.map(e => e.id) || [];
    let cyclesData: any[] = [];
    if (enrollmentIds.length > 0) {
      const { data } = await supabase
        .from("training_cycles")
        .select("id, enrollment_id, cycle_number, start_date, end_date, status")
        .in("enrollment_id", enrollmentIds)
        .order("cycle_number");
      cyclesData = data || [];
    }

    // Get all workouts for these cycles
    const cycleIds = cyclesData.map(c => c.id);
    let workoutsData: any[] = [];
    if (cycleIds.length > 0) {
      const { data } = await supabase
        .from("workouts")
        .select("id, title, exercises, cycle_id")
        .in("cycle_id", cycleIds);
      workoutsData = data || [];
    }

    // Map everything together
    const result: StudentWithCycles[] = studentsData.map(s => {
      const enrollment = enrollments?.find(e => e.student_id === s.id);
      const studentCycles = cyclesData
        .filter(c => c.enrollment_id === enrollment?.id)
        .map(c => {
          const cycleWorkouts = workoutsData
            .filter(w => w.cycle_id === c.id)
            .map(w => ({
              id: w.id,
              title: w.title,
              exerciseCount: Array.isArray(w.exercises) ? w.exercises.length : 0,
            }));
          return {
            id: c.id,
            cycle_number: c.cycle_number,
            start_date: c.start_date,
            end_date: c.end_date,
            status: c.status,
            workouts: cycleWorkouts,
          };
        });

      return {
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        status: s.status,
        plan_name: (enrollment?.plans as any)?.name || null,
        enrollment_id: enrollment?.id || null,
        cycles: studentCycles,
      };
    });

    // Only show students with active enrollments
    const withEnrollments = result.filter(s => s.enrollment_id);
    setStudents(withEnrollments);
    setLoading(false);
  };

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalWorkouts = (s: StudentWithCycles) =>
    s.cycles.reduce((sum, c) => sum + c.workouts.length, 0);

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Page header */}
      <header className="space-y-2 border-b border-line pb-6">
        <span className="text-eyebrow flex items-center gap-2">
          <Dumbbell className="h-3.5 w-3.5" />
          Prescrição
        </span>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          Prescrição de <span className="font-display italic text-primary">Treinos</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-prose">
          Selecione um aluno para visualizar seus ciclos e prescrever ou ajustar os treinos.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Student list */}
        <aside className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-line"
            />
          </div>

          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2 pr-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
                ))
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Users className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {search ? "Nenhum aluno encontrado" : "Nenhum aluno com matrícula ativa"}
                  </p>
                </div>
              ) : (
                filtered.map(student => {
                  const isSelected = selectedStudent?.id === student.id;
                  const count = totalWorkouts(student);
                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className={`group relative w-full overflow-hidden rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-secondary"
                          : "border-line bg-card hover:border-primary/40 hover:bg-secondary/40"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-0 h-full w-1 transition-colors ${
                          isSelected ? "bg-primary" : "bg-transparent"
                        }`}
                      />
                      <div className="flex items-center justify-between gap-3 p-3 pl-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">
                            {student.full_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono-data uppercase tracking-wide truncate mt-0.5">
                            {student.plan_name || "Sem plano"} · {count} treino{count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 flex-shrink-0 transition-transform ${
                            isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/50"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Student detail */}
        <section className="lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-6">
              {/* Student header */}
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
                <div>
                  <span className="text-eyebrow">{selectedStudent.plan_name || "Sem plano"}</span>
                  <h2 className="text-2xl font-semibold text-foreground tracking-tight mt-1">
                    {selectedStudent.full_name}
                  </h2>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-mono-data text-primary leading-none">
                      {selectedStudent.cycles.length}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono-data uppercase tracking-wide mt-1">
                      Ciclos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-mono-data text-primary leading-none">
                      {totalWorkouts(selectedStudent)}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono-data uppercase tracking-wide mt-1">
                      Treinos
                    </p>
                  </div>
                </div>
              </div>

              {selectedStudent.cycles.length === 0 ? (
                <Card className="bg-card border-line border-dashed">
                  <CardContent className="p-10 text-center">
                    <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-foreground font-medium">Nenhum ciclo de treino criado</p>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                      Defina a data de início do treino na matrícula do aluno para gerar o primeiro ciclo.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {selectedStudent.cycles.map(cycle => {
                    const status = statusConfig[cycle.status] || statusConfig.future;
                    const hasWorkouts = cycle.workouts.length > 0;
                    return (
                      <Card key={cycle.id} className="bg-card border-line overflow-hidden">
                        <CardContent className="p-0">
                          {/* Cycle header */}
                          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line bg-secondary/30">
                            <div className="flex items-center gap-3">
                              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                              <h3 className="font-semibold text-foreground text-sm">
                                Ciclo {String(cycle.cycle_number).padStart(2, "0")}
                              </h3>
                              <span className={`text-[11px] font-mono-data uppercase tracking-wide ${status.text}`}>
                                {status.label}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono-data">
                              {format(parseISO(cycle.start_date), "dd/MM", { locale: ptBR })} — {format(parseISO(cycle.end_date), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          </div>

                          {/* Workouts */}
                          <div className="p-5 space-y-4">
                            {hasWorkouts ? (
                              <div className="space-y-1.5">
                                {cycle.workouts.map((w, i) => (
                                  <div
                                    key={w.id}
                                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-secondary/50"
                                  >
                                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold font-mono-data">
                                      {WORKOUT_LETTERS[i] || i + 1}
                                    </span>
                                    <span className="text-sm text-foreground flex-1 truncate">{w.title}</span>
                                    <span className="text-[11px] text-muted-foreground font-mono-data whitespace-nowrap">
                                      {w.exerciseCount} ex.
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground py-1">
                                <Clock className="h-4 w-4" />
                                <span className="text-sm">Nenhum treino prescrito</span>
                              </div>
                            )}

                            <Button
                              size="sm"
                              variant={hasWorkouts ? "outline" : "default"}
                              onClick={() => navigate(`${prefix}/workout/${cycle.id}`)}
                              className="w-full sm:w-auto"
                            >
                              {hasWorkouts ? (
                                <><Edit className="h-3.5 w-3.5 mr-1.5" />Editar treinos</>
                              ) : (
                                <><Plus className="h-3.5 w-3.5 mr-1.5" />Prescrever treino</>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] rounded-lg border border-dashed border-line bg-card/50">
              <div className="text-center px-6">
                <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-foreground font-medium">Selecione um aluno</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os ciclos e treinos aparecerão aqui.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
