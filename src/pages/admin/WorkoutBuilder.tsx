import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Search, Save, Play, ChevronUp, ChevronDown, BarChart3, BrainCircuit, Sparkles, MessageCircle, Loader2, AlertCircle } from "lucide-react";
import { BnitoContextButton } from "@/components/BnitoFloatingAssistant";
import { useAssistantName } from "@/hooks/useAssistantName";
import { BodyMap } from "@/components/body/BodyMap";
import { regionForLibraryGroup, normalizeGender, BODY_REGION_LABELS, type BodyRegionId } from "@/lib/bodyMap";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  video_url: string | null;
  video_path: string | null;
  description: string | null;
}

interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  video_url: string | null;
  video_path: string | null;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
  set_types?: string[];
}

interface Workout {
  id?: string;
  title: string;
  description: string;
  exercises: WorkoutExercise[];
}

interface BnitoSuggestion {
  priority?: string;
  type?: string;
  target?: string;
  issue?: string;
  recommendation?: string;
  rationale?: string;
}

interface BnitoResult {
  summary?: string;
  score?: number;
  risk_level?: string;
  answer?: string;
  suggestions?: BnitoSuggestion[];
  context_flags?: Array<{ source?: string; flag?: string; impact?: string }>;
  volume_review?: Array<{ muscle_group?: string; weekly_sets?: number; status?: string; note?: string }>;
  questions_to_professor?: string[];
  next_intent?: {
    type?: string;
    question_to_teacher?: string | null;
  };
}

interface BnitoResponse {
  result?: BnitoResult;
  error?: string;
  details?: string;
  model_tier?: string;
  context_loaded?: {
    has_cycle?: boolean;
    has_anamnese?: boolean;
    has_assessment?: boolean;
  };
}

interface MuscleGroup {
  id: string;
  name: string;
}

interface MuscleTarget {
  exercise_id: string;
  muscle_group_id: string;
  role: string;
  volume_percentage: number;
}

interface ValidationWarning {
  severity?: "info" | "warning" | "blocker";
  code?: string;
  message?: string;
  recommendation?: string;
  source?: string;
}

interface PrescriptionValidationResult {
  status?: "ok" | "warnings" | "blocked";
  blockers?: ValidationWarning[];
  warnings?: ValidationWarning[];
  volume_review?: Array<{ muscle_group?: string; weekly_sets?: number; status?: string; note?: string }>;
}

const WORKOUT_LABELS = ["A", "B", "C", "D", "E", "F", "G"];

const useMuscleGroups = () => {
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any).from("muscle_groups").select("id, name").order("name");
      setGroups((data as MuscleGroup[]) || []);
    };
    load();
  }, []);
  return groups;
};

