// ============================================================================
// UnifiedPrescriber — Studio de Prescrição (fluxo integrado em 5 etapas)
//   Topo: seleciona aluno (com busca) + enviar/gerar link de anamnese
//   1. Anamnese  → resumo do aluno + "O que o aluno vai receber?" + orquestração
//   2. Avaliação → Avaliação Funcional embutida (fotos/vídeo, cortes iguais)
//   3. Prescrição → gera TODAS as modalidades marcadas (IA + motores) + PDFs
//   4. Editar    → revisar/editar treino de musculação (fallback)
//   5. Publicar  → escolher ciclo e publicar treino no app do aluno
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, CheckCircle2, Circle, AlertCircle, Dumbbell, Activity, Waves, Bike, Apple,
  ChevronDown, ChevronUp, ClipboardCheck, Send, Link2, Sparkles, Search, ArrowRight,
  Trash2, Plus, FileDown, Rocket, Layers, Info, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { useAssistantName } from "@/hooks/useAssistantName";
import FunctionalAssessmentPanel from "@/components/admin/FunctionalAssessmentPanel";
import { generateNutritionPlan } from "@/lib/nutrition";
import type { NutritionInput, NutritionObjective, ActivityLevel, Sex } from "@/lib/nutrition";
import { jsPDF } from "jspdf";
import { ExerciseLibraryPicker, type LibraryExercise } from "@/components/trainer/ExerciseLibraryPicker";
import { GROUP_DEFS, GROUP_ORDER, type GroupType } from "@/lib/workoutGroups";
import { useStudentLimitations } from "@/hooks/useStudentLimitations";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Student { id: string; full_name: string; gender: string | null; birth_date: string | null; }
interface Cycle { id: string; cycle_number: number; status: string; start_date: string; end_date: string; }
interface Anamnese {
  age: string; body_fat_percent: string;
  objective: string; activity_level: string;
  is_endurance_athlete: boolean;
  training_modality: string;
  days_per_week_strength: string; days_per_week_cardio: string;
  session_duration_min: string; equipment: string; experience_months: string;
  sport: string; fcmax: string; fcrep: string;
  current_volume_weekly: string; cardio_goal: string;
  stress_score: string; sleep_quality: string; injuries: string;
  notes: string;
}
type Modality = "musculacao" | "corrida" | "natacao" | "ciclismo" | "nutricao";
type GenStatus = "idle" | "generating" | "done" | "error";
type Step = "anamnese" | "avaliacao" | "prescricao" | "editar" | "publicar";
interface AnsweredSummary {
  objective: string; level: string; modality: string; days: string; injuries: string;
}

const CARDIO_MODS: Modality[] = ["corrida", "natacao", "ciclismo"];
const MODALITIES: { key: Modality; icon: any; label: string; sub: string }[] = [
  { key: "musculacao", icon: Dumbbell, label: "Musculação", sub: "Força + biomecânica" },
  { key: "corrida",    icon: Activity, label: "Corrida",    sub: "Zonas FC + periodização" },
  { key: "natacao",    icon: Waves,    label: "Natação",    sub: "Volume + técnica" },
  { key: "ciclismo",   icon: Bike,     label: "Ciclismo",   sub: "Potência + zonas" },
  { key: "nutricao",   icon: Apple,    label: "Nutrição",   sub: "Dicas práticas" },
];
const MOD_LABEL: Record<Modality, string> = {
  musculacao: "Musculação", corrida: "Corrida", natacao: "Natação",
  ciclismo: "Ciclismo", nutricao: "Nutrição",
};

const DEFAULT_ANAMNESE: Anamnese = {
  age: "", body_fat_percent: "", objective: "performance",
  activity_level: "moderado", is_endurance_athlete: false,
  training_modality: "", days_per_week_strength: "3",
  days_per_week_cardio: "0", session_duration_min: "60",
  equipment: "academia_completa", experience_months: "",
  sport: "corrida", fcmax: "", fcrep: "",
  current_volume_weekly: "", cardio_goal: "",
  stress_score: "", sleep_quality: "", injuries: "", notes: "",
};

// ── Mapeamento anamnese respondida pelo aluno → estrutura da prescrição ──
const ACTIVITY_ENUM = ["sedentario", "leve", "moderado", "muito_ativo", "extremo"];
const toInt = (v: any): string => {
  const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? "" : String(n);
};
function inferObjective(goals?: string | null): string {
  const g = (goals || "").toLowerCase();
  if (/emagre|perda|gordura|peso|definic|secar/.test(g)) return "emagrecimento";
  if (/hipertrof|massa|m[uú]sculo|volume|ganho/.test(g)) return "hipertrofia";
  return "performance";
}
function inferSport(mods?: string[] | string | null): string {
  const m = (Array.isArray(mods) ? mods.join(" ") : (mods || "")).toLowerCase();
  if (/nata|swim/.test(m)) return "natacao";
  if (/cicl|bike|pedal/.test(m)) return "ciclismo";
  if (/triat/.test(m)) return "triathlon";
  return "corrida";
}
function nutObjective(o: string): NutritionObjective {
  if (o === "hipertrofia" || o === "emagrecimento" || o === "performance") return o;
  return "manutencao";
}
function nutActivity(a: string): ActivityLevel {
  if (a === "muito_ativo") return "intenso";
  if (a === "extremo") return "muito_intenso";
  if (a === "sedentario" || a === "leve" || a === "moderado") return a;
  return "moderado";
}
function ageFromBirth(birth: string | null): string {
  if (!birth) return "";
  const d = new Date(birth); if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  return String(Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000))));
}

