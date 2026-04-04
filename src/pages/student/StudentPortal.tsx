import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Play, Clock, CheckCircle2, Circle, Loader2, LogOut, Save, CalendarDays, History, BarChart3 } from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { WorkoutTimer } from "@/components/student/WorkoutTimer";
import { WorkoutSummary } from "@/components/student/WorkoutSummary";
import { ExerciseCard } from "@/components/student/ExerciseCard";
import { StatsCharts } from "@/components/student/StatsCharts";
import { useRestTimer } from "@/components/student/RestTimer";
import { WeeklyBar } from "@/components/student/WeeklyBar";

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
  day_of_week: number | null;
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
  set_type?: string;
  rpe?: number;
  completed?: boolean;
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
  const [extraSets, setExtraSets] = useState<Record<number, number>>({}); // exIdx -> extra sets count

  const selectedWorkout = selectedCycle?.workouts.find(w => w.id === selectedWorkoutId) || selectedCycle?.workouts[0] || null;
  const todayStr = new Date().toISOString().split("T")[0];

  const session = useWorkoutSession(studentId, companyId);
  const { activeRest, startRest, clearRest } = useRestTimer();

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
          .select("id, title, description, exercises, cycle_id, day_of_week")
          .in("cycle_id", cyclesData.map(c => c.id));

        const exerciseIds = new Set<string>();
        (workoutsData || []).forEach(w => {
          const exs = (w.exercises as unknown as WorkoutExercise[]) || [];
          exs.forEach(ex => { if (ex.exercise_id) exerciseIds.add(ex.exercise_id); });
        });

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

        const enriched: Cycle[] = cyclesData.map(c => {
          const cycleWorkouts = (workoutsData || [])
            .filter(w => w.cycle_id === c.id)
            .map(w => ({
              id: w.id,
              title: w.title,
              description: w.description,
              day_of_week: (w as any).day_of_week as number | null,
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
        const activeCycle = enriched.find(c => {
          try { return isWithinInterval(today, { start: parseISO(c.start_date), end: parseISO(c.end_date) }); }
          catch { return false; }
        });
        const chosen = activeCycle || enriched[0];
        setSelectedCycle(chosen);
        // Auto-select today's workout based on day_of_week
        const todayDow = new Date().getDay();
        const todaysWorkout = chosen.workouts.find(w => w.day_of_week === todayDow);
        if (todaysWorkout) {
          setSelectedWorkoutId(todaysWorkout.id);
        } else if (chosen.workouts.length > 0) {
          setSelectedWorkoutId(chosen.workouts[0].id);
        }

        // Load logs
        const workoutIds = workoutsData?.map(w => w.id) || [];
        if (workoutIds.length > 0) {
          const { data: logsData } = await supabase
            .from("workout_logs")
            .select("*")
            .eq("student_id", student.id)
            .in("workout_id", workoutIds);

          if (logsData) {
            setAllLogs(logsData);
            const todayLogMap: Record<string, WorkoutLog> = {};
            const prevLogMap: Record<string, WorkoutLog> = {};
            const grouped: Record<string, any[]> = {};

            logsData.forEach((l: any) => {
              const key = `${l.workout_id}-${l.exercise_index}-${l.set_number}`;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(l);
            });

            Object.entries(grouped).forEach(([key, entries]) => {
              entries.sort((a, b) => (b.session_date || "").localeCompare(a.session_date || ""));
              const todayEntry = entries.find(e => e.session_date === todayStr);
              if (todayEntry) todayLogMap[key] = todayEntry;
              const prevEntry = entries.find(e => e.session_date !== todayStr);
              if (prevEntry) prevLogMap[key] = prevEntry;
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

  const updateLog = (exIdx: number, setNum: number, field: string, value: number | string | boolean) => {
    if (!selectedWorkout) return;
    const workoutId = selectedWorkout.id;
    const key = getLogKey(workoutId, exIdx, setNum);
    setLogs(prev => ({
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

  const getTotalSets = (exIdx: number) => {
    const baseSets = parseInt(selectedWorkout?.exercises[exIdx]?.sets || "3") || 3;
    return baseSets + (extraSets[exIdx] || 0);
  };

  const handleAddSet = (exIdx: number) => {
    setExtraSets(prev => ({ ...prev, [exIdx]: (prev[exIdx] || 0) + 1 }));
  };

  const handleRemoveSet = (exIdx: number, setNum: number) => {
    if (!selectedWorkout) return;
    const workoutId = selectedWorkout.id;
    const total = getTotalSets(exIdx);
    if (total <= 1) return;

    // Remove the log for this set and shift subsequent sets down
    setLogs(prev => {
      const newLogs = { ...prev };
      delete newLogs[getLogKey(workoutId, exIdx, setNum)];
      // Shift sets above the removed one
      for (let s = setNum + 1; s <= total; s++) {
        const oldKey = getLogKey(workoutId, exIdx, s);
        const newKey = getLogKey(workoutId, exIdx, s - 1);
        if (newLogs[oldKey]) {
          newLogs[newKey] = { ...newLogs[oldKey], set_number: s - 1 };
          delete newLogs[oldKey];
        }
      }
      return newLogs;
    });

    const baseSets = parseInt(selectedWorkout.exercises[exIdx]?.sets || "3") || 3;
    const currentExtra = extraSets[exIdx] || 0;
    if (currentExtra > 0) {
      setExtraSets(prev => ({ ...prev, [exIdx]: currentExtra - 1 }));
    }
  };

  const saveCurrentLogs = async () => {
    if (!selectedWorkout || !studentId) return;
    setSavingLogs(true);
    const workoutId = selectedWorkout.id;
    const logsToSave = Object.values(logs).filter(l => l.workout_id === workoutId && (l.weight > 0 || l.reps_done > 0));

    for (const log of logsToSave) {
      const existing = allLogs.find(
        l => l.workout_id === log.workout_id && l.exercise_index === log.exercise_index && l.set_number === log.set_number && l.session_date === todayStr
      );
      const payload = {
        weight: log.weight,
        reps_done: log.reps_done,
        set_type: log.set_type || 'normal',
        rpe: log.rpe || null,
        completed: log.completed || false,
      };
      if (existing) {
        await supabase.from("workout_logs").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("workout_logs").insert({
          workout_id: log.workout_id, exercise_index: log.exercise_index,
          set_number: log.set_number, ...payload,
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

  const handleStartSession = async () => {
    if (!selectedWorkout) return;
    await session.startSession(selectedWorkout.id);
    toast({ title: "Treino iniciado!", description: "O cronômetro está rodando." });
  };

  const handleFinishSession = async () => {
    if (!selectedWorkout) return;
    await saveCurrentLogs();

    // Calculate previous best weights for PR detection
    const previousBestWeights: Record<string, number> = {};
    selectedWorkout.exercises.forEach((ex, idx) => {
      const exLogs = allLogs.filter((l: any) => l.workout_id === selectedWorkout.id && l.exercise_index === idx && l.session_date !== todayStr);
      const maxW = exLogs.reduce((max: number, l: any) => Math.max(max, Number(l.weight) || 0), 0);
      previousBestWeights[`ex-${idx}`] = maxW;
    });

    await session.finishSession(logs, selectedWorkout.exercises, previousBestWeights);
  };

  const handleAbandonSession = async () => {
    await session.abandonSession();
    toast({ title: "Treino abandonado" });
  };

  const getExerciseHistory = (workoutId: string, idx: number) => {
    const exLogs = allLogs.filter((l: any) => l.workout_id === workoutId && l.exercise_index === idx && l.session_date !== todayStr);
    const byDate: Record<string, { weight: number; reps_done: number; set_number: number }[]> = {};
    exLogs.forEach((l: any) => {
      if (!byDate[l.session_date]) byDate[l.session_date] = [];
      byDate[l.session_date].push({ weight: l.weight, reps_done: l.reps_done, set_number: l.set_number });
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 5)
      .map(([date, sets]) => ({ date, sets: sets.sort((a, b) => a.set_number - b.set_number) }));
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

  const isSessionForCurrentWorkout = session.isActive && session.activeSession?.workoutId === selectedWorkout?.id;

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
            <TabsTrigger value="estatisticas" className="font-sans gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Estatísticas
            </TabsTrigger>
          </TabsList>

          {/* TREINO TAB */}
          <TabsContent value="treino" className="space-y-6">
            {/* Cycle selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {cycles.map(cycle => {
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
                    {/* Weekly Bar - frequência visual */}
                    {(() => {
                      const scheduledDays = new Set<number>();
                      selectedCycle.workouts.forEach(w => {
                        if (w.day_of_week !== null && w.day_of_week !== undefined) {
                          scheduledDays.add(w.day_of_week);
                        }
                      });

                      const now = new Date();
                      const jsDow = now.getDay();
                      const mondayOffset = jsDow === 0 ? -6 : 1 - jsDow;
                      const weekStart = new Date(now);
                      weekStart.setDate(now.getDate() + mondayOffset);
                      weekStart.setHours(0, 0, 0, 0);
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekStart.getDate() + 6);
                      weekEnd.setHours(23, 59, 59, 999);

                      // trainedDays: dia da semana em que o aluno treinou (baseado na data do log)
                      const trainedDays = new Set<number>();
                      allLogs.forEach((l: any) => {
                        if (l.session_date) {
                          const logDate = new Date(l.session_date + "T12:00:00");
                          if (logDate >= weekStart && logDate <= weekEnd) {
                            trainedDays.add(logDate.getDay());
                          }
                        }
                      });

                      if (scheduledDays.size === 0) return null;

                      return (
                        <WeeklyBar
                          scheduledDays={scheduledDays}
                          trainedDays={trainedDays}
                          currentDayOfWeek={jsDow}
                        />
                      );
                    })()}
                    {/* Workout tabs */}
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
                        {/* Workout Timer */}
                        <WorkoutTimer
                          isActive={isSessionForCurrentWorkout}
                          elapsed={session.elapsed}
                          formatTime={session.formatTime}
                          onStart={handleStartSession}
                          onFinish={handleFinishSession}
                          onAbandon={handleAbandonSession}
                          workoutTitle={selectedWorkout.title}
                        />

                        <div className="flex items-center justify-between">
                          <h3 className="text-lg text-foreground font-sans font-semibold">{selectedWorkout.title}</h3>
                          <Button size="sm" onClick={saveCurrentLogs} disabled={savingLogs}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {savingLogs ? "Salvando..." : "Salvar"}
                          </Button>
                        </div>

                        {/* Session badge */}
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
                                {format(new Date(), "dd/MM/yyyy")}
                              </Badge>
                              {sessionCount > 0 && (
                                <Badge variant="secondary" className="gap-1.5 text-xs font-sans">
                                  <History className="h-3 w-3" />
                                  {totalSessions}ª sessão
                                </Badge>
                              )}
                            </div>
                          );
                        })()}

                        {/* Exercises */}
                        <div className="space-y-2">
                          {selectedWorkout.exercises.map((ex, idx) => (
                            <ExerciseCard
                              key={idx}
                              exercise={ex}
                              index={idx}
                              workoutId={selectedWorkout.id}
                              isExpanded={expandedExercise === idx}
                              onToggle={() => setExpandedExercise(expandedExercise === idx ? null : idx)}
                              onVideoPlay={() => openVideoForExercise(ex)}
                              logs={logs}
                              previousLogs={previousLogs}
                              onUpdateLog={updateLog}
                              exerciseHistory={getExerciseHistory(selectedWorkout.id, idx)}
                              isSessionActive={isSessionForCurrentWorkout}
                              activeRest={activeRest}
                              onSetComplete={startRest}
                              onRestComplete={clearRest}
                              totalSets={getTotalSets(idx)}
                              onAddSet={handleAddSet}
                              onRemoveSet={handleRemoveSet}
                            />
                          ))}
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

          {/* ESTATÍSTICAS TAB */}
          <TabsContent value="estatisticas" className="space-y-6">
            <StatsCharts
              allLogs={allLogs}
              cycles={cycles}
              todayStr={todayStr}
            />
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

      {/* Workout Summary Modal */}
      {session.summary && (
        <WorkoutSummary
          open={!!session.summary}
          onClose={session.clearSummary}
          durationSeconds={session.summary.durationSeconds}
          totalVolume={session.summary.totalVolume}
          totalSetsCompleted={session.summary.totalSetsCompleted}
          totalSetsPrescribed={session.summary.totalSetsPrescribed}
          exercises={session.summary.exercisesSummary}
          formatTime={session.formatTime}
        />
      )}
    </div>
  );
}
