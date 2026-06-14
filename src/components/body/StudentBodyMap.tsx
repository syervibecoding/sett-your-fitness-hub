// Boneco do PERFIL do aluno — MULTI-SISTEMA (muscular / articular / órgãos), sempre visível.
// Cada sistema tem seu boneco no mesmo estilo (cinza + highlight), preenchível MANUALMENTE pelo
// professor (clica região → gravidade/nota → salva) e mostra o que veio da avaliação da IA.
// Cor por origem: AZUL = manual, VERMELHO = da avaliação.
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, X, Pencil } from "lucide-react";
import { BodyMap } from "./BodyMap";
import { SkeletonMapSvg, JOINT_LABELS } from "./SkeletonMapSvg";
import { OrganMapSvg, ORGAN_LABELS } from "./OrganMapSvg";
import { assessmentToBodyRegions } from "@/lib/assessmentBodyMap";
import { BODY_REGION_LABELS, normalizeGender } from "@/lib/bodyMap";
import { cn } from "@/lib/utils";

const SOURCE_COLOR = { manual: "#3b82f6", assessment: "#ef4444" } as const;
const SEVERITIES = ["leve", "moderada", "severa"] as const;

type SystemKey = "muscular" | "articular" | "organic";
interface SystemDef { key: SystemKey; label: string; type: string; labels: Record<string, string>; frontBack: boolean }
const SYSTEMS: SystemDef[] = [
  { key: "muscular", label: "Muscular", type: "muscular", labels: BODY_REGION_LABELS, frontBack: true },
  { key: "articular", label: "Articular", type: "articular", labels: JOINT_LABELS, frontBack: true },
  { key: "organic", label: "Órgãos", type: "organic", labels: ORGAN_LABELS, frontBack: false },
];

interface LimRow { region: string; type: string; severity?: string | null; note?: string | null; source: "manual" | "assessment" }