// ── UI helpers (module-level para NÃO remontar os inputs a cada tecla) ──
const inputCls = "h-9 text-sm";
const SI = (props: any) => <Input {...props} className={inputCls} />;
const F = ({ label, span, children }: { label: string; span?: string; children: React.ReactNode }) => (
  <div className={span}>
    <Label className="text-xs text-muted-foreground mb-1">{label}</Label>
    {children}
  </div>
);
const SS = ({ value, onChange, opts, placeholder }: any) => (
  <Select value={value || undefined} onValueChange={onChange}>
    <SelectTrigger className={inputCls}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>{opts.map(([v, l]: [string, string]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
  </Select>
);
type OpenState = { personal: boolean; training: boolean; cardio: boolean; health: boolean };
const Section = ({ id, label, open, setOpen, children }: {
  id: keyof OpenState; label: string;
  open: OpenState; setOpen: React.Dispatch<React.SetStateAction<OpenState>>;
  children: React.ReactNode;
}) => (
  <div className="border border-line rounded-lg overflow-hidden">
    <button
      type="button"
      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-muted/50"
      onClick={() => setOpen(o => ({ ...o, [id]: !o[id] }))}
    >
      {label}
      {open[id] ? <ChevronUp className="h-4 w-4 opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
    </button>
    {open[id] && <div className="px-4 pb-4 pt-2 grid gap-3 grid-cols-2 md:grid-cols-3 border-t border-line">{children}</div>}
  </div>
);

// Blocos de orquestração (6 semanas) — derivados da metodologia BN.
const ORCHESTRATION = [
  { weeks: "Semanas 1-2", title: "Base técnica e tolerância", note: "sem métodos avançados no bloco 1" },
  { weeks: "Semanas 3-4", title: "Acumulação e progressão", note: "progressão dupla / up-set técnico opcional" },
  { weeks: "Semanas 5-6", title: "Consolidação e refino", note: "pirâmide leve se técnica estável" },
];

export default function UnifiedPrescriber() {
  const { user, role, companyId: authCompanyId } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const assistant = useAssistantName();
  const companyId = role === "master"
    ? (isViewingCompany ? viewingCompany?.id ?? null : null)
    : authCompanyId;

  const [students, setStudents]     = useState<Student[]>([]);
  const [search, setSearch]         = useState("");
  const [studentId, setStudentId]   = useState("");
  const [anamnese, setAnamnese]     = useState<Anamnese>(DEFAULT_ANAMNESE);
  const [anamneseId, setAnamneseId] = useState<string | null>(null);
  const [answered, setAnswered]     = useState<AnsweredSummary | null>(null);
  const [assessmentExists, setAssessmentExists] = useState(false);
  const [modalities, setModalities] = useState<Set<Modality>>(new Set(["musculacao"]));
  const [nut, setNut]               = useState({ weight: "", height: "", sex: "masculino" as Sex, meals: "4" });
  const [open, setOpen]             = useState<OpenState>({ personal: true, training: true, cardio: false, health: false });
  const [status, setStatus]         = useState<Record<Modality, GenStatus>>({
    musculacao: "idle", corrida: "idle", natacao: "idle", ciclismo: "idle", nutricao: "idle",
  });
  const [results, setResults]       = useState<Record<Modality, any>>({
    musculacao: null, corrida: null, natacao: null, ciclismo: null, nutricao: null,
  });
  const [editableWorkouts, setEditableWorkouts] = useState<any[]>([]);
  const [cycles, setCycles]         = useState<Cycle[]>([]);
  const [cycleId, setCycleId]       = useState("");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState("");
  const [step, setStep]             = useState<Step>("anamnese");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(0);
  const [selKeys, setSelKeys]       = useState<Set<string>>(new Set());
  const limitations = useStudentLimitations(studentId);

  useEffect(() => {
    if (!companyId) { setStudents([]); return; }
    (async () => {
      const { data: list } = await supabase.from("students")
        .select("id, full_name, gender, birth_date").eq("company_id", companyId).order("full_name");
      setStudents((list as Student[]) || []);
    })();
  }, [companyId]);

  useEffect(() => {
    if (!studentId) { setAnswered(null); return; }
    setStep("anamnese");
    setResults({ musculacao: null, corrida: null, natacao: null, ciclismo: null, nutricao: null });
    setStatus({ musculacao: "idle", corrida: "idle", natacao: "idle", ciclismo: "idle", nutricao: "idle" });
    setEditableWorkouts([]);
    (async () => {
      const s = students.find(x => x.id === studentId);
      const [{ data: sa }, { data: ans }] = await Promise.all([
        supabase.from("student_anamneses").select("*").eq("student_id", studentId).maybeSingle(),
        supabase.from("anamnesis").select("*").eq("student_id", studentId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      // Resumo do que o aluno respondeu (tabela pública `anamnesis`)
      const modality = ans
        ? (Array.isArray(ans.modalities) ? ans.modalities.join(", ") : (ans.modalities || ""))
        : "";
      setAnswered(ans ? {
        objective: ans.goals || (ans as any).data?.objetivo_descricao || "—",
        level: ans.physical_activity_level || "—",
        modality: modality || "—",
        days: ans.training_days || (ans.available_days != null ? String(ans.available_days) : "") || "—",
        injuries: ans.injuries || "—",
      } : null);

      // Mapeamento da anamnese respondida para os campos da prescrição
      const mapped: Partial<Anamnese> = ans ? {
        objective: inferObjective(ans.goals),
        activity_level: ACTIVITY_ENUM.includes(ans.physical_activity_level || "") ? (ans.physical_activity_level as string) : "",
        training_modality: modality,
        session_duration_min: toInt(ans.session_duration),
        days_per_week_strength: toInt(ans.available_days ?? ans.training_days),
        injuries: ans.injuries || "",
        sleep_quality: toInt(ans.sleep_quality),
        stress_score: toInt(ans.stress_level),
        sport: inferSport(ans.modalities),
        cardio_goal: ans.goals || "",
      } : {};

      if (sa) {
        setAnamneseId(sa.id);
        const savedMods = Array.isArray((sa as any).prescribed_modalities)
          ? ((sa as any).prescribed_modalities as string[]).filter((m): m is Modality =>
              ["musculacao", "corrida", "natacao", "ciclismo", "nutricao"].includes(m))
          : [];
        setModalities(new Set(savedMods.length ? (savedMods as Modality[]) : ["musculacao"]));
        const base: Anamnese = {
          age: sa.age?.toString() ?? "",
          body_fat_percent: sa.body_fat_percent?.toString() ?? "",
          objective: sa.objective ?? "performance",
          activity_level: sa.activity_level ?? "moderado",
          is_endurance_athlete: sa.is_endurance_athlete ?? false,
          training_modality: sa.training_modality ?? "",
          days_per_week_strength: sa.days_per_week_strength?.toString() ?? "3",
          days_per_week_cardio: sa.days_per_week_cardio?.toString() ?? "0",
          session_duration_min: sa.session_duration_min?.toString() ?? "60",
          equipment: sa.equipment ?? "academia_completa",
          experience_months: sa.experience_months?.toString() ?? "",
          sport: sa.sport ?? "corrida",
          fcmax: sa.fcmax?.toString() ?? "",
          fcrep: sa.fcrep?.toString() ?? "",
          current_volume_weekly: sa.current_volume_weekly?.toString() ?? "",
          cardio_goal: sa.cardio_goal ?? "",
          stress_score: sa.stress_score?.toString() ?? "",
          sleep_quality: sa.sleep_quality?.toString() ?? "",
          injuries: sa.injuries ?? "",
          notes: sa.notes ?? "",
        };
        const merged: Anamnese = { ...base };
        for (const [k, v] of Object.entries(mapped)) {
          if (v !== undefined && v !== null && v !== "" && (merged as any)[k] === "") (merged as any)[k] = v;
        }
        setAnamnese(merged);
      } else {
        setModalities(new Set(["musculacao"]));
        setAnamneseId(null);
        const merged: Anamnese = { ...DEFAULT_ANAMNESE };
        for (const [k, v] of Object.entries(mapped)) {
          if (v !== undefined && v !== null && v !== "") (merged as any)[k] = v;
        }
        setAnamnese(merged);
      }

      // Nutrição: pré-preenche sexo/idade a partir do cadastro do aluno
      setNut(n => ({
        ...n, weight: "", height: "",
        sex: (s?.gender === "feminino" || s?.gender === "F" || s?.gender === "Feminino") ? "feminino" : "masculino",
      }));

      const { data: assess } = await supabase.from("functional_assessments")
        .select("id").eq("student_id", studentId).limit(1).maybeSingle();
      setAssessmentExists(!!assess);

      // Ciclos de treino do aluno (para publicar)
      const { data: enr } = await supabase.from("enrollments")
        .select("id").eq("student_id", studentId).order("created_at", { ascending: false });
      const enrollmentIds = (enr || []).map(e => e.id);
      if (enrollmentIds.length === 0) { setCycles([]); setCycleId(""); return; }
      const { data: cyc } = await supabase.from("training_cycles")
        .select("id, cycle_number, status, start_date, end_date")
        .in("enrollment_id", enrollmentIds)
        .order("cycle_number", { ascending: true });
      const list = (cyc || []) as Cycle[];
      setCycles(list);
      const active = list.find(c => c.status === "active") || list.find(c => c.status === "pending") || list[0];
      setCycleId(active?.id || "");
    })();
  }, [studentId]);

  useEffect(() => {
    if (CARDIO_MODS.some(m => modalities.has(m))) setOpen(o => ({ ...o, cardio: true }));
  }, [modalities]);

  const set = (k: keyof Anamnese, v: any) => setAnamnese(a => ({ ...a, [k]: v }));
  const toggleMod = (m: Modality) => setModalities(prev => {
    const next = new Set(prev);
    next.has(m) ? next.delete(m) : next.add(m);
    return next;
  });
  const student = students.find(s => s.id === studentId);
  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(search.trim().toLowerCase()));
  const assistantInitials = (assistant.name || "BN").slice(0, 3).toUpperCase();
  const generatedCount = MODALITIES.filter(m => results[m.key]).length;

  async function sendAnamneseWhatsapp() {
    if (!studentId) return;
    setSending(true);
    try {
      const { data, error: e } = await supabase.functions.invoke("whatsapp-manager", {
        body: { action: "send-anamnesis-invite", studentIds: [studentId], baseUrl: window.location.origin },
      });
      if (e) throw e;
      if (data?.sent > 0) toast.success("Convite de anamnese enviado no WhatsApp!");
      else toast.error(data?.failed?.[0]?.reason || "Não foi possível enviar o convite.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar convite.");
    }
    setSending(false);
  }

  function copyAnamneseLink() {
    if (!studentId) return;
    const link = `${window.location.origin}/anamnese/${studentId}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Link de anamnese copiado!"),
      () => toast.error("Não foi possível copiar o link."),
    );
  }

  async function saveAnamnese(): Promise<string> {
    const payload = {
      student_id: studentId, company_id: companyId,
      age: anamnese.age ? Number(anamnese.age) : null,
      body_fat_percent: anamnese.body_fat_percent ? Number(anamnese.body_fat_percent) : null,
      objective: anamnese.objective, activity_level: anamnese.activity_level,
      is_endurance_athlete: anamnese.is_endurance_athlete,
      training_modality: anamnese.training_modality,
      days_per_week_strength: Number(anamnese.days_per_week_strength) || null,
      days_per_week_cardio: Number(anamnese.days_per_week_cardio) || null,
      session_duration_min: Number(anamnese.session_duration_min) || null,
      equipment: anamnese.equipment,
      experience_months: anamnese.experience_months ? Number(anamnese.experience_months) : null,
      sport: anamnese.sport, fcmax: anamnese.fcmax ? Number(anamnese.fcmax) : null,
      fcrep: anamnese.fcrep ? Number(anamnese.fcrep) : null,
      current_volume_weekly: anamnese.current_volume_weekly ? Number(anamnese.current_volume_weekly) : null,
      cardio_goal: anamnese.cardio_goal,
      stress_score: anamnese.stress_score ? Number(anamnese.stress_score) : null,
      sleep_quality: anamnese.sleep_quality ? Number(anamnese.sleep_quality) : null,
      injuries: anamnese.injuries, notes: anamnese.notes,
      prescribed_modalities: [...modalities],
    };
    if (anamneseId) {
      await supabase.from("student_anamneses").update(payload).eq("id", anamneseId);
      return anamneseId;
    }
    const { data, error: e } = await supabase.from("student_anamneses").insert(payload).select("id").single();
    if (e) throw new Error(e.message);
    setAnamneseId(data.id);
    return data.id;
  }

  async function generate() {
    if (!studentId) { const m = "Selecione um aluno antes de gerar a prescrição."; setError(m); toast.error(m); return; }
    if (!companyId) { const m = "Empresa não identificada. Recarregue a página."; setError(m); toast.error(m); return; }
    if (modalities.size === 0) { const m = "Selecione ao menos uma modalidade na anamnese."; setError(m); toast.error(m); return; }
    setGenerating(true); setError("");
    setStatus({ musculacao: "idle", corrida: "idle", natacao: "idle", ciclismo: "idle", nutricao: "idle" });
    setResults({ musculacao: null, corrida: null, natacao: null, ciclismo: null, nutricao: null });

    let strengthPlan: any = null;
    const bundleId = crypto.randomUUID();

    try {
      const savedAnamneseId = await saveAnamnese();

      const { data: assessment } = await supabase
        .from("functional_assessments").select("assessment_json")
        .eq("student_id", studentId).order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      const assessmentCtx = assessment?.assessment_json ?? null;

      // 1) Musculação
      if (modalities.has("musculacao")) {
        setStatus(s => ({ ...s, musculacao: "generating" }));
        const { data, error: e } = await supabase.functions.invoke("ai-prescribe-workout", {
          body: {
            student_id: studentId, student_name: student?.full_name, company_id: companyId,
            anamnese_id: savedAnamneseId, bundle_id: bundleId,
            objective: anamnese.objective, fitness_level: anamnese.activity_level,
            days_per_week: Number(anamnese.days_per_week_strength),
            duration_weeks: 6, equipment: anamnese.equipment, block_number: 1,
            is_endurance_athlete: anamnese.is_endurance_athlete,
            restrictions: anamnese.injuries, notes: anamnese.notes,
            running_days_context: CARDIO_MODS.some(m => modalities.has(m)) ? {
              days_per_week: Number(anamnese.days_per_week_cardio),
              sport: anamnese.sport,
            } : null,
            assessment_context: assessmentCtx,
          },
        });
        if (e || data?.error) throw new Error(data?.error || e?.message);
        strengthPlan = data?.plan;
        setResults(r => ({ ...r, musculacao: data?.plan }));
        setEditableWorkouts((data?.plan?.workouts ?? []).map((w: any) => ({
          ...w, exercises: (w.exercises ?? []).map((ex: any) => ({ ...ex })),
        })));
        setStatus(s => ({ ...s, musculacao: "done" }));
      }

      // 2) Cardio (corrida / natação / ciclismo) — mesmo motor, sport diferente
      for (const cardio of CARDIO_MODS) {
        if (!modalities.has(cardio)) continue;
        setStatus(s => ({ ...s, [cardio]: "generating" }));
        const { data, error: e } = await supabase.functions.invoke("ai-running-plan", {
          body: {
            student_id: studentId, student_name: student?.full_name, company_id: companyId,
            anamnese_id: savedAnamneseId, bundle_id: bundleId,
            sport: cardio, goal: anamnese.cardio_goal || "Melhora de performance geral",
            duration_weeks: 8,
            days_per_week: Number(anamnese.days_per_week_cardio) || 3,
            session_duration: Number(anamnese.session_duration_min),
            current_volume: anamnese.current_volume_weekly ? Number(anamnese.current_volume_weekly) : null,
            fcmax: anamnese.fcmax ? Number(anamnese.fcmax) : null,
            fcrep: anamnese.fcrep ? Number(anamnese.fcrep) : null,
            experience_months: anamnese.experience_months ? Number(anamnese.experience_months) : null,
            tsb: null, eva: {}, injuries: anamnese.injuries,
            diet_type: anamnese.objective,
            strength_plan_context: strengthPlan ? {
              days_per_week: Number(anamnese.days_per_week_strength),
              workouts: strengthPlan.workouts?.map((w: any) => ({
                day: w.day_of_week, focus: w.split_focus,
              })) ?? [],
            } : null,
            assessment_context: assessmentCtx,
          },
        });
        if (e || data?.error) throw new Error(data?.error || e?.message);
        setResults(r => ({ ...r, [cardio]: data?.plan }));
        setStatus(s => ({ ...s, [cardio]: "done" }));
      }

      // 3) Nutrição (motor determinístico local)
      if (modalities.has("nutricao")) {
        setStatus(s => ({ ...s, nutricao: "generating" }));
        const weight = Number(nut.weight);
        const height = Number(nut.height);
        if (!weight || !height) {
          setStatus(s => ({ ...s, nutricao: "error" }));
          throw new Error("Informe peso e altura na seção de Nutrição da anamnese para gerar o plano alimentar.");
        }
        const input: NutritionInput = {
          objective: nutObjective(anamnese.objective),
          sex: nut.sex,
          age: Number(anamnese.age) || Number(ageFromBirth(student?.birth_date ?? null)) || 30,
          weightKg: weight, heightCm: height,
          activity: nutActivity(anamnese.activity_level),
          mealsPerDay: Number(nut.meals) || 4,
        };
        const plan = generateNutritionPlan(input);
        const { error: e } = await supabase.from("nutrition_plans").insert([{
          student_id: studentId, company_id: companyId, created_by: user?.id ?? null,
          title: `Plano Alimentar — ${MOD_LABEL.nutricao}`,
          objective: input.objective, status: "active",
          total_calories: plan.targets.calories, protein_g: plan.targets.protein,
          carbs_g: plan.targets.carbs, fat_g: plan.targets.fat, water_ml: plan.targets.waterMl,
          meals: plan.meals as unknown as object, notes: anamnese.injuries || null,
        }] as never);
        if (e) throw new Error(e.message);
        setResults(r => ({ ...r, nutricao: plan }));
        setStatus(s => ({ ...s, nutricao: "done" }));
      }

      toast.success("Prescrição integrada gerada!");
      if (modalities.has("musculacao")) setStep("editar");
    } catch (err: any) {
      setError(err.message || "Erro ao gerar prescrição.");
      toast.error(err.message || "Erro ao gerar prescrição.");
      setStatus(s => {
        const next = { ...s };
        (Object.keys(next) as Modality[]).forEach(k => { if (next[k] === "generating") next[k] = "error"; });
        return next;
      });
    }
    setGenerating(false);
  }

  // ── Edição de treino (fallback) ────────────────────────────────────────
  const patchEx = (wi: number, ei: number, key: string, val: any) =>
    setEditableWorkouts(ws => ws.map((w, i) => i !== wi ? w : {
      ...w, exercises: w.exercises.map((ex: any, j: number) => j !== ei ? ex : { ...ex, [key]: val }),
    }));
  const removeEx = (wi: number, ei: number) =>
    setEditableWorkouts(ws => ws.map((w, i) => i !== wi ? w : {
      ...w, exercises: w.exercises.filter((_: any, j: number) => j !== ei),
    }));
  const addEx = (wi: number) =>
    setEditableWorkouts(ws => ws.map((w, i) => i !== wi ? w : {
      ...w, exercises: [...w.exercises, { exercise_name: "", sets: 3, reps: "10", rest_seconds: 60, cues: "" }],
    }));
  const removeWorkout = (wi: number) =>
    setEditableWorkouts(ws => ws.filter((_, i) => i !== wi));
  const patchWorkoutName = (wi: number, val: string) =>
    setEditableWorkouts(ws => ws.map((w, i) => i !== wi ? w : { ...w, name: val }));

  // ── Biblioteca de exercícios (seletor + agrupamentos) ───────────────────
  const openPicker = (wi: number) => { setPickerTarget(wi); setPickerOpen(true); };

  const addFromPicker = (exs: LibraryExercise[]) => {
    const wi = pickerTarget;
    setEditableWorkouts(ws => ws.map((w, i) => {
      if (i !== wi) return w;
      const existing = new Set((w.exercises || []).map((e: any) => e.exercise_id).filter(Boolean));
      const toAdd = exs
        .filter(ex => !existing.has(ex.id))
        .map(ex => ({
          exercise_id: ex.id,
          exercise_name: ex.name,
          muscle_group: ex.muscle_group,
          video_url: ex.video_url,
          video_path: ex.video_path,
          sets: 3,
          reps: "10",
          rest_seconds: 60,
          cues: "",
        }));
      return { ...w, exercises: [...(w.exercises || []), ...toAdd] };
    }));
  };

  const toggleExSelect = (wi: number, ei: number) => {
    setSelKeys(prev => {
      const next = new Set(prev);
      const key = `${wi}:${ei}`;
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectedIdxsFor = (wi: number) =>
    (editableWorkouts[wi]?.exercises || [])
      .map((_: any, j: number) => j)
      .filter((j: number) => selKeys.has(`${wi}:${j}`));

  const clearSelForWorkout = (wi: number) =>
    setSelKeys(prev => {
      const next = new Set<string>();
      prev.forEach(k => { if (!k.startsWith(`${wi}:`)) next.add(k); });
      return next;
    });

  const applyGroup = (wi: number, type: GroupType) => {
    const idxs = selectedIdxsFor(wi);
    if (idxs.length < 2) return;
    const gid = (crypto as any).randomUUID ? crypto.randomUUID() : `g-${Date.now()}-${Math.random()}`;
    setEditableWorkouts(ws => ws.map((w, i) => {
      if (i !== wi) return w;
      const minIdx = Math.min(...idxs);
      const selected = idxs.map((j: number) => ({ ...w.exercises[j], group_id: gid, group_type: type }));
      const rest = w.exercises.filter((_: any, j: number) => !idxs.includes(j));
      const arr = [...rest.slice(0, minIdx), ...selected, ...rest.slice(minIdx)];
      return { ...w, exercises: arr };
    }));
    clearSelForWorkout(wi);
  };

  const ungroupSelected = (wi: number) => {
    const idxs = selectedIdxsFor(wi);
    setEditableWorkouts(ws => ws.map((w, i) => {
      if (i !== wi) return w;
      return {
        ...w,
        exercises: w.exercises.map((ex: any, j: number) => {
          if (!idxs.includes(j)) return ex;
          const { group_id, group_type, ...rest } = ex;
          return rest;
        }),
      };
    }));
    clearSelForWorkout(wi);
  };



  // ── Publicar musculação no app do aluno ────────────────────────────────
  async function publishWorkout() {
    if (!cycleId) { toast.error("Selecione um ciclo de treino para publicar."); return; }
    if (editableWorkouts.length === 0) { toast.error("Gere a musculação antes de publicar."); return; }
    if (!user) { toast.error("Sessão expirada. Recarregue a página."); return; }
    setPublishing(true);
    try {
      await supabase.from("workouts").delete().eq("cycle_id", cycleId);
      const rows = editableWorkouts.map((w, i) => ({
        cycle_id: cycleId,
        title: w.name || `Treino ${String.fromCharCode(65 + i)}`,
        description: w.split_focus || null,
        sort_order: i,
        company_id: companyId,
        created_by: user.id,
        exercises: (w.exercises || []).map((ex: any) => ({
          exercise_id: ex.exercise_id ?? null,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group ?? null,
          video_url: ex.video_url ?? null,
          video_path: ex.video_path ?? null,
          sets: Number(ex.sets) || null,
          reps: String(ex.reps ?? ""),
          rest: Number(ex.rest_seconds) || null,
          notes: ex.cues || ex.biomechanical_note || "",
          ...(ex.group_id ? { group_id: ex.group_id } : {}),
          ...(ex.group_type ? { group_type: ex.group_type } : {}),
        })),
      }));
      const { error } = await supabase.from("workouts").insert(rows as any);
      if (error) throw new Error(error.message);
      toast.success("Treino publicado no app do aluno!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao publicar.");
    }
    setPublishing(false);
  }

  // ── PDFs separados por modalidade ───────────────────────────────────────
  function exportPdfs() {
    const name = student?.full_name || "aluno";
    const safe = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    MODALITIES.forEach(({ key, label }) => {
      const res = results[key];
      if (!res) return;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let y = 18;
      const line = (t: string, size = 10, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
        for (const chunk of doc.splitTextToSize(t, 178)) { doc.text(chunk, 16, y); y += size * 0.5; if (y > 280) { doc.addPage(); y = 18; } }
      };
      line(`${label} — ${name}`, 15, true); y += 2;
      if (key === "musculacao") {
        line(`${res.cycle_name || ""}  ·  ${res.objective || ""}  ·  ${res.duration_weeks || 6} semanas`, 9); y += 2;
        (editableWorkouts.length ? editableWorkouts : res.workouts || []).forEach((w: any) => {
          line(w.name || "Treino", 12, true);
          (w.exercises || []).forEach((ex: any) =>
            line(`• ${ex.exercise_name}  —  ${ex.sets}x${ex.reps}  ·  desc ${ex.rest_seconds ?? "-"}s  ${ex.cues ? "· " + ex.cues : ""}`, 9));
          y += 2;
        });
      } else if (key === "nutricao") {
        line(`Meta: ${res.targets.calories} kcal · P ${res.targets.protein}g · C ${res.targets.carbs}g · G ${res.targets.fat}g · Água ${res.targets.waterMl}ml`, 9); y += 2;
        (res.meals || []).forEach((meal: any) => {
          line(`${meal.name} (${meal.time}) — ${meal.kcal} kcal`, 12, true);
          (meal.items || []).forEach((it: any) => line(`• ${it.food} — ${it.amount}`, 9));
          y += 2;
        });
      } else {
        line(`${res.plan_name || label} · ${res.sport || ""} · modelo ${res.model || "-"} · ${res.duration_weeks || 8} semanas`, 9); y += 2;
        if (res.general_tips) line(String(res.general_tips), 9);
        (res.warnings || []).forEach((w: string) => line(`⚠ ${w}`, 9));
      }
      doc.save(`${key}-${safe}.pdf`);
    });
  }

  const genStatusIcon = (s: GenStatus) => {
    if (s === "generating") return <Loader2 className="h-4 w-4 animate-spin text-navy" />;
    if (s === "done")       return <CheckCircle2 className="h-4 w-4 text-navy" />;
    if (s === "error")      return <AlertCircle className="h-4 w-4 text-destructive" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Prescrição</p>
          <h1 className="font-display text-3xl">Studio de Prescrição</h1>
          <p className="text-sm text-muted-foreground">Anamnese → Avaliação → Prescrição → Edição → Publicar no app</p>
        </div>
        <span className="shrink-0 grid place-items-center h-11 w-11 rounded-full bg-navy/10 text-navy font-mono text-xs font-semibold tracking-wide">
          {assistantInitials}
        </span>
      </div>

      {/* Aluno */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aluno</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!companyId ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Nenhuma empresa selecionada. Acesse pelo painel Master "Visualizar empresa" para liberar os alunos.
            </p>
          ) : students.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Nenhum aluno cadastrado nesta empresa ainda.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 text-sm pl-8"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar aluno..."
                />
              </div>
              <SS value={studentId} onChange={setStudentId} placeholder="Selecione..." opts={filteredStudents.map(s => [s.id, s.full_name])} />

              {studentId && (
                <div className="space-y-2 pt-1">
                  <Button className="w-full" onClick={sendAnamneseWhatsapp} disabled={sending}>
                    {sending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
                      : <><Send className="mr-2 h-4 w-4" /> Enviar anamnese no WhatsApp</>}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={copyAnamneseLink}>
                      <Link2 className="mr-2 h-4 w-4" /> Gerar link de anamnese
                    </Button>
                    <Button variant="outline" onClick={() => setStep("prescricao")}>
                      <Sparkles className="mr-2 h-4 w-4" /> Fazer prescrição
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {!studentId && companyId && students.length > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Escolha um aluno para liberar as etapas.
            </p>
          )}
          {studentId && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ClipboardCheck className="h-3 w-3" />
              {assessmentExists
                ? "Avaliação funcional disponível — será usada como contexto."
                : "Sem avaliação funcional. Faça uma na etapa 2 para refinar a prescrição."}
            </p>
          )}
        </CardContent>
      </Card>

      {studentId && (
        <Tabs value={step} onValueChange={(v) => setStep(v as Step)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="anamnese">1. Anamnese</TabsTrigger>
            <TabsTrigger value="avaliacao">2. Avaliação</TabsTrigger>
            <TabsTrigger value="prescricao">3. Prescrição</TabsTrigger>
            <TabsTrigger value="editar">4. Editar</TabsTrigger>
            <TabsTrigger value="publicar">5. Publicar</TabsTrigger>
          </TabsList>

          {/* ETAPA 1 · ANAMNESE */}
          <TabsContent value="anamnese" className="space-y-5 mt-5">
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  {answered
                    ? <CheckCircle2 className="h-4 w-4 text-navy" />
                    : <Circle className="h-4 w-4 text-muted-foreground" />}
                  Anamnese {answered ? "respondida pelo aluno" : "— aguardando resposta"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {answered ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    <p><span className="text-muted-foreground">Objetivo:</span> {answered.objective}</p>
                    <p><span className="text-muted-foreground">Nível:</span> {answered.level}</p>
                    <p><span className="text-muted-foreground">Modalidade:</span> {answered.modality}</p>
                    <p><span className="text-muted-foreground">Dias força/sem:</span> {answered.days}</p>
                    <p className="sm:col-span-2"><span className="text-muted-foreground">Lesões:</span> {answered.injuries}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    O aluno ainda não respondeu. Envie o link acima ou preencha manualmente abaixo.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* O que o aluno vai receber? */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">O que esse aluno vai receber?</CardTitle>
                <p className="text-xs text-muted-foreground">Escolha as modalidades — todas serão geradas e vão para o app do aluno.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {MODALITIES.map(({ key, icon: Icon, label, sub }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleMod(key)}
                      className={`rounded-lg border-2 p-3 text-left transition relative ${
                        modalities.has(key) ? "border-navy bg-navy/5" : "border-line hover:border-navy/40"
                      }`}
                    >
                      {modalities.has(key) && <CheckCircle2 className="h-4 w-4 text-navy absolute top-2 right-2" />}
                      <Icon className="h-5 w-5 mb-1 text-navy" />
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{sub}</div>
                    </button>
                  ))}
                </div>

                {modalities.has("nutricao") && (
                  <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4 border-t border-line pt-4">
                    <F label="Peso (kg)"><SI type="number" step="0.1" value={nut.weight} onChange={(e: any) => setNut(n => ({ ...n, weight: e.target.value }))} /></F>
                    <F label="Altura (cm)"><SI type="number" value={nut.height} onChange={(e: any) => setNut(n => ({ ...n, height: e.target.value }))} /></F>
                    <F label="Sexo">
                      <SS value={nut.sex} onChange={(v: string) => setNut(n => ({ ...n, sex: v as Sex }))}
                        opts={[["masculino", "Masculino"], ["feminino", "Feminino"]]} />
                    </F>
                    <F label="Refeições/dia"><SI type="number" min="3" max="6" value={nut.meals} onChange={(e: any) => setNut(n => ({ ...n, meals: e.target.value }))} /></F>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orquestração */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Orquestração <Badge variant="outline" className="text-xs">6 semanas</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ORCHESTRATION.map((b) => (
                  <div key={b.weeks} className="border border-line rounded-lg p-3">
                    <div className="text-sm font-medium">{b.weeks}</div>
                    <div className="text-sm">{b.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{b.note}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados para a prescrição</CardTitle>
                <p className="text-xs text-muted-foreground">Pré-preenchida pela resposta do aluno — edite se necessário. Usada por todas as IAs.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Section open={open} setOpen={setOpen} id="personal" label="Dados pessoais">
                  <F label="Idade"><SI type="number" value={anamnese.age} onChange={(e: any) => set("age", e.target.value)} /></F>
                  <F label="% Gordura corporal"><SI type="number" step="0.1" value={anamnese.body_fat_percent} onChange={(e: any) => set("body_fat_percent", e.target.value)} placeholder="opc." /></F>
                  <F label="Objetivo">
                    <SS value={anamnese.objective} onChange={(v: string) => set("objective", v)}
                      opts={[["emagrecimento","Emagrecimento"],["hipertrofia","Hipertrofia"],["performance","Performance"]]} />
                  </F>
                  <F label="Nível de atividade">
                    <SS value={anamnese.activity_level} onChange={(v: string) => set("activity_level", v)}
                      opts={[["sedentario","Sedentário"],["leve","Leve"],["moderado","Moderado"],["muito_ativo","Muito ativo"],["extremo","Extremo"]]} />
                  </F>
                  <F label="Lesões / restrições" span="col-span-2 md:col-span-3">
                    <Textarea className="text-sm min-h-[60px]" value={anamnese.injuries} onChange={(e: any) => set("injuries", e.target.value)} placeholder="Ex: dor lombar EVA 2, ombro D sensível" />
                  </F>
                </Section>

                <Section open={open} setOpen={setOpen} id="training" label="Treino">
                  <F label="Dias musculação/semana"><SI type="number" min="0" max="6" value={anamnese.days_per_week_strength} onChange={(e: any) => set("days_per_week_strength", e.target.value)} /></F>
                  <F label="Dias cardio/semana"><SI type="number" min="0" max="7" value={anamnese.days_per_week_cardio} onChange={(e: any) => set("days_per_week_cardio", e.target.value)} /></F>
                  <F label="Duração sessão (min)"><SI type="number" value={anamnese.session_duration_min} onChange={(e: any) => set("session_duration_min", e.target.value)} /></F>
                  <F label="Experiência (meses)"><SI type="number" value={anamnese.experience_months} onChange={(e: any) => set("experience_months", e.target.value)} /></F>
                  <F label="Equipamento">
                    <SS value={anamnese.equipment} onChange={(v: string) => set("equipment", v)}
                      opts={[["academia_completa","Academia completa"],["casa_halteres","Casa (halteres)"],["funcional","Funcional"]]} />
                  </F>
                  <F label="Modalidade principal"><SI value={anamnese.training_modality} onChange={(e: any) => set("training_modality", e.target.value)} placeholder="Ex: corrida + musculação" /></F>
                </Section>

                {(CARDIO_MODS.some(m => modalities.has(m)) || open.cardio) && (
                  <Section open={open} setOpen={setOpen} id="cardio" label="Específico corrida / pedal / natação">
                    <F label="Modalidade">
                      <SS value={anamnese.sport} onChange={(v: string) => set("sport", v)}
                        opts={[["corrida","Corrida"],["ciclismo","Ciclismo"],["natacao","Natação"],["triathlon","Triathlon"]]} />
                    </F>
                    <F label="Objetivo / prova"><SI value={anamnese.cardio_goal} onChange={(e: any) => set("cardio_goal", e.target.value)} placeholder="Ex: Meia maratona em 8 sem." /></F>
                    <F label="Volume atual (km ou h/sem)"><SI type="number" value={anamnese.current_volume_weekly} onChange={(e: any) => set("current_volume_weekly", e.target.value)} /></F>
                    <F label="FC máx (bpm)"><SI type="number" value={anamnese.fcmax} onChange={(e: any) => set("fcmax", e.target.value)} placeholder="vazio = 220-idade" /></F>
                    <F label="FC repouso (bpm)"><SI type="number" value={anamnese.fcrep} onChange={(e: any) => set("fcrep", e.target.value)} placeholder="vazio = 65" /></F>
                  </Section>
                )}

                <Section open={open} setOpen={setOpen} id="health" label="Saúde e bem-estar">
                  <F label="Estresse (0-10)"><SI type="number" min="0" max="10" value={anamnese.stress_score} onChange={(e: any) => set("stress_score", e.target.value)} /></F>
                  <F label="Qualidade do sono (0-10)"><SI type="number" min="0" max="10" value={anamnese.sleep_quality} onChange={(e: any) => set("sleep_quality", e.target.value)} /></F>
                </Section>
              </CardContent>
            </Card>

            <Button className="w-full" onClick={() => setStep("avaliacao")}>
              Avançar para Avaliação <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </TabsContent>

          {/* ETAPA 2 · AVALIAÇÃO */}
          <TabsContent value="avaliacao" className="space-y-5 mt-5">
            <FunctionalAssessmentPanel
              studentId={studentId}
              companyId={companyId}
              studentName={student?.full_name}
            />
            <Button className="w-full" onClick={() => setStep("prescricao")}>
              Avançar para Prescrição <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </TabsContent>

          {/* ETAPA 3 · PRESCRIÇÃO */}
          <TabsContent value="prescricao" className="space-y-5 mt-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prescrições integradas</CardTitle>
                <p className="text-xs text-muted-foreground">Modalidades escolhidas na anamnese: {[...modalities].map(m => MOD_LABEL[m]).join(", ") || "nenhuma"}.</p>
              </CardHeader>
              <CardContent>
                {(generating || Object.values(status).some(s => s !== "idle")) && (
                  <div className="mb-4 space-y-2 border border-line rounded-lg p-4 bg-muted/30">
                    <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Progresso</p>
                    {MODALITIES.filter(m => modalities.has(m.key)).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {genStatusIcon(status[key])}
                        <span>{label} {status[key] === "generating" ? "— gerando…" : status[key] === "done" ? "— concluído" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                {error && <p className="text-sm text-destructive mb-3">{error}</p>}

                <Button className="w-full" onClick={generate} disabled={generating || modalities.size === 0}>
                  {generating
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando prescrições…</>
                    : `Gerar ${modalities.size} prescriç${modalities.size > 1 ? "ões" : "ão"} integrada${modalities.size > 1 ? "s" : ""}`}
                </Button>
              </CardContent>
            </Card>

            {generatedCount > 0 && (
              <>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Prescrições geradas</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {MODALITIES.filter(m => results[m.key]).map(({ key, icon: Icon, label }) => (
                      <div key={key} className="flex items-center gap-2 text-sm border-l-2 border-navy pl-3">
                        <Icon className="h-4 w-4 text-navy" />
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">pronta</span>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full mt-3" onClick={exportPdfs}>
                      <FileDown className="mr-2 h-4 w-4" /> Baixar PDFs separados ({generatedCount})
                    </Button>
                  </CardContent>
                </Card>

                {results.musculacao?.periodization_blocks?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Periodização — {results.musculacao.duration_weeks || 6} semanas</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-2">
                      {results.musculacao.periodization_blocks.map((b: any, i: number) => (
                        <div key={i} className="border border-line rounded-lg p-2 text-center">
                          <div className="font-mono text-[10px] uppercase text-muted-foreground">Sem {b.weeks}</div>
                          <div className="text-xs font-medium mt-0.5">{b.stimulus}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {results.musculacao && (
                  <Button className="w-full" onClick={() => setStep("editar")}>
                    Revisar e editar o treino <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </TabsContent>

          {/* ETAPA 4 · EDITAR TREINO */}
          <TabsContent value="editar" className="space-y-5 mt-5">
            {editableWorkouts.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                Gere a musculação na etapa 3 para editar os treinos aqui.
              </CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Revisar e editar o treino</CardTitle>
                    <p className="text-xs text-muted-foreground">Adicione exercícios da biblioteca, agrupe técnicas e ajuste séries / reps / descanso. Ao publicar, vai a versão editada para o app do aluno.</p>
                  </CardHeader>
                </Card>

                {/* Limitações da anamnese */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Limitações da anamnese
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {limitations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma limitação registrada na anamnese.</p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {limitations.map((lim) => {
                          const severe = (lim.severity || "").toLowerCase().includes("sev");
                          return (
                            <div key={lim.id} className={`rounded-md border p-2.5 ${severe ? "border-destructive/40 bg-destructive/5" : "border-border bg-secondary/40"}`}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {severe && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                                <span className="text-xs font-medium capitalize">{lim.region}</span>
                                {lim.type && <Badge variant="outline" className="text-[10px] capitalize">{lim.type}</Badge>}
                                {lim.severity && <Badge variant={severe ? "destructive" : "secondary"} className="text-[10px] capitalize">{lim.severity}</Badge>}
                              </div>
                              {lim.note && <p className="text-xs text-muted-foreground mt-1">{lim.note}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* BNITO placeholder */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> BNITO — Copiloto técnico
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Revisão técnica do treino antes de publicar.</p>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <Button disabled className="gap-2"><Sparkles className="h-4 w-4" /> Auditar treino</Button>
                    <span className="text-[11px] text-muted-foreground">Em breve</span>
                  </CardContent>
                </Card>

                {editableWorkouts.map((w, wi) => {
                  const sel = selectedIdxsFor(wi);
                  return (
                  <Card key={wi}>
                    <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2">
                      <Input
                        className="h-9 text-sm font-medium"
                        value={w.name}
                        onChange={e => patchWorkoutName(wi, e.target.value)}
                      />
                      <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => removeWorkout(wi)}>
                        Remover treino
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {/* Barra de agrupamento */}
                      {sel.length >= 2 && (
                        <div className="rounded-md border border-primary/30 bg-secondary/60 p-2.5 space-y-2">
                          <p className="text-xs text-muted-foreground">{sel.length} selecionado(s) — agrupar:</p>
                          <TooltipProvider>
                            <div className="flex flex-wrap gap-1.5">
                              {GROUP_ORDER.map((gt) => (
                                <Tooltip key={gt}>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => applyGroup(wi, gt)}>
                                      {GROUP_DEFS[gt].label}
                                      <Info className="h-3 w-3 opacity-60" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[220px] text-xs">{GROUP_DEFS[gt].desc}</TooltipContent>
                                </Tooltip>
                              ))}
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => ungroupSelected(wi)}>Desagrupar</Button>
                            </div>
                          </TooltipProvider>
                        </div>
                      )}

                      <div className="hidden md:grid grid-cols-[28px_1fr_56px_88px_72px_1.3fr_28px] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
                        <span /><span>Exercício</span><span>Sér</span><span>Reps</span><span>Desc(s)</span><span>Obs</span><span />
                      </div>
                      {w.exercises.map((ex: any, ei: number) => {
                        const grouped = !!ex.group_id;
                        const isGroupStart = grouped && (ei === 0 || w.exercises[ei - 1].group_id !== ex.group_id);
                        return (
                        <div key={ei} className={grouped ? "border-l-2 border-primary/60 pl-2" : ""}>
                          {isGroupStart && ex.group_type && (
                            <Badge variant="secondary" className="text-[10px] mb-1">{GROUP_DEFS[ex.group_type as GroupType]?.short || ex.group_type}</Badge>
                          )}
                          <div className="grid grid-cols-[28px_1fr_auto] md:grid-cols-[28px_1fr_56px_88px_72px_1.3fr_28px] gap-2 items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[hsl(var(--primary))]"
                              checked={selKeys.has(`${wi}:${ei}`)}
                              onChange={() => toggleExSelect(wi, ei)}
                            />
                            <Input className="h-8 text-sm col-span-1" value={ex.exercise_name || ""} onChange={e => patchEx(wi, ei, "exercise_name", e.target.value)} placeholder="Exercício" />
                            <Input className="h-8 text-sm hidden md:block" type="number" value={ex.sets ?? ""} onChange={e => patchEx(wi, ei, "sets", e.target.value)} />
                            <Input className="h-8 text-sm hidden md:block" value={ex.reps ?? ""} onChange={e => patchEx(wi, ei, "reps", e.target.value)} />
                            <Input className="h-8 text-sm hidden md:block" type="number" value={ex.rest_seconds ?? ""} onChange={e => patchEx(wi, ei, "rest_seconds", e.target.value)} />
                            <Input className="h-8 text-sm hidden md:block" value={ex.cues ?? ""} onChange={e => patchEx(wi, ei, "cues", e.target.value)} placeholder="Obs" />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeEx(wi, ei)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {/* Campos compactos no mobile */}
                          <div className="grid grid-cols-3 gap-2 md:hidden mt-1 pl-[36px]">
                            <Input className="h-8 text-sm" type="number" value={ex.sets ?? ""} onChange={e => patchEx(wi, ei, "sets", e.target.value)} placeholder="Sér" />
                            <Input className="h-8 text-sm" value={ex.reps ?? ""} onChange={e => patchEx(wi, ei, "reps", e.target.value)} placeholder="Reps" />
                            <Input className="h-8 text-sm" type="number" value={ex.rest_seconds ?? ""} onChange={e => patchEx(wi, ei, "rest_seconds", e.target.value)} placeholder="Desc" />
                          </div>
                        </div>
                        );
                      })}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button variant="default" size="sm" className="gap-1" onClick={() => openPicker(wi)}>
                          <Layers className="h-4 w-4" /> Adicionar da biblioteca
                        </Button>
                        <Button variant="ghost" size="sm" className="text-navy" onClick={() => addEx(wi)}>
                          <Plus className="h-4 w-4 mr-1" /> Linha manual
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}

                <Button className="w-full" onClick={() => setStep("publicar")}>
                  Ir para publicar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </TabsContent>


          {/* ETAPA 5 · PUBLICAR */}
          <TabsContent value="publicar" className="space-y-5 mt-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Publicar treino no app do aluno</CardTitle>
                <p className="text-xs text-muted-foreground">A musculação é gravada no ciclo escolhido. Corrida / natação / ciclismo / nutrição já ficam visíveis ao gerar.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {cycles.length === 0 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Este aluno não tem ciclo de treino. Defina a data de início da matrícula para gerar os ciclos.
                  </p>
                ) : (
                  <F label="Ciclo de treino">
                    <SS
                      value={cycleId}
                      onChange={setCycleId}
                      placeholder="Selecione o ciclo..."
                      opts={cycles.map(c => [c.id, `Ciclo ${c.cycle_number} · ${c.status}${c.start_date ? ` · ${new Date(c.start_date).toLocaleDateString("pt-BR")}` : ""}`])}
                    />
                  </F>
                )}

                {editableWorkouts.length > 0 ? (
                  <p className="text-xs text-muted-foreground">{editableWorkouts.length} treino(s) prontos para publicar.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Gere a musculação para publicar treinos no ciclo.</p>
                )}

                <Button className="w-full" onClick={publishWorkout} disabled={publishing || !cycleId || editableWorkouts.length === 0}>
                  {publishing
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando…</>
                    : <><Rocket className="mr-2 h-4 w-4" /> Publicar treino no app do aluno</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
