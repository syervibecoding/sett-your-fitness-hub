import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { applyTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const COMMON_FOODS = [
  "Frango", "Ovos", "Carne", "Peixe", "Arroz", "Batata doce", "Pão", "Tapioca",
  "Aveia", "Feijão", "Macarrão", "Frutas", "Salada", "Legumes", "Iogurte", "Whey", "Queijo",
];

type FieldType = "text" | "textarea" | "number" | "date" | "radio" | "checkbox" | "scale";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  help?: string;
  required?: boolean;
  other?: boolean; // allow free text for checkbox
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

interface Section {
  title: string;
  help?: string;
  fields: Field[];
  showIfEndurance?: boolean;
}

const ENDURANCE_INTERESTS = ["Corrida", "Natação", "Ciclismo"];

const SECTIONS: Section[] = [
  {
    title: "Seus dados",
    fields: [
      { key: "idade", label: "Idade", type: "text", required: true },
      { key: "sexo", label: "Sexo", type: "radio", options: ["Masculino", "Feminino"], required: true },
      { key: "peso", label: "Peso (kg)", type: "text", required: true },
      { key: "altura", label: "Altura (cm)", type: "text", required: true },
      { key: "percentual_gordura", label: "% de gordura (se souber)", type: "text", help: "Opcional" },
    ],
  },
  {
    title: "Seu objetivo",
    fields: [
      { key: "objetivos", label: "Objetivos (marque todos que quiser)", type: "checkbox", options: ["Emagrecimento", "Ganho de massa", "Performance esportiva", "Saúde e bem-estar"] },
      { key: "objetivo_principal", label: "Qual é o seu objetivo PRINCIPAL (o mais importante)?", type: "radio", options: ["Emagrecimento", "Ganho de massa", "Performance esportiva", "Saúde e bem-estar"] },
      { key: "objetivo_descricao", label: "Conte mais sobre o que você quer alcançar", type: "textarea", help: "Ex: correr minha primeira meia maratona, melhorar a postura, perder 5kg..." },
      { key: "interesses", label: "Tenho interesse em (marque todas que quiser)", type: "checkbox", options: ["Musculação", "Corrida", "Natação", "Ciclismo", "Nutrição"] },
      { key: "tem_nutricionista", label: "Já tem nutricionista?", type: "radio", options: ["Não", "Sim"] },
      { key: "quer_dicas_nutricao", label: "Quer dicas de nutrição?", type: "radio", options: ["Sim", "Não"] },
      { key: "tem_assessoria", label: "Já tem assessoria/treinador para corrida, natação ou ciclismo?", type: "radio", options: ["Não — quero o plano aqui", "Sim, já tenho"] },
    ],
  },
  {
    title: "Sua rotina de treino",
    fields: [
      { key: "nivel_atividade", label: "Nível de atividade atual", type: "radio", options: [
        "Sedentário — quase não me movimento",
        "Levemente ativo — 1-2x/sem ou caminho um pouco",
        "Moderadamente ativo — treino 3-4x/sem",
        "Muito ativo — treino 5-6x/sem",
        "Extremamente ativo — treino pesado todo dia / trabalho físico",
      ] },
      { key: "tempo_treino_meses", label: "Há quanto tempo treina (em meses)", type: "text" },
      { key: "dias_por_semana", label: "Quantos dias por semana você pode treinar", type: "text" },
      { key: "dias_por_modalidade", label: "Quais dias da semana para cada modalidade?", type: "textarea", help: "Ex: Musculação seg/qua/sex · Corrida ter/qui" },
      { key: "minutos_sessao", label: "Minutos por sessão", type: "text" },
      { key: "onde_treina", label: "Onde treina", type: "radio", options: ["Academia completa", "Casa (halteres)", "Casa (sem equipamento)", "Ar livre"] },
      { key: "historico_treino", label: "Histórico de treino", type: "textarea", help: "O que você já praticou, há quanto tempo..." },
    ],
  },
  {
    title: "Corrida / Natação / Ciclismo",
    help: "Aparece porque você marcou uma dessas modalidades. Preencha o que fizer sentido.",
    showIfEndurance: true,
    fields: [
      { key: "endurance_objetivo", label: "Objetivo / prova (endurance)", type: "text", help: "Ex: Maratona em outubro, 1500m sub-30..." },
      { key: "endurance_prova", label: "Tem prova/competição marcada? Qual?", type: "text" },
      { key: "endurance_data_prova", label: "Data da prova", type: "date" },
      { key: "endurance_volume", label: "Volume atual (km ou h por semana)", type: "text", help: "Ex: 6km/semana ou 2h/semana — ou 'não sei'" },
      { key: "endurance_recuperacao", label: "Quão recuperado você está hoje?", type: "scale", min: 0, max: 10, minLabel: "Nada", maxLabel: "Ótimo" },
      { key: "fc_maxima", label: "FC máxima (se souber)", type: "text" },
      { key: "fc_repouso", label: "FC de repouso (se souber)", type: "text" },
      { key: "corrida_onde", label: "Corrida — onde corre", type: "radio", options: ["Rua/asfalto", "Esteira", "Trilha", "Pista"] },
      { key: "corrida_tempo", label: "Corrida — melhor tempo recente", type: "text", help: "Ex: 10k em 52min" },
      { key: "natacao_piscina", label: "Natação — acesso à piscina", type: "radio", options: ["Piscina 25m", "Piscina 50m", "Sem acesso regular"] },
      { key: "natacao_nivel", label: "Natação — seu nível", type: "radio", options: [
        "Iniciante — nado há pouco / me viro mal",
        "Intermediário — nado bem, +6 meses",
        "Avançado — boa técnica, +2 anos",
        "Não sei dizer",
      ] },
      { key: "natacao_volume", label: "Natação — volume (m ou min por semana)", type: "text" },
      { key: "ciclismo_tipo", label: "Ciclismo — tipo", type: "radio", options: ["Speed/estrada", "MTB", "Indoor/rolo"] },
      { key: "ciclismo_volume", label: "Ciclismo — volume (km ou h por semana)", type: "text" },
      { key: "ciclismo_potencia", label: "Ciclismo — tem medidor de potência?", type: "radio", options: ["Não", "Sim"] },
    ],
  },
  {
    title: "Sua saúde",
    fields: [
      { key: "lesoes", label: "Lesões atuais ou passadas", type: "textarea", help: "Ex: dor no joelho direito, hérnia de disco..." },
      { key: "condicoes_medicas", label: "Condições médicas", type: "textarea", help: "Ex: hipertensão, diabetes... (deixe vazio se nenhuma)" },
      { key: "medicamentos", label: "Medicamentos", type: "text", help: "Opcional" },
      { key: "estresse", label: "Nível de estresse", type: "scale", min: 0, max: 10, minLabel: "Baixo", maxLabel: "Alto" },
      { key: "qualidade_sono", label: "Qualidade do sono", type: "scale", min: 0, max: 10, minLabel: "Ruim", maxLabel: "Ótima" },
      { key: "horas_sono", label: "Horas de sono por noite", type: "text" },
    ],
  },
  {
    title: "Triagem clínica (segurança)",
    help: 'Usado só para deixar a prescrição segura. Na dúvida, responda "Sim".',
    fields: [
      { key: "cardiaco", label: "Tem problema cardíaco / pressão alta?", type: "radio", options: ["Não", "Sim"], required: true },
      { key: "dor_peito", label: "Sente dor no peito / tontura ao se esforçar?", type: "radio", options: ["Não", "Sim"], required: true },
      { key: "cirurgia_recente", label: "Fez cirurgia nos últimos 6 meses?", type: "radio", options: ["Não", "Sim"] },
      { key: "cirurgia_qual", label: "Se fez cirurgia: qual e quando?", type: "text" },
      { key: "gestacao", label: "Gestação / pós-parto? (se aplicável)", type: "radio", options: ["Não se aplica", "Gestante", "Pós-parto recente"] },
      { key: "gestacao_detalhe", label: "Se gestante/pós-parto: semanas de gestação ou meses pós-parto", type: "text" },
      { key: "fuma", label: "Fuma?", type: "radio", options: ["Não", "Sim"] },
      { key: "doente_agora", label: "Está doente / com febre agora?", type: "radio", options: ["Não", "Sim"] },
      { key: "dor_tornozelo", label: "Dor no tornozelo AGORA", type: "scale", min: 0, max: 10, minLabel: "Sem dor", maxLabel: "Dor máxima" },
      { key: "dor_joelho", label: "Dor no joelho AGORA", type: "scale", min: 0, max: 10, minLabel: "Sem dor", maxLabel: "Dor máxima" },
      { key: "dor_quadril", label: "Dor no quadril AGORA", type: "scale", min: 0, max: 10, minLabel: "Sem dor", maxLabel: "Dor máxima" },
      { key: "dor_lombar", label: "Dor na lombar AGORA", type: "scale", min: 0, max: 10, minLabel: "Sem dor", maxLabel: "Dor máxima" },
      { key: "dor_ombro", label: "Dor no ombro AGORA", type: "scale", min: 0, max: 10, minLabel: "Sem dor", maxLabel: "Dor máxima" },
      { key: "outra_condicao", label: "Outra condição de saúde relevante?", type: "textarea", help: "Opcional — asma, diabetes, etc." },
    ],
  },
  {
    title: "Rotina alimentar e treino",
    help: "Ajuda a programar o que comer perto do treino — orientações práticas, sem cardápio fechado.",
    fields: [
      { key: "refeicoes_dia", label: "Refeições por dia", type: "radio", options: ["2", "3", "4", "5", "6", "7+"] },
      { key: "horarios_tipo", label: "Seus horários são...", type: "radio", options: ["Fixos no dia a dia", "Variam um pouco", "Mudam bastante"] },
      { key: "horarios_refeicoes", label: "Horários aproximados das refeições", type: "textarea", help: "Ex: 07h café · 12h almoço · 16h lanche · 20h jantar" },
      { key: "horario_treino", label: "Que horas você costuma treinar?", type: "checkbox", options: ["Manhã cedo", "Manhã", "Almoço", "Tarde", "Fim de tarde", "Noite"] },
      { key: "treina_jejum", label: "Treina em jejum?", type: "radio", options: ["Nunca", "Às vezes", "Sempre"] },
      { key: "fome_acordar", label: "Fome ao acordar?", type: "radio", options: ["Com bastante fome", "Normal", "Sem fome", "Enjoo / não como"] },
    ],
  },
  {
    title: "Preferências & substituições",
    fields: [
      { key: "alimentos_curte", label: "Alimentos que você CURTE", type: "checkbox", options: COMMON_FOODS, other: true },
      { key: "alimentos_nao_gosta", label: "Alimentos que NÃO gosta / não come", type: "checkbox", options: COMMON_FOODS, other: true },
      { key: "restricoes_alimentares", label: "Restrições / alergias / dieta", type: "textarea", help: "Ex: intolerância à lactose, vegetariano, alergia a amendoim..." },
      { key: "orcamento", label: "Orçamento alimentar", type: "radio", options: ["Econômico", "Moderado", "Premium"] },
      { key: "suplementos", label: "Suplementos que usa", type: "text", help: "Opcional" },
      { key: "acesso_cozinha", label: "Tem acesso a cozinha / micro-ondas?", type: "radio", options: ["Sim", "Não"] },
      { key: "observacoes", label: "Algo mais que queira contar?", type: "textarea", help: "Opcional" },
    ],
  },
];

export default function PublicAnamnesis() {
  const { studentId } = useParams<{ studentId: string }>();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [titleText, setTitleText] = useState("ANAMNESE");

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!studentId) { setNotFound(true); return; }
    const init = async () => {
      const { data, error } = await supabase.functions.invoke("public-anamnesis", {
        body: { action: "context", studentId },
      });
      if (error || !data?.student) { setNotFound(true); return; }
      setStudentName(data.student.full_name);
      if (data.branding) {
        if (data.branding.logo_url) setLogoSrc(data.branding.logo_url);
        setTitleText(data.branding.platform_title || "ANAMNESE");
        applyTheme(data.branding);
      }
    };
    init();
  }, [studentId]);

  const set = (key: string, value: any) => setAnswers(prev => ({ ...prev, [key]: value }));

  const toggleCheckbox = (key: string, item: string) => {
    setAnswers(prev => {
      const arr: string[] = Array.isArray(prev[key]) ? prev[key] : [];
      return { ...prev, [key]: arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item] };
    });
  };

  const interests: string[] = Array.isArray(answers.interesses) ? answers.interesses : [];
  const showEndurance = interests.some(i => ENDURANCE_INTERESTS.includes(i));

  const visibleSections = SECTIONS.filter(s => !s.showIfEndurance || showEndurance);

  const handleSubmit = async () => {
    // Validate required fields in visible sections
    for (const section of visibleSections) {
      for (const f of section.fields) {
        if (f.required) {
          const v = answers[f.key];
          const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
          if (empty) {
            toast({ title: "Preencha todos os campos obrigatórios", description: f.label, variant: "destructive" });
            return;
          }
        }
      }
    }

    setSaving(true);

    // Full answers snapshot goes into JSONB data; append "other" text to checkbox arrays.
    const data: Record<string, any> = { ...answers };
    for (const [key, txt] of Object.entries(otherText)) {
      if (txt && Array.isArray(data[key])) data[key] = [...data[key], txt];
    }

    const str = (v: any) => (v === undefined || v === null || v === "" ? null : String(v));
    const joinFilled = (...vals: any[]) => {
      const parts = vals.map(str).filter(Boolean);
      return parts.length ? parts.join(" · ") : null;
    };

    const payload: Record<string, any> = {
      action: "submit",
      studentId: studentId!,
      data,
      // Best-effort mapping to existing columns for legacy views
      modalities: interests,
      goals: str(answers.objetivo_descricao),
      injuries: str(answers.lesoes),
      diseases: joinFilled(answers.condicoes_medicas, answers.medicamentos ? `Medicamentos: ${answers.medicamentos}` : null),
      medications: str(answers.medicamentos),
      current_pain: str(answers.outra_condicao),
      nutrition: str(answers.restricoes_alimentares),
      restrictions: str(answers.restricoes_alimentares),
      physical_activity_level: str(answers.nivel_atividade),
      training_location: str(answers.onde_treina),
      session_duration: str(answers.minutos_sessao),
      training_days: str(answers.dias_por_modalidade),
      sleep_hours: str(answers.horas_sono),
      stress_level: str(answers.estresse),
      sleep_quality: str(answers.qualidade_sono),
      smoking: str(answers.fuma),
      extra_comments: str(answers.observacoes),
    };

    const { data: res, error } = await supabase.functions.invoke("public-anamnesis", { body: payload });

    setSaving(false);
    if (error || res?.error) {
      toast({ title: "Erro ao salvar anamnese", description: error?.message || res?.error, variant: "destructive" });
      return;
    }
    setDone(true);
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <h2 className="text-2xl text-primary">ALUNO NÃO ENCONTRADO</h2>
            <p className="text-muted-foreground font-sans">O link de anamnese é inválido ou o aluno não existe.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-3xl text-primary">ANAMNESE ENVIADA!</h2>
            <p className="text-muted-foreground font-sans">
              Seus dados foram recebidos com sucesso. Obrigado por preencher!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderField = (f: Field) => {
    const value = answers[f.key];
    return (
      <div key={f.key} className="space-y-2">
        <Label className="font-sans font-medium">
          {f.label}{f.required && " *"}
        </Label>
        {f.help && <p className="text-xs text-muted-foreground font-sans">{f.help}</p>}

        {f.type === "text" && (
          <Input value={value || ""} onChange={e => set(f.key, e.target.value)} className="bg-secondary border-border" />
        )}
        {f.type === "number" && (
          <Input type="number" value={value ?? ""} onChange={e => set(f.key, e.target.value)} className="bg-secondary border-border" />
        )}
        {f.type === "date" && (
          <Input type="date" value={value || ""} onChange={e => set(f.key, e.target.value)} className="bg-secondary border-border" />
        )}
        {f.type === "textarea" && (
          <Textarea value={value || ""} onChange={e => set(f.key, e.target.value)} className="bg-secondary border-border" />
        )}
        {f.type === "radio" && (
          <RadioGroup value={value || ""} onValueChange={v => set(f.key, v)}>
            {f.options!.map(o => (
              <div key={o} className="flex items-center gap-2">
                <RadioGroupItem value={o} id={`${f.key}-${o}`} />
                <Label htmlFor={`${f.key}-${o}`} className="font-sans font-normal cursor-pointer">{o}</Label>
              </div>
            ))}
          </RadioGroup>
        )}
        {f.type === "checkbox" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {f.options!.map(o => (
                <label key={o} className="flex items-center gap-2 text-sm font-sans cursor-pointer">
                  <Checkbox
                    checked={Array.isArray(value) && value.includes(o)}
                    onCheckedChange={() => toggleCheckbox(f.key, o)}
                  />
                  {o}
                </label>
              ))}
            </div>
            {f.other && (
              <Input
                placeholder="Outro..."
                value={otherText[f.key] || ""}
                onChange={e => setOtherText(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="mt-1 bg-secondary border-border"
              />
            )}
          </>
        )}
        {f.type === "scale" && (
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: (f.max! - f.min!) + 1 }, (_, i) => f.min! + i).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => set(f.key, n)}
                className={cn(
                  "h-9 w-9 rounded-md border text-sm font-sans transition-colors",
                  value === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border hover:border-primary/50"
                )}
              >
                {n}
              </button>
            ))}
            {(f.minLabel || f.maxLabel) && (
              <span className="w-full text-[11px] text-muted-foreground font-sans flex justify-between">
                <span>{f.minLabel}</span><span>{f.maxLabel}</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-3">
          {logoSrc ? (
            <img src={logoSrc} alt={titleText} className="h-16 mx-auto" />
          ) : (
            <div className="flex justify-center"><Logo size="lg" sublabel="Training App" /></div>
          )}
          <h1 className="text-4xl text-primary">ANAMNESE</h1>
          {studentName && <p className="text-muted-foreground font-sans">Aluno: <strong className="text-foreground">{studentName}</strong></p>}
        </div>

        {visibleSections.map(section => (
          <Card key={section.title} className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-primary text-xl">{section.title}</CardTitle>
              {section.help && <p className="text-sm text-muted-foreground font-sans">{section.help}</p>}
            </CardHeader>
            <CardContent className="space-y-6">
              {section.fields.map(renderField)}
            </CardContent>
          </Card>
        ))}

        <Button className="w-full" onClick={handleSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Finalizar Anamnese"}
        </Button>
      </div>
    </div>
  );
}
