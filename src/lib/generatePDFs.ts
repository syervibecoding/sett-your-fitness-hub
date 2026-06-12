// ============================================================================
// generatePDFs.ts — BN Performance Training
// Gera UM PDF SEPARADO por modalidade, alinhado ao schema REAL das edge functions
// de IA (ai-prescribe-workout / ai-running-plan / ai-nutrition-plan).
// Entregável do aluno: completo, legível e bonito. Client-side (jsPDF).
// ============================================================================
import { jsPDF } from "jspdf";

// Paleta BN
const NAVY: [number, number, number]   = [27, 43, 74];
const BEGE: [number, number, number]   = [139, 115, 85];
const BEGE_L: [number, number, number] = [245, 237, 216];
const AMBER: [number, number, number]  = [192, 120, 40];
const AMBER_L: [number, number, number]= [254, 243, 226];
const GRAY: [number, number, number]   = [107, 114, 128];
const TEXT: [number, number, number]   = [55, 65, 81];
const LIGHT: [number, number, number]  = [241, 245, 249];
const GREEN: [number, number, number]  = [22, 130, 90];

const MARGIN = 14;

export interface PDFMeta {
  studentName: string;
  date: string;
  professional?: string;
  cref?: string;
}

// ── Helpers genéricos ──────────────────────────────────────────────────────
const first = (...vals: any[]) => vals.find((v) => v !== undefined && v !== null && v !== "");

// jsPDF (fontes padrão) só renderiza WinAnsi. Mapeia glifos comuns (setas/símbolos)
// para equivalentes seguros e remove o resto fora do range — evita texto "espaçado".
const GLYPHS: Record<string, string> = {
  "→": ">", "⟶": ">", "➔": ">", "➜": ">", "⇒": ">", "»": ">",
  "←": "<", "↔": "-", "↑": "^", "↓": "v", "↳": "-", "↪": "-", "⤷": "-",
  "⚙": "*", "⚠": "!", "✓": "-", "✔": "-", "✗": "x", "★": "*", "☆": "*",
  "≥": ">=", "≤": "<=", "≈": "~", "°": "o", "·": "·",
};
function sanitize(s: string): string {
  if (!s) return s;
  let out = s.replace(/[←-⇿⌀-➿⬀-⯿✓✔✗★☆≥≤≈]/g,
    (c) => GLYPHS[c] ?? "");
  // remove quaisquer outros codepoints altos não suportados (preserva Latin-1 acentuado, travessões, aspas, bullet)
  out = out.replace(/[^\u0000-ÿ–—‘’“”•…]/g, "");
  return out;
}
const asText = (v: any) =>
  sanitize(v == null ? "" : typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : JSON.stringify(v));

function W(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }
function H(doc: jsPDF) { return doc.internal.pageSize.getHeight(); }

// Garante espaço vertical; abre nova página se necessário. Retorna o novo y.
function ensure(doc: jsPDF, y: number, need: number): number {
  if (y + need > H(doc) - 20) { doc.addPage(); return 20; }
  return y;
}

