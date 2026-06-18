import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Flag, Plus, Trash2, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Goal {
  id: string;
  target_date: string;
  title: string;
  kind: string | null;
  metric: string | null;
  description: string | null;
  status: string | null;
}

// Cadastro de PROVAS/METAS ALVO do aluno (data exibida nos calendários do aluno e do professor).
export function StudentGoalsManager({
  studentId,
  companyId,
  createdBy,
}: {
  studentId: string;
  companyId?: string | null;
  createdBy?: string | null;
}) {
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const empty = { title: "", kind: "prova", target_date: "", metric: "", description: "" };
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("student_goals").select("*").eq("student_id", studentId).order("target_date");
    setGoals(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [studentId]);

  const add = async () => {
    if (!form.title.trim() || !form.target_date) {
      toast({ title: "Preencha o título e a data", variant: "destructive" });
      return;
    }
    if (!companyId) { toast({ title: "Sem empresa em foco para salvar", variant: "destructive" }); return; }
    setAdding(true);
    const { error } = await (supabase as any).from("student_goals").insert({
      company_id: companyId,
      student_id: studentId,
      title: form.title.trim(),
      kind: form.kind,
      target_date: form.target_date,
      metric: form.metric.trim() || null,
      description: form.description.trim() || null,
      created_by: createdBy || null,
    });
    setAdding(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setForm(empty);
    toast({ title: "Prova/meta adicionada" });
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir esta prova/meta?")) return;
    const { error } = await (supabase as any).from("student_goals").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setGoals((cur) => cur.filter((g) => g.id !== id));
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-primary text-lg">
          <Flag className="h-5 w-5 text-amber-500" /> Provas e Metas
        </CardTitle>
        <p className="font-sans text-sm text-muted-foreground">
          Datas-alvo do aluno — aparecem no calendário dele e na sua agenda.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            placeholder="Título (ex.: Maratona de Floripa)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="sm:col-span-2"
          />
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prova">Prova</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
          <Input
            placeholder="Marca/alvo (opcional: sub-4h, 12% BF)"
            value={form.metric}
            onChange={(e) => setForm({ ...form, metric: e.target.value })}
            className="sm:col-span-2"
          />
          <Input
            placeholder="Observação (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="sm:col-span-2"
          />
          <Button onClick={add} disabled={adding} className="sm:col-span-2">
            {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar prova/meta
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : goals.length === 0 ? (
          <p className="text-center font-sans text-sm text-muted-foreground">Nenhuma prova/meta cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    <span className="mr-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                      {g.kind === "meta" ? "Meta" : "Prova"}
                    </span>
                    {g.title}
                  </p>
                  <p className="font-mono-data text-xs text-muted-foreground">
                    {format(parseISO(g.target_date), "dd/MM/yyyy")}{g.metric ? ` · ${g.metric}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => remove(g.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
