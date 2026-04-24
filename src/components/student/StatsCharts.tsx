import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, Activity, Trophy } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, parseISO } from "date-fns";
import { BodyMap } from "./BodyMap";

interface StatsChartsProps {
  allLogs: any[];
  cycles: { id: string; cycle_number: number; workouts: { id: string; exercises: { exercise_name: string; muscle_group: string; sets: string }[] }[] }[];
  todayStr: string;
}

export function StatsCharts({ allLogs, cycles }: StatsChartsProps) {
  const [selectedExercise, setSelectedExercise] = useState<string>("all");

  // Flatten exercises with workout/index references
  const allExercisesMeta = useMemo(() => {
    const meta: { workoutId: string; index: number; name: string; muscleGroup: string }[] = [];
    cycles.forEach(c => c.workouts.forEach(w => w.exercises.forEach((ex, idx) => {
      meta.push({ workoutId: w.id, index: idx, name: ex.exercise_name, muscleGroup: ex.muscle_group });
    })));
    return meta;
  }, [cycles]);

  const allExercises = useMemo(() => {
    return Array.from(new Set(allExercisesMeta.map(m => m.name))).sort();
  }, [allExercisesMeta]);

  // Volume by muscle group (for body map) — total tonnage
  const muscleVolumes = useMemo(() => {
    const volumes: Record<string, number> = {};
    allLogs.forEach((l: any) => {
      const meta = allExercisesMeta.find(m => m.workoutId === l.workout_id && m.index === l.exercise_index);
      if (!meta?.muscleGroup) return;
      const tonnage = (Number(l.weight) || 0) * (Number(l.reps_done) || 0);
      if (tonnage > 0) {
        volumes[meta.muscleGroup] = (volumes[meta.muscleGroup] || 0) + tonnage;
      }
    });
    return Object.entries(volumes).map(([muscleGroup, volume]) => ({ muscleGroup, volume }));
  }, [allLogs, allExercisesMeta]);

  // Sessions sorted by date
  const sessionDates = useMemo(() => {
    return Array.from(new Set(allLogs.map((l: any) => l.session_date))).sort() as string[];
  }, [allLogs]);

  // Top exercises by sessions count (for "all" mode)
  const topExercises = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    allLogs.forEach((l: any) => {
      const meta = allExercisesMeta.find(m => m.workoutId === l.workout_id && m.index === l.exercise_index);
      if (!meta) return;
      if (!counts[meta.name]) counts[meta.name] = new Set();
      counts[meta.name].add(l.session_date);
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b.size - a.size)
      .slice(0, 5)
      .map(([name]) => name);
  }, [allLogs, allExercisesMeta]);

  // Evolution by SESSION (max weight per exercise per date)
  const evolutionData = useMemo(() => {
    const exercisesToShow = selectedExercise === "all" ? topExercises : [selectedExercise];
    return sessionDates.map(date => {
      const point: any = { name: format(parseISO(date), "dd/MM"), date };
      exercisesToShow.forEach(exName => {
        const logsForDate = allLogs.filter((l: any) => {
          if (l.session_date !== date) return false;
          const meta = allExercisesMeta.find(m => m.workoutId === l.workout_id && m.index === l.exercise_index);
          return meta?.name === exName;
        });
        const maxWeight = logsForDate.reduce((max: number, l: any) => Math.max(max, Number(l.weight) || 0), 0);
        if (maxWeight > 0) point[exName] = maxWeight;
      });
      return point;
    }).filter(p => Object.keys(p).length > 2); // keep only sessions with data for selected
  }, [sessionDates, allLogs, allExercisesMeta, selectedExercise, topExercises]);

  // Volume per SESSION (tonnage)
  const volumeData = useMemo(() => {
    return sessionDates.map(date => {
      const logsForDate = allLogs.filter((l: any) => l.session_date === date);
      const total = logsForDate.reduce((sum: number, l: any) => sum + (Number(l.weight) || 0) * (Number(l.reps_done) || 0), 0);
      return { name: format(parseISO(date), "dd/MM"), total: Math.round(total) };
    });
  }, [sessionDates, allLogs]);

  // PRs
  const personalRecords = useMemo(() => {
    const bestByExercise: Record<string, { weight: number; date: string }> = {};
    allLogs.forEach((l: any) => {
      const meta = allExercisesMeta.find(m => m.workoutId === l.workout_id && m.index === l.exercise_index);
      if (!meta) return;
      const weight = Number(l.weight) || 0;
      if (weight > 0) {
        if (!bestByExercise[meta.name] || weight > bestByExercise[meta.name].weight) {
          bestByExercise[meta.name] = { weight, date: l.session_date };
        }
      }
    });
    return Object.entries(bestByExercise)
      .map(([exercise, { weight, date }]) => ({ exercise, weight, date }))
      .sort((a, b) => b.weight - a.weight);
  }, [allLogs, allExercisesMeta]);

  // Aggregates
  const totalSessions = sessionDates.length;
  const totalTonnage = useMemo(() => volumeData.reduce((s, v) => s + v.total, 0), [volumeData]);
  const avgTonnage = totalSessions > 0 ? Math.round(totalTonnage / totalSessions) : 0;
  const topPR = personalRecords[0];

  const exerciseColors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  const filteredExerciseNames = selectedExercise === "all" ? topExercises : [selectedExercise];

  if (allLogs.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-8 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-sans">Registre suas cargas para ver estatísticas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="bodymap" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="bodymap" className="font-sans text-xs gap-1">
          <Activity className="h-3.5 w-3.5" />
          Body Map
        </TabsTrigger>
        <TabsTrigger value="evolucao" className="font-sans text-xs gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          Carga
        </TabsTrigger>
        <TabsTrigger value="volume" className="font-sans text-xs gap-1">
          <BarChart3 className="h-3.5 w-3.5" />
          Volume
        </TabsTrigger>
      </TabsList>

      {/* Body Map */}
      <TabsContent value="bodymap">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-4">Volume por Grupamento</h3>
            <BodyMap muscleVolumes={muscleVolumes} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Load Evolution */}
      <TabsContent value="evolucao" className="space-y-4">
        <div className="flex items-center gap-2">
          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="h-8 text-xs font-sans">
              <SelectValue placeholder="Todos exercícios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Top 5 exercícios</SelectItem>
              {allExercises.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Evolução de Carga (kg) — por sessão
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  {filteredExerciseNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={exerciseColors[i % exerciseColors.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* PRs */}
        {personalRecords.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider">Recordes Pessoais</h3>
              </div>
              <div className="space-y-2">
                {personalRecords.slice(0, 10).map((pr, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-sans">
                    <span className="text-foreground">{pr.exercise}</span>
                    <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">{pr.weight}kg</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Volume */}
      <TabsContent value="volume" className="space-y-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Tonelagem por Sessão (kg)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumo</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-mono text-foreground">{totalSessions}</p>
                <p className="text-[10px] text-muted-foreground font-sans uppercase">Sessões registradas</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-mono text-foreground">{personalRecords.length}</p>
                <p className="text-[10px] text-muted-foreground font-sans uppercase">Recordes pessoais</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-mono text-foreground">{totalTonnage.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-muted-foreground font-sans uppercase">Tonelagem total (kg)</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-mono text-foreground">{avgTonnage.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-muted-foreground font-sans uppercase">Média/sessão (kg)</p>
              </div>
              {topPR && (
                <div className="col-span-2 bg-secondary/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold font-mono text-primary">{topPR.exercise} — {topPR.weight}kg</p>
                  <p className="text-[10px] text-muted-foreground font-sans uppercase">Maior PR</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
