import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Apple,
  Utensils,
  Droplets,
  Flame,
  Beef,
  Wheat,
  Pill,
  Repeat,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Shape (tudo opcional — JSON vem de IA e varia) ───────────────────────── */
interface EnergySummary {
  tmb_kcal?: number | string;
  get_kcal?: number | string;
  target_kcal?: number | string;
  deficit_surplus_percent?: number | string;
  protein_total_g?: number | string;
  carbs_total_g?: number | string;
  fat_total_g?: number | string;
  hydration_ml?: number | string;
  formula_used?: string;
}

interface CarbCyclingObj {
  high_day_kcal?: number | string;
  high_day_carbs_g?: number | string;
  moderate_day_kcal?: number | string;
  moderate_day_carbs_g?: number | string;
  rest_day_kcal?: number | string;
  rest_day_carbs_g?: number | string;
}

interface NutritionTip {
  title?: string;
  timing?: string;
  goal?: string;
  how_much?: string;
  examples?: string[];
  avoid?: string[];
}

interface Supplement {
  supplement?: string;
  dose?: string;
  timing?: string;
  reason?: string;
}

interface Substitution {
  original?: string;
  alternatives?: string[];
}

interface NutritionPlan {
  plan_name?: string;
  energy_summary?: EnergySummary;
  carb_cycling?: CarbCyclingObj | string;
  nutrition_tips?: NutritionTip[];
  supplementation?: Supplement[];
  substitutions?: Substitution[];
  warnings?: string[];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ── Macro card ───────────────────────────────────────────────────────────── */
function MacroCard({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Flame;
  value: string;
  label: string;
  tint?: string;
}) {
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

/* ── Chip ─────────────────────────────────────────────────────────────────── */
function Chip({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: "good" | "avoid" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-sans",
        variant === "good" && "border-emerald-600/30 bg-emerald-600/10 text-emerald-800",
        variant === "avoid" && "border-amber-600/30 bg-amber-600/10 text-amber-800",
        variant === "neutral" && "border-border bg-background text-foreground",
      )}
    >
      {variant === "good" && <Check className="h-3 w-3 shrink-0" />}
      {variant === "avoid" && <X className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

/* ── Componente principal ─────────────────────────────────────────────────── */
export function NutritionPlanView({ studentId }: { studentId: string }) {
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
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

        if (!data) {
          setPlan(null);
        } else {
          // Prefere data.plan (jsonb); fallback para colunas planas.
          const p: NutritionPlan = data.plan ?? data ?? {};
          setPlan(p);
        }
      } catch {
        if (active) setPlan(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan || Object.keys(plan).length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-6 text-center">
          <Apple className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-sans">
            Nenhuma dica nutricional ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  const es = plan.energy_summary;
  const cc = plan.carb_cycling;
  const tips = asArray<NutritionTip>(plan.nutrition_tips);
  const supps = asArray<Supplement>(plan.supplementation);
  const subs = asArray<Substitution>(plan.substitutions);
  const warnings = asArray<string>(plan.warnings).filter(Boolean);

  const ccObj = cc && typeof cc === "object" ? (cc as CarbCyclingObj) : null;
  const ccStr = typeof cc === "string" ? cc : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Utensils className="h-5 w-5 text-primary shrink-0" />
        <h2 className="font-display text-xl text-primary leading-tight">
          {plan.plan_name?.trim() || "Dicas Nutricionais"}
        </h2>
      </div>

      {/* Macros */}
      {es && (
        <div className="space-y-2">
          <p className="text-eyebrow text-muted-foreground">Resumo energético</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <MacroCard icon={Flame} value={fmt(es.target_kcal)} label="kcal alvo" />
            <MacroCard
              icon={Beef}
              value={`${fmt(es.protein_total_g)}g`}
              label="Proteína"
              tint="text-rose-700"
            />
            <MacroCard
              icon={Wheat}
              value={`${fmt(es.carbs_total_g)}g`}
              label="Carbo"
              tint="text-amber-700"
            />
            <MacroCard
              icon={Droplets}
              value={`${fmt(es.fat_total_g)}g`}
              label="Gordura"
              tint="text-yellow-700"
            />
            <MacroCard
              icon={Droplets}
              value={es.hydration_ml ? `${fmt(es.hydration_ml)}ml` : "—"}
              label="Água"
              tint="text-sky-700"
            />
          </div>
          {(es.tmb_kcal != null ||
            es.get_kcal != null ||
            es.deficit_surplus_percent != null ||
            es.formula_used) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-mono-data pt-0.5">
              {es.tmb_kcal != null && <span>TMB {fmt(es.tmb_kcal)}</span>}
              {es.get_kcal != null && <span>GET {fmt(es.get_kcal)}</span>}
              {es.deficit_surplus_percent != null && (
                <span>
                  {Number(es.deficit_surplus_percent) >= 0 ? "+" : ""}
                  {fmt(es.deficit_surplus_percent)}%
                </span>
              )}
              {es.formula_used && <span>{es.formula_used}</span>}
            </div>
          )}
        </div>
      )}

      {/* Carb cycling */}
      {ccObj && (
        <div className="space-y-2">
          <p className="text-eyebrow text-muted-foreground">Ciclo de carboidratos</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Dia alto",
                kcal: ccObj.high_day_kcal,
                carbs: ccObj.high_day_carbs_g,
                cls: "border-emerald-600/30 bg-emerald-600/10",
                accent: "text-emerald-800",
              },
              {
                label: "Moderado",
                kcal: ccObj.moderate_day_kcal,
                carbs: ccObj.moderate_day_carbs_g,
                cls: "border-primary/30 bg-primary/5",
                accent: "text-primary",
              },
              {
                label: "Descanso",
                kcal: ccObj.rest_day_kcal,
                carbs: ccObj.rest_day_carbs_g,
                cls: "border-border bg-background",
                accent: "text-muted-foreground",
              },
            ].map((d) => (
              <div
                key={d.label}
                className={cn("rounded-lg border p-3 flex flex-col gap-1", d.cls)}
              >
                <span className={cn("text-eyebrow", d.accent)}>{d.label}</span>
                <span className="font-mono-data text-base text-foreground leading-none">
                  {d.kcal != null ? fmt(d.kcal) : "—"}
                  <span className="text-[10px] text-muted-foreground ml-0.5">kcal</span>
                </span>
                {d.carbs != null && (
                  <span className="font-mono-data text-xs text-muted-foreground">
                    {fmt(d.carbs)}g CHO
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {ccStr && (
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-eyebrow text-muted-foreground mb-1">Ciclo de carboidratos</p>
            <p className="text-sm text-foreground font-sans">{ccStr}</p>
          </CardContent>
        </Card>
      )}

      {/* Nutrition tips — accordion (bloco principal) */}
      {tips.length > 0 && (
        <div className="space-y-2">
          <p className="text-eyebrow text-muted-foreground">Orientações por momento</p>
          <Accordion type="single" collapsible className="space-y-2">
            {tips.map((t, i) => {
              const examples = asArray<string>(t.examples).filter(Boolean);
              const avoid = asArray<string>(t.avoid).filter(Boolean);
              return (
                <AccordionItem
                  key={i}
                  value={`tip-${i}`}
                  className="border border-border rounded-lg bg-card px-3"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-left flex-wrap">
                      <span className="text-sm font-bold text-foreground font-sans">
                        {t.title?.trim() || `Dica ${i + 1}`}
                      </span>
                      {t.timing && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-primary/40 text-primary"
                        >
                          {t.timing}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 space-y-3">
                    {t.goal && (
                      <div>
                        <span className="text-eyebrow text-muted-foreground">Objetivo</span>
                        <p className="text-sm text-foreground font-sans">{t.goal}</p>
                      </div>
                    )}
                    {t.how_much && (
                      <div>
                        <span className="text-eyebrow text-muted-foreground">Quanto</span>
                        <p className="text-sm text-foreground font-sans">{t.how_much}</p>
                      </div>
                    )}
                    {examples.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-eyebrow text-emerald-800">Exemplos</span>
                        <div className="flex flex-wrap gap-1.5">
                          {examples.map((ex, j) => (
                            <Chip key={j} variant="good">
                              {ex}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}
                    {avoid.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-eyebrow text-amber-800">Evitar</span>
                        <div className="flex flex-wrap gap-1.5">
                          {avoid.map((av, j) => (
                            <Chip key={j} variant="avoid">
                              {av}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      {/* Suplementação */}
      {supps.length > 0 && (
        <div className="space-y-2">
          <p className="text-eyebrow text-muted-foreground flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5" />
            Suplementação
          </p>
          <div className="space-y-2">
            {supps.map((s, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-foreground font-sans">
                      {s.supplement?.trim() || "Suplemento"}
                    </span>
                    {s.dose && (
                      <Badge variant="secondary" className="text-[10px] font-mono-data">
                        {s.dose}
                      </Badge>
                    )}
                    {s.timing && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-primary/40 text-primary"
                      >
                        {s.timing}
                      </Badge>
                    )}
                  </div>
                  {s.reason && (
                    <p className="text-xs text-muted-foreground font-sans">{s.reason}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Substituições */}
      {subs.length > 0 && (
        <div className="space-y-2">
          <p className="text-eyebrow text-muted-foreground flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5" />
            Substituições
          </p>
          <div className="space-y-2">
            {subs.map((s, i) => {
              const alts = asArray<string>(s.alternatives).filter(Boolean);
              return (
                <Card key={i} className="bg-card border-border">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm text-foreground font-sans">
                      <span className="font-bold">{s.original?.trim() || "Item"}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                    {alts.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {alts.map((a, j) => (
                          <Chip key={j} variant="neutral">
                            {a}
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground font-sans">
                        Sem alternativas listadas.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-amber-600/40 bg-amber-600/10">
          <CardContent className="p-3">
            <p className="text-eyebrow text-amber-800 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              Atenção
            </p>
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li
                  key={i}
                  className="text-sm text-amber-900 font-sans flex items-start gap-2"
                >
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-700 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
