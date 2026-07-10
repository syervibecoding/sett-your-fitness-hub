// ============================================================================
// FrameAnnotator — editor de marcações sobre um quadro da avaliação de vídeo.
//   Ferramentas: linha reta, círculo/elipse, seta e ângulo (3 pontos).
//   As marcações são guardadas como vetores normalizados (0..1) para reedição
//   e compostas na imagem original (JPEG) ao aplicar — aparecem no app e PDF.
// ============================================================================
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Circle, ArrowUpRight, Triangle, Undo2, Trash2, Check } from "lucide-react";

export type AnnotationTool = "line" | "ellipse" | "arrow" | "angle";
export interface Point { x: number; y: number } // normalizado 0..1
export interface Annotation {
  tool: AnnotationTool;
  color: string;
  points: Point[];
}

const COLORS: { key: string; value: string; label: string }[] = [
  { key: "navy", value: "#1D2D5C", label: "Navy" },
  { key: "red", value: "#B92828", label: "Vermelho" },
  { key: "amber", value: "#BE7814", label: "Âmbar" },
  { key: "white", value: "#FAFAF7", label: "Branco" },
];

const TOOLS: { key: AnnotationTool; icon: any; label: string; hint: string }[] = [
  { key: "line", icon: Minus, label: "Linha", hint: "Arraste para traçar" },
  { key: "ellipse", icon: Circle, label: "Círculo", hint: "Arraste para desenhar" },
  { key: "arrow", icon: ArrowUpRight, label: "Seta", hint: "Arraste na direção" },
  { key: "angle", icon: Triangle, label: "Ângulo", hint: "3 cliques: ponta, vértice, ponta" },
];

interface Props {
  open: boolean;
  imageUrl: string;
  initial?: Annotation[];
  onApply: (dataUrl: string, annotations: Annotation[]) => void;
  onClose: () => void;
}

function angleDeg(a: Point, v: Point, b: Point): number {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x);
  const a2 = Math.atan2(b.y - v.y, b.x - v.x);
  let d = Math.abs((a1 - a2) * 180) / Math.PI;
  if (d > 180) d = 360 - d;
  return Math.round(d);
}

/** Desenha uma anotação num contexto 2D, escalando pontos normalizados. */
function drawAnnotation(
  ctx: CanvasRenderingContext2D, ann: Annotation, W: number, H: number, lw: number,
) {
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const P = ann.points.map(p => ({ x: p.x * W, y: p.y * H }));
  if (ann.tool === "line" && P.length >= 2) {
    ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[1].x, P[1].y); ctx.stroke();
  } else if (ann.tool === "ellipse" && P.length >= 2) {
    const cx = (P[0].x + P[1].x) / 2, cy = (P[0].y + P[1].y) / 2;
    const rx = Math.abs(P[1].x - P[0].x) / 2, ry = Math.abs(P[1].y - P[0].y) / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (ann.tool === "arrow" && P.length >= 2) {
    const [s, e] = P;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    const ang = Math.atan2(e.y - s.y, e.x - s.x);
    const head = lw * 4;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - head * Math.cos(ang - Math.PI / 6), e.y - head * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(e.x - head * Math.cos(ang + Math.PI / 6), e.y - head * Math.sin(ang + Math.PI / 6));
    ctx.closePath(); ctx.fill();
  } else if (ann.tool === "angle" && P.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(P[0].x, P[0].y);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
    ctx.stroke();
    if (P.length === 3) {
      const deg = angleDeg(ann.points[0], ann.points[1], ann.points[2]);
      const label = `${deg}°`;
      ctx.font = `bold ${lw * 6}px sans-serif`;
      const tx = P[1].x + lw * 3, ty = P[1].y - lw * 3;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(10,10,10,0.7)";
      ctx.fillRect(tx - lw, ty - lw * 6, tw + lw * 2, lw * 8);
      ctx.fillStyle = ann.color;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(label, tx, ty);
    }
  }
}

export default function FrameAnnotator({ open, imageUrl, initial, onApply, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<AnnotationTool>("line");
  const [color, setColor] = useState<string>("#B92828");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [ready, setReady] = useState(false);

  // Carrega imagem base ao abrir
  useEffect(() => {
    if (!open) return;
    setAnnotations(initial ? initial.map(a => ({ ...a, points: [...a.points] })) : []);
    setDraft(null);
    setReady(false);
    const img = new Image();
    img.onload = () => { imgRef.current = img; setReady(true); };
    img.src = imageUrl;
  }, [open, imageUrl, initial]);

  const render = useCallback(() => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const lw = Math.max(2, canvas.width / 260);
    [...annotations, ...(draft ? [draft] : [])].forEach(a => drawAnnotation(ctx, a, canvas.width, canvas.height, lw));
  }, [annotations, draft]);

  // Dimensiona o canvas de exibição quando a imagem estiver pronta
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current, img = imgRef.current;
    if (!canvas || !img) return;
    const maxW = 760;
    const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    render();
  }, [ready, render]);

  useEffect(() => { render(); }, [render]);

  function posFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = posFromEvent(e);
    if (tool === "angle") {
      // ângulo por cliques sucessivos
      if (!draft || draft.tool !== "angle") {
        setDraft({ tool: "angle", color, points: [p] });
      } else {
        const pts = [...draft.points, p];
        if (pts.length >= 3) { setAnnotations(a => [...a, { tool: "angle", color, points: pts.slice(0, 3) }]); setDraft(null); }
        else setDraft({ tool: "angle", color, points: pts });
      }
      return;
    }
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setDraft({ tool, color, points: [p, p] });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    if (draft.tool === "angle") return; // ângulo não usa arraste
    if (draft.points.length < 2) return;
    const p = posFromEvent(e);
    setDraft({ ...draft, points: [draft.points[0], p] });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft || draft.tool === "angle") return;
    const p = posFromEvent(e);
    const [s] = draft.points;
    const dist = Math.hypot(p.x - s.x, p.y - s.y);
    if (dist > 0.01) setAnnotations(a => [...a, { ...draft, points: [s, p] }]);
    setDraft(null);
  }

  function undo() {
    if (draft) { setDraft(null); return; }
    setAnnotations(a => a.slice(0, -1));
  }
  function clearAll() { setAnnotations([]); setDraft(null); }

  function apply() {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = img.naturalWidth;
    out.height = img.naturalHeight;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(img, 0, 0, out.width, out.height);
    const lw = Math.max(2, out.width / 260);
    annotations.forEach(a => drawAnnotation(ctx, a, out.width, out.height, lw));
    onApply(out.toDataURL("image/jpeg", 0.9), annotations);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Marcar quadro</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {TOOLS.map(t => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={tool === t.key ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => { setTool(t.key); setDraft(null); }}
            >
              <t.icon className="h-3.5 w-3.5 mr-1" /> {t.label}
            </Button>
          ))}
          <div className="mx-1 h-5 w-px bg-line" />
          {COLORS.map(c => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              onClick={() => setColor(c.value)}
              className={`h-6 w-6 rounded-full border-2 ${color === c.value ? "border-navy ring-2 ring-navy/30" : "border-line"}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <div className="mx-1 h-5 w-px bg-line" />
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={undo}>
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Desfazer
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={clearAll}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {TOOLS.find(t => t.key === tool)?.hint}
        </p>

        <div className="flex justify-center bg-ink/5 rounded-lg p-2 overflow-auto">
          <canvas
            ref={canvasRef}
            className="max-w-full rounded touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={apply}>
            <Check className="h-4 w-4 mr-1" /> Aplicar marcações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
