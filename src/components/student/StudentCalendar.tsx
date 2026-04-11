import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, CheckCircle2, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS_FULL = [
  { label: "Segunda", short: "Seg", dayOfWeek: 1 },
  { label: "Terça", short: "Ter", dayOfWeek: 2 },
  { label: "Quarta", short: "Qua", dayOfWeek: 3 },
  { label: "Quinta", short: "Qui", dayOfWeek: 4 },
  { label: "Sexta", short: "Sex", dayOfWeek: 5 },
  { label: "Sábado", short: "Sáb", dayOfWeek: 6 },
  { label: "Domingo", short: "Dom", dayOfWeek: 0 },
];

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
}

export function StudentCalendar({ workouts, trainedDays, currentDayOfWeek, onSelectWorkout, allLogs = [] }: StudentCalendarProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const workoutByDay: Record<number, Workout> = {};
  workouts.forEach(w => {
    if (w.day_of_week !== null && w.day_of_week !== undefined) {
      workoutByDay[w.day_of_week] = w;
    }
  });

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

  const toggleDay = (dayOfWeek: number) => {
    const workout = workoutByDay[dayOfWeek];
    if (!workout) return;
    setExpandedDay(prev => prev === dayOfWeek ? null : dayOfWeek);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground font-sans">Agenda Semanal</h2>

      <div className="space-y-2">
        {DAYS_FULL.map(day => {
          const workout = workoutByDay[day.dayOfWeek];
          const isToday = day.dayOfWeek === currentDayOfWeek;
          const isTrained = trainedDays.has(day.dayOfWeek);
          const isExpanded = expandedDay === day.dayOfWeek;

          return (
            <Card
              key={day.dayOfWeek}
              className={cn(
                "bg-card border-border transition-all",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                !workout && "opacity-50"
              )}
            >
              <CardContent className="p-0">
                {/* Header row - clickable */}
                <button
                  onClick={() => toggleDay(day.dayOfWeek)}
                  className={cn(
                    "w-full p-3 flex items-center justify-between text-left",
                    workout && "cursor-pointer hover:bg-accent/30 transition-colors rounded-lg"
                  )}
                  disabled={!workout}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold font-sans",
                      isToday ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}>
                      {day.short}
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-medium font-sans",
                        isToday ? "text-primary" : "text-foreground"
                      )}>
                        {day.label}
                        {isToday && <span className="text-xs text-muted-foreground ml-1.5">(hoje)</span>}
                      </p>
                      {workout ? (
                        <p className="text-xs text-muted-foreground font-sans">
                          {workout.title} • {workout.exercises.length} exercícios
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground font-sans">Descanso</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTrained ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : workout ? (
                      <Dumbbell className={cn("h-5 w-5", isToday ? "text-primary" : "text-muted-foreground/40")} />
                    ) : null}
                    {workout && (
                      isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && workout && (
                  <div className="px-3 pb-3 border-t border-border">
                    <div className="mt-3 space-y-2">
                      {workout.exercises.map((ex, idx) => {
                        const lastLog = getLastLogForExercise(workout.id, idx);
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

                    <Button
                      size="sm"
                      className="w-full mt-3 font-sans"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorkout(workout.id);
                      }}
                    >
                      Ir para o treino <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
