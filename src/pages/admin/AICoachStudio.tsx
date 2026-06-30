import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Bot, Save, Sparkles } from "lucide-react";

interface AiConfig {
  enabled: boolean;
  assistant_name: string;
  methodology: string;
  tone: string;
  doctrine: string;
  ethical_limits: string;
  student_assistant_enabled: boolean;
  staff_assistant_enabled: boolean;
}

const DEFAULTS: AiConfig = {
  enabled: true,
  assistant_name: "Setty",
  methodology: "",
  tone: "",
  doctrine: "",
  ethical_limits: "",
  student_assistant_enabled: true,
  staff_assistant_enabled: true,
};

export default function AICoachStudio() {
  const { companyId, role } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const queryClient = useQueryClient();
  const effectiveCompanyId =
    role === "master" ? (isViewingCompany ? viewingCompany?.id ?? null : null) : companyId;

  const [form, setForm] = useState<AiConfig>(DEFAULTS);

  const { data, isLoading } = useQuery({
    queryKey: ["company-ai-config", effectiveCompanyId],
    enabled: !!effectiveCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_ai_config")
        .select("*")
        .eq("company_id", effectiveCompanyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        enabled: data.enabled ?? true,
        assistant_name: data.assistant_name ?? "Setty",
        methodology: data.methodology ?? "",
        tone: data.tone ?? "",
        doctrine: data.doctrine ?? "",
        ethical_limits: data.ethical_limits ?? "",
        student_assistant_enabled: data.student_assistant_enabled ?? true,
        staff_assistant_enabled: data.staff_assistant_enabled ?? true,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!effectiveCompanyId) throw new Error("Empresa não selecionada");
      const payload = {
        company_id: effectiveCompanyId,
        ...form,
        assistant_name: form.assistant_name.trim() || "Setty",
      };
      const { error } = await supabase
        .from("company_ai_config")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração da IA salva");
      queryClient.invalidateQueries({ queryKey: ["company-ai-config", effectiveCompanyId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const set = (k: keyof AiConfig, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  if (role === "master" && !isViewingCompany) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Selecione uma empresa para configurar o assistente de IA.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Central de IA</h1>
          <p className="text-sm text-muted-foreground">
            Configure a persona do assistente de IA da sua empresa (white-label).
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Identidade
              </CardTitle>
              <CardDescription>Nome e disponibilidade do assistente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="assistant_name">Nome do assistente</Label>
                <Input
                  id="assistant_name"
                  value={form.assistant_name}
                  onChange={(e) => set("assistant_name", e.target.value)}
                  placeholder="Setty"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Assistente ativo</Label>
                  <p className="text-xs text-muted-foreground">Liga ou desliga o assistente para toda a empresa.</p>
                </div>
                <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Disponível para alunos</Label>
                  <p className="text-xs text-muted-foreground">Widget flutuante no portal do aluno (com dados do treino).</p>
                </div>
                <Switch
                  checked={form.student_assistant_enabled}
                  onCheckedChange={(v) => set("student_assistant_enabled", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Disponível para a equipe</Label>
                  <p className="text-xs text-muted-foreground">Apoio de metodologia e prescrição para treinadores.</p>
                </div>
                <Switch
                  checked={form.staff_assistant_enabled}
                  onCheckedChange={(v) => set("staff_assistant_enabled", v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Persona</CardTitle>
              <CardDescription>
                Define como o assistente pensa e responde. Tudo isso é injetado nas respostas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="methodology">Metodologia</Label>
                <Textarea
                  id="methodology"
                  rows={3}
                  value={form.methodology}
                  onChange={(e) => set("methodology", e.target.value)}
                  placeholder="Ex.: Foco em sobrecarga progressiva, ciclos de 42 dias, controle rígido de volume por grupamento..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tom de voz</Label>
                <Textarea
                  id="tone"
                  rows={2}
                  value={form.tone}
                  onChange={(e) => set("tone", e.target.value)}
                  placeholder="Ex.: Técnico, direto e sem motivacional vazio."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctrine">Doutrina / princípios inegociáveis</Label>
                <Textarea
                  id="doctrine"
                  rows={3}
                  value={form.doctrine}
                  onChange={(e) => set("doctrine", e.target.value)}
                  placeholder="Ex.: Execução antes de carga; amplitude completa; progressão baseada em dados."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ethical_limits">Limites éticos</Label>
                <Textarea
                  id="ethical_limits"
                  rows={2}
                  value={form.ethical_limits}
                  onChange={(e) => set("ethical_limits", e.target.value)}
                  placeholder="Ex.: Nunca recomendar fármacos; encaminhar dores/lesões a profissional de saúde."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
