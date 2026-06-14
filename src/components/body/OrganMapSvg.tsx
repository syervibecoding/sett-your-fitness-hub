// Boneco de órgãos / cardiorrespiratório (arte do GPT) — mesmo estilo do boneco muscular
// (corpo branco, órgãos cinza, highlight verde). Vista única (frente). API consistente com
// BodyMapSvg: onRegionClick / getRegionFill / activeRegions / className. (Vite — sem "use client".)
import type { KeyboardEvent } from "react";

export type OrganId =
  | "brain"
  | "heart"
  | "lungs"
  | "liver"
  | "stomach"
  | "intestines"
  | "kidneys"
  | "bladder";

export interface OrganMapSvgProps {
  onRegionClick?: (id: OrganId) => void;
  getRegionFill?: (id: OrganId) => string | undefined;
  activeRegions?: OrganId[];
  className?: string;
}

export const ORGAN_LABELS: Record<OrganId, string> = {
  brain: "Cérebro",
  heart: "Coração",
  lungs: "Pulmões",
  liver: "Fígado",
  stomach: "Estômago",
  intestines: "Intestinos",
  kidneys: "Rins",
  bladder: "Bexiga",
};

export const ORGAN_IDS: OrganId[] = [
  "brain", "heart", "lungs", "liver", "stomach", "intestines", "kidneys", "bladder",
];

const DEFAULT_FILL = "#c9d0ce";
const ACTIVE_FILL = "#7fb886";
const BODY_FILL = "#fbfcfc";
const STROKE = "#aeb6b4";
const DETAIL_STROKE = "#dfe5e3";
const ACTIVE_STROKE = "#137c2f";
const HOVER_STROKE = "#15803d";

const BODY_OUTLINE_PATH =
  "M126 74 C117 91 96 94 77 103 C59 112 49 131 43 164 C37 200 31 229 23 260 C20 274 25 285 36 285 C46 285 52 278 55 263 C62 231 67 202 74 176 C78 158 84 144 91 136 C93 170 97 204 101 238 C104 264 109 287 113 304 C101 324 94 351 91 383 C88 419 82 458 75 514 C83 525 99 524 104 510 C113 469 119 429 122 390 C124 360 128 332 133 313 C138 350 140 394 140 516 C146 522 154 522 160 516 C160 394 162 350 167 313 C172 332 176 360 178 390 C181 429 187 469 196 510 C201 524 217 525 225 514 C218 458 212 419 209 383 C206 351 199 324 187 304 C191 287 196 264 199 238 C203 204 207 170 209 136 C216 144 222 158 226 176 C233 202 238 231 245 263 C248 278 254 285 264 285 C275 285 280 274 277 260 C269 229 263 200 257 164 C251 131 241 112 223 103 C204 94 183 91 174 74 C168 82 159 87 150 87 C141 87 132 82 126 74 Z";

type RegionRenderProps = {
  attrs: (id: OrganId) => {
    id: string;
    "data-region": OrganId;
    role: "button";
    tabIndex: number;
    "aria-label": string;
    "aria-pressed": boolean;
    className: string;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  };
  shape: (id: OrganId) => {
    className: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    vectorEffect: "non-scaling-stroke";
    strokeLinejoin: "round";
    strokeLinecap: "round";
    paintOrder: "stroke";
  };
};

