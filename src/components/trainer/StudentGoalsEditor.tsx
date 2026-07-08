import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Target, Trophy, CalendarDays } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StudentGoal {
  id: string;
  title: string;
  type: string;
  target_date: string;
  notes: string | null;
  status: string;
}

interface Props {
  studentId: string;
}

const TYPE_LABEL: Record<string, string> = { prova: "Prova", meta: "Meta" };
const STATUS_LABEL: Record<string, string> = { pending: "Pendente", done: "Concluída" };

function fmt(value: string) {
  try {
    const d = parseISO(value);
    return isValid(d) ? format(d, "dd 'de' MMM yyyy", { locale: ptBR }) : "—";
  } catch {
    return "—";
  }
}

export function StudentGoalsEditor({ studentId }: Props) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudentGoal | null>(null);
  const [form, setForm] = useState<{ title: string; type: string; target_date: string; notes: string; status: string }>({
    title: "",
    type: "meta",
    target_date: "",
    notes: "",
    status: "pending",
  });

  useEffect(() => {
    if (studentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_goals")
      .select("id, title, type, target_date, notes, status")
      .eq("student_id", studentId)
      .order("target_date", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar metas", description: error.message, variant: "destructive" });
    } else {
      setGoals((data || []) as StudentGoal[]);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", type: "meta", target_date: "", notes: "", status: "pending" });
    setOpen(true);
  };

  const openEdit = (g: StudentGoal) => {
    setEditing(g);
    setForm({ title: g.title, type: g.type, target_date: g.target_date, notes: g.notes || "", status: g.status });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.target_date) {
      toast({ title: "Preencha título e data", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      type: form.type,
      target_date: form.target_date,
      notes: form.notes.trim() || null,
      status: form.status,
    };
    const { error } = editing
      ? await supabase.from("student_goals").update(payload).eq("id", editing.id)
      : await supabase.from("student_goals").insert({ ...payload, student_id: studentId, created_by: session?.user.id ?? null });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Meta atualizada" : "Meta adicionada" });
      setOpen(false);
      await load();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("student_goals").delete().eq("id", editing.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Meta removida" });
      setOpen(false);
      await load();
    }
    setSaving(false);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-primary text-lg">PROVAS E METAS</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nova data-alvo</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <p className="text-muted-foreground font-sans text-sm py-4">Nenhuma prova ou meta cadastrada. Elas aparecem no calendário do aluno.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => openEdit(g)}
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-sm">
                      {g.type === "prova" ? <Trophy className="h-4 w-4 text-primary" /> : <Target className="h-4 w-4 text-primary" />}
                      {g.title}
                    </span>
                    <Badge variant={g.status === "done" ? "secondary" : "outline"}>{STATUS_LABEL[g.status] || g.status}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-sans text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {TYPE_LABEL[g.type] || g.type} · {fmt(g.target_date)}
                    {g.notes ? ` — ${g.notes}` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">{editing ? "Editar data-alvo" : "Nova data-alvo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Campeonato regional, meta de peso…" maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="prova">Prova</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data-alvo</Label>
                <Input type="date" value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="done">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} maxLength={500} placeholder="Detalhes da prova ou da meta…" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button variant="ghost" className="text-destructive" onClick={handleDelete} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-1" /> Remover
              </Button>
            ) : <span />}
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
