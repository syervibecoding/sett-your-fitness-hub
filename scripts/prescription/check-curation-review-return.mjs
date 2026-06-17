#!/usr/bin/env node
// =====================================================================================
// Guard OFFLINE do CSV devolvido pelo revisor (ORDEM 038).
// JavaScript ESM puro. Sem dependências externas. Usa apenas fs/path/process.
//
// Compara o CSV ENVIADO (sent) com o CSV DEVOLVIDO (returned) e bloqueia:
//   - mudança em campos PROTEGIDOS;
//   - linha removida/adicionada; exercise_id duplicado ou divergente;
//   - reviewer_status invalido/applied; ready_for_upsert=true sem approved.
// Roda ANTES do validate-curation-review-board.mjs. NAO conecta no banco, NAO executa SQL.
//
// Uso:
//   node scripts/prescription/check-curation-review-return.mjs \
//     --sent <csv> --returned <csv> [--expect-priority P1|P2|P3|any] [--report <md>]
//
// Exit: 0 se nao houver errors; 1 se houver errors. Warnings nao falham.
// =====================================================================================
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const out = { sent: null, returned: null, expectPriority: "any", report: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sent") out.sent = argv[++i];
    else if (a === "--returned") out.returned = argv[++i];
    else if (a === "--expect-priority") out.expectPriority = argv[++i];
    else if (a === "--report") out.report = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

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
const norm = (s) => (s ?? "").toString().trim();
const lc = (s) => norm(s).toLowerCase();

const PROTECTED_FIELDS = ["exercise_id", "exercise_name", "muscle_group", "max_priority", "risk_regions", "movement_patterns", "source_packages"];
const EDITABLE_FIELDS = ["suggested_contraindications", "suggested_pain_limitation_tags", "suggested_regressions", "suggested_equivalent_substitutes", "suggested_progressions", "suggested_equipment", "reviewer_status", "reviewer_name", "reviewed_at", "reviewer_notes", "approval_decision_reason", "ready_for_upsert"];
// header padrao do human-review (20 colunas; conflict_notes NAO e editavel -> protegido por padrao)
const REQUIRED_HEADERS = [...PROTECTED_FIELDS.slice(0, 7), "suggested_contraindications", "suggested_pain_limitation_tags", "suggested_regressions", "suggested_equivalent_substitutes", "suggested_progressions", "suggested_equipment", "conflict_notes", "reviewer_status", "reviewer_name", "reviewed_at", "reviewer_notes", "approval_decision_reason", "ready_for_upsert"];
const ALLOWED_STATUS = ["needs_review", "approved", "rejected", "needs_more_info", "applied"];

function readBool(v) {
  const t = lc(v);
  if (t === "") return { ok: true, value: false };
  if (t === "true") return { ok: true, value: true };
  if (t === "false") return { ok: true, value: false };
  return { ok: false, value: null };
}

function check({ sentPath, returnedPath, expectPriority }) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const counts = {
    total_sent_rows: 0, total_returned_rows: 0, changed_allowed_fields: 0, changed_protected_fields: 0,
    removed_rows: 0, added_rows: 0, duplicate_ids: 0,
  };

  // [1] existem
  if (!fs.existsSync(sentPath)) { err(`Arquivo enviado nao encontrado: ${sentPath}`); return { errors, warnings, counts }; }
  if (!fs.existsSync(returnedPath)) { err(`Arquivo devolvido nao encontrado: ${returnedPath}`); return { errors, warnings, counts }; }
  // [2][3] parseaveis
  let S, R;
  try { S = toObjects(parseCsv(fs.readFileSync(sentPath, "utf8"))); } catch (e) { err(`Falha ao parsear enviado: ${e.message}`); return { errors, warnings, counts }; }
  try { R = toObjects(parseCsv(fs.readFileSync(returnedPath, "utf8"))); } catch (e) { err(`Falha ao parsear devolvido: ${e.message}`); return { errors, warnings, counts }; }
  // [4] headers
  for (const h of REQUIRED_HEADERS) {
    if (!S.header.includes(h)) err(`Enviado sem header obrigatorio: ${h}`);
    if (!R.header.includes(h)) err(`Devolvido sem header obrigatorio: ${h}`);
  }
  if (errors.length) return { errors, warnings, counts };

  counts.total_sent_rows = S.records.length;
  counts.total_returned_rows = R.records.length;

  // colunas protegidas = todas as nao-editaveis presentes no header (inclui conflict_notes)
  const editableSet = new Set(EDITABLE_FIELDS);
  const protectedCols = R.header.filter((h) => !editableSet.has(h));

  // [8][9] duplicatas
  const dupIn = (recs, label) => {
    const seen = new Set(); let dup = 0;
    for (const r of recs) { const id = lc(r.exercise_id); if (seen.has(id)) { dup++; err(`exercise_id duplicado no ${label}: ${r.exercise_id}`); } seen.add(id); }
    return dup;
  };
  counts.duplicate_ids = dupIn(S.records, "enviado") + dupIn(R.records, "devolvido");

  const sentById = new Map(S.records.map((r) => [lc(r.exercise_id), r]));
  const retById = new Map(R.records.map((r) => [lc(r.exercise_id), r]));

  // [5] contagem igual
  if (S.records.length !== R.records.length) err(`Numero de linhas diferente: enviado=${S.records.length}, devolvido=${R.records.length}.`);
  // [6] removidas / [10] sent ⊆ returned
  for (const id of sentById.keys()) if (!retById.has(id)) { counts.removed_rows++; err(`Linha removida no devolvido: exercise_id=${sentById.get(id).exercise_id}`); }
  // [7] adicionadas / [11] returned ⊆ sent
  for (const id of retById.keys()) if (!sentById.has(id)) { counts.added_rows++; err(`Linha adicionada no devolvido: exercise_id=${retById.get(id).exercise_id}`); }

  // [12] campos protegidos inalterados; conta mudancas em editaveis (informativo)
  for (const [id, rRow] of retById) {
    const sRow = sentById.get(id);
    if (!sRow) continue;
    for (const col of protectedCols) {
      if (norm(sRow[col]) !== norm(rRow[col])) {
        counts.changed_protected_fields++;
        err(`Campo PROTEGIDO alterado (${col}) em exercise_id=${rRow.exercise_id}: "${sRow[col]}" -> "${rRow[col]}"`);
      }
    }
    for (const col of EDITABLE_FIELDS) {
      if (R.header.includes(col) && norm(sRow[col] ?? "") !== norm(rRow[col] ?? "")) counts.changed_allowed_fields++;
    }
  }

  // [13][14][15][16] regras no devolvido
  R.records.forEach((r, i) => {
    const line = i + 2;
    if (expectPriority && expectPriority !== "any" && lc(r.max_priority) !== lc(expectPriority))
      err(`linha ${line} (${r.exercise_id}): max_priority=${r.max_priority || "(vazio)"} != esperado ${expectPriority}.`);
    const st = lc(r.reviewer_status);
    if (!ALLOWED_STATUS.includes(st)) err(`linha ${line} (${r.exercise_id}): reviewer_status invalido: "${r.reviewer_status}".`);
    if (st === "applied") err(`linha ${line} (${r.exercise_id}): reviewer_status=applied nao permitido nesta fase.`);
    const rb = readBool(r.ready_for_upsert);
    if (!rb.ok) err(`linha ${line} (${r.exercise_id}): ready_for_upsert invalido: "${r.ready_for_upsert}".`);
    if (rb.ok && rb.value === true && st !== "approved") err(`linha ${line} (${r.exercise_id}): ready_for_upsert=true exige reviewer_status=approved (atual: ${st || "vazio"}).`);
  });

  return { errors, warnings, counts };
}

