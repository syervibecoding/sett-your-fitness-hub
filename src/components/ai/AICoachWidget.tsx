import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAssistantName } from "@/hooks/useAssistantName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Minimal, dependency-free markdown rendering for assistant replies. */
function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    const isBullet = /^[-•*]\s+/.test(trimmed);
    const clean = isBullet ? trimmed.replace(/^[-•*]\s+/, "") : line;
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith("**") && seg.endsWith("**") ? (
        <strong key={j}>{seg.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{seg}</span>
      ),
    );
    if (isBullet) {
      return (
        <div key={i} className="flex gap-1.5">
          <span className="text-primary">•</span>
          <span>{parts}</span>
        </div>
      );
    }
    return (
      <p key={i} className={cn(line.trim() === "" && "h-2")}>
        {parts}
      </p>
    );
  });
}

interface AICoachWidgetProps {
  audience: "student" | "staff";
}

export function AICoachWidget({ audience }: AICoachWidgetProps) {
  const { name, enabled, studentEnabled, staffEnabled, loading } = useAssistantName();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const available =
    enabled && (audience === "student" ? studentEnabled : staffEnabled);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  if (loading || !available) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: { messages: next },
      });
      if (error) throw error;
      if (data?.error) {
        setMessages((m) => [...m, { role: "assistant", content: data.error }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch (_) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Não consegui responder agora. Tente novamente em instantes." },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Abrir ${name}`}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {open && (
        <Card className="fixed bottom-5 right-5 z-50 flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden shadow-2xl">
          <header className="flex items-center justify-between gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="text-sm font-semibold leading-tight">{name}</p>
                <p className="text-[11px] opacity-80 leading-tight">Assistente de treino</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-lg bg-muted p-3 text-muted-foreground">
                Olá! Sou o <strong className="text-foreground">{name}</strong>.{" "}
                {audience === "student"
                  ? "Posso ajudar com seu treino, progressão de carga e dúvidas de execução."
                  : "Posso ajudar com metodologia, periodização e distribuição de volume."}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="space-y-1">{renderContent(m.content)}</div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Escreva sua dúvida..."
              disabled={sending}
            />
            <Button size="icon" onClick={send} disabled={sending || !input.trim()} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
