#!/usr/bin/env node
// =====================================================================================
// Gerador OFFLINE protegido de SQL de upsert da curadoria (ORDEM 036).
// JavaScript ESM puro. Sem dependências externas. Usa apenas fs/path/process.
//
// NÃO conecta no Supabase. NÃO executa SQL. NÃO cria migration. NÃO altera o banco.
// Converte um APPROVED MANIFEST validado em SQL de upsert para exercise_metadata.
//   - mode=noop (default): só comentários + SELECT explicativo (sem INSERT/UPDATE ativo).
//   - mode=staging: gera upsert SOMENTE com --ack-human-approved YES_I_HAVE_REVIEWED_APPROVED_MANIFEST.
//   - mode=production: SEMPRE bloqueado nesta fase.
//
// Uso:
//   node scripts/prescription/build-curation-upsert-sql.mjs \
//     --approved docs/prescription/library-curation-v1-approved-manifest-p1.csv \
//     --out docs/prescription/library-curation-v1-approved-manifest-p1-upsert.noop.sql \
//     --mode noop
//
// Exit: 0 em sucesso (incl. no-op); 1 em erro/bloqueio.
// =====================================================================================
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ACK_TOKEN = "YES_I_HAVE_REVIEWED_APPROVED_MANIFEST";
const DEFAULT_TABLE = "exercise_metadata";

// ---- schema real de exercise_metadata (confirmado via information_schema, ORDEM 028/036) ----
// colunas existentes -> usadas. Demais campos do manifesto = SCHEMA_GAP (sem coluna).
const META_COLUMNS = {
  exercise_id: "uuid",
  contraindications: "text[]",
  pain_limitation_tags: "text[]",
  regressions: "text[]",
  progressions: "text[]",
  equivalent_substitutes: "uuid[]", // manifesto traz NOMES -> resolver para id via subquery
  notes: "text",
};
// campos do manifesto que NÃO têm coluna em exercise_metadata (não inventar coluna):
const SCHEMA_GAPS = [
  "equipment (vive em exercise_library.equipment, text unico; nao em exercise_metadata)",
  "muscle_group (sem coluna; insumo de curadoria)",
  "source_packages (sem coluna; bookkeeping)",
  "risk_regions (sem coluna; codificado em pain_limitation_tags)",
  "movement_patterns (sem coluna; insumo de curadoria)",
  "max_priority (sem coluna; bookkeeping)",
  "exercise_name (sem coluna; display/proveniencia -> vai em comentario)",
  "reviewer_name / reviewed_at (proveniencia -> dobrados em notes/comentario)",
];

