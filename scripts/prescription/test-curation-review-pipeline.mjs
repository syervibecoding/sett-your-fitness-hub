#!/usr/bin/env node
// =====================================================================================
// Testes OFFLINE do pipeline de revisão humana da curadoria (ORDEM 033).
// JavaScript ESM puro. Sem dependências externas. Usa apenas libs nativas do Node.
//
// Gera fixtures TEMPORÁRIAS em os.tmpdir() e chama os scripts REAIS como subprocessos:
//   - scripts/prescription/validate-curation-review-board.mjs
//   - scripts/prescription/build-approved-curation-manifest.mjs
// NÃO conecta no banco. NÃO executa SQL. NÃO altera arquivos do repo (saídas vão p/ tmp).
// As fixtures temporárias são removidas ao final (não são commitadas).
//
// Exit code: 0 se todos os cenários passarem; 1 se algum falhar.
// =====================================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const VALIDATOR = "scripts/prescription/validate-curation-review-board.mjs";
const BUILDER = "scripts/prescription/build-approved-curation-manifest.mjs";
const MANIFEST = "docs/prescription/library-curation-v1-consolidated-manifest.csv";
const REAL_REVIEW = "docs/prescription/library-curation-v1-p1-human-review.csv";

// ---------- CSV mínimo ----------
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
function readReview(p) {
  const rows = parseCsv(fs.readFileSync(p, "utf8"));
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => { const o = {}; header.forEach((h, i) => (o[h] = r[i] ?? "")); return o; });
  return { header, records };
}
const cell = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
function writeCsv(file, header, rows) {
  const lines = [header.map(cell).join(",")];
  for (const r of rows) lines.push(header.map((h) => cell(r[h] ?? "")).join(","));
  fs.writeFileSync(file, lines.join("\n") + "\n");
}

