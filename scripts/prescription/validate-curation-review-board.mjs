#!/usr/bin/env node
// =====================================================================================
// Validador OFFLINE do Review Board de curadoria da biblioteca (ORDEM 030).
// JavaScript ESM puro. Sem dependências externas. Usa apenas fs/path/process.
//
// NÃO conecta no Supabase. NÃO executa SQL. NÃO altera dados. NÃO faz deploy.
// Única escrita possível: o relatório markdown, quando --report <path> for passado.
//
// Uso:
//   node scripts/prescription/validate-curation-review-board.mjs \
//     --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
//     --review   docs/prescription/library-curation-v1-review-board-p1.csv \
//     --expect-priority P1 \
//     --report   docs/prescription/library-curation-v1-review-board-p1-validation-report.md
//
// Exit code: 0 se nao houver errors; 1 se houver errors. Warnings nao falham.
// =====================================================================================
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------- args ----------
function parseArgs(argv) {
  const out = { manifest: null, review: null, expectPriority: "any", report: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--review") out.review = argv[++i];
    else if (a === "--expect-priority") out.expectPriority = argv[++i];
    else if (a === "--report") out.report = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

// ---------- CSV parser (RFC4180-ish: aspas, "" escapado, virgula/quebra dentro de aspas) ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  // ultimo campo/linha (se nao terminou com \n)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // remove linhas totalmente vazias
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function toObjects(rows) {
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
  return { header, records };
}

// ---------- normalizacao / listas ----------
const norm = (s) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
const isEmpty = (s) => (s ?? "").toString().trim() === "";
function splitList(v) {
  if (isEmpty(v)) return [];
  return v.split(/[;|,]/).map((x) => x.trim()).filter((x) => x.length > 0);
}
function countList(v) { return splitList(v).length; }
// Heuristica: token claramente NAO-exercicio (instrucao/descricao), nao apenas "ausente".
function looksLikeNonExercise(tok) {
  const t = tok.trim();
  if (t.startsWith("(")) return true;          // ex.: "(reduzir altura do step)"
  if (t.includes("—") || t.includes(" – ")) return true; // nota com travessao
  if (/\((reduzir|corretivo|assistido|leve|joelhos apoiados|base)/i.test(t)) return true;
  if (/^[A-Z0-9_]+$/.test(t) && t.length >= 6 && t.includes("_")) return true; // sentinela/codigo (SCREAMING_SNAKE), nao-exercicio
  return false;
}

const ALLOWED_STATUS = ["needs_review", "approved", "rejected", "needs_more_info", "applied"];
const REQUIRED_MANIFEST_HEADERS = ["exercise_id", "exercise_name", "max_priority"];
const REQUIRED_REVIEW_HEADERS = [
  "exercise_id", "exercise_name", "muscle_group", "source_packages", "risk_regions",
  "movement_patterns", "max_priority", "suggested_contraindications", "suggested_pain_limitation_tags",
  "suggested_regressions", "suggested_equivalent_substitutes", "suggested_progressions",
  "suggested_equipment", "conflict_notes", "reviewer_status", "reviewer_name", "reviewed_at",
  "reviewer_notes", "approval_decision_reason", "ready_for_upsert",
];

function readBool(v) {
  const t = norm(v);
  if (t === "" ) return { ok: true, value: false, empty: true };
  if (t === "true") return { ok: true, value: true, empty: false };
  if (t === "false") return { ok: true, value: false, empty: false };
  return { ok: false, value: null, empty: false };
}

// ---------- validacao principal ----------
function validate({ manifestPath, reviewPath, expectPriority }) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  // [1] arquivos existem
  if (!fs.existsSync(manifestPath)) { err(`Manifesto nao encontrado: ${manifestPath}`); return { errors, warnings, summary: null }; }
  if (!fs.existsSync(reviewPath)) { err(`Review CSV nao encontrado: ${reviewPath}`); return { errors, warnings, summary: null }; }

  // [2] CSV parseavel
  let manifestObj, reviewObj;
  try { manifestObj = toObjects(parseCsv(fs.readFileSync(manifestPath, "utf8"))); }
  catch (e) { err(`Falha ao parsear manifesto: ${e.message}`); return { errors, warnings, summary: null }; }
  try { reviewObj = toObjects(parseCsv(fs.readFileSync(reviewPath, "utf8"))); }
  catch (e) { err(`Falha ao parsear review CSV: ${e.message}`); return { errors, warnings, summary: null }; }

  // [3] headers manifesto
  for (const h of REQUIRED_MANIFEST_HEADERS)
    if (!manifestObj.header.includes(h)) err(`Manifesto sem header obrigatorio: ${h}`);
  // [4] headers review
  for (const h of REQUIRED_REVIEW_HEADERS)
    if (!reviewObj.header.includes(h)) err(`Review CSV sem header obrigatorio: ${h}`);
  if (errors.length) return { errors, warnings, summary: null };

  // conjuntos "conhecidos" = ids + nomes do manifesto
  const knownIds = new Set(manifestObj.records.map((r) => norm(r.exercise_id)));
  const knownNames = new Set(manifestObj.records.map((r) => norm(r.exercise_name)));
  const known = (tok) => knownIds.has(norm(tok)) || knownNames.has(norm(tok));

  const seenIds = new Set();
  const statusCounts = Object.fromEntries(ALLOWED_STATUS.map((s) => [s, 0]));
  statusCounts["(invalido/vazio)"] = 0;
  let readyTrue = 0;

  for (let idx = 0; idx < reviewObj.records.length; idx++) {
    const r = reviewObj.records[idx];
    const line = idx + 2; // +1 header, +1 base-1
    const tag = `linha ${line} (${r.exercise_id || "sem id"})`;

    // [5] exercise_id existe no manifesto
    if (!knownIds.has(norm(r.exercise_id))) err(`${tag}: exercise_id nao existe no manifesto.`);
    // [6] sem duplicatas
    if (seenIds.has(norm(r.exercise_id))) err(`${tag}: exercise_id duplicado no review.`);
    seenIds.add(norm(r.exercise_id));

    // [7] expect-priority
    if (expectPriority && expectPriority !== "any") {
      if (norm(r.max_priority) !== norm(expectPriority))
        err(`${tag}: max_priority=${r.max_priority || "(vazio)"} != esperado ${expectPriority}.`);
    }

    // [8] reviewer_status valido
    const st = norm(r.reviewer_status);
    if (!ALLOWED_STATUS.includes(st)) {
      err(`${tag}: reviewer_status invalido: "${r.reviewer_status}".`);
      statusCounts["(invalido/vazio)"]++;
    } else {
      statusCounts[st]++;
    }
    // [9] applied proibido nesta fase
    if (st === "applied") err(`${tag}: reviewer_status=applied nao permitido (so apos execucao controlada + reauditoria).`);

    // ready_for_upsert
    const rb = readBool(r.ready_for_upsert);
    if (!rb.ok) err(`${tag}: ready_for_upsert invalido: "${r.ready_for_upsert}" (use true/false/vazio).`);
    if (rb.ok && rb.value === true) readyTrue++;

    // [10] ready_for_upsert=true so quando approved
    if (rb.ok && rb.value === true && st !== "approved")
      err(`${tag}: ready_for_upsert=true exige reviewer_status=approved (atual: ${st || "vazio"}).`);

    // [11] approved exige reviewer_name, reviewed_at, approval_decision_reason, ready_for_upsert=true
    if (st === "approved") {
      if (isEmpty(r.reviewer_name)) err(`${tag}: approved exige reviewer_name preenchido.`);
      if (isEmpty(r.reviewed_at)) err(`${tag}: approved exige reviewed_at preenchido.`);
      if (isEmpty(r.approval_decision_reason)) err(`${tag}: approved exige approval_decision_reason preenchido.`);
      if (!(rb.ok && rb.value === true)) err(`${tag}: approved exige ready_for_upsert=true.`);
    }
    // [12] rejected exige reason + ready false/vazio
    if (st === "rejected") {
      if (isEmpty(r.approval_decision_reason)) err(`${tag}: rejected exige approval_decision_reason preenchido.`);
      if (rb.ok && rb.value === true) err(`${tag}: rejected exige ready_for_upsert=false ou vazio.`);
    }
    // [13] needs_more_info exige reviewer_notes + ready false/vazio
    if (st === "needs_more_info") {
      if (isEmpty(r.reviewer_notes)) err(`${tag}: needs_more_info exige reviewer_notes preenchido.`);
      if (rb.ok && rb.value === true) err(`${tag}: needs_more_info exige ready_for_upsert=false ou vazio.`);
    }
    // [14] needs_review exige ready false/vazio
    if (st === "needs_review") {
      if (rb.ok && rb.value === true) err(`${tag}: needs_review exige ready_for_upsert=false ou vazio.`);
    }

    // [15/16/17] approved sem reviewer_notes em casos sensiveis
    if (st === "approved") {
      if (!isEmpty(r.conflict_notes) && isEmpty(r.reviewer_notes))
        err(`${tag}: approved com conflict_notes exige reviewer_notes.`);
      if (countList(r.risk_regions) >= 2 && isEmpty(r.reviewer_notes))
        err(`${tag}: approved com multiplas risk_regions exige reviewer_notes.`);
      if (countList(r.source_packages) >= 2 && isEmpty(r.reviewer_notes))
        err(`${tag}: approved com multiplos source_packages exige reviewer_notes.`);
    }

    // [18/19/20] substitutes/regressions/progressions conhecidos quando preenchidos
    for (const [col, label] of [
      ["suggested_equivalent_substitutes", "substitute"],
      ["suggested_regressions", "regression"],
      ["suggested_progressions", "progression"],
    ]) {
      for (const tok of splitList(r[col])) {
        if (known(tok)) continue;
        if (looksLikeNonExercise(tok))
          err(`${tag}: ${label} claramente desconhecido/nao-exercicio: "${tok}" (campo ${col}).`);
        else
          warn(`${tag}: ${label} "${tok}" nao consta no manifesto (ambiguidade offline; confirmar na biblioteca). [${col}]`);
      }
    }
  }

  const summary = {
    manifestRows: manifestObj.records.length,
    reviewRows: reviewObj.records.length,
    statusCounts,
    readyTrue,
    expectPriority,
  };
  return { errors, warnings, summary };
}

// ---------- relatorio ----------
function buildReport({ args, result }) {
  const { summary, errors, warnings } = result;
  const L = [];
  L.push("# Relatório de Validação do Review Board (offline)");
  L.push("");
  L.push("> Gerado por `scripts/prescription/validate-curation-review-board.mjs` (ORDEM 030).");
  L.push("> **Validador offline** — não conecta no banco, não executa SQL, não altera dados.");
  L.push("");
  L.push("## Entradas");
  L.push(`- Manifesto: \`${args.manifest}\``);
  L.push(`- Review CSV: \`${args.review}\``);
  L.push(`- Prioridade esperada: \`${args.expectPriority}\``);
  L.push("");
  L.push("## Resumo");
  if (summary) {
    L.push(`- Linhas no manifesto: **${summary.manifestRows}**`);
    L.push(`- Linhas analisadas no review: **${summary.reviewRows}**`);
    L.push(`- \`ready_for_upsert=true\`: **${summary.readyTrue}**`);
    L.push("");
    L.push("### Total por `reviewer_status`");
    L.push("| status | total |");
    L.push("|---|---|");
    for (const [k, v] of Object.entries(summary.statusCounts)) {
      if (v > 0 || ALLOWED_STATUS.includes(k)) L.push(`| ${k} | ${v} |`);
    }
    L.push("");
  } else {
    L.push("- (Sem resumo — validação abortou em erro de pré-condição.)");
    L.push("");
  }
  L.push(`- **Errors:** ${errors.length}`);
  L.push(`- **Warnings:** ${warnings.length}`);
  L.push("");
  L.push(`## Resultado: ${errors.length === 0 ? "✅ PASS (0 errors)" : "❌ FAIL (" + errors.length + " errors)"}`);
  L.push("");
  L.push("## Erros");
  if (errors.length === 0) L.push("- (nenhum)");
  else errors.forEach((e) => L.push(`- ❌ ${e}`));
  L.push("");
  L.push("## Warnings");
  if (warnings.length === 0) L.push("- (nenhum)");
  else warnings.forEach((w) => L.push(`- ⚠️ ${w}`));
  L.push("");
  return L.join("\n") + "\n";
}

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.manifest || !args.review) {
    console.log("Uso: node scripts/prescription/validate-curation-review-board.mjs --manifest <csv> --review <csv> [--expect-priority P1|P2|P3|any] [--report <md>]");
    process.exit(args.help ? 0 : 1);
  }
  const result = validate({
    manifestPath: args.manifest,
    reviewPath: args.review,
    expectPriority: args.expectPriority || "any",
  });

  // saida no console
  const { summary, errors, warnings } = result;
  console.log("=== Validacao Review Board (offline) ===");
  console.log(`manifest: ${args.manifest}`);
  console.log(`review:   ${args.review}`);
  console.log(`expect-priority: ${args.expectPriority}`);
  if (summary) {
    console.log(`linhas analisadas: ${summary.reviewRows}`);
    console.log("por reviewer_status:");
    for (const [k, v] of Object.entries(summary.statusCounts)) if (v > 0) console.log(`  ${k}: ${v}`);
    console.log(`ready_for_upsert=true: ${summary.readyTrue}`);
  }
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);
  if (errors.length) { console.log("--- ERRORS ---"); errors.forEach((e) => console.log("  ❌ " + e)); }
  if (warnings.length) { console.log("--- WARNINGS ---"); warnings.forEach((w) => console.log("  ⚠️ " + w)); }

  // relatorio (unica escrita permitida)
  if (args.report) {
    const md = buildReport({ args, result });
    fs.mkdirSync(path.dirname(args.report), { recursive: true });
    fs.writeFileSync(args.report, md);
    console.log(`relatorio escrito: ${args.report}`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
