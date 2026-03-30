import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dumbbell, Play, Clock, RotateCcw, ChevronDown, ChevronUp, Timer, CheckCircle2, Circle, Loader2, LogOut, TrendingUp, Save, CalendarDays, History } from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  video_url: string | null;
  video_path: string | null;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
}

interface WorkoutData {
  id: string;
  title: string;
  description: string | null;
  exercises: WorkoutExercise[];
}

interface Cycle {
  id: string;
  cycle_number: number;
  start_date: string;
  end_date: string;
  status: string;
  workouts: WorkoutData[];
}

interface WorkoutLog {
  id?: string;
  workout_id: string;
  exercise_index: number;
  set_number: number;
  weight: number;
  reps_done: number;
  session_date?: string;
}

export default function StudentPortal() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<{ type: "path" | "url"; value: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<string, WorkoutLog>>({});
  const [previousLogs, setPreviousLogs] = useState<Record<string, WorkoutLog>>({});
  const [savingLogs, setSavingLogs] = useState(false);
  const [enrollmentInfo, setEnrollmentInfo] = useState<{ plan_name: string; start_date: string; end_date: string } | null>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);

  const selectedWorkout = selectedCycle?.workouts.find(w => w.id === selectedWorkoutId) || selectedCycle?.workouts[0] || null;
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (user) loadStudentData();
  }, [user]);

  const loadStudentData = async () => {
    const { data: student } = await supabase
      .from("students")
      .select("id, full_name, company_id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!student) { setLoading(false); return; }
    setStudentId(student.id);
    setStudentName(student.full_name);
    setCompanyId(student.company_id);

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id, start_date, end_date, plan_id, plans(name)")
      .eq("student_id", student.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollment) {
      setEnrollmentInfo({
        plan_name: (enrollment.plans as any)?.name || "Plano",
        start_date: enrollment.start_date,
        end_date: enrollment.end_date,
      });

      const { data: cyclesData } = await supabase
        .from("training_cycles")
        .select("id, cycle_number, start_date, end_date, status")
        .eq("enrollment_id", enrollment.id)
        .order("cycle_number");

      if (cyclesData && cyclesData.length > 0) {
        const { data: workoutsData } = await supabase
          .from("workouts")
          .select("id, title, description, exercises, cycle_id")
          .in("cycle_id", cyclesData.map((c) => c.id));

        // Collect exercise_ids for video enrichment
        const exerciseIds = new Set<string>();
        (workoutsData || []).forEach(w => {
          const exs = (w.exercises as unknown as WorkoutExercise[]) || [];
          exs.forEach(ex => { if (ex.exercise_id) exerciseIds.add(ex.exercise_id); });
        });

        // Fetch video data from exercise library
        let videoMap: Record<string, { video_url: string | null; video_path: string | null }> = {};
        if (exerciseIds.size > 0) {
          const { data: libraryData } = await supabase
            .from("exercise_library")
            .select("id, video_url, video_path")
            .in("id", Array.from(exerciseIds));
          if (libraryData) {
            libraryData.forEach(lib => {
              videoMap[lib.id] = { video_url: lib.video_url, video_path: lib.video_path };
            });
          }
        }

        const enriched: Cycle[] = cyclesData.map((c) => {
          const cycleWorkouts = (workoutsData || [])
            .filter((w) => w.cycle_id === c.id)
            .map((w) => ({
              id: w.id,
              title: w.title,
              description: w.description,
              exercises: ((w.exercises as unknown as WorkoutExercise[]) || []).map(ex => ({
                ...ex,
                video_url: (ex.video_url && ex.video_url.trim()) || videoMap[ex.exercise_id]?.video_url || null,
                video_path: (ex.video_path && ex.video_path.trim()) || videoMap[ex.exercise_id]?.video_path || null,
              })),
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
          return { ...c, workouts: cycleWorkouts };
        });
        setCycles(enriched);

        const today = new Date();
        const activeCycle = enriched.find((c) => {
          try { return isWithinInterval(today, { start: parseISO(c.start_date), end: parseISO(c.end_date) }); }
          catch { return false; }
        });
        const chosen = activeCycle || enriched[0];
        setSelectedCycle(chosen);
        if (chosen.workouts.length > 0) setSelectedWorkoutId(chosen.workouts[0].id);

        // Load existing logs
        const workoutIds = workoutsData?.map((w) => w.id) || [];
        if (workoutIds.length > 0) {
          const { data: logsData } = await supabase
            .from("workout_logs")
            .select("*")
            .eq("student_id", student.id)
            .in("workout_id", workoutIds);

          if (logsData) {
            setAllLogs(logsData);

            // Today's logs → editable fields
            const todayLogMap: Record<string, WorkoutLog> = {};
            // Previous session logs → reference display
            const prevLogMap: Record<string, WorkoutLog> = {};

            // Group by workout+exercise+set, then separate today vs most recent previous
            const grouped: Record<string, any[]> = {};
            logsData.forEach((l: any) => {
              const key = `${l.workout_id}-${l.exercise_index}-${l.set_number}`;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(l);
            });

            Object.entries(grouped).forEach(([key, entries]) => {
              // Sort by session_date desc
              entries.sort((a, b) => (b.session_date || b.logged_at || "").localeCompare(a.session_date || a.logged_at || ""));

              const todayEntry = entries.find(e => e.session_date === todayStr);
              if (todayEntry) {
                todayLogMap[key] = todayEntry;
              }

              // Find most recent entry that is NOT today
              const prevEntry = entries.find(e => e.session_date !== todayStr);
              if (prevEntry) {
                prevLogMap[key] = prevEntry;
              }
            });

            setLogs(todayLogMap);
            setPreviousLogs(prevLogMap);
          }
        }
      }
    }
    setLoading(false);
  };

  const getLogKey = (workoutId: string, exIdx: number, setNum: number) =>
    `${workoutId}-${exIdx}-${setNum}`;

  const updateLog = (workoutId: string, exIdx: number, setNum: number, field: "weight" | "reps_done", value: number) => {
    const key = getLogKey(workoutId, exIdx, setNum);
    setLogs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        workout_id: workoutId,
        exercise_index: exIdx,
        set_number: setNum,
        weight: prev[key]?.weight || 0,
        reps_done: prev[key]?.reps_done || 0,
        [field]: value,
      },
    }));
  };

  const saveCurrentLogs = async () => {
    if (!selectedWorkout || !studentId) return;
    setSavingLogs(true);

    const workoutId = selectedWorkout.id;
    const logsToSave = Object.values(logs).filter((l) => l.workout_id === workoutId && (l.weight > 0 || l.reps_done > 0));

    for (const log of logsToSave) {
      // Check for existing log TODAY
      const existing = allLogs.find(
        (l) => l.workout_id === log.workout_id && l.exercise_index === log.exercise_index && l.set_number === log.set_number && l.session_date === todayStr
      );
      if (existing) {
        await supabase.from("workout_logs").update({ weight: log.weight, reps_done: log.reps_done }).eq("id", existing.id);
      } else {
        await supabase.from("workout_logs").insert({
          workout_id: log.workout_id, exercise_index: log.exercise_index,
          set_number: log.set_number, weight: log.weight, reps_done: log.reps_done,
          student_id: studentId, company_id: companyId, session_date: todayStr,
        });
      }
    }

    toast({ title: "Cargas salvas!" });
    setSavingLogs(false);
  };

  const getStoragePublicUrl = (path: string) => {
    const { data } = supabase.storage.from("exercises-videos").getPublicUrl(path);
    return data.publicUrl;
  };

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com/watch")) {
      const vid = new URL(url).searchParams.get("v");
      return vid ? `https://www.youtube.com/embed/${vid}` : url;
    }
    if (url.includes("youtu.be/")) {
      const vid = url.split("youtu.be/")[1]?.split("?")[0];
      return vid ? `https://www.youtube.com/embed/${vid}` : url;
    }
    return url;
  };

  const openVideoForExercise = (ex: WorkoutExercise) => {
    if (ex.video_path) setVideoModal({ type: "path", value: getStoragePublicUrl(ex.video_path) });
    else if (ex.video_url) setVideoModal({ type: "url", value: ex.video_url });
  };

  const getOverallProgress = () => {
    if (!enrollmentInfo) return 0;
    const today = new Date();
    const start = parseISO(enrollmentInfo.start_date);
    const end = parseISO(enrollmentInfo.end_date);
    const total = differenceInDays(end, start);
    const elapsed = differenceInDays(today, start);
    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  };

  const getCycleProgress = (cycle: Cycle) => {
    const today = new Date();
    const start = parseISO(cycle.start_date);
    const end = parseISO(cycle.end_date);
    const total = differenceInDays(end, start);
    const elapsed = differenceInDays(today, start);
    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  };

  const getWorkoutLabel = (index: number) => String.fromCharCode(65 + index);

  const getEvolutionData = () => {
    if (!selectedWorkout) return [];
    return cycles
      .filter((c) => c.workouts.length > 0)
      .map((c) => {
        const cycleData: any = { name: `C${c.cycle_number}` };
        c.workouts.forEach(w => {
          w.exercises.forEach((ex, idx) => {
            const logsForEx = allLogs.filter(
              (l) => l.workout_id === w.id && l.exercise_index === idx
            );
            const maxWeight = logsForEx.reduce((max, l) => Math.max(max, Number(l.weight) || 0), 0);
            if (maxWeight > 0) cycleData[ex.exercise_name] = maxWeight;
          });
        });
        return cycleData;
      });
  };

  const getVolumeData = () => {
    return cycles
      .filter((c) => c.workouts.length > 0)
      .map((c) => {
        const cycleData: any = { name: `C${c.cycle_number}` };
        let totalTonnage = 0;
        c.workouts.forEach(w => {
          w.exercises.forEach((ex, idx) => {
            const logsForEx = allLogs.filter(
              (l) => l.workout_id === w.id && l.exercise_index === idx
            );
            const tonnage = logsForEx.reduce((sum, l) => sum + (Number(l.weight) || 0) * (Number(l.reps_done) || 0), 0);
            totalTonnage += tonnage;
            const group = ex.muscle_group;
            cycleData[group] = (cycleData[group] || 0) + tonnage;
          });
        });
        cycleData.total = totalTonnage;
        return cycleData;
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground font-sans">Nenhum perfil de aluno vinculado à sua conta.</p>
          <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
        </div>
      </div>
    );
  }

  const evolutionData = getEvolutionData();
  const volumeData = getVolumeData();
  const exerciseColors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-5 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Dumbbell className="h-6 w-6 text-primary" />
              <h1 className="text-2xl text-primary font-bold tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                MEU TREINO
              </h1>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-foreground font-sans text-lg">{studentName}</p>
          {enrollmentInfo && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-sans">{enrollmentInfo.plan_name}</span>
                <span className="text-muted-foreground font-sans">
                  {format(parseISO(enrollmentInfo.start_date), "dd/MM/yy")} — {format(parseISO(enrollmentInfo.end_date), "dd/MM/yy")}
                </span>
              </div>
              <Progress value={getOverallProgress()} className="h-2" />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="treino" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="treino" className="font-sans">Treino</TabsTrigger>
            <TabsTrigger value="evolucao" className="font-sans">Evolução</TabsTrigger>
          </TabsList>

          {/* TREINO TAB */}
          <TabsContent value="treino" className="space-y-6">
            {/* Cycle selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {cycles.map((cycle) => {
                const isActive = selectedCycle?.id === cycle.id;
                const isCurrent = (() => {
                  try { return isWithinInterval(new Date(), { start: parseISO(cycle.start_date), end: parseISO(cycle.end_date) }); }
                  catch { return false; }
                })();
                return (
                  <button key={cycle.id} onClick={() => {
                    setSelectedCycle(cycle);
                    setSelectedWorkoutId(cycle.workouts[0]?.id || null);
                    setExpandedExercise(null);
                  }}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-all font-sans ${
                      isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                    }`}>
                    <span className="text-xs font-medium">Ciclo {cycle.cycle_number}</span>
                    {cycle.workouts.length > 0 ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                    {isCurrent && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">Atual</Badge>}
                  </button>
                );
              })}
            </div>

            {/* Selected cycle */}
            {selectedCycle && (
              <div className="space-y-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-primary font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>CICLO {selectedCycle.cycle_number}</h3>
                      <span className="text-xs text-muted-foreground font-sans">
                        {format(parseISO(selectedCycle.start_date), "dd/MM", { locale: ptBR })} — {format(parseISO(selectedCycle.end_date), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    <Progress value={getCycleProgress(selectedCycle)} className="h-1.5" />
                  </CardContent>
                </Card>

                {selectedCycle.workouts.length > 0 ? (
                  <div className="space-y-3">
                    {/* Workout tabs (A, B, C...) */}
                    {selectedCycle.workouts.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {selectedCycle.workouts.map((w, i) => (
                          <button
                            key={w.id}
                            onClick={() => { setSelectedWorkoutId(w.id); setExpandedExercise(null); }}
                            className={`flex-shrink-0 px-4 py-2 rounded-md text-sm font-sans font-medium transition-all ${
                              selectedWorkoutId === w.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            }`}
                          >
                            Treino {getWorkoutLabel(i)}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedWorkout && (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg text-foreground font-sans font-semibold">{selectedWorkout.title}</h3>
                          <Button size="sm" onClick={saveCurrentLogs} disabled={savingLogs}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {savingLogs ? "Salvando..." : "Salvar Cargas"}
                          </Button>
                        </div>

                        {/* Session badge + counter */}
                        {(() => {
                          const workoutId = selectedWorkout.id;
                          const sessionDates = [...new Set(allLogs.filter(l => l.workout_id === workoutId).map(l => l.session_date))].sort();
                          const sessionCount = sessionDates.length;
                          const isNewSession = !sessionDates.includes(todayStr);
                          const totalSessions = isNewSession ? sessionCount + 1 : sessionCount;
                          return (
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="outline" className="gap-1.5 text-xs font-sans border-primary/30 text-primary">
                                <CalendarDays className="h-3 w-3" />
                                Sessão de hoje: {format(new Date(), "dd/MM/yyyy")}
                              </Badge>
                              {sessionCount > 0 && (
                                <Badge variant="secondary" className="gap-1.5 text-xs font-sans">
                                  <History className="h-3 w-3" />
                                  {totalSessions}ª sessão deste treino
                                </Badge>
                              )}
                            </div>
                          );
                        })()}

                        <div className="space-y-2">
                          {selectedWorkout.exercises.map((ex, idx) => {
                            const isExpanded = expandedExercise === idx;
                            const numSets = parseInt(ex.sets) || 3;
                            const workoutId = selectedWorkout.id;

                            // Get history for this exercise (last 5 sessions, excluding today)
                            const exLogs = allLogs.filter(l => l.workout_id === workoutId && l.exercise_index === idx && l.session_date !== todayStr);
                            const byDate: Record<string, { weight: number; reps_done: number; set_number: number }[]> = {};
                            exLogs.forEach(l => {
                              if (!byDate[l.session_date]) byDate[l.session_date] = [];
                              byDate[l.session_date].push({ weight: l.weight, reps_done: l.reps_done, set_number: l.set_number });
                            });
                            const exerciseHistory = Object.entries(byDate)
                              .sort(([a], [b]) => b.localeCompare(a))
                              .slice(0, 5)
                              .map(([date, sets]) => ({
                                date,
                                sets: sets.sort((a, b) => a.set_number - b.set_number),
                              }));

                            return (
                              <Card key={idx} className="bg-card border-border overflow-hidden">
                                <CardContent className="p-0">
                                  <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedExercise(isExpanded ? null : idx)}>
                                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold font-sans flex-shrink-0">
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-sans font-medium text-foreground text-sm truncate">{ex.exercise_name}</p>
                                      <p className="text-xs text-muted-foreground font-sans">{ex.sets}×{ex.reps} · {ex.rest}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {(ex.video_path || ex.video_url) && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openVideoForExercise(ex); }}>
                                          <Play className="h-4 w-4 text-primary" />
                                        </Button>
                                      )}
                                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="border-t border-border px-3 py-3 bg-secondary/30 space-y-3">
                                      {ex.notes && (
                                        <p className="text-xs text-muted-foreground font-sans whitespace-pre-wrap break-words"><span className="font-medium text-foreground">Obs:</span> {ex.notes}</p>
                                      )}
                                      <div className="space-y-1">
                                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-sans font-medium">
                                          <span>Série</span>
                                          <span>Peso (kg)</span>
                                          <span>Reps</span>
                                        </div>
                                        {Array.from({ length: numSets }, (_, s) => {
                                          const key = getLogKey(workoutId, idx, s + 1);
                                          const log = logs[key];
                                          const prev = previousLogs[key];
                                          return (
                                            <div key={s} className="space-y-0.5">
                                              <div className="grid grid-cols-3 gap-2 items-center">
                                                <span className="text-sm font-sans text-foreground font-medium">{s + 1}ª</span>
                                                <Input
                                                  type="number"
                                                  inputMode="decimal"
                                                  className="h-8 text-sm bg-card border-border"
                                                  placeholder="0"
                                                  value={log?.weight || ""}
                                                  onChange={(e) => updateLog(workoutId, idx, s + 1, "weight", parseFloat(e.target.value) || 0)}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                                <Input
                                                  type="number"
                                                  inputMode="numeric"
                                                  className="h-8 text-sm bg-card border-border"
                                                  placeholder={ex.reps}
                                                  value={log?.reps_done || ""}
                                                  onChange={(e) => updateLog(workoutId, idx, s + 1, "reps_done", parseInt(e.target.value) || 0)}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              </div>
                                              {prev && (prev.weight > 0 || prev.reps_done > 0) && (
                                                <p className="text-[10px] text-muted-foreground font-sans pl-0 col-span-3 ml-[calc(33.333%+0.25rem)]">
                                                  Última: {prev.weight}kg × {prev.reps_done}
                                                </p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Mini-history */}
                                      {exerciseHistory.length > 0 && (
                                        <Collapsible>
                                          <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground font-sans gap-1.5 h-7" onClick={(e) => e.stopPropagation()}>
                                              <History className="h-3 w-3" />
                                              Ver histórico ({exerciseHistory.length} sessões)
                                            </Button>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="mt-2 space-y-1.5">
                                            {exerciseHistory.map(({ date, sets }) => (
                                              <div key={date} className="flex items-start gap-2 text-[11px] font-sans text-muted-foreground">
                                                <span className="font-medium text-foreground/70 min-w-[40px]">
                                                  {format(parseISO(date), "dd/MM")}
                                                </span>
                                                <span className="flex-1">
                                                  {sets.map(s => `${s.weight}kg×${s.reps_done}`).join(", ")}
                                                </span>
                                              </div>
                                            ))}
                                          </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>

                        <Button className="w-full" onClick={saveCurrentLogs} disabled={savingLogs}>
                          <Save className="h-4 w-4 mr-2" />
                          {savingLogs ? "Salvando..." : "Salvar Todas as Cargas"}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <Card className="bg-card border-border border-dashed">
                    <CardContent className="p-8 text-center">
                      <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground font-sans">Treino ainda não prescrito para este ciclo.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* EVOLUÇÃO TAB */}
          <TabsContent value="evolucao" className="space-y-6">
            {evolutionData.length > 0 ? (
              <>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolução de Carga (kg)</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolutionData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                          {selectedWorkout?.exercises.slice(0, 5).map((ex, i) => (
                            <Line key={ex.exercise_name} type="monotone" dataKey={ex.exercise_name} stroke={exerciseColors[i % exerciseColors.length]} strokeWidth={2} dot={{ r: 4 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-4">Tonelagem por Ciclo (kg)</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={volumeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-card border-border border-dashed">
                <CardContent className="p-8 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-sans">Registre suas cargas para ver a evolução.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Video Modal */}
      <Dialog open={!!videoModal} onOpenChange={() => setVideoModal(null)}>
        <DialogContent className="bg-card border-border max-w-lg sm:max-w-2xl p-2 sm:p-4">
          <DialogHeader>
            <DialogTitle className="text-primary text-sm">DEMONSTRAÇÃO</DialogTitle>
          </DialogHeader>
          {videoModal && (
            <div className="aspect-video w-full">
              {videoModal.type === "path" ? (
                <video src={videoModal.value} controls className="w-full h-full rounded-md" />
              ) : (
                <iframe src={getEmbedUrl(videoModal.value)} className="w-full h-full rounded-md" allowFullScreen />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
