// Wrapper do boneco: toggle frente/costas + legenda/rodapé. Usado tanto para SELEÇÃO
// (WorkoutBuilder: clicar região filtra exercícios) quanto para VISUALIZAÇÃO (Avaliação:
// regiões coloridas por tipo de limitação). Independe da arte interna do BodyMapSvg.
import { useState, type ReactNode } from "react";
import { BodyMapSvg } from "./BodyMapSvg";
import type { BodyRegionId } from "@/lib/bodyMap";
import { cn } from "@/lib/utils";

interface BodyMapProps {
  getRegionFill?: (id: BodyRegionId) => string | undefined;
  activeRegions?: BodyRegionId[];
  onRegionClick?: (id: BodyRegionId) => void;
  initialView?: "front" | "back";
  footer?: ReactNode;
  svgClassName?: string;
  className?: string;
}

export function BodyMap({
  getRegionFill, activeRegions, onRegionClick, initialView = "front", footer, svgClassName, className,
}: BodyMapProps) {
  const [view, setView] = useState<"front" | "back">(initialView);

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
      <BodyMapSvg
        view={view}
        onRegionClick={onRegionClick}
        getRegionFill={getRegionFill}
        activeRegions={activeRegions}
        className={cn("h-[300px] w-auto", svgClassName)}
      />
      {footer}
    </div>
  );
}
