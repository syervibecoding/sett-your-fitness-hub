#!/usr/bin/env node
// =====================================================================================
// Manifesto + checksums do review outbox de revisão humana (ORDEM 046).
// JavaScript ESM puro. Sem dependências externas. Usa apenas fs/path/crypto/process.
//
// NÃO conecta no banco. NÃO executa SQL. Gera um JSON com sha256/linhas/prioridade/pacote
// de cada um dos 6 CSVs do outbox e valida que todos estão 100% needs_review (nada aprovado).
//
// Uso:
//   node scripts/prescription/build-human-review-outbox-manifest.mjs \
//     --outbox-dir docs/prescription/review-outbox/v1 \
//     --out docs/prescription/review-outbox/v1/review-outbox-manifest.json
//
// Exit: 0 se tudo OK; 1 em qualquer erro de validação.
// =====================================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

function parseArgs(argv) {
  const out = { outboxDir: null, out: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--outbox-dir") out.outboxDir = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--now") out.now = argv[++i];
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
const lc = (s) => (s ?? "").toString().trim().toLowerCase();

// os 6 arquivos esperados do outbox v1
const EXPECTED = [
  { file: "p1-core-human-review.csv", priority: "P1", pkg: "core" },
  { file: "p2-core-human-review.csv", priority: "P2", pkg: "core" },
  { file: "p3-core-human-review.csv", priority: "P3", pkg: "core" },
  { file: "p1-catalog-delta-human-review.csv", priority: "P1", pkg: "delta" },
  { file: "p2-catalog-delta-human-review.csv", priority: "P2", pkg: "delta" },
  { file: "p3-catalog-delta-human-review.csv", priority: "P3", pkg: "delta" },
];

function fail(msg) { console.error("ERROR: " + msg); process.exit(1); }

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.outboxDir || !args.out) {
    console.log("Uso: node scripts/prescription/build-human-review-outbox-manifest.mjs --outbox-dir <dir> --out <json>");
    process.exit(args.help ? 0 : 1);
  }
  // [1] pasta existe
  if (!fs.existsSync(args.outboxDir) || !fs.statSync(args.outboxDir).isDirectory())
    fail(`outbox-dir nao encontrado: ${args.outboxDir}`);

  const now = args.now || new Date().toISOString();
  const files = [];
  let totalRows = 0, totalApproved = 0, totalReady = 0;

  for (const spec of EXPECTED) {
    const fp = path.join(args.outboxDir, spec.file);
    // [2] arquivo existe
    if (!fs.existsSync(fp)) fail(`arquivo do outbox ausente: ${spec.file}`);
    const raw = fs.readFileSync(fp);
    const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
    // [3] CSV parseavel
    let obj;
    try { obj = toObjects(parseCsv(raw.toString("utf8"))); }
    catch (e) { fail(`falha ao parsear ${spec.file}: ${e.message}`); }
    // [7] prioridade bate com o nome
    if (!spec.file.toLowerCase().startsWith(spec.priority.toLowerCase()))
      fail(`prioridade do nome nao confere: ${spec.file} (esperado ${spec.priority})`);
    // [8] pacote core/delta
    const pkg = spec.file.includes("catalog-delta") ? "delta" : "core";
    if (pkg !== spec.pkg) fail(`pacote nao confere: ${spec.file}`);

    const recs = obj.records;
    const approved = recs.filter((r) => lc(r.reviewer_status) === "approved").length;
    const readyTrue = recs.filter((r) => lc(r.ready_for_upsert) === "true").length;
    const allNeeds = recs.every((r) => lc(r.reviewer_status) === "needs_review");
    // [4] todos needs_review
    if (!allNeeds) fail(`${spec.file}: nem todas as linhas estao needs_review`);
    // [5] nenhum ready=true
    if (readyTrue > 0) fail(`${spec.file}: ha ${readyTrue} linha(s) com ready_for_upsert=true`);
    // [6] nenhum approved
    if (approved > 0) fail(`${spec.file}: ha ${approved} linha(s) approved`);
    // [7b] toda linha bate a prioridade esperada
    const wrongPrio = recs.filter((r) => lc(r.max_priority) !== lc(spec.priority)).length;
    if (wrongPrio > 0) fail(`${spec.file}: ${wrongPrio} linha(s) com max_priority != ${spec.priority}`);

    totalRows += recs.length; totalApproved += approved; totalReady += readyTrue;
    files.push({
      file: spec.file, sha256, rows: recs.length, priority: spec.priority, package: pkg,
      expected_status: "needs_review", approved_rows: approved, ready_for_upsert_true: readyTrue,
    });
  }

  const manifest = {
    outbox_version: path.basename(args.outboxDir),
    generated_at: now,
    files,
    summary: {
      total_files: files.length,
      total_rows: totalRows,
      approved_rows: totalApproved,
      ready_for_upsert_true: totalReady,
    },
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(manifest, null, 2) + "\n");

  console.log("=== Review Outbox Manifest ===");
  console.log(`outbox: ${args.outboxDir}`);
  console.log(`files: ${files.length} | total_rows: ${totalRows} | approved_rows: ${totalApproved} | ready_true: ${totalReady}`);
  for (const f of files) console.log(`  ${f.file}  ${f.priority}/${f.package}  rows=${f.rows}  sha256=${f.sha256.slice(0, 12)}…`);
  console.log(`manifest escrito: ${args.out}`);
  process.exit(0);
}

main();
