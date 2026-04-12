import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Dumbbell, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, getDay, isToday as isDateToday
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

export function StudentCalendar({ workouts, onSelectWorkout, allLogs = [], cycleStartDate, cycleEndDate }: StudentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Map workouts by day_of_week (0=Sun, 1=Mon, etc.)
  const workoutByDow = useMemo(() => {
    const map: Record<number, Workout> = {};
    workouts.forEach(w => {
      if (w.day_of_week !== null && w.day_of_week !== undefined) {
        map[w.day_of_week] = w;
      }
    });
    return map;
  }, [workouts]);

  // Set of dates (YYYY-MM-DD) that have logs
  const trainedDates = useMemo(() => {
    const s = new Set<string>();
    allLogs.forEach(l => { if (l.session_date) s.add(l.session_date); });
    return s;
  }, [allLogs]);

  // Generate calendar days grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const getWorkoutForDate = (date: Date): Workout | null => {
    const dow = getDay(date); // 0=Sun
    return workoutByDow[dow] || null;
  };

  const isDateTrained = (date: Date): boolean => {
    return trainedDates.has(format(date, "yyyy-MM-dd"));
  };

  const isInCycle = (date: Date): boolean => {
    if (!cycleStartDate || !cycleEndDate) return true;
    const d = format(date, "yyyy-MM-dd");
    return d >= cycleStartDate && d <= cycleEndDate;
  };

  const getLastLogForExercise = (workoutId: string, exerciseIndex: number) => {
    const exLogs = allLogs
      .filter(l => l.workout_id === workoutId && l.exercise_index === exerciseIndex)
      .sort((a, b) => (b.session_date || "").localeCompare(a.session_date || ""));
    if (exLogs.length === 0) return null;
    const lastDate = exLogs[0].session_date;
    const lastSets = exLogs.filter(l => l.session_date === lastDate).sort((a, b) => a.set_number - b.set_number);
    const maxWeight = Math.max(...lastSets.map(s => s.weight || 0));
    const maxReps = lastSets.find(s => s.weight === maxWeight)?.reps_done || lastSets[0]?.reps_done || 0;
    return { weight: maxWeight, reps: maxReps };
  };

  const selectedWorkout = selectedDate ? getWorkoutForDate(selectedDate) : null;
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedDateTrained = selectedDate ? isDateTrained(selectedDate) : false;

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
          const workout = getWorkoutForDate(day);
          const trained = isDateTrained(day);
          const inCycle = isInCycle(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasPrescribed = workout && inCycle && inMonth;

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
              {hasPrescribed && !trained && !isSelected && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
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
          <span className="w-2 h-2 rounded-full bg-primary" />
          Treino prescrito
        </div>
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

            {selectedWorkout && isInCycle(selectedDate) && isSameMonth(selectedDate, currentMonth) ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground font-sans">
                    {selectedWorkout.title} • {selectedWorkout.exercises.length} exercícios
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {selectedWorkout.exercises.map((ex, idx) => {
                    const lastLog = getLastLogForExercise(selectedWorkout.id, idx);
                    return (
                      <div key={idx} className="flex items-start justify-between py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground font-sans truncate">
                            {idx + 1}. {ex.exercise_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-sans">
                            {ex.muscle_group} • {ex.sets}×{ex.reps}
                          </p>
                          {lastLog && lastLog.weight > 0 && (
                            <p className="text-xs text-primary/80 font-sans mt-0.5">
                              Último: {lastLog.weight}kg × {lastLog.reps}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button size="sm" className="w-full font-sans" onClick={() => onSelectWorkout(selectedWorkout.id)}>
                  Ir para o treino <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-sans">Sem treino prescrito para este dia.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
