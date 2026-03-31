import { useMemo } from "react";

interface MuscleVolume {
  muscleGroup: string;
  volume: number;
}

interface BodyMapProps {
  muscleVolumes: MuscleVolume[];
}

// Map muscle group names to SVG region IDs
const MUSCLE_MAP: Record<string, { regions: string[]; label: string }> = {
  "Peitoral": { regions: ["chest"], label: "Peitoral" },
  "Peito": { regions: ["chest"], label: "Peito" },
  "Costas": { regions: ["upper-back", "lower-back"], label: "Costas" },
  "Dorsal": { regions: ["upper-back"], label: "Dorsal" },
  "Trapézio": { regions: ["traps"], label: "Trapézio" },
  "Deltoides": { regions: ["shoulders"], label: "Deltoides" },
  "Ombro": { regions: ["shoulders"], label: "Ombro" },
  "Bíceps": { regions: ["biceps"], label: "Bíceps" },
  "Tríceps": { regions: ["triceps"], label: "Tríceps" },
  "Antebraço": { regions: ["forearms"], label: "Antebraço" },
  "Quadríceps": { regions: ["quads"], label: "Quadríceps" },
  "Posterior": { regions: ["hamstrings"], label: "Posterior" },
  "Glúteos": { regions: ["glutes"], label: "Glúteos" },
  "Panturrilha": { regions: ["calves"], label: "Panturrilha" },
  "Abdômen": { regions: ["abs"], label: "Abdômen" },
  "Core": { regions: ["abs"], label: "Core" },
};

function getHeatColor(intensity: number): string {
  // 0 = cold (muted), 1 = hot (primary/red)
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped === 0) return "hsl(220 10% 18%)";
  if (clamped < 0.25) return "hsl(220 60% 30%)";
  if (clamped < 0.5) return "hsl(220 70% 45%)";
  if (clamped < 0.75) return "hsl(30 80% 50%)";
  return "hsl(0 72% 51%)";
}

