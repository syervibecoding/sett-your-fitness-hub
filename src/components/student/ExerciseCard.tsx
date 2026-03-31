import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, ChevronDown, ChevronUp, History, TrendingUp, TrendingDown, Minus, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { RestTimer } from "./RestTimer";

interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  video_url: string | null;
  video_path: string | null;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
}

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  index: number;
  workoutId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onVideoPlay: () => void;
  logs: Record<string, { weight: number; reps_done: number }>;
  previousLogs: Record<string, { weight: number; reps_done: number }>;
  onUpdateLog: (exIdx: number, setNum: number, field: "weight" | "reps_done", value: number) => void;
  exerciseHistory: { date: string; sets: { weight: number; reps_done: number; set_number: number }[] }[];
  isSessionActive: boolean;
  activeRest: { exerciseIdx: number; setNum: number; seconds: number } | null;
  onSetComplete: (exIdx: number, setNum: number, restStr: string) => void;
  onRestComplete: () => void;
}

export function ExerciseCard({
  exercise: ex, index: idx, workoutId, isExpanded, onToggle, onVideoPlay,
  logs, previousLogs, onUpdateLog, exerciseHistory, isSessionActive,
  activeRest, onSetComplete, onRestComplete,
}: ExerciseCardProps) {
  const numSets = parseInt(ex.sets) || 3;
  const hasVideo = !!(ex.video_path || ex.video_url);
  const getLogKey = (s: number) => `${workoutId}-${idx}-${s}`;

  const completedSets = Array.from({ length: numSets }, (_, s) => {
    const key = getLogKey(s + 1);
    const log = logs[key];
    return log && (log.weight > 0 || log.reps_done > 0);
  }).filter(Boolean).length;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={onToggle}>
          <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold font-sans flex-shrink-0 ${
            completedSets === numSets && completedSets > 0
              ? "bg-green-500/20 text-green-400"
              : "bg-primary/10 text-primary"
          }`}>
            {completedSets === numSets && completedSets > 0 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              idx + 1
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans font-medium text-foreground text-sm truncate">{ex.exercise_name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground font-sans">{ex.sets}×{ex.reps} · {ex.rest}</p>
              {completedSets > 0 && (
                <span className="text-[10px] text-primary font-sans">{completedSets}/{numSets}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasVideo && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onVideoPlay(); }}>
                <Play className="h-4 w-4 text-primary" />
              </Button>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border px-3 py-3 bg-secondary/30 space-y-3">
            {ex.notes && (
              <p className="text-xs text-muted-foreground font-sans whitespace-pre-wrap break-words">
                <span className="font-medium text-foreground">Obs:</span> {ex.notes}
              </p>
            )}

            <div className="space-y-1">
              <div className="grid grid-cols-[40px_1fr_1fr_24px] gap-2 text-xs text-muted-foreground font-sans font-medium">
                <span>Série</span>
                <span>Peso (kg)</span>
                <span>Reps</span>
                <span></span>
              </div>
              {Array.from({ length: numSets }, (_, s) => {
                const key = getLogKey(s + 1);
                const log = logs[key];
                const prev = previousLogs[key];
                const weight = log?.weight || 0;
                const prevWeight = prev?.weight || 0;
                const isCompleted = weight > 0 || (log?.reps_done || 0) > 0;
                const showRestTimer = activeRest?.exerciseIdx === idx && activeRest?.setNum === s + 1;

                let progressIcon = null;
                if (isCompleted && prevWeight > 0) {
                  if (weight > prevWeight) progressIcon = <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
                  else if (weight < prevWeight) progressIcon = <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
                  else progressIcon = <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
                }

                return (
                  <div key={s} className="space-y-1">
                    <div className="grid grid-cols-[40px_1fr_1fr_24px] gap-2 items-center">
                      <span className={`text-sm font-sans font-medium ${isCompleted ? "text-primary" : "text-foreground"}`}>
                        {s + 1}ª
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-8 text-sm bg-card border-border"
                        placeholder={prevWeight > 0 ? String(prevWeight) : "0"}
                        value={log?.weight || ""}
                        onChange={(e) => {
                          onUpdateLog(idx, s + 1, "weight", parseFloat(e.target.value) || 0);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="h-8 text-sm bg-card border-border"
                        placeholder={ex.reps}
                        value={log?.reps_done || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onUpdateLog(idx, s + 1, "reps_done", val);
                          if (isSessionActive && val > 0 && (log?.weight || 0) > 0) {
                            onSetComplete(idx, s + 1, ex.rest);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex items-center justify-center">
                        {progressIcon}
                      </div>
                    </div>
                    {prev && (prev.weight > 0 || prev.reps_done > 0) && (
                      <p className="text-[10px] text-muted-foreground font-sans ml-[calc(40px+0.5rem)]">
                        Última: {prev.weight}kg × {prev.reps_done}
                      </p>
                    )}
                    {showRestTimer && (
                      <div className="ml-[calc(40px+0.5rem)]">
                        <RestTimer restSeconds={activeRest.seconds} onComplete={onRestComplete} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mini-history */}
            {exerciseHistory.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground font-sans gap-1.5 h-7" onClick={(e) => e.stopPropagation()}>
                    <History className="h-3 w-3" />
                    Ver histórico ({exerciseHistory.length} sessões)
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1.5">
                  {exerciseHistory.map(({ date, sets }) => (
                    <div key={date} className="flex items-start gap-2 text-[11px] font-sans text-muted-foreground">
                      <span className="font-medium text-foreground/70 min-w-[40px]">
                        {format(parseISO(date), "dd/MM")}
                      </span>
                      <span className="flex-1">
                        {sets.map(s => `${s.weight}kg×${s.reps_done}`).join(", ")}
                      </span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
