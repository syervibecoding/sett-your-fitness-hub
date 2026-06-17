#!/usr/bin/env node
// =====================================================================================
// Gerador OFFLINE reutilizável de pacote humano de revisão por prioridade (ORDEM 034).
// JavaScript ESM puro. Sem dependências externas. Usa apenas fs/path/process.
//
// NÃO conecta no Supabase. NÃO executa SQL. NÃO altera dados. NÃO faz deploy.
// Lê o manifesto consolidado, filtra por max_priority e emite um CSV de revisão humana
// 100% needs_review (ready_for_upsert=false). Não aprova nada.
//
// Uso:
//   node scripts/prescription/build-human-review-packet.mjs \
//     --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
//     --priority P2 \
//     --out docs/prescription/library-curation-v1-p2-human-review.csv \
//     --report docs/prescription/library-curation-v1-p2-human-review-build-report.md
//
// Exit code: 0 se gerar corretamente; 1 se houver erro (ex.: prioridade sem linhas).
// =====================================================================================
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------- args ----------
function parseArgs(argv) {
  const out = { manifest: null, priority: null, out: null, report: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--priority") out.priority = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--report") out.report = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

// ---------- CSV ----------
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}
function toObjects(rows) {
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => { const o = {}; header.forEach((h, i) => (o[h] = (r[i] ?? "").trim())); return o; });
  return { header, records };
}
const cell = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
const nlist = (v) => (v || "").split(/[;|]/).map((x) => x.trim()).filter(Boolean);

const VALID_PRIORITIES = ["P1", "P2", "P3"];
const REQUIRED_MANIFEST_HEADERS = [
  "exercise_id", "exercise_name", "muscle_group", "max_priority", "risk_regions", "movement_patterns",
  "source_packages", "suggested_contraindications", "suggested_pain_limitation_tags",
  "suggested_regressions", "suggested_equivalent_substitutes", "suggested_progressions",
  "suggested_equipment", "conflict_notes",
];
// ordem amigável para humano
const OUT_HEADERS = [
  "exercise_id", "exercise_name", "muscle_group", "max_priority", "risk_regions", "movement_patterns",
  "source_packages", "suggested_contraindications", "suggested_pain_limitation_tags",
  "suggested_regressions", "suggested_equivalent_substitutes", "suggested_progressions",
  "suggested_equipment", "conflict_notes", "reviewer_status", "reviewer_name", "reviewed_at",
  "reviewer_notes", "approval_decision_reason", "ready_for_upsert",
];

function build({ manifestPath, priority }) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

  // [1] existe
  if (!fs.existsSync(manifestPath)) { err(`Manifesto nao encontrado: ${manifestPath}`); return { errors, warnings, rows: [], stats: null }; }
  if (!VALID_PRIORITIES.includes(priority)) { err(`--priority invalido: ${priority} (use P1|P2|P3).`); return { errors, warnings, rows: [], stats: null }; }
  // [2] parseavel
  let M;
  try { M = toObjects(parseCsv(fs.readFileSync(manifestPath, "utf8"))); }
  catch (e) { err(`Falha ao parsear manifesto: ${e.message}`); return { errors, warnings, rows: [], stats: null }; }
  // [3] headers
  for (const h of REQUIRED_MANIFEST_HEADERS) if (!M.header.includes(h)) err(`Manifesto sem header obrigatorio: ${h}`);
  if (errors.length) return { errors, warnings, rows: [], stats: null };

  const filtered = M.records.filter((r) => r.max_priority === priority);
  if (filtered.length === 0) { err(`Nenhuma linha com max_priority=${priority} no manifesto.`); return { errors, warnings, rows: [], stats: null }; }

  const seen = new Set();
  const rows = [];
  let confl = 0, multiReg = 0, multiSrc = 0;
  for (const r of filtered) {
    // [7] sem duplicata
    if (seen.has(r.exercise_id)) { err(`exercise_id duplicado no pacote: ${r.exercise_id}`); continue; }
    seen.add(r.exercise_id);
    if (r.conflict_notes.trim()) confl++;
    if (nlist(r.risk_regions).length >= 2) multiReg++;
    if (nlist(r.source_packages).length >= 2) multiSrc++;
    rows.push({
      exercise_id: r.exercise_id, exercise_name: r.exercise_name, muscle_group: r.muscle_group,
      max_priority: r.max_priority, risk_regions: r.risk_regions, movement_patterns: r.movement_patterns,
      source_packages: r.source_packages, suggested_contraindications: r.suggested_contraindications,
      suggested_pain_limitation_tags: r.suggested_pain_limitation_tags, suggested_regressions: r.suggested_regressions,
      suggested_equivalent_substitutes: r.suggested_equivalent_substitutes, suggested_progressions: r.suggested_progressions,
      suggested_equipment: r.suggested_equipment, conflict_notes: r.conflict_notes,
      reviewer_status: "needs_review", reviewer_name: "", reviewed_at: "",
      reviewer_notes: "", approval_decision_reason: "", ready_for_upsert: "false",
    });
  }

  // [4][5][6] invariantes
  if (!rows.every((r) => r.max_priority === priority)) err("Linha gerada com prioridade divergente.");
  if (!rows.every((r) => r.reviewer_status === "needs_review")) err("Linha gerada nao esta needs_review.");
  if (rows.some((r) => String(r.ready_for_upsert).toLowerCase() === "true")) err("Linha gerada com ready_for_upsert=true.");

  const stats = {
    priority, total_rows: rows.length, rows_with_conflict_notes: confl,
    rows_with_multiple_risk_regions: multiReg, rows_with_multiple_source_packages: multiSrc,
  };
  return { errors, warnings, rows, stats };
}

