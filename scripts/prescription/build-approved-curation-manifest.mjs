#!/usr/bin/env node
// =====================================================================================
// Gerador PROTEGIDO do approved_manifest da curadoria (ORDEM 031).
// JavaScript ESM puro. Sem dependências externas. Usa apenas fs/path/process.
//
// NÃO conecta no Supabase. NÃO executa SQL. NÃO altera dados. NÃO faz deploy.
// Emite SOMENTE linhas reviewer_status=approved + ready_for_upsert=true.
// Se não houver linha aprovada -> CSV só com header + status NO_APPROVED_ROWS (exit 0).
// Se houver erros -> NÃO gera CSV com dados e exit 1.
//
// Uso:
//   node scripts/prescription/build-approved-curation-manifest.mjs \
//     --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
//     --review   docs/prescription/library-curation-v1-review-board-p1.csv \
//     --expect-priority P1 \
//     --out      docs/prescription/library-curation-v1-approved-manifest-p1.csv \
//     --report   docs/prescription/library-curation-v1-approved-manifest-p1-report.md
// =====================================================================================
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------- args ----------
function parseArgs(argv) {
  const out = { manifest: null, review: null, out: null, report: null, expectPriority: "any" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--review") out.review = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--report") out.report = argv[++i];
    else if (a === "--expect-priority") out.expectPriority = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

// ---------- CSV parser (RFC4180-ish) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}
function toObjects(rows) {
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const o = {}; header.forEach((h, i) => (o[h] = (r[i] ?? "").trim())); return o;
  });
  return { header, records };
}

