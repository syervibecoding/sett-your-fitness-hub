// ============================================================================
// PrescriptionStudio (Fase D1) — Studio de prescrição determinístico
//   1. Seleciona aluno → carrega anamnese (prefill) + ciclo de treino ativo
//   2. Ajusta parâmetros (objetivo, nível, dias, duração, restrições)
//   3. "Gerar" roda o motor determinístico (src/lib/prescription) no cliente
//   4. Pré-visualiza treinos + volume semanal + racional
//   5. "Aplicar ao ciclo" grava os treinos na training_cycle selecionada
// ============================================================================
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Cpu, AlertCircle, AlertTriangle, CheckCircle2, Dumbbell, Save, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import {
  generatePrescription, normalizePoolItem,
  type ExercisePoolItem, type Objective, type Experience, type Equipment,
  type PrescriptionPlan,
} from "@/lib/prescription";

interface Student { id: string; full_name: string; }
interface Cycle { id: string; cycle_number: number; status: string; start_date: string; end_date: string; }

const OBJ_OPTS: [Objective, string][] = [
  ["hipertrofia", "Hipertrofia"],
  ["emagrecimento", "Emagrecimento"],
  ["forca", "Força"],
  ["performance", "Performance"],
  ["saude", "Saúde / Geral"],
];
const EXP_OPTS: [Experience, string][] = [
  ["iniciante", "Iniciante"],
  ["intermediario", "Intermediário"],
  ["avancado", "Avançado"],
];
const EQUIP_OPTS: [Equipment, string][] = [
  ["academia_completa", "Academia completa"],
  ["halteres", "Halteres / livre"],
  ["casa_basica", "Casa (básico)"],
  ["peso_corporal", "Peso corporal"],
];

