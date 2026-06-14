// Boneco anatômico com regiões musculares clicáveis (frente/costas) — arte do GPT.
// API estável combinada com o contrato src/lib/bodyMap.ts: BodyMapSvgProps (view, onRegionClick,
// getRegionFill, activeRegions, className) e os 14 ids de região. (Removido o "use client"
// do Next — este projeto é Vite/React.)
import type { KeyboardEvent } from "react";
import type { BodyRegionId } from "@/lib/bodyMap";

export interface BodyMapSvgProps {
  view: "front" | "back";
  onRegionClick?: (id: BodyRegionId) => void;
  getRegionFill?: (id: BodyRegionId) => string | undefined;
  activeRegions?: BodyRegionId[];
  className?: string;
}

const REGION_LABELS: Record<BodyRegionId, string> = {
  chest: "Peitoral",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearm: "Antebraço",
  abs: "Abdômen",
  trapezius: "Trapézio",
  back: "Costas / dorsais",
  lower_back: "Lombar",
  glutes: "Glúteos",
  quads: "Quadríceps",
  hamstrings: "Posterior de coxa",
  adductors: "Adutores",
  calves: "Panturrilhas",
};

const DEFAULT_REGION_FILL = "#c9d0ce";
const ACTIVE_REGION_FILL = "#78b983";
const BODY_FILL = "#fbfcfc";
const BODY_STROKE = "#b9c1bf";
const DETAIL_STROKE = "#e5eaea";
const REGION_STROKE = "#ffffff";
const ACTIVE_STROKE = "#137c2f";
const HOVER_STROKE = "#15803d";

const BODY_OUTLINE_PATH =
  "M96 78 C89 88 75 91 63 99 C50 108 45 128 41 154 C37 181 34 204 29 225 C26 238 31 247 39 247 C46 247 50 241 51 229 C54 207 58 184 63 163 C66 149 69 138 74 130 C76 156 79 181 83 207 C86 229 89 251 90 269 C79 285 73 306 70 332 C67 363 61 394 57 430 C54 456 50 481 46 505 C52 511 63 511 69 504 C76 466 82 430 88 390 C91 371 96 349 101 329 C105 350 107 372 108 395 C109 429 110 468 113 506 C118 511 122 511 127 506 C130 468 131 429 132 395 C133 372 135 350 139 329 C144 349 149 371 152 390 C158 430 164 466 171 504 C177 511 188 511 194 505 C190 481 186 456 183 430 C179 394 173 363 170 332 C167 306 161 285 150 269 C151 251 154 229 157 207 C161 181 164 156 166 130 C171 138 174 149 177 163 C182 184 186 207 189 229 C190 241 194 247 201 247 C209 247 214 238 211 225 C206 204 203 181 199 154 C195 128 190 108 177 99 C165 91 151 88 144 78 C138 84 130 87 120 87 C110 87 102 84 96 78 Z";

type RegionRenderProps = {
  attrs: (id: BodyRegionId) => {
    id: string;
    "data-region": BodyRegionId;
    role: "button";
    tabIndex: number;
    "aria-label": string;
    "aria-pressed": boolean;
    className: string;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  };
  shape: (id: BodyRegionId) => {
    className: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    vectorEffect: "non-scaling-stroke";
    strokeLinejoin: "round";
    strokeLinecap: "round";
  };
};

