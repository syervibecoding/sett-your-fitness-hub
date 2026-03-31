import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, Activity, Trophy } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { BodyMap } from "./BodyMap";

interface StatsChartsProps {
  allLogs: any[];
  cycles: { id: string; cycle_number: number; workouts: { id: string; exercises: { exercise_name: string; muscle_group: string; sets: string }[] }[] }[];
  todayStr: string;
}

export function StatsCharts({ allLogs, cycles, todayStr }: StatsChartsProps) {
  const [selectedExercise, setSelectedExercise] = useState<string>("all");

  // Get all exercise names
  const allExercises = useMemo(() => {
    const names = new Set<string>();
    cycles.forEach(c => c.workouts.forEach(w => w.exercises.forEach(ex => names.add(ex.exercise_name))));
    return Array.from(names).sort();
  }, [cycles]);

  // Volume by muscle group (for body map)
  const muscleVolumes = useMemo(() => {
    const volumes: Record<string, number> = {};
    cycles.forEach(c => {
      c.workouts.forEach(w => {
        w.exercises.forEach((ex, idx) => {
          const logsForEx = allLogs.filter(l => l.workout_id === w.id && l.exercise_index === idx);
          const tonnage = logsForEx.reduce((sum: number, l: any) => sum + (Number(l.weight) || 0) * (Number(l.reps_done) || 0), 0);
          if (tonnage > 0) {
            volumes[ex.muscle_group] = (volumes[ex.muscle_group] || 0) + tonnage;
          }
        });
      });
    });
    return Object.entries(volumes).map(([muscleGroup, volume]) => ({ muscleGroup, volume }));
  }, [allLogs, cycles]);

  // Evolution data per exercise
  const evolutionData = useMemo(() => {
    return cycles
      .filter(c => c.workouts.length > 0)
      .map(c => {
        const data: any = { name: `C${c.cycle_number}` };
        c.workouts.forEach(w => {
          w.exercises.forEach((ex, idx) => {
            if (selectedExercise !== "all" && ex.exercise_name !== selectedExercise) return;
            const logsForEx = allLogs.filter(l => l.workout_id === w.id && l.exercise_index === idx);
            const maxWeight = logsForEx.reduce((max: number, l: any) => Math.max(max, Number(l.weight) || 0), 0);
            if (maxWeight > 0) data[ex.exercise_name] = maxWeight;
          });
        });
        return data;
      });
  }, [allLogs, cycles, selectedExercise]);

  // Volume per cycle
  const volumeData = useMemo(() => {
    return cycles
      .filter(c => c.workouts.length > 0)
      .map(c => {
        let total = 0;
        c.workouts.forEach(w => {
          w.exercises.forEach((ex, idx) => {
            const logsForEx = allLogs.filter(l => l.workout_id === w.id && l.exercise_index === idx);
            total += logsForEx.reduce((sum: number, l: any) => sum + (Number(l.weight) || 0) * (Number(l.reps_done) || 0), 0);
          });
        });
        return { name: `C${c.cycle_number}`, total };
      });
  }, [allLogs, cycles]);

  // PRs
  const personalRecords = useMemo(() => {
    const prs: { exercise: string; weight: number; date: string }[] = [];
    const bestByExercise: Record<string, { weight: number; date: string }> = {};

    cycles.forEach(c => {
      c.workouts.forEach(w => {
        w.exercises.forEach((ex, idx) => {
          const logsForEx = allLogs.filter((l: any) => l.workout_id === w.id && l.exercise_index === idx);
          logsForEx.forEach((l: any) => {
            const weight = Number(l.weight) || 0;
            if (weight > 0) {
              const key = ex.exercise_name;
              if (!bestByExercise[key] || weight > bestByExercise[key].weight) {
                bestByExercise[key] = { weight, date: l.session_date };
              }
            }
          });
        });
      });
    });

    Object.entries(bestByExercise).forEach(([exercise, { weight, date }]) => {
      prs.push({ exercise, weight, date });
    });

    return prs.sort((a, b) => b.weight - a.weight);
  }, [allLogs, cycles]);

  // Frequency
  const frequencyData = useMemo(() => {
    const sessionDates = new Set(allLogs.map((l: any) => l.session_date));
    return { totalSessions: sessionDates.size };
  }, [allLogs]);

  const exerciseColors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  const filteredExerciseNames = selectedExercise === "all" ? allExercises.slice(0, 5) : [selectedExercise];

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
              <SelectItem value="all">Todos (top 5)</SelectItem>
              {allExercises.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolução de Carga (kg)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  {filteredExerciseNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={exerciseColors[i % exerciseColors.length]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
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
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-4">Tonelagem por Ciclo (kg)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
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
                <p className="text-2xl font-bold font-mono text-foreground">{frequencyData.totalSessions}</p>
                <p className="text-[10px] text-muted-foreground font-sans uppercase">Sessões registradas</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-mono text-foreground">{personalRecords.length}</p>
                <p className="text-[10px] text-muted-foreground font-sans uppercase">Recordes pessoais</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
