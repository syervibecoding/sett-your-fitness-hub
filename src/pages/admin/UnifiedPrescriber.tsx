// ============================================================================
// UnifiedPrescriber — Studio de Prescrição (fluxo em etapas)
//   Topo: seleciona aluno (com busca) + enviar/gerar link de anamnese
//   1. Anamnese  → resumo do que o aluno respondeu + edição (prefill unificado)
//   2. Avaliação → Avaliação Funcional embutida (fotos/vídeo)
//   3. Prescrição → gera musculação e/ou corrida (IA metodologia BN) + PDFs
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, CheckCircle2, Circle, AlertCircle, Dumbbell, Activity,
  ChevronDown, ChevronUp, ClipboardCheck, Send, Link2, Sparkles, Search, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { useAssistantName } from "@/hooks/useAssistantName";
import FunctionalAssessmentPanel from "@/components/admin/FunctionalAssessmentPanel";

interface Student { id: string; full_name: string; }
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
type Modality = "musculacao" | "corrida";
type GenStatus = "idle" | "generating" | "done" | "error";
type Step = "anamnese" | "avaliacao" | "prescricao";
interface AnsweredSummary {
  objective: string; level: string; modality: string; days: string; injuries: string;
}

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

export default function UnifiedPrescriber() {
  const { role, companyId: authCompanyId } = useAuth();
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
  const [open, setOpen]             = useState<OpenState>({ personal: true, training: true, cardio: false, health: false });
  const [status, setStatus]         = useState<Record<Modality, GenStatus>>({ musculacao: "idle", corrida: "idle" });
  const [results, setResults]       = useState<Record<Modality, any>>({ musculacao: null, corrida: null });
  const [generating, setGenerating] = useState(false);
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState("");
  const [step, setStep]             = useState<Step>("anamnese");

  useEffect(() => {
    if (!companyId) { setStudents([]); return; }
    (async () => {
      const { data: list } = await supabase.from("students")
        .select("id, full_name").eq("company_id", companyId).order("full_name");
      setStudents(list || []);
    })();
  }, [companyId]);

  useEffect(() => {
    if (!studentId) { setAnswered(null); return; }
    setStep("anamnese");
    (async () => {
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
        // student_anamneses tem prioridade; a resposta do aluno só preenche vazios
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
        setAnamneseId(null);
        const merged: Anamnese = { ...DEFAULT_ANAMNESE };
        for (const [k, v] of Object.entries(mapped)) {
          if (v !== undefined && v !== null && v !== "") (merged as any)[k] = v;
        }
        setAnamnese(merged);
      }

      const { data: assess } = await supabase.from("functional_assessments")
        .select("id").eq("student_id", studentId).limit(1).maybeSingle();
      setAssessmentExists(!!assess);
    })();
  }, [studentId]);

  useEffect(() => {
    if (modalities.has("corrida")) setOpen(o => ({ ...o, cardio: true }));
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
    if (!studentId) {
      const msg = "Selecione um aluno antes de gerar a prescrição.";
      setError(msg); toast.error(msg); return;
    }
    if (!companyId) { const msg = "Empresa não identificada. Recarregue a página."; setError(msg); toast.error(msg); return; }
    if (modalities.size === 0) { const msg = "Selecione ao menos uma prescrição."; setError(msg); toast.error(msg); return; }
    setGenerating(true); setError("");
    setStatus({ musculacao: "idle", corrida: "idle" });
    setResults({ musculacao: null, corrida: null });

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
            running_days_context: modalities.has("corrida") ? {
              days_per_week: Number(anamnese.days_per_week_cardio),
              sport: anamnese.sport,
            } : null,
            assessment_context: assessmentCtx,
          },
        });
        if (e || data?.error) throw new Error(data?.error || e?.message);
        strengthPlan = data?.plan;
        setResults(r => ({ ...r, musculacao: data?.plan }));
        setStatus(s => ({ ...s, musculacao: "done" }));
      }

      // 2) Corrida
      if (modalities.has("corrida")) {
        setStatus(s => ({ ...s, corrida: "generating" }));
        const { data, error: e } = await supabase.functions.invoke("ai-running-plan", {
          body: {
            student_id: studentId, student_name: student?.full_name, company_id: companyId,
            anamnese_id: savedAnamneseId, bundle_id: bundleId,
            sport: anamnese.sport, goal: anamnese.cardio_goal || "Melhora de performance geral",
            duration_weeks: 8,
            days_per_week: Number(anamnese.days_per_week_cardio),
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
                day: w.day_of_week,
                focus: w.split_focus,
                has_heavy_legs: w.exercises?.some((ex: any) =>
                  ["forca_global", "controle_motor"].includes(ex.phase) &&
                  ["quadríceps", "posterior", "glúteos"].some(m => ex.muscle_group?.toLowerCase().includes(m))
                ),
              })) ?? [],
            } : null,
            assessment_context: assessmentCtx,
          },
        });
        if (e || data?.error) throw new Error(data?.error || e?.message);
        setResults(r => ({ ...r, corrida: data?.plan }));
        setStatus(s => ({ ...s, corrida: "done" }));
      }

      toast.success("Prescrição integrada gerada!");
    } catch (err: any) {
      setError(err.message || "Erro ao gerar prescrição.");
      toast.error(err.message || "Erro ao gerar prescrição.");
      setStatus(s => ({
        musculacao: s.musculacao === "generating" ? "error" : s.musculacao,
        corrida: s.corrida === "generating" ? "error" : s.corrida,
      }));
    }
    setGenerating(false);
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
          <p className="text-sm text-muted-foreground">Anamnese → Avaliação → Prescrições integradas → PDFs</p>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="anamnese">1. Anamnese</TabsTrigger>
            <TabsTrigger value="avaliacao">2. Avaliação</TabsTrigger>
            <TabsTrigger value="prescricao">3. Prescrição</TabsTrigger>
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
                  <div className="col-span-2 md:col-span-3 flex items-center gap-2 pt-1">
                    <Checkbox checked={anamnese.is_endurance_athlete} onCheckedChange={v => set("is_endurance_athlete", !!v)} id="endurance" />
                    <label htmlFor="endurance" className="text-sm cursor-pointer">Atleta de endurance (corrida / triathlon)</label>
                  </div>
                </Section>

                {(modalities.has("corrida") || open.cardio) && (
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
              <CardHeader className="pb-3"><CardTitle className="text-base">Quais prescrições gerar?</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["musculacao", Dumbbell, "Musculação", "Força + biomecânica"],
                    ["corrida", Activity, "Corrida / Pedal / Natação", "Zonas FC + periodização"],
                  ] as [Modality, any, string, string][]).map(([mod, Icon, label, sub]) => (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => toggleMod(mod)}
                      className={`rounded-lg border-2 p-3 text-left transition ${
                        modalities.has(mod) ? "border-navy bg-navy/5" : "border-line hover:border-navy/40"
                      }`}
                    >
                      <Icon className="h-5 w-5 mb-1 text-navy" />
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{sub}</div>
                    </button>
                  ))}
                </div>

                {(generating || Object.values(status).some(s => s !== "idle")) && (
                  <div className="mt-4 space-y-2 border border-line rounded-lg p-4 bg-muted/30">
                    <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Progresso</p>
                    {modalities.has("musculacao") && (
                      <div className="flex items-center gap-2 text-sm">
                        {genStatusIcon(status.musculacao)}
                        <span>Musculação {status.musculacao === "generating" ? "— gerando plano de força…" : status.musculacao === "done" ? "— concluído" : ""}</span>
                      </div>
                    )}
                    {modalities.has("corrida") && (
                      <div className="flex items-center gap-2 text-sm">
                        {genStatusIcon(status.corrida)}
                        <span>Corrida {status.corrida === "generating" ? "— calculando zonas FC e periodização…" : status.corrida === "done" ? "— concluído" : ""}</span>
                        {modalities.has("musculacao") && status.corrida !== "idle" && (
                          <Badge variant="outline" className="text-xs">sincroniza com musculação</Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="text-sm text-destructive mt-3">{error}</p>}

                <Button className="w-full mt-4" onClick={generate} disabled={generating || modalities.size === 0}>
                  {generating
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando prescrições…</>
                    : `Gerar ${modalities.size} prescriç${modalities.size > 1 ? "ões" : "ão"} integrada${modalities.size > 1 ? "s" : ""}`}
                </Button>
              </CardContent>
            </Card>

            {Object.values(results).some(Boolean) && (
              <div className="space-y-4">
                <h2 className="font-display text-xl">Prescrições geradas</h2>
                {results.musculacao && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Dumbbell className="h-4 w-4 text-navy" /> Musculação — {results.musculacao.cycle_name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{results.musculacao.objective} · {results.musculacao.duration_weeks} semanas</p>
                    </CardHeader>
                    <CardContent>
                      {results.musculacao.biomechanical_notes && (
                        <p className="text-xs bg-muted rounded p-2 mb-3">{results.musculacao.biomechanical_notes}</p>
                      )}
                      <div className="space-y-2">
                        {results.musculacao.workouts?.map((w: any, i: number) => (
                          <div key={i} className="text-sm border-l-2 border-navy pl-3">
                            <span className="font-medium">{w.name}</span>
                            <span className="text-muted-foreground text-xs ml-2">{w.split_focus} · {w.duration_min}min</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {results.corrida && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4 text-navy" /> {results.corrida.plan_name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{results.corrida.sport} · modelo {results.corrida.model} · {results.corrida.duration_weeks} semanas</p>
                    </CardHeader>
                    <CardContent>
                      {results.corrida.fc_zones && (
                        <div className="grid grid-cols-5 gap-1 text-xs text-center mb-3">
                          {["z1","z2","z3","z4","z5"].map(z => results.corrida.fc_zones[z] && (
                            <div key={z} className="border border-line rounded p-1">
                              <div className="font-medium uppercase">{z}</div>
                              <div className="text-muted-foreground">{results.corrida.fc_zones[z].min}–{results.corrida.fc_zones[z].max}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {results.corrida.warnings?.length > 0 && (
                        <p className="text-xs text-navy bg-navy/5 rounded p-2 mb-2">{results.corrida.warnings[0]}</p>
                      )}
                      {results.corrida.general_tips && (
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{results.corrida.general_tips}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
