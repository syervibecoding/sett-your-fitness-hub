import { useMemo, useState } from "react";
import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";
import { Button } from "@/components/ui/button";
import {
  BODY_REGION_IDS,
  REGION_TO_SLUG,
  regionForSlug,
  type BodyRegionId,
} from "@/lib/bodyMap";
import { resolveHslVar } from "@/lib/cssColor";

interface BodyMapProps {
  // Returns a concrete color for a region, or undefined to leave it neutral.
  getRegionFill?: (region: BodyRegionId) => string | undefined;
  // Regions painted with the primary color when no getRegionFill is given.
  activeRegions?: BodyRegionId[];
  onRegionClick?: (region: BodyRegionId) => void;
  initialView?: "front" | "back";
  gender?: "male" | "female";
  scale?: number;
  className?: string;
  footer?: React.ReactNode;
}

// Generic, themeable wrapper around react-muscle-highlighter.
export function BodyMap({
  getRegionFill,
  activeRegions,
  onRegionClick,
  initialView = "front",
  gender = "male",
  scale = 1,
  className,
  footer,
}: BodyMapProps) {
  const [view, setView] = useState<"front" | "back">(initialView);

  const { primary, neutralFill, neutralStroke } = useMemo(
    () => ({
      primary: resolveHslVar("--primary"),
      neutralFill: resolveHslVar("--muted"),
      neutralStroke: resolveHslVar("--border"),
    }),
    [view],
  );

  const activeSet = useMemo(() => new Set(activeRegions ?? []), [activeRegions]);

  const data: ExtendedBodyPart[] = useMemo(() => {
    const parts: ExtendedBodyPart[] = [];
    for (const region of BODY_REGION_IDS) {
      const color = getRegionFill
        ? getRegionFill(region)
        : activeSet.has(region)
          ? primary
          : undefined;
      if (color) parts.push({ slug: REGION_TO_SLUG[region] as Slug, color });
    }
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getRegionFill, activeSet, primary, view]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="inline-flex rounded-lg border border-border p-0.5">
        {(["front", "back"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setView(v)}
          >
            {v === "front" ? "Frente" : "Costas"}
          </Button>
        ))}
      </div>

      <div className={className}>
        <Body
          data={data}
          side={view}
          gender={gender}
          scale={scale}
          defaultFill={neutralFill}
          defaultStroke={neutralStroke}
          onBodyPartPress={(part) => {
            const region = regionForSlug(part.slug);
            if (region && onRegionClick) onRegionClick(region);
          }}
        />
      </div>

      {footer}
    </div>
  );
}
