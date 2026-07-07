// #3 Reavaliação — comparativo ANTES × DEPOIS das duas últimas avaliações funcionais.
// O "momento uau" da renovação: mostra a evolução das compensações entre avaliações.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Minus, GitCompareArrows } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

interface Snap { id: string; created_at: string; total: number; severas: number; moderadas: number; }

function countComp(json: any): { total: number; severas: number; moderadas: number } {
  const comps: any[] = Array.isArray(json?.ohs_compensations) ? json.ohs_compensations.filter((c: any) => c?.presente) : [];
  const fromVistas: any[] = Array.isArray(json?.vistas) ? json.vistas.flatMap((v: any) => v?.compensacoes || []) : [];
  const all = comps.length ? comps : fromVistas;
  const sev = (s: any) => String(s?.severidade || s?.severity || "").toLowerCase();
  return {
    total: json?.total_compensacoes ?? all.length,
    severas: all.filter((c) => sev(c).includes("sever")).length,
    moderadas: all.filter((c) => sev(c).includes("moder")).length,
  };
}

export function AssessmentCompareCard({ studentId }: { studentId: string }) {
  const [snaps, setSnaps] = useState<Snap[] | null>(null);

  useEffect(() => {
    let alive = true;
    (supabase as any).from("functional_assessments")
      .select("id, created_at, assessment_json")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }).limit(2)
      .then(({ data }: any) => {
        if (!alive) return;
        setSnaps((data || []).map((a: any) => ({ id: a.id, created_at: a.created_at, ...countComp(a.assessment_json) })));
      });
    return () => { alive = false; };
  }, [studentId]);

  if (!snaps || snaps.length < 2) return null;
  const [depois, antes] = snaps;
  const delta = depois.total - antes.total;
  const days = differenceInDays(parseISO(depois.created_at), parseISO(antes.created_at));
  const Icon = delta < 0 ? TrendingDown : delta > 0 ? TrendingUp : Minus;
  const tone = delta < 0 ? "text-green-600" : delta > 0 ? "text-red-500" : "text-muted-foreground";

  const col = (label: string, s: Snap) => (
    <div className="flex-1 rounded-lg border border-border bg-secondary/40 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">{format(parseISO(s.created_at), "dd/MM/yy")}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{s.total}</p>
      <p className="text-[10px] text-muted-foreground">compensações</p>
      <div className="flex justify-center gap-1 mt-1">
        {s.severas > 0 && <Badge className="bg-red-500/15 text-red-600 text-[9px]">{s.severas} severa(s)</Badge>}
        {s.moderadas > 0 && <Badge className="bg-amber-500/15 text-amber-600 text-[9px]">{s.moderadas} mod.</Badge>}
      </div>
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-primary text-base">
          <GitCompareArrows className="h-4 w-4" /> Evolução entre avaliações
          <span className={`ml-auto flex items-center gap-1 text-sm font-bold ${tone}`}>
            <Icon className="h-4 w-4" /> {delta > 0 ? `+${delta}` : delta}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-2">
          {col("Antes", antes)}
          <span className="self-center text-muted-foreground">→</span>
          {col("Depois", depois)}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {delta < 0
            ? `🎉 ${Math.abs(delta)} compensação(ões) a menos em ${days} dias — use no argumento de renovação.`
            : delta > 0
              ? `Atenção: ${delta} compensação(ões) a mais — revise o plano corretivo.`
              : `Estável em ${days} dias — vale revisar os corretivos para destravar evolução.`}
        </p>
      </CardContent>
    </Card>
  );
}
