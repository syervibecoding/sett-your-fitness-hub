import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, AlertTriangle, CheckCircle, TrendingUp, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  studentId: string;
}

interface MuscleGroupVolume {
  name: string;
  prescribedSets: number;
  executedSets: number;
  totalVolume: number;
}

interface SessionSummary {
  total: number;
  completed: number;
  abandoned: number;
  avgDuration: number;
  totalVolume: number;
}

export function WorkoutAnalysis({ studentId }: Props) {
  const [period, setPeriod] = useState("30");
  const [muscleData, setMuscleData] = useState<MuscleGroupVolume[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary>({ total: 0, completed: 0, abandoned: 0, avgDuration: 0, totalVolume: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalysis();
  }, [studentId, period]);

  const loadAnalysis = async () => {
    setLoading(true);

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    const sinceDate = daysAgo.toISOString();

    // Load sessions
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("student_id", studentId)
      .gte("created_at", sinceDate);

    const allSessions = sessions || [];
    const completedSessions = allSessions.filter(s => s.status === "completed");
    const abandonedSessions = allSessions.filter(s => s.status === "abandoned");

    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const totalVolume = completedSessions.reduce((sum, s) => sum + Number(s.total_volume || 0), 0);

    setSessionSummary({
      total: allSessions.length,
      completed: completedSessions.length,
      abandoned: abandonedSessions.length,
      avgDuration: completedSessions.length > 0 ? Math.round(totalDuration / completedSessions.length) : 0,
      totalVolume,
    });

    // Load workout logs for this period
    const { data: logs } = await supabase
      .from("workout_logs")
      .select("workout_id, exercise_index, weight, reps_done, set_number")
      .eq("student_id", studentId)
      .gte("created_at", sinceDate);

    // Load all workouts for this student (via enrollments -> cycles -> workouts)
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", studentId);

    if (!enrollments || enrollments.length === 0) {
      setMuscleData([]);
      setLoading(false);
      return;
    }

    const enrollIds = enrollments.map(e => e.id);
    const { data: cyclesData } = await supabase
      .from("training_cycles")
      .select("id")
      .in("enrollment_id", enrollIds);

    if (!cyclesData || cyclesData.length === 0) {
      setMuscleData([]);
      setLoading(false);
      return;
    }

    const cycleIds = cyclesData.map(c => c.id);
    const { data: workouts } = await supabase
      .from("workouts")
      .select("id, exercises")
      .in("cycle_id", cycleIds);

    // Get all exercise IDs from workouts
    const exerciseIds = new Set<string>();
    const prescribedByExercise: Record<string, number> = {};

    (workouts || []).forEach(w => {
      const exercises = (w.exercises as any[]) || [];
      exercises.forEach(ex => {
        if (ex.exerciseId) {
          exerciseIds.add(ex.exerciseId);
          const sets = parseInt(ex.sets) || 0;
          prescribedByExercise[ex.exerciseId] = (prescribedByExercise[ex.exerciseId] || 0) + sets;
        }
      });
    });

    // Count executed sets per exercise from logs
    const executedByExercise: Record<string, number> = {};
    const volumeByExercise: Record<string, number> = {};
    
    // Map workout_id + exercise_index to exerciseId
    const workoutExerciseMap: Record<string, string> = {};
    (workouts || []).forEach(w => {
      const exercises = (w.exercises as any[]) || [];
      exercises.forEach((ex, idx) => {
        if (ex.exerciseId) {
          workoutExerciseMap[`${w.id}_${idx}`] = ex.exerciseId;
        }
      });
    });

    (logs || []).forEach(log => {
      const key = `${log.workout_id}_${log.exercise_index}`;
      const exId = workoutExerciseMap[key];
      if (exId) {
        executedByExercise[exId] = (executedByExercise[exId] || 0) + 1;
        volumeByExercise[exId] = (volumeByExercise[exId] || 0) + (Number(log.weight) || 0) * (Number(log.reps_done) || 0);
      }
    });

    if (exerciseIds.size === 0) {
      setMuscleData([]);
      setLoading(false);
      return;
    }

    // Load muscle group targets
    const { data: targets } = await supabase
      .from("exercise_muscle_targets")
      .select("exercise_id, muscle_group_id, is_primary")
      .in("exercise_id", Array.from(exerciseIds));

    const muscleGroupIds = new Set((targets || []).map(t => t.muscle_group_id));
    
    if (muscleGroupIds.size === 0) {
      setMuscleData([]);
      setLoading(false);
      return;
    }

    const { data: muscleGroups } = await supabase
      .from("muscle_groups")
      .select("id, name")
      .in("id", Array.from(muscleGroupIds));

    const mgMap = new Map((muscleGroups || []).map(mg => [mg.id, mg.name]));

    // Aggregate by muscle group
    const mgData: Record<string, MuscleGroupVolume> = {};

    (targets || []).forEach(t => {
      const mgName = mgMap.get(t.muscle_group_id) || "Desconhecido";
      if (!mgData[mgName]) {
        mgData[mgName] = { name: mgName, prescribedSets: 0, executedSets: 0, totalVolume: 0 };
      }
      const factor = t.is_primary ? 1 : 0.5;
      mgData[mgName].prescribedSets += Math.round((prescribedByExercise[t.exercise_id] || 0) * factor);
      mgData[mgName].executedSets += Math.round((executedByExercise[t.exercise_id] || 0) * factor);
      mgData[mgName].totalVolume += Math.round((volumeByExercise[t.exercise_id] || 0) * factor);
    });

    setMuscleData(Object.values(mgData).sort((a, b) => b.prescribedSets - a.prescribedSets));
    setLoading(false);
  };

  const adherencePercent = sessionSummary.total > 0
    ? Math.round((sessionSummary.completed / sessionSummary.total) * 100)
    : 0;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return `${m}min`;
  };

  const getVolumeAlert = (mg: MuscleGroupVolume) => {
    const weeksInPeriod = parseInt(period) / 7;
    const weeklyExecuted = weeksInPeriod > 0 ? mg.executedSets / weeksInPeriod : 0;
    if (weeklyExecuted < 10 && mg.prescribedSets > 0) return "sub";
    if (weeklyExecuted > 20) return "over";
    return "ok";
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 flex justify-center">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-primary text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          ANÁLISE DE TREINO
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Última semana</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Último mês</SelectItem>
            <SelectItem value="60">Últimos 2 meses</SelectItem>
            <SelectItem value="90">Últimos 3 meses</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">{sessionSummary.completed}</p>
            <p className="text-xs text-muted-foreground font-sans">Sessões completas</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">{adherencePercent}%</p>
            <p className="text-xs text-muted-foreground font-sans">Aderência</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">{formatDuration(sessionSummary.avgDuration)}</p>
            <p className="text-xs text-muted-foreground font-sans">Duração média</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">
              {sessionSummary.totalVolume >= 1000
                ? `${(sessionSummary.totalVolume / 1000).toFixed(1)}t`
                : `${sessionSummary.totalVolume}kg`}
            </p>
            <p className="text-xs text-muted-foreground font-sans">Volume total</p>
          </div>
        </div>

        {/* Adherence bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-sans">
            <span className="text-muted-foreground">Aderência ao treino</span>
            <span className="text-foreground font-medium">{sessionSummary.completed}/{sessionSummary.total} sessões</span>
          </div>
          <Progress value={adherencePercent} className="h-2" />
          {sessionSummary.abandoned > 0 && (
            <p className="text-xs text-warning font-sans flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {sessionSummary.abandoned} sessão(ões) abandonada(s)
            </p>
          )}
        </div>

        {/* Muscle group table */}
        {muscleData.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-sans font-medium text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Volume por Grupamento Muscular
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs">Grupamento</TableHead>
                    <TableHead className="text-xs text-center">Prescrito</TableHead>
                    <TableHead className="text-xs text-center">Executado</TableHead>
                    <TableHead className="text-xs text-center">%</TableHead>
                    <TableHead className="text-xs text-center">Volume (kg)</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muscleData.map(mg => {
                    const pct = mg.prescribedSets > 0 ? Math.round((mg.executedSets / mg.prescribedSets) * 100) : 0;
                    const alert = getVolumeAlert(mg);
                    return (
                      <TableRow key={mg.name}>
                        <TableCell className="text-sm font-sans font-medium">{mg.name}</TableCell>
                        <TableCell className="text-sm text-center font-sans">{mg.prescribedSets}</TableCell>
                        <TableCell className="text-sm text-center font-sans">{mg.executedSets}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-xs ${
                            pct >= 80 ? "bg-success/15 text-success border-success/30" :
                            pct >= 50 ? "bg-warning/15 text-warning border-warning/30" :
                            "bg-destructive/15 text-destructive border-destructive/30"
                          }`}>
                            {pct}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-center font-sans text-muted-foreground">
                          {mg.totalVolume >= 1000 ? `${(mg.totalVolume / 1000).toFixed(1)}t` : `${mg.totalVolume}kg`}
                        </TableCell>
                        <TableCell className="text-center">
                          {alert === "sub" && (
                            <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />Sub
                            </Badge>
                          )}
                          {alert === "over" && (
                            <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">
                              <TrendingUp className="h-3 w-3 mr-0.5" />Excesso
                            </Badge>
                          )}
                          {alert === "ok" && (
                            <CheckCircle className="h-4 w-4 text-success mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Alerts */}
            {muscleData.some(mg => getVolumeAlert(mg) !== "ok") && (
              <div className="space-y-2 mt-3">
                {muscleData.filter(mg => getVolumeAlert(mg) === "sub").map(mg => (
                  <div key={mg.name} className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-xs font-sans">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                    <span className="text-warning"><strong>{mg.name}</strong>: sub-treinado ({(mg.executedSets / (parseInt(period) / 7)).toFixed(1)} séries/semana — recomendado ≥10)</span>
                  </div>
                ))}
                {muscleData.filter(mg => getVolumeAlert(mg) === "over").map(mg => (
                  <div key={mg.name} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-sans">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-destructive"><strong>{mg.name}</strong>: volume excessivo ({(mg.executedSets / (parseInt(period) / 7)).toFixed(1)} séries/semana — recomendado ≤20)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-sans text-center py-4">
            Nenhum dado de treino encontrado para este período.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