export default function WorkoutBuilder() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/admin/students";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const assistantName = useAssistantName();
  const muscleGroupsList = useMuscleGroups();
  const MUSCLE_GROUP_NAMES = muscleGroupsList.map(g => g.name);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activeTab, setActiveTab] = useState("0");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryExercises, setLibraryExercises] = useState<Exercise[]>([]);
  const [libSearch, setLibSearch] = useState("");
  const [libGroup, setLibGroup] = useState("all");
  const [bodyRegion, setBodyRegion] = useState<BodyRegionId | null>(null);
  const [videoModal, setVideoModal] = useState<{ type: "path" | "url"; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [cycleInfo, setCycleInfo] = useState<{ cycle_number: number; student_name: string; student_id?: string; company_id?: string | null; gender?: "male" | "female" } | null>(null);
  const [showVolume, setShowVolume] = useState(true);
  const [bnitoQuestion, setBnitoQuestion] = useState("");
  const [bnitoLoading, setBnitoLoading] = useState<"review" | "ask" | null>(null);
  const [bnitoResponse, setBnitoResponse] = useState<BnitoResponse | null>(null);
  const [validationResult, setValidationResult] = useState<PrescriptionValidationResult | null>(null);
  const [notifyingStudent, setNotifyingStudent] = useState(false);

  // Muscle targets for all exercises in library (cached)
  const [muscleTargets, setMuscleTargets] = useState<MuscleTarget[]>([]);

  useEffect(() => {
    if (cycleId) {
      loadExisting();
      loadCycleInfo();
    }
    loadLibrary();
    loadMuscleTargets();
  }, [cycleId]);

  const loadCycleInfo = async () => {
    const { data } = await supabase
      .from("training_cycles")
      .select("cycle_number, enrollment_id, company_id")
      .eq("id", cycleId!)
      .single();
    if (data) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("student_id, company_id")
        .eq("id", data.enrollment_id)
        .single();
      if (enrollment) {
        const { data: student } = await supabase
          .from("students")
          .select("full_name, gender")
          .eq("id", enrollment.student_id)
          .single();
        setCycleInfo({
          cycle_number: data.cycle_number,
          student_name: student?.full_name || "Aluno",
          student_id: enrollment.student_id,
          company_id: data.company_id || enrollment.company_id,
          gender: normalizeGender((student as any)?.gender) ?? "male",
        });
      }
    }
  };

  const loadExisting = async () => {
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .eq("cycle_id", cycleId!)
      .order("title");
    
    if (data && data.length > 0) {
      setWorkouts(data.map(w => ({
        id: w.id,
        title: w.title,
        description: w.description || "",
        exercises: (w.exercises as unknown as WorkoutExercise[]) || [],
      })));
    } else {
      // Start with one empty workout
      setWorkouts([{ title: "Treino A", description: "", exercises: [] }]);
    }
  };

  const loadLibrary = async () => {
    const { data } = await supabase
      .from("exercise_library")
      .select("id, name, muscle_group, video_url, video_path, description")
      .order("muscle_group")
      .order("name");
    setLibraryExercises((data as Exercise[]) || []);
  };

  const loadMuscleTargets = async () => {
    const { data } = await (supabase as any)
      .from("exercise_muscle_targets")
      .select("exercise_id, muscle_group_id, role, volume_percentage");
    setMuscleTargets((data as MuscleTarget[]) || []);
  };

  const getStoragePublicUrl = (path: string) => {
    const { data } = supabase.storage.from("exercises-videos").getPublicUrl(path);
    return data.publicUrl;
  };

  const addWorkout = () => {
    const nextLabel = WORKOUT_LABELS[workouts.length] || `Treino ${workouts.length + 1}`;
    setWorkouts(prev => [...prev, { title: `Treino ${nextLabel}`, description: "", exercises: [] }]);
    setActiveTab(String(workouts.length));
  };

  const removeWorkout = async (idx: number) => {
    const workout = workouts[idx];
    if (workout.id) {
      await supabase.from("workouts").delete().eq("id", workout.id);
    }
    const newWorkouts = workouts.filter((_, i) => i !== idx);
    if (newWorkouts.length === 0) {
      newWorkouts.push({ title: "Treino A", description: "", exercises: [] });
    }
    setWorkouts(newWorkouts);
    setActiveTab("0");
    toast({ title: "Treino removido" });
  };

  const updateWorkout = (idx: number, field: keyof Workout, value: any) => {
    setWorkouts(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w));
  };

  const addExercise = (ex: Exercise) => {
    const idx = parseInt(activeTab);
    setWorkouts(prev => prev.map((w, i) => {
      if (i !== idx) return w;
      return {
        ...w,
        exercises: [...w.exercises, {
          exercise_id: ex.id,
          exercise_name: ex.name,
          muscle_group: ex.muscle_group,
          video_url: ex.video_url,
          video_path: ex.video_path,
          sets: "3",
          reps: "12",
          rest: "60s",
          notes: "",
        }],
      };
    }));
    setLibraryOpen(false);
  };

  const removeExercise = (workoutIdx: number, exIdx: number) => {
    setWorkouts(prev => prev.map((w, i) => {
      if (i !== workoutIdx) return w;
      return { ...w, exercises: w.exercises.filter((_, j) => j !== exIdx) };
    }));
  };

  const updateExercise = (workoutIdx: number, exIdx: number, field: keyof WorkoutExercise, value: any) => {
    setWorkouts(prev => prev.map((w, i) => {
      if (i !== workoutIdx) return w;
      return {
        ...w,
        exercises: w.exercises.map((ex, j) => j === exIdx ? { ...ex, [field]: value } : ex),
      };
    }));
  };

  const moveExercise = (workoutIdx: number, exIdx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? exIdx - 1 : exIdx + 1;
    setWorkouts(prev => prev.map((w, i) => {
      if (i !== workoutIdx) return w;
      if (newIdx < 0 || newIdx >= w.exercises.length) return w;
      const arr = [...w.exercises];
      [arr[exIdx], arr[newIdx]] = [arr[newIdx], arr[exIdx]];
      return { ...w, exercises: arr };
    }));
  };

  const handleSaveAll = async () => {
    const hasEmpty = workouts.some(w => !w.title);
    if (hasEmpty) {
      toast({ title: "Preencha o título de todos os treinos", variant: "destructive" });
      return;
    }
    setSaving(true);
    setValidationResult(null);

    const validation = await validateBeforeSave();
    if (!validation) {
      setSaving(false);
      return;
    }
    const blockerCount = (validation.blockers || []).length;
    if (blockerCount > 0 || validation.status === "blocked") {
      setSaving(false);
      toast({
        title: `${assistantName} bloqueou o salvamento`,
        description: "Resolva os pontos críticos do validador antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    for (const workout of workouts) {
      const payload = {
        title: workout.title,
        description: workout.description || null,
        cycle_id: cycleId!,
        exercises: workout.exercises as any,
        created_by: user!.id,
      };

      if (workout.id) {
        const { error } = await supabase.from("workouts").update(payload).eq("id", workout.id);
        if (error) {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
          setSaving(false);
          return;
        }
      } else {
        const { data, error } = await supabase.from("workouts").insert(payload).select("id").single();
        if (error) {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
          setSaving(false);
          return;
        }
        workout.id = data.id;
      }
    }

    setSaving(false);
    toast({ title: "Todos os treinos salvos!" });
    navigate(returnTo);
  };

  const validateBeforeSave = async (): Promise<PrescriptionValidationResult | null> => {
    try {
      let objective = "manual";
      let fitnessLevel = "intermediario";
      let anamneseContext: any = null;
      let assessmentContext: any = null;

      if (cycleInfo?.student_id) {
        const [{ data: anamnese }, { data: assessment }] = await Promise.all([
          supabase
            .from("student_anamneses")
            .select("*")
            .eq("student_id", cycleInfo.student_id)
            .maybeSingle(),
          supabase
            .from("functional_assessments")
            .select("nivel, assessment_json, report_text, created_at")
            .eq("student_id", cycleInfo.student_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        anamneseContext = anamnese ?? null;
        assessmentContext = assessment?.assessment_json
          ? { assessment_json: assessment.assessment_json, report_text: assessment.report_text, nivel: assessment.nivel }
          : null;
        objective = (anamnese as any)?.objective || (anamnese as any)?.cardio_goal || "manual";
        const months = Number((anamnese as any)?.experience_months ?? 0);
        fitnessLevel = assessment?.nivel || (months > 0 && months < 6 ? "iniciante" : months >= 18 ? "avancado" : "intermediario");
      }

      const plan = {
        cycle_name: cycleInfo ? `Ciclo ${cycleInfo.cycle_number}` : "Treino manual",
        duration_weeks: 6,
        objective,
        workouts: workouts.map((workout, workoutIndex) => ({
          name: workout.title,
          description: workout.description,
          day_of_week: workoutIndex + 1,
          exercises: workout.exercises.map((exercise, exerciseIndex) => ({
            phase: "forca_global",
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
            muscle_group: exercise.muscle_group,
            sets: Number.parseInt(exercise.sets, 10) || 0,
            reps: exercise.reps,
            rest_seconds: Number.parseInt(exercise.rest, 10) || 0,
            exercise_order: exerciseIndex + 1,
            notes: exercise.notes,
            set_types: exercise.set_types || [],
          })),
        })),
      };
      const { data, error } = await supabase.functions.invoke<{ result?: PrescriptionValidationResult; error?: string }>("ai-validate-prescription", {
        body: {
          company_id: cycleInfo?.company_id,
          student_id: cycleInfo?.student_id,
          objective,
          fitness_level: fitnessLevel,
          anamnese_context: anamneseContext,
          assessment_context: assessmentContext,
          block_number: 1,
          plan,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const result = data?.result || { status: "ok", warnings: [], blockers: [] };
      setValidationResult(result);
      const warningsCount = (result.warnings || []).length;
      if (warningsCount > 0) {
        toast({
          title: "Validador encontrou avisos",
          description: `${warningsCount} ponto(s) para revisar antes/depois de salvar.`,
        });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      toast({ title: "Falha no validador", description: message, variant: "destructive" });
      return null;
    }
  };

  // Volume calculation
  const weeklyVolume = useMemo(() => {
    const volume: Record<string, number> = {};
    
    workouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        const sets = parseInt(ex.sets) || 0;
        const targets = muscleTargets.filter(t => t.exercise_id === ex.exercise_id);
        
        targets.forEach(target => {
          const mg = muscleGroupsList.find(g => g.id === target.muscle_group_id);
          if (mg) {
            const weighted = sets * (target.volume_percentage / 100);
            volume[mg.name] = (volume[mg.name] || 0) + weighted;
          }
        });
      });
    });

    return volume;
  }, [workouts, muscleTargets, muscleGroupsList]);

  const maxVolume = Math.max(...Object.values(weeklyVolume), 1);

  const getVolumeColor = (sets: number) => {
    if (sets <= 10) return "bg-emerald-500";
    if (sets <= 16) return "bg-yellow-500";
    return "bg-red-500";
  };

  const filteredLib = libraryExercises.filter((ex) => {
    const matchSearch = ex.name.toLowerCase().includes(libSearch.toLowerCase());
    const matchGroup = libGroup === "all" || ex.muscle_group === libGroup;
    const matchRegion = !bodyRegion || regionForLibraryGroup(ex.muscle_group) === bodyRegion;
    return matchSearch && matchGroup && matchRegion;
  });

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com/watch")) {
      const vid = new URL(url).searchParams.get("v");
      return vid ? `https://www.youtube.com/embed/${vid}` : url;
    }
    if (url.includes("youtu.be/")) {
      const vid = url.split("youtu.be/")[1]?.split("?")[0];
      return vid ? `https://www.youtube.com/embed/${vid}` : url;
    }
    if (url.includes("vimeo.com/")) {
      const vid = url.split("vimeo.com/")[1]?.split("?")[0];
      return vid ? `https://player.vimeo.com/video/${vid}` : url;
    }
    return url;
  };

  const openVideoForExercise = (ex: WorkoutExercise) => {
    if (ex.video_path) {
      setVideoModal({ type: "path", value: getStoragePublicUrl(ex.video_path) });
    } else if (ex.video_url) {
      setVideoModal({ type: "url", value: ex.video_url });
    }
  };

  const hasVideo = (ex: WorkoutExercise) => !!(ex.video_path || ex.video_url);

  const currentWorkout = workouts[parseInt(activeTab)] || workouts[0];
  const currentIdx = parseInt(activeTab);

  const callBnito = async (action: "review" | "ask") => {
    if (action === "ask" && !bnitoQuestion.trim()) {
      toast({ title: `Digite uma pergunta para o ${assistantName}`, variant: "destructive" });
      return;
    }
    setBnitoLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke<BnitoResponse>("ai-bnito-coach", {
        body: {
          action,
          cycle_id: cycleId,
          workouts,
          volume_summary: weeklyVolume,
          question: action === "ask" ? bnitoQuestion : "Audite tecnicamente este treino manual antes de salvar.",
          page_context: {
            active_workout: currentWorkout?.title,
            active_workout_index: currentIdx,
            cycle_info: cycleInfo,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error(`O ${assistantName} não retornou dados.`);
      if (data.error) throw new Error(data.details || data.error);
      setBnitoResponse(data);
      toast({
        title: action === "review" ? `${assistantName} auditou o treino` : `${assistantName} respondeu`,
        description: data.context_loaded?.has_anamnese ? "Contexto da anamnese carregado" : "Resposta gerada com o contexto disponível",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      toast({ title: `Falha no ${assistantName}`, description: message, variant: "destructive" });
    } finally {
      setBnitoLoading(null);
    }
  };

  const bnitoResult = bnitoResponse?.result;
  const shouldOfferStudentNotice = bnitoResult?.next_intent?.type === "notify_student_prescription_ready";
  const allValidationWarnings = [
    ...(validationResult?.blockers || []),
    ...(validationResult?.warnings || []),
  ];
  const validationWarningsBySource = allValidationWarnings.reduce<Record<string, ValidationWarning[]>>((acc, warning) => {
    const source = warning.source || "geral";
    acc[source] = acc[source] || [];
    acc[source].push(warning);
    return acc;
  }, {});

  const notifyStudent = async (message?: string) => {
    if (!cycleInfo?.student_id || !cycleInfo.company_id) {
      toast({ title: "Aluno sem contexto de WhatsApp", variant: "destructive" });
      return;
    }
    setNotifyingStudent(true);
    try {
      const { data: chat, error: chatError } = await (supabase as any)
        .from("whatsapp_chats")
        .select("id, remote_jid")
        .eq("company_id", cycleInfo.company_id)
        .eq("student_id", cycleInfo.student_id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (chatError) throw new Error(chatError.message);
      if (!chat?.remote_jid) throw new Error("Aluno sem chat do WhatsApp vinculado.");
      const content = message || `Oi, ${cycleInfo.student_name}! Sua prescrição foi atualizada no app. Dá uma olhada e me chama se quiser tirar dúvida de execução.`;
      const { data, error } = await supabase.functions.invoke("whatsapp-manager", {
        body: {
          action: "send-message",
          companyId: cycleInfo.company_id,
          chatId: chat.id,
          remoteJid: chat.remote_jid,
          content,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.details || (data as any)?.error || error?.message);
      toast({ title: "Aluno avisado", description: "Mensagem enviada pelo WhatsApp." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado";
      toast({ title: "Falha ao avisar aluno", description: errorMessage, variant: "destructive" });
    } finally {
      setNotifyingStudent(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(returnTo)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl text-primary">PRESCRIÇÃO DE TREINO</h1>
                <BnitoContextButton
                  label="builder manual de treino"
                  context={`Montagem manual de treino. ${cycleInfo ? `Aluno: ${cycleInfo.student_name}; ciclo ${cycleInfo.cycle_number}.` : "Ciclo ainda carregando."}`}
                  question="Me ajuda a revisar a estrutura deste treino manual antes de salvar?"
                />
              </div>
              {cycleInfo && (
                <p className="text-muted-foreground font-sans">
                  {cycleInfo.student_name} — Ciclo {cycleInfo.cycle_number}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => callBnito("review")} disabled={!!bnitoLoading}>
              {bnitoLoading === "review" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
              {assistantName}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowVolume(!showVolume)}>
              <BarChart3 className="h-4 w-4 mr-2" />Volume
            </Button>
            <Button onClick={handleSaveAll} disabled={saving} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Tudo"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 space-y-4">
            {/* Workout Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center gap-2">
                <TabsList className="flex-1 flex-wrap h-auto">
                  {workouts.map((w, idx) => (
                    <TabsTrigger key={idx} value={String(idx)} className="text-sm">
                      {w.title || `Treino ${WORKOUT_LABELS[idx] || idx + 1}`}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {workouts.length < 7 && (
                  <Button variant="outline" size="sm" onClick={addWorkout}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {workouts.map((workout, wIdx) => (
                <TabsContent key={wIdx} value={String(wIdx)} className="space-y-4">
                  {/* Workout details */}
                  <Card className="bg-card border-border">
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-sans">Título do Treino *</Label>
                          <Input
                            value={workout.title}
                            onChange={(e) => updateWorkout(wIdx, "title", e.target.value)}
                            placeholder="Ex: Treino A - Superior"
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-sans">Descrição</Label>
                          <Input
                            value={workout.description}
                            onChange={(e) => updateWorkout(wIdx, "description", e.target.value)}
                            placeholder="Observações gerais..."
                            className="bg-secondary border-border"
                          />
                        </div>
                      </div>
                      {workouts.length > 1 && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeWorkout(wIdx)}>
                          <Trash2 className="h-4 w-4 mr-1" />Remover este treino
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Exercises list */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl text-primary">EXERCÍCIOS ({workout.exercises.length})</h2>
                      <BnitoContextButton
                        label={`exercicios do ${workout.title || `treino ${wIdx + 1}`}`}
                        context={`Treino atual: ${workout.title || `Treino ${wIdx + 1}`}. Exercicios: ${workout.exercises.map((ex) => ex.exercise_name).join(", ") || "nenhum"}.`}
                        question="A ordem, selecao e volume destes exercicios fazem sentido para o objetivo do aluno?"
                      />
                    </div>
                    <Button onClick={() => setLibraryOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />Adicionar
                    </Button>
                  </div>

                  {workout.exercises.length === 0 && (
                    <Card className="bg-card border-border border-dashed">
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground font-sans">Nenhum exercício adicionado</p>
                        <Button variant="outline" className="mt-4" onClick={() => setLibraryOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />Buscar na Biblioteca
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-3">
                    {workout.exercises.map((ex, exIdx) => (
                      <Card key={exIdx} className="bg-card border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-0.5 pt-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveExercise(wIdx, exIdx, "up")} disabled={exIdx === 0}>
                                <ChevronUp className="h-3.5 w-3.5" />
                              </Button>
                              <span className="text-xs text-muted-foreground text-center font-sans">{exIdx + 1}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveExercise(wIdx, exIdx, "down")} disabled={exIdx === workout.exercises.length - 1}>
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <p className="font-sans font-medium text-foreground">{ex.exercise_name}</p>
                                  <Badge variant="outline" className="capitalize text-xs">{ex.muscle_group}</Badge>
                                  {hasVideo(ex) && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openVideoForExercise(ex)}>
                                      <Play className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  )}
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeExercise(wIdx, exIdx)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground font-sans">Séries</Label>
                                  <Input
                                    value={ex.sets}
                                    onChange={(e) => updateExercise(wIdx, exIdx, "sets", e.target.value)}
                                    className="bg-secondary border-border h-8 text-sm"
                                    placeholder="3"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground font-sans">Repetições</Label>
                                  <Input
                                    value={ex.reps}
                                    onChange={(e) => updateExercise(wIdx, exIdx, "reps", e.target.value)}
                                    className="bg-secondary border-border h-8 text-sm"
                                    placeholder="12"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground font-sans">Descanso</Label>
                                  <Input
                                    value={ex.rest}
                                    onChange={(e) => updateExercise(wIdx, exIdx, "rest", e.target.value)}
                                    className="bg-secondary border-border h-8 text-sm"
                                    placeholder="60s"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground font-sans">Observação</Label>
                                  <Textarea
                                    value={ex.notes}
                                    onChange={(e) => updateExercise(wIdx, exIdx, "notes", e.target.value)}
                                    className="bg-secondary border-border text-sm min-h-[60px]"
                                    rows={2}
                                    placeholder="Cadência 3-1-2"
                                  />
                                </div>
                              </div>

                              {/* Set Types Config */}
                              {(() => {
                                const numSets = parseInt(ex.sets) || 3;
                                const currentTypes: string[] = (ex as any).set_types || [];
                                return (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground font-sans">Tipos de Série</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {Array.from({ length: numSets }, (_, s) => {
                                        const type = currentTypes[s] || 'normal';
                                        const config: Record<string, { label: string; color: string }> = {
                                          warmup: { label: 'W', color: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/40' },
                                          normal: { label: `${s + 1}`, color: 'bg-muted text-foreground border-border' },
                                          failure: { label: 'F', color: 'bg-red-400/20 text-red-400 border-red-400/40' },
                                          drop: { label: 'D', color: 'bg-blue-400/20 text-blue-400 border-blue-400/40' },
                                        };
                                        const c = config[type] || config.normal;
                                        return (
                                          <Select
                                            key={s}
                                            value={type}
                                            onValueChange={(val) => {
                                              const newTypes = [...currentTypes];
                                              while (newTypes.length < numSets) newTypes.push('normal');
                                              newTypes[s] = val;
                                              updateExercise(wIdx, exIdx, "set_types" as any, newTypes as any);
                                            }}
                                          >
                                            <SelectTrigger className={`h-7 w-10 text-xs font-bold border ${c.color} px-0 justify-center`}>
                                              <span>{c.label}</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="warmup">W — Aquecimento</SelectItem>
                                              <SelectItem value="normal">Normal</SelectItem>
                                              <SelectItem value="failure">F — Falha</SelectItem>
                                              <SelectItem value="drop">D — Drop</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Assistive sidebar */}
          <div className="lg:w-80 shrink-0 space-y-4">
            {showVolume && (
              <Card className="bg-card border-border sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-primary text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    VOLUME SEMANAL
                    <BnitoContextButton
                      label="volume semanal do treino"
                      context={`Resumo de volume semanal por grupos musculares: ${JSON.stringify(weeklyVolume)}`}
                      question="Esse volume semanal esta alto, baixo ou adequado para o contexto do aluno?"
                      className="ml-auto"
                    />
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-sans">
                    Séries totais por grupo muscular (todos os treinos)
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.keys(weeklyVolume).length === 0 ? (
                    <p className="text-xs text-muted-foreground font-sans text-center py-4">
                      Configure os músculos dos exercícios na Biblioteca para ver o volume
                    </p>
                  ) : (
                    Object.entries(weeklyVolume)
                      .sort((a, b) => b[1] - a[1])
                      .map(([muscle, sets]) => (
                        <div key={muscle} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-sans text-foreground">{muscle}</span>
                            <span className="text-xs font-sans font-medium text-foreground">
                              {sets % 1 === 0 ? sets : sets.toFixed(1)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getVolumeColor(sets)}`}
                              style={{ width: `${Math.min((sets / 20) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                  )}
                  {Object.keys(weeklyVolume).length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" /> ≤10
                        <div className="h-2 w-2 rounded-full bg-yellow-500 ml-2" /> 11-16
                        <div className="h-2 w-2 rounded-full bg-red-500 ml-2" /> &gt;16
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-primary text-sm flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4" />
                  {assistantName}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-sans">
                  Copiloto técnico para revisar o treino manual antes de salvar.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => callBnito("review")}
                  disabled={!!bnitoLoading}
                >
                  {bnitoLoading === "review" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Auditar treino
                </Button>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-sans">Pergunta técnica</Label>
                  <Textarea
                    value={bnitoQuestion}
                    onChange={(event) => setBnitoQuestion(event.target.value)}
                    placeholder="Ex: apareceu dor no joelho na anamnese, como ajusto esse treino?"
                    className="bg-secondary border-border text-sm min-h-[96px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => callBnito("ask")}
                    disabled={!!bnitoLoading || !bnitoQuestion.trim()}
                  >
                    {bnitoLoading === "ask" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                    Perguntar ao {assistantName}
                  </Button>
                </div>

                {!bnitoResult ? (
                  <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground font-sans">
                    O {assistantName} considera o rascunho atual, volume semanal, anamnese e avaliação funcional disponíveis.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-primary">Resumo</span>
                        {bnitoResult.risk_level && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            risco {bnitoResult.risk_level}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-primary font-sans">
                        {bnitoResult.summary || bnitoResult.answer || "Análise gerada."}
                      </p>
                    </div>

                    {bnitoResult.answer && bnitoResult.answer !== bnitoResult.summary && (
                      <p className="rounded-md bg-secondary p-3 text-xs leading-relaxed font-sans text-foreground">
                        {bnitoResult.answer}
                      </p>
                    )}

                    {Array.isArray(bnitoResult.suggestions) && bnitoResult.suggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-foreground font-sans">Sugestões</p>
                        {bnitoResult.suggestions.slice(0, 4).map((item, idx) => (
                          <div key={`${item.target || "sugestao"}-${idx}`} className="rounded-md border border-border p-2 text-xs font-sans">
                            <div className="flex items-center gap-2">
                              <Badge variant={item.priority === "alta" ? "destructive" : "secondary"} className="text-[10px]">
                                {item.priority || "media"}
                              </Badge>
                              <span className="font-medium text-foreground">{item.target || item.type || "Ajuste"}</span>
                            </div>
                            {item.issue && <p className="mt-1 text-muted-foreground">{item.issue}</p>}
                            {item.recommendation && <p className="mt-1 text-foreground">{item.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(bnitoResult.volume_review) && bnitoResult.volume_review.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground font-sans">Volume</p>
                        {bnitoResult.volume_review.slice(0, 5).map((item, idx) => (
                          <div key={`${item.muscle_group || "volume"}-${idx}`} className="flex items-center justify-between gap-2 text-xs font-sans">
                            <span className="text-muted-foreground">{item.muscle_group || "Grupo"}</span>
                            <span className="text-foreground">
                              {item.weekly_sets ?? "?"} · {item.status || "incerto"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(bnitoResult.questions_to_professor) && bnitoResult.questions_to_professor.length > 0 && (
                      <div className="rounded-md bg-secondary p-3 text-xs font-sans">
                        <p className="font-semibold text-foreground">Faltou saber</p>
                        <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                          {bnitoResult.questions_to_professor.slice(0, 3).map((question, idx) => (
                            <li key={`${question}-${idx}`}>{question}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {shouldOfferStudentNotice && (
                      <div className="rounded-md border border-navy/20 bg-navy/5 p-3 text-xs font-sans">
                        <p className="font-semibold text-foreground">
                          {bnitoResult.next_intent?.question_to_teacher || "Quer que eu avise o aluno que a prescrição foi feita?"}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => notifyStudent()}
                          disabled={notifyingStudent}
                        >
                          {notifyingStudent ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                          Avisar aluno
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {allValidationWarnings.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-primary text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Validador pré-salvar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(validationWarningsBySource).map(([source, warnings]) => (
                    <div key={source} className="rounded-md border border-border p-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground font-sans">{source}</p>
                      <div className="mt-2 space-y-2">
                        {warnings.map((warning, idx) => (
                          <div key={`${warning.code || warning.message}-${idx}`} className="text-xs font-sans">
                            <Badge variant={warning.severity === "blocker" ? "destructive" : "outline"} className="mb-1 text-[10px]">
                              {warning.severity || "warning"}
                            </Badge>
                            <p className="text-foreground">{warning.message}</p>
                            {warning.recommendation && <p className="text-muted-foreground">{warning.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Library picker dialog */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">BIBLIOTECA DE EXERCÍCIOS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Seleção visual por região (boneco anatômico) — sempre visível */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs font-medium text-foreground mb-1 text-center">
                Selecione pelo boneco{bodyRegion ? ` · ${BODY_REGION_LABELS[bodyRegion]}` : ""}
              </p>
              <BodyMap
                gender={cycleInfo?.gender ?? "male"}
                onRegionClick={(id) => setBodyRegion((cur) => (cur === id ? null : id))}
                activeRegions={bodyRegion ? [bodyRegion] : []}
                getRegionFill={(id) => (id === bodyRegion ? "hsl(var(--primary))" : undefined)}
                svgClassName="h-[380px] w-auto"
                footer={
                  bodyRegion ? (
                    <button type="button" onClick={() => setBodyRegion(null)} className="text-xs text-primary underline">
                      Limpar filtro ({BODY_REGION_LABELS[bodyRegion]})
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Clique num músculo para filtrar os exercícios.</span>
                  )
                }
              />
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Buscar..." className="pl-10 bg-secondary border-border" />
              </div>
              <Select value={libGroup} onValueChange={setLibGroup}>
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MUSCLE_GROUP_NAMES.map((g) => (
                    <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredLib.length === 0 && (
              <p className="text-center text-muted-foreground font-sans py-6">Nenhum exercício encontrado</p>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredLib.map((ex) => {
                const currentExercises = currentWorkout?.exercises || [];
                const alreadyAdded = currentExercises.some((w) => w.exercise_id === ex.id);
                return (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between p-3 rounded-md bg-secondary hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-sans font-medium text-foreground text-sm">{ex.name}</p>
                      <Badge variant="outline" className="capitalize text-xs">{ex.muscle_group}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant={alreadyAdded ? "secondary" : "default"}
                      disabled={alreadyAdded}
                      onClick={() => addExercise(ex)}
                    >
                      {alreadyAdded ? "Adicionado" : "Adicionar"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={!!videoModal} onOpenChange={() => setVideoModal(null)}>
        <DialogContent className="bg-card border-border max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-primary">VÍDEO</DialogTitle>
          </DialogHeader>
          {videoModal && (
            <div className="aspect-video w-full">
              {videoModal.type === "path" ? (
                <video
                  src={videoModal.value}
                  controls
                  className="w-full h-full rounded-md"
                />
              ) : (
                <iframe
                  src={getEmbedUrl(videoModal.value)}
                  className="w-full h-full rounded-md"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
