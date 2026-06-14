// Boneco ósseo/articular (arte do GPT) — mesmo estilo do muscular (corpo branco, ossos cinza,
// articulações clicáveis que acendem). Frente/costas. API consistente com BodyMapSvg.
import type { KeyboardEvent } from "react";

export type JointId =
  | "cervical"
  | "thoracic"
  | "lumbar"
  | "sacroiliac"
  | "shoulder"
  | "elbow"
  | "wrist"
  | "hand"
  | "hip"
  | "knee"
  | "ankle"
  | "foot"
  | "neck";

export const JOINT_LABELS: Record<JointId, string> = {
  cervical: "Coluna cervical",
  thoracic: "Coluna torácica",
  lumbar: "Coluna lombar",
  sacroiliac: "Sacroilíaca",
  shoulder: "Ombro",
  elbow: "Cotovelo",
  wrist: "Punho",
  hand: "Mão",
  hip: "Quadril",
  knee: "Joelho",
  ankle: "Tornozelo",
  foot: "Pé",
  neck: "Pescoço",
};

export const JOINT_IDS: JointId[] = [
  "neck", "cervical", "thoracic", "lumbar", "sacroiliac", "shoulder",
  "elbow", "wrist", "hand", "hip", "knee", "ankle", "foot",
];

export interface SkeletonMapSvgProps {
  view: "front" | "back";
  onRegionClick?: (id: JointId) => void;
  getRegionFill?: (id: JointId) => string | undefined;
  activeRegions?: JointId[];
  className?: string;
}

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
  attrs: (id: JointId) => {
    id: string;
    "data-region": JointId;
    role: "button";
    tabIndex: number;
    "aria-label": string;
    "aria-pressed": boolean;
    className: string;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  };
  shape: (id: JointId) => {
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

export function SkeletonMapSvg({
  view,
  onRegionClick,
  getRegionFill,
  activeRegions = [],
  className,
}: SkeletonMapSvgProps) {
  const activeSet = new Set<JointId>(activeRegions);

  const isActive = (id: JointId) => activeSet.has(id);

  const fillFor = (id: JointId) =>
    getRegionFill?.(id) ?? (isActive(id) ? ACTIVE_FILL : DEFAULT_FILL);

  const shape = (id: JointId) => ({
    className: "region-shape",
    fill: fillFor(id),
    stroke: isActive(id) ? ACTIVE_STROKE : STROKE,
    strokeWidth: isActive(id) ? 1.8 : 1.25,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    paintOrder: "stroke" as const,
  });

  const attrs = (id: JointId) => ({
    id: `region-${id}`,
    "data-region": id,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": JOINT_LABELS[id],
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
      aria-label={`Mapa ósseo e articular - ${view === "front" ? "frente" : "costas"}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
      <title>Mapa ósseo e articular - {view === "front" ? "frente" : "costas"}</title>

      <style>{`
        .body-map-svg { display: block; overflow: visible; }
        .body-map-region { cursor: pointer; outline: none; }
        .body-map-region .region-shape {
          transition: fill 160ms ease, opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease, filter 160ms ease;
        }
        .body-map-region:hover .region-shape { opacity: 0.93; stroke: ${HOVER_STROKE}; stroke-width: 2; }
        .body-map-region:focus-visible .region-shape { stroke: ${HOVER_STROKE}; stroke-width: 2.4; }
        .body-map-region.is-active .region-shape { filter: drop-shadow(0 2px 5px rgba(19, 124, 47, 0.22)); }
      `}</style>

      <BodySilhouette />
      {view === "front" ? <FrontSkeletonLinework /> : <BackSkeletonLinework />}
      {view === "front" ? (
        <FrontJointRegions attrs={attrs} shape={shape} />
      ) : (
        <BackJointRegions attrs={attrs} shape={shape} />
      )}
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
      <ellipse cx="150" cy="43" rx="24" ry="30" fill="none" stroke={STROKE} strokeWidth="1.55" vectorEffect="non-scaling-stroke" />
      <path d="M130 66 C134 80 141 88 150 88 C159 88 166 80 170 66" fill="none" stroke={STROKE} strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={BODY_OUTLINE_PATH} fill="none" stroke={STROKE} strokeWidth="1.65" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function SpineDots({ from, to, count, rx = 3.6 }: { from: number; to: number; count: number; rx?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const y = from + ((to - from) / Math.max(count - 1, 1)) * index;
        return (
          <ellipse key={`${from}-${to}-${index}`} cx="150" cy={y} rx={rx} ry="2.7" fill={DEFAULT_FILL} stroke={STROKE} strokeWidth="0.85" vectorEffect="non-scaling-stroke" />
        );
      })}
    </>
  );
}

function FrontSkeletonLinework() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <path d="M132 96 C139 103 145 107 150 107 C155 107 161 103 168 96" fill="none" stroke={STROKE} strokeWidth="1.15" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M101 122 C118 116 135 113 150 113 C165 113 182 116 199 122" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <SpineDots from={93} to={286} count={18} />
      <path
        d="M150 126 C129 126 112 134 100 150 M150 126 C171 126 188 134 200 150
           M150 140 C128 140 108 151 95 169 M150 140 C172 140 192 151 205 169
           M150 154 C128 154 107 166 94 187 M150 154 C172 154 193 166 206 187
           M150 168 C129 168 111 181 100 202 M150 168 C171 168 189 181 200 202
           M150 183 C131 183 116 195 108 214 M150 183 C169 183 184 195 192 214"
        fill="none" stroke={STROKE} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d="M150 120 L150 218" fill="none" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d="M112 292 C124 279 138 274 150 276 C162 274 176 279 188 292
           M105 306 C123 315 138 319 150 319 C162 319 177 315 195 306
           M119 286 C114 299 112 314 115 327
           M181 286 C186 299 188 314 185 327"
        fill="none" stroke={STROKE} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path
        d="M88 146 C76 166 68 186 63 209 M212 146 C224 166 232 186 237 209
           M62 215 C55 237 49 256 43 277 M238 215 C245 237 251 256 257 277"
        fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d="M118 326 C108 352 104 381 106 410 M182 326 C192 352 196 381 194 410
           M106 416 C100 444 96 476 98 508 M194 416 C200 444 204 476 202 508
           M121 331 C127 357 128 389 124 419 M179 331 C173 357 172 389 176 419
           M116 421 C112 449 109 477 111 503 M184 421 C188 449 191 477 189 503"
        fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function BackSkeletonLinework() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <path d="M103 123 C121 132 136 136 150 136 C164 136 179 132 197 123" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d="M102 132 C116 150 130 160 146 166 M198 132 C184 150 170 160 154 166
           M108 146 C119 160 130 169 144 174 M192 146 C181 160 170 169 156 174"
        fill="none" stroke={DETAIL_STROKE} strokeWidth="1.25" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <SpineDots from={91} to={292} count={20} />
      <path
        d="M150 125 C128 125 109 136 96 155 M150 125 C172 125 191 136 204 155
           M150 142 C128 142 109 155 98 176 M150 142 C172 142 191 155 202 176
           M150 160 C130 160 114 173 105 194 M150 160 C170 160 186 173 195 194
           M150 180 C133 180 120 193 113 212 M150 180 C167 180 180 193 187 212"
        fill="none" stroke={STROKE} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d="M150 120 L150 225" fill="none" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d="M114 291 C126 281 139 276 150 277 C161 276 174 281 186 291
           M107 307 C124 316 139 321 150 321 C161 321 176 316 193 307
           M119 286 C113 300 112 314 116 329
           M181 286 C187 300 188 314 184 329"
        fill="none" stroke={STROKE} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path
        d="M88 146 C76 166 68 186 63 209 M212 146 C224 166 232 186 237 209
           M62 215 C55 237 49 256 43 277 M238 215 C245 237 251 256 257 277"
        fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d="M118 326 C108 352 104 381 106 410 M182 326 C192 352 196 381 194 410
           M106 416 C100 444 96 476 98 508 M194 416 C200 444 204 476 202 508
           M121 331 C127 357 128 389 124 419 M179 331 C173 357 172 389 176 419
           M116 421 C112 449 109 477 111 503 M184 421 C188 449 191 477 189 503"
        fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function FrontJointRegions({ attrs, shape }: RegionRenderProps) {
  return (
    <g>
      <g {...attrs("neck")}>
        <title>{JOINT_LABELS.neck}</title>
        <path {...shape("neck")} d="M132 73 C137 87 143 94 150 94 C157 94 163 87 168 73 L171 99 C164 106 157 109 150 109 C143 109 136 106 129 99 Z" />
      </g>
      <g {...attrs("cervical")}>
        <title>{JOINT_LABELS.cervical}</title>
        <ellipse {...shape("cervical")} cx="150" cy="84" rx="5" ry="3.6" />
        <ellipse {...shape("cervical")} cx="150" cy="93" rx="5.4" ry="3.7" />
        <ellipse {...shape("cervical")} cx="150" cy="102" rx="5.8" ry="3.8" />
      </g>
      <g {...attrs("thoracic")}>
        <title>{JOINT_LABELS.thoracic}</title>
        {Array.from({ length: 10 }).map((_, index) => (
          <ellipse key={`thoracic-front-${index}`} {...shape("thoracic")} cx="150" cy={118 + index * 12} rx={5.2 + Math.min(index, 5) * 0.12} ry="3.6" />
        ))}
      </g>
      <g {...attrs("lumbar")}>
        <title>{JOINT_LABELS.lumbar}</title>
        {Array.from({ length: 5 }).map((_, index) => (
          <ellipse key={`lumbar-front-${index}`} {...shape("lumbar")} cx="150" cy={240 + index * 11} rx={6.1} ry="4" />
        ))}
      </g>
      <g {...attrs("sacroiliac")}>
        <title>{JOINT_LABELS.sacroiliac}</title>
        <path {...shape("sacroiliac")} d="M137 288 C143 284 157 284 163 288 C162 305 157 318 150 326 C143 318 138 305 137 288 Z" />
        <path {...shape("sacroiliac")} d="M116 294 C126 287 136 287 145 296 C137 306 127 314 114 319 C112 310 112 301 116 294 Z" />
        <path {...shape("sacroiliac")} d="M184 294 C174 287 164 287 155 296 C163 306 173 314 186 319 C188 310 188 301 184 294 Z" />
      </g>
      <g {...attrs("shoulder")}>
        <title>{JOINT_LABELS.shoulder}</title>
        <ellipse {...shape("shoulder")} cx="90" cy="130" rx="15" ry="17" />
        <ellipse {...shape("shoulder")} cx="210" cy="130" rx="15" ry="17" />
      </g>
      <g {...attrs("elbow")}>
        <title>{JOINT_LABELS.elbow}</title>
        <ellipse {...shape("elbow")} cx="63" cy="211" rx="9" ry="11" />
        <ellipse {...shape("elbow")} cx="237" cy="211" rx="9" ry="11" />
      </g>
      <g {...attrs("wrist")}>
        <title>{JOINT_LABELS.wrist}</title>
        <ellipse {...shape("wrist")} cx="43" cy="278" rx="7" ry="9" />
        <ellipse {...shape("wrist")} cx="257" cy="278" rx="7" ry="9" />
      </g>
      <g {...attrs("hand")}>
        <title>{JOINT_LABELS.hand}</title>
        <path {...shape("hand")} d="M36 284 C28 292 29 306 39 312 C49 308 55 298 51 288 C47 283 41 281 36 284 Z" />
        <path {...shape("hand")} d="M264 284 C272 292 271 306 261 312 C251 308 245 298 249 288 C253 283 259 281 264 284 Z" />
      </g>
      <g {...attrs("hip")}>
        <title>{JOINT_LABELS.hip}</title>
        <ellipse {...shape("hip")} cx="116" cy="315" rx="14" ry="16" />
        <ellipse {...shape("hip")} cx="184" cy="315" rx="14" ry="16" />
      </g>
      <g {...attrs("knee")}>
        <title>{JOINT_LABELS.knee}</title>
        <ellipse {...shape("knee")} cx="106" cy="413" rx="11" ry="14" />
        <ellipse {...shape("knee")} cx="194" cy="413" rx="11" ry="14" />
      </g>
      <g {...attrs("ankle")}>
        <title>{JOINT_LABELS.ankle}</title>
        <ellipse {...shape("ankle")} cx="99" cy="510" rx="9" ry="10" />
        <ellipse {...shape("ankle")} cx="201" cy="510" rx="9" ry="10" />
      </g>
      <g {...attrs("foot")}>
        <title>{JOINT_LABELS.foot}</title>
        <path {...shape("foot")} d="M99 512 C87 514 76 523 73 535 C85 540 104 536 110 525 C109 517 105 513 99 512 Z" />
        <path {...shape("foot")} d="M201 512 C213 514 224 523 227 535 C215 540 196 536 190 525 C191 517 195 513 201 512 Z" />
      </g>
    </g>
  );
}

function BackJointRegions({ attrs, shape }: RegionRenderProps) {
  return (
    <g>
      <g {...attrs("neck")}>
        <title>{JOINT_LABELS.neck}</title>
        <path {...shape("neck")} d="M132 73 C137 87 143 94 150 94 C157 94 163 87 168 73 L171 99 C164 106 157 109 150 109 C143 109 136 106 129 99 Z" />
      </g>
      <g {...attrs("cervical")}>
        <title>{JOINT_LABELS.cervical}</title>
        <ellipse {...shape("cervical")} cx="150" cy="84" rx="5" ry="3.6" />
        <ellipse {...shape("cervical")} cx="150" cy="93" rx="5.4" ry="3.7" />
        <ellipse {...shape("cervical")} cx="150" cy="102" rx="5.8" ry="3.8" />
      </g>
      <g {...attrs("thoracic")}>
        <title>{JOINT_LABELS.thoracic}</title>
        {Array.from({ length: 11 }).map((_, index) => (
          <ellipse key={`thoracic-back-${index}`} {...shape("thoracic")} cx="150" cy={116 + index * 12} rx={5.4 + Math.min(index, 6) * 0.12} ry="3.7" />
        ))}
      </g>
      <g {...attrs("lumbar")}>
        <title>{JOINT_LABELS.lumbar}</title>
        {Array.from({ length: 5 }).map((_, index) => (
          <ellipse key={`lumbar-back-${index}`} {...shape("lumbar")} cx="150" cy={245 + index * 11} rx={6.2} ry="4" />
        ))}
      </g>
      <g {...attrs("sacroiliac")}>
        <title>{JOINT_LABELS.sacroiliac}</title>
        <path {...shape("sacroiliac")} d="M137 289 C143 285 157 285 163 289 C162 307 157 320 150 328 C143 320 138 307 137 289 Z" />
        <path {...shape("sacroiliac")} d="M116 296 C126 288 137 289 145 298 C137 309 126 317 113 321 C111 311 112 302 116 296 Z" />
        <path {...shape("sacroiliac")} d="M184 296 C174 288 163 289 155 298 C163 309 174 317 187 321 C189 311 188 302 184 296 Z" />
      </g>
      <g {...attrs("shoulder")}>
        <title>{JOINT_LABELS.shoulder}</title>
        <ellipse {...shape("shoulder")} cx="90" cy="130" rx="15" ry="17" />
        <ellipse {...shape("shoulder")} cx="210" cy="130" rx="15" ry="17" />
      </g>
      <g {...attrs("elbow")}>
        <title>{JOINT_LABELS.elbow}</title>
        <ellipse {...shape("elbow")} cx="63" cy="211" rx="9" ry="11" />
        <ellipse {...shape("elbow")} cx="237" cy="211" rx="9" ry="11" />
      </g>
      <g {...attrs("wrist")}>
        <title>{JOINT_LABELS.wrist}</title>
        <ellipse {...shape("wrist")} cx="43" cy="278" rx="7" ry="9" />
        <ellipse {...shape("wrist")} cx="257" cy="278" rx="7" ry="9" />
      </g>
      <g {...attrs("hand")}>
        <title>{JOINT_LABELS.hand}</title>
        <path {...shape("hand")} d="M36 284 C28 292 29 306 39 312 C49 308 55 298 51 288 C47 283 41 281 36 284 Z" />
        <path {...shape("hand")} d="M264 284 C272 292 271 306 261 312 C251 308 245 298 249 288 C253 283 259 281 264 284 Z" />
      </g>
      <g {...attrs("hip")}>
        <title>{JOINT_LABELS.hip}</title>
        <ellipse {...shape("hip")} cx="116" cy="315" rx="14" ry="16" />
        <ellipse {...shape("hip")} cx="184" cy="315" rx="14" ry="16" />
      </g>
      <g {...attrs("knee")}>
        <title>{JOINT_LABELS.knee}</title>
        <ellipse {...shape("knee")} cx="106" cy="413" rx="11" ry="14" />
        <ellipse {...shape("knee")} cx="194" cy="413" rx="11" ry="14" />
      </g>
      <g {...attrs("ankle")}>
        <title>{JOINT_LABELS.ankle}</title>
        <ellipse {...shape("ankle")} cx="99" cy="510" rx="9" ry="10" />
        <ellipse {...shape("ankle")} cx="201" cy="510" rx="9" ry="10" />
      </g>
      <g {...attrs("foot")}>
        <title>{JOINT_LABELS.foot}</title>
        <path {...shape("foot")} d="M99 512 C87 514 76 523 73 535 C85 540 104 536 110 525 C109 517 105 513 99 512 Z" />
        <path {...shape("foot")} d="M201 512 C213 514 224 523 227 535 C215 540 196 536 190 525 C191 517 195 513 201 512 Z" />
      </g>
    </g>
  );
}
