import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { BrainCircuit, HelpCircle, Loader2, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type StudentBnitoMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type StudentBnitoResult = {
  answer?: string;
  topic?: string;
  urgency?: "normal" | "cautela" | "parar_e_avisar";
  student_action?: string;
  handoff_to_team?: boolean;
  follow_up_question?: string | null;
};

type StudentBnitoResponse = {
  result?: StudentBnitoResult | string;
  raw?: string;
  error?: string;
  details?: string;
};

type ProactiveMission = {
  title: string;
  body: string;
  actionPrompt: string;
  urgency?: StudentBnitoResult["urgency"];
};

const quickPrompts = [
  {
    label: "Treino de hoje",
    prompt: "Me explica o objetivo do meu treino de hoje e como devo encarar a sessao.",
  },
  {
    label: "Tecnica",
    prompt: "Tenho duvida de execucao em um exercicio. O que devo observar antes de aumentar a carga?",
  },
  {
    label: "Dor no treino",
    prompt: "Senti dor durante o treino. Como decido se paro, reduzo ou aviso a equipe?",
  },
  {
    label: "Recuperacao",
    prompt: "Estou cansado hoje. Como saber se treino normal ou faço mais leve?",
  },
];

const firstMessage: StudentBnitoMessage = {
  id: "student-bnito-welcome",
  role: "assistant",
  content:
    "Oi. Eu sou o Bnito. Me chama para entender seu treino, tirar duvidas de execucao, cuidar da recuperacao e saber quando vale avisar a equipe.",
};

const appMap = [
  "Home: resumo do dia, treino sugerido, meta semanal, progresso e atalhos.",
  "Treino: exercicios prescritos, series, repeticoes, descanso, video, carga, reps, RPE e conclusao.",
  "Calendario: organizacao dos treinos por dia e visao do ciclo.",
  "Historico: sessoes concluidas, cargas anteriores, consistencia e evolucao.",
  "Estatisticas: graficos de desempenho, sequencia, volume e progresso.",
  "Atividades externas: corrida, bike, natacao e outras atividades fora da musculacao.",
  "Medidas: registros corporais e evolucao visual/antropometrica.",
  "Avisos: comunicados da equipe e orientacoes importantes.",
  "Conquistas: XP, ranking e marcos de consistencia.",
];

function createMessage(role: StudentBnitoMessage["role"], content: string): StudentBnitoMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  };
}

function getStudentPageLabel(pathname: string) {
  if (pathname.includes("/treino/")) return "treino aberto";
  if (pathname.includes("/aluno")) return "area do aluno";
  return "BNapp";
}

function buildLocalMission(pageLabel: string): ProactiveMission {
  if (pageLabel === "treino aberto") {
    return {
      title: "Bnito no treino",
      body: "Antes de aumentar carga, confere tecnica, amplitude e descanso. Se algo doer acima de 3/10, reduz ou para e me chama.",
      actionPrompt: "Me guia no treino de hoje: objetivo, tecnica e pontos de atencao.",
      urgency: "normal",
    };
  }
  return {
    title: "Bnito acompanhando",
    body: "Vou cruzar treino, registros, ciclo, medidas, atividades e avisos para te dar o proximo passo mais seguro.",
    actionPrompt: "Olha meu app agora e me diz qual deveria ser meu foco hoje.",
    urgency: "normal",
  };
}

function toMission(data: StudentBnitoResponse, fallback: ProactiveMission): ProactiveMission {
  if (typeof data.result === "string") {
    return { ...fallback, body: data.result.slice(0, 220) };
  }
  const result = data.result;
  if (!result) return fallback;
  return {
    title: result.urgency === "parar_e_avisar" ? "Atencao do Bnito" : "Missao do Bnito",
    body: result.answer || fallback.body,
    actionPrompt: result.student_action || result.follow_up_question || fallback.actionPrompt,
    urgency: result.urgency || fallback.urgency,
  };
}