export function OrganMapSvg({
  onRegionClick,
  getRegionFill,
  activeRegions = [],
  className,
}: OrganMapSvgProps) {
  const activeSet = new Set<OrganId>(activeRegions);

  const isActive = (id: OrganId) => activeSet.has(id);

  const fillFor = (id: OrganId) =>
    getRegionFill?.(id) ?? (isActive(id) ? ACTIVE_FILL : DEFAULT_FILL);

  const shape = (id: OrganId) => ({
    className: "region-shape",
    fill: fillFor(id),
    stroke: isActive(id) ? ACTIVE_STROKE : STROKE,
    strokeWidth: isActive(id) ? 1.8 : 1.25,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    paintOrder: "stroke" as const,
  });

  const attrs = (id: OrganId) => ({
    id: `region-${id}`,
    "data-region": id,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": ORGAN_LABELS[id],
    "aria-pressed": isActive(id),
    className: `body-map-region${isActive(id) ? " is-active" : ""}`,
    onClick: () => onRegionClick?.(id),
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRegionClick?.(id);
      }
    },
  });

  return (
    <svg
      className={["body-map-svg", className].filter(Boolean).join(" ")}
      viewBox="0 0 300 560"
      width="100%"
      height="100%"
      role="img"
      aria-label="Mapa cardiorrespiratório e de órgãos"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
      <title>Mapa cardiorrespiratório e de órgãos</title>

      <style>{`
        .body-map-svg {
          display: block;
          overflow: visible;
        }

        .body-map-region {
          cursor: pointer;
          outline: none;
        }

        .body-map-region .region-shape {
          transition:
            fill 160ms ease,
            opacity 160ms ease,
            stroke 160ms ease,
            stroke-width 160ms ease,
            filter 160ms ease;
        }

        .body-map-region:hover .region-shape {
          opacity: 0.93;
          stroke: ${HOVER_STROKE};
          stroke-width: 2;
        }

        .body-map-region:focus-visible .region-shape {
          stroke: ${HOVER_STROKE};
          stroke-width: 2.4;
        }

        .body-map-region.is-active .region-shape {
          filter: drop-shadow(0 2px 5px rgba(19, 124, 47, 0.22));
        }
      `}</style>

      <BodySilhouette />
      <OrganGuideLines />
      <OrganRegions attrs={attrs} shape={shape} />
      <BodyOutline />
    </svg>
  );
}

function BodySilhouette() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <path d={BODY_OUTLINE_PATH} fill={BODY_FILL} stroke="none" />
      <ellipse cx="150" cy="43" rx="24" ry="30" fill={BODY_FILL} stroke="none" />
      <path
        d="M130 66 C134 80 141 88 150 88 C159 88 166 80 170 66 L173 96 C166 102 158 105 150 105 C142 105 134 102 127 96 Z"
        fill={BODY_FILL}
        stroke="none"
      />
    </g>
  );
}

