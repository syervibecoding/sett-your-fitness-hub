// ============================================================================
// FunctionalAssessment — Avaliação Postural e Funcional com IA
//   Envia fotos de postura estática + overhead squat e dados clínicos.
//   A IA gera um laudo (report_text) e um JSON estruturado usado depois
//   como contexto pelas prescrições de musculação e corrida.
// ============================================================================
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, ClipboardCheck, AlertCircle } from "lucide-react";

interface Student { id: string; full_name: string; }

const IMAGE_SLOTS: { key: string; label: string }[] = [
  { key: "image_postura_frente", label: "Postura — Frontal" },
  { key: "image_postura_lado",   label: "Postura — Lateral" },
  { key: "image_postura_costas", label: "Postura — Posterior" },
  { key: "image_squat_frente",   label: "Overhead Squat — Frontal" },
  { key: "image_squat_lado",     label: "Overhead Squat — Lateral" },
  { key: "image_squat_costas",   label: "Overhead Squat — Posterior" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FunctionalAssessment() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [students, setStudents]   = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [images, setImages]       = useState<Record<string, string>>({});
  const [form, setForm] = useState({ queixa_principal: "", historico_lesoes: "", modalidade: "", nivel: "intermediario" });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [result, setResult]       = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase.from("company_members")
        .select("company_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m) return;
      setCompanyId(m.company_id);
      const { data: list } = await supabase.from("students")
        .select("id, full_name").eq("company_id", m.company_id).order("full_name");
      setStudents(list || []);
    })();
  }, []);

  useEffect(() => {
    if (!studentId) { setResult(null); return; }
    (async () => {
      const { data } = await supabase.from("functional_assessments")
        .select("*").eq("student_id", studentId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setResult(data ?? null);
      if (data) setForm({
        queixa_principal: data.queixa_principal ?? "",
        historico_lesoes: data.historico_lesoes ?? "",
        modalidade: data.modalidade ?? "",
        nivel: data.nivel ?? "intermediario",
      });
    })();
  }, [studentId]);

  const student = students.find(s => s.id === studentId);

  async function onPick(key: string, file?: File) {
    if (!file) return;
    const b64 = await fileToBase64(file);
    setImages(prev => ({ ...prev, [key]: b64 }));
  }

  async function generate() {
    if (!studentId || !companyId) { setError("Selecione um aluno."); return; }
    if (Object.keys(images).length === 0) { setError("Envie ao menos uma foto."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const { data, error: e } = await supabase.functions.invoke("ai-functional-assessment", {
        body: {
          student_id: studentId, student_name: student?.full_name, company_id: companyId,
          ...images, ...form,
        },
      });
      if (e || data?.error) throw new Error(data?.error || e?.message);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Erro ao gerar avaliação.");
    }
    setLoading(false);
  }

  const json = result?.assessment_json;

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Avaliação</p>
          <h1 className="font-display text-3xl">Avaliação Funcional</h1>
          <p className="text-sm text-muted-foreground">Postura estática + overhead squat · laudo determinístico por Metodologia BN · contexto para a prescrição</p>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Aluno</CardTitle></CardHeader>
          <CardContent>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {studentId && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fotos</CardTitle>
                <p className="text-xs text-muted-foreground">Envie o que tiver — nem todas são obrigatórias.</p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {IMAGE_SLOTS.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative border border-line rounded-lg aspect-square overflow-hidden flex items-center justify-center bg-muted/30">
                      {images[key] ? (
                        <>
                          <img src={images[key]} alt={label} className="object-cover w-full h-full" />
                          <button
                            type="button"
                            onClick={() => setImages(prev => { const n = { ...prev }; delete n[key]; return n; })}
                            className="absolute top-1 right-1 bg-ink/70 text-paper rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-1 text-muted-foreground text-xs">
                          <Upload className="h-5 w-5" />
                          Enviar
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => onPick(key, e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Dados clínicos</CardTitle></CardHeader>
              <CardContent className="grid gap-3 grid-cols-2">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1">Queixa principal</Label>
                  <Textarea className="text-sm min-h-[56px]" value={form.queixa_principal}
                    onChange={e => setForm(f => ({ ...f, queixa_principal: e.target.value }))}
                    placeholder="Ex: dor no joelho ao agachar" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1">Histórico de lesões</Label>
                  <Textarea className="text-sm min-h-[56px]" value={form.historico_lesoes}
                    onChange={e => setForm(f => ({ ...f, historico_lesoes: e.target.value }))}
                    placeholder="Ex: entorse de tornozelo D em 2023" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Modalidade</Label>
                  <Input className="h-9 text-sm" value={form.modalidade}
                    onChange={e => setForm(f => ({ ...f, modalidade: e.target.value }))}
                    placeholder="Ex: corrida + musculação" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Nível</Label>
                  <Select value={form.nivel} onValueChange={v => setForm(f => ({ ...f, nivel: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}

            <Button className="w-full" onClick={generate} disabled={loading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando…</>
                : <><ClipboardCheck className="mr-2 h-4 w-4" /> Gerar avaliação</>}
            </Button>

            {result && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Laudo</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {(json?.score_postural?.total != null || json?.score_funcional?.total != null) && (
                    <div className="grid grid-cols-2 gap-2">
                      {json?.score_postural?.total != null && (
                        <div className="border border-line rounded p-2 text-center">
                          <div className="font-display text-2xl">{json.score_postural.total}/10</div>
                          <div className="text-xs text-muted-foreground">Score postural</div>
                        </div>
                      )}
                      {json?.score_funcional?.total != null && (
                        <div className="border border-line rounded p-2 text-center">
                          <div className="font-display text-2xl">{json.score_funcional.total}/10</div>
                          <div className="text-xs text-muted-foreground">Score funcional</div>
                        </div>
                      )}
                    </div>
                  )}
                  {Array.isArray(json?.prioridades_corretivas) && json.prioridades_corretivas.length > 0 && (
                    <div>
                      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Prioridades corretivas</p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {json.prioridades_corretivas.map((p: string, i: number) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.report_text && (
                    <div>
                      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Relatório</p>
                      <p className="whitespace-pre-line text-muted-foreground">{result.report_text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
