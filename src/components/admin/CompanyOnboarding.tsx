// White-label: questionário que molda a "IA-coração" para cada empresa.
// O que a empresa responde aqui vira a persona/metodologia que o BNITO e as edge functions usam.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { fetchCompanyAiConfig, saveCompanyAiConfig, type CompanyAiConfig } from "@/lib/companyAiConfig";

export default function CompanyOnboarding() {
  const { companyId, role } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const effectiveCompanyId = role === "master" ? (isViewingCompany ? viewingCompany?.id : null) : companyId;

  const [form, setForm] = useState<CompanyAiConfig>({
    assistant_name: "",
    consultancy_name: "",
    methodology: "",
    plans_payment: "",
    tone: "",
    onboarding_completed: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchCompanyAiConfig(effectiveCompanyId).then((c) => {
      if (on) { setForm(c); setLoading(false); }
    });
    return () => { on = false; };
  }, [effectiveCompanyId]);

  const set = (k: keyof CompanyAiConfig, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (complete: boolean) => {
    if (!effectiveCompanyId) { toast.error("Empresa não identificada"); return; }
    setSaving(true);
    const { error } = await saveCompanyAiConfig(effectiveCompanyId, {
      assistant_name: form.assistant_name?.trim() || "Assistente",
      consultancy_name: form.consultancy_name?.trim() || null,
      methodology: form.methodology?.trim() || null,
      plans_payment: form.plans_payment?.trim() || null,
      tone: form.tone?.trim() || null,
      onboarding_completed: complete,
    });
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error });
    else toast.success(complete ? "Configuração concluída!" : "Rascunho salvo");
  };

  // Sem empresa efetiva (master fora do company-view): não deixa preencher uma config "fantasma"
  // que só falharia no submit — orienta a entrar numa empresa primeiro.
  if (!effectiveCompanyId) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-2">
        <Sparkles className="h-6 w-6 text-primary mx-auto" />
        <h1 className="font-display text-2xl text-foreground">Selecione uma empresa</h1>
        <p className="text-sm text-muted-foreground">
          Entre no painel de uma empresa para configurar a IA assistente dela.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-eyebrow">Configuração da consultoria</p>
        <h1 className="font-display text-2xl text-foreground leading-tight flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Molde sua IA assistente
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estas respostas tornam o assistente perfeito para a sua consultoria — nome, metodologia, planos e tom de voz.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-mono-data text-sm uppercase tracking-wide text-primary">Identidade</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da sua consultoria</Label>
            <Input value={form.consultancy_name ?? ""} onChange={(e) => set("consultancy_name", e.target.value)} placeholder="Ex: BN Performance Training" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do seu assistente de IA</Label>
            <Input value={form.assistant_name ?? ""} onChange={(e) => set("assistant_name", e.target.value)} placeholder="Ex: BNITO" />
            <p className="text-xs text-muted-foreground">É como o assistente vai se apresentar para você e seus alunos.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Tom de voz</Label>
            <Input value={form.tone ?? ""} onChange={(e) => set("tone", e.target.value)} placeholder="Ex: técnico e direto, mas acolhedor" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-mono-data text-sm uppercase tracking-wide text-primary">Metodologia & Planos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Como funciona sua metodologia de treino?</Label>
            <Textarea className="min-h-[140px]" value={form.methodology ?? ""} onChange={(e) => set("methodology", e.target.value)}
              placeholder="Descreva sua filosofia: priorização técnica, progressão, volume por nível, padrões preferidos, o que evita, etc. A IA prescreve seguindo isto." />
          </div>
          <div className="space-y-1.5">
            <Label>Como funcionam seus planos e pagamentos?</Label>
            <Textarea className="min-h-[100px]" value={form.plans_payment ?? ""} onChange={(e) => set("plans_payment", e.target.value)}
              placeholder="Ex: planos trimestral/semestral/anual, formas de pagamento, política de renovação." />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => save(false)} disabled={saving}>Salvar rascunho</Button>
        <Button onClick={() => save(true)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
          Concluir configuração
        </Button>
      </div>
    </div>
  );
}