function BodyOutline() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <ellipse
        cx="150"
        cy="43"
        rx="24"
        ry="30"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.55"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M130 66 C134 80 141 88 150 88 C159 88 166 80 170 66"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={BODY_OUTLINE_PATH}
        fill="none"
        stroke={STROKE}
        strokeWidth="1.65"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function OrganGuideLines() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <path
        d="M150 76 C150 101 150 119 150 140"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M150 202 C150 232 150 260 150 300 C150 332 150 356 150 382"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.45"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M91 128 C108 117 130 111 150 111 C170 111 192 117 209 128"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function OrganRegions({ attrs, shape }: RegionRenderProps) {
  return (
    <g>
      <g {...attrs("brain")}>
        <title>{ORGAN_LABELS.brain}</title>
        <path
          {...shape("brain")}
          d="M130 39 C127 29 133 20 144 18 C149 13 160 15 164 23 C172 25 176 34 173 43 C176 52 169 61 159 62 C153 67 143 65 139 59 C130 58 124 49 130 39 Z"
        />
        <path
          d="M137 36 C143 31 150 31 156 36 M134 45 C142 41 151 42 159 47 M145 23 C142 30 143 37 148 43 M160 26 C156 32 156 39 162 45"
          fill="none"
          stroke={BODY_FILL}
          strokeWidth="1.05"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>

      <g {...attrs("lungs")}>
        <title>{ORGAN_LABELS.lungs}</title>
        <path
          {...shape("lungs")}
          d="M143 121 C128 119 112 128 106 147 C99 169 101 195 111 214 C125 213 139 204 145 189 C149 171 149 143 143 121 Z"
        />
        <path
          {...shape("lungs")}
          d="M157 121 C172 119 188 128 194 147 C201 169 199 195 189 214 C175 213 161 204 155 189 C151 171 151 143 157 121 Z"
        />
        <path
          {...shape("lungs")}
          d="M144 96 C148 94 152 94 156 96 L156 128 C154 132 146 132 144 128 Z"
        />
        <path
          d="M145 140 C131 151 124 169 124 202 M155 140 C169 151 176 169 176 202"
          fill="none"
          stroke={BODY_FILL}
          strokeWidth="1.1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>

      <g {...attrs("heart")}>
        <title>{ORGAN_LABELS.heart}</title>
        <path
          {...shape("heart")}
          d="M151 158 C155 147 169 144 175 154 C184 169 172 190 151 204 C130 190 118 169 127 154 C133 144 147 147 151 158 Z"
        />
        <path
          d="M151 158 C149 173 151 188 151 203 M136 160 C144 165 149 171 151 180 M166 160 C158 166 153 174 151 184"
          fill="none"
          stroke={BODY_FILL}
          strokeWidth="1.05"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>

      <g {...attrs("kidneys")}>
        <title>{ORGAN_LABELS.kidneys}</title>
        <path
          {...shape("kidneys")}
          d="M117 235 C103 242 99 265 110 278 C124 273 132 255 127 241 C124 235 121 234 117 235 Z"
        />
        <path
          {...shape("kidneys")}
          d="M183 235 C197 242 201 265 190 278 C176 273 168 255 173 241 C176 235 179 234 183 235 Z"
        />
        <path
          d="M127 257 C136 255 143 250 150 244 C157 250 164 255 173 257"
          fill="none"
          stroke={DETAIL_STROKE}
          strokeWidth="1.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>

      <g {...attrs("liver")}>
        <title>{ORGAN_LABELS.liver}</title>
        <path
          {...shape("liver")}
          d="M101 216 C123 207 154 211 174 224 C172 240 157 252 134 255 C117 258 101 251 94 239 C93 228 96 220 101 216 Z"
        />
        <path
          d="M113 229 C130 225 148 226 163 233"
          fill="none"
          stroke={BODY_FILL}
          strokeWidth="1.05"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>

      <g {...attrs("stomach")}>
        <title>{ORGAN_LABELS.stomach}</title>
        <path
          {...shape("stomach")}
          d="M172 218 C190 220 201 234 196 251 C193 264 180 275 166 271 C153 267 151 253 160 245 C171 237 170 227 172 218 Z"
        />
        <path
          d="M170 239 C181 240 187 247 184 258"
          fill="none"
          stroke={BODY_FILL}
          strokeWidth="1.1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>

      <g {...attrs("intestines")}>
        <title>{ORGAN_LABELS.intestines}</title>
        <path
          {...shape("intestines")}
          d="M119 274 C132 264 168 264 181 274 C194 286 191 321 178 337 C162 349 137 349 122 337 C109 321 106 286 119 274 Z"
        />
        <path
          d="M127 285 C139 277 161 277 173 285
             M126 303 C140 294 160 294 174 303
             M126 321 C140 312 160 312 174 321
             M138 280 C130 297 130 320 140 338
             M162 280 C170 297 170 320 160 338"
          fill="none"
          stroke={BODY_FILL}
          strokeWidth="1.05"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>

      <g {...attrs("bladder")}>
        <title>{ORGAN_LABELS.bladder}</title>
        <path
          {...shape("bladder")}
          d="M139 356 C145 348 155 348 161 356 C166 365 162 379 150 386 C138 379 134 365 139 356 Z"
        />
        <path
          d="M150 349 L150 336"
          fill="none"
          stroke={STROKE}
          strokeWidth="1.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </g>
    </g>
  );
}
