// "Por quê deste treino" + semáforo de segurança (dor) — linguagem de aluno.
// Espelha a doutrina do motor (blocos 1-2/3-4/5-6; dor EVA>5 = parar e avisar) SEM tocar no motor.
import { useMemo, useState } from "react";
import { differenceInWeeks, parseISO } from "date-fns";
import { HelpCircle, ShieldAlert, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  objective?: string | null;
  startDate?: string | null;
  whatsappUrl?: string | null; // wa.me da empresa (sem texto)
  studentName?: string | null;
}

const OBJ_WHY: Record<string, string> = {
  emagrecimento: "manter o ritmo alto e o descanso controlado pra maximizar o gasto calórico preservando músculo",
  hipertrofia: "acumular volume com técnica pra estimular o crescimento muscular",
  performance: "construir força transferível pro seu esporte com cargas progressivas",
  saude: "fortalecer o corpo inteiro com progressão segura e sustentável",
};

function blockLabel(week: number): { fase: string; foco: string } {
  if (week <= 2) return { fase: "Semanas 1–2 · Base técnica", foco: "aprender o movimento e a amplitude — a carga vem depois" };
  if (week <= 4) return { fase: "Semanas 3–4 · Progressão", foco: "subir carga e intensidade com os métodos do plano" };
  return { fase: "Semanas 5–6 · Intensificação", foco: "consolidar a progressão mantendo a técnica" };
}

export function WhySafetyCard({ objective, startDate, whatsappUrl, studentName }: Props) {
  const [open, setOpen] = useState(false);

  const { fase, foco, why } = useMemo(() => {
    let week = 1;
    try { if (startDate) week = Math.max(1, differenceInWeeks(new Date(), parseISO(startDate)) + 1); } catch { /* fallback semana 1 */ }
    const b = blockLabel(week);
    const key = (objective || "").toLowerCase();
    const matched = Object.keys(OBJ_WHY).find((k) => key.includes(k));
    return { ...b, why: matched ? OBJ_WHY[matched] : "seguir a progressão que seu treinador planejou pra você" };
  }, [objective, startDate]);

  const painMsg = encodeURIComponent(
    `Oi! Sou ${studentName || "aluno(a)"} e senti dor durante o treino de hoje. Pode me orientar?`,
  );

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 space-y-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 text-left">
          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Por quê deste treino?</p>
            <p className="text-xs text-muted-foreground truncate">{fase}</p>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {open && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              O objetivo agora é <span className="text-foreground font-medium">{foco}</span>. Este ciclo foi montado pra{" "}
              {why}. Confie no processo: cada semana prepara a próxima.
            </p>

            {/* Semáforo de dor — espelha a linha vermelha do motor (EVA) */}
            <div className="rounded-lg border border-border bg-secondary/40 p-2 space-y-1">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Se sentir dor durante o treino
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-1">
                <li>🟢 <span className="font-medium">Leve (até 3/10):</span> reduza a carga e diminua a amplitude.</li>
                <li>🟡 <span className="font-medium">Média (4–5/10):</span> pare ESTE exercício e pule para o próximo.</li>
                <li>🔴 <span className="font-medium">Forte (acima de 5/10):</span> pare o treino e avise seu treinador.</li>
              </ul>
              {whatsappUrl && (
                <a
                  href={`${whatsappUrl}?text=${painMsg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary mt-1"
                >
                  <MessageCircle className="h-3 w-3" /> Avisar meu treinador agora
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
