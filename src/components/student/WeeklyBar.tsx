import { CheckCircle2, Circle, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { label: "Seg", short: "S", dayOfWeek: 1 },
  { label: "Ter", short: "T", dayOfWeek: 2 },
  { label: "Qua", short: "Q", dayOfWeek: 3 },
  { label: "Qui", short: "Q", dayOfWeek: 4 },
  { label: "Sex", short: "S", dayOfWeek: 5 },
  { label: "Sáb", short: "S", dayOfWeek: 6 },
  { label: "Dom", short: "D", dayOfWeek: 0 },
];

interface WeeklyBarProps {
  scheduledDays: Map<number, string>; // day_of_week -> workout_id
  completedDays: Set<number>; // day_of_week values that have logs for today's week
  currentDayOfWeek: number; // JS getDay() value (0=Sun)
  selectedDayOfWeek: number | null;
  onDayClick: (dayOfWeek: number) => void;
}

export function WeeklyBar({ scheduledDays, completedDays, currentDayOfWeek, selectedDayOfWeek, onDayClick }: WeeklyBarProps) {
  return (
    <div className="flex gap-1.5 justify-between">
      {DAYS.map(day => {
        const hasWorkout = scheduledDays.has(day.dayOfWeek);
        const isToday = day.dayOfWeek === currentDayOfWeek;
        const isCompleted = completedDays.has(day.dayOfWeek);
        const isSelected = selectedDayOfWeek === day.dayOfWeek;

        return (
          <button
            key={day.label}
            onClick={() => hasWorkout && onDayClick(day.dayOfWeek)}
            disabled={!hasWorkout}
            className={cn(
              "flex flex-col items-center gap-1 py-2 px-2 sm:px-3 rounded-lg transition-all flex-1 min-w-0 font-sans",
              isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              isSelected && hasWorkout && "bg-primary/15 border-primary",
              hasWorkout ? "cursor-pointer border" : "cursor-default opacity-40 border border-transparent",
              !isSelected && hasWorkout && "border-border hover:bg-secondary/50"
            )}
          >
            <span className={cn(
              "text-[11px] font-medium",
              isToday ? "text-primary" : "text-muted-foreground"
            )}>
              {day.label}
            </span>
            {hasWorkout ? (
              isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Dumbbell className={cn("h-4 w-4", isToday ? "text-primary" : "text-muted-foreground")} />
              )
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/20" />
            )}
          </button>
        );
      })}
    </div>
  );
}
