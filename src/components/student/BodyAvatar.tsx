import { useMemo } from "react";

export type Gender = "male" | "female";

export interface BodyMeasurementValues {
  neck?: number | null;
  shoulder?: number | null;
  chest?: number | null;
  waist?: number | null;
  abdomen?: number | null;
  hip?: number | null;
  arm?: number | null;
  forearm?: number | null;
  thigh?: number | null;
  calf?: number | null;
}

interface BodyAvatarProps {
  gender: Gender;
  measurements: BodyMeasurementValues;
  className?: string;
}

// Reference circumferences (cm) used as the "neutral" baseline for each gender.
const REFERENCE: Record<Gender, Record<keyof BodyMeasurementValues, number>> = {
  male: { neck: 38, shoulder: 118, chest: 102, waist: 84, abdomen: 88, hip: 99, arm: 35, forearm: 28, thigh: 56, calf: 38 },
  female: { neck: 32, shoulder: 104, chest: 90, waist: 70, abdomen: 76, hip: 100, arm: 29, forearm: 24, thigh: 55, calf: 36 },
};

// Base half-widths / widths (px) per gender, tuned for the silhouette.
const BASE: Record<Gender, Record<keyof BodyMeasurementValues | "headR", number>> = {
  male: { neck: 11, shoulder: 48, chest: 41, waist: 31, abdomen: 33, hip: 38, arm: 17, forearm: 13, thigh: 30, calf: 18, headR: 24 },
  female: { neck: 9, shoulder: 40, chest: 35, waist: 26, abdomen: 28, hip: 42, arm: 14, forearm: 11, thigh: 30, calf: 17, headR: 22 },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Smooth an open polyline into a cubic-bezier path (Catmull-Rom).
function smooth(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function BodyAvatar({ gender, measurements, className }: BodyAvatarProps) {
  const cx = 120;
  const base = BASE[gender];
  const ref = REFERENCE[gender];

  const half = useMemo(() => {
    const factor = (key: keyof BodyMeasurementValues) => {
      const v = measurements[key];
      if (v == null || v <= 0) return 1;
      return clamp(v / ref[key], 0.78, 1.32);
    };
    return {
      neck: base.neck * factor("neck"),
      shoulder: base.shoulder * factor("shoulder"),
      chest: base.chest * factor("chest"),
      waist: base.waist * factor("waist"),
      abdomen: base.abdomen * factor("abdomen"),
      hip: base.hip * factor("hip"),
      arm: base.arm * factor("arm"),
      forearm: base.forearm * factor("forearm"),
      thigh: base.thigh * factor("thigh"),
      calf: base.calf * factor("calf"),
    };
  }, [measurements, base, ref]);

  // Torso outline.
  const left = [
    { x: cx - half.shoulder, y: 88 },
    { x: cx - half.chest, y: 130 },
    { x: cx - half.waist, y: 188 },
    { x: cx - half.abdomen, y: 216 },
    { x: cx - half.hip, y: 252 },
  ];
  const rightRev = [
    { x: cx + half.hip, y: 252 },
    { x: cx + half.abdomen, y: 216 },
    { x: cx + half.waist, y: 188 },
    { x: cx + half.chest, y: 130 },
    { x: cx + half.shoulder, y: 88 },
  ];

  const torso =
    `M ${left[0].x.toFixed(1)} ${left[0].y}` +
    smooth(left) +
    ` Q ${cx} 274 ${rightRev[0].x.toFixed(1)} ${rightRev[0].y}` +
    smooth(rightRev) +
    " Z";

  // Limb geometry derived from current shoulder / hip widths.
  const armCenterL = cx - half.shoulder - half.arm + 3;
  const armCenterR = cx + half.shoulder + half.arm - 3;
  const legCenterL = cx - Math.max(half.hip * 0.5, half.thigh + 4);
  const legCenterR = cx + Math.max(half.hip * 0.5, half.thigh + 4);

  const fill = "hsl(var(--primary))";

  return (
    <svg
      viewBox="0 0 240 470"
      className={className}
      role="img"
      aria-label={`Avatar de medidas (${gender === "male" ? "masculino" : "feminino"})`}
    >
      <g fill={fill} fillOpacity={0.13} stroke={fill} strokeOpacity={0.5} strokeWidth={2} strokeLinejoin="round">
        {/* Legs (behind) */}
        <rect x={legCenterL - half.thigh} y={254} width={half.thigh * 2} height={114} rx={half.thigh * 0.7} />
        <rect x={legCenterR - half.thigh} y={254} width={half.thigh * 2} height={114} rx={half.thigh * 0.7} />
        <rect x={legCenterL - half.calf} y={360} width={half.calf * 2} height={96} rx={half.calf * 0.8} />
        <rect x={legCenterR - half.calf} y={360} width={half.calf * 2} height={96} rx={half.calf * 0.8} />

        {/* Arms (behind) */}
        <rect x={armCenterL - half.arm} y={92} width={half.arm * 2} height={78} rx={half.arm} />
        <rect x={armCenterR - half.arm} y={92} width={half.arm * 2} height={78} rx={half.arm} />
        <rect x={armCenterL + 1 - half.forearm} y={162} width={half.forearm * 2} height={80} rx={half.forearm} />
        <rect x={armCenterR - 1 - half.forearm} y={162} width={half.forearm * 2} height={80} rx={half.forearm} />

        {/* Torso */}
        <path d={torso} />

        {/* Neck */}
        <rect x={cx - half.neck} y={58} width={half.neck * 2} height={26} rx={half.neck * 0.5} />

        {/* Head */}
        <circle cx={cx} cy={40} r={base.headR} />
      </g>
    </svg>
  );
}
