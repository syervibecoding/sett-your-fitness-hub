// ============================================================================
// PrescriptionStudio.tsx — BN Performance Training
// Página PRINCIPAL do treinador. Junta tudo:
//   Tab 1: Anamnese (enviar link ou ver resposta do aluno)
//   Tab 2: Avaliação (vídeo → frames → IA → edição)  [usa VideoAssessment]
//   Tab 3: Prescrição (checkboxes de modalidade → gera integrado → PDFs separados)
// Cole em: src/pages/admin/PrescriptionStudio.tsx
//
// Instalar:  npm i jspdf
// ============================================================================
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import {
  Loader2, Copy, CheckCircle2, Circle, AlertCircle, Send, Download, Wand2,
  Dumbbell, Activity, Waves, Bike, Apple, FileText,
} from "lucide-react";
import VideoAssessment from "@/components/VideoAssessment";
import { generateAllPDFs } from "@/lib/generatePDFs";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/studioUi";
import { BnitoContextButton } from "@/components/BnitoFloatingAssistant";
import {
  buildBnitoOrchestrationPlan,
  buildPrescriptionIntegration,
  formatPrescriptionIntegrationSummary,
} from "@/lib/prescriptionIntegration";
import { readEdgeError } from "@/lib/edgeError";

type Modality = "musculacao" | "corrida" | "natacao" | "ciclismo" | "nutricao";
type GenStatus = "idle" | "generating" | "done" | "error";
const db = supabase as any;

const MODALITIES: { id: Modality; icon: any; label: string; sub: string }[] = [
  { id: "musculacao", icon: Dumbbell, label: "Musculação", sub: "Força + biomecânica" },
  { id: "corrida",    icon: Activity, label: "Corrida",    sub: "Zonas FC + periodização" },
  { id: "natacao",    icon: Waves,    label: "Natação",    sub: "Volume + técnica" },
  { id: "ciclismo",   icon: Bike,     label: "Ciclismo",   sub: "Potência + zonas" },
  { id: "nutricao",   icon: Apple,    label: "Nutrição",   sub: "Dicas práticas" },
];