// ---------- runners ----------
function runValidator(reviewPath, priority) {
  const r = spawnSync(process.execPath, [VALIDATOR, "--manifest", MANIFEST, "--review", reviewPath, "--expect-priority", priority], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}
function runBuilder(reviewPath, priority, outPath, reportPath) {
  const args = [BUILDER, "--manifest", MANIFEST, "--review", reviewPath, "--expect-priority", priority, "--out", outPath];
  if (reportPath) args.push("--report", reportPath);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
  let outHeader = "", outDataRows = 0;
  if (fs.existsSync(outPath)) {
    const rows = parseCsv(fs.readFileSync(outPath, "utf8"));
    outHeader = (rows[0] || []).join(",");
    outDataRows = Math.max(0, rows.length - 1);
  }
  return { status: r.status, stdout: r.stdout || "", outHeader, outDataRows };
}

// ---------- harness ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "curation-pipeline-"));
const tmp = (name) => path.join(TMP, name);
const results = [];
function record(name, objetivo, esperado, observado, pass) { results.push({ name, objetivo, esperado, observado, pass }); }

const { header, records } = readReview(REAL_REVIEW);
const isP1 = (r) => (r.max_priority || "").trim() === "P1";
const nlist = (v) => (v || "").split(";").map((x) => x.trim()).filter(Boolean);
const p1 = records.filter(isP1);
const clean = p1.filter((r) => nlist(r.risk_regions).length <= 1 && nlist(r.source_packages).length <= 1 && !r.conflict_notes.trim());
const multiRegion = p1.find((r) => nlist(r.risk_regions).length >= 2);
const multiSource = p1.find((r) => nlist(r.source_packages).length >= 2 && nlist(r.risk_regions).length <= 1 && !r.conflict_notes.trim()) || p1.find((r) => nlist(r.source_packages).length >= 2);
const conflictRow = p1.find((r) => r.conflict_notes.trim());

const BASE = clean[0];
const BASE2 = clean[1];
function approvedFrom(src, over = {}) {
  return Object.assign({}, src, {
    reviewer_status: "approved",
    reviewer_name: "Prof. Teste (ATENA QA)",
    reviewed_at: "2026-06-16T15:00Z",
    approval_decision_reason: "Aprovado em teste offline (fixture temporaria).",
    reviewer_notes: "Nota de teste (fixture).",
    ready_for_upsert: "true",
  }, over);
}
function needsReviewFrom(src, over = {}) {
  return Object.assign({}, src, {
    reviewer_status: "needs_review", reviewer_name: "", reviewed_at: "",
    approval_decision_reason: "", reviewer_notes: "", ready_for_upsert: "false",
  }, over);
}

// ---- 1) current_p1_needs_review (usa CSV real como entrada; saída em tmp) ----
{
  const v = runValidator(REAL_REVIEW, "P1");
  const b = runBuilder(REAL_REVIEW, "P1", tmp("c1.csv"), tmp("c1-report.md"));
  const a0 = /approved_rows:\s*0/.test(b.stdout);
  const r0 = /ready_for_upsert_rows:\s*0/.test(b.stdout);
  const pass = v.status === 0 && b.status === 0 && b.outDataRows === 0 && a0 && r0;
  record("current_p1_needs_review", "P1 real 100% needs_review", "validator PASS; builder header-only; approved=0; ready=0",
    `validator=${v.status}; builder=${b.status}; dataRows=${b.outDataRows}; approved0=${a0}; ready0=${r0}`, pass);
}

// ---- 2) valid_single_approved (1 approved + 1 needs_review) ----
{
  const f = tmp("c2.csv");
  writeCsv(f, header, [approvedFrom(BASE), needsReviewFrom(BASE2)]);
  const v = runValidator(f, "P1");
  const b = runBuilder(f, "P1", tmp("c2-out.csv"), tmp("c2-report.md"));
  const finalNames = /(^|,)contraindications(,|$)/.test(b.outHeader) && !/suggested_contraindications/.test(b.outHeader);
  const pass = v.status === 0 && b.status === 0 && b.outDataRows === 1 && finalNames;
  record("valid_single_approved", "1 approved valido + 1 needs_review", "validator PASS; builder 1 linha; nomes finais; needs_review nao entra",
    `validator=${v.status}; builder=${b.status}; dataRows=${b.outDataRows}; finalNames=${finalNames}`, pass);
}

// ---- helper p/ cenarios negativos (validator deve falhar) ----
function negative(name, objetivo, esperado, rows, { alsoBuilder = false, expectOutRows = 0 } = {}) {
  const f = tmp(name + ".csv");
  writeCsv(f, header, rows);
  const v = runValidator(f, "P1");
  let obs = `validator=${v.status}`;
  let pass = v.status === 1;
  if (alsoBuilder) {
    const b = runBuilder(f, "P1", tmp(name + "-out.csv"), tmp(name + "-report.md"));
    obs += `; builder=${b.status}; dataRows=${b.outDataRows}`;
    pass = pass && b.outDataRows === expectOutRows;
  }
  record(name, objetivo, esperado, obs, pass);
}

// ---- 3) approved_missing_reviewer_name ----
negative("approved_missing_reviewer_name", "approved sem reviewer_name", "validator FALHA; builder nao gera dados",
  [approvedFrom(BASE, { reviewer_name: "" })], { alsoBuilder: true, expectOutRows: 0 });

// ---- 4) approved_missing_reason ----
negative("approved_missing_reason", "approved sem approval_decision_reason", "validator FALHA",
  [approvedFrom(BASE, { approval_decision_reason: "" })]);

// ---- 5) needs_review_ready_true ----
negative("needs_review_ready_true", "needs_review com ready_for_upsert=true", "validator FALHA; builder nao aprova",
  [needsReviewFrom(BASE, { ready_for_upsert: "true" })], { alsoBuilder: true, expectOutRows: 0 });

// ---- 6) applied_status_rejected_by_pipeline ----
negative("applied_status_rejected_by_pipeline", "reviewer_status=applied", "validator FALHA; builder FALHA",
  [Object.assign({}, BASE, { reviewer_status: "applied", ready_for_upsert: "false" })], { alsoBuilder: true, expectOutRows: 0 });

// ---- 7) rejected_without_reason ----
negative("rejected_without_reason", "rejected sem motivo", "validator FALHA",
  [Object.assign({}, needsReviewFrom(BASE), { reviewer_status: "rejected", approval_decision_reason: "", ready_for_upsert: "false" })]);

// ---- 8) needs_more_info_without_notes ----
negative("needs_more_info_without_notes", "needs_more_info sem reviewer_notes", "validator FALHA",
  [Object.assign({}, needsReviewFrom(BASE), { reviewer_status: "needs_more_info", reviewer_notes: "", ready_for_upsert: "false" })]);

// ---- 9) approved_with_conflict_without_notes ----
negative("approved_with_conflict_without_notes", "approved com conflict_notes sem reviewer_notes", "validator FALHA",
  [approvedFrom(conflictRow, { reviewer_notes: "" })]);

// ---- 10) unknown_substitute ----
negative("unknown_substitute", "approved com substitute claramente inexistente", "validator FALHA (erro, nao warning); builder nao gera essa linha",
  [approvedFrom(BASE, { suggested_equivalent_substitutes: "EXERCICIO_INEXISTENTE_ATENA_TESTE" })], { alsoBuilder: true, expectOutRows: 0 });

// ---- 11) duplicate_exercise_id ----
negative("duplicate_exercise_id", "exercise_id duplicado", "validator FALHA",
  [needsReviewFrom(BASE), needsReviewFrom(BASE)]);

// ---- 12) wrong_priority_for_p1 ----
negative("wrong_priority_for_p1", "max_priority=P2 com --expect-priority P1", "validator FALHA",
  [Object.assign({}, needsReviewFrom(BASE), { max_priority: "P2" })]);

// ---- 13) invalid_status ----
negative("invalid_status", "reviewer_status=maybe", "validator FALHA",
  [Object.assign({}, needsReviewFrom(BASE), { reviewer_status: "maybe" })]);

// ---- 14) approved_multiple_risk_regions_requires_notes ----
negative("approved_multiple_risk_regions_requires_notes", "approved multi risk_regions sem reviewer_notes", "validator FALHA",
  [approvedFrom(multiRegion, { reviewer_notes: "" })]);

// ---- 15) approved_multiple_sources_requires_notes ----
negative("approved_multiple_sources_requires_notes", "approved multi source_packages sem reviewer_notes", "validator FALHA",
  [approvedFrom(multiSource, { reviewer_notes: "" })]);

// ---------- saída ----------
const passCount = results.filter((r) => r.pass).length;
const failCount = results.length - passCount;
console.log("=== Testes Offline do Pipeline de Revisao (ORDEM 033) ===");
console.log(`tmpdir: ${TMP}`);
console.log("");
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  ::  esperado[${r.esperado}]  observado[${r.observado}]`);
console.log("");
console.log(`TOTAL: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);

// emite JSON p/ facilitar geracao de relatorio externo
console.log("JSON_RESULTS=" + JSON.stringify(results));

// limpeza das fixtures temporarias (nao commitar)
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* noop */ }

process.exit(failCount === 0 ? 0 : 1);