// ---------- helpers ----------
const norm = (s) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
const isEmpty = (s) => (s ?? "").toString().trim() === "";
function splitList(v) { return isEmpty(v) ? [] : v.split(/[;|,]/).map((x) => x.trim()).filter(Boolean); }
function countList(v) { return splitList(v).length; }
function looksLikeNonExercise(tok) {
  const t = tok.trim();
  if (t.startsWith("(")) return true;
  if (t.includes("—") || t.includes(" – ")) return true;
  if (/\((reduzir|corretivo|assistido|leve|joelhos apoiados|base)/i.test(t)) return true;
  if (/^[A-Z0-9_]+$/.test(t) && t.length >= 6 && t.includes("_")) return true; // sentinela/codigo (SCREAMING_SNAKE), nao-exercicio
  return false;
}
function readBool(v) {
  const t = norm(v);
  if (t === "") return { ok: true, value: false, empty: true };
  if (t === "true") return { ok: true, value: true, empty: false };
  if (t === "false") return { ok: true, value: false, empty: false };
  return { ok: false, value: null, empty: false };
}
const csvCell = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';

const ALLOWED_STATUS = ["needs_review", "approved", "rejected", "needs_more_info", "applied"];
const REQUIRED_MANIFEST_HEADERS = ["exercise_id", "exercise_name", "max_priority"];
const REQUIRED_REVIEW_HEADERS = [
  "exercise_id", "exercise_name", "muscle_group", "source_packages", "risk_regions",
  "movement_patterns", "max_priority", "suggested_contraindications", "suggested_pain_limitation_tags",
  "suggested_regressions", "suggested_equivalent_substitutes", "suggested_progressions",
  "suggested_equipment", "conflict_notes", "reviewer_status", "reviewer_name", "reviewed_at",
  "reviewer_notes", "approval_decision_reason", "ready_for_upsert",
];
// Saída: suggested_* -> nomes finais (sem prefixo).
const OUT_HEADERS = [
  "exercise_id", "exercise_name", "muscle_group", "source_packages", "risk_regions",
  "movement_patterns", "max_priority", "contraindications", "pain_limitation_tags", "regressions",
  "equivalent_substitutes", "progressions", "equipment", "reviewer_name", "reviewed_at",
  "approval_decision_reason", "reviewer_notes",
];

// ---------- core ----------
function build({ manifestPath, reviewPath, expectPriority }) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const counts = {
    total_review_rows: 0, approved_rows: 0, ready_for_upsert_rows: 0,
    skipped_needs_review: 0, skipped_rejected: 0, skipped_needs_more_info: 0,
  };

  // [1] existem
  if (!fs.existsSync(manifestPath)) { err(`Manifesto nao encontrado: ${manifestPath}`); return { errors, warnings, counts, outRows: [] }; }
  if (!fs.existsSync(reviewPath)) { err(`Review CSV nao encontrado: ${reviewPath}`); return { errors, warnings, counts, outRows: [] }; }
  // [2] parseaveis
  let M, R;
  try { M = toObjects(parseCsv(fs.readFileSync(manifestPath, "utf8"))); }
  catch (e) { err(`Falha ao parsear manifesto: ${e.message}`); return { errors, warnings, counts, outRows: [] }; }
  try { R = toObjects(parseCsv(fs.readFileSync(reviewPath, "utf8"))); }
  catch (e) { err(`Falha ao parsear review: ${e.message}`); return { errors, warnings, counts, outRows: [] }; }
  // [3][4] headers
  for (const h of REQUIRED_MANIFEST_HEADERS) if (!M.header.includes(h)) err(`Manifesto sem header obrigatorio: ${h}`);
  for (const h of REQUIRED_REVIEW_HEADERS) if (!R.header.includes(h)) err(`Review sem header obrigatorio: ${h}`);
  if (errors.length) return { errors, warnings, counts, outRows: [] };

  const knownIds = new Set(M.records.map((r) => norm(r.exercise_id)));
  const knownNames = new Set(M.records.map((r) => norm(r.exercise_name)));
  const known = (tok) => knownIds.has(norm(tok)) || knownNames.has(norm(tok));

  const seen = new Set();
  const outRows = [];
  counts.total_review_rows = R.records.length;

  for (let i = 0; i < R.records.length; i++) {
    const r = R.records[i];
    const line = i + 2;
    const tag = `linha ${line} (${r.exercise_id || "sem id"})`;

    // [5] id existe
    if (!knownIds.has(norm(r.exercise_id))) err(`${tag}: exercise_id nao existe no manifesto.`);
    // [6] duplicata
    if (seen.has(norm(r.exercise_id))) err(`${tag}: exercise_id duplicado no review.`);
    seen.add(norm(r.exercise_id));
    // [7] prioridade
    if (expectPriority && expectPriority !== "any" && norm(r.max_priority) !== norm(expectPriority))
      err(`${tag}: max_priority=${r.max_priority || "(vazio)"} != esperado ${expectPriority}.`);

    // [8] status valido
    const st = norm(r.reviewer_status);
    if (!ALLOWED_STATUS.includes(st)) err(`${tag}: reviewer_status invalido: "${r.reviewer_status}".`);
    // [9] applied proibido
    if (st === "applied") err(`${tag}: reviewer_status=applied nao permitido nesta fase.`);

    // ready_for_upsert
    const rb = readBool(r.ready_for_upsert);
    if (!rb.ok) err(`${tag}: ready_for_upsert invalido: "${r.ready_for_upsert}" (true/false/vazio).`);
    // [10] ready=true so com approved
    if (rb.ok && rb.value === true && st !== "approved")
      err(`${tag}: ready_for_upsert=true exige reviewer_status=approved (atual: ${st || "vazio"}).`);

    // contadores de skip
    if (st === "needs_review") counts.skipped_needs_review++;
    else if (st === "rejected") counts.skipped_rejected++;
    else if (st === "needs_more_info") counts.skipped_needs_more_info++;

    // [11] approved: pre-requisitos
    if (st === "approved") {
      counts.approved_rows++;
      if (isEmpty(r.reviewer_name)) err(`${tag}: approved exige reviewer_name.`);
      if (isEmpty(r.reviewed_at)) err(`${tag}: approved exige reviewed_at.`);
      if (isEmpty(r.approval_decision_reason)) err(`${tag}: approved exige approval_decision_reason.`);
      if (!(rb.ok && rb.value === true)) err(`${tag}: approved exige ready_for_upsert=true.`);
      // [12][13][14] reviewer_notes em casos sensiveis
      if (!isEmpty(r.conflict_notes) && isEmpty(r.reviewer_notes)) err(`${tag}: approved com conflict_notes exige reviewer_notes.`);
      if (countList(r.risk_regions) >= 2 && isEmpty(r.reviewer_notes)) err(`${tag}: approved com multiplas risk_regions exige reviewer_notes.`);
      if (countList(r.source_packages) >= 2 && isEmpty(r.reviewer_notes)) err(`${tag}: approved com multiplos source_packages exige reviewer_notes.`);
    }

    // [15][16] substitutes/regressions/progressions conhecidos
    for (const [col, label] of [
      ["suggested_equivalent_substitutes", "substitute"],
      ["suggested_regressions", "regression"],
      ["suggested_progressions", "progression"],
    ]) {
      for (const tok of splitList(r[col])) {
        if (known(tok)) continue;
        if (looksLikeNonExercise(tok)) err(`${tag}: ${label} claramente desconhecido/nao-exercicio: "${tok}" [${col}].`);
        else warn(`${tag}: ${label} "${tok}" nao consta no manifesto (ambiguidade offline; confirmar na biblioteca) [${col}].`);
      }
    }

    // [17] coletar linha de saida (approved + ready=true)
    if (st === "approved" && rb.ok && rb.value === true) {
      counts.ready_for_upsert_rows++;
      outRows.push({
        exercise_id: r.exercise_id, exercise_name: r.exercise_name, muscle_group: r.muscle_group,
        source_packages: r.source_packages, risk_regions: r.risk_regions, movement_patterns: r.movement_patterns,
        max_priority: r.max_priority, contraindications: r.suggested_contraindications,
        pain_limitation_tags: r.suggested_pain_limitation_tags, regressions: r.suggested_regressions,
        equivalent_substitutes: r.suggested_equivalent_substitutes, progressions: r.suggested_progressions,
        equipment: r.suggested_equipment, reviewer_name: r.reviewer_name, reviewed_at: r.reviewed_at,
        approval_decision_reason: r.approval_decision_reason, reviewer_notes: r.reviewer_notes,
      });
    }
  }

  return { errors, warnings, counts, outRows };
}

