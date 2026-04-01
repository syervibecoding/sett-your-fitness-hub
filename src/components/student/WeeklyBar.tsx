import { CheckCircle2, Circle, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { label: "Seg", dayOfWeek: 1 },
  { label: "Ter", dayOfWeek: 2 },
  { label: "Qua", dayOfWeek: 3 },
  { label: "Qui", dayOfWeek: 4 },
  { label: "Sex", dayOfWeek: 5 },
  { label: "Sáb", dayOfWeek: 6 },
  { label: "Dom", dayOfWeek: 0 },
];

interface WeeklyBarProps {
  scheduledDays: Set<number>;
  trainedDays: Set<number>;
  currentDayOfWeek: number;
}

export function WeeklyBar({ scheduledDays, trainedDays, currentDayOfWeek }: WeeklyBarProps) {
  const totalScheduled = scheduledDays.size;
  const totalTrained = [...trainedDays].filter(d => scheduledDays.has(d)).length;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 justify-between">
        {DAYS.map(day => {
          const hasWorkout = scheduledDays.has(day.dayOfWeek);
          const isToday = day.dayOfWeek === currentDayOfWeek;
          const isTrained = trainedDays.has(day.dayOfWeek);

          return (
            <div
              key={day.label}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-2 sm:px-3 rounded-lg flex-1 min-w-0 font-sans border",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                hasWorkout ? "border-border" : "border-transparent opacity-40"
              )}
            >
              <span className={cn(
                "text-[11px] font-medium",
                isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {day.label}
              </span>
              {isTrained ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : hasWorkout ? (
                <Dumbbell className={cn("h-4 w-4", isToday ? "text-primary" : "text-muted-foreground")} />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/20" />
              )}
            </div>
          );
        })}
      </div>
      {totalScheduled > 0 && (
        <p className="text-xs text-muted-foreground text-center font-sans">
          {totalTrained}/{totalScheduled} treinos esta semana
        </p>
      )}
    </div>
  );
}