export function StudentBodyMap({ studentId }: { studentId: string }) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [manual, setManual] = useState<LimRow[]>([]);
  const [assess, setAssess] = useState<LimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState<SystemKey>("muscular");
  const [view, setView] = useState<"front" | "back">("front");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ severity: string; note: string }>({ severity: "", note: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: st } = await supabase.from("students").select("company_id, gender").eq("id", studentId).maybeSingle();
    setCompanyId((st as any)?.company_id ?? null);
    setGender(normalizeGender((st as any)?.gender) ?? "male");

    const { data: lims } = await (supabase as any)
      .from("student_body_limitations").select("region, type, severity, note").eq("student_id", studentId);
    setManual(((lims ?? []) as any[]).map((l) => ({ region: l.region, type: l.type, severity: l.severity, note: l.note, source: "manual" as const })));

    const { data: a } = await supabase
      .from("functional_assessments").select("assessment_json")
      .eq("student_id", studentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let regs: LimRow[] = [];
    try {
      regs = ((a as any)?.assessment_json ? assessmentToBodyRegions((a as any).assessment_json) : [])
        .map((r) => ({ region: r.region, type: r.type, severity: r.severity, note: r.note, source: "assessment" as const }));
    } catch { regs = []; }
    setAssess(regs);
    setLoading(false);
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  const sysDef = SYSTEMS.find((s) => s.key === system)!;

  // Limitações do sistema ativo (manual prioritário; só regiões válidas daquele sistema).
  const byRegion = new Map<string, LimRow>();
  for (const r of assess) if (r.type === sysDef.type && r.region in sysDef.labels && !byRegion.has(r.region)) byRegion.set(r.region, r);
  for (const r of manual) if (r.type === sysDef.type && r.region in sysDef.labels) byRegion.set(r.region, r);
  const items = Array.from(byRegion.values());

  const getFill = (id: string) => {
    if (id === editing) return SOURCE_COLOR.manual;
    const m = byRegion.get(id);
    return m ? SOURCE_COLOR[m.source] : undefined;
  };
  const activeRegions = [...byRegion.keys(), ...(editing && !byRegion.has(editing) ? [editing] : [])];

  const switchSystem = (k: SystemKey) => { setSystem(k); setEditing(null); setView("front"); };
  const openEditor = (id: string) => {
    const cur = byRegion.get(id);
    setDraft({ severity: cur?.severity ?? "", note: cur?.note ?? "" });
    setEditing(id);
  };
  const saveDraft = async () => {
    if (!editing || !companyId) return;
    setSaving(true);
    await (supabase as any).from("student_body_limitations").upsert({
      student_id: studentId, company_id: companyId, region: editing,
      type: sysDef.type, severity: draft.severity || null, note: draft.note.trim() || null,
      source: "manual", updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,region" });
    setSaving(false); setEditing(null); await load();
  };
  const removeRegion = async (id: string) => {
    setSaving(true);
    await (supabase as any).from("student_body_limitations").delete().eq("student_id", studentId).eq("region", id);
    setSaving(false); setEditing(null); await load();
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const editingIsManual = editing ? manual.some((m) => m.region === editing && m.type === sysDef.type) : false;

  const legend = (
    <div className="flex items-center justify-center gap-3 flex-wrap mt-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLOR.manual }} /> Marcado por você</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLOR.assessment }} /> Da avaliação</span>
    </div>
  );

  const viewToggle = (
    <div className="inline-flex items-center gap-1 rounded-lg bg-secondary/40 p-1">
      {(["front", "back"] as const).map((v) => (
        <button key={v} type="button" onClick={() => setView(v)}
          className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors",
            view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {v === "front" ? "Frente" : "Costas"}
        </button>
      ))}
    </div>
  );

  let boneco: ReactNode;
  if (system === "muscular") {
    // BodyMap (react-muscle-highlighter) já traz o toggle frente/costas interno.
    boneco = (
      <BodyMap gender={gender} getRegionFill={getFill as any} activeRegions={activeRegions as any} onRegionClick={openEditor as any} footer={legend} />
    );
  } else if (system === "articular") {
    boneco = (
      <div className="flex flex-col items-center gap-2">
        {viewToggle}
        <div className="flex justify-center [&_svg]:h-[340px] [&_svg]:w-auto">
          <SkeletonMapSvg view={view} getRegionFill={getFill as any} activeRegions={activeRegions as any} onRegionClick={openEditor as any} />
        </div>
        {legend}
      </div>
    );
  } else {
    boneco = (
      <div className="flex flex-col items-center gap-2">
        <div className="flex justify-center [&_svg]:h-[340px] [&_svg]:w-auto">
          <OrganMapSvg getRegionFill={getFill as any} activeRegions={activeRegions as any} onRegionClick={openEditor as any} />
        </div>
        {legend}
      </div>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-mono-data font-semibold text-muted-foreground uppercase tracking-wider">Mapa de limitações</h3>
          <span className="text-[11px] text-muted-foreground">Clique numa região para marcar</span>
        </div>

        {/* Seletor de sistema */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-secondary/40 p-1 mb-3">
          {SYSTEMS.map((s) => (
            <button key={s.key} type="button" onClick={() => switchSystem(s.key)}
              className={cn("px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                system === s.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {s.label}
            </button>
          ))}
        </div>

        {boneco}

        {/* Editor inline */}
        {editing && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{sysDef.labels[editing] ?? editing}</p>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Gravidade</p>
              <div className="flex gap-1.5">
                {SEVERITIES.map((s) => (
                  <button key={s} type="button" onClick={() => setDraft((d) => ({ ...d, severity: d.severity === s ? "" : s }))}
                    className={cn("px-2.5 py-1 rounded-md text-xs border capitalize transition-colors",
                      draft.severity === s ? "bg-primary text-primary-foreground border-transparent" : "text-muted-foreground border-border hover:bg-muted/50")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <Textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder="Observação (opcional): ex. dor anterior do joelho ao agachar." className="min-h-[60px]" />
            <div className="flex items-center justify-between">
              {editingIsManual ? (
                <Button variant="ghost" size="sm" className="text-destructive" disabled={saving} onClick={() => removeRegion(editing)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                </Button>
              ) : <span />}
              <Button size="sm" disabled={saving} onClick={saveDraft}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        )}

        {/* Lista do sistema ativo */}
        {items.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {items.map((l) => (
              <button key={l.region} onClick={() => openEditor(l.region)} className="w-full flex items-start gap-2 text-xs text-left hover:bg-muted/40 rounded px-1.5 py-1">
                <span className="h-2.5 w-2.5 rounded-full mt-1 shrink-0" style={{ background: SOURCE_COLOR[l.source] }} />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{sysDef.labels[l.region] ?? l.region}</span>
                  {l.severity ? <span className="text-muted-foreground"> · {l.severity}</span> : null}
                  <span className={cn("ml-1.5 text-[9px] uppercase tracking-wide rounded px-1",
                    l.source === "manual" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    {l.source === "manual" ? "manual" : "avaliação"}
                  </span>
                  {l.note && <p className="text-[11px] text-muted-foreground">{l.note}</p>}
                </div>
                <Pencil className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Informação ainda não inserida — gere uma avaliação ou clique numa região para marcar manualmente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