export function BodyMap({ muscleVolumes }: BodyMapProps) {
  const { regionColors, maxVolume } = useMemo(() => {
    const regionVolumes: Record<string, number> = {};
    let max = 0;

    muscleVolumes.forEach(({ muscleGroup, volume }) => {
      const mapping = Object.entries(MUSCLE_MAP).find(([key]) => 
        muscleGroup.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(muscleGroup.toLowerCase())
      );
      if (mapping) {
        mapping[1].regions.forEach(region => {
          regionVolumes[region] = (regionVolumes[region] || 0) + volume;
          if (regionVolumes[region] > max) max = regionVolumes[region];
        });
      }
    });

    const colors: Record<string, string> = {};
    Object.entries(regionVolumes).forEach(([region, vol]) => {
      colors[region] = getHeatColor(max > 0 ? vol / max : 0);
    });

    return { regionColors: colors, maxVolume: max };
  }, [muscleVolumes]);

  const getColor = (region: string) => regionColors[region] || "hsl(220 10% 18%)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-8 justify-center">
        {/* Front view */}
        <div className="relative">
          <p className="text-[10px] text-muted-foreground font-sans text-center mb-1">Frente</p>
          <svg viewBox="0 0 120 200" width="120" height="200">
            {/* Head */}
            <ellipse cx="60" cy="20" rx="12" ry="14" fill="hsl(220 10% 25%)" stroke="hsl(220 10% 30%)" strokeWidth="0.5" />
            {/* Neck */}
            <rect x="54" y="33" width="12" height="8" rx="2" fill="hsl(220 10% 25%)" />
            {/* Traps */}
            <path d="M42 41 L54 38 L66 38 L78 41 L72 48 L48 48 Z" fill={getColor("traps")} rx="2" />
            {/* Shoulders */}
            <ellipse cx="38" cy="50" rx="10" ry="7" fill={getColor("shoulders")} />
            <ellipse cx="82" cy="50" rx="10" ry="7" fill={getColor("shoulders")} />
            {/* Chest */}
            <path d="M44 48 L76 48 L74 70 L46 70 Z" fill={getColor("chest")} rx="3" />
            {/* Abs */}
            <path d="M48 70 L72 70 L70 105 L50 105 Z" fill={getColor("abs")} rx="2" />
            {/* Biceps */}
            <path d="M28 52 L38 48 L40 75 L30 75 Z" fill={getColor("biceps")} rx="2" />
            <path d="M92 52 L82 48 L80 75 L90 75 Z" fill={getColor("biceps")} rx="2" />
            {/* Forearms */}
            <path d="M28 76 L38 76 L36 105 L26 105 Z" fill={getColor("forearms")} rx="2" />
            <path d="M82 76 L92 76 L94 105 L84 105 Z" fill={getColor("forearms")} rx="2" />
            {/* Quads */}
            <path d="M48 106 L60 106 L58 155 L44 155 Z" fill={getColor("quads")} rx="2" />
            <path d="M60 106 L72 106 L76 155 L62 155 Z" fill={getColor("quads")} rx="2" />
            {/* Calves */}
            <path d="M44 158 L58 158 L56 195 L46 195 Z" fill={getColor("calves")} rx="2" />
            <path d="M62 158 L76 158 L74 195 L64 195 Z" fill={getColor("calves")} rx="2" />
          </svg>
        </div>

        {/* Back view */}
        <div className="relative">
          <p className="text-[10px] text-muted-foreground font-sans text-center mb-1">Costas</p>
          <svg viewBox="0 0 120 200" width="120" height="200">
            {/* Head */}
            <ellipse cx="60" cy="20" rx="12" ry="14" fill="hsl(220 10% 25%)" stroke="hsl(220 10% 30%)" strokeWidth="0.5" />
            {/* Neck */}
            <rect x="54" y="33" width="12" height="8" rx="2" fill="hsl(220 10% 25%)" />
            {/* Traps */}
            <path d="M42 41 L54 38 L66 38 L78 41 L72 48 L48 48 Z" fill={getColor("traps")} rx="2" />
            {/* Shoulders */}
            <ellipse cx="38" cy="50" rx="10" ry="7" fill={getColor("shoulders")} />
            <ellipse cx="82" cy="50" rx="10" ry="7" fill={getColor("shoulders")} />
            {/* Upper back */}
            <path d="M44 48 L76 48 L74 72 L46 72 Z" fill={getColor("upper-back")} rx="3" />
            {/* Lower back */}
            <path d="M48 72 L72 72 L70 95 L50 95 Z" fill={getColor("lower-back")} rx="2" />
            {/* Glutes */}
            <path d="M46 96 L74 96 L72 115 L48 115 Z" fill={getColor("glutes")} rx="3" />
            {/* Triceps */}
            <path d="M28 52 L38 48 L40 75 L30 75 Z" fill={getColor("triceps")} rx="2" />
            <path d="M92 52 L82 48 L80 75 L90 75 Z" fill={getColor("triceps")} rx="2" />
            {/* Forearms */}
            <path d="M28 76 L38 76 L36 105 L26 105 Z" fill={getColor("forearms")} rx="2" />
            <path d="M82 76 L92 76 L94 105 L84 105 Z" fill={getColor("forearms")} rx="2" />
            {/* Hamstrings */}
            <path d="M46 116 L60 116 L58 155 L42 155 Z" fill={getColor("hamstrings")} rx="2" />
            <path d="M60 116 L74 116 L78 155 L62 155 Z" fill={getColor("hamstrings")} rx="2" />
            {/* Calves */}
            <path d="M44 158 L58 158 L56 195 L46 195 Z" fill={getColor("calves")} rx="2" />
            <path d="M62 158 L76 158 L74 195 L64 195 Z" fill={getColor("calves")} rx="2" />
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-sans">
        <span>Menos</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <div key={i} className="w-5 h-3 rounded-sm" style={{ backgroundColor: getHeatColor(v) }} />
          ))}
        </div>
        <span>Mais</span>
      </div>

      {/* Volume list */}
      {muscleVolumes.filter(m => m.volume > 0).length > 0 && (
        <div className="w-full space-y-1">
          {muscleVolumes
            .filter(m => m.volume > 0)
            .sort((a, b) => b.volume - a.volume)
            .map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-sans">
                <span className="text-foreground">{m.muscleGroup}</span>
                <span className="text-muted-foreground">{m.volume.toLocaleString("pt-BR")}kg</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
