// Boneco anatômico com regiões musculares clicáveis (frente/costas) — arte do GPT v2.
// Correções desta versão: adutores na parte interna das coxas (sem ilusão de "3 pernas"),
// corpo mais largo/cheio, viewBox maior. API estável (contrato src/lib/bodyMap.ts).
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

const DEFAULT_REGION_FILL = "#bec7c5";
const ACTIVE_REGION_FILL = "#77b981";
const BODY_FILL = "#fbfcfc";
const BODY_STROKE = "#b7c0be";
const DETAIL_STROKE = "#e3e8e7";
const REGION_STROKE = "#ffffff";
const ACTIVE_STROKE = "#137c2f";
const HOVER_STROKE = "#15803d";

const BODY_OUTLINE_PATH =
  "M126 74 C117 91 96 94 77 103 C59 112 49 131 43 164 C37 200 31 229 23 260 C20 274 25 285 36 285 C46 285 52 278 55 263 C62 231 67 202 74 176 C78 158 84 144 91 136 C93 170 97 204 101 238 C104 264 109 287 113 304 C101 324 94 351 91 383 C88 419 82 458 75 514 C83 525 99 524 104 510 C113 469 119 429 122 390 C124 360 128 332 133 313 C138 350 140 394 140 516 C146 522 154 522 160 516 C160 394 162 350 167 313 C172 332 176 360 178 390 C181 429 187 469 196 510 C201 524 217 525 225 514 C218 458 212 419 209 383 C206 351 199 324 187 304 C191 287 196 264 199 238 C203 204 207 170 209 136 C216 144 222 158 226 176 C233 202 238 231 245 263 C248 278 254 285 264 285 C275 285 280 274 277 260 C269 229 263 200 257 164 C251 131 241 112 223 103 C204 94 183 91 174 74 C168 82 159 87 150 87 C141 87 132 82 126 74 Z";

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
    paintOrder: "stroke";
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
    strokeWidth: isActive(id) ? 1.7 : 1.05,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    paintOrder: "stroke" as const,
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
      viewBox="0 0 300 560"
      width="100%"
      height="100%"
      role="img"
      aria-label={`Mapa anatômico muscular - ${view === "front" ? "frente" : "costas"}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
      <title>Mapa anatômico muscular - {view === "front" ? "frente" : "costas"}</title>

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
          opacity: 0.92;
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

      <ellipse cx="150" cy="43" rx="24" ry="30" fill={BODY_FILL} stroke="none" />

      <path
        d="M130 66 C134 80 141 88 150 88 C159 88 166 80 170 66 L173 96 C166 102 158 105 150 105 C142 105 134 102 127 96 Z"
        fill={BODY_FILL}
        stroke="none"
      />

      {view === "back" && (
        <path
          d="M145 86 C146 130 146 179 145 234 C145 263 141 287 134 308 M155 86 C154 130 154 179 155 234 C155 263 159 287 166 308"
          fill="none"
          stroke={DETAIL_STROKE}
          strokeWidth="1.15"
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
      <ellipse
        cx="150"
        cy="43"
        rx="24"
        ry="30"
        fill="none"
        stroke={BODY_STROKE}
        strokeWidth="1.7"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M130 66 C134 80 141 88 150 88 C159 88 166 80 170 66"
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
        strokeWidth="1.85"
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
      <path
        d="M103 116 C116 105 134 104 150 118 C166 104 184 105 197 116"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M150 116 C150 151 150 195 150 268"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.15"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M122 163 C131 168 141 170 150 170 C159 170 169 168 178 163 M124 192 C132 197 141 199 150 199 C159 199 168 197 176 192 M126 223 C134 227 142 229 150 229 C158 229 166 227 174 223"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M113 304 C126 317 139 323 150 323 C161 323 174 317 187 304"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.15"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M150 288 C145 326 144 378 147 424 M150 288 C155 326 156 378 153 424"
        fill="none"
        stroke={BODY_FILL}
        strokeWidth="4.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M150 288 C145 326 144 378 147 424 M150 288 C155 326 156 378 153 424"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="0.95"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M108 396 C115 404 123 407 132 405 M168 405 C177 407 185 404 192 396"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function BackLinework() {
  return (
    <g>
      <path
        d="M150 88 C150 121 150 159 150 205 C150 244 150 283 150 318"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.15"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M103 123 C119 134 135 140 150 140 C165 140 181 134 197 123"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M92 139 C107 153 126 163 145 169 M208 139 C193 153 174 163 155 169"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M117 294 C130 306 142 313 150 314 C158 313 170 306 183 294"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1.1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M150 304 C145 343 144 382 147 425 M150 304 C155 343 156 382 153 425"
        fill="none"
        stroke={BODY_FILL}
        strokeWidth="4.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M150 304 C145 343 144 382 147 425 M150 304 C155 343 156 382 153 425"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="0.95"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M108 397 C115 406 124 409 133 406 M167 406 C176 409 185 406 192 397"
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function FrontRegions({ attrs, shape }: RegionRenderProps) {
  return (
    <g>
      <g {...attrs("shoulders")}>
        <title>{REGION_LABELS.shoulders}</title>
        <path {...shape("shoulders")} d="M82 101 C68 104 57 115 53 132 C55 145 67 153 83 154 C94 144 99 122 93 109 C90 104 87 102 82 101 Z" />
        <path {...shape("shoulders")} d="M218 101 C232 104 243 115 247 132 C245 145 233 153 217 154 C206 144 201 122 207 109 C210 104 213 102 218 101 Z" />
      </g>

      <g {...attrs("chest")}>
        <title>{REGION_LABELS.chest}</title>
        <path {...shape("chest")} d="M101 115 C116 103 137 104 149 119 C147 140 134 157 115 161 C102 155 93 142 89 126 C92 121 96 118 101 115 Z" />
        <path {...shape("chest")} d="M199 115 C184 103 163 104 151 119 C153 140 166 157 185 161 C198 155 207 142 211 126 C208 121 204 118 199 115 Z" />
      </g>

      <g {...attrs("biceps")}>
        <title>{REGION_LABELS.biceps}</title>
        <path {...shape("biceps")} d="M57 135 C48 149 42 172 40 202 C48 207 58 201 64 185 C70 164 69 146 57 135 Z" />
        <path {...shape("biceps")} d="M243 135 C252 149 258 172 260 202 C252 207 242 201 236 185 C230 164 231 146 243 135 Z" />
      </g>

      <g {...attrs("forearm")}>
        <title>{REGION_LABELS.forearm}</title>
        <path {...shape("forearm")} d="M40 199 C32 219 25 247 25 271 C31 282 43 280 49 264 C56 242 61 216 58 199 Z" />
        <path {...shape("forearm")} d="M260 199 C268 219 275 247 275 271 C269 282 257 280 251 264 C244 242 239 216 242 199 Z" />
      </g>

      <g {...attrs("abs")}>
        <title>{REGION_LABELS.abs}</title>
        <path {...shape("abs")} d="M125 160 C133 156 142 157 148 164 L147 190 C140 194 132 194 125 188 Z" />
        <path {...shape("abs")} d="M152 164 C158 157 167 156 175 160 L175 188 C168 194 160 194 153 190 Z" />
        <path {...shape("abs")} d="M125 195 C132 191 141 191 148 197 L148 224 C141 229 132 228 125 222 Z" />
        <path {...shape("abs")} d="M152 197 C159 191 168 191 175 195 L175 222 C168 228 159 229 152 224 Z" />
        <path {...shape("abs")} d="M128 229 C134 226 142 227 148 232 L148 261 C142 267 134 266 128 259 Z" />
        <path {...shape("abs")} d="M152 232 C158 227 166 226 172 229 L172 259 C166 266 158 267 152 261 Z" />
        <path {...shape("abs")} d="M106 154 C116 171 121 196 121 229 C121 249 117 268 110 283 C100 252 96 194 106 154 Z" />
        <path {...shape("abs")} d="M194 154 C184 171 179 196 179 229 C179 249 183 268 190 283 C200 252 204 194 194 154 Z" />
      </g>

      <g {...attrs("quads")}>
        <title>{REGION_LABELS.quads}</title>
        <path {...shape("quads")} d="M94 303 C84 325 82 362 89 396 C94 419 105 430 116 419 C127 394 132 352 127 319 C119 309 105 303 94 303 Z" />
        <path {...shape("quads")} d="M206 303 C216 325 218 362 211 396 C206 419 195 430 184 419 C173 394 168 352 173 319 C181 309 195 303 206 303 Z" />
        <path {...shape("quads")} d="M119 309 C127 325 130 355 126 386 C123 407 118 421 110 429 C109 386 110 341 119 309 Z" />
        <path {...shape("quads")} d="M181 309 C173 325 170 355 174 386 C177 407 182 421 190 429 C191 386 190 341 181 309 Z" />
      </g>

      <g {...attrs("adductors")}>
        <title>{REGION_LABELS.adductors}</title>
        <path {...shape("adductors")} d="M132 306 C141 320 145 344 144 371 C141 389 134 405 125 417 C126 376 124 334 132 306 Z" />
        <path {...shape("adductors")} d="M168 306 C159 320 155 344 156 371 C159 389 166 405 175 417 C174 376 176 334 168 306 Z" />
      </g>

      <g {...attrs("calves")}>
        <title>{REGION_LABELS.calves}</title>
        <path {...shape("calves")} d="M107 394 C94 422 87 467 87 504 C94 514 106 512 112 494 C122 456 121 419 113 397 Z" />
        <path {...shape("calves")} d="M193 394 C206 422 213 467 213 504 C206 514 194 512 188 494 C178 456 179 419 187 397 Z" />
      </g>
    </g>
  );
}

function BackRegions({ attrs, shape }: RegionRenderProps) {
  return (
    <g>
      <g {...attrs("shoulders")}>
        <title>{REGION_LABELS.shoulders}</title>
        <path {...shape("shoulders")} d="M82 101 C68 104 57 115 53 132 C55 145 67 153 83 154 C94 143 99 122 93 109 C90 104 87 102 82 101 Z" />
        <path {...shape("shoulders")} d="M218 101 C232 104 243 115 247 132 C245 145 233 153 217 154 C206 143 201 122 207 109 C210 104 213 102 218 101 Z" />
      </g>

      <g {...attrs("trapezius")}>
        <title>{REGION_LABELS.trapezius}</title>
        <path {...shape("trapezius")} d="M129 75 C137 94 144 108 150 119 C156 108 163 94 171 75 C176 99 187 116 203 131 C183 136 166 131 150 119 C134 131 117 136 97 131 C113 116 124 99 129 75 Z" />
        <path {...shape("trapezius")} d="M119 123 C132 134 142 146 150 164 C158 146 168 134 181 123 C177 151 166 175 150 190 C134 175 123 151 119 123 Z" />
      </g>

      <g {...attrs("back")}>
        <title>{REGION_LABELS.back}</title>
        <path {...shape("back")} d="M95 128 C116 136 136 153 145 177 C141 211 132 248 119 279 C101 265 89 237 87 203 C85 171 88 146 95 128 Z" />
        <path {...shape("back")} d="M205 128 C184 136 164 153 155 177 C159 211 168 248 181 279 C199 265 211 237 213 203 C215 171 212 146 205 128 Z" />
      </g>

      <g {...attrs("triceps")}>
        <title>{REGION_LABELS.triceps}</title>
        <path {...shape("triceps")} d="M57 135 C48 150 42 172 40 202 C48 207 58 202 64 185 C70 164 69 146 57 135 Z" />
        <path {...shape("triceps")} d="M243 135 C252 150 258 172 260 202 C252 207 242 202 236 185 C230 164 231 146 243 135 Z" />
      </g>

      <g {...attrs("forearm")}>
        <title>{REGION_LABELS.forearm}</title>
        <path {...shape("forearm")} d="M40 199 C32 220 25 247 25 271 C31 282 43 280 49 264 C56 242 61 216 58 199 Z" />
        <path {...shape("forearm")} d="M260 199 C268 220 275 247 275 271 C269 282 257 280 251 264 C244 242 239 216 242 199 Z" />
      </g>

      <g {...attrs("lower_back")}>
        <title>{REGION_LABELS.lower_back}</title>
        <path {...shape("lower_back")} d="M119 268 C131 280 141 286 150 288 C159 286 169 280 181 268 L187 304 C176 319 163 327 150 329 C137 327 124 319 113 304 Z" />
      </g>

      <g {...attrs("glutes")}>
        <title>{REGION_LABELS.glutes}</title>
        <path {...shape("glutes")} d="M115 307 C129 300 143 306 150 323 C145 347 132 364 112 367 C102 349 101 321 115 307 Z" />
        <path {...shape("glutes")} d="M185 307 C171 300 157 306 150 323 C155 347 168 364 188 367 C198 349 199 321 185 307 Z" />
      </g>

      <g {...attrs("hamstrings")}>
        <title>{REGION_LABELS.hamstrings}</title>
        <path {...shape("hamstrings")} d="M111 360 C99 389 97 421 111 442 C126 418 132 386 127 354 C121 353 116 355 111 360 Z" />
        <path {...shape("hamstrings")} d="M189 360 C201 389 203 421 189 442 C174 418 168 386 173 354 C179 353 184 355 189 360 Z" />
      </g>

      <g {...attrs("calves")}>
        <title>{REGION_LABELS.calves}</title>
        <path {...shape("calves")} d="M108 397 C94 424 88 468 88 504 C95 514 108 512 114 492 C123 452 121 421 113 399 Z" />
        <path {...shape("calves")} d="M192 397 C206 424 212 468 212 504 C205 514 192 512 186 492 C177 452 179 421 187 399 Z" />
      </g>
    </g>
  );
}
