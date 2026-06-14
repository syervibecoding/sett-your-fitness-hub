// Boneco anatômico muscular (frente/costas) — agora usando react-muscle-highlighter
// (corpo branco + músculos cinza, highlight por região), como na referência do produto.
// A API pública (getRegionFill/activeRegions/onRegionClick) é a mesma de antes — os callers
// (WorkoutBuilder, AssessmentBodyMap, perfil do aluno) não mudam; só o desenho interno trocou.
import { useState, type ReactNode } from "react";
import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";
import type { BodyRegionId } from "@/lib/bodyMap";
import { BODY_REGION_IDS, REGION_TO_SLUG, regionForSlug } from "@/lib/bodyMap";
import { cn } from "@/lib/utils";

const ACTIVE_GREEN = "#7fb886";   // verde do highlight (igual à referência)
const MUSCLE_GRAY = "#c9d0ce";    // músculos não selecionados
const BODY_OUTLINE = "#aeb6b4";

interface BodyMapProps {
  getRegionFill?: (id: BodyRegionId) => string | undefined;
  activeRegions?: BodyRegionId[];
  onRegionClick?: (id: BodyRegionId) => void;
  initialView?: "front" | "back";
  gender?: "male" | "female";
  footer?: ReactNode;
  /** Controla o tamanho (altura do svg). Default cabe num card/dialog. */
  svgClassName?: string;
  className?: string;
}

export function BodyMap({
  getRegionFill, activeRegions, onRegionClick, initialView = "front",
  gender = "male", footer, svgClassName = "h-[340px] w-auto", className,
}: BodyMapProps) {
  const [view, setView] = useState<"front" | "back">(initialView);
  const activeSet = new Set(activeRegions ?? []);

  // Cor por região: getRegionFill tem prioridade; senão, verde se estiver "ativa".
  const data: ExtendedBodyPart[] = [];
  for (const region of BODY_REGION_IDS) {
    const color = getRegionFill?.(region) ?? (activeSet.has(region) ? ACTIVE_GREEN : undefined);
    if (color) data.push({ slug: REGION_TO_SLUG[region] as Slug, color });
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="inline-flex items-center gap-1 rounded-lg bg-secondary/40 p-1">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "front" ? "Frente" : "Costas"}
          </button>
        ))}
      </div>

      <div className={cn("flex justify-center [&_svg]:h-full [&_svg]:w-auto", svgClassName)}>
        <Body
          side={view}
          gender={gender}
          data={data}
          defaultFill={MUSCLE_GRAY}
          border={BODY_OUTLINE}
          onBodyPartPress={onRegionClick ? (part) => {
            const region = regionForSlug(part.slug);
            if (region) onRegionClick(region);
          } : undefined}
        />
      </div>

      {footer}
    </div>
  );
}