function buildReport({ args, result }) {
  const { counts, errors, warnings } = result;
  const L = [];
  L.push("# Relatório do Return Guard (offline)");
  L.push("");
  L.push("> Gerado por `scripts/prescription/check-curation-review-return.mjs` (ORDEM 038).");
  L.push("> **Offline** — não conecta no banco, não executa SQL, não altera dados.");
  L.push("");
  L.push(`## Resultado: ${errors.length === 0 ? "✅ PASS (0 errors)" : "❌ FAIL (" + errors.length + " errors)"}`);
  L.push("");
  L.push("## Entradas");
  L.push(`- Enviado: \`${args.sent}\``);
  L.push(`- Devolvido: \`${args.returned}\``);
  L.push(`- Prioridade esperada: \`${args.expectPriority}\``);
  L.push("");
  L.push("## Contagens");
  L.push("| métrica | valor |");
  L.push("|---|---|");
  for (const [k, v] of Object.entries(counts)) L.push(`| ${k} | ${v} |`);
  L.push(`| errors | ${errors.length} |`);
  L.push(`| warnings | ${warnings.length} |`);
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
  if (args.help || !args.sent || !args.returned) {
    console.log("Uso: node scripts/prescription/check-curation-review-return.mjs --sent <csv> --returned <csv> [--expect-priority P1|P2|P3|any] [--report <md>]");
    process.exit(args.help ? 0 : 1);
  }
  const result = check({ sentPath: args.sent, returnedPath: args.returned, expectPriority: args.expectPriority || "any" });
  const { counts, errors, warnings } = result;

  console.log("=== Return Guard (offline) ===");
  console.log(`sent: ${args.sent}`);
  console.log(`returned: ${args.returned}`);
  console.log(`expect-priority: ${args.expectPriority}`);
  for (const [k, v] of Object.entries(counts)) console.log(`${k}: ${v}`);
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);
  if (errors.length) { console.log("--- ERRORS ---"); errors.forEach((e) => console.log("  ❌ " + e)); }
  if (warnings.length) { console.log("--- WARNINGS ---"); warnings.forEach((w) => console.log("  ⚠️ " + w)); }

  if (args.report) {
    fs.mkdirSync(path.dirname(args.report), { recursive: true });
    fs.writeFileSync(args.report, buildReport({ args, result }));
    console.log(`relatorio escrito: ${args.report}`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