function header(doc: jsPDF, title: string, subtitle: string, meta: PDFMeta) {
  const w = W(doc);
  doc.setFillColor(...BEGE);
  doc.rect(0, 0, w, 3, "F");
  doc.setFillColor(...NAVY);
  doc.rect(0, 3, w, 30, "F");
  doc.setFillColor(...BEGE);
  doc.roundedRect(MARGIN, 9, 16, 16, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("BN", MARGIN + 8, 19.5, { align: "center" });
  doc.setFontSize(13);
  doc.text(title, MARGIN + 22, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.setTextColor(200, 190, 170);
  doc.text(subtitle, MARGIN + 22, 22);
  doc.setFontSize(7);
  doc.text(`${meta.studentName}  ·  ${meta.date}`, w - MARGIN, 15, { align: "right" });
}

// Stamp de rodapé + numeração em TODAS as páginas (chamado no fim).
function stampFooters(doc: jsPDF, meta: PDFMeta) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const w = W(doc), h = H(doc);
    doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3);
    doc.line(MARGIN, h - 14, w - MARGIN, h - 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(`${meta.professional || "Matheus Loreto"}  ·  ${meta.cref || "CREF 040718-G/SC"}  ·  BN Performance Training`, MARGIN, h - 9);
    doc.text(`${p}/${pages}`, w - MARGIN, h - 9, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  y = ensure(doc, y, 14);
  const w = W(doc);
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, y, w - MARGIN * 2, 7, "F");
  doc.setFillColor(...BEGE);
  doc.rect(MARGIN, y, 1.8, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text(sanitize(text).toUpperCase(), MARGIN + 4, y + 4.8);
  return y + 12;
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh = 4.5): number {
  if (!text) return y;
  const lines = doc.splitTextToSize(sanitize(text), maxW);
  y = ensure(doc, y, lines.length * lh);
  doc.text(lines, x, y);
  return y + lines.length * lh;
}

// Caixa de destaque (nota/alerta)
function calloutBox(doc: jsPDF, text: string, y: number, kind: "info" | "warn" = "info"): number {
  if (!text) return y;
  const w = W(doc);
  const fill = kind === "warn" ? AMBER_L : LIGHT;
  const fg = kind === "warn" ? AMBER : GRAY;
  const lines = doc.splitTextToSize(sanitize(text), w - MARGIN * 2 - 8);
  const boxH = lines.length * 4.5 + 6;
  y = ensure(doc, y, boxH + 2);
  doc.setFillColor(...fill);
  doc.roundedRect(MARGIN, y, w - MARGIN * 2, boxH, 2, 2, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...fg);
  doc.text(lines, MARGIN + 4, y + 5);
  return y + boxH + 4;
}

// Linha de métricas em cards
function statCards(doc: jsPDF, cards: [string, string][], y: number): number {
  const w = W(doc);
  const n = cards.length || 1;
  const cw = (w - MARGIN * 2) / n;
  y = ensure(doc, y, 22);
  cards.forEach(([val, lbl], i) => {
    const x = MARGIN + i * cw;
    doc.setDrawColor(...LIGHT); doc.setFillColor(255, 255, 255);
    doc.roundedRect(x + 1, y, cw - 2, 18, 2, 2, "FD");
    doc.setFillColor(...BEGE);
    doc.rect(x + 1, y, 1.5, 18, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
    doc.text(String(val), x + cw / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(...GRAY);
    doc.text(String(lbl), x + cw / 2, y + 14, { align: "center" });
  });
  return y + 24;
}

function warningsBlock(doc: jsPDF, warnings: any[], y: number): number {
  const list = (warnings || []).map(asText).filter(Boolean);
  if (!list.length) return y;
  y = sectionTitle(doc, "Avisos de seguranca", y);
  list.forEach((w) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...AMBER);
    y = wrapText(doc, `•  ${w}`, MARGIN + 2, y, W(doc) - MARGIN * 2 - 4, 4.5) + 1.5;
  });
  return y + 2;
}

// ── 1. PDF de MUSCULAÇÃO ────────────────────────────────────────────────────
const PHASE_LABEL: Record<string, string> = {
  mobilidade: "Mobilidade",
  ativacao_core: "Ativação — Core",
  ativacao_especifica: "Ativação específica",
  controle_motor: "Controle motor",
  pliometria: "Pliometria",
  forca_global: "Força global",
  forca_especifica: "Força específica",
};

export function generateStrengthPDF(plan: any, meta: PDFMeta): jsPDF {
  const doc = new jsPDF();
  const w = W(doc);
  header(doc, "Prescrição de Musculação", asText(first(plan.cycle_name, "Treino de Força")), meta);
  let y = 42;

  doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(
    `Objetivo: ${asText(first(plan.objective, "—"))}   ·   Duração: ${asText(first(plan.duration_weeks, "—"))} semanas   ·   Bloco ${asText(first(plan.block, plan.block_number, 1))}`,
    MARGIN, y);
  y += 7;

  if (plan.biomechanical_notes) y = calloutBox(doc, asText(plan.biomechanical_notes), y, "info");
  if (plan.weekly_structure) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...GRAY);
    y = wrapText(doc, `Estrutura semanal: ${asText(plan.weekly_structure)}`, MARGIN, y + 1, w - MARGIN * 2, 4.5) + 3;
  }

  (plan.workouts || []).forEach((wk: any) => {
    const title = `${asText(first(wk.name, wk.day_label, wk.day))}${wk.split_focus ? " — " + asText(wk.split_focus) : ""}`;
    y = sectionTitle(doc, title, y);
    if (wk.duration_min) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
      doc.text(`Duração estimada: ${asText(wk.duration_min)} min`, MARGIN + 2, y - 3);
    }

    const exercises = (wk.exercises || []).slice().sort(
      (a: any, b: any) => (first(a.exercise_order, 99) as number) - (first(b.exercise_order, 99) as number)
    );
    let lastPhase = "";
    exercises.forEach((ex: any) => {
      const phase = asText(ex.phase);
      if (phase && phase !== lastPhase) {
        y = ensure(doc, y, 7);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...BEGE);
        doc.text((PHASE_LABEL[phase] || phase).toUpperCase(), MARGIN + 2, y);
        y += 4.5; lastPhase = phase;
      }
      y = ensure(doc, y, 9);
      const name = asText(first(ex.exercise_name, ex.name, "Exercício"));
      const sets = asText(first(ex.sets, "—"));
      const reps = asText(first(ex.reps, "—"));
      const intens = asText(first(ex.load_percent_1rm, ex.intensity)) || (ex.rir ? `RIR ${asText(ex.rir)}` : "");
      const rest = asText(first(ex.rest_seconds, ex.rest));
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
      doc.text(`•  ${name}`, MARGIN + 2, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...TEXT);
      const detail = [
        `${sets}x${reps}`,
        intens,
        ex.tempo ? `tempo ${asText(ex.tempo)}` : "",
        rest ? `descanso ${rest}${/^\d+$/.test(rest) ? "s" : ""}` : "",
      ].filter(Boolean).join("  ·  ");
      doc.text(detail, w - MARGIN, y, { align: "right" });
      y += 4.2;
      const cue = asText(first(ex.cues, ex.cue));
      if (cue) {
        doc.setFontSize(7); doc.setTextColor(...GRAY);
        y = wrapText(doc, `↳ ${cue}`, MARGIN + 5, y, w - MARGIN * 2 - 6, 3.8) + 0.8;
      }
      if (ex.biomechanical_note) {
        doc.setFontSize(6.8); doc.setTextColor(...BEGE);
        y = wrapText(doc, `⚙ ${asText(ex.biomechanical_note)}`, MARGIN + 5, y, w - MARGIN * 2 - 6, 3.6) + 0.8;
      }
    });
    if (wk.notes) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(...GRAY);
      y = wrapText(doc, asText(wk.notes), MARGIN + 2, y + 1, w - MARGIN * 2 - 4, 3.8) + 2;
    }
    y += 3;
  });

  if (plan.progression_protocol) {
    y = sectionTitle(doc, "Progressão para o próximo bloco", y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT);
    y = wrapText(doc, asText(plan.progression_protocol), MARGIN + 2, y, w - MARGIN * 2 - 4) + 3;
  }

  y = warningsBlock(doc, plan.warnings, y);
  stampFooters(doc, meta);
  return doc;
}

