import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { BodyMap } from "@/components/body/BodyMap";
import { REGION_LABEL, type BodyRegionId } from "@/lib/bodyMap";
import { resolveHslVar } from "@/lib/cssColor";
import {
  type Limitation,
  type LimitationType,
  type Severity,
  LIMITATION_TYPES,
  SEVERITIES,
  TYPE_LABEL,
  SEVERITY_LABEL,
  SEVERITY_BADGE,
  buildLimitationsByRegion,
  buildLimitationPayload,
  getRegionFill as resolveRegionFill,
} from "@/lib/bodyLimitations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface BodyLimitationsEditorProps {
  studentId: string;
  gender?: "male" | "female";
}

export function BodyLimitationsEditor({ studentId, gender = "male" }: BodyLimitationsEditorProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [limitations, setLimitations] = useState<Limitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRegion, setEditRegion] = useState<BodyRegionId | null>(null);
  const [form, setForm] = useState<{ type: LimitationType; severity: Severity; note: string }>({
    type: "muscular",
    severity: "leve",
    note: "",
  });

  useEffect(() => {
    if (studentId) loadLimitations(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const loadLimitations = async (sid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_body_limitations")
      .select("id, region, type, severity, note")
      .eq("student_id", sid);
    if (error) {
      toast({ title: "Erro ao carregar limitações", description: error.message, variant: "destructive" });
    } else {
      setLimitations((data || []) as Limitation[]);
    }
    setLoading(false);
  };

  const byRegion = useMemo(() => buildLimitationsByRegion(limitations), [limitations]);

  const getRegionFill = (region: BodyRegionId): string | undefined =>
    resolveRegionFill(byRegion, region, resolveHslVar);

  const openEdit = (region: BodyRegionId) => {
    const existing = byRegion.get(region);
    setEditRegion(region);
    setForm({
      type: existing?.type ?? "muscular",
      severity: existing?.severity ?? "leve",
      note: existing?.note ?? "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editRegion) return;
    setSaving(true);
    const existing = byRegion.get(editRegion);
    const payload = buildLimitationPayload({
      studentId,
      region: editRegion,
      type: form.type,
      severity: form.severity,
      note: form.note,
      createdBy: session?.user.id ?? null,
    });


    const { error } = existing
      ? await supabase
          .from("student_body_limitations")
          .update({ type: payload.type, severity: payload.severity, note: payload.note })
          .eq("id", existing.id)
      : await supabase.from("student_body_limitations").insert(payload);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Limitação salva", description: REGION_LABEL[editRegion] });
      setEditOpen(false);
      await loadLimitations(studentId);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editRegion) return;
    const existing = byRegion.get(editRegion);
    if (!existing) {
      setEditOpen(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("student_body_limitations")
      .delete()
      .eq("id", existing.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Limitação removida", description: REGION_LABEL[editRegion] });
      setEditOpen(false);
      await loadLimitations(studentId);
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Limitações corporais</CardTitle>
        <p className="text-xs text-muted-foreground font-sans">
          Toque em uma região do corpo para registrar uma limitação muscular, articular ou neural.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <BodyMap
              gender={gender}
              getRegionFill={getRegionFill}
              onRegionClick={openEdit}
              scale={1}
            />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: resolveHslVar("--warning", 0.4) }} />
                  Leve
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: resolveHslVar("--warning", 0.7) }} />
                  Moderada
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: resolveHslVar("--destructive", 1) }} />
                  Severa
                </span>
              </div>

              {limitations.length === 0 ? (
                <p className="text-sm text-muted-foreground font-sans py-6 text-center">
                  Nenhuma limitação registrada.
                </p>
              ) : (
                <ul className="space-y-2">
                  {limitations.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => openEdit(l.region)}
                        className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">{REGION_LABEL[l.region]}</span>
                          <Badge variant="outline" className={SEVERITY_BADGE[l.severity]}>
                            {SEVERITY_LABEL[l.severity]}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs font-sans text-muted-foreground">
                          {TYPE_LABEL[l.type]}
                          {l.note ? ` — ${l.note}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editRegion ? REGION_LABEL[editRegion] : "Limitação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as LimitationType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIMITATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v as Severity }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Ex.: evitar agachamento profundo, dor ao rotacionar o ombro…"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editRegion && byRegion.get(editRegion) ? (
              <Button variant="ghost" className="text-destructive" onClick={handleDelete} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-1" /> Remover
              </Button>
            ) : <span />}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