export default function PrescriptionStudio() {
  const nav = useNavigate();
  // Empresa efetiva: master usa a empresa visualizada (MasterContext); staff usa a sua.
  // (Antes filtrava por company_members → master sem linha ficava travado.)
  const { user, companyId: authCompanyId, role, loading: authLoading } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const effectiveCompanyId = role === "master" ? (isViewingCompany ? viewingCompany?.id ?? null : null) : authCompanyId ?? null;
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [students, setStudents]   = useState<{ id: string; name: string; email?: string | null }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [tab, setTab]             = useState("anamnese");

  // Anamnese state
  const [anamnese, setAnamnese]       = useState<any>(null);
  const [inviteLink, setInviteLink]   = useState("");
  const [copying, setCopying]         = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessment, setAssessment]   = useState<any>(null);

  // Prescrição state
  const [modalities, setModalities]   = useState<Set<Modality>>(new Set(["musculacao"]));
  const [status, setStatus]           = useState<Record<string, GenStatus>>({});
  const [results, setResults]         = useState<Record<string, any>>({});
  const [generating, setGenerating]   = useState(false);
  const [error, setError]             = useState("");
  const [pdfs, setPdfs]               = useState<any[]>([]);

  // ── Gate de auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav("/auth"); return; }
    setAuthChecked(true);
  }, [authLoading, user, nav]);

  // ── Carrega alunos da empresa efetiva ─────────────────────────────────────
  useEffect(() => {
    if (!effectiveCompanyId) { setCompanyId(null); setStudents([]); return; }
    setCompanyId(effectiveCompanyId);
    (async () => {
      const { data: list } = await supabase
        .from("students")
        .select("id, full_name, email")
        .eq("company_id", effectiveCompanyId)
        .order("full_name");
      setStudents((list || []).map((s: any) => ({ id: s.id, name: s.full_name, email: s.email })));
    })();
  }, [effectiveCompanyId]);

  // ── Carrega anamnese + avaliação ao trocar aluno ────────────────────────
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const { data: a } = await db.from("student_anamneses").select("*").eq("student_id", studentId).maybeSingle();
      setAnamnese(a);
      const { data: assess } = await db.from("functional_assessments")
        .select("id, assessment_json, report_text, created_at").eq("student_id", studentId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setAssessment(assess);
      setAssessmentId(assess?.id || null);
      setInviteLink("");
    })();
  }, [studentId]);

  const student = students.find(s => s.id === studentId);
  const assessmentContext = assessment?.assessment_json
    ? { ...assessment.assessment_json, report_text: assessment.report_text, id: assessment.id, created_at: assessment.created_at }
    : null;
  const prescriptionIntegration = useMemo(
    () => buildPrescriptionIntegration({
      anamnese,
      assessment: assessmentContext,
      assessmentId,
      assessmentCreatedAt: assessment?.created_at,
    }),
    [anamnese, assessmentContext, assessmentId, assessment?.created_at],
  );
  const bnitoOrchestration = useMemo(
    () => buildBnitoOrchestrationPlan(prescriptionIntegration),
    [prescriptionIntegration],
  );
  const toggleMod = (m: Modality) => setModalities(prev => {
    const next = new Set(prev);
    next.has(m) ? next.delete(m) : next.add(m);
    return next;
  });

  // ── Gera link de anamnese para enviar ao aluno ──────────────────────────
  async function createInvite() {
    if (!studentId || !companyId) return;
    setCreatingInvite(true);
    const token = crypto.randomUUID().replace(/-/g, "");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: inviteError } = await db.from("anamnese_invites").insert({
      company_id: companyId, student_id: studentId, token,
      student_name: student?.name, created_by: user?.id, status: "pending",
    });
    if (inviteError) {
      setError(inviteError.message);
      setCreatingInvite(false);
      return;
    }
    const link = `${window.location.origin}/anamnese-convite/${token}`;
    setInviteLink(link);
    setCreatingInvite(false);
  }
  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopying(true); setTimeout(() => setCopying(false), 1500);
  }
  async function createInviteAndCopy() {
    if (!studentId) return;
    if (!inviteLink) {
      await createInvite();
      return;
    }
    copyLink();
  }

  // ── Geração integrada das prescrições marcadas ──────────────────────────
  async function generate() {
    if (!studentId || !companyId) { setError("Selecione um aluno."); return; }
    if (modalities.size === 0) { setError("Marque ao menos uma modalidade."); return; }
    setGenerating(true); setError(""); setPdfs([]);
    const st: Record<string, GenStatus> = {};
    modalities.forEach(m => st[m] = "idle");
    setStatus(st);
    setResults({});

    const newResults: Record<string, any> = {};
    let strengthPlan: any = null;
    const cardioPlans: Record<string, any> = {};

    try {
      // Avaliação funcional como contexto
      const assessmentCtx = assessmentContext;
      const integrationCtx = buildPrescriptionIntegration({
        anamnese,
        assessment: assessmentCtx,
        assessmentId,
        assessmentCreatedAt: assessment?.created_at,
      });
      const orchestrationCtx = buildBnitoOrchestrationPlan(integrationCtx);
      const a = anamnese || {};

      // ── 1. MUSCULAÇÃO ──────────────────────────────────────────────
      if (modalities.has("musculacao")) {
        setStatus(s => ({ ...s, musculacao: "generating" }));
        const cardioDays = ["corrida","natacao","ciclismo"].filter(m => modalities.has(m as Modality)).length
          ? Number(a.days_per_week_cardio) || 0 : 0;
        const { data, error: e } = await supabase.functions.invoke("ai-prescribe-workout", {
          body: {
            student_id: studentId, student_name: student?.name, company_id: companyId,
            anamnese_id: a.id, objective: a.objective, fitness_level: a.activity_level,
            days_per_week: Number(a.days_per_week_strength) || 3, duration_weeks: 6,
            equipment: a.equipment, block_number: 1,
            is_endurance_athlete: a.is_endurance_athlete,
            restrictions: a.injuries, notes: a.notes,
            running_days_context: cardioDays > 0 ? { days_per_week: cardioDays, sport: a.sport } : null,
            assessment_context: assessmentCtx,
            anamnese_context: a,
            prescription_integration: integrationCtx,
            bnito_orchestration: orchestrationCtx,
          },
        });
        if (e || data?.error) throw new Error((await readEdgeError(e, data)) || "Falha na geração.");
        strengthPlan = data?.plan; newResults.musculacao = data?.plan;
        setResults({ ...newResults }); setStatus(s => ({ ...s, musculacao: "done" }));
      }

      // ── 2. MODALIDADES CARDIO (corrida, natação, ciclismo) ─────────
      const sportMap: Record<string,string> = { corrida: "corrida", natacao: "natacao", ciclismo: "ciclismo" };
      for (const mod of ["corrida","natacao","ciclismo"] as Modality[]) {
        if (!modalities.has(mod)) continue;
        setStatus(s => ({ ...s, [mod]: "generating" }));
        const { data, error: e } = await supabase.functions.invoke("ai-running-plan", {
          body: {
            student_id: studentId, student_name: student?.name, company_id: companyId,
            anamnese_id: a.id, sport: sportMap[mod],
            goal: a.cardio_goal || "Melhora de performance",
            duration_weeks: 6, days_per_week: Number(a.days_per_week_cardio) || 3,
            session_duration: Number(a.session_duration_min) || 60,
            current_volume: a.current_volume_weekly, fcmax: a.fcmax, fcrep: a.fcrep,
            experience_months: a.experience_months, injuries: a.injuries,
            strength_plan_context: strengthPlan ? {
              days_per_week: Number(a.days_per_week_strength) || 3,
              workouts: (strengthPlan.workouts || []).map((w: any) => ({
                day: w.day_of_week, focus: w.split_focus,
                has_heavy_legs: (w.exercises || []).some((ex: any) =>
                  ["quadríceps","posterior","glúteos"].some(mg => (ex.muscle_group||"").toLowerCase().includes(mg))),
              })),
            } : null,
            // outras modalidades cardio já geradas (evita treinar tudo no mesmo dia)
            other_cardio_context: Object.keys(cardioPlans).length ? cardioPlans : null,
            assessment_context: assessmentCtx,
            anamnese_context: a,
            prescription_integration: integrationCtx,
            bnito_orchestration: orchestrationCtx,
          },
        });
        if (e || data?.error) throw new Error((await readEdgeError(e, data)) || "Falha na geração.");
        cardioPlans[mod] = data?.plan; newResults[mod] = data?.plan;
        setResults({ ...newResults }); setStatus(s => ({ ...s, [mod]: "done" }));
      }

      // ── 3. NUTRIÇÃO (recebe TODA a carga de treino) ─────────────────
      if (modalities.has("nutricao")) {
        setStatus(s => ({ ...s, nutricao: "generating" }));
        const { data: sd } = await db.from("students")
          .select("weight_kg, height_cm, gender, birth_date").eq("id", studentId).maybeSingle();
        const age = a.age || (sd?.birth_date
          ? Math.floor((Date.now() - new Date(sd.birth_date).getTime()) / 31557600000) : null);

        const totalCardioHours = Object.keys(cardioPlans).reduce((sum, k) =>
          sum + (cardioPlans[k]?.volume_weekly_hours || 0), 0);

        const { data, error: e } = await supabase.functions.invoke("ai-nutrition-plan", {
          body: {
            student_id: studentId, student_name: student?.name, company_id: companyId,
            anamnese_id: a.id, age, gender: sd?.gender || "M",
            weight_kg: sd?.weight_kg, height_cm: sd?.height_cm,
            body_fat_percent: a.body_fat_percent, objective: a.objective,
            activity_level: a.activity_level, is_endurance_athlete: a.is_endurance_athlete,
            meals_per_day: Number(a.meals_per_day) || 5,
            food_restrictions: a.food_restrictions, budget: a.budget_food,
            stress_score: a.stress_score, sleep_quality: a.sleep_quality,
            has_microwave: a.has_kitchen,
            nutrition_context: a.nutrition_context, // horários de refeição/treino, jejum, apetite, gostos/restrições
            training_modality: Array.from(modalities).filter(m => m !== "nutricao").join(" + "),
            // CONTEXTO INTEGRADO: carga total real
            strength_plan_context: strengthPlan ? {
              sessions_per_week: Number(a.days_per_week_strength) || 3,
              session_duration_min: Number(a.session_duration_min) || 60,
              estimated_weekly_kcal: (Number(a.days_per_week_strength)||3) * (Number(a.session_duration_min)||60)/60 * 450,
            } : null,
            running_plan_context: Object.keys(cardioPlans).length ? {
              modalities: Object.keys(cardioPlans),
              volume_weekly_hours: totalCardioHours,
              estimated_weekly_kcal: totalCardioHours * 700,
            } : null,
            anamnese_context: a,
            prescription_integration: integrationCtx,
            bnito_orchestration: orchestrationCtx,
          },
        });
        if (e || data?.error) throw new Error((await readEdgeError(e, data)) || "Falha na geração.");
        newResults.nutricao = data?.plan;
        setResults({ ...newResults }); setStatus(s => ({ ...s, nutricao: "done" }));
      }

      // ── Salva bundle ───────────────────────────────────────────────
      await db.from("prescription_bundles").insert({
        id: crypto.randomUUID(), company_id: companyId, student_id: studentId,
        anamnese_id: a.id, assessment_id: integrationCtx.sources.assessment_id,
        modalities: Array.from(modalities),
        has_strength: modalities.has("musculacao"),
        has_cardio: modalities.has("corrida"),
        has_swimming: modalities.has("natacao"),
        has_cycling: modalities.has("ciclismo"),
        has_nutrition: modalities.has("nutricao"),
        notes: [
          formatPrescriptionIntegrationSummary(integrationCtx),
          `BNITO: periodizacao de ${orchestrationCtx.duration_weeks} semanas em blocos de ${orchestrationCtx.block_length_weeks} semanas.`,
        ].join("\n"),
        status: "active",
      });

    } catch (e: any) {
      setError(e.message);
    }
    setGenerating(false);
  }

  // ── Gera os PDFs separados ──────────────────────────────────────────────
  function downloadPDFs() {
    const meta = {
      studentName: student?.name || "Aluno",
      date: new Date().toLocaleDateString("pt-BR"),
    };
    const generated = generateAllPDFs(results, meta);
    setPdfs(generated);
    // Baixa todos
    generated.forEach(g => g.doc.save(g.filename));
  }

  const statusIcon = (s: GenStatus) => {
    if (s === "generating") return <Loader2 className="h-4 w-4 animate-spin text-[#8B7355]" />;
    if (s === "done")       return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (s === "error")      return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <Circle className="h-4 w-4 text-slate-300" />;
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3 pt-1">
        <div className="h-11 w-11 rounded-xl bg-[#1B2B4A] flex items-center justify-center text-white font-black tracking-tight shadow-sm">BN</div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">Studio de Prescrição</h1>
            <BnitoContextButton
              label="studio de prescricao"
              context="Fluxo principal do treinador: anamnese, avaliacao, prescricoes integradas e PDFs."
              question="Me orienta no fluxo completo deste aluno: anamnese, avaliacao, prescricao e PDF?"
            />
          </div>
          <p className="text-xs text-[#8B7355] font-medium">Anamnese → Avaliação → Prescrições integradas → PDFs</p>
        </div>
      </div>

      {/* Seleção de aluno */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Aluno
            <BnitoContextButton
              label="aluno no studio"
              context="Seleciona o aluno e permite gerar link de anamnese ou iniciar prescricao."
              question="O que devo conferir antes de abrir a prescricao deste aluno no Studio?"
              className="ml-auto"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {students.length > 0 ? (
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
              <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Nenhum aluno encontrado para esta empresa.
            </div>
          )}
          {studentId && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={createInviteAndCopy} disabled={creatingInvite} className="bg-[#1B2B4A] hover:bg-[#1B2B4A]/90">
                {creatingInvite ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : inviteLink ? <Copy className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {inviteLink ? (copying ? "Link copiado" : "Copiar anamnese") : "Gerar link de anamnese"}
              </Button>
              <Button onClick={() => setTab("prescricao")} variant="outline">
                <Wand2 className="h-4 w-4 mr-2" /> Fazer prescrição
              </Button>
            </div>
          )}
          {inviteLink && (
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="text-sm" />
              <Button onClick={copyLink} variant="outline">
                {copying ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {studentId && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="anamnese">1. Anamnese</TabsTrigger>
            <TabsTrigger value="avaliacao">2. Avaliação</TabsTrigger>
            <TabsTrigger value="prescricao">3. Prescrição</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: ANAMNESE ── */}
          <TabsContent value="anamnese" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-5">
                <div className="mb-3 flex justify-end">
                  <BnitoContextButton
                    label="tab anamnese do Studio"
                    context="Etapa de anamnese do Studio: link publico, resposta do aluno e dados que alimentam a prescricao."
                    question="Como devo conduzir a anamnese antes de prescrever?"
                    text="BNITO"
                  />
                </div>
                {anamnese ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Anamnese respondida pelo aluno
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mt-2">
                      <div>Objetivo: <span className="font-medium text-slate-800">{anamnese.objective || "—"}</span></div>
                      <div>Nível: <span className="font-medium text-slate-800">{anamnese.activity_level || "—"}</span></div>
                      <div>Modalidade: <span className="font-medium text-slate-800">{anamnese.training_modality || "—"}</span></div>
                      <div>Dias força/sem: <span className="font-medium text-slate-800">{anamnese.days_per_week_strength || "—"}</span></div>
                    </div>
                    {anamnese.injuries && <p className="text-xs bg-slate-50 rounded p-2 mt-2">Lesões: {anamnese.injuries}</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">Este aluno ainda não respondeu a anamnese. Gere um link e envie para ele preencher:</p>
                    {!inviteLink ? (
                      <Button onClick={createInvite} disabled={creatingInvite} className="bg-[#1B2B4A] hover:bg-[#1B2B4A]/90">
                        {creatingInvite ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Gerar link de anamnese
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Input value={inviteLink} readOnly className="text-sm" />
                        <Button onClick={copyLink} variant="outline">
                          {copying ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                    {inviteLink && <p className="text-xs text-slate-400">Envie esse link pelo WhatsApp. Quando o aluno responder, a anamnese aparece aqui.</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 2: AVALIAÇÃO ── */}
          <TabsContent value="avaliacao" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <BnitoContextButton
                label="tab avaliacao do Studio"
                context="Etapa de avaliacao do Studio, incluindo video, frames e IA para compensacoes funcionais."
                question="O que devo observar nesta avaliacao antes de montar o treino?"
                text="BNITO"
              />
            </div>
            {assessment && (
              <Card><CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Avaliação já realizada
                  <Badge variant="outline" className="text-xs">{assessment.assessment_json?.total_compensacoes || 0} compensações</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">Gere uma nova abaixo se quiser refazer.</p>
              </CardContent></Card>
            )}
            <VideoAssessment
              studentId={studentId}
              companyId={companyId!}
              onComplete={(id, videoResult) => {
                setAssessmentId(id);
                if (videoResult) {
                  setAssessment({
                    id,
                    assessment_json: videoResult.assessment_json,
                    report_text: videoResult.report_text,
                    created_at: new Date().toISOString(),
                  });
                }
                setTab("prescricao");
              }}
            />
          </TabsContent>

          {/* ── TAB 3: PRESCRIÇÃO ── */}
          <TabsContent value="prescricao" className="space-y-4 mt-4">
            {!anamnese && (
              <Card><CardContent className="pt-4">
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Recomendado: o aluno responder a anamnese primeiro (Tab 1).
                </p>
              </CardContent></Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Resultado integrado para prescrição
                  <Badge variant={prescriptionIntegration.readiness.status === "pronto" ? "default" : "outline"} className="text-xs">
                    {prescriptionIntegration.readiness.status}
                  </Badge>
                  <BnitoContextButton
                    label="resultado integrado"
                    context="Resumo tecnico que cruza anamnese, avaliacao funcional, restricoes, objetivo e regras para a IA prescritoras."
                    question="Revise este resultado integrado e me diga quais cuidados devo manter na prescricao."
                    className="ml-auto"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-slate-600">{prescriptionIntegration.readiness.reason}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-slate-200 p-2">
                    Anamnese: {prescriptionIntegration.sources.has_anamnese ? "ok" : "pendente"}
                  </div>
                  <div className="rounded border border-slate-200 p-2">
                    Avaliação: {prescriptionIntegration.sources.has_assessment ? "ok" : "pendente"}
                  </div>
                </div>
                {prescriptionIntegration.functional_findings.priorities.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Prioridades funcionais</p>
                    <ul className="space-y-1 text-slate-600">
                      {prescriptionIntegration.functional_findings.priorities.slice(0, 4).map((item, index) => (
                        <li key={index}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {prescriptionIntegration.prescription_decision.exercise_selection_rules.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Regras para a IA</p>
                    <ul className="space-y-1 text-slate-600">
                      {prescriptionIntegration.prescription_decision.exercise_selection_rules.slice(0, 4).map((item, index) => (
                        <li key={index}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Orquestração BNITO
                  <Badge variant="outline" className="text-xs">6 semanas</Badge>
                  <BnitoContextButton
                    label="orquestracao BNITO"
                    context="BNITO unifica os agentes de musculacao, corrida e nutricao em um ciclo de 6 semanas com trocas de estimulo a cada 2 semanas."
                    question="Revise a orquestracao de 6 semanas e me diga onde preciso tomar cuidado antes de gerar."
                    className="ml-auto"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                {bnitoOrchestration.blocks.map((block) => (
                  <div key={block.block} className="rounded border border-slate-200 p-3">
                    <p className="font-medium text-slate-800">Semanas {block.weeks[0]}-{block.weeks[1]}</p>
                    <p className="mt-1">{block.name}</p>
                    <p className="mt-2 text-slate-400">{block.advanced_methods.join(", ")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  O que esse aluno vai receber?
                  <BnitoContextButton
                    label="modalidades do Studio"
                    context="Escolha de musculacao, corrida, natacao, ciclismo e nutricao no Studio."
                    question="Quais modalidades fazem sentido para este aluno e como evitar excesso de carga?"
                    className="ml-auto"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {MODALITIES.map(({ id, icon: Icon, label, sub }) => (
                    <button key={id} onClick={() => toggleMod(id)}
                      className={`relative rounded-xl border-2 p-3 text-left transition ${
                        modalities.has(id) ? "border-[#8B7355] bg-[#F5EDD8]/50 shadow-sm" : "border-slate-200 hover:border-[#8B7355]/40 hover:bg-slate-50"}`}>
                      {modalities.has(id) && <CheckCircle2 className="h-4 w-4 text-[#8B7355] absolute top-2 right-2" />}
                      <Icon className={`h-5 w-5 mb-1 ${modalities.has(id) ? "text-[#8B7355]" : "text-slate-400"}`} />
                      <div className="text-sm font-medium text-slate-800">{label}</div>
                      <div className="text-xs text-slate-500">{sub}</div>
                    </button>
                  ))}
                </div>

                {/* Progresso */}
                {(generating || Object.keys(status).length > 0) && (
                  <div className="mt-4 space-y-2 border rounded-lg p-4 bg-slate-50">
                    <p className="text-xs font-medium text-slate-500 mb-1">GERAÇÃO INTEGRADA</p>
                    {Array.from(modalities).map(m => {
                      const meta = MODALITIES.find(x => x.id === m)!;
                      return (
                        <div key={m} className="flex items-center gap-2 text-sm">
                          {statusIcon(status[m] || "idle")}
                          <span>{meta.label}</span>
                          {m === "nutricao" && modalities.size > 1 && status[m] !== "idle" && (
                            <Badge variant="outline" className="text-xs">GET sobre carga total</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

                <Button className="w-full mt-4 bg-[#1B2B4A] hover:bg-[#1B2B4A]/90"
                  onClick={generate} disabled={generating || modalities.size === 0}>
                  {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</>
                    : `Gerar ${modalities.size} prescrição${modalities.size > 1 ? "ões" : ""} integrada${modalities.size > 1 ? "s" : ""}`}
                </Button>
              </CardContent>
            </Card>

            {/* Resultados + download */}
            {Object.values(results).some(Boolean) && !generating && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    Prescrições geradas
                    <BnitoContextButton
                      label="prescricoes geradas no Studio"
                      context="Resultados integrados e PDFs prontos para revisao pelo professor."
                      question="Me ajuda a revisar estes resultados antes de baixar os PDFs?"
                      className="ml-auto"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.keys(results).map(mod => {
                    const meta = MODALITIES.find(x => x.id === mod);
                    return (
                      <div key={mod} className="flex items-center gap-2 text-sm border-l-2 border-[#8B7355] pl-3 py-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="font-medium">{meta?.label}</span>
                        <span className="text-slate-400 text-xs">pronta</span>
                      </div>
                    );
                  })}
                  <Button onClick={downloadPDFs} className="w-full bg-[#8B7355] hover:bg-[#8B7355]/90 mt-2">
                    <Download className="h-4 w-4 mr-2" /> Baixar PDFs separados ({Object.keys(results).length})
                  </Button>
                  {pdfs.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {pdfs.map(p => (
                        <button key={p.modality} onClick={() => p.doc.save(p.filename)}
                          className="flex items-center gap-2 text-sm border rounded-lg p-2 hover:bg-slate-50">
                          <FileText className="h-4 w-4 text-[#8B7355]" />
                          <span>{p.label}.pdf</span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
