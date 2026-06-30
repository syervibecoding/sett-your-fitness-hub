// ============================================================================
// pdf.ts (Fase D2) — Exportação de prescrição em PDF (jsPDF, sem dependências extras)
//   Gera um PDF A4 limpo e com a identidade Set (Navy / Ink / Paper):
//   capa com dados do aluno, racional, volume semanal e os treinos.
//   Função pura quanto ao plano — recebe o PrescriptionPlan já gerado pelo motor.
// ============================================================================
import { jsPDF } from "jspdf";
import type { PrescriptionPlan } from "./types";

// Paleta da marca (RGB) — alinhada aos tokens do projeto.
const NAVY: [number, number, number] = [29, 45, 92]; // #1D2D5C
const INK: [number, number, number] = [10, 10, 10]; // #0A0A0A
const MUTED: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [220, 220, 214];
const PAPER: [number, number, number] = [250, 250, 247]; // #FAFAF7

const OBJ_LABEL: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  emagrecimento: "Emagrecimento",
  forca: "Força",
  performance: "Performance",
  saude: "Saúde / Geral",
};
const EXP_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};
const EQUIP_LABEL: Record<string, string> = {
  academia_completa: "Academia completa",
  halteres: "Halteres / livre",
  casa_basica: "Casa (básico)",
  peso_corporal: "Peso corporal",
};

export interface PrescriptionPdfMeta {
  studentName: string;
  companyName?: string;
  /** Nome do treinador/assinatura. */
  authorName?: string;
  /** Data legível (ex.: 30/06/2026). Default: hoje. */
  dateLabel?: string;
}

