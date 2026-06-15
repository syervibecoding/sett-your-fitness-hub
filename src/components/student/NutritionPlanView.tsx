import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Apple, Utensils, Droplets, Flame, Beef, Wheat, Leaf, Loader2 } from "lucide-react";
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
  const protein = row.target_protein_g ?? row.protein_g;
  const carbs = row.target_carbs_g ?? row.carbs_g;
  const fat = row.target_fat_g ?? row.fat_g;
  const title = row.plan_name || row.name || "Plano nutricional";
  const goal = row.goal ? GOAL_LABEL[row.goal] || row.goal : null;
  const rationale = (row.ai_rationale || "").trim();
  const notes = [row.notes, row.observations].map((s) => (s || "").trim()).filter(Boolean).join("\n\n");

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
          {protein != null && <MacroCard icon={Beef} value={`${protein} g`} label="Proteína" tint="text-rose-500" />}
          {carbs != null && <MacroCard icon={Wheat} value={`${carbs} g`} label="Carboidrato" tint="text-amber-500" />}
          {fat != null && <MacroCard icon={Apple} value={`${fat} g`} label="Gordura" tint="text-yellow-600" />}
          {row.target_fiber_g != null && <MacroCard icon={Leaf} value={`${row.target_fiber_g} g`} label="Fibra" tint="text-emerald-600" />}
          {row.target_water_ml != null && <MacroCard icon={Droplets} value={`${(row.target_water_ml / 1000).toFixed(1)} L`} label="Água" tint="text-sky-500" />}
        </div>
      </div>

      {/* Orientações (ai_rationale) */}
      {rationale && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-eyebrow text-muted-foreground mb-2">Orientações</p>
            <p className="text-sm text-foreground/90 font-sans whitespace-pre-line leading-relaxed">{rationale}</p>
          </CardContent>
        </Card>
      )}

      {/* Observações */}
      {notes && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-eyebrow text-muted-foreground mb-2">Observações</p>
            <p className="text-sm text-foreground/90 font-sans whitespace-pre-line leading-relaxed">{notes}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground text-center px-4">
        Sugestões nutricionais educativas do seu treinador — não substituem o acompanhamento de um nutricionista.
      </p>
    </div>
  );
}
