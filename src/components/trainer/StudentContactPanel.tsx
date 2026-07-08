import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send } from "lucide-react";

interface Props {
  studentId: string;
  studentName?: string | null;
  hasWhatsapp?: boolean;
}

const TEMPLATES: { label: string; text: string }[] = [
  { label: "Check-in", text: "Olá {nome}! Passando para saber como está o seu treino esta semana. Alguma dúvida ou dificuldade?" },
  { label: "Motivação", text: "Bom dia, {nome}! Bora manter a constância essa semana. Qualquer coisa, estou por aqui. 💪" },
  { label: "Cobrança de treino", text: "Oi {nome}, notei que faz alguns dias sem registrar treino. Está tudo bem? Vamos retomar!" },
];

export function StudentContactPanel({ studentId, studentName, hasWhatsapp }: Props) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: "Escreva uma mensagem", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-manager", {
        body: { action: "send-student-text", studentId, message },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        toast({ title: "Não enviado", description: (data as any).error, variant: "destructive" });
      } else {
        toast({ title: "Mensagem enviada no WhatsApp!" });
        setMessage("");
      }
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e?.message || "Verifique se o WhatsApp está conectado", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-primary text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> CONTATO SEMANAL
        </CardTitle>
        <p className="text-xs text-muted-foreground font-sans">
          Envie uma mensagem direta pelo WhatsApp da plataforma. Use {"{nome}"} para inserir o primeiro nome do aluno.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasWhatsapp === false && (
          <p className="text-xs text-destructive font-sans">Este aluno não tem WhatsApp cadastrado.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button key={t.label} variant="outline" size="sm" onClick={() => setMessage(t.text)}>
              {t.label}
            </Button>
          ))}
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={`Mensagem para ${studentName || "o aluno"}…`}
        />
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={sending || hasWhatsapp === false}>
            <Send className="h-4 w-4 mr-1" />{sending ? "Enviando…" : "Enviar no WhatsApp"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