export function BodyMapSvg({
  view,
  onRegionClick,
  getRegionFill,
  activeRegions = [],
  className,
}: BodyMapSvgProps) {
  const activeSet = new Set<BodyRegionId>(activeRegions);

  const isActive = (id: BodyRegionId) => activeSet.has(id);

  const fillFor = (id: BodyRegionId) =>
    getRegionFill?.(id) ?? (isActive(id) ? ACTIVE_REGION_FILL : DEFAULT_REGION_FILL);

  const shape = (id: BodyRegionId) => ({
    className: "region-shape",
    fill: fillFor(id),
    stroke: isActive(id) ? ACTIVE_STROKE : REGION_STROKE,
    strokeWidth: isActive(id) ? 1.8 : 1.05,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  });

  const attrs = (id: BodyRegionId) => ({
    id: `region-${id}`,
    "data-region": id,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": REGION_LABELS[id],
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
      viewBox="0 0 240 520"
      width="100%"
      height="auto"
      role="img"
      aria-label={`Mapa anatômico muscular - ${view === "front" ? "frente" : "costas"}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
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
          opacity: 0.9;
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

      <BodyBase view={view} />

      {view === "front" ? (
        <FrontRegions attrs={attrs} shape={shape} />
      ) : (
        <BackRegions attrs={attrs} shape={shape} />
      )}

      <BodyLinework view={view} />
    </svg>
  );
}

function BodyBase({ view }: { view: "front" | "back" }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <path d={BODY_OUTLINE_PATH} fill={BODY_FILL} stroke="none" />

      <ellipse cx="120" cy="40" rx="21" ry="26" fill={BODY_FILL} stroke="none" />

      <path
        d="M103 62 C107 76 112 83 120 83 C128 83 133 76 137 62 L139 86 C133 91 127 94 120 94 C113 94 107 91 101 86 Z"
        fill={BODY_FILL}
        stroke="none"
      />

      {view === "back" && (
        <path
          d="M116 82 C117 126 117 171 116 219 C116 240 113 258 108 273 M124 82 C123 126 123 171 124 219 C124 240 127 258 132 273"
          fill="none"
          stroke={DETAIL_STROKE}
          strokeWidth="1.1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

function BodyLinework({ view }: { view: "front" | "back" }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <ellipse cx="120" cy="40" rx="21" ry="26" fill="none" stroke={BODY_STROKE} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />

      <path
        d="M103 62 C107 76 112 83 120 83 C128 83 133 76 137 62"
        fill="none"
        stroke={BODY_STROKE}
        strokeWidth="1.35"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d={BODY_OUTLINE_PATH}
        fill="none"
        stroke={BODY_STROKE}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {view === "front" ? <FrontLinework /> : <BackLinework />}
    </g>
  );
}

function FrontLinework() {
  return (
    <g>
      <path d="M91 103 C101 95 111 94 120 102 C129 94 139 95 149 103" fill="none" stroke={DETAIL_STROKE} strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M120 104 C120 136 120 174 120 235" fill="none" stroke={DETAIL_STROKE} strokeWidth="1.15" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M96 157 C103 162 112 164 120 164 C128 164 137 162 144 157 M99 186 C106 190 113 191 120 191 C127 191 134 190 141 186 M101 213 C108 217 114 218 120 218 C126 218 132 217 139 213" fill="none" stroke={DETAIL_STROKE} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M90 270 C102 282 113 287 120 287 C127 287 138 282 150 270" fill="none" stroke={DETAIL_STROKE} strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M101 329 C95 352 91 375 88 399 M139 329 C145 352 149 375 152 399" fill="none" stroke={DETAIL_STROKE} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M79 394 C84 401 90 404 97 403 M143 403 C150 404 156 401 161 394" fill="none" stroke={DETAIL_STROKE} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function BackLinework() {
  return (
    <g>
      <path d="M120 83 C120 112 120 145 120 181 C120 215 120 248 120 281" fill="none" stroke={DETAIL_STROKE} strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M91 116 C102 124 111 128 120 128 C129 128 138 124 149 116" fill="none" stroke={DETAIL_STROKE} strokeWidth="1.1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M82 134 C93 144 105 151 117 155 M158 134 C147 144 135 151 123 155" fill="none" stroke={DETAIL_STROKE} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M94 263 C105 274 114 280 120 280 C126 280 135 274 146 263" fill="none" stroke={DETAIL_STROKE} strokeWidth="1.1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M89 320 C98 346 101 374 96 402 M151 320 C142 346 139 374 144 402" fill="none" stroke={DETAIL_STROKE} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M78 394 C84 403 90 406 98 403 M142 403 C150 406 156 403 162 394" fill="none" stroke={DETAIL_STROKE} strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function FrontRegions({ attrs, shape }: RegionRenderProps) {
  return (
    <g>
      <g {...attrs("shoulders")}>
        <title>{REGION_LABELS.shoulders}</title>
        <path {...shape("shoulders")} d="M83 92 C70 95 60 105 56 121 C58 130 67 135 80 138 C85 128 89 110 83 92 Z" />
        <path {...shape("shoulders")} d="M157 92 C170 95 180 105 184 121 C182 130 173 135 160 138 C155 128 151 110 157 92 Z" />
      </g>

      <g {...attrs("chest")}>
        <title>{REGION_LABELS.chest}</title>
        <path {...shape("chest")} d="M88 108 C98 100 111 99 119 108 L118 149 C104 149 92 143 83 130 C83 121 85 113 88 108 Z" />
        <path {...shape("chest")} d="M152 108 C142 100 129 99 121 108 L122 149 C136 149 148 143 157 130 C157 121 155 113 152 108 Z" />
      </g>

      <g {...attrs("biceps")}>
        <title>{REGION_LABELS.biceps}</title>
        <path {...shape("biceps")} d="M58 128 C50 140 45 160 43 188 C50 192 58 187 63 174 C68 157 67 139 58 128 Z" />
        <path {...shape("biceps")} d="M182 128 C190 140 195 160 197 188 C190 192 182 187 177 174 C172 157 173 139 182 128 Z" />
      </g>

      <g {...attrs("forearm")}>
        <title>{REGION_LABELS.forearm}</title>
        <path {...shape("forearm")} d="M43 187 C36 206 31 228 30 245 C35 252 44 250 48 238 C54 220 58 200 56 187 Z" />
        <path {...shape("forearm")} d="M197 187 C204 206 209 228 210 245 C205 252 196 250 192 238 C186 220 182 200 184 187 Z" />
      </g>

      <g {...attrs("abs")}>
        <title>{REGION_LABELS.abs}</title>
        <path {...shape("abs")} d="M101 151 C106 148 113 148 118 153 L117 176 C112 179 106 179 101 175 Z" />
        <path {...shape("abs")} d="M122 153 C127 148 134 148 139 151 L139 175 C134 179 128 179 123 176 Z" />
        <path {...shape("abs")} d="M101 180 C106 177 113 177 118 181 L118 205 C113 208 106 208 101 204 Z" />
        <path {...shape("abs")} d="M122 181 C127 177 134 177 139 180 L139 204 C134 208 127 208 122 205 Z" />
        <path {...shape("abs")} d="M103 209 C108 207 114 207 118 211 L118 235 C114 239 108 239 103 235 Z" />
        <path {...shape("abs")} d="M122 211 C126 207 132 207 137 209 L137 235 C132 239 126 239 122 235 Z" />
        <path {...shape("abs")} d="M88 150 C96 162 99 181 99 207 C99 223 96 238 91 250 C84 224 81 184 88 150 Z" />
        <path {...shape("abs")} d="M152 150 C144 162 141 181 141 207 C141 223 144 238 149 250 C156 224 159 184 152 150 Z" />
      </g>

      <g {...attrs("quads")}>
        <title>{REGION_LABELS.quads}</title>
        <path {...shape("quads")} d="M89 273 C80 291 76 317 77 348 C78 374 84 395 92 405 C100 388 105 358 105 327 C105 303 99 285 89 273 Z" />
        <path {...shape("quads")} d="M151 273 C160 291 164 317 163 348 C162 374 156 395 148 405 C140 388 135 358 135 327 C135 303 141 285 151 273 Z" />
      </g>

      <g {...attrs("adductors")}>
        <title>{REGION_LABELS.adductors}</title>
        <path {...shape("adductors")} d="M106 276 C113 290 117 313 118 344 C113 340 107 322 104 299 C102 287 102 280 106 276 Z" />
        <path {...shape("adductors")} d="M134 276 C127 290 123 313 122 344 C127 340 133 322 136 299 C138 287 138 280 134 276 Z" />
      </g>

      <g {...attrs("calves")}>
        <title>{REGION_LABELS.calves}</title>
        <path {...shape("calves")} d="M87 392 C76 419 69 461 68 493 C74 501 83 498 87 484 C95 452 98 418 92 395 Z" />
        <path {...shape("calves")} d="M153 392 C164 419 171 461 172 493 C166 501 157 498 153 484 C145 452 142 418 148 395 Z" />
      </g>
    </g>
  );
}

function BackRegions({ attrs, shape }: RegionRenderProps) {
  return (
    <g>
      <g {...attrs("shoulders")}>
        <title>{REGION_LABELS.shoulders}</title>
        <path {...shape("shoulders")} d="M83 92 C70 95 60 105 56 121 C59 130 68 135 81 137 C86 126 89 109 83 92 Z" />
        <path {...shape("shoulders")} d="M157 92 C170 95 180 105 184 121 C181 130 172 135 159 137 C154 126 151 109 157 92 Z" />
      </g>

      <g {...attrs("trapezius")}>
        <title>{REGION_LABELS.trapezius}</title>
        <path {...shape("trapezius")} d="M104 75 C110 88 116 96 120 103 C124 96 130 88 136 75 C141 93 149 109 160 122 C146 126 132 122 120 114 C108 122 94 126 80 122 C91 109 99 93 104 75 Z" />
        <path {...shape("trapezius")} d="M96 112 C105 120 113 126 120 137 C127 126 135 120 144 112 C140 136 132 153 120 164 C108 153 100 136 96 112 Z" />
      </g>

      <g {...attrs("back")}>
        <title>{REGION_LABELS.back}</title>
        <path {...shape("back")} d="M80 122 C96 128 110 140 117 158 C113 188 106 216 96 241 C84 231 75 210 73 185 C71 160 74 139 80 122 Z" />
        <path {...shape("back")} d="M160 122 C144 128 130 140 123 158 C127 188 134 216 144 241 C156 231 165 210 167 185 C169 160 166 139 160 122 Z" />
      </g>

      <g {...attrs("triceps")}>
        <title>{REGION_LABELS.triceps}</title>
        <path {...shape("triceps")} d="M58 128 C50 141 45 160 43 188 C50 192 58 188 63 174 C68 157 67 139 58 128 Z" />
        <path {...shape("triceps")} d="M182 128 C190 141 195 160 197 188 C190 192 182 188 177 174 C172 157 173 139 182 128 Z" />
      </g>

      <g {...attrs("forearm")}>
        <title>{REGION_LABELS.forearm}</title>
        <path {...shape("forearm")} d="M43 187 C36 207 31 228 30 245 C35 252 44 250 48 238 C54 220 58 200 56 187 Z" />
        <path {...shape("forearm")} d="M197 187 C204 207 209 228 210 245 C205 252 196 250 192 238 C186 220 182 200 184 187 Z" />
      </g>

      <g {...attrs("lower_back")}>
        <title>{REGION_LABELS.lower_back}</title>
        <path {...shape("lower_back")} d="M98 229 C106 238 113 243 120 245 C127 243 134 238 142 229 L147 263 C139 276 129 282 120 284 C111 282 101 276 93 263 Z" />
      </g>

      <g {...attrs("glutes")}>
        <title>{REGION_LABELS.glutes}</title>
        <path {...shape("glutes")} d="M91 272 C102 266 114 270 120 284 C116 304 105 318 89 322 C81 307 80 286 91 272 Z" />
        <path {...shape("glutes")} d="M149 272 C138 266 126 270 120 284 C124 304 135 318 151 322 C159 307 160 286 149 272 Z" />
      </g>

      <g {...attrs("hamstrings")}>
        <title>{REGION_LABELS.hamstrings}</title>
        <path {...shape("hamstrings")} d="M88 317 C79 345 77 379 90 405 C101 383 106 347 104 318 C98 315 93 315 88 317 Z" />
        <path {...shape("hamstrings")} d="M152 317 C161 345 163 379 150 405 C139 383 134 347 136 318 C142 315 147 315 152 317 Z" />
      </g>

      <g {...attrs("calves")}>
        <title>{REGION_LABELS.calves}</title>
        <path {...shape("calves")} d="M88 393 C76 418 69 459 69 492 C75 501 85 498 90 482 C98 445 98 417 91 395 Z" />
        <path {...shape("calves")} d="M152 393 C164 418 171 459 171 492 C165 501 155 498 150 482 C142 445 142 417 149 395 Z" />
      </g>
    </g>
  );
}
