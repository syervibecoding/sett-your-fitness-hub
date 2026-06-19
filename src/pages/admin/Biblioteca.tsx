import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Library, Loader2 } from "lucide-react";

// Biblioteca unificada: um seletor (dropdown) alterna entre Exercícios e Treinos,
// em vez de duas abas separadas no menu.
const ExerciseLibrary = lazy(() => import("./ExerciseLibrary"));
const WorkoutLibrary = lazy(() => import("./WorkoutLibrary"));

export default function Biblioteca() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "treinos" ? "treinos" : "exercicios";
  const setTab = (v: string) => {
    const p = new URLSearchParams(params);
    p.set("tab", v);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 font-mono-data text-sm font-semibold uppercase tracking-wide text-primary">
          <Library className="h-4 w-4" /> Biblioteca de
        </span>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="exercicios">Exercícios</SelectItem>
            <SelectItem value="treinos">Treinos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
        {tab === "treinos" ? <WorkoutLibrary /> : <ExerciseLibrary />}
      </Suspense>
    </div>
  );
}
