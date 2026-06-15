import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Apple, Utensils, Droplets, Flame, Beef, Wheat, Leaf, Loader2, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

// Espelha o schema VIVO de nutrition_plans (Supabase zshrcgbyhzxpnlccssyz): macros nas colunas
// target_* (+ fallback total_*/*_g), objetivo em goal, restrições em context_dietary_restrictions,
// e o raciocínio/orientações em ai_rationale. (O banco ativo NÃO tem energy_summary/nutrition_tips.)
interface NutritionRow {
  name?: string | null;
  plan_name?: string | null;
  goal?: string | null;
  status?: string | null;
  target_calories?: number | null;
  target_protein_g?: number | null;
  target_carbs_g?: number | null;
  target_fat_g?: number | null;
  target_fiber_g?: number | null;
  target_water_ml?: number | null;
  total_calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  context_dietary_restrictions?: string | null;
  ai_rationale?: string | null;
  notes?: string | null;
  observations?: string | null;
}

const GOAL_LABEL: Record<string, string> = {
  manutencao: "Manutenção",
  emagrecimento: "Emagrecimento",
  hipertrofia: "Hipertrofia",
  perda_gordura: "Perda de gordura",
  performance: "Performance",
  ganho_massa: "Ganho de massa",
};

const GLASS_ML = 250;

// Quebra o texto em tópicos por frase, SEM cortar números (ex.: "1.715", "2,0g/kg"):
// só divide num ponto/ponto-e-vírgula precedido por letra/%/) e seguido de espaço + MAIÚSCULA.
function splitPoints(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[\p{L}%)\]])[.;]\s+(?=\p{Lu})/u)
    .map((s) => s.replace(/[.;]\s*$/, "").trim())
    .filter((s) => s.length > 0);
}

