// ============================================================================
// StudentAnamnese.tsx — BN Performance Training
// Página PÚBLICA: o aluno acessa por link (com token) e preenche a anamnese
// Rota sugerida: /anamnese/:token
// Cole em: src/pages/StudentAnamnese.tsx
// ============================================================================
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeText, sanitizeShort } from "@/lib/validation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/lib/studioUi";

const TOTAL_STEPS = 7;

const COMMON_FOODS = ["Frango", "Ovos", "Carne", "Peixe", "Arroz", "Batata doce", "Pão", "Tapioca", "Aveia", "Feijão", "Macarrão", "Frutas", "Salada", "Legumes", "Iogurte", "Whey", "Queijo"];
const TRAIN_TIMES = ["Manhã cedo", "Manhã", "Almoço", "Tarde", "Fim de tarde", "Noite"];

const F = ({ label, children, span }: any) => (
  <div className={span}>
    <Label className="text-xs font-medium text-slate-600 mb-1">{label}</Label>
    {children}
  </div>
);

const SS = ({ value, onChange, opts, placeholder }: any) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-10"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>{opts.map(([v, l]: any) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
  </Select>
);

export default function StudentAnamnese() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  const [f, setF] = useState({
    // Identificação
    name: "", age: "", gender: "M",
    weight_kg: "", height_cm: "", body_fat_percent: "",
    // Objetivo
    objective: "", main_goal: "",
    // Rotina e histórico
    activity_level: "", experience_months: "",
    days_available: "", session_duration_min: "60",
    equipment: "", training_history: "",
    // Modalidades de interesse
    interest_strength: false, interest_running: false,
    interest_swimming: false, interest_cycling: false, interest_nutrition: false,
    // Específico cardio
    sport_goal: "", current_volume_weekly: "",
    fcmax: "", fcrep: "", perceived_recovery: "",
    run_where: "", run_best_time: "",
    swim_pool: "", swim_level: "", swim_volume: "",
    bike_type: "", bike_volume: "", bike_power: false,
    // Saúde
    injuries: "", medical_conditions: "", medications: "",
    stress_score: "", sleep_quality: "", sleep_hours: "",
    // Triagem clínica (PAR-Q)
    clin_cardiac: "nao", clin_chest_pain: "nao",
    clin_surgery: "nao", clin_surgery_detail: "",
    clin_pregnant: "na", clin_pregnant_detail: "",
    clin_smoke: "nao", clin_acute: "nao", clin_other: "",
    // Dor articular agora (EVA 0-10)
    eva_tornozelo: "0", eva_joelho: "0", eva_quadril: "0", eva_lombar: "0", eva_ombro: "0",
    // Nutrição — rotina alimentar e de treino
    meals_per_day: "5", meal_t1: "", meal_t2: "", meal_t3: "",
    meal_routine: "", train_time: "", train_fasted: "nunca", appetite_wake: "",
    // Nutrição — preferências / substituições
    food_likes: "", food_dislikes: "", food_restrictions: "", food_preferences: "",
    budget_food: "moderado", has_kitchen: true, supplements: "",
    // Observações
    notes: "",
  });

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const hasCsv = (field: string, val: string) =>
    ((f as any)[field] || "").split(",").map((s: string) => s.trim()).includes(val);
  const toggleCsv = (field: string, val: string) => {
    const cur = ((f as any)[field] || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const next = cur.includes(val) ? cur.filter((x: string) => x !== val) : [...cur, val];
    set(field, next.join(", "));
  };

  // Carrega o convite pelo token
  useEffect(() => {
    (async () => {
      if (!token) { setError("Link inválido."); setLoading(false); return; }
      const { data, error } = await supabase.functions.invoke("public-anamnesis", {
        body: { action: "studio_context", token },
      });
      if (error || data?.error || !data?.invite) {
        setError(error?.message || data?.error || "Link não encontrado ou expirado.");
        setLoading(false);
        return;
      }
      if (data.invite.status === "completed") { setDone(true); }
      setInvite(data.invite);
      if (data.invite.student_name || data.student?.full_name) set("name", data.invite.student_name || data.student.full_name);
      setLoading(false);
    })();
  }, [token]);

  async function submit() {
    setSubmitting(true); setError("");
    try {
      // Triagem clínica + dor articular → texto estruturado que alimenta as linhas vermelhas das IAs
      const clinical = [
        f.clin_cardiac === "sim" && "histórico cardíaco/pressão alta",
        f.clin_chest_pain === "sim" && "RELATA dor no peito/tontura/falta de ar ao esforço",
        f.clin_surgery === "sim" && `cirurgia recente (<6 meses)${f.clin_surgery_detail ? ": " + sanitizeShort(f.clin_surgery_detail) : ""}`,
        f.clin_pregnant === "gravida" && `GESTANTE${f.clin_pregnant_detail ? " (" + sanitizeShort(f.clin_pregnant_detail) + ")" : ""}`,
        f.clin_pregnant === "posparto" && `pós-parto recente${f.clin_pregnant_detail ? " (" + sanitizeShort(f.clin_pregnant_detail) + ")" : ""}`,
        f.clin_smoke === "sim" && "fumante",
        f.clin_acute === "sim" && "doença aguda/febre no momento",
        f.clin_other && sanitizeText(f.clin_other),
      ].filter(Boolean);
      const clinicalText = clinical.length
        ? `TRIAGEM CLÍNICA: ${clinical.join("; ")}`
        : "Triagem clínica: sem sinais de alerta relatados";
      const evaParts = ([["tornozelo", f.eva_tornozelo], ["joelho", f.eva_joelho], ["quadril", f.eva_quadril], ["lombar", f.eva_lombar], ["ombro", f.eva_ombro]] as [string, string][])
        .filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k} ${v}`);
      const evaText = evaParts.length
        ? `DOR ARTICULAR AGORA (EVA 0-10): ${evaParts.join(", ")}`
        : "Sem dor articular relatada (EVA 0)";
      const cardioDetail = [
        f.interest_running && `CORRIDA: ${[sanitizeShort(f.run_where), f.run_best_time && "melhor tempo " + sanitizeShort(f.run_best_time)].filter(Boolean).join(", ") || "detalhes não informados"}`,
        f.interest_swimming && `NATAÇÃO: ${[f.swim_pool && "piscina " + f.swim_pool, f.swim_level && "nível " + f.swim_level, f.swim_volume && "volume " + sanitizeShort(f.swim_volume)].filter(Boolean).join(", ") || "detalhes não informados"}`,
        f.interest_cycling && `CICLISMO: ${[f.bike_type, f.bike_volume && "volume " + sanitizeShort(f.bike_volume), f.bike_power && "tem medidor de potência"].filter(Boolean).join(", ") || "detalhes não informados"}`,
        f.perceived_recovery && `Recuperação percebida hoje: ${f.perceived_recovery}/10`,
      ].filter(Boolean) as string[];

      const ROUTINE_LBL: Record<string, string> = { fixa: "fixos", varia: "variam um pouco", muda: "mudam bastante" };
      const FASTED_LBL: Record<string, string> = { nunca: "nunca", asvezes: "às vezes", sempre: "sempre" };
      const APPETITE_LBL: Record<string, string> = { faminto: "com bastante fome", normal: "normal", sem_fome: "sem fome", enjoo: "enjoo/não come" };
      const nutritionContext = [
        `Refeições/dia: ${f.meals_per_day || "5"}`,
        (f.meal_t1 || f.meal_t2 || f.meal_t3) && `Horários habituais: ${[f.meal_t1 && "1ª " + f.meal_t1, f.meal_t2 && "almoço " + f.meal_t2, f.meal_t3 && "última " + f.meal_t3].filter(Boolean).join(", ")}`,
        f.meal_routine && `Horários ${ROUTINE_LBL[f.meal_routine] || f.meal_routine}`,
        f.train_time && `Treina no período: ${f.train_time}`,
        `Treina em jejum: ${FASTED_LBL[f.train_fasted] || f.train_fasted}`,
        f.appetite_wake && `Fome ao acordar: ${APPETITE_LBL[f.appetite_wake] || f.appetite_wake}`,
        f.food_likes && `Gosta de: ${sanitizeText(f.food_likes)}`,
        f.food_dislikes && `NÃO gosta / evitar nas sugestões e substituições: ${sanitizeText(f.food_dislikes)}`,
      ].filter(Boolean).join(" | ");

      const payload = {
        student_id: invite.student_id,
        company_id: invite.company_id,
        age: f.age ? Number(f.age) : null,
        body_fat_percent: f.body_fat_percent ? Number(f.body_fat_percent) : null,
        objective: sanitizeShort(f.objective),
        activity_level: f.activity_level,
        is_endurance_athlete: f.interest_running || f.interest_swimming || f.interest_cycling,
        training_modality: [
          f.interest_strength && "musculação",
          f.interest_running && "corrida",
          f.interest_swimming && "natação",
          f.interest_cycling && "ciclismo",
        ].filter(Boolean).join(" + "),
        days_per_week_strength: f.interest_strength ? Number(f.days_available) || null : null,
        days_per_week_cardio: (f.interest_running || f.interest_swimming || f.interest_cycling) ? Number(f.days_available) || null : null,
        session_duration_min: Number(f.session_duration_min) || null,
        equipment: sanitizeShort(f.equipment),
        experience_months: f.experience_months ? Number(f.experience_months) : null,
        sport: f.interest_running ? "corrida" : f.interest_swimming ? "natacao" : f.interest_cycling ? "ciclismo" : null,
        fcmax: f.fcmax ? Number(f.fcmax) : null,
        fcrep: f.fcrep ? Number(f.fcrep) : null,
        current_volume_weekly: f.current_volume_weekly ? Number(f.current_volume_weekly) : null,
        cardio_goal: sanitizeShort(f.sport_goal),
        stress_score: f.stress_score ? Number(f.stress_score) : null,
        sleep_quality: f.sleep_quality ? Number(f.sleep_quality) : null,
        injuries: [
          sanitizeText(f.injuries),
          sanitizeText(f.medical_conditions),
          f.medications && `Medicamentos: ${sanitizeShort(f.medications)}`,
          clinicalText,
          evaText,
        ].filter(Boolean).join(" | "),
        food_restrictions: sanitizeText(f.food_restrictions),
        nutrition_context: nutritionContext,
        budget_food: f.budget_food,
        meals_per_day: Number(f.meals_per_day) || 5,
        has_kitchen: f.has_kitchen,
        notes: [
          f.main_goal && `Objetivo principal: ${sanitizeText(f.main_goal)}`,
          f.training_history && `Histórico: ${sanitizeText(f.training_history)}`,
          ...cardioDetail,
          f.sleep_hours && `Horas de sono: ${sanitizeShort(f.sleep_hours)}`,
          f.supplements && `Suplementos: ${sanitizeShort(f.supplements)}`,
          sanitizeText(f.notes),
        ].filter(Boolean).join("\n"),
        updated_at: new Date().toISOString(),
      };

      const { data, error: submitError } = await supabase.functions.invoke("public-anamnesis", {
        body: {
          action: "studio_submit",
          token,
          student: {
            full_name: sanitizeShort(f.name),
            weight_kg: f.weight_kg ? Number(f.weight_kg) : null,
            height_cm: f.height_cm ? Number(f.height_cm) : null,
            gender: f.gender,
          },
          anamnese: payload,
        },
      });
      if (submitError || data?.error) throw new Error(submitError?.message || data?.error);

      setDone(true);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  // ── Estados de tela ────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );

  if (error && !invite) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full"><CardContent className="pt-6 text-center">
        <p className="text-slate-600">{error}</p>
      </CardContent></Card>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full"><CardContent className="pt-8 pb-8 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Anamnese enviada!</h2>
        <p className="text-slate-600 text-sm">Obrigado, {f.name || "atleta"}! Suas respostas foram registradas. Seu treinador já pode montar suas prescrições. 💪</p>
      </CardContent></Card>
    </div>
  );

  // ── Render do formulário multi-step ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header marca */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-lg bg-[#1B2B4A] flex items-center justify-center text-white font-black">BN</div>
            <div className="text-left">
              <div className="font-bold text-slate-800 leading-tight">PERFORMANCE TRAINING</div>
              <div className="text-xs text-[#8B7355]">Anamnese do Atleta</div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-[#8B7355]" : "bg-slate-200"}`} />
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs text-[#8B7355] font-semibold">PASSO {step} DE {TOTAL_STEPS}</p>
            <h2 className="text-lg font-bold text-slate-800">
              {step === 1 && "Seus dados"}
              {step === 2 && "Seu objetivo"}
              {step === 3 && "Sua rotina de treino"}
              {step === 4 && "Sua saúde"}
              {step === 5 && "Triagem clínica"}
              {step === 6 && "Rotina alimentar e treino"}
              {step === 7 && "Preferências & substituições"}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* PASSO 1 — Dados pessoais */}
            {step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                <F label="Nome completo" span="col-span-2">
                  <Input value={f.name} onChange={e => set("name", e.target.value)} className="h-10" />
                </F>
                <F label="Idade"><Input type="number" value={f.age} onChange={e => set("age", e.target.value)} className="h-10" /></F>
                <F label="Sexo">
                  <SS value={f.gender} onChange={(v: string) => set("gender", v)} opts={[["M","Masculino"],["F","Feminino"]]} />
                </F>
                <F label="Peso (kg)"><Input type="number" step="0.1" value={f.weight_kg} onChange={e => set("weight_kg", e.target.value)} className="h-10" /></F>
                <F label="Altura (cm)"><Input type="number" value={f.height_cm} onChange={e => set("height_cm", e.target.value)} className="h-10" /></F>
                <F label="% Gordura (se souber)" span="col-span-2">
                  <Input type="number" step="0.1" value={f.body_fat_percent} onChange={e => set("body_fat_percent", e.target.value)} className="h-10" placeholder="opcional" />
                </F>
              </div>
            )}

            {/* PASSO 2 — Objetivo + modalidades */}
            {step === 2 && (
              <div className="space-y-4">
                <F label="Objetivo principal">
                  <SS value={f.objective} onChange={(v: string) => set("objective", v)} placeholder="Selecione..."
                    opts={[["emagrecimento","Emagrecimento"],["hipertrofia","Ganho de massa"],["performance","Performance esportiva"],["saude","Saúde e bem-estar"]]} />
                </F>
                <F label="Conte mais sobre o que você quer alcançar">
                  <Textarea value={f.main_goal} onChange={e => set("main_goal", e.target.value)} className="min-h-[70px]" placeholder="Ex: correr minha primeira meia maratona, melhorar a postura, perder 5kg..." />
                </F>
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-2 block">Tenho interesse em (marque todas que quiser):</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["interest_strength", "🏋️ Musculação"],
                      ["interest_running", "🏃 Corrida"],
                      ["interest_swimming", "🏊 Natação"],
                      ["interest_cycling", "🚴 Ciclismo"],
                      ["interest_nutrition", "🍎 Nutrição"],
                    ].map(([key, label]) => (
                      <label key={key} className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${(f as any)[key] ? "border-[#8B7355] bg-[#F5EDD8]/40" : "border-slate-200"}`}>
                        <Checkbox checked={(f as any)[key]} onCheckedChange={v => set(key, !!v)} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PASSO 3 — Rotina de treino */}
            {step === 3 && (
              <div className="grid grid-cols-2 gap-3">
                <F label="Nível de atividade atual" span="col-span-2">
                  <SS value={f.activity_level} onChange={(v: string) => set("activity_level", v)} placeholder="Selecione..."
                    opts={[["sedentario","Sedentário"],["leve","Levemente ativo"],["moderado","Moderadamente ativo"],["muito_ativo","Muito ativo"],["extremo","Extremamente ativo"]]} />
                </F>
                <F label="Tempo de treino (meses)"><Input type="number" value={f.experience_months} onChange={e => set("experience_months", e.target.value)} className="h-10" /></F>
                <F label="Dias disponíveis/semana"><Input type="number" min="1" max="7" value={f.days_available} onChange={e => set("days_available", e.target.value)} className="h-10" /></F>
                <F label="Minutos por sessão"><Input type="number" value={f.session_duration_min} onChange={e => set("session_duration_min", e.target.value)} className="h-10" /></F>
                <F label="Onde treina">
                  <SS value={f.equipment} onChange={(v: string) => set("equipment", v)} placeholder="Selecione..."
                    opts={[["academia_completa","Academia completa"],["casa_halteres","Casa (halteres)"],["casa_sem_equip","Casa (sem equipamento)"],["ar_livre","Ar livre"]]} />
                </F>
                {(f.interest_running || f.interest_swimming || f.interest_cycling) && (
                  <>
                    <F label="Objetivo / prova" span="col-span-2">
                      <Input value={f.sport_goal} onChange={e => set("sport_goal", e.target.value)} className="h-10" placeholder="Ex: Maratona em outubro, 1500m sub-30..." />
                    </F>
                    <F label="Volume atual (km ou h/sem)"><Input type="number" value={f.current_volume_weekly} onChange={e => set("current_volume_weekly", e.target.value)} className="h-10" /></F>
                    <F label="Recuperado hoje? (0-10)"><Input type="number" min="0" max="10" value={f.perceived_recovery} onChange={e => set("perceived_recovery", e.target.value)} className="h-10" placeholder="10 = ótimo" /></F>
                    <F label="FC máxima (se souber)"><Input type="number" value={f.fcmax} onChange={e => set("fcmax", e.target.value)} className="h-10" placeholder="opcional" /></F>
                    <F label="FC repouso (se souber)"><Input type="number" value={f.fcrep} onChange={e => set("fcrep", e.target.value)} className="h-10" placeholder="opcional" /></F>
                    {f.interest_running && (<>
                      <F label="Corrida — onde corre"><SS value={f.run_where} onChange={(v: string) => set("run_where", v)} placeholder="Selecione..." opts={[["rua","Rua/asfalto"],["esteira","Esteira"],["trilha","Trilha"],["pista","Pista"]]} /></F>
                      <F label="Corrida — melhor tempo recente"><Input value={f.run_best_time} onChange={e => set("run_best_time", e.target.value)} className="h-10" placeholder="ex: 10k em 52min" /></F>
                    </>)}
                    {f.interest_swimming && (<>
                      <F label="Natação — acesso à piscina"><SS value={f.swim_pool} onChange={(v: string) => set("swim_pool", v)} placeholder="Selecione..." opts={[["25m","Piscina 25m"],["50m","Piscina 50m"],["nao","Sem acesso regular"]]} /></F>
                      <F label="Natação — nível"><SS value={f.swim_level} onChange={(v: string) => set("swim_level", v)} placeholder="Selecione..." opts={[["iniciante","Iniciante"],["intermediario","Intermediário"],["avancado","Avançado"]]} /></F>
                      <F label="Natação — volume (m ou min/sem)" span="col-span-2"><Input value={f.swim_volume} onChange={e => set("swim_volume", e.target.value)} className="h-10" placeholder="ex: 3000m/sem ou 2x40min" /></F>
                    </>)}
                    {f.interest_cycling && (<>
                      <F label="Ciclismo — tipo"><SS value={f.bike_type} onChange={(v: string) => set("bike_type", v)} placeholder="Selecione..." opts={[["speed","Speed/estrada"],["mtb","MTB"],["indoor","Indoor/rolo"]]} /></F>
                      <F label="Ciclismo — volume (km ou h/sem)"><Input value={f.bike_volume} onChange={e => set("bike_volume", e.target.value)} className="h-10" placeholder="ex: 120km/sem" /></F>
                      <div className="col-span-2 flex items-center gap-2">
                        <Checkbox checked={f.bike_power} onCheckedChange={v => set("bike_power", !!v)} id="bikepow" />
                        <label htmlFor="bikepow" className="text-sm cursor-pointer">Tenho medidor de potência</label>
                      </div>
                    </>)}
                  </>
                )}
                <F label="Histórico de treino" span="col-span-2">
                  <Textarea value={f.training_history} onChange={e => set("training_history", e.target.value)} className="min-h-[60px]" placeholder="O que você já praticou, há quanto tempo..." />
                </F>
              </div>
            )}

            {/* PASSO 4 — Saúde */}
            {step === 4 && (
              <div className="grid grid-cols-2 gap-3">
                <F label="Lesões atuais ou passadas" span="col-span-2">
                  <Textarea value={f.injuries} onChange={e => set("injuries", e.target.value)} className="min-h-[60px]" placeholder="Ex: dor no joelho direito, hérnia de disco..." />
                </F>
                <F label="Condições médicas" span="col-span-2">
                  <Textarea value={f.medical_conditions} onChange={e => set("medical_conditions", e.target.value)} className="min-h-[50px]" placeholder="Ex: hipertensão, diabetes... (deixe vazio se nenhuma)" />
                </F>
                <F label="Medicamentos" span="col-span-2">
                  <Input value={f.medications} onChange={e => set("medications", e.target.value)} className="h-10" placeholder="opcional" />
                </F>
                <F label="Nível de estresse (0-10)"><Input type="number" min="0" max="10" value={f.stress_score} onChange={e => set("stress_score", e.target.value)} className="h-10" /></F>
                <F label="Qualidade do sono (0-10)"><Input type="number" min="0" max="10" value={f.sleep_quality} onChange={e => set("sleep_quality", e.target.value)} className="h-10" /></F>
                <F label="Horas de sono/noite"><Input type="number" step="0.5" value={f.sleep_hours} onChange={e => set("sleep_hours", e.target.value)} className="h-10" /></F>
              </div>
            )}

            {/* PASSO 5 — Triagem clínica (segurança) */}
            {step === 5 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Usado só para deixar a prescrição segura. Na dúvida, responda "Sim".</p>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Problema cardíaco / pressão alta?"><SS value={f.clin_cardiac} onChange={(v: string) => set("clin_cardiac", v)} opts={[["nao","Não"],["sim","Sim"]]} /></F>
                  <F label="Dor no peito / tontura ao se esforçar?"><SS value={f.clin_chest_pain} onChange={(v: string) => set("clin_chest_pain", v)} opts={[["nao","Não"],["sim","Sim"]]} /></F>
                  <F label="Cirurgia nos últimos 6 meses?"><SS value={f.clin_surgery} onChange={(v: string) => set("clin_surgery", v)} opts={[["nao","Não"],["sim","Sim"]]} /></F>
                  {f.clin_surgery === "sim" && <F label="Qual / quando?"><Input value={f.clin_surgery_detail} onChange={e => set("clin_surgery_detail", e.target.value)} className="h-10" /></F>}
                  {f.gender === "F" && <F label="Gestação / pós-parto?"><SS value={f.clin_pregnant} onChange={(v: string) => set("clin_pregnant", v)} opts={[["na","Não se aplica"],["gravida","Gestante"],["posparto","Pós-parto recente"]]} /></F>}
                  {f.gender === "F" && f.clin_pregnant !== "na" && <F label="Semanas gestação / meses pós-parto"><Input value={f.clin_pregnant_detail} onChange={e => set("clin_pregnant_detail", e.target.value)} className="h-10" placeholder="ex: 20 semanas" /></F>}
                  <F label="Fuma?"><SS value={f.clin_smoke} onChange={(v: string) => set("clin_smoke", v)} opts={[["nao","Não"],["sim","Sim"]]} /></F>
                  <F label="Doente / com febre agora?"><SS value={f.clin_acute} onChange={(v: string) => set("clin_acute", v)} opts={[["nao","Não"],["sim","Sim"]]} /></F>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1 block">Dor articular AGORA (0 = sem dor · 10 = dor máxima)</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {[["eva_tornozelo","Tornozelo"],["eva_joelho","Joelho"],["eva_quadril","Quadril"],["eva_lombar","Lombar"],["eva_ombro","Ombro"]].map(([k, lbl]) => (
                      <div key={k}>
                        <Label className="text-[10px] text-slate-500 block text-center mb-0.5">{lbl}</Label>
                        <Input type="number" min="0" max="10" value={(f as any)[k]} onChange={e => set(k, e.target.value)} className="h-9 text-center px-1" />
                      </div>
                    ))}
                  </div>
                </div>
                <F label="Outra condição de saúde relevante?">
                  <Textarea value={f.clin_other} onChange={e => set("clin_other", e.target.value)} className="min-h-[44px]" placeholder="opcional — asma, diabetes, etc." />
                </F>
              </div>
            )}

            {/* PASSO 6 — Rotina alimentar e treino */}
            {step === 6 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">Ajuda a programar o que comer perto do treino — orientações práticas, sem cardápio fechado.</p>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Refeições por dia"><SS value={f.meals_per_day} onChange={(v: string) => set("meals_per_day", v)} opts={[["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7+"]]} /></F>
                  <F label="Seus horários são..."><SS value={f.meal_routine} onChange={(v: string) => set("meal_routine", v)} placeholder="Selecione..." opts={[["fixa","Fixos no dia a dia"],["varia","Variam um pouco"],["muda","Mudam bastante"]]} /></F>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1 block">Horários aproximados das refeições</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px] text-slate-500 block mb-0.5">1ª refeição</Label><Input type="time" value={f.meal_t1} onChange={e => set("meal_t1", e.target.value)} className="h-10" /></div>
                    <div><Label className="text-[10px] text-slate-500 block mb-0.5">Almoço</Label><Input type="time" value={f.meal_t2} onChange={e => set("meal_t2", e.target.value)} className="h-10" /></div>
                    <div><Label className="text-[10px] text-slate-500 block mb-0.5">Última refeição</Label><Input type="time" value={f.meal_t3} onChange={e => set("meal_t3", e.target.value)} className="h-10" /></div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Que horas você costuma treinar?</Label>
                  <div className="flex flex-wrap gap-2">
                    {TRAIN_TIMES.map(t => (
                      <button type="button" key={t} onClick={() => set("train_time", f.train_time === t ? "" : t)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${f.train_time === t ? "border-[#8B7355] bg-[#F5EDD8]/60 text-[#1B2B4A] font-medium" : "border-slate-200 text-slate-600 hover:border-[#8B7355]/40"}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Treina em jejum?"><SS value={f.train_fasted} onChange={(v: string) => set("train_fasted", v)} opts={[["nunca","Nunca"],["asvezes","Às vezes"],["sempre","Sempre"]]} /></F>
                  <F label="Fome ao acordar?"><SS value={f.appetite_wake} onChange={(v: string) => set("appetite_wake", v)} placeholder="Selecione..." opts={[["faminto","Com bastante fome"],["normal","Normal"],["sem_fome","Sem fome"],["enjoo","Enjoo / não como"]]} /></F>
                </div>
              </div>
            )}

            {/* PASSO 7 — Preferências & substituições */}
            {step === 7 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Alimentos que você curte <span className="text-slate-400 font-normal">(toque pra marcar)</span></Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_FOODS.map(food => (
                      <button type="button" key={food} onClick={() => toggleCsv("food_likes", food)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition ${hasCsv("food_likes", food) ? "border-green-500 bg-green-50 text-green-700 font-medium" : "border-slate-200 text-slate-600 hover:border-green-400"}`}>{food}</button>
                    ))}
                  </div>
                  <Input value={f.food_likes} onChange={e => set("food_likes", e.target.value)} className="h-9 text-sm mt-2" placeholder="adicione outros, separados por vírgula" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Alimentos que NÃO gosta / não come</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_FOODS.map(food => (
                      <button type="button" key={food} onClick={() => toggleCsv("food_dislikes", food)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition ${hasCsv("food_dislikes", food) ? "border-red-400 bg-red-50 text-red-600 font-medium" : "border-slate-200 text-slate-600 hover:border-red-300"}`}>{food}</button>
                    ))}
                  </div>
                  <Input value={f.food_dislikes} onChange={e => set("food_dislikes", e.target.value)} className="h-9 text-sm mt-2" placeholder="adicione outros, separados por vírgula" />
                </div>
                <F label="Restrições / alergias / dieta">
                  <Textarea value={f.food_restrictions} onChange={e => set("food_restrictions", e.target.value)} className="min-h-[44px]" placeholder="Ex: intolerância à lactose, vegetariano, alergia a amendoim..." />
                </F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Orçamento alimentar"><SS value={f.budget_food} onChange={(v: string) => set("budget_food", v)} opts={[["economico","Econômico"],["moderado","Moderado"],["premium","Premium"]]} /></F>
                  <F label="Suplementos que usa"><Input value={f.supplements} onChange={e => set("supplements", e.target.value)} className="h-10" placeholder="opcional" /></F>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={f.has_kitchen} onCheckedChange={v => set("has_kitchen", !!v)} id="kit" />
                  <label htmlFor="kit" className="text-sm cursor-pointer">Tenho acesso a cozinha / micro-ondas</label>
                </div>
                <F label="Algo mais que queira contar?">
                  <Textarea value={f.notes} onChange={e => set("notes", e.target.value)} className="min-h-[44px]" placeholder="opcional" />
                </F>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Navegação */}
            <div className="flex gap-2 pt-2">
              {step > 1 && (
                <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>Voltar</Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button className="flex-1 bg-[#1B2B4A] hover:bg-[#1B2B4A]/90" onClick={() => setStep(step + 1)}>Próximo</Button>
              ) : (
                <Button className="flex-1 bg-[#8B7355] hover:bg-[#8B7355]/90" onClick={submit} disabled={submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar anamnese"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-4">BN Performance Training · Matheus Loreto · CREF 040718-G/SC</p>
      </div>
    </div>
  );
}
