// Toggle "Contato semanal": quando ligado, o BNITO pergunta proativamente ao aluno 2x/semana
// (dificuldade? quer mandar vídeo p/ correção?). A automação que dispara é do Codex; aqui só o controle.
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function WeeklyContactToggle({ studentId, initial }: { studentId: string; initial?: boolean }) {
  const [enabled, setEnabled] = useState(!!initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setEnabled(!!initial); }, [initial]);

  const toggle = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    const { error } = await (supabase as any).from("students").update({ weekly_contact_enabled: next }).eq("id", studentId);
    setSaving(false);
    if (error) {
      setEnabled(!next);
      toast.error("Não foi possível salvar");
    } else {
      toast.success(next ? "Contato semanal ativado" : "Contato semanal desativado");
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <MessageCircleHeart className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`wc-${studentId}`} className="text-sm font-medium cursor-pointer">Contato semanal</Label>
          <Switch id={`wc-${studentId}`} checked={enabled} disabled={saving} onCheckedChange={toggle} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          2x por semana o assistente pergunta ao aluno, de forma variada, se teve dificuldades ou quer enviar vídeo para correção.
        </p>
      </div>
    </div>
  );
}
