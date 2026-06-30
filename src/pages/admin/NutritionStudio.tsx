// ============================================================================
// NutritionStudio (Fase D3) — Studio de nutrição determinístico
//   1. Seleciona aluno → prefill (idade/sexo da ficha, objetivo/refeições da anamnese)
//   2. Ajusta parâmetros antropométricos + objetivo
//   3. "Gerar" roda o motor determinístico (src/lib/nutrition) no cliente
//   4. Pré-visualiza macros + refeições + racional
//   5. "Salvar plano" grava em nutrition_plans (escopado por empresa)
// ============================================================================
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Apple, AlertCircle, AlertTriangle, CheckCircle2, Save, Loader2, Flame, Droplets,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import {
  generateNutritionPlan,
  type NutritionInput, type NutritionObjective, type Sex, type ActivityLevel,
  type NutritionPlanResult,
} from "@/lib/nutrition";

interface Student { id: string; full_name: string; gender: string | null; birth_date: string | null; }

const OBJ_OPTS: [NutritionObjective, string][] = [
  ["hipertrofia", "Hipertrofia"],
  ["emagrecimento", "Emagrecimento"],
  ["manutencao", "Manutenção"],
  ["performance", "Performance"],
];
const SEX_OPTS: [Sex, string][] = [
  ["masculino", "Masculino"],
  ["feminino", "Feminino"],
];
const ACT_OPTS: [ActivityLevel, string][] = [
  ["sedentario", "Sedentário"],
  ["leve", "Leve (1-3x/sem)"],
  ["moderado", "Moderado (3-5x/sem)"],
  ["intenso", "Intenso (6-7x/sem)"],
  ["muito_intenso", "Muito intenso"],
];