// ── 2. PDF de CORRIDA / NATAÇÃO / CICLISMO ──────────────────────────────────
export function generateCardioPDF(plan: any, meta: PDFMeta, sportLabel: string): jsPDF {
  const doc = new jsPDF();
  const w = W(doc);
  header(doc, `Prescrição de ${sportLabel}`, asText(first(plan.plan_name, "Plano de Treino")), meta);
  let y = 42;

  doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const vol = first(plan.volume_weekly_km, plan.volume_weekly_hours);
  doc.text(
    `Modelo: ${asText(first(plan.model, "—"))}   ·   Duração: ${asText(first(plan.duration_weeks, "—"))} semanas${vol ? `   ·   Volume: ${asText(vol)}${plan.volume_weekly_km ? " km/sem" : " h/sem"}` : ""}`,
    MARGIN, y);
  y += 8;

  // Zonas de FC
  const z = plan.fc_zones;
  if (z) {
    y = sectionTitle(doc, "Zonas de frequência cardíaca", y);
    if (z.estimated) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(...AMBER);
      doc.text("⚠ Valores estimados. Recomenda-se teste de esforço para maior precisão.", MARGIN + 2, y - 3);
      y += 1;
    }
    const zones = ["z1", "z2", "z3", "z4", "z5"];
    const zw = (w - MARGIN * 2) / 5;
    y = ensure(doc, y, 20);
    zones.forEach((zk, i) => {
      const zd = z[zk]; if (!zd) return;
      const x = MARGIN + i * zw;
      doc.setFillColor(...BEGE_L);
      doc.roundedRect(x + 1, y, zw - 2, 16, 2, 2, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
      doc.text(zk.toUpperCase(), x + zw / 2, y + 6, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...TEXT);
      doc.text(`${asText(first(zd.min, "—"))}-${asText(first(zd.max, "—"))}`, x + zw / 2, y + 12, { align: "center" });
    });
    y += 22;
  }

  // Check de segurança
  const sc = plan.safety_check;
  if (sc) {
    const parts = [
      sc.tsb_status ? `TSB: ${asText(sc.tsb_status)}` : "",
      sc.eva_status ? `EVA: ${asText(sc.eva_status)}` : "",
      (sc.restrictions && sc.restrictions.length) ? `Restrições: ${asText(sc.restrictions)}` : "",
    ].filter(Boolean).join("   ·   ");
    if (parts) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAY); doc.text(parts, MARGIN, y); y += 6; }
  }

  // Plano semana a semana (schema real = weeks[].sessions[]) — fallback p/ sample_week
  const weeks = plan.weeks;
  if (Array.isArray(weeks) && weeks.length) {
    weeks.forEach((wk: any) => {
      const wkTitle = `Semana ${asText(first(wk.week_number, "?"))}${wk.type ? " — " + asText(wk.type) : ""}`;
      y = sectionTitle(doc, wkTitle, y);
      const meta2 = [
        wk.volume_km ? `${asText(wk.volume_km)} km` : (wk.volume_hours ? `${asText(wk.volume_hours)} h` : ""),
        wk.tss_total_estimado ? `TSS ~${asText(wk.tss_total_estimado)}` : "",
        wk.focus ? asText(wk.focus) : "",
        wk.resumo ? asText(wk.resumo) : "",
      ].filter(Boolean).join("  ·  ");
      if (meta2) { doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...GRAY); y = wrapText(doc, meta2, MARGIN + 2, y, w - MARGIN * 2 - 4, 4) + 1; }
      (wk.sessions || []).forEach((s: any) => {
        y = ensure(doc, y, 9);
        const day = asText(first(s.day, s.dia, ""));
        const titleS = asText(first(s.title, s.type, s.workout, "Sessão"));
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.2); doc.setTextColor(...NAVY);
        doc.text(`${day}${day ? " · " : ""}${titleS}`, MARGIN + 2, y);
        const right = [s.zone ? asText(s.zone) : "", s.total_min ? `${asText(s.total_min)}min` : "", s.distance_km ? `${asText(s.distance_km)}km` : ""].filter(Boolean).join(" · ");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...TEXT);
        if (right) doc.text(right, w - MARGIN, y, { align: "right" });
        y += 4.2;
        const sub = [s.fc_target ? asText(s.fc_target) : "", s.intervals ? asText(s.intervals) : ""].filter(Boolean).join("  ·  ");
        if (sub) { doc.setFontSize(7); doc.setTextColor(...GRAY); y = wrapText(doc, `↳ ${sub}`, MARGIN + 5, y, w - MARGIN * 2 - 6, 3.8) + 0.6; }
        if (s.notes) { doc.setFontSize(6.8); doc.setTextColor(...GRAY); y = wrapText(doc, asText(s.notes), MARGIN + 5, y, w - MARGIN * 2 - 6, 3.6) + 0.6; }
      });
      y += 3;
    });
  } else if (Array.isArray(plan.sample_week) && plan.sample_week.length) {
    y = sectionTitle(doc, "Semana representativa", y);
    plan.sample_week.forEach((day: any) => {
      y = ensure(doc, y, 8);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
      doc.text(asText(first(day.day, day.dia, "")), MARGIN + 2, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT);
      y = wrapText(doc, asText(first(day.workout, day.treino, day.description, "Descanso")), MARGIN + 30, y, w - MARGIN * 2 - 32, 4.5) + 3;
    });
  }

  // Força complementar
  const comp = (plan.complementary_strength || []).map(asText).filter(Boolean);
  if (comp.length) {
    y = sectionTitle(doc, "Força complementar", y);
    comp.forEach((c: string) => { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT); y = wrapText(doc, `•  ${c}`, MARGIN + 2, y, w - MARGIN * 2 - 4, 4.2) + 1; });
    y += 2;
  }

  if (plan.nutrition_alert) y = calloutBox(doc, `Nutrição: ${asText(plan.nutrition_alert)}`, y, "info");
  if (plan.general_tips) {
    y = sectionTitle(doc, "Orientações gerais", y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT);
    y = wrapText(doc, asText(plan.general_tips), MARGIN + 2, y, w - MARGIN * 2 - 4) + 3;
  }

  y = warningsBlock(doc, plan.warnings, y);
  stampFooters(doc, meta);
  return doc;
}

