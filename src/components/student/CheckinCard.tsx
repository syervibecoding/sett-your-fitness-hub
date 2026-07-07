// Check-in diário de prontidão (3 toques): sono, estresse e dor.
// Alimenta o readiness do motor de prescrição (professor vê e o motor corta volume em "cautela").
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, HeartPulse } from "lucide-react";

interface Props { studentId: string; companyId: string | null; }

const SLEEP = [["😴", 1], ["🥱", 2], ["🙂", 3], ["😌", 4], ["⚡", 5]] as const;
const STRESS = [["😌", 1], ["🙂", 2], ["😐", 3], ["😖", 4], ["🤯", 5]] as const;
const PAIN = [0, 2, 4, 6, 8] as const;

export function CheckinCard({ studentId, companyId }: Props) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [done, setDone] = useState<boolean | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (supabase as any).from("student_checkins").select("id").eq("student_id", studentId).eq("checkin_date", todayStr).maybeSingle()
      .then(({ data }: any) => { if (alive) setDone(!!data); });
    return () => { alive = false; };
  }, [studentId, todayStr]);

  const submit = async (pain: number) => {
    if (saving || sleep == null || stress == null) return;
    setSaving(true);
    const { error } = await (supabase as any).from("student_checkins").upsert({
      student_id: studentId, company_id: companyId, checkin_date: todayStr,
      sleep_quality: sleep, stress, pain,
    }, { onConflict: "student_id,checkin_date" });
    setSaving(false);
    if (!error) setDone(true);
  };

  if (done === null) return null;
  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Check-in de hoje feito — seu treino considera como você está. 💪
      </div>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 space-y-2.5">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <HeartPulse className="h-4 w-4 text-primary" /> Como você está hoje?
          <span className="text-[10px] text-muted-foreground font-normal ml-auto">3 toques · ajusta seu treino</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-14">Sono</span>
          {SLEEP.map(([e, v]) => (
            <button key={v} type="button" onClick={() => setSleep(v)}
              className={`h-9 w-9 rounded-full text-lg leading-none transition ${sleep === v ? "bg-primary/15 ring-2 ring-primary" : "bg-secondary/50"}`}>{e}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-14">Estresse</span>
          {STRESS.map(([e, v]) => (
            <button key={v} type="button" onClick={() => setStress(v)}
              className={`h-9 w-9 rounded-full text-lg leading-none transition ${stress === v ? "bg-primary/15 ring-2 ring-primary" : "bg-secondary/50"}`}>{e}</button>
          ))}
        </div>
        {sleep != null && stress != null && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-14">Dor (0-10)</span>
            {PAIN.map((v) => (
              <button key={v} type="button" disabled={saving} onClick={() => submit(v)}
                className={`h-9 w-9 rounded-full text-xs font-bold transition ${v >= 6 ? "bg-red-500/10 text-red-500" : v >= 4 ? "bg-amber-500/10 text-amber-600" : "bg-green-500/10 text-green-600"} hover:ring-2 hover:ring-primary disabled:opacity-50`}>{v}</button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
