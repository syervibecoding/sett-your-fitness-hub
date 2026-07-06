// ============================================================================
// assessment/pdf.ts — Exportação do laudo de avaliação funcional em PDF (jsPDF).
//   Cobre os dois formatos de laudo:
//     • Fotos / Metodologia BN (scores, disfunções, músculos, prioridades)
//     • Vídeo manual (vistas + compensações, com os quadros embutidos)
//   Identidade Set (Navy / Ink / Paper), sem dependências extras.
// ============================================================================
import { jsPDF } from "jspdf";

// Paleta da marca (RGB) — alinhada aos tokens do projeto.
const NAVY: [number, number, number] = [29, 45, 92]; // #1D2D5C
const INK: [number, number, number] = [10, 10, 10]; // #0A0A0A
const MUTED: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [220, 220, 214];
const PAPER: [number, number, number] = [250, 250, 247]; // #FAFAF7

const GRAV_COLOR: Record<string, [number, number, number]> = {
  Leve: [25, 120, 70],
  Moderada: [190, 120, 20],
  Severa: [185, 40, 40],
};

export interface AssessmentFrame {
  vista: string;
  time: number;
  dataUrl?: string;
  findings: { gravidade: string; descricao: string }[];
}

export interface AssessmentPdfData {
  reportText?: string | null;
  /** assessment_json do banco (formato fotos/BN ou vídeo). */
  json?: any;
  /** Quadros do vídeo (com imagens) — usado quando o laudo é gerado na hora. */
  frames?: AssessmentFrame[];
}

export interface AssessmentPdfMeta {
  studentName: string;
  companyName?: string;
  authorName?: string;
  dateLabel?: string;
  /** "photos" (fotos/BN) ou "video". Default: inferido do json/frames. */
  source?: "photos" | "video";
}