export default function PrescriptionStudio() {
  const navigate = useNavigate();
  const { user, role, companyId: authCompanyId } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const companyId = role === "master"
    ? (isViewingCompany ? viewingCompany?.id ?? null : null)
    : authCompanyId;
  const prefix = role === "master" ? "/admin" : `/${role}`;

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [pool, setPool] = useState<ExercisePoolItem[]>([]);

  const [objective, setObjective] = useState<Objective>("hipertrofia");
  const [experience, setExperience] = useState<Experience>("intermediario");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [sessionDuration, setSessionDuration] = useState("60");
  const [equipment, setEquipment] = useState<Equipment>("academia_completa");
  const [durationWeeks, setDurationWeeks] = useState("6");
  const [restrictions, setRestrictions] = useState("");

  const [plan, setPlan] = useState<PrescriptionPlan | null>(null);
  const [applying, setApplying] = useState(false);

  // Alunos da empresa
  useEffect(() => {
    if (!companyId) { setStudents([]); return; }
    (async () => {
      const { data } = await supabase.from("students")
        .select("id, full_name").eq("company_id", companyId).order("full_name");
      setStudents(data || []);
    })();
  }, [companyId]);

  // Biblioteca de exercícios da empresa (globais + da empresa)
  useEffect(() => {
    if (!companyId) { setPool([]); return; }
    (async () => {
      const { data } = await supabase.from("exercise_library")
        .select("id, name, muscle_group, equipment, video_url, video_path")
        .or(`is_global.eq.true,company_id.eq.${companyId}`);
      setPool((data || []).map((r: any) => normalizePoolItem(r)));
    })();
  }, [companyId]);

  // Anamnese + ciclos ao trocar de aluno
  useEffect(() => {
    if (!studentId) { setCycles([]); setCycleId(""); return; }
    setPlan(null);
    (async () => {
      const { data: anam } = await supabase.from("student_anamneses")
        .select("objective, activity_level, days_per_week_strength, session_duration_min, equipment, injuries")
        .eq("student_id", studentId).maybeSingle();
      if (anam) {
        if (OBJ_OPTS.some(([v]) => v === anam.objective)) setObjective(anam.objective as Objective);
        if (anam.days_per_week_strength) setDaysPerWeek(String(anam.days_per_week_strength));
        if (anam.session_duration_min) setSessionDuration(String(anam.session_duration_min));
        if (EQUIP_OPTS.some(([v]) => v === anam.equipment)) setEquipment(anam.equipment as Equipment);
        if (anam.injuries) setRestrictions(anam.injuries);
      }

      const { data: enr } = await supabase.from("enrollments")
        .select("id").eq("student_id", studentId)
        .order("created_at", { ascending: false });
      const enrollmentIds = (enr || []).map((e) => e.id);
      if (enrollmentIds.length === 0) { setCycles([]); setCycleId(""); return; }
      const { data: cyc } = await supabase.from("training_cycles")
        .select("id, cycle_number, status, start_date, end_date")
        .in("enrollment_id", enrollmentIds)
        .order("cycle_number", { ascending: true });
      const list = (cyc || []) as Cycle[];
      setCycles(list);
      const active = list.find((c) => c.status === "active") || list.find((c) => c.status === "pending") || list[0];
      setCycleId(active?.id || "");
    })();
  }, [studentId]);

  const student = students.find((s) => s.id === studentId);
  const poolCount = pool.filter((p) => p.canonical).length;

  function handleGenerate() {
    if (!studentId) { toast.error("Selecione um aluno."); return; }
    if (poolCount === 0) { toast.error("Biblioteca de exercícios vazia. Cadastre exercícios primeiro."); return; }
    const result = generatePrescription({
      objective, experience,
      daysPerWeek: Number(daysPerWeek) || 3,
      sessionDurationMin: Number(sessionDuration) || 60,
      equipment,
      durationWeeks: Number(durationWeeks) || 6,
      restrictions,
      pool,
    });
    setPlan(result);
    toast.success("Prescrição gerada.");
  }

  async function handleApply() {
    if (!plan || !cycleId || !user) {
      toast.error("Selecione um ciclo de treino para aplicar.");
      return;
    }
    setApplying(true);
    try {
      // limpa treinos existentes do ciclo e grava os novos
      await supabase.from("workouts").delete().eq("cycle_id", cycleId);
      const rows = plan.workouts.map((w, i) => ({
        cycle_id: cycleId,
        title: w.title,
        description: w.description || null,
        sort_order: i,
        company_id: companyId,
        created_by: user.id,
        exercises: w.exercises.map((ex) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group,
          video_url: ex.video_url,
          video_path: ex.video_path,
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest,
          notes: ex.rpe ? `RPE ${ex.rpe}` : "",
        })),
      }));
      const { error } = await supabase.from("workouts").insert(rows as any);
      if (error) throw new Error(error.message);
      toast.success("Treinos aplicados ao ciclo.");
      navigate(`${prefix}/workout/${cycleId}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao aplicar.");
    }
    setApplying(false);
  }

  const inputCls = "h-9 text-sm";
  const SS = ({ value, onChange, opts, placeholder }: any) => (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={inputCls}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{opts.map(([v, l]: [string, string]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );

  const volColor = (status: string) =>
    status === "low" ? "text-amber-600" : status === "high" ? "text-red-600" : "text-emerald-600";

  const cycleLabel = (c: Cycle) =>
    `Ciclo ${c.cycle_number} · ${c.status}${c.start_date ? ` · ${c.start_date}` : ""}`;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Prescrição</p>
        <h1 className="font-display text-3xl">Studio de Prescrição</h1>
        <p className="text-sm text-muted-foreground">
          Motor determinístico · split + volume + progressão calculados por regras (sem IA)
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Aluno e ciclo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!companyId ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Nenhuma empresa selecionada.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Aluno</Label>
                <SS value={studentId} onChange={setStudentId} placeholder="Selecione..."
                  opts={students.map((s) => [s.id, s.full_name])} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Ciclo de treino</Label>
                {cycles.length === 0 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 h-9">
                    <AlertCircle className="h-3 w-3" /> Sem ciclos. Defina a data de início do treino na matrícula.
                  </p>
                ) : (
                  <SS value={cycleId} onChange={setCycleId} placeholder="Selecione..."
                    opts={cycles.map((c) => [c.id, cycleLabel(c)])} />
                )}
              </div>
            </div>
          )}
          {companyId && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Dumbbell className="h-3 w-3" /> {poolCount} exercícios de força disponíveis na biblioteca.
            </p>
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
              <Label className="text-xs text-muted-foreground mb-1">Nível</Label>
              <SS value={experience} onChange={setExperience} opts={EXP_OPTS} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Equipamento</Label>
              <SS value={equipment} onChange={setEquipment} opts={EQUIP_OPTS} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Dias/semana</Label>
              <Input className={inputCls} type="number" min={2} max={6} value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Sessão (min)</Label>
              <Input className={inputCls} type="number" value={sessionDuration}
                onChange={(e) => setSessionDuration(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Duração (semanas)</Label>
              <Input className={inputCls} type="number" min={1} max={24} value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <Label className="text-xs text-muted-foreground mb-1">Restrições / lesões (texto livre)</Label>
              <Textarea rows={2} value={restrictions} onChange={(e) => setRestrictions(e.target.value)}
                placeholder="Ex.: dor no joelho direito, hérnia lombar..." className="text-sm" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <Button onClick={handleGenerate} className="gap-2">
                <Cpu className="h-4 w-4" /> Gerar prescrição
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {plan && (
        <>
          {/* Racional + avisos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {plan.splitName} · {plan.durationWeeks} semanas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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

          {/* Volume semanal */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Volume semanal (séries)</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {plan.weeklyVolume.map((v) => (
                <Badge key={v.muscle} variant="outline" className="text-xs">
                  {v.label}: <span className={`ml-1 font-medium ${volColor(v.status)}`}>{v.sets}</span>
                  <span className="text-muted-foreground ml-1">/ {v.target[0]}–{v.target[1]}</span>
                </Badge>
              ))}
            </CardContent>
          </Card>

          {/* Treinos */}
          <div className="grid gap-4 md:grid-cols-2">
            {plan.workouts.map((w) => (
              <Card key={w.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{w.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {w.exercises.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem exercícios disponíveis.</p>
                  )}
                  {w.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-line pb-1.5">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{ex.exercise_name}</p>
                        <p className="text-muted-foreground capitalize">{ex.muscle_group}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2 text-muted-foreground">
                        <span className="text-foreground font-medium">{ex.sets}×{ex.reps}</span>
                        <span className="block">{ex.rest} · RPE {ex.rpe}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Aplicar */}
          <div className="flex items-center gap-2 sticky bottom-4">
            <Button onClick={handleApply} disabled={applying || !cycleId} size="lg" className="gap-2 shadow-lg">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {applying ? "Aplicando..." : "Aplicar ao ciclo"}
            </Button>
            {cycleId && (
              <Button variant="outline" size="lg" onClick={() => navigate(`${prefix}/workout/${cycleId}`)} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Abrir no construtor
              </Button>
            )}
            {!cycleId && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Selecione um ciclo para aplicar.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