// ── 3. PDF de NUTRIÇÃO ──────────────────────────────────────────────────────
const CTX_LABEL: Record<string, string> = {
  treino: "dia de treino", descanso: "descanso", pre_treino: "pré-treino", pos_treino: "pós-treino",
};

export function generateNutritionPDF(plan: any, meta: PDFMeta): jsPDF {
  const doc = new jsPDF();
  const w = W(doc);
  header(doc, "Plano Nutricional", asText(first(plan.plan_name, "Orientações práticas")), meta);
  let y = 42;

  // Resumo energético
  const es = plan.energy_summary;
  if (es) {
    y = statCards(doc, [
      [`${asText(first(es.target_kcal, "—"))}`, "kcal/dia"],
      [`${asText(first(es.protein_total_g, "—"))}g`, "Proteína"],
      [`${asText(first(es.carbs_total_g, "—"))}g`, "Carboidrato"],
      [`${asText(first(es.fat_total_g, "—"))}g`, "Gordura"],
    ], y);
    const sub = [
      es.tmb_kcal ? `TMB ${asText(es.tmb_kcal)}` : "",
      es.get_kcal ? `GET ${asText(es.get_kcal)}` : "",
      es.deficit_surplus_percent != null ? `${Number(es.deficit_surplus_percent) >= 0 ? "+" : ""}${asText(es.deficit_surplus_percent)}%` : "",
      es.hydration_ml ? `Água ${asText(es.hydration_ml)}ml` : "",
    ].filter(Boolean).join("   ·   ");
    if (sub) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAY); doc.text(sub, MARGIN, y); y += 6; }
  }

  // Carb cycling (formatado, não JSON cru)
  const cc = plan.carb_cycling;
  if (cc && typeof cc === "object") {
    y = sectionTitle(doc, "Ciclo de carboidratos", y);
    const rows: [string, any, any][] = [
      ["Dia alto / treino duplo", cc.high_day_kcal, cc.high_day_carbs_g],
      ["Dia moderado", cc.moderate_day_kcal, cc.moderate_day_carbs_g],
      ["Dia de descanso", cc.rest_day_kcal, cc.rest_day_carbs_g],
    ];
    rows.forEach(([lbl, kcal, carbs]) => {
      if (kcal == null && carbs == null) return;
      y = ensure(doc, y, 6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...NAVY);
      doc.text(`•  ${lbl}`, MARGIN + 2, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT);
      doc.text(`${kcal != null ? asText(kcal) + " kcal" : ""}${carbs != null ? "  ·  " + asText(carbs) + "g CHO" : ""}`, w - MARGIN, y, { align: "right" });
      y += 5;
    });
    y += 2;
  } else if (typeof cc === "string") {
    y = calloutBox(doc, cc, y, "info");
  }

  // Orientações por momento (schema BN: nutrition_tips — sem cardápio fechado)
  const tips = plan.nutrition_tips || plan.tips || [];
  if (Array.isArray(tips) && tips.length) {
    y = sectionTitle(doc, "Orientações por momento", y);
    tips.forEach((t: any) => {
      y = ensure(doc, y, 12);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
      doc.text(`${asText(first(t.title, t.titulo, "Dica"))}${t.timing ? "  ·  " + asText(t.timing) : ""}`, MARGIN + 2, y);
      y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT);
      if (t.goal || t.objetivo) y = wrapText(doc, `Objetivo: ${asText(first(t.goal, t.objetivo))}`, MARGIN + 4, y, w - MARGIN * 2 - 6, 4.2);
      if (t.how_much || t.quantidade_aproximada) y = wrapText(doc, `Quanto: ${asText(first(t.how_much, t.quantidade_aproximada))}`, MARGIN + 4, y, w - MARGIN * 2 - 6, 4.2);
      const exs = (t.examples || t.exemplos || []).map(asText).filter(Boolean);
      if (exs.length) { doc.setTextColor(...GREEN); y = wrapText(doc, `Exemplos: ${exs.join("; ")}`, MARGIN + 4, y, w - MARGIN * 2 - 6, 4); doc.setTextColor(...TEXT); }
      const av = (t.avoid || t.evitar || []).map(asText).filter(Boolean);
      if (av.length) { doc.setTextColor(...AMBER); y = wrapText(doc, `Evitar: ${av.join(", ")}`, MARGIN + 4, y, w - MARGIN * 2 - 6, 4); doc.setTextColor(...TEXT); }
      y += 3;
    });
  }

  // Refeições do dia (quando a IA retornar cardápio estruturado)
  const meals = plan.daily_meals;
  if (Array.isArray(meals) && meals.length) {
    y = sectionTitle(doc, "Plano alimentar do dia", y);
    meals.forEach((m: any) => {
      y = ensure(doc, y, 10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
      const ctx = m.context ? ` (${CTX_LABEL[m.context] || asText(m.context)})` : "";
      doc.text(`${asText(first(m.meal_name, "Refeição"))}${m.time ? " · " + asText(m.time) : ""}${ctx}`, MARGIN + 2, y);
      const macros = [m.calories ? `${asText(m.calories)}kcal` : "", m.protein_g ? `P${asText(m.protein_g)}` : "", m.carbs_g ? `C${asText(m.carbs_g)}` : "", m.fat_g ? `G${asText(m.fat_g)}` : ""].filter(Boolean).join(" · ");
      if (macros) { doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY); doc.text(macros, w - MARGIN, y, { align: "right" }); }
      y += 5;
      (m.foods || []).forEach((food: any) => {
        y = ensure(doc, y, 5);
        const name = typeof food === "string" ? food : asText(first(food.name, food.nome));
        const qty = typeof food === "object" ? asText(first(food.quantity, food.quantidade)) : "";
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT);
        y = wrapText(doc, `–  ${name}${qty ? `  (${qty})` : ""}`, MARGIN + 5, y, w - MARGIN * 2 - 7, 4.2);
        if (food && food.notes) { doc.setFontSize(6.8); doc.setTextColor(...GRAY); y = wrapText(doc, asText(food.notes), MARGIN + 9, y, w - MARGIN * 2 - 11, 3.6) + 0.5; }
      });
      y += 2.5;
    });
  }

  // Suplementação
  const supp = plan.supplementation;
  if (Array.isArray(supp) && supp.length) {
    y = sectionTitle(doc, "Suplementação", y);
    supp.forEach((s: any) => {
      y = ensure(doc, y, 7);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.2); doc.setTextColor(...NAVY);
      doc.text(`•  ${asText(first(s.supplement, s.nome))}${s.dose ? " — " + asText(s.dose) : ""}`, MARGIN + 2, y);
      y += 4.2;
      const line = [s.timing ? asText(s.timing) : "", s.reason ? asText(s.reason) : ""].filter(Boolean).join("  ·  ");
      if (line) { doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY); y = wrapText(doc, `↳ ${line}`, MARGIN + 5, y, w - MARGIN * 2 - 7, 3.8) + 0.8; }
    });
    y += 2;
  }

  // Substituições
  const subs = plan.substitutions;
  if (Array.isArray(subs) && subs.length) {
    y = sectionTitle(doc, "Substituições inteligentes", y);
    subs.forEach((s: any) => {
      y = ensure(doc, y, 6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...NAVY);
      y = wrapText(doc, asText(first(s.original, s.de)), MARGIN + 2, y, w - MARGIN * 2 - 4, 4.2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREEN);
      y = wrapText(doc, `↔ ${asText(first(s.alternatives, s.alternativas))}`, MARGIN + 5, y, w - MARGIN * 2 - 7, 3.8) + 1.5;
    });
    y += 1;
  }

  // Protocolos
  const protos: [string, any][] = [
    ["Protocolo pré-prova / corrida longa", plan.pre_race_gi_protocol],
    ["Estratégia intra-treino", plan.intra_workout_protocol],
    ["Ajustes nos dias de descanso", plan.rest_day_adjustments],
    ["Observações gerais", first(plan.general_notes, plan.observations)],
  ];
  protos.forEach(([lbl, val]) => {
    if (!val) return;
    y = sectionTitle(doc, lbl, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT);
    y = wrapText(doc, asText(val), MARGIN + 2, y, w - MARGIN * 2 - 4) + 3;
  });

  y = warningsBlock(doc, plan.warnings, y);
  stampFooters(doc, meta);
  return doc;
}

