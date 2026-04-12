import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Dumbbell, CheckCircle2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, isToday as isDateToday
} from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface WorkoutExercise {
  exercise_name: string;
  muscle_group: string;
  sets: string;
  reps: string;
}

interface Workout {
  id: string;
  title: string;
  day_of_week: number | null;
  exercises: WorkoutExercise[];
}

interface WorkoutLog {
  workout_id: string;
  exercise_index: number;
  set_number: number;
  weight: number;
  reps_done: number;
  session_date?: string;
}

interface StudentCalendarProps {
  workouts: Workout[];
  trainedDays: Set<number>;
  currentDayOfWeek: number;
  onSelectWorkout: (workoutId: string) => void;
  allLogs?: WorkoutLog[];
  cycleStartDate?: string;
  cycleEndDate?: string;
}

export function StudentCalendar({ workouts, onSelectWorkout, allLogs = [] }: StudentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Map logs by session_date to know which dates were trained and which workout
  const logsByDate = useMemo(() => {
    const map: Record<string, { workout_id: string; logs: WorkoutLog[] }[]> = {};
    allLogs.forEach(l => {
      if (!l.session_date) return;
      if (!map[l.session_date]) map[l.session_date] = [];
      const existing = map[l.session_date].find(g => g.workout_id === l.workout_id);
      if (existing) {
        existing.logs.push(l);
      } else {
        map[l.session_date].push({ workout_id: l.workout_id, logs: [l] });
      }
    });
    return map;
  }, [allLogs]);

  const trainedDates = useMemo(() => new Set(Object.keys(logsByDate)), [logsByDate]);

  // Generate calendar days grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const isDateTrained = (date: Date): boolean => {
    return trainedDates.has(format(date, "yyyy-MM-dd"));
  };

  const getWorkoutsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayGroups = logsByDate[dateStr] || [];
    return dayGroups.map(g => {
      const workout = workouts.find(w => w.id === g.workout_id);
      return { workout, logs: g.logs };
    }).filter(g => g.workout);
  };

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedDateTrained = selectedDate ? isDateTrained(selectedDate) : false;
  const selectedDateWorkouts = selectedDate ? getWorkoutsForDate(selectedDate) : [];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold text-foreground font-sans capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="text-center text-xs font-medium text-muted-foreground py-1 font-sans">
            {label}
          </div>
        ))}

        {/* Day Cells */}
        {calendarDays.map((day, idx) => {
          const inMonth = isSameMonth(day, currentMonth);
          const today = isDateToday(day);
          const trained = isDateTrained(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(prev => prev && isSameDay(prev, day) ? null : day)}
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-sans transition-all",
                !inMonth && "opacity-30",
                inMonth && "hover:bg-accent/40",
                today && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && trained && inMonth && "bg-green-500/20 text-green-400",
              )}
            >
              <span className={cn("text-sm", !isSelected && !trained && inMonth && "text-foreground")}>
                {format(day, "d")}
              </span>
              {trained && inMonth && !isSelected && (
                <CheckCircle2 className="absolute bottom-0.5 h-3 w-3 text-green-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground font-sans">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          Treinado
        </div>
      </div>

      {/* Selected Day Detail Panel */}
      {selectedDate && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground font-sans capitalize">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              {selectedDateTrained && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  Treinado
                </Badge>
              )}
            </div>

            {selectedDateTrained && selectedDateWorkouts.length > 0 ? (
              <div className="space-y-4">
                {selectedDateWorkouts.map(({ workout, logs }) => (
                  <div key={workout!.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <Dumbbell className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground font-sans">
                        {workout!.title} • {workout!.exercises.length} exercícios
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      {workout!.exercises.map((ex, idx) => {
                        const exLogs = logs.filter(l => l.exercise_index === idx);
                        const maxWeight = exLogs.length > 0 ? Math.max(...exLogs.map(l => l.weight || 0)) : 0;
                        const bestReps = exLogs.find(l => l.weight === maxWeight)?.reps_done || 0;
                        return (
                          <div key={idx} className="flex items-start justify-between py-1.5 border-b border-border/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground font-sans truncate">
                                {idx + 1}. {ex.exercise_name}
                              </p>
                              <p className="text-xs text-muted-foreground font-sans">
                                {ex.muscle_group} • {ex.sets}×{ex.reps}
                              </p>
                              {maxWeight > 0 && (
                                <p className="text-xs text-primary/80 font-sans mt-0.5">
                                  Carga: {maxWeight}kg × {bestReps}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button size="sm" className="w-full font-sans" onClick={() => onSelectWorkout(workout!.id)}>
                      Ir para o treino <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : !selectedDateTrained ? (
              <div>
                {workouts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-sans mb-3">Treinos disponíveis no ciclo:</p>
                    {workouts.map(w => (
                      <Button
                        key={w.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between font-sans"
                        onClick={() => onSelectWorkout(w.id)}
                      >
                        <span className="flex items-center gap-2">
                          <Dumbbell className="h-3.5 w-3.5 text-primary" />
                          {w.title}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-sans">Sem treinos prescritos neste ciclo.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-sans">Sem detalhes disponíveis.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