export function generatePrescriptionPdf(
  plan: PrescriptionPlan,
  meta: PrescriptionPdfMeta,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); // 210
  const H = doc.internal.pageSize.getHeight(); // 297
  const M = 16; // margem
  const CW = W - M * 2; // largura útil
  let y = M;

  const dateLabel =
    meta.dateLabel ?? new Date().toLocaleDateString("pt-BR");

  // --- helpers -------------------------------------------------------------
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
      const left = meta.companyName || "Set Training";
      doc.text(left, M, H - 8);
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
  doc.text("PROGRAMA DE TREINO", M, 19);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(plan.splitName, M, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 206, 224);
  doc.text(`${plan.durationWeeks} semanas`, W - M, 28, { align: "right" });
  y = 44;

  // --- bloco de dados do aluno --------------------------------------------
  const inp = plan.input;
  const facts: [string, string][] = [
    ["Aluno", meta.studentName || "—"],
    ["Data", dateLabel],
    ["Objetivo", OBJ_LABEL[inp.objective] ?? inp.objective],
    ["Nível", EXP_LABEL[inp.experience] ?? inp.experience],
    ["Frequência", `${inp.daysPerWeek}x / semana`],
    ["Equipamento", EQUIP_LABEL[inp.equipment] ?? inp.equipment],
  ];
  const colW = CW / 3;
  const rowH = 13;
  fill(PAPER);
  draw(LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, CW, rowH * 2, 1.5, 1.5, "FD");
  facts.forEach((f, i) => {
    const cx = M + (i % 3) * colW + 4;
    const cy = y + Math.floor(i / 3) * rowH + 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(f[0].toUpperCase(), cx, cy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setColor(INK);
    doc.text(doc.splitTextToSize(f[1], colW - 8)[0], cx, cy + 5);
  });
  y += rowH * 2 + 8;

  // --- racional ------------------------------------------------------------
  if (plan.rationale.length) {
    ensureSpace(10);
    sectionTitle("Racional da prescrição");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(INK);
    plan.rationale.forEach((r) => {
      const lines = doc.splitTextToSize(`•  ${r}`, CW - 2);
      ensureSpace(lines.length * 4.6 + 1);
      doc.text(lines, M + 1, y);
      y += lines.length * 4.6 + 1;
    });
    y += 3;
  }

  // --- avisos --------------------------------------------------------------
  if (plan.warnings.length) {
    ensureSpace(8 + plan.warnings.length * 5);
    const boxH = 6 + plan.warnings.length * 5;
    doc.setFillColor(254, 249, 235);
    doc.setDrawColor(230, 195, 120);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, boxH, 1.5, 1.5, "FD");
    let wy = y + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(150, 100, 20);
    plan.warnings.forEach((w) => {
      const lines = doc.splitTextToSize(`!  ${w}`, CW - 8);
      doc.text(lines, M + 4, wy);
      wy += lines.length * 4.6;
    });
    y += boxH + 8;
  }

  // --- volume semanal ------------------------------------------------------
  if (plan.weeklyVolume.length) {
    ensureSpace(14);
    sectionTitle("Volume semanal (séries por grupo)");
    const chipW = (CW - 12) / 4;
    const chipH = 11;
    plan.weeklyVolume.forEach((v, i) => {
      const col = i % 4;
      const rowIdx = Math.floor(i / 4);
      if (col === 0 && i > 0) y += chipH + 2;
      ensureSpace(chipH + 2);
      const cx = M + col * (chipW + 4);
      const cy = y;
      fill(PAPER);
      draw(LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(cx, cy, chipW, chipH, 1, 1, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setColor(MUTED);
      doc.text(v.label, cx + 3, cy + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const stColor: [number, number, number] =
        v.status === "low" ? [190, 120, 20] : v.status === "high" ? [185, 40, 40] : [25, 120, 70];
      setColor(stColor);
      doc.text(String(v.sets), cx + 3, cy + 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setColor(MUTED);
      doc.text(`/ ${v.target[0]}–${v.target[1]}`, cx + 9, cy + 9);
    });
    y += chipH + 10;
  }

  // --- treinos -------------------------------------------------------------
  plan.workouts.forEach((w) => {
    ensureSpace(22);
    // título do treino
    fill(INK);
    doc.roundedRect(M, y, CW, 9, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(w.title, M + 4, y + 6);
    y += 12;

    // cabeçalho da tabela
    const cols = [
      { label: "Exercício", x: M + 2, w: CW * 0.42 },
      { label: "Séries", x: M + CW * 0.44, w: CW * 0.12 },
      { label: "Reps", x: M + CW * 0.56, w: CW * 0.14 },
      { label: "Desc.", x: M + CW * 0.7, w: CW * 0.14 },
      { label: "RPE", x: M + CW * 0.84, w: CW * 0.16 },
    ];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(MUTED);
    cols.forEach((c) => doc.text(c.label.toUpperCase(), c.x, y));
    y += 1.5;
    draw(LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 4;

    if (w.exercises.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      setColor(MUTED);
      doc.text("Sem exercícios disponíveis para os filtros selecionados.", M + 2, y);
      y += 7;
    }

    w.exercises.forEach((ex) => {
      const nameLines = doc.splitTextToSize(ex.exercise_name, cols[0].w - 2);
      const rowHeight = Math.max(8.5, nameLines.length * 4.2 + 4.5);
      ensureSpace(rowHeight + 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setColor(INK);
      doc.text(nameLines, cols[0].x, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setColor(MUTED);
      doc.text(ex.muscle_group, cols[0].x, y + nameLines.length * 4.2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(INK);
      doc.text(String(ex.sets), cols[1].x, y);
      doc.text(String(ex.reps), cols[2].x, y);
      doc.text(String(ex.rest), cols[3].x, y);
      doc.text(String(ex.rpe), cols[4].x, y);

      y += rowHeight;
      draw(LINE);
      doc.setLineWidth(0.1);
      doc.line(M, y - 2, W - M, y - 2);
    });
    y += 6;
  });

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

/** Gera e dispara o download do PDF no navegador. */
export function downloadPrescriptionPdf(
  plan: PrescriptionPlan,
  meta: PrescriptionPdfMeta,
): void {
  const doc = generatePrescriptionPdf(plan, meta);
  const safe = (meta.studentName || "aluno")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  doc.save(`prescricao-${safe}.pdf`);
}