function formatStudentBnitoResponse(data: StudentBnitoResponse) {
  if (typeof data.result === "string") return data.result;
  const result = data.result;
  if (!result) return data.raw || "O Bnito respondeu, mas sem texto estruturado.";

  const parts = [
    result.answer || "Analise pronta.",
    result.student_action ? `Agora: ${result.student_action}` : "",
    result.handoff_to_team ? "Vale avisar a equipe para conferirem junto com voce." : "",
    result.follow_up_question ? `Pergunta: ${result.follow_up_question}` : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

function getUnavailableMessage(message: string) {
  if (/function|edge|404|403|fetch|non-2xx/i.test(message)) {
    return "Nao consegui conectar com o Bnito agora. A interface ja esta instalada, mas a funcao ai-student-bnito precisa estar publicada na Supabase para responder.";
  }
  return `Nao consegui responder agora: ${message}`;
}

export function StudentBnitoAssistantProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const location = useLocation();
  const params = useParams();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<StudentBnitoMessage[]>([firstMessage]);
  const [mission, setMission] = useState<ProactiveMission | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionDismissed, setMissionDismissed] = useState(false);

  const shouldShow = role === "student";
  const pageLabel = useMemo(() => getStudentPageLabel(location.pathname), [location.pathname]);
  const missionCacheKey = useMemo(
    () => `student-bnito-mission:${new Date().toISOString().slice(0, 10)}:${location.pathname}`,
    [location.pathname],
  );

  const askBnito = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);
    setMessages((current) => [...current, createMessage("user", trimmed)]);

    try {
      const history = messages
        .filter((message) => message.id !== firstMessage.id)
        .slice(-8)
        .map((message) => ({ role: message.role, content: message.content }));

      const { data, error } = await supabase.functions.invoke<StudentBnitoResponse>("ai-student-bnito", {
        body: {
          action: "ask",
          question: trimmed,
          history,
          page_context: {
            pathname: location.pathname,
            page_label: pageLabel,
            route_params: params,
            app_map: appMap,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error("resposta vazia");
      if (data.error) throw new Error(data.details || data.error);

      setMessages((current) => [...current, createMessage("assistant", formatStudentBnitoResponse(data))]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro inesperado";
      setMessages((current) => [...current, createMessage("assistant", getUnavailableMessage(message))]);
    } finally {
      setLoading(false);
    }
  }, [loading, location.pathname, messages, pageLabel, params]);

  useEffect(() => {
    if (!shouldShow) return;

    const fallback = buildLocalMission(pageLabel);
    setMissionDismissed(false);
    setMission(fallback);

    const cached = sessionStorage.getItem(missionCacheKey);
    if (cached) {
      try {
        setMission(JSON.parse(cached) as ProactiveMission);
        return;
      } catch {
        sessionStorage.removeItem(missionCacheKey);
      }
    }

    let active = true;
    setMissionLoading(true);
    supabase.functions.invoke<StudentBnitoResponse>("ai-student-bnito", {
      body: {
        action: "brief",
        question: "Gere uma missao proativa curta para o aluno agora, usando o contexto real do app.",
        history: [],
        page_context: {
          pathname: location.pathname,
          page_label: pageLabel,
          route_params: params,
          app_map: appMap,
        },
      },
    }).then(({ data, error }) => {
      if (!active || error || !data || data.error) return;
      const nextMission = toMission(data, fallback);
      setMission(nextMission);
      sessionStorage.setItem(missionCacheKey, JSON.stringify(nextMission));
    }).finally(() => {
      if (active) setMissionLoading(false);
    });

    return () => {
      active = false;
    };
  }, [location.pathname, missionCacheKey, pageLabel, params, shouldShow]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void askBnito(input);
  };

  return (
    <>
      {children}
      {shouldShow && (
        <Dialog open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Abrir Bnito"
                onClick={() => setOpen(true)}
                className="fixed bottom-24 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-navy text-primary-foreground shadow-[0_18px_45px_rgba(29,45,92,0.32)] ring-8 ring-navy/10 transition duration-200 hover:-translate-y-0.5 hover:bg-navy/95 focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2 md:bottom-6 md:right-6"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/45 bg-white/10">
                  <BrainCircuit className="h-7 w-7" />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Falar com o Bnito</TooltipContent>
          </Tooltip>

          {!open && mission && !missionDismissed && (
            <div className="fixed bottom-44 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-[22px] border border-line bg-background/95 p-3 text-sm shadow-xl backdrop-blur md:bottom-24 md:right-6">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-primary-foreground">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy">{mission.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{mission.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-navy px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      onClick={() => {
                        setOpen(true);
                        void askBnito(mission.actionPrompt);
                      }}
                    >
                      Me orientar
                    </button>
                    <button
                      type="button"
                      className="rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                      onClick={() => setMissionDismissed(true)}
                    >
                      Depois
                    </button>
                    {missionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-[30px] border-line bg-paper p-0 shadow-2xl [&>button]:rounded-full">
            <DialogHeader className="shrink-0 border-b border-line bg-background px-5 py-4 text-left">
              <div className="flex items-start gap-3 pr-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-primary-foreground shadow-md">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="font-display text-2xl text-navy">Bnito</DialogTitle>
                  <DialogDescription className="mt-1 text-sm">
                    seu parceiro tecnico de treino
                  </DialogDescription>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-paper text-navy">
                  Execucao
                </Badge>
                <Badge variant="outline" className="bg-paper text-navy">
                  Recuperacao
                </Badge>
                <Badge variant="outline" className="bg-paper text-navy">
                  Dor e sinais
                </Badge>
              </div>
            </DialogHeader>

            <div className="shrink-0 border-b border-line bg-paper-warm/45 px-5 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-navy">Contexto:</span> {pageLabel}. O Bnito usa seu treino salvo e seus registros para responder melhor.
            </div>

            <div className="shrink-0 space-y-3 px-5 py-4">
              {mission && (
                <div className="rounded-[18px] border border-navy/20 bg-navy/5 p-3 text-sm text-navy">
                  <span className="font-semibold">{mission.title}:</span> {mission.body}
                </div>
              )}
              <div className="rounded-[18px] border border-line bg-background p-3 text-sm">
                <span className="font-semibold text-navy">Bnito lembra:</span> tecnica boa vale mais que carga alta.
              </div>
              <div className="rounded-[18px] border border-primary/20 bg-primary/5 p-3 text-sm text-navy">
                <span className="font-semibold">Plano agora:</span> me conte a duvida, o exercicio e o que voce sentiu. Eu te ajudo a decidir o proximo passo com seguranca.
              </div>
            </div>

            <ScrollArea className="min-h-[120px] flex-1 px-5">
              <div className="space-y-3 pb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] whitespace-pre-wrap rounded-[20px] border px-4 py-3 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "border-navy bg-navy text-primary-foreground"
                          : "border-line bg-background text-foreground"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-[20px] border border-line bg-background px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Bnito lendo seu contexto...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t border-line bg-background px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {quickPrompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => void askBnito(item.prompt)}
                    disabled={loading}
                    className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-navy transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {item.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-[24px] border border-line bg-paper px-3 py-2">
                <HelpCircle className="mb-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Conta para o Bnito..."
                  className="min-h-[44px] flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
                />
                <Button type="submit" size="icon" disabled={loading || !input.trim()} className="mb-1 h-9 w-9 rounded-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="sr-only">Enviar pergunta</span>
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