function MacroCard({ icon: Icon, value, label, tint }: { icon: typeof Flame; value: string; label: string; tint?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 flex flex-col items-center text-center gap-1">
        <Icon className={cn("h-4 w-4", tint || "text-primary")} />
        <span className="font-mono-data text-lg leading-none text-primary">{value}</span>
        <span className="text-eyebrow text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

export function NutritionPlanView({ studentId }: { studentId: string }) {
  const [row, setRow] = useState<NutritionRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Rastreador de hidratação (interativo) — persiste por aluno + dia no localStorage.
  const dayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const waterStoreKey = `nutri-water:${studentId}:${dayKey}`;
  const [glasses, setGlasses] = useState(0);
  useEffect(() => {
    try { setGlasses(Number(localStorage.getItem(waterStoreKey)) || 0); } catch { setGlasses(0); }
  }, [waterStoreKey]);
  const setGlassesPersist = (n: number) => {
    const v = Math.max(0, n);
    setGlasses(v);
    try { localStorage.setItem(waterStoreKey, String(v)); } catch { /* ignore */ }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("nutrition_plans")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!active) return;
        setRow((data as NutritionRow) ?? null);
      } catch {
        if (active) setRow(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!row) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-6 text-center">
          <Apple className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-sans">Nenhuma dica nutricional ainda.</p>
        </CardContent>
      </Card>
    );
  }

  const kcal = row.target_calories ?? row.total_calories;
  const protein = row.target_protein_g ?? row.protein_g ?? 0;
  const carbs = row.target_carbs_g ?? row.carbs_g ?? 0;
  const fat = row.target_fat_g ?? row.fat_g ?? 0;
  const title = row.plan_name || row.name || "Plano nutricional";
  const goal = row.goal ? GOAL_LABEL[row.goal] || row.goal : null;
  const points = splitPoints((row.ai_rationale || "").trim());
  const notesPoints = splitPoints([row.notes, row.observations].map((s) => (s || "").trim()).filter(Boolean).join(". "));

  // Divisão dos macros por contribuição calórica (P/C = 4 kcal/g, G = 9 kcal/g).
  const pK = protein * 4, cK = carbs * 4, fK = fat * 9;
  const totK = pK + cK + fK;
  const pct = (x: number) => (totK > 0 ? Math.round((x / totK) * 100) : 0);
  const macroSplit = [
    { label: "Proteína", pct: pct(pK), cls: "bg-rose-500" },
    { label: "Carbo", pct: pct(cK), cls: "bg-amber-500" },
    { label: "Gordura", pct: pct(fK), cls: "bg-yellow-600" },
  ];

  const waterMl = row.target_water_ml ?? 0;
  const totalGlasses = waterMl > 0 ? Math.max(1, Math.round(waterMl / GLASS_ML)) : 0;
  const waterPctDone = totalGlasses > 0 ? Math.round((Math.min(glasses, totalGlasses) / totalGlasses) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Utensils className="h-5 w-5 text-primary shrink-0 mt-1" />
        <div>
          <h2 className="font-display text-2xl text-foreground capitalize leading-tight">{title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {goal && <Badge variant="outline" className="text-primary border-primary/30">{goal}</Badge>}
            {row.context_dietary_restrictions && (
              <Badge variant="outline" className="border-emerald-600/30 bg-emerald-600/10 text-emerald-800 capitalize">
                {row.context_dietary_restrictions}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Macros do dia */}
      <div>
        <p className="text-eyebrow text-muted-foreground mb-2">Metas do dia</p>
        <div className="grid grid-cols-3 gap-2">
          {kcal != null && <MacroCard icon={Flame} value={`${kcal}`} label="kcal/dia" tint="text-orange-500" />}
          {protein > 0 && <MacroCard icon={Beef} value={`${protein} g`} label="Proteína" tint="text-rose-500" />}
          {carbs > 0 && <MacroCard icon={Wheat} value={`${carbs} g`} label="Carboidrato" tint="text-amber-500" />}
          {fat > 0 && <MacroCard icon={Apple} value={`${fat} g`} label="Gordura" tint="text-yellow-600" />}
          {row.target_fiber_g != null && <MacroCard icon={Leaf} value={`${row.target_fiber_g} g`} label="Fibra" tint="text-emerald-600" />}
          {waterMl > 0 && <MacroCard icon={Droplets} value={`${(waterMl / 1000).toFixed(1)} L`} label="Água" tint="text-sky-500" />}
        </div>
      </div>

      {/* Divisão de macros (barra visual) */}
      {totK > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-eyebrow text-muted-foreground mb-2">Divisão das calorias</p>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {macroSplit.map((m) => (
                <div key={m.label} className={m.cls} style={{ width: `${m.pct}%` }} title={`${m.label} ${m.pct}%`} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {macroSplit.map((m) => (
                <span key={m.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("h-2.5 w-2.5 rounded-full", m.cls)} /> {m.label}
                  <span className="font-mono-data text-foreground">{m.pct}%</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidratação (interativo) */}
      {totalGlasses > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-eyebrow text-muted-foreground">Hidratação de hoje</p>
              <span className="font-mono-data text-xs text-sky-600">
                {Math.min(glasses, totalGlasses)}/{totalGlasses} copos · {((Math.min(glasses, totalGlasses) * GLASS_ML) / 1000).toFixed(1)} L de {(waterMl / 1000).toFixed(1)} L
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: totalGlasses }).map((_, i) => {
                const filled = i < glasses;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Copo ${i + 1}`}
                    onClick={() => setGlassesPersist(glasses === i + 1 ? i : i + 1)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                      filled ? "border-sky-500 bg-sky-500/15 text-sky-600" : "border-border bg-background text-muted-foreground hover:border-sky-400",
                    )}
                  >
                    <Droplets className={cn("h-4 w-4", filled && "fill-sky-500/30")} />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${waterPctDone}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orientações — em tópicos */}
      {points.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-eyebrow text-muted-foreground">Orientações</p>
            </div>
            <ul className="space-y-2.5">
              {points.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground/90 font-sans leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Observações */}
      {notesPoints.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-eyebrow text-muted-foreground mb-2">Observações</p>
            <ul className="space-y-2">
              {notesPoints.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground/90 font-sans leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground text-center px-4">
        Sugestões nutricionais educativas do seu treinador — não substituem o acompanhamento de um nutricionista.
      </p>
    </div>
  );
}
