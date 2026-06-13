import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Trash2, Ruler, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { BodyAvatar, type Gender, type BodyMeasurementValues } from "./BodyAvatar";
import { ProgressPhotosPanel } from "@/components/ProgressPhotosPanel";

interface BodyMeasurementsProps {
  studentId: string;
  companyId: string;
  gender: Gender | null;
  onGenderChange: (gender: Gender) => void;
}

const FIELDS: { key: keyof BodyMeasurementValues; label: string }[] = [
  { key: "neck", label: "Pescoço" },
  { key: "shoulder", label: "Ombro" },
  { key: "chest", label: "Peito" },
  { key: "waist", label: "Cintura" },
  { key: "abdomen", label: "Abdômen" },
  { key: "hip", label: "Quadril" },
  { key: "arm", label: "Braço" },
  { key: "forearm", label: "Antebraço" },
  { key: "thigh", label: "Coxa" },
  { key: "calf", label: "Panturrilha" },
];

interface MeasurementRow extends BodyMeasurementValues {
  id: string;
  measured_at: string;
  notes: string | null;
}

const todayStr = () => new Date().toISOString().split("T")[0];

export function BodyMeasurements({ studentId, companyId, gender, onGenderChange }: BodyMeasurementsProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGender, setSavingGender] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [measuredAt, setMeasuredAt] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [metric, setMetric] = useState<keyof BodyMeasurementValues>("waist");

  const loadHistory = async () => {
    const { data } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("student_id", studentId)
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false });
    const rows = (data as MeasurementRow[]) || [];
    setHistory(rows);
    // Prefill form with the latest measurement for easy editing.
    if (rows[0]) {
      const next: Record<string, string> = {};
      FIELDS.forEach(({ key }) => {
        const v = rows[0][key];
        if (v != null) next[key] = String(v);
      });
      setForm(next);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const liveValues: BodyMeasurementValues = useMemo(() => {
    const v: BodyMeasurementValues = {};
    FIELDS.forEach(({ key }) => {
      const raw = form[key];
      const num = raw ? parseFloat(raw.replace(",", ".")) : NaN;
      v[key] = Number.isFinite(num) ? num : null;
    });
    return v;
  }, [form]);

  const handleSaveGender = async (g: Gender) => {
    setSavingGender(true);
    const { error } = await supabase.from("students").update({ gender: g }).eq("id", studentId);
    setSavingGender(false);
    if (error) {
      toast({ title: "Erro ao salvar gênero", description: error.message, variant: "destructive" });
      return;
    }
    onGenderChange(g);
  };

  const handleSave = async () => {
    const payload: Record<string, number | null> = {};
    let filled = 0;
    FIELDS.forEach(({ key }) => {
      const v = liveValues[key];
      payload[key] = v ?? null;
      if (v != null) filled++;
    });
    if (filled === 0) {
      toast({ title: "Preencha ao menos uma medida", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("body_measurements").insert({
      student_id: studentId,
      company_id: companyId,
      measured_at: measuredAt,
      notes: notes.trim() || null,
      ...payload,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar medidas", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Medidas registradas" });
    setNotes("");
    setMeasuredAt(todayStr());
    loadHistory();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("body_measurements").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setHistory((h) => h.filter((r) => r.id !== id));
  };

  const chartData = useMemo(() => {
    return history
      .filter((r) => r[metric] != null)
      .map((r) => ({
        date: format(parseISO(r.measured_at), "dd/MM", { locale: ptBR }),
        value: r[metric] as number,
      }))
      .reverse();
  }, [history, metric]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Gender must be chosen before showing the avatar / form.
  if (!gender) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4 text-center">
          <Ruler className="h-9 w-9 text-primary mx-auto" />
          <div>
            <h3 className="font-bold text-foreground font-sans">Escolha o gênero do avatar</h3>
            <p className="text-sm text-muted-foreground font-sans mt-1">
              Usamos como referência para ajustar o boneco de medidas.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => handleSaveGender("female")} disabled={savingGender} variant="outline">
              Feminino
            </Button>
            <Button onClick={() => handleSaveGender("male")} disabled={savingGender}>
              Masculino
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Avatar + gender switch */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider">
              Avatar de Medidas
            </h3>
            <div className="flex gap-1">
              {(["female", "male"] as Gender[]).map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={gender === g ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  disabled={savingGender}
                  onClick={() => gender !== g && handleSaveGender(g)}
                >
                  {g === "female" ? "Feminino" : "Masculino"}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <BodyAvatar gender={gender} measurements={liveValues} className="h-[360px] w-auto" />
          </div>
          <p className="text-center text-[11px] text-muted-foreground font-sans">
            O boneco se ajusta em largura conforme você digita as circunferências.
          </p>
        </CardContent>
      </Card>

      {/* Measurement form */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider">
            Registrar Circunferências (cm)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs font-sans">{label}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  placeholder="cm"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-sans">Data da medição</Label>
              <Input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-sans">Observações</Label>
            <Textarea
              rows={2}
              placeholder="Opcional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Medidas"}
          </Button>
        </CardContent>
      </Card>

      <ProgressPhotosPanel studentId={studentId} compact />

      {/* Evolution chart */}
      {history.length >= 2 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Evolução
              </h3>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as keyof BodyMeasurementValues)}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs font-sans"
              >
                {FIELDS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            {chartData.length >= 2 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v} cm`, "Medida"]}
                    />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-sans py-6 text-center">
                Sem dados suficientes para esta medida.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* History list */}
      {history.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-wider">
              Histórico
            </h3>
            <div className="space-y-2">
              {history.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-sans font-medium text-foreground">
                      {format(parseISO(r.measured_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {FIELDS.filter(({ key }) => r[key] != null).map(({ key, label }) => (
                      <span key={key} className="text-xs font-sans text-muted-foreground">
                        {label}: <span className="text-foreground tabular-nums">{r[key]}cm</span>
                      </span>
                    ))}
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground font-sans mt-1.5 italic">{r.notes}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