export function generateAssessmentPdf(
  data: AssessmentPdfData,
  meta: AssessmentPdfMeta,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); // 210
  const H = doc.internal.pageSize.getHeight(); // 297
  const M = 16;
  const CW = W - M * 2;
  let y = M;

  const json = data.json || {};
  const frames: AssessmentFrame[] =
    data.frames ||
    (Array.isArray(json.vistas)
      ? json.vistas.map((v: any) => ({
          vista: v.vista,
          time: v.time,
          findings: v.compensacoes || [],
        }))
      : []);

  const source: "photos" | "video" =
    meta.source || (frames.length > 0 ? "video" : "photos");

  const dateLabel = meta.dateLabel ?? new Date().toLocaleDateString("pt-BR");

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const draw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  function footer() {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setColor(MUTED);
      doc.text(meta.companyName || "Set Training", M, H - 8);
      doc.text(`Página ${p} de ${pages}`, W - M, H - 8, { align: "right" });
      draw(LINE);
      doc.setLineWidth(0.2);
      doc.line(M, H - 11, W - M, H - 11);
    }
  }

  function ensureSpace(needed: number) {
    if (y + needed > H - 16) {
      doc.addPage();
      y = M;
    }
  }

  function sectionTitle(t: string) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(NAVY);
    doc.text(t.toUpperCase(), M, y);
    y += 2;
    draw(NAVY);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + 18, y);
    y += 5;
  }

  function bulletList(items: string[]) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(INK);
    items.forEach((r) => {
      const lines = doc.splitTextToSize(`•  ${r}`, CW - 2);
      ensureSpace(lines.length * 4.6 + 1);
      doc.text(lines, M + 1, y);
      y += lines.length * 4.6 + 1;
    });
    y += 3;
  }

  // --- cabeçalho -----------------------------------------------------------
  fill(NAVY);
  doc.rect(0, 0, W, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text((meta.companyName || "SET TRAINING").toUpperCase(), M, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 206, 224);
  doc.text("AVALIAÇÃO FUNCIONAL", M, 19);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text("Laudo funcional", M, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 206, 224);
  doc.text(source === "video" ? "Vídeo" : "Fotos · BN", W - M, 28, { align: "right" });
  y = 44;

  // --- bloco de dados do aluno --------------------------------------------
  const facts: [string, string][] = [
    ["Aluno", meta.studentName || "—"],
    ["Data", dateLabel],
    ["Tipo", source === "video" ? "Vídeo (manual)" : "Fotos (Metodologia BN)"],
  ];
  const colW = CW / 3;
  const rowH = 13;
  fill(PAPER);
  draw(LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, CW, rowH, 1.5, 1.5, "FD");
  facts.forEach((f, i) => {
    const cx = M + i * colW + 4;
    const cy = y + 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(f[0].toUpperCase(), cx, cy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setColor(INK);
    doc.text(doc.splitTextToSize(f[1], colW - 8)[0], cx, cy + 5);
  });
  y += rowH + 8;

  // --- scores (formato fotos/BN) ------------------------------------------
  const sp = json?.score_postural?.total;
  const sf = json?.score_funcional?.total;
  if (sp != null || sf != null) {
    sectionTitle("Scores");
    const chips: [string, number][] = [];
    if (sp != null) chips.push(["Score postural", sp]);
    if (sf != null) chips.push(["Score funcional", sf]);
    const chipW = (CW - 4) / 2;
    const chipH = 15;
    ensureSpace(chipH + 2);
    chips.forEach((c, i) => {
      const cx = M + i * (chipW + 4);
      fill(PAPER);
      draw(LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(cx, y, chipW, chipH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setColor(MUTED);
      doc.text(c[0].toUpperCase(), cx + 4, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      setColor(NAVY);
      doc.text(`${c[1]}/10`, cx + 4, y + 12);
    });
    y += chipH + 8;
  }

  // --- prioridades corretivas ---------------------------------------------
  if (Array.isArray(json?.prioridades_corretivas) && json.prioridades_corretivas.length) {
    sectionTitle("Prioridades corretivas");
    bulletList(json.prioridades_corretivas);
  }

  // --- disfunções identificadas -------------------------------------------
  if (Array.isArray(json?.disfuncoes_identificadas) && json.disfuncoes_identificadas.length) {
    sectionTitle("Disfunções identificadas");
    bulletList(
      json.disfuncoes_identificadas.map((d: any) =>
        typeof d === "string" ? d : [d.nome, d.descricao].filter(Boolean).join(" — "),
      ),
    );
  }

  // --- músculos ------------------------------------------------------------
  const fracos: string[] = json?.musculos_fracos || [];
  const encurtados: string[] = json?.musculos_encurtados || [];
  if (fracos.length || encurtados.length) {
    sectionTitle("Músculos a priorizar");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (fracos.length) {
      ensureSpace(6);
      doc.setFont("helvetica", "bold");
      setColor(INK);
      doc.text("Fortalecer: ", M + 1, y);
      const off = doc.getTextWidth("Fortalecer: ");
      doc.setFont("helvetica", "normal");
      setColor(MUTED);
      const lines = doc.splitTextToSize(fracos.join(", "), CW - off - 2);
      doc.text(lines, M + 1 + off, y);
      y += lines.length * 4.6 + 1;
    }
    if (encurtados.length) {
      ensureSpace(6);
      doc.setFont("helvetica", "bold");
      setColor(INK);
      doc.text("Alongar / liberar: ", M + 1, y);
      const off = doc.getTextWidth("Alongar / liberar: ");
      doc.setFont("helvetica", "normal");
      setColor(MUTED);
      const lines = doc.splitTextToSize(encurtados.join(", "), CW - off - 2);
      doc.text(lines, M + 1 + off, y);
      y += lines.length * 4.6 + 1;
    }
    y += 3;
  }

  // --- restrições / contraindicados ---------------------------------------
  const restr: string[] = json?.restricoes_movimento || [];
  const contra: string[] = json?.exercicios_contraindicados || [];
  const cautela: string[] = json?.exercicios_cautela || [];
  if (restr.length || contra.length || cautela.length) {
    sectionTitle("Restrições e cuidados");
    if (restr.length) bulletList(restr.map((r) => `Restrição: ${r}`));
    if (contra.length) bulletList(contra.map((r) => `Contraindicado: ${r}`));
    if (cautela.length) bulletList(cautela.map((r) => `Cautela: ${r}`));
  }

  // --- vistas do vídeo -----------------------------------------------------
  if (source === "video" && frames.length) {
    sectionTitle(`Vistas analisadas (${frames.length})`);
    frames.forEach((f) => {
      const hasImg = !!f.dataUrl;
      const imgW = 40;
      const imgH = 26;
      const blockH = Math.max(
        hasImg ? imgH : 0,
        10 + f.findings.length * 5,
      );
      ensureSpace(blockH + 6);
      const textX = M + (hasImg ? imgW + 4 : 0);
      const textW = CW - (hasImg ? imgW + 4 : 0);

      if (hasImg) {
        try {
          doc.addImage(f.dataUrl!, "JPEG", M, y, imgW, imgH);
          draw(LINE);
          doc.setLineWidth(0.2);
          doc.rect(M, y, imgW, imgH);
        } catch {
          /* imagem inválida — ignora */
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setColor(INK);
      doc.text(`${f.vista}`, textX, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setColor(MUTED);
      doc.text(`${Number(f.time).toFixed(1)}s`, textX + textW, y + 4, { align: "right" });

      let ly = y + 9;
      if (f.findings.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        setColor(MUTED);
        doc.text("Sem compensações registradas.", textX, ly);
        ly += 5;
      } else {
        f.findings.forEach((c) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          setColor(GRAV_COLOR[c.gravidade] || MUTED);
          doc.text(`[${c.gravidade}]`, textX, ly);
          const off = doc.getTextWidth(`[${c.gravidade}] `);
          doc.setFont("helvetica", "normal");
          setColor(INK);
          const lines = doc.splitTextToSize(c.descricao || "—", textW - off);
          doc.text(lines, textX + off, ly);
          ly += Math.max(4.6, lines.length * 4.2);
        });
      }
      y += blockH + 5;
      draw(LINE);
      doc.setLineWidth(0.1);
      doc.line(M, y - 2, W - M, y - 2);
    });
    y += 3;
  }

  // --- relatório (report_text) --------------------------------------------
  if (data.reportText) {
    sectionTitle("Relatório");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(INK);
    const paragraphs = String(data.reportText).split("\n");
    paragraphs.forEach((p) => {
      const lines = doc.splitTextToSize(p || " ", CW - 2);
      ensureSpace(lines.length * 4.6 + 1);
      doc.text(lines, M + 1, y);
      y += lines.length * 4.6 + 1;
    });
    y += 3;
  }

  // --- assinatura ----------------------------------------------------------
  ensureSpace(20);
  y += 6;
  draw(INK);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + 60, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text(meta.authorName || "Responsável técnico", M, y + 5);

  footer();
  return doc;
}

/** Gera e dispara o download do PDF do laudo. */
export function downloadAssessmentPdf(
  data: AssessmentPdfData,
  meta: AssessmentPdfMeta,
): void {
  const doc = generateAssessmentPdf(data, meta);
  const safe = (meta.studentName || "aluno")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  doc.save(`laudo-${safe}.pdf`);
}