function ageFromBirth(birth: string | null): string {
  if (!birth) return "";
  const d = new Date(birth);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

export default function NutritionStudio() {
  const { user, role, companyId: authCompanyId } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const companyId = role === "master"
    ? (isViewingCompany ? viewingCompany?.id ?? null : null)
    : authCompanyId;

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");

  const [objective, setObjective] = useState<NutritionObjective>("hipertrofia");
  const [sex, setSex] = useState<Sex>("masculino");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity, setActivity] = useState<ActivityLevel>("moderado");
  const [mealsPerDay, setMealsPerDay] = useState("4");
  const [restrictions, setRestrictions] = useState("");

  const [plan, setPlan] = useState<NutritionPlanResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Alunos da empresa
  useEffect(() => {
    if (!companyId) { setStudents([]); return; }
    (async () => {
      const { data } = await supabase.from("students")
        .select("id, full_name, gender, birth_date").eq("company_id", companyId).order("full_name");
      setStudents((data as Student[]) || []);
    })();
  }, [companyId]);

  // Prefill ao trocar de aluno
  useEffect(() => {
    if (!studentId) return;
    setPlan(null);
    const s = students.find((x) => x.id === studentId);
    if (s) {
      const a = ageFromBirth(s.birth_date);
      if (a) setAge(a);
      if (s.gender === "feminino" || s.gender === "F" || s.gender === "Feminino") setSex("feminino");
      else if (s.gender) setSex("masculino");
    }
    (async () => {
      const { data: anam } = await supabase.from("student_anamneses")
        .select("objective, activity_level, meals_per_day, food_restrictions, age")
        .eq("student_id", studentId).maybeSingle();
      if (anam) {
        if (OBJ_OPTS.some(([v]) => v === anam.objective)) setObjective(anam.objective as NutritionObjective);
        if (ACT_OPTS.some(([v]) => v === anam.activity_level)) setActivity(anam.activity_level as ActivityLevel);
        if (anam.meals_per_day) setMealsPerDay(String(anam.meals_per_day));
        if (anam.food_restrictions) setRestrictions(anam.food_restrictions);
        if (anam.age && !ageFromBirth(s?.birth_date || null)) setAge(String(anam.age));
      }
    })();
  }, [studentId]);

  const student = students.find((s) => s.id === studentId);

  function handleGenerate() {
    if (!studentId) { toast.error("Selecione um aluno."); return; }
    if (!weight || !height || !age) { toast.error("Informe peso, altura e idade."); return; }
    const input: NutritionInput = {
      objective, sex,
      age: Number(age),
      weightKg: Number(weight),
      heightCm: Number(height),
      activity,
      mealsPerDay: Number(mealsPerDay) || 4,
    };
    setPlan(generateNutritionPlan(input));
    toast.success("Plano alimentar gerado.");
  }

  async function handleSave() {
    if (!plan || !studentId || !companyId) {
      toast.error("Gere um plano antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const row = {
        student_id: studentId,
        company_id: companyId,
        created_by: user?.id ?? null,
        title: `Plano Alimentar — ${OBJ_OPTS.find(([v]) => v === objective)?.[1] ?? objective}`,
        objective,
        status: "active",
        total_calories: plan.targets.calories,
        protein_g: plan.targets.protein,
        carbs_g: plan.targets.carbs,
        fat_g: plan.targets.fat,
        water_ml: plan.targets.waterMl,
        meals: plan.meals as unknown as object,
        notes: restrictions || null,
      };
      const { error } = await supabase.from("nutrition_plans").insert(row);
      if (error) throw new Error(error.message);
      toast.success("Plano alimentar salvo. O aluno já pode visualizá-lo.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    }
    setSaving(false);
  }

  const inputCls = "h-9 text-sm";
  const SS = ({ value, onChange, opts, placeholder }: any) => (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={inputCls}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{opts.map(([v, l]: [string, string]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Nutrição</p>
        <h1 className="font-display text-3xl">Studio de Nutrição</h1>
        <p className="text-sm text-muted-foreground">
          Motor determinístico · TMB + GET + macros + refeições calculados por regras (sem IA)
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aluno</CardTitle></CardHeader>
        <CardContent>
          {!companyId ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Nenhuma empresa selecionada.
            </p>
          ) : (
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Aluno</Label>
              <SS value={studentId} onChange={setStudentId} placeholder="Selecione..."
                opts={students.map((s) => [s.id, s.full_name])} />
            </div>
          )}
        </CardContent>
      </Card>

      {studentId && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Parâmetros</CardTitle></CardHeader>
          <CardContent className="grid gap-3 grid-cols-2 md:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Objetivo</Label>
              <SS value={objective} onChange={setObjective} opts={OBJ_OPTS} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Sexo</Label>
              <SS value={sex} onChange={setSex} opts={SEX_OPTS} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Nível de atividade</Label>
              <SS value={activity} onChange={setActivity} opts={ACT_OPTS} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Idade</Label>
              <Input className={inputCls} type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Peso (kg)</Label>
              <Input className={inputCls} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Altura (cm)</Label>
              <Input className={inputCls} type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Refeições/dia</Label>
              <Input className={inputCls} type="number" min={3} max={6} value={mealsPerDay}
                onChange={(e) => setMealsPerDay(e.target.value)} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <Label className="text-xs text-muted-foreground mb-1">Restrições alimentares (texto livre)</Label>
              <Textarea rows={2} value={restrictions} onChange={(e) => setRestrictions(e.target.value)}
                placeholder="Ex.: intolerância à lactose, vegetariano..." className="text-sm" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <Button onClick={handleGenerate} className="gap-2">
                <Apple className="h-4 w-4" /> Gerar plano alimentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {plan && (
        <>
          {/* Metas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Metas diárias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs gap-1"><Flame className="h-3 w-3" /> {plan.targets.calories} kcal</Badge>
                <Badge variant="outline" className="text-xs">Proteína: <span className="ml-1 font-medium text-navy">{plan.targets.protein} g</span></Badge>
                <Badge variant="outline" className="text-xs">Carbo: <span className="ml-1 font-medium text-navy">{plan.targets.carbs} g</span></Badge>
                <Badge variant="outline" className="text-xs">Gordura: <span className="ml-1 font-medium text-navy">{plan.targets.fat} g</span></Badge>
                <Badge variant="outline" className="text-xs gap-1"><Droplets className="h-3 w-3" /> {plan.targets.waterMl} ml</Badge>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                {plan.rationale.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {plan.warnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-1">
                  {plan.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-800 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Refeições */}
          <div className="grid gap-4 md:grid-cols-2">
            {plan.meals.map((m, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{m.name}{m.time ? ` · ${m.time}` : ""}</span>
                    <span className="text-xs font-normal text-muted-foreground">{m.kcal} kcal</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {m.items.map((it, j) => (
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
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Total: P{m.protein}g · C{m.carbs}g · G{m.fat}g
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Salvar */}
          <div className="flex items-center gap-2 sticky bottom-4">
            <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar plano"}
            </Button>
            {student && <span className="text-xs text-muted-foreground">para {student.full_name}</span>}
          </div>
        </>
      )}
    </div>
  );
}
