import { CheckCircle2, Circle } from "lucide-react";
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
  trainedDays: Set<number>;
  currentDayOfWeek: number;
  weeklySessionCount?: number;
}

export function WeeklyBar({ trainedDays, currentDayOfWeek, weeklySessionCount }: WeeklyBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 justify-between">
        {DAYS.map(day => {
          const isToday = day.dayOfWeek === currentDayOfWeek;
          const isTrained = trainedDays.has(day.dayOfWeek);

          return (
            <div
              key={day.label}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-2 sm:px-3 rounded-lg flex-1 min-w-0 font-sans border",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                isTrained ? "border-border" : "border-transparent opacity-40"
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
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/20" />
              )}
            </div>
          );
        })}
      </div>
      {weeklySessionCount !== undefined && (
        <p className="text-xs text-muted-foreground text-center font-sans">
          {weeklySessionCount} {weeklySessionCount === 1 ? "sessão" : "sessões"} esta semana
        </p>
      )}
    </div>
  );
}
