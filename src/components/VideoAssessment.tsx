// ============================================================================
// VideoAssessment — Avaliação funcional de vídeo (manual, sem IA)
//   Fluxo 100% no navegador:
//     1) treinador escolhe um protocolo (define os rótulos das vistas)
//     2) envia um vídeo local (MP4) — o vídeo NÃO é armazenado
//     3) o navegador extrai 8 quadros automaticamente (canvas)
//     4) o treinador revisa cada quadro: ajusta o rótulo, reposiciona o
//        tempo, recaptura e adiciona compensações (gravidade + descrição)
//     5) salvar: cria functional_assessments (source='video'), envia os
//        JPEGs para o bucket assessment-frames e grava assessment_frames
// ============================================================================
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Upload, Film, Save, Plus, X, Play, Camera, Maximize2, AlertCircle, FileDown, PencilLine,
} from "lucide-react";
import { toast } from "sonner";
import { downloadAssessmentPdf } from "@/lib/assessment/pdf";
import FrameAnnotator, { type Annotation } from "@/components/assessment/FrameAnnotator";

type Gravidade = "Leve" | "Moderada" | "Severa";
interface Finding { gravidade: Gravidade; descricao: string; }
interface Frame {
  index: number;
  vista: string;
  time: number;
  dataUrl: string;          // imagem exibida (com marcações, se houver)
  originalDataUrl: string;  // imagem original sem marcações (para reeditar)
  annotations: Annotation[];
  findings: Finding[];
  dark?: boolean;           // quadro ficou escuro → sugerir recaptura
}

type ProtocolKey = "posture_ohs" | "bn_sequence" | "free";

const PROTOCOLS: Record<ProtocolKey, { label: string; vistas: string[]; fractions: number[] }> = {
  posture_ohs: {
    label: "Postura + OHS",
    vistas: [
      "Vista Anterior", "Vista Lateral D", "Vista Posterior", "Vista Lateral E",
      "Vista Anterior OHS", "Vista Lateral OHS 1", "Vista Posterior OHS", "Vista Lateral OHS 2",
    ],
    fractions: [0.05, 0.17, 0.29, 0.41, 0.53, 0.65, 0.77, 0.89],
  },
  bn_sequence: {
    label: "Sequência BN",
    vistas: [
      "Postura inicial", "Air Squat", "Toe Touch", "Lunge alternado",
      "Shoulder Flexion", "Marcha estacionária", "Equilíbrio unipodal D", "Equilíbrio unipodal E",
    ],
    fractions: [0.12, 0.25, 0.38, 0.50, 0.62, 0.74, 0.86, 0.94],
  },
  free: {
    label: "Livre",
    vistas: ["Corte 1", "Corte 2", "Corte 3", "Corte 4", "Corte 5", "Corte 6", "Corte 7", "Corte 8"],
    fractions: [0.12, 0.22, 0.34, 0.46, 0.58, 0.70, 0.82, 0.92],
  },
};

const ALL_VISTAS = Array.from(
  new Set(Object.values(PROTOCOLS).flatMap(p => p.vistas)),
);

