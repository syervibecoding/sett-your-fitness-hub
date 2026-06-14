// ============================================================================
// VideoAssessment.tsx — BN Performance Training
// Feature 2: upload de vídeo → extrai frames → IA analisa → treinador edita
// Funciona em browser real (Lovable). Cole em: src/components/VideoAssessment.tsx
//
// Props: studentId, companyId, onComplete(assessmentId)
// ============================================================================
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Loader2, Video, Camera, Plus, X, Save, Sparkles, RefreshCw, SkipBack, SkipForward, Eye, Maximize2 } from "lucide-react";
import { BnitoContextButton } from "@/components/BnitoFloatingAssistant";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/studioUi";

type JsonObject = { [key: string]: Json | undefined };

interface SupabaseErrorLike {
  message: string;
}

interface FunctionalAssessmentInsert {
  student_id: string;
  company_id: string;
  queixa_principal: string | null;
  historico_lesoes: string | null;
  modalidade: string | null;
  nivel: string | null;
  report_text: string;
  assessment_json: JsonObject;
  status: string;
  source: string;
}

interface AssessmentFrameInsert {
  assessment_id: string;
  company_id: string;
  frame_index: number;
  vista: string;
  image_url: string;
  ai_findings: Finding[] | null;
  trainer_findings: Finding[];
  edited: boolean;
}

