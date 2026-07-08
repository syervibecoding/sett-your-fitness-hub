import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, PersonStanding, Check, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { BodyMap } from "@/components/body/BodyMap";
import { muscleGroupToRegion, REGION_LABEL, type BodyRegionId } from "@/lib/bodyMap";
import { getExerciseCover } from "@/lib/exerciseCover";

export interface LibraryExercise {
  id: string;
  name: string;
  muscle_group: string;
  video_url: string | null;
  video_path: string | null;
  description: string | null;
  category: string | null;
  categories: string[] | null;
  thumbnail_url: string | null;
}

// Retorna a lista de categorias de um exercício com fallback para o campo antigo `category`.
const getExerciseCategories = (ex: { categories?: string[] | null; category?: string | null }): string[] => {
  if (ex.categories && ex.categories.length > 0) return ex.categories;
  if (ex.category) return [ex.category];
  return [];
};

// Rótulos amigáveis para as categorias armazenadas em exercise_library.category
const CATEGORY_LABELS: Record<string, string> = {
  mobilidade: "Mobilidade",
  controle_motor: "Controle Motor",
  ativacao: "Ativação",
  core: "Core",
  performance: "Performance",
  fisioterapia: "Fisioterapia",
  base: "Base",
  pesos_livres: "Pesos Livres",
  peso_corporal: "Peso Corporal",
  maquinas: "Máquinas",
  pliometria: "Pliometria",
};

// Ordem preferida das abas
const CATEGORY_ORDER = [
  "mobilidade",
  "controle_motor",
  "ativacao",
  "core",
  "performance",
  "base",
  "fisioterapia",
  "pesos_livres",
  "peso_corporal",
  "maquinas",
  "pliometria",
];

// Categorias tratadas como "objetivos" para a sugestão automática
// (deixa de fora categorias de equipamento como máquinas / pesos livres).
const OBJECTIVE_CATEGORIES = [
  "mobilidade",
  "controle_motor",
  "ativacao",
  "core",
  "performance",
  "base",
  "fisioterapia",
  "pliometria",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alreadyAddedIds: Set<string>;
  onAdd: (exercises: LibraryExercise[]) => void;
}

export function ExerciseLibraryPicker({ open, onOpenChange, alreadyAddedIds, onAdd }: Props) {
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [region, setRegion] = useState<BodyRegionId | null>(null);
  const [showBody, setShowBody] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("exercise_library")
        .select("id, name, muscle_group, video_url, video_path, description, category, categories, thumbnail_url")
        .order("name");
      setExercises((data as LibraryExercise[]) || []);
    })();
  }, []);

  // Reset seleção ao fechar
  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const availableCategories = useMemo(() => {
    const present = new Set(exercises.flatMap((e) => getExerciseCategories(e)));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchSearch = !q || ex.name.toLowerCase().includes(q);
      const matchCat = category === "all" || getExerciseCategories(ex).includes(category);
      const matchRegion = !region || muscleGroupToRegion(ex.muscle_group || "") === region;
      return matchSearch && matchCat && matchRegion;
    });
  }, [exercises, search, category, region]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd = exercises.filter((ex) => selected.has(ex.id) && !alreadyAddedIds.has(ex.id));
    onAdd(toAdd);
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[88vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-primary">BIBLIOTECA DE EXERCÍCIOS</DialogTitle>
        </DialogHeader>

        {/* Category tabs */}
        <div className="px-6 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            <CatTab active={category === "all"} label="Todos" onClick={() => setCategory("all")} />
            {availableCategories.map((c) => (
              <CatTab
                key={c}
                active={category === c}
                label={CATEGORY_LABELS[c] || c}
                onClick={() => setCategory(c)}
              />
            ))}
          </div>
        </div>

        {/* Search + region */}
        <div className="px-6 py-3 flex items-center gap-3 shrink-0 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar exercício..."
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <Button
            type="button"
            variant={region ? "default" : "outline"}
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setShowBody((v) => !v)}
          >
            <PersonStanding className="h-4 w-4" />
            {region ? REGION_LABEL[region] : "Região"}
          </Button>
          {(region || search) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setRegion(null);
                setSearch("");
                setShowBody(false);
              }}
            >
              Limpar
            </Button>
          )}
        </div>

        {/* Body picker (toggle) */}
        {showBody && (
          <div className="px-6 py-3 border-b border-border bg-secondary/30 shrink-0">
            <BodyMap
              activeRegions={region ? [region] : []}
              onRegionClick={(r) => setRegion((prev) => (prev === r ? null : r))}
              scale={0.75}
            />
          </div>
        )}

        {/* Count */}
        <div className="px-6 pt-3 shrink-0">
          <p className="text-xs text-muted-foreground font-sans">{filtered.length} exercício(s)</p>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground font-sans py-10">Nenhum exercício encontrado</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((ex) => {
                const added = alreadyAddedIds.has(ex.id);
                const checked = selected.has(ex.id);
                const cover = getExerciseCover({ thumbnail_url: ex.thumbnail_url, video_url: ex.video_url });
                return (
                  <button
                    type="button"
                    key={ex.id}
                    disabled={added}
                    onClick={() => toggle(ex.id)}
                    className={`group relative text-left rounded-lg overflow-hidden border transition-all ${
                      added
                        ? "opacity-50 cursor-not-allowed border-border"
                        : checked
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="aspect-video w-full bg-secondary relative">
                      {cover ? (
                        <img src={cover} alt={ex.name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-sans">
                          Sem vídeo
                        </div>
                      )}
                      {/* selection check */}
                      <div
                        className={`absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
                          checked ? "bg-primary text-primary-foreground" : "bg-background/80 text-transparent"
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      {added && (
                        <span className="absolute bottom-2 left-2 text-[10px] font-sans bg-background/80 text-foreground rounded px-1.5 py-0.5">
                          Adicionado
                        </span>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-sans font-medium text-foreground line-clamp-2 leading-tight">{ex.name}</p>
                      {ex.muscle_group && (
                        <Badge variant="outline" className="text-[10px] capitalize">{ex.muscle_group}</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <span className="text-sm font-sans text-muted-foreground">{selected.size} selecionado(s)</span>
          <Button disabled={selected.size === 0} onClick={handleAdd}>
            Adicionar ({selected.size})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CatTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-sans font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
