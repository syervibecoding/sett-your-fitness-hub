// Visualização do plano alimentar para o aluno (Fase D3).
// Carrega o plano ativo mais recente do aluno (RLS garante acesso só ao próprio).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Apple, Flame, Droplets } from "lucide-react";
import type { Meal } from "@/lib/nutrition";

interface NutritionPlanRow {
  id: string;
  title: string;
  objective: string;
  total_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  meals: Meal[];
  notes: string | null;
}

export function NutritionPlanView({ studentId }: { studentId: string }) {
  const [plan, setPlan] = useState<NutritionPlanRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("nutrition_plans")
        .select("id, title, objective, total_calories, protein_g, carbs_g, fat_g, water_ml, meals, notes")
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan((data as unknown as NutritionPlanRow) || null);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) return null;

  if (!plan) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Apple className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Nenhum plano alimentar disponível ainda.
        </CardContent>
      </Card>
    );
  }

  const meals = Array.isArray(plan.meals) ? plan.meals : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Apple className="h-4 w-4 text-emerald-600" /> {plan.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {plan.total_calories != null && (
            <Badge variant="outline" className="text-xs gap-1"><Flame className="h-3 w-3" /> {plan.total_calories} kcal</Badge>
          )}
          {plan.protein_g != null && <Badge variant="outline" className="text-xs">Proteína: <span className="ml-1 font-medium text-navy">{plan.protein_g} g</span></Badge>}
          {plan.carbs_g != null && <Badge variant="outline" className="text-xs">Carbo: <span className="ml-1 font-medium text-navy">{plan.carbs_g} g</span></Badge>}
          {plan.fat_g != null && <Badge variant="outline" className="text-xs">Gordura: <span className="ml-1 font-medium text-navy">{plan.fat_g} g</span></Badge>}
          {plan.water_ml != null && <Badge variant="outline" className="text-xs gap-1"><Droplets className="h-3 w-3" /> {plan.water_ml} ml</Badge>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {meals.map((m, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{m.name}{m.time ? ` · ${m.time}` : ""}</span>
                <span className="text-xs font-normal text-muted-foreground">{m.kcal} kcal</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(m.items || []).map((it, j) => (
                <div key={j} className="flex items-center justify-between text-xs border-b border-line pb-1.5">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{it.food}</p>
                    <p className="text-muted-foreground">{it.amount}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2 text-muted-foreground">
                    <span className="text-foreground font-medium">{it.kcal} kcal</span>
                    <span className="block">P{it.protein} C{it.carbs} G{it.fat}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {plan.notes && (
        <p className="text-xs text-muted-foreground border-l-2 border-line pl-3">{plan.notes}</p>
      )}
    </div>
  );
}