// ---------- saida ----------
function writeCsv(outPath, rows) {
  const lines = [OUT_HEADERS.map(csvCell).join(",")];
  for (const r of rows) lines.push(OUT_HEADERS.map((h) => csvCell(r[h])).join(","));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
}
function deriveStatus({ errors, outRows }) {
  if (errors.length) return "BLOCKED_BY_ERRORS";
  if (outRows.length === 0) return "NO_APPROVED_ROWS";
  return "APPROVED_MANIFEST_READY";
}
function buildReport({ args, result, status }) {
  const { counts, errors, warnings, outRows } = result;
  const L = [];
  L.push("# Relatório do Approved Manifest (curadoria) — offline");
  L.push("");
  L.push("> Gerado por `scripts/prescription/build-approved-curation-manifest.mjs` (ORDEM 031).");
  L.push("> **Offline** — não conecta no banco, não executa SQL, não altera dados.");
  L.push("");
  L.push(`## Status: ${status}`);
  L.push("");
  L.push("## Entradas");
  L.push(`- Manifesto: \`${args.manifest}\``);
  L.push(`- Review CSV: \`${args.review}\``);
  L.push(`- Prioridade esperada: \`${args.expectPriority}\``);
  L.push(`- Saída CSV: \`${args.out}\``);
  L.push("");
  L.push("## Contagens");
  L.push("| métrica | valor |");
  L.push("|---|---|");
  L.push(`| total_review_rows | ${counts.total_review_rows} |`);
  L.push(`| approved_rows | ${counts.approved_rows} |`);
  L.push(`| ready_for_upsert_rows | ${counts.ready_for_upsert_rows} |`);
  L.push(`| skipped_needs_review | ${counts.skipped_needs_review} |`);
  L.push(`| skipped_rejected | ${counts.skipped_rejected} |`);
  L.push(`| skipped_needs_more_info | ${counts.skipped_needs_more_info} |`);
  L.push(`| linhas no approved manifest (saída) | ${outRows.length} |`);
  L.push(`| errors | ${errors.length} |`);
  L.push(`| warnings | ${warnings.length} |`);
  L.push("");
  if (status === "NO_APPROVED_ROWS")
    L.push("> Nenhuma linha aprovada. CSV de saída contém **apenas o header**. Nada a aplicar.");
  if (status === "BLOCKED_BY_ERRORS")
    L.push("> Há erros. **Nenhum** approved manifest com dados foi gerado. Corrija e rode de novo.");
  L.push("");
  L.push("## Erros");
  if (errors.length === 0) L.push("- (nenhum)"); else errors.forEach((e) => L.push(`- ❌ ${e}`));
  L.push("");
  L.push("## Warnings");
  if (warnings.length === 0) L.push("- (nenhum)"); else warnings.forEach((w) => L.push(`- ⚠️ ${w}`));
  L.push("");
  return L.join("\n") + "\n";
}

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.manifest || !args.review || !args.out) {
    console.log("Uso: node scripts/prescription/build-approved-curation-manifest.mjs --manifest <csv> --review <csv> --out <csv> [--report <md>] [--expect-priority P1|P2|P3|any]");
    process.exit(args.help ? 0 : 1);
  }
  const result = build({ manifestPath: args.manifest, reviewPath: args.review, expectPriority: args.expectPriority || "any" });
  const status = deriveStatus(result);

  // [18][19] saida CSV: so escreve dados se NAO houver erro. Com erro -> nao gerar com dados.
  if (status === "BLOCKED_BY_ERRORS") {
    // nao gera CSV com dados; mantém intacto. (Opcional: poderia escrever header-only, mas o pedido
    // diz "nao gerar approved manifest com dados" — preservamos sem dados.)
    writeCsv(args.out, []); // header-only, sem dados
  } else {
    writeCsv(args.out, result.outRows); // header-only quando NO_APPROVED_ROWS
  }

  // console
  const { counts, errors, warnings } = result;
  console.log("=== Build Approved Manifest (offline) ===");
  console.log(`status: ${status}`);
  console.log(`total_review_rows: ${counts.total_review_rows}`);
  console.log(`approved_rows: ${counts.approved_rows}`);
  console.log(`ready_for_upsert_rows: ${counts.ready_for_upsert_rows}`);
  console.log(`skipped_needs_review: ${counts.skipped_needs_review}`);
  console.log(`skipped_rejected: ${counts.skipped_rejected}`);
  console.log(`skipped_needs_more_info: ${counts.skipped_needs_more_info}`);
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);
  console.log(`out: ${args.out} (linhas de dados: ${status === "BLOCKED_BY_ERRORS" ? 0 : result.outRows.length})`);
  if (errors.length) { console.log("--- ERRORS ---"); errors.forEach((e) => console.log("  ❌ " + e)); }
  if (warnings.length) { console.log(`--- WARNINGS (${warnings.length}) ---`); warnings.slice(0, 10).forEach((w) => console.log("  ⚠️ " + w)); if (warnings.length > 10) console.log(`  ... (+${warnings.length - 10} no relatório)`); }

  if (args.report) {
    fs.mkdirSync(path.dirname(args.report), { recursive: true });
    fs.writeFileSync(args.report, buildReport({ args, result, status }));
    console.log(`relatorio escrito: ${args.report}`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