function writeCsv(outPath, rows) {
  const lines = [OUT_HEADERS.map(cell).join(",")];
  for (const r of rows) lines.push(OUT_HEADERS.map((h) => cell(r[h] ?? "")).join(","));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
}
function buildReport({ args, result }) {
  const { stats, errors, warnings } = result;
  const L = [];
  L.push("# Relatório de Build do Pacote Humano de Revisão — offline");
  L.push("");
  L.push("> Gerado por `scripts/prescription/build-human-review-packet.mjs` (ORDEM 034).");
  L.push("> **Offline** — não conecta no banco, não executa SQL, não altera dados.");
  L.push("");
  L.push(`## Status: ${errors.length ? "FAILED" : "OK"}`);
  L.push("");
  L.push("## Entradas");
  L.push(`- Manifesto: \`${args.manifest}\``);
  L.push(`- Prioridade: \`${args.priority}\``);
  L.push(`- Saída CSV: \`${args.out}\``);
  L.push("");
  L.push("## Contagens");
  if (stats) {
    L.push("| métrica | valor |");
    L.push("|---|---|");
    L.push(`| priority | ${stats.priority} |`);
    L.push(`| total_rows | ${stats.total_rows} |`);
    L.push(`| rows_with_conflict_notes | ${stats.rows_with_conflict_notes} |`);
    L.push(`| rows_with_multiple_risk_regions | ${stats.rows_with_multiple_risk_regions} |`);
    L.push(`| rows_with_multiple_source_packages | ${stats.rows_with_multiple_source_packages} |`);
  } else {
    L.push("- (sem estatísticas — erro de pré-condição)");
  }
  L.push(`- **errors:** ${errors.length}`);
  L.push(`- **warnings:** ${warnings.length}`);
  L.push("");
  L.push("> Todas as linhas geradas: `reviewer_status=needs_review`, `ready_for_upsert=false`. Nada aprovado.");
  L.push("");
  L.push("## Erros");
  if (errors.length === 0) L.push("- (nenhum)"); else errors.forEach((e) => L.push(`- ❌ ${e}`));
  L.push("");
  L.push("## Warnings");
  if (warnings.length === 0) L.push("- (nenhum)"); else warnings.forEach((w) => L.push(`- ⚠️ ${w}`));
  L.push("");
  return L.join("\n") + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.manifest || !args.priority || !args.out) {
    console.log("Uso: node scripts/prescription/build-human-review-packet.mjs --manifest <csv> --priority <P1|P2|P3> --out <csv> [--report <md>]");
    process.exit(args.help ? 0 : 1);
  }
  const result = build({ manifestPath: args.manifest, priority: args.priority });

  // só escreve CSV de dados se nao houver erro (senao deixa explicito no report)
  if (result.errors.length === 0) writeCsv(args.out, result.rows);

  const { stats, errors, warnings } = result;
  console.log("=== Build Human Review Packet (offline) ===");
  console.log(`priority: ${args.priority}`);
  if (stats) {
    console.log(`total_rows: ${stats.total_rows}`);
    console.log(`rows_with_conflict_notes: ${stats.rows_with_conflict_notes}`);
    console.log(`rows_with_multiple_risk_regions: ${stats.rows_with_multiple_risk_regions}`);
    console.log(`rows_with_multiple_source_packages: ${stats.rows_with_multiple_source_packages}`);
  }
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);
  console.log(`out: ${args.out}${result.errors.length ? " (NAO escrito por erro)" : ""}`);
  if (errors.length) { console.log("--- ERRORS ---"); errors.forEach((e) => console.log("  ❌ " + e)); }

  if (args.report) {
    fs.mkdirSync(path.dirname(args.report), { recursive: true });
    fs.writeFileSync(args.report, buildReport({ args, result }));
    console.log(`relatorio escrito: ${args.report}`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
