import { useMemo } from "react";
import { BodyMap } from "@/components/body/BodyMap";
import {
  muscleGroupToRegion,
  REGION_LABEL,
  type BodyRegionId,
} from "@/lib/bodyMap";
import { resolveHslVar } from "@/lib/cssColor";

interface MuscleVolume {
  muscleGroup: string;
  volume: number;
}

interface MuscleHeatmapProps {
  muscleVolumes: MuscleVolume[];
  gender?: "male" | "female";
}

// Paints the anatomical body with intensity proportional to training volume.
export function MuscleHeatmap({ muscleVolumes, gender = "male" }: MuscleHeatmapProps) {
  const { byRegion, maxVolume, ranked } = useMemo(() => {
    const agg: Partial<Record<BodyRegionId, number>> = {};
    muscleVolumes.forEach(({ muscleGroup, volume }) => {
      const region = muscleGroupToRegion(muscleGroup || "");
      if (!region) return;
      agg[region] = (agg[region] || 0) + (volume || 0);
    });
    const entries = (Object.entries(agg) as [BodyRegionId, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);
    return { byRegion: agg, maxVolume: max, ranked: entries };
  }, [muscleVolumes]);

  const hasData = ranked.length > 0;

  const getRegionFill = (region: BodyRegionId): string | undefined => {
    const v = byRegion[region];
    if (!v || maxVolume <= 0) return undefined;
    // Map volume to an alpha between 0.25 and 1 over the primary color.
    const alpha = 0.25 + 0.75 * (v / maxVolume);
    return resolveHslVar("--primary", Math.min(1, alpha));
  };

  if (!hasData) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center text-center">
        <p className="text-sm font-sans text-muted-foreground">
          Registre treinos para visualizar o mapa muscular de volume.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <BodyMap
        gender={gender}
        getRegionFill={getRegionFill}
        scale={0.95}
      />

      {/* Ranking list */}
      <div className="w-full space-y-1">
        {ranked.map(([region, volume]) => (
          <div key={region} className="flex items-center gap-2 text-xs font-sans">
            <span className="text-foreground min-w-[110px]">{REGION_LABEL[region]}</span>
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${maxVolume > 0 ? (volume / maxVolume) * 100 : 0}%` }}
              />
            </div>
            <span className="text-muted-foreground tabular-nums min-w-[70px] text-right">
              {Math.round(volume).toLocaleString("pt-BR")}kg
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
