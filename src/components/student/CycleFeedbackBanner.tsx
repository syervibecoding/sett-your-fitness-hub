import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, X } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";

interface Props {
  studentId: string;
  companyId: string;
  enrollmentId: string | null;
  enrollmentEndDate: string | null;
  whatsappUrl?: string | null;
}

// Fallback BN — usado só quando a empresa do aluno não tem WhatsApp configurado (white-label).
const WHATSAPP_FEEDBACK_FALLBACK = "https://wa.me/message/GZWXMSEEKWGII1";
const DISMISS_KEY = (id: string) => `cycle_feedback_dismissed_${id}`;

export function CycleFeedbackBanner({ enrollmentId, enrollmentEndDate, whatsappUrl }: Props) {
  const feedbackUrl = whatsappUrl || WHATSAPP_FEEDBACK_FALLBACK;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enrollmentId) return;
    setDismissed(localStorage.getItem(DISMISS_KEY(enrollmentId)) === "1");
  }, [enrollmentId]);

  if (!enrollmentId || !enrollmentEndDate || dismissed) return null;

  const daysLeft = differenceInCalendarDays(parseISO(enrollmentEndDate), new Date());
  if (daysLeft < 0 || daysLeft > 7) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY(enrollmentId), "1");
    setDismissed(true);
  };

  return (
    <Card className="bg-primary/5 border-primary/30">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-sans font-medium text-foreground">
            Seu ciclo termina em {daysLeft === 0 ? "hoje" : `${daysLeft} dia${daysLeft > 1 ? "s" : ""}`}
          </p>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">
            Conte para o seu treinador como foi essa jornada — ajuda na próxima prescrição.
          </p>
          <Button
            size="sm"
            onClick={() => window.open(feedbackUrl, "_blank")}
            className="mt-3 h-8"
          >
            Falar com o treinador no WhatsApp
          </Button>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1">
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
