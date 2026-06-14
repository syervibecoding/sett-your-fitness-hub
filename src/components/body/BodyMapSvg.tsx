// Boneco anatômico com regiões musculares clicáveis (frente/costas).
// API estável (combinada com o GPT): quando o SVG caprichado do GPT chegar, basta
// substituir ESTE arquivo mantendo a mesma assinatura — nada mais muda.
import type { BodyRegionId } from "@/lib/bodyMap";
import { BODY_REGION_LABELS } from "@/lib/bodyMap";

export interface BodyMapSvgProps {
  view: "front" | "back";
  onRegionClick?: (id: BodyRegionId) => void;
  getRegionFill?: (id: BodyRegionId) => string | undefined;
  activeRegions?: BodyRegionId[];
  className?: string;
}

interface Blob { cx: number; cy: number; rx: number; ry: number }

const FRONT: Partial<Record<BodyRegionId, Blob[]>> = {
  shoulders: [{ cx: 68, cy: 92, rx: 12, ry: 11 }, { cx: 132, cy: 92, rx: 12, ry: 11 }],
  chest: [{ cx: 88, cy: 104, rx: 13, ry: 12 }, { cx: 112, cy: 104, rx: 13, ry: 12 }],
  biceps: [{ cx: 60, cy: 124, rx: 9, ry: 18 }, { cx: 140, cy: 124, rx: 9, ry: 18 }],
  forearm: [{ cx: 52, cy: 162, rx: 8, ry: 18 }, { cx: 148, cy: 162, rx: 8, ry: 18 }],
  abs: [{ cx: 100, cy: 134, rx: 15, ry: 22 }],
  adductors: [{ cx: 92, cy: 196, rx: 7, ry: 17 }, { cx: 108, cy: 196, rx: 7, ry: 17 }],
  quads: [{ cx: 85, cy: 210, rx: 12, ry: 30 }, { cx: 115, cy: 210, rx: 12, ry: 30 }],
  calves: [{ cx: 86, cy: 282, rx: 10, ry: 26 }, { cx: 114, cy: 282, rx: 10, ry: 26 }],
};

const BACK: Partial<Record<BodyRegionId, Blob[]>> = {
  trapezius: [{ cx: 100, cy: 86, rx: 21, ry: 12 }],
  shoulders: [{ cx: 68, cy: 92, rx: 12, ry: 11 }, { cx: 132, cy: 92, rx: 12, ry: 11 }],
  back: [{ cx: 88, cy: 116, rx: 13, ry: 18 }, { cx: 112, cy: 116, rx: 13, ry: 18 }],
  triceps: [{ cx: 60, cy: 124, rx: 9, ry: 18 }, { cx: 140, cy: 124, rx: 9, ry: 18 }],
  forearm: [{ cx: 52, cy: 162, rx: 8, ry: 18 }, { cx: 148, cy: 162, rx: 8, ry: 18 }],
  lower_back: [{ cx: 100, cy: 150, rx: 14, ry: 12 }],
  glutes: [{ cx: 88, cy: 178, rx: 13, ry: 14 }, { cx: 112, cy: 178, rx: 13, ry: 14 }],
  hamstrings: [{ cx: 85, cy: 220, rx: 12, ry: 28 }, { cx: 115, cy: 220, rx: 12, ry: 28 }],
  calves: [{ cx: 86, cy: 286, rx: 10, ry: 26 }, { cx: 114, cy: 286, rx: 10, ry: 26 }],
};

const DEFAULT_FILL = "hsl(var(--muted-foreground) / 0.18)";

export function BodyMapSvg({ view, onRegionClick, getRegionFill, activeRegions, className }: BodyMapSvgProps) {
  const regions = view === "front" ? FRONT : BACK;
  const active = new Set(activeRegions ?? []);
  const silhouette = "hsl(var(--muted-foreground) / 0.10)";

  return (
    <svg viewBox="0 0 200 330" className={className} role="group" aria-label={`Boneco anatômico — ${view === "front" ? "frente" : "costas"}`}>
      {/* Silhueta neutra de fundo (sem rosto) */}
      <g fill={silhouette} stroke="none">
        <circle cx={100} cy={40} r={17} />
        <rect x={92} y={55} width={16} height={12} rx={5} />
        <rect x={74} y={66} width={52} height={70} rx={20} />
        <rect x={46} y={70} width={16} height={104} rx={8} />
        <rect x={138} y={70} width={16} height={104} rx={8} />
        <rect x={78} y={132} width={44} height={56} rx={16} />
        <rect x={74} y={180} width={22} height={130} rx={11} />
        <rect x={104} y={180} width={22} height={130} rx={11} />
      </g>

      {/* Regiões clicáveis */}
      {(Object.keys(regions) as BodyRegionId[]).map((id) => {
        const blobs = regions[id]!;
        const fill = getRegionFill?.(id) ?? DEFAULT_FILL;
        const isActive = active.has(id);
        return (
          <g
            key={id}
            data-region={id}
            role={onRegionClick ? "button" : undefined}
            tabIndex={onRegionClick ? 0 : undefined}
            onClick={onRegionClick ? () => onRegionClick(id) : undefined}
            onKeyDown={onRegionClick ? (e) => { if (e.key === "Enter" || e.key === " ") onRegionClick(id); } : undefined}
            style={{ cursor: onRegionClick ? "pointer" : "default", transition: "opacity .15s" }}
            className={onRegionClick ? "hover:opacity-80" : undefined}
          >
            <title>{BODY_REGION_LABELS[id]}</title>
            {blobs.map((b, i) => (
              <ellipse
                key={i}
                cx={b.cx}
                cy={b.cy}
                rx={b.rx}
                ry={b.ry}
                fill={fill}
                stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--card))"}
                strokeWidth={isActive ? 2.5 : 1}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
