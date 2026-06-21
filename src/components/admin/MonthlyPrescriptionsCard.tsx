import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

// Prescrições feitas no mês corrente, na ordem em que foram feitas (mais recente primeiro).
export function MonthlyPrescriptionsCard({ companyId }: { companyId: string | null | undefined }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      let q = (supabase as any)
        .from("prescription_bundles")
        .select("id, student_id, created_at, has_strength, has_cardio, has_nutrition, has_swimming, has_cycling")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false })
        .limit(80);
      if (companyId) q = q.eq("company_id", companyId);
      const { data } = await q;
      const bundles = data || [];
      const ids = [...new Set(bundles.map((b: any) => b.student_id).filter(Boolean))];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: studs } = await (supabase as any).from("students").select("id, full_name").in("id", ids);
        names = Object.fromEntries((studs || []).map((s: any) => [s.id, s.full_name]));
      }
      if (!alive) return;
      setRows(bundles.map((b: any) => ({ ...b, name: names[b.student_id] || "Aluno" })));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [companyId]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-primary text-lg">
          <ClipboardList className="h-5 w-5" /> Prescrições do mês
          <Badge variant="outline" className="ml-auto">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground font-sans">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground font-sans">Nenhuma prescrição feita este mês ainda.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {rows.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-sans font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground font-sans">
                    {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                    {new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end shrink-0">
                  {r.has_strength && <Badge variant="outline" className="text-[10px]">Força</Badge>}
                  {r.has_cardio && <Badge variant="outline" className="text-[10px]">Cardio</Badge>}
                  {r.has_swimming && <Badge variant="outline" className="text-[10px]">Natação</Badge>}
                  {r.has_cycling && <Badge variant="outline" className="text-[10px]">Ciclismo</Badge>}
                  {r.has_nutrition && <Badge variant="outline" className="text-[10px]">Nutrição</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