// ── Orquestrador ────────────────────────────────────────────────────────────
export interface GeneratedPDF { modality: string; label: string; doc: jsPDF; filename: string; }

export function generateAllPDFs(results: any, meta: PDFMeta): GeneratedPDF[] {
  const out: GeneratedPDF[] = [];
  const safeName = (meta.studentName || "Aluno").replace(/\s+/g, "_");

  if (results.musculacao) {
    out.push({ modality: "musculacao", label: "Musculação", doc: generateStrengthPDF(results.musculacao, meta), filename: `Musculacao_${safeName}.pdf` });
  }
  if (results.corrida) {
    out.push({ modality: "corrida", label: "Corrida", doc: generateCardioPDF(results.corrida, meta, "Corrida"), filename: `Corrida_${safeName}.pdf` });
  }
  if (results.natacao) {
    out.push({ modality: "natacao", label: "Natação", doc: generateCardioPDF(results.natacao, meta, "Natação"), filename: `Natacao_${safeName}.pdf` });
  }
  if (results.ciclismo) {
    out.push({ modality: "ciclismo", label: "Ciclismo", doc: generateCardioPDF(results.ciclismo, meta, "Ciclismo"), filename: `Ciclismo_${safeName}.pdf` });
  }
  if (results.nutricao) {
    out.push({ modality: "nutricao", label: "Nutrição", doc: generateNutritionPDF(results.nutricao, meta), filename: `Nutricao_${safeName}.pdf` });
  }
  return out;
}
