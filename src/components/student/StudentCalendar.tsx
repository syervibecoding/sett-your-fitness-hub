import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, CheckCircle2 } from "lucide-react";
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

interface Workout {
  id: string;
  title: string;
  day_of_week: number | null;
  exercises: { exercise_name: string; muscle_group: string }[];
}

interface StudentCalendarProps {
  workouts: Workout[];
  trainedDays: Set<number>;
  currentDayOfWeek: number;
  onSelectWorkout: (workoutId: string) => void;
}

export function StudentCalendar({ workouts, trainedDays, currentDayOfWeek, onSelectWorkout }: StudentCalendarProps) {
  const workoutByDay: Record<number, Workout> = {};
  workouts.forEach(w => {
    if (w.day_of_week !== null && w.day_of_week !== undefined) {
      workoutByDay[w.day_of_week] = w;
    }
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground font-sans">Agenda Semanal</h2>

      <div className="space-y-2">
        {DAYS_FULL.map(day => {
          const workout = workoutByDay[day.dayOfWeek];
          const isToday = day.dayOfWeek === currentDayOfWeek;
          const isTrained = trainedDays.has(day.dayOfWeek);

          return (
            <Card
              key={day.dayOfWeek}
              className={cn(
                "bg-card border-border transition-all",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                !workout && "opacity-50"
              )}
            >
              <CardContent className="p-3 flex items-center justify-between">
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
                      <button
                        onClick={() => onSelectWorkout(workout.id)}
                        className="text-xs text-primary hover:underline font-sans"
                      >
                        {workout.title} • {workout.exercises.length} exercícios
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground font-sans">Descanso</p>
                    )}
                  </div>
                </div>
                <div>
                  {isTrained ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : workout ? (
                    <Dumbbell className={cn("h-5 w-5", isToday ? "text-primary" : "text-muted-foreground/40")} />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
