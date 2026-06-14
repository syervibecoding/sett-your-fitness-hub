// Visualização anatômica das limitações da Avaliação Funcional: colore as regiões do boneco
// por tipo (muscular / articular / neural) usando o mapa do Codex (assessmentToBodyRegions).
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BodyMap } from "./BodyMap";
import { assessmentToBodyRegions } from "@/lib/assessmentBodyMap";
import { BODY_REGION_LABELS, type BodyRegionId, type LimitationType, type RegionLimitation } from "@/lib/bodyMap";

const TYPE_COLOR: Record<LimitationType, string> = {
  muscular: "#f59e0b",  // âmbar
  articular: "#3b82f6", // azul
  neural: "#a855f7",    // roxo
};
const TYPE_LABEL: Record<LimitationType, string> = {
  muscular: "Muscular", articular: "Articular", neural: "Neural",
};
const SEV_RANK: Record<string, number> = { severa: 3, moderada: 2, leve: 1 };

export function AssessmentBodyMap({ assessmentJson, gender = "male" }: { assessmentJson: unknown; gender?: "male" | "female" }) {
  const limits = useMemo<RegionLimitation[]>(() => {
    try { return assessmentToBodyRegions(assessmentJson) || []; } catch { return []; }
  }, [assessmentJson]);

  // 1 cor por região = limitação mais severa naquela região.
  const byRegion = useMemo(() => {
    const m = new Map<BodyRegionId, RegionLimitation>();
    for (const l of limits) {
      const cur = m.get(l.region);
      const better = !cur || (SEV_RANK[l.severity ?? ""] ?? 0) > (SEV_RANK[cur.severity ?? ""] ?? 0);
      if (better) m.set(l.region, l);
    }
    return m;
  }, [limits]);

  if (limits.length === 0) return null;

  const activeRegions = Array.from(byRegion.keys());
  const getRegionFill = (id: BodyRegionId) => {
    const l = byRegion.get(id);
    return l ? TYPE_COLOR[l.type] : undefined;
  };

  const usedTypes = Array.from(new Set(limits.map((l) => l.type)));

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <h3 className="text-sm font-mono-data font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Mapa de limitações
        </h3>
        <BodyMap
          gender={gender}
          getRegionFill={getRegionFill}
          activeRegions={activeRegions}
          footer={
            <div className="flex items-center justify-center gap-3 flex-wrap mt-1">
              {usedTypes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                  {TYPE_LABEL[t]}
                </span>
              ))}
            </div>
          }
        />
        <div className="mt-3 space-y-1.5">
          {Array.from(byRegion.entries()).map(([region, l]) => (
            <div key={region} className="flex items-start gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full mt-1 shrink-0" style={{ background: TYPE_COLOR[l.type] }} />
              <div className="min-w-0">
                <span className="font-medium text-foreground">{BODY_REGION_LABELS[region]}</span>
                <span className="text-muted-foreground"> · {TYPE_LABEL[l.type]}{l.severity ? ` (${l.severity})` : ""}</span>
                {l.note && <p className="text-[11px] text-muted-foreground">{l.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