function parseArgs(argv) {
  const out = { approved: null, out: null, table: DEFAULT_TABLE, mode: "noop", ack: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--approved") out.approved = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--table") out.table = argv[++i];
    else if (a === "--mode") out.mode = argv[++i];
    else if (a === "--ack-human-approved") out.ack = argv[++i];
    else if (a === "--now") out.now = argv[++i]; // p/ testes deterministicos
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

const REQUIRED_HEADERS = [
  "exercise_id", "exercise_name", "muscle_group", "source_packages", "risk_regions",
  "movement_patterns", "max_priority", "contraindications", "pain_limitation_tags", "regressions",
  "equivalent_substitutes", "progressions", "equipment", "reviewer_name", "reviewed_at",
  "approval_decision_reason", "reviewer_notes",
];
const REQUIRED_VALUES = ["exercise_id", "exercise_name", "contraindications", "pain_limitation_tags", "reviewer_name", "reviewed_at", "approval_decision_reason"];

const isEmpty = (s) => (s ?? "").toString().trim() === "";
const splitList = (v) => (isEmpty(v) ? [] : v.split(/[;|]/).map((x) => x.trim()).filter(Boolean));
// escape p/ SQL string literal (single quote -> doubled)
const sqlStr = (s) => "'" + String(s ?? "").replace(/'/g, "''") + "'";
const textArray = (arr) => (arr.length === 0 ? "'{}'::text[]" : "ARRAY[" + arr.map(sqlStr).join(", ") + "]::text[]");
// uuid[] resolvido por NOME contra exercise_library (offline nao resolve; emite subquery segura)
const uuidArrayFromNames = (names) =>
  names.length === 0
    ? "'{}'::uuid[]"
    : "ARRAY(SELECT id FROM public.exercise_library WHERE name = ANY(ARRAY[" + names.map(sqlStr).join(", ") + "]::text[]))";

function banner({ mode, approvedPath, table, totalRows, status, now }) {
  return [
    "-- =====================================================================================",
    "-- CURATION UPSERT SQL (GERADO POR build-curation-upsert-sql.mjs — ORDEM 036)",
    "-- DO NOT RUN WITHOUT BACKUP + STAGING + ATENA APPROVAL",
    "-- =====================================================================================",
    `-- source:        ${approvedPath}`,
    `-- mode:          ${mode}`,
    `-- table:         public.${table}`,
    `-- total rows:    ${totalRows}`,
    `-- status:        ${status}`,
    `-- generated_at:  ${now}`,
    "-- -------------------------------------------------------------------------------------",
    "-- SCHEMA_GAP (campos do manifesto SEM coluna em exercise_metadata — NAO inventar coluna):",
    ...SCHEMA_GAPS.map((g) => `--   * ${g}`),
    "-- Colunas-alvo reais usadas: " + Object.keys(META_COLUMNS).join(", "),
    "-- equivalent_substitutes e uuid[]: os NOMES sao resolvidos por subquery em exercise_library.",
    "-- =====================================================================================",
    "",
  ].join("\n");
}

function buildNoop({ mode, approvedPath, table, rows, now }) {
  const status = rows.length === 0 ? "NO_APPROVED_ROWS" : "NOOP_WITH_PENDING_ROWS";
  const L = [banner({ mode, approvedPath, table, totalRows: rows.length, status, now })];
  if (rows.length === 0) {
    L.push("-- Nenhuma linha aprovada. Nada a aplicar. SEM INSERT/UPDATE/DELETE/ALTER/CREATE.");
  } else {
    L.push(`-- ${rows.length} linha(s) aprovada(s) SERIAM processadas em staging (com ack). Aqui: SOMENTE comentario.`);
    L.push("-- exercise_id(s) que seriam upsertados:");
    for (const r of rows) L.push(`--   ${r.exercise_id}  (${r.exercise_name})`);
    L.push("-- Para gerar o upsert real: rode com --mode staging --ack-human-approved " + ACK_TOKEN);
  }
  L.push("");
  L.push("-- SELECT explicativo (read-only; nao altera dados):");
  L.push("SELECT");
  L.push(`  '${status}' AS status,`);
  L.push(`  ${rows.length} AS approved_rows_in_manifest,`);
  L.push(`  (SELECT count(*) FROM public.${table}) AS current_metadata_rows;`);
  L.push("");
  return L.join("\n");
}

function buildStagingUpsert({ approvedPath, table, rows, now }) {
  const L = [banner({ mode: "staging", approvedPath, table, totalRows: rows.length, status: "STAGING_UPSERT", now })];
  L.push("-- ATENCAO: rode SOMENTE em STAGING, com BACKUP, e troque ROLLBACK->COMMIT conscientemente.");
  L.push("BEGIN;");
  L.push("");
  L.push(`INSERT INTO public.${table} AS m (`);
  L.push("  exercise_id, contraindications, pain_limitation_tags, regressions, progressions, equivalent_substitutes, notes");
  L.push(") VALUES");
  const values = rows.map((r) => {
    const notes = `[approved_by ${r.reviewer_name} @ ${r.reviewed_at}] ${r.approval_decision_reason}` +
      (isEmpty(r.reviewer_notes) ? "" : ` | notes: ${r.reviewer_notes}`);
    return "  (" + [
      `${sqlStr(r.exercise_id)}::uuid`,
      textArray(splitList(r.contraindications)),
      textArray(splitList(r.pain_limitation_tags)),
      textArray(splitList(r.regressions)),
      textArray(splitList(r.progressions)),
      uuidArrayFromNames(splitList(r.equivalent_substitutes)),
      sqlStr(notes),
    ].join(", ") + ")";
  });
  L.push(values.join(",\n"));
  L.push("ON CONFLICT (exercise_id) DO UPDATE SET");
  L.push("  contraindications      = EXCLUDED.contraindications,");
  L.push("  pain_limitation_tags   = EXCLUDED.pain_limitation_tags,");
  L.push("  regressions            = EXCLUDED.regressions,");
  L.push("  progressions           = EXCLUDED.progressions,");
  L.push("  equivalent_substitutes = EXCLUDED.equivalent_substitutes,");
  L.push("  notes                  = EXCLUDED.notes,");
  L.push("  updated_at             = now();");
  L.push("");
  L.push("ROLLBACK; -- trocar para COMMIT SOMENTE apos backup + revisao em staging + aprovacao ATENA.");
  L.push("");
  return L.join("\n");
}

function fail(msg) { console.error("ERROR: " + msg); process.exit(1); }

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.approved || !args.out) {
    console.log("Uso: node scripts/prescription/build-curation-upsert-sql.mjs --approved <csv> --out <sql> [--table exercise_metadata] [--mode noop|staging|production] [--ack-human-approved <token>]");
    process.exit(args.help ? 0 : 1);
  }
  const now = args.now || new Date().toISOString();

  // [2] production sempre bloqueado nesta fase
  if (args.mode === "production") fail("Production SQL generation is not authorized by ATENA.");
  if (!["noop", "staging"].includes(args.mode)) fail(`--mode invalido: ${args.mode} (use noop|staging|production).`);

  if (!fs.existsSync(args.approved)) fail(`Approved manifest nao encontrado: ${args.approved}`);
  let M;
  try { M = toObjects(parseCsv(fs.readFileSync(args.approved, "utf8"))); }
  catch (e) { fail(`Falha ao parsear approved manifest: ${e.message}`); }

  // [10] headers obrigatorios
  for (const h of REQUIRED_HEADERS) if (!M.header.includes(h)) fail(`Approved manifest sem header obrigatorio: ${h}`);

  const rows = M.records;
  // [11] sem exercise_id duplicado
  const seen = new Set();
  for (const r of rows) {
    const id = (r.exercise_id || "").trim().toLowerCase();
    if (seen.has(id)) fail(`exercise_id duplicado no approved manifest: ${r.exercise_id}`);
    seen.add(id);
  }
  // [12] campos minimos por linha aprovada (quando houver linhas)
  rows.forEach((r, i) => {
    for (const f of REQUIRED_VALUES) if (isEmpty(r[f])) fail(`linha ${i + 2}: campo obrigatorio vazio em linha aprovada: ${f}`);
  });

  // modo staging: regras de ack
  if (args.mode === "staging") {
    if (rows.length > 0 && args.ack !== ACK_TOKEN)
      fail(`staging com linhas aprovadas exige --ack-human-approved ${ACK_TOKEN}`);
  }

  // gera conteudo
  let sql;
  if (args.mode === "staging" && rows.length > 0 && args.ack === ACK_TOKEN) {
    sql = buildStagingUpsert({ approvedPath: args.approved, table: args.table, rows, now });
  } else {
    // noop (default) OU staging com 0 linhas -> no-op seguro
    sql = buildNoop({ mode: args.mode, approvedPath: args.approved, table: args.table, rows, now });
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, sql);

  const status = rows.length === 0 ? "NO_APPROVED_ROWS"
    : (args.mode === "staging" && args.ack === ACK_TOKEN ? "STAGING_UPSERT" : "NOOP_WITH_PENDING_ROWS");
  console.log("=== Curation Upsert SQL Generator (offline) ===");
  console.log(`mode: ${args.mode}`);
  console.log(`approved: ${args.approved}`);
  console.log(`out: ${args.out}`);
  console.log(`approved_rows: ${rows.length}`);
  console.log(`status: ${status}`);
  console.log("NOTE: nenhum SQL foi executado; nenhuma conexao com banco; revisar antes de rodar.");
  process.exit(0);
}

main();
