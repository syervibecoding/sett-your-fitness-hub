// Banner "ativar lembretes" — Web Push do aluno (some depois de ativado/dispensado na sessão).
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { enablePush, isPushEnabled, pushSupported } from "@/lib/push";
import { useToast } from "@/hooks/use-toast";

export function PushBanner({ userId, companyId }: { userId: string; companyId: string | null }) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported() || Notification.permission === "denied") return;
    if (sessionStorage.getItem("push-banner-dismissed")) return;
    isPushEnabled().then((on) => setShow(!on));
  }, []);

  if (!show) return null;

  const activate = async () => {
    setBusy(true);
    const ok = await enablePush(userId, companyId);
    setBusy(false);
    if (ok) { setShow(false); toast({ title: "Lembretes ativados! 🔔", description: "Você recebe aviso do treino do dia e de prescrições novas." }); }
    else toast({ title: "Não consegui ativar", description: "Verifique a permissão de notificações do navegador.", variant: "destructive" });
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <p className="flex-1 text-xs text-foreground">Quer receber o lembrete do treino do dia?</p>
      <button type="button" disabled={busy} onClick={activate}
        className="rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50">
        {busy ? "Ativando…" : "Ativar"}
      </button>
      <button type="button" onClick={() => { sessionStorage.setItem("push-banner-dismissed", "1"); setShow(false); }}
        className="text-[11px] text-muted-foreground px-1">depois</button>
    </div>
  );
}