interface VideoDbClient {
  storage: {
    from(bucket: string): {
      upload(path: string, file: Blob, options?: { upsert?: boolean }): Promise<{ error: SupabaseErrorLike | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
  from(table: "functional_assessments"): {
    insert(row: FunctionalAssessmentInsert): {
      select(columns: string): {
        single(): Promise<{ data: { id: string } | null; error: SupabaseErrorLike | null }>;
      };
    };
  };
  from(table: "assessment_frames"): {
    insert(row: AssessmentFrameInsert): Promise<{ error: SupabaseErrorLike | null }>;
  };
}

const videoDb = supabase as unknown as VideoDbClient;

const POSTURE_OHS_VISTAS = [
  "Vista Anterior",
  "Vista Lateral D",
  "Vista Posterior",
  "Vista Lateral E",
  "Vista Anterior OHS",
  "Vista Lateral OHS 1",
  "Vista Posterior OHS",
  "Vista Lateral OHS 2",
];
const BN_SEQUENCE_VISTAS = [
  "Postura inicial",
  "Air Squat",
  "Toe Touch",
  "Lunge alternado",
  "Shoulder Flexion",
  "Marcha estacionaria",
  "Equilibrio unipodal D",
  "Equilibrio unipodal E",
];
const FREE_VISTAS = [
  "Corte 1",
  "Corte 2",
  "Corte 3",
  "Corte 4",
  "Corte 5",
  "Corte 6",
  "Corte 7",
  "Corte 8",
];
const PROTOCOL_PRESETS = {
  posture_ohs: {
    label: "Postura + OHS",
    hint: "postura_ohs",
    description: "Frente, laterais, costas e agachamento/OHS.",
    vistas: POSTURE_OHS_VISTAS,
    fractions: [0.05, 0.17, 0.29, 0.41, 0.53, 0.65, 0.77, 0.89],
  },
  bn_sequence: {
    label: "Sequência BN",
    hint: "sequencia_bn_oficial",
    description: "Air squat, toe touch, lunge, ombro, marcha e equilíbrio.",
    vistas: BN_SEQUENCE_VISTAS,
    fractions: [0.12, 0.25, 0.38, 0.50, 0.62, 0.74, 0.86, 0.94],
  },
  free: {
    label: "Livre",
    hint: "video_livre",
    description: "Cortes sem rótulo técnico para editar manualmente.",
    vistas: FREE_VISTAS,
    fractions: [0.12, 0.22, 0.34, 0.46, 0.58, 0.70, 0.82, 0.92],
  },
} as const;
type AutoProtocol = keyof typeof PROTOCOL_PRESETS;
const VISTAS = Array.from(new Set([
  ...POSTURE_OHS_VISTAS,
  ...BN_SEQUENCE_VISTAS,
  ...FREE_VISTAS,
  "Lunge D",
  "Lunge E",
  "Extra",
]));
const GRAVIDADES = ["Leve", "Moderada", "Severa"];
const FRAME_NUDGE_SECONDS = 1;

interface Finding {
  gravidade: string;
  descricao: string;
}

interface Frame {
  id: string;
  time: number;
  preview: string;   // dataURL para exibir
  blob: Blob;        // para upload
  vista: string;
  findings: Finding[];
  aiAnalyzed: boolean;
}

interface AssessmentContext {
  studentName?: string;
  queixa_principal?: string;
  historico_lesoes?: string;
  modalidade?: string;
  nivel?: string;
  peso_kg?: string;
  altura_cm?: string;
  cintura_cm?: string;
  percentual_gordura?: string;
  perimetros?: string;
  observacoes_tecnicas?: string;
}

interface VideoAssessmentResult {
  id: string;
  report_text: string;
  assessment_json: JsonObject;
  frame_findings?: AiFrameFinding[];
}

type AiFindingInput = Partial<Finding> | string;

interface AiFrameFinding {
  frameId?: string;
  findings?: AiFindingInput[];
}

interface AiFunctionalAssessmentResponse {
  error?: string;
  assessment_json?: JsonObject | null;
  report_text?: string | null;
  frame_findings?: AiFrameFinding[];
}

export default function VideoAssessment({ studentId, companyId, assessmentContext, onComplete, initialVideoUrl, onInitialVideoConsumed }: {
  studentId: string;
  companyId: string;
  assessmentContext?: AssessmentContext;
  onComplete?: (id: string, result?: VideoAssessmentResult) => void;
  // Vídeo vindo do WhatsApp (handshake do chat → Studio): carrega e extrai frames automaticamente.
  initialVideoUrl?: string | null;
  onInitialVideoConsumed?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [extracting, setExtracting]   = useState(false);
  const [progress, setProgress]       = useState(0);
  const [frames, setFrames]           = useState<Frame[]>([]);
  const [analyzing, setAnalyzing]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [aiAnalysis, setAiAnalysis]   = useState<JsonObject | null>(null); // laudo estruturado da IA (alimenta as prescritoras)
  const [aiReportText, setAiReportText] = useState("");
  const [aiFrameFindings, setAiFrameFindings] = useState<AiFrameFinding[]>([]);
  const [autoProtocol, setAutoProtocol] = useState<AutoProtocol>("posture_ohs");
  const [previewFrame, setPreviewFrame] = useState<Frame | null>(null);
  const activeProtocol = PROTOCOL_PRESETS[autoProtocol];

  // ── Extrai frame do vídeo no tempo atual ────────────────────────────────
  function captureFrame(video: HTMLVideoElement): Promise<{ preview: string; blob: Blob; mostlyBlack: boolean }> {
    return new Promise((resolve) => {
      const maxW = 720;
      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 1280;
      const scale = Math.min(1, maxW / vw);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const mostlyBlack = isMostlyBlack(ctx, canvas.width, canvas.height);
      const preview = canvas.toDataURL("image/jpeg", 0.5);
      canvas.toBlob((blob) => resolve({ preview, blob: blob!, mostlyBlack }), "image/jpeg", 0.85);
    });
  }

  async function waitForPaintedVideoFrame(video: HTMLVideoElement): Promise<void> {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const timer = window.setTimeout(done, 250);
      const finish = () => { window.clearTimeout(timer); done(); };
      const requestFrame = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: VideoFrameRequestCallback) => number }).requestVideoFrameCallback;
      if (requestFrame) requestFrame.call(video, () => finish());
      else requestAnimationFrame(() => requestAnimationFrame(finish));
    });
  }

  async function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 3000);
      const onSeeked = () => { clearTimeout(timer); video.removeEventListener("seeked", onSeeked); resolve(); };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = t;
    });
    await waitForPaintedVideoFrame(video);
  }

  async function captureUsableFrame(video: HTMLVideoElement, t: number, duration: number) {
    const safeDuration = Math.max(0.1, duration - 0.35);
    const scanStep = Math.max(0.8, Math.min(2.4, duration * 0.015));
    let lastShot: { preview: string; blob: Blob; mostlyBlack: boolean; time: number } | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const time = Math.min(safeDuration, Math.max(0.35, t + attempt * scanStep));
      await seekTo(video, time);
      const shot = await captureFrame(video);
      lastShot = { ...shot, time };
      if (!shot.mostlyBlack) return lastShot;
    }
    return lastShot!;
  }

  function isMostlyBlack(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const data = ctx.getImageData(0, 0, width, height).data;
    const step = Math.max(8, Math.floor(Math.sqrt((width * height) / 6000)));
    let luminanceSum = 0;
    let bright = 0;
    let count = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha < 10) continue;
        const lum = data[idx] * 0.2126 + data[idx + 1] * 0.7152 + data[idx + 2] * 0.0722;
        luminanceSum += lum;
        if (lum > 24) bright++;
        count++;
      }
    }

    if (!count) return true;
    return luminanceSum / count < 12 && bright / count < 0.05;
  }

  async function extractAutoFrames(video: HTMLVideoElement, protocol: typeof activeProtocol) {
    const dur = video.duration;
    if (!isFinite(dur) || dur <= 0) {
      setError("Não foi possível ler o vídeo. Tente outro formato (MP4).");
      setExtracting(false);
      return;
    }

    setFrames([]);
    setAiAnalysis(null);
    setAiReportText("");
    setAiFrameFindings([]);
    setExtracting(true);
    setProgress(0);

    const list: Frame[] = [];
    for (let i = 0; i < protocol.vistas.length; i++) {
      const t = dur * protocol.fractions[i];
      const { preview, blob, time } = await captureUsableFrame(video, t, dur);
      list.push({
        id: crypto.randomUUID(), time, preview, blob,
        vista: protocol.vistas[i] || `Corte ${i + 1}`, findings: [], aiAnalyzed: false,
      });
      setFrames([...list]);
      setProgress(i + 1);
    }
    setExtracting(false);
  }

  async function reextractCurrentVideo() {
    const video = videoRef.current;
    if (!video || !video.src) return;
    setError("");
    await extractAutoFrames(video, activeProtocol);
  }

  async function handleProtocolChange(nextProtocol: AutoProtocol) {
    setAutoProtocol(nextProtocol);
    setError("");
    const video = videoRef.current;
    if (!videoLoaded || !video?.src) return;
    await extractAutoFrames(video, PROTOCOL_PRESETS[nextProtocol]);
  }

  function clampFrameTime(time: number, video: HTMLVideoElement) {
    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) return Math.max(0, time);
    return Math.min(Math.max(0.2, time), Math.max(0.2, duration - 0.2));
  }

  async function jumpToFrame(time: number) {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    await seekTo(video, clampFrameTime(time, video));
    video.pause();
    video.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function recaptureFrame(frameId: string, targetTime: number) {
    const video = videoRef.current;
    if (!video || !video.src) return;
    setError("");
    const time = clampFrameTime(targetTime, video);
    await seekTo(video, time);
    const shot = await captureFrame(video);
    const usableShot = shot.mostlyBlack
      ? await captureUsableFrame(video, time + 0.5, video.duration)
      : { ...shot, time };

    setFrames(prev => prev.map(fr => fr.id === frameId
      ? { ...fr, time: usableShot.time, preview: usableShot.preview, blob: usableShot.blob, aiAnalyzed: false }
      : fr));
    setPreviewFrame(prev => prev?.id === frameId
      ? { ...prev, time: usableShot.time, preview: usableShot.preview, blob: usableShot.blob, aiAnalyzed: false }
      : prev);
  }

  async function recaptureFrameFromCurrentVideo(frameId: string) {
    const video = videoRef.current;
    if (!video) return;
    await recaptureFrame(frameId, video.currentTime);
  }

  // ── Carrega vídeo e extrai 8 cortes ──────────────────────────────────────
  async function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError("");

    const video = videoRef.current!;
    const url = URL.createObjectURL(file);
    video.src = url;

    await new Promise<void>((resolve) => {
      const onLoad = () => { video.removeEventListener("loadedmetadata", onLoad); resolve(); };
      video.addEventListener("loadedmetadata", onLoad);
    });
    setVideoLoaded(true);

    await extractAutoFrames(video, activeProtocol);
  }

  // ── Carrega vídeo a partir de uma URL (ex.: vídeo recebido no WhatsApp) ───
  // fetch→blob→objectURL evita o canvas-taint de URLs cross-origin (o objectURL é same-origin),
  // permitindo o captureFrame (canvas.toBlob) funcionar. data:URL base64 também passa direto.
  async function loadVideoFromUrl(remoteUrl: string) {
    setError("");
    const video = videoRef.current;
    if (!video) return;
    try {
      const res = await fetch(remoteUrl);
      if (!res.ok) throw new Error(`Não foi possível baixar o vídeo (HTTP ${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        const onLoad = () => { cleanup(); resolve(); };
        const onErr = () => { cleanup(); reject(new Error("Falha ao carregar o vídeo.")); };
        const cleanup = () => { video.removeEventListener("loadedmetadata", onLoad); video.removeEventListener("error", onErr); };
        video.addEventListener("loadedmetadata", onLoad);
        video.addEventListener("error", onErr);
      });
      setVideoLoaded(true);
      await extractAutoFrames(video, activeProtocol);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar o vídeo do WhatsApp. Abra o vídeo no chat antes de enviar para a avaliação.");
    }
  }

  // Recebe o vídeo do WhatsApp via prop (uma única vez) e dispara a extração.
  const initialVideoHandledRef = useRef(false);
  useEffect(() => {
    if (initialVideoUrl && !initialVideoHandledRef.current) {
      initialVideoHandledRef.current = true;
      loadVideoFromUrl(initialVideoUrl).finally(() => onInitialVideoConsumed?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoUrl]);

  // ── Captura frame manual (treinador pausa onde quiser) ───────────────────
  async function captureManual() {
    const video = videoRef.current;
    if (!video) return;
    await waitForPaintedVideoFrame(video);
    const { preview, blob } = await captureFrame(video);
    setFrames(prev => [...prev, {
      id: crypto.randomUUID(), time: video.currentTime, preview, blob,
      vista: "Extra", findings: [], aiAnalyzed: false,
    }]);
  }

  // ── Análise IA de todos os frames ────────────────────────────────────────
  async function analyzeAI() {
    if (frames.length === 0) return;
    setAnalyzing(true); setError("");
    try {
      // Converte frames para base64
      const images = await Promise.all(frames.map(async (fr) => {
        const b64 = await blobToBase64(fr.blob);
        return { vista: fr.vista, data: b64, frameId: fr.id };
      }));

      const { data, error: e } = await supabase.functions.invoke<AiFunctionalAssessmentResponse>("ai-functional-assessment", {
        body: {
          student_id: studentId,
          student_name: assessmentContext?.studentName,
          company_id: companyId,
          frames: images,
          assessment_source: "video_full_assessment",
          protocol_hint: activeProtocol.hint,
          expected_movements: activeProtocol.vistas,
          ...assessmentContext,
        },
      });
      const response = data ?? {};
      if (e || response.error) throw new Error(e?.message || response.error);

      // Guarda o laudo estruturado (disfunções, músculos, restrições) p/ alimentar as IAs prescritoras
      setAiAnalysis(response.assessment_json || null);
      setAiReportText(response.report_text || "");
      setAiFrameFindings(response.frame_findings || []);

      // A IA retorna findings por frame. Mapeia de volta.
      const byFrame: Record<string, AiFindingInput[]> = {};
      (response.frame_findings || []).forEach((ff) => {
        if (ff.frameId) byFrame[ff.frameId] = ff.findings || [];
      });

      setFrames(prev => prev.map(fr => ({
        ...fr,
        findings: byFrame[fr.id]?.map(normalizeAIFinding) || fr.findings,
        aiAnalyzed: true,
      })));
    } catch (e: unknown) { setError(errorMessage(e)); }
    setAnalyzing(false);
  }

  // ── Edição manual dos achados ────────────────────────────────────────────
  function updateFrame(id: string, changes: Partial<Frame>) {
    setFrames(prev => prev.map(fr => fr.id === id ? { ...fr, ...changes } : fr));
  }
  function addFinding(id: string) {
    setFrames(prev => prev.map(fr => fr.id === id
      ? { ...fr, findings: [...fr.findings, { gravidade: "Moderada", descricao: "" }] }
      : fr));
  }
  function updateFinding(frameId: string, idx: number, key: keyof Finding, val: string) {
    setFrames(prev => prev.map(fr => {
      if (fr.id !== frameId) return fr;
      const findings = [...fr.findings];
      findings[idx] = { ...findings[idx], [key]: val };
      return { ...fr, findings };
    }));
  }
  function removeFinding(frameId: string, idx: number) {
    setFrames(prev => prev.map(fr => fr.id === frameId
      ? { ...fr, findings: fr.findings.filter((_, i) => i !== idx) }
      : fr));
  }
  function removeFrame(id: string) {
    setFrames(prev => prev.filter(fr => fr.id !== id));
  }

  // ── Salvar avaliação (upload frames + grava no banco) ────────────────────
  async function save() {
    setSaving(true); setError("");
    try {
      // 1. Cria a avaliação — junta o laudo estruturado da IA + os achados editados pelo treinador
      const assessmentJson = {
        ...(aiAnalysis || {}),
        vistas: frames.map(fr => ({
          vista: fr.vista, time: fr.time,
          compensacoes: fr.findings.filter(x => x.descricao.trim()).map(toSerializableFinding),
        })),
        protocol_hint: activeProtocol.hint,
        expected_movements: [...activeProtocol.vistas],
        total_compensacoes: frames.reduce((s, fr) => s + fr.findings.filter(x => x.descricao.trim()).length, 0),
      } as unknown as JsonObject;
      const fallbackReport = typeof aiAnalysis?.relatorio_para_aluno === "string" ? aiAnalysis.relatorio_para_aluno : "";
      const { data: assessment, error: e1 } = await videoDb
        .from("functional_assessments")
        .insert({
          student_id: studentId, company_id: companyId,
          queixa_principal: assessmentContext?.queixa_principal || null,
          historico_lesoes: assessmentContext?.historico_lesoes || null,
          modalidade: assessmentContext?.modalidade || null,
          nivel: assessmentContext?.nivel || null,
          report_text: aiReportText || fallbackReport,
          assessment_json: assessmentJson,
          status: "completed",
          source: "video",
        }).select("id").single();
      if (e1) throw e1;
      if (!assessment) throw new Error("A avaliação foi salva sem retornar ID.");

      // 2. Upload dos frames para storage + grava assessment_frames
      for (let i = 0; i < frames.length; i++) {
        const fr = frames[i];
        const path = `${companyId}/${assessment.id}/frame_${i}.jpg`;
        const { error: uploadError } = await videoDb.storage.from("assessment-frames").upload(path, fr.blob, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = videoDb.storage.from("assessment-frames").getPublicUrl(path);
        const { error: frameError } = await videoDb.from("assessment_frames").insert({
          assessment_id: assessment.id, company_id: companyId,
          frame_index: i, vista: fr.vista, image_url: urlData.publicUrl,
          ai_findings: fr.aiAnalyzed ? fr.findings.map(toSerializableFinding) : null,
          trainer_findings: fr.findings.map(toSerializableFinding),
          edited: !fr.aiAnalyzed || true,
        });
        if (frameError) throw frameError;
      }
      onComplete?.(assessment.id, {
        id: assessment.id,
        report_text: aiReportText || fallbackReport,
        assessment_json: assessmentJson,
        frame_findings: aiFrameFindings,
      });
    } catch (e: unknown) { setError(errorMessage(e)); }
    setSaving(false);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Upload */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Avaliação por vídeo
            <BnitoContextButton
              label="avaliacao por video"
              context="Analise tecnica por video/frames no Studio: postura, overhead squat, compensacoes e cues para prescricao."
              question="O que devo observar nos frames antes de transformar essa avaliacao em treino?"
              className="ml-auto"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
            <Select value={autoProtocol} onValueChange={v => void handleProtocolChange(v as AutoProtocol)} disabled={extracting}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROTOCOL_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{activeProtocol.description}</p>
          </div>

          <video ref={videoRef} muted playsInline controls
            style={{ display: videoLoaded ? "block" : "none", width: "100%", maxHeight: 280, borderRadius: 8, background: "#000" }} />

          {!videoLoaded && (
            <div style={{ position: "relative" }}
              className="border-2 border-dashed border-slate-300 hover:border-[#8B7355] rounded-xl bg-slate-50 transition cursor-pointer">
              <div className="flex flex-col items-center gap-2 py-12 pointer-events-none">
                <Video className="h-10 w-10 text-slate-400" />
                <span className="font-semibold text-slate-600">Clique ou arraste o vídeo da avaliação</span>
                <span className="text-xs text-slate-400">MP4 · {activeProtocol.label.toLowerCase()} vira cortes automáticos para a IA</span>
              </div>
              <input type="file" accept="video/*" onChange={handleVideo}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </div>
          )}

          {videoLoaded && (
            <div className="flex items-center justify-between mt-3">
              <div style={{ position: "relative" }}>
                <span className="text-xs text-slate-500 hover:text-[#8B7355] cursor-pointer">↩ Trocar vídeo</span>
                <input type="file" accept="video/*" onChange={handleVideo}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={reextractCurrentVideo} disabled={extracting}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer cortes
                </Button>
                <Button size="sm" variant="outline" onClick={captureManual}>
                  <Camera className="h-3.5 w-3.5 mr-1" /> Capturar frame atual
                </Button>
              </div>
            </div>
          )}

          {extracting && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                <Loader2 className="h-4 w-4 animate-spin" /> Extraindo cortes… {progress}/{activeProtocol.vistas.length}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-[#8B7355] h-1.5 rounded-full transition-all" style={{ width: `${progress/activeProtocol.vistas.length*100}%` }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão analisar */}
      {frames.length > 0 && !extracting && (
        <div className="flex gap-2">
          <Button onClick={analyzeAI} disabled={analyzing} className="flex-1 bg-[#1B2B4A] hover:bg-[#1B2B4A]/90">
            {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando com IA…</>
              : <><Sparkles className="mr-2 h-4 w-4" /> Analisar {frames.length} cortes com IA</>}
          </Button>
        </div>
      )}

      {/* Grid de frames editáveis */}
      {frames.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Revise os cortes antes da IA. Use Ver, 1s, Usar vídeo ou ampliar quando algum frame cair fora do melhor momento.
          </p>
          {frames.map((fr) => (
            <Card key={fr.id}>
              <CardContent className="pt-4">
                <div className="flex gap-4">
                  {/* Foto */}
                  <div className="relative flex-shrink-0" style={{ width: 132 }}>
                    <button
                      type="button"
                      onClick={() => setPreviewFrame(fr)}
                      className="group relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      style={{ aspectRatio: "9/16" }}
                      aria-label={`Ampliar ${fr.vista}`}
                    >
                      <img src={fr.preview} alt={fr.vista} className="h-full w-full object-contain" />
                      <span className="absolute top-1 left-1 hidden items-center gap-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-white group-hover:flex">
                        <Maximize2 className="h-3 w-3" /> ampliar
                      </span>
                    </button>
                    <button type="button" onClick={() => removeFrame(fr.id)}
                      className="absolute top-1 right-1 bg-slate-900/70 rounded-full h-5 w-5 text-white text-xs flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-xs px-1.5 rounded">{Math.round(fr.time)}s</span>
                  </div>

                  {/* Edição */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={fr.vista} onValueChange={v => updateFrame(fr.id, { vista: v })}>
                        <SelectTrigger className="h-8 text-sm w-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>{VISTAS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                      {fr.aiAnalyzed && <Badge variant="outline" className="text-xs"><Sparkles className="h-2.5 w-2.5 mr-1" />IA</Badge>}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => jumpToFrame(fr.time)}>
                        <Eye className="mr-1 h-3 w-3" /> Ver
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => recaptureFrame(fr.id, fr.time - FRAME_NUDGE_SECONDS)}>
                        <SkipBack className="mr-1 h-3 w-3" /> 1s
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => recaptureFrameFromCurrentVideo(fr.id)}>
                        <Camera className="mr-1 h-3 w-3" /> Usar vídeo
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => recaptureFrame(fr.id, fr.time + FRAME_NUDGE_SECONDS)}>
                        1s <SkipForward className="ml-1 h-3 w-3" />
                      </Button>
                      <span className="text-xs text-slate-400">{fr.time.toFixed(1)}s</span>
                    </div>

                    {fr.findings.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Nenhuma compensação. Clique abaixo para adicionar.</p>
                    )}

                    {fr.findings.map((finding, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Select value={finding.gravidade} onValueChange={v => updateFinding(fr.id, idx, "gravidade", v)}>
                          <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>{GRAVIDADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input value={finding.descricao} onChange={e => updateFinding(fr.id, idx, "descricao", e.target.value)}
                          className="h-8 text-sm flex-1" placeholder="Descrição da compensação" />
                        <button onClick={() => removeFinding(fr.id, idx)} className="text-slate-400 hover:text-red-500">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <Button size="sm" variant="ghost" className="h-7 text-xs text-[#8B7355]" onClick={() => addFinding(fr.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar compensação
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={save} disabled={saving} className="w-full bg-[#8B7355] hover:bg-[#8B7355]/90">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando avaliação…</>
              : <><Save className="mr-2 h-4 w-4" /> Salvar avaliação funcional</>}
          </Button>
        </div>
      )}

      {previewFrame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setPreviewFrame(null)}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col gap-3" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewFrame(null)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white"
              aria-label="Fechar preview"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="rounded-2xl bg-black p-2">
              <img src={previewFrame.preview} alt={previewFrame.vista} className="max-h-[82vh] w-full object-contain" />
            </div>
            <div className="self-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow">
              {previewFrame.vista} · {previewFrame.time.toFixed(1)}s
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

function normalizeAIFinding(finding: AiFindingInput): Finding {
  if (typeof finding === "string") {
    return { gravidade: "Moderada", descricao: finding };
  }
  return {
    gravidade: finding.gravidade || "Moderada",
    descricao: finding.descricao || "",
  };
}

function toSerializableFinding(finding: Finding): Finding {
  return {
    gravidade: finding.gravidade,
    descricao: finding.descricao,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