const GRAVIDADES: Gravidade[] = ["Leve", "Moderada", "Severa"];
const GRAVIDADE_STYLE: Record<Gravidade, string> = {
  Leve: "bg-muted text-foreground",
  Moderada: "bg-primary/15 text-primary",
  Severa: "bg-destructive/15 text-destructive",
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

interface Props {
  studentId: string;
  companyId: string;
  studentName?: string;
  context?: {
    queixa_principal?: string;
    historico_lesoes?: string;
    modalidade?: string;
    nivel?: string;
  };
  onSaved?: (assessmentId: string) => void;
}

export default function VideoAssessment({ studentId, companyId, studentName, context, onSaved }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [protocol, setProtocol] = useState<ProtocolKey>("bn_sequence");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [hasVideo, setHasVideo] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState<number | null>(null);

  // Limite de brilho abaixo do qual consideramos o quadro "escuro/vazio".
  const DARK_THRESHOLD = 14;

  // ---- Espera o vídeo estar pronto para decodificar quadros --------------
  function waitReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const v = videoRef.current;
      if (!v) return reject(new Error("Vídeo indisponível."));
      v.muted = true;
      if (v.readyState >= 2 && v.duration && isFinite(v.duration)) return resolve();
      const to = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 8000);
      const ok = () => {
        if (v.readyState >= 2 && v.duration && isFinite(v.duration)) { cleanup(); resolve(); }
      };
      const cleanup = () => {
        clearTimeout(to);
        v.removeEventListener("loadeddata", ok);
        v.removeEventListener("canplay", ok);
        v.removeEventListener("loadedmetadata", ok);
      };
      v.addEventListener("loadeddata", ok);
      v.addEventListener("canplay", ok);
      v.addEventListener("loadedmetadata", ok);
    });
  }

  // ---- Captura de um quadro no tempo `t` --------------------------------
  // Aguarda o quadro estar realmente decodificado (requestVideoFrameCallback
  // quando disponível) e usa timeout para não travar em codecs problemáticos.
  function seekTo(t: number): Promise<void> {
    return new Promise((resolve) => {
      const v = videoRef.current!;
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        clearTimeout(to);
        v.removeEventListener("seeked", onSeeked);
        resolve();
      };
      // rVFC garante que há um frame pintado; fallback: seeked + atraso.
      const rvfc = (v as any).requestVideoFrameCallback?.bind(v);
      const onSeeked = () => {
        if (rvfc) rvfc(() => setTimeout(finish, 30));
        else setTimeout(finish, 120);
      };
      const to = setTimeout(finish, 3000); // não trava se seeked não vier
      v.addEventListener("seeked", onSeeked);
      v.currentTime = Math.max(0, Math.min(t, (v.duration || 0) - 0.05));
    });
  }

  function grab(): { dataUrl: string; brightness: number } {
    const v = videoRef.current!;
    const canvas = canvasRef.current!;
    const maxW = 720;
    const scale = v.videoWidth > maxW ? maxW / v.videoWidth : 1;
    canvas.width = Math.round(v.videoWidth * scale) || maxW;
    canvas.height = Math.round(v.videoHeight * scale) || Math.round(maxW * 0.56);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    // brilho médio amostrado
    let brightness = 255;
    try {
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0; const step = 40;
      for (let i = 0; i < sample.data.length; i += 4 * step) {
        sum += (sample.data[i] + sample.data[i + 1] + sample.data[i + 2]) / 3;
      }
      brightness = sum / (sample.data.length / (4 * step));
    } catch { /* CORS-safe local video, should not throw */ }
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), brightness };
  }

  async function captureAt(t: number): Promise<{ dataUrl: string; time: number; dark: boolean }> {
    const v = videoRef.current!;
    const dur = v.duration || 0;
    let time = t;
    let best: { dataUrl: string; brightness: number; time: number } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      await seekTo(time);
      const { dataUrl, brightness } = grab();
      if (!best || brightness > best.brightness) best = { dataUrl, brightness, time: v.currentTime };
      if (brightness > DARK_THRESHOLD) return { dataUrl, time: v.currentTime, dark: false };
      // quadro escuro/preto (fade, transição) → tenta um pouco adiante e atrás
      time = attempt % 2 === 0 ? t + 0.4 * (attempt + 1) : t - 0.3 * attempt;
      if (time < 0 || time > dur) time = Math.min(dur - 0.05, Math.max(0, t + 0.4 * (attempt + 1)));
    }
    return { dataUrl: best!.dataUrl, time: best!.time, dark: best!.brightness <= DARK_THRESHOLD };
  }

  async function handleVideo(file?: File) {
    if (!file) return;
    setError("");
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setHasVideo(true);
    setFrames([]);
  }

  async function extractFrames() {
    const v = videoRef.current;
    if (!v) { setError("Vídeo indisponível. Recarregue e tente novamente."); return; }
    setExtracting(true);
    setError("");
    try {
      try {
        await waitReady();
      } catch {
        setError("Não foi possível ler o vídeo (duração/codec). Tente converter para MP4 (H.264) e reenviar.");
        setExtracting(false);
        return;
      }
      const { vistas } = PROTOCOLS[protocol];
      const n = vistas.length;
      // Cortes em intervalos de segundos IGUAIS: ponto médio de cada um dos
      // n segmentos de duração igual → tempos uniformemente espaçados.
      const out: Frame[] = [];
      let darkCount = 0;
      for (let i = 0; i < n; i++) {
        const fraction = (i + 0.5) / n;
        try {
          const { dataUrl, time, dark } = await captureAt(fraction * v.duration);
          if (dark) darkCount++;
          out.push({ index: i, vista: vistas[i], time, dataUrl, originalDataUrl: dataUrl, annotations: [], findings: [], dark });
        } catch {
          // falha isolada num corte → registra placeholder p/ recaptura manual
          const t = fraction * v.duration;
          out.push({ index: i, vista: vistas[i], time: t, dataUrl: "", originalDataUrl: "", annotations: [], findings: [], dark: true });
          darkCount++;
        }
      }
      setFrames(out);
      if (darkCount > 0) {
        setError(`${darkCount} quadro(s) ficaram escuros ou falharam. Use −0,5s / +0,5s ou "Usar vídeo" para recapturar.`);
      }
    } catch {
      setError("Erro ao extrair os quadros do vídeo. Tente reenviar em MP4 (H.264).");
    }
    setExtracting(false);
  }

  // ---- Edição de quadros -------------------------------------------------
  function patchFrame(index: number, patch: Partial<Frame>) {
    setFrames(prev => prev.map(f => (f.index === index ? { ...f, ...patch } : f)));
  }

  async function recapture(index: number, delta: number | "current") {
    const v = videoRef.current;
    if (!v) return;
    const f = frames.find(x => x.index === index)!;
    const t = delta === "current" ? v.currentTime : f.time + delta;
    const { dataUrl, time, dark } = await captureAt(t);
    // recaptura substitui a imagem base e descarta marcações antigas
    patchFrame(index, { dataUrl, originalDataUrl: dataUrl, annotations: [], time, dark });
  }

  function applyAnnotations(index: number, dataUrl: string, annotations: Annotation[]) {
    patchFrame(index, { dataUrl, annotations });
    setAnnotating(null);
  }

  function seekPreview(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    v.pause();
  }

  function addFinding(index: number) {
    const f = frames.find(x => x.index === index)!;
    patchFrame(index, { findings: [...f.findings, { gravidade: "Moderada", descricao: "" }] });
  }
  function patchFinding(index: number, fi: number, patch: Partial<Finding>) {
    const f = frames.find(x => x.index === index)!;
    patchFrame(index, { findings: f.findings.map((x, i) => (i === fi ? { ...x, ...patch } : x)) });
  }
  function removeFinding(index: number, fi: number) {
    const f = frames.find(x => x.index === index)!;
    patchFrame(index, { findings: f.findings.filter((_, i) => i !== fi) });
  }

  const totalCompensacoes = frames.reduce((s, f) => s + f.findings.length, 0);

  // ---- Salvar ------------------------------------------------------------
  async function save() {
    const usable = frames.filter(f => f.dataUrl);
    if (usable.length === 0) { setError("Nenhum quadro válido para salvar. Recapture os quadros com falha."); return; }
    setSaving(true); setError("");
    try {
      const assessment_json = {
        vistas: usable.map(f => ({
          vista: f.vista,
          time: Number(f.time.toFixed(2)),
          compensacoes: f.findings,
          annotations: f.annotations,
        })),
        protocol_hint: protocol,
        expected_movements: PROTOCOLS[protocol].vistas,
        total_compensacoes: totalCompensacoes,
      };
      const report_text = usable
        .map(f => {
          const comps = f.findings.length
            ? f.findings.map(c => `  • [${c.gravidade}] ${c.descricao || "—"}`).join("\n")
            : "  • Sem compensações registradas";
          return `${f.vista} (${f.time.toFixed(1)}s)\n${comps}`;
        })
        .join("\n\n");

      const { data: inserted, error: e1 } = await supabase
        .from("functional_assessments")
        .insert({
          student_id: studentId,
          company_id: companyId,
          source: "video",
          status: "completed",
          queixa_principal: context?.queixa_principal || null,
          historico_lesoes: context?.historico_lesoes || null,
          modalidade: context?.modalidade || null,
          nivel: context?.nivel || null,
          report_text,
          assessment_json: assessment_json as unknown as Json,
        })
        .select("id")
        .single();
      if (e1 || !inserted) throw new Error(e1?.message || "Falha ao criar avaliação.");
      const assessmentId = inserted.id;

      // upload dos quadros + inserção das linhas
      const rows: any[] = [];
      for (const f of frames) {
        const path = `${companyId}/${assessmentId}/frame_${f.index}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("assessment-frames")
          .upload(path, dataUrlToBlob(f.dataUrl), { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(`Falha ao enviar o quadro ${f.index + 1}: ${upErr.message}`);
        rows.push({
          assessment_id: assessmentId,
          company_id: companyId,
          frame_index: f.index,
          vista: f.vista,
          image_url: path,
          ai_findings: null,
          trainer_findings: f.findings,
          edited: true,
        });
      }
      const { error: e2 } = await supabase.from("assessment_frames").insert(rows);
      if (e2) throw new Error(e2.message);

      toast.success("Avaliação funcional de vídeo salva.");
      onSaved?.(assessmentId);
      // reset
      setFrames([]);
      setHasVideo(false);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl("");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar a avaliação.");
      toast.error(err.message || "Erro ao salvar.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <canvas ref={canvasRef} className="hidden" />

      {/* Protocolo + vídeo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vídeo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Envie um vídeo local do aluno. O app extrai 8 quadros automaticamente para você revisar — o vídeo não é armazenado.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Protocolo</Label>
              <Select value={protocol} onValueChange={(v) => setProtocol(v as ProtocolKey)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROTOCOLS) as ProtocolKey[]).map(k => (
                    <SelectItem key={k} value={k}>{PROTOCOLS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Arquivo de vídeo</Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="h-4 w-4" />
                {hasVideo ? "Trocar vídeo" : "Selecionar vídeo…"}
                <input type="file" accept="video/*" className="hidden"
                  onChange={e => handleVideo(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          {hasVideo && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                preload="auto"
                className="w-full max-h-[320px] rounded-lg border border-line bg-ink/5"
              />
              <Button onClick={extractFrames} disabled={extracting} className="w-full">
                {extracting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extraindo quadros…</>
                  : <><Film className="mr-2 h-4 w-4" /> Extrair 8 quadros</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {/* Grade de quadros */}
      {frames.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              {frames.length} cortes · {totalCompensacoes} compensações
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {frames.map(f => (
              <Card key={f.index}>
                <CardContent className="p-3 space-y-3">
                  <div className="relative">
                    {f.dataUrl ? (
                      <>
                        <img src={f.dataUrl} alt={f.vista}
                          className="w-full aspect-video object-cover rounded-md border border-line bg-ink/5" />
                        <button type="button" onClick={() => setZoom(f.dataUrl)}
                          className="absolute top-1.5 right-1.5 bg-ink/70 text-paper rounded-md p-1">
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full aspect-video rounded-md border border-dashed border-destructive/50 bg-ink/5 flex items-center justify-center text-xs text-destructive text-center px-3">
                        Falha ao capturar este quadro. Ajuste o vídeo e use "Usar vídeo".
                      </div>
                    )}
                    {f.dark && f.dataUrl && (
                      <span className="absolute top-1.5 left-1.5 bg-destructive/80 text-paper text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> escuro
                      </span>
                    )}
                    {f.annotations.length > 0 && (
                      <span className="absolute bottom-1.5 right-1.5 bg-navy text-paper text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <PencilLine className="h-3 w-3" /> {f.annotations.length}
                      </span>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 bg-ink/70 text-paper text-[10px] font-mono px-1.5 py-0.5 rounded">
                      {f.time.toFixed(1)}s
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Vista / movimento</Label>
                    <Select value={f.vista} onValueChange={(v) => patchFrame(f.index, { vista: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_VISTAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => seekPreview(f.time)}>
                      <Play className="h-3 w-3 mr-1" /> Ver
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => recapture(f.index, -0.5)}>
                      −0,5s
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => recapture(f.index, 0.5)}>
                      +0,5s
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => recapture(f.index, "current")}>
                      <Camera className="h-3 w-3 mr-1" /> Usar vídeo
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!f.originalDataUrl}
                      onClick={() => setAnnotating(f.index)}>
                      <PencilLine className="h-3 w-3 mr-1" /> Marcar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Compensações</Label>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => addFinding(f.index)}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                    {f.findings.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhuma compensação registrada.</p>
                    )}
                    {f.findings.map((c, fi) => (
                      <div key={fi} className="flex items-start gap-1.5">
                        <Select value={c.gravidade} onValueChange={(v) => patchFinding(f.index, fi, { gravidade: v as Gravidade })}>
                          <SelectTrigger className={`h-8 w-[110px] text-xs ${GRAVIDADE_STYLE[c.gravidade]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRAVIDADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          className="h-8 text-sm flex-1"
                          placeholder="Ex: valgo de joelho bilateral"
                          value={c.descricao}
                          onChange={e => patchFinding(f.index, fi, { descricao: e.target.value })}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                          onClick={() => removeFinding(f.index, fi)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="sm:flex-1"
              onClick={() =>
                downloadAssessmentPdf(
                  {
                    frames: frames.map(f => ({
                      vista: f.vista,
                      time: f.time,
                      dataUrl: f.dataUrl,
                      findings: f.findings,
                    })),
                  },
                  { studentName: studentName || "aluno", source: "video" },
                )
              }
            >
              <FileDown className="mr-2 h-4 w-4" /> Baixar laudo (PDF)
            </Button>
            <Button className="sm:flex-1" onClick={save} disabled={saving}>
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</>
                : <><Save className="mr-2 h-4 w-4" /> Salvar avaliação funcional</>}
            </Button>
          </div>
        </>
      )}

      {/* Zoom */}
      {zoom && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-6" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Quadro ampliado" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
