#!/usr/bin/env node
// =====================================================================================
// Testes OFFLINE do return guard (ORDEM 038).
// Gera fixtures TEMPORÁRIAS em os.tmpdir() (removidas ao final, NÃO commitadas) e chama o
// script real check-curation-review-return.mjs como subprocesso.
// NÃO conecta no banco. NÃO executa SQL. Exit 0 se todos os cenários passarem; 1 senão.
// =====================================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const GUARD = "scripts/prescription/check-curation-review-return.mjs";
const REAL_P1 = "docs/prescription/library-curation-v1-p1-human-review.csv";

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
const cell = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "returnguard-"));
const tmp = (n) => path.join(TMP, n);

// base: as primeiras N linhas reais do P1 (header + dados)
const rawRows = parseCsv(fs.readFileSync(REAL_P1, "utf8"));
const HEADER = rawRows[0];
const idx = Object.fromEntries(HEADER.map((h, i) => [h.trim(), i]));
const DATA = rawRows.slice(1, 5).map((r) => r.slice()); // 4 linhas p/ testes

function write(file, header, rows) {
  const L = [header.map(cell).join(",")];
  for (const r of rows) L.push(r.map(cell).join(","));
  fs.writeFileSync(file, L.join("\n") + "\n");
}
function clone(rows) { return rows.map((r) => r.slice()); }
function setCol(rows, rowIdx, col, val) { rows[rowIdx][idx[col]] = val; }

function run(sent, returned, prio) {
  const r = spawnSync(process.execPath, [GUARD, "--sent", sent, "--returned", returned, "--expect-priority", prio], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

const results = [];
const rec = (name, esperado, status, pass) => results.push({ name, esperado, observado: `exit=${status}`, pass });

// arquivo enviado base (sempre o mesmo)
const sent = tmp("sent.csv"); write(sent, HEADER, DATA);

// 1) unchanged_file_passes
{ const ret = tmp("c1.csv"); write(ret, HEADER, clone(DATA)); const r = run(sent, ret, "P1"); rec("unchanged_file_passes", "PASS(exit0)", r.status, r.status === 0); }

// 2) allowed_reviewer_fields_change_passes
{ const d = clone(DATA);
  setCol(d, 0, "reviewer_status", "approved");
  setCol(d, 0, "reviewer_name", "Prof. Teste");
  setCol(d, 0, "reviewed_at", "2026-06-16T15:00Z");
  setCol(d, 0, "reviewer_notes", "ok, cautela de ombro");
  setCol(d, 0, "approval_decision_reason", "validado");
  setCol(d, 0, "ready_for_upsert", "true");
  const ret = tmp("c2.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("allowed_reviewer_fields_change_passes", "PASS(exit0)", r.status, r.status === 0); }

// 3) exercise_id_changed_fails
{ const d = clone(DATA); setCol(d, 1, "exercise_id", "00000000-0000-0000-0000-000000000000"); const ret = tmp("c3.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("exercise_id_changed_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 4) exercise_name_changed_fails
{ const d = clone(DATA); setCol(d, 1, "exercise_name", "NOME ALTERADO"); const ret = tmp("c4.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("exercise_name_changed_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 5) max_priority_changed_fails
{ const d = clone(DATA); setCol(d, 1, "max_priority", "P2"); const ret = tmp("c5.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("max_priority_changed_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 6) row_removed_fails
{ const d = clone(DATA).slice(0, 3); const ret = tmp("c6.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("row_removed_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 7) row_added_fails
{ const d = clone(DATA); d.push(clone(DATA)[0].slice()); d[d.length - 1][idx.exercise_id] = "11111111-1111-1111-1111-111111111111"; const ret = tmp("c7.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("row_added_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 8) duplicate_id_fails (duplica id no devolvido, mantendo contagem != ? -> add linha duplicada)
{ const d = clone(DATA); d.push(clone(DATA)[0].slice()); const ret = tmp("c8.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("duplicate_id_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 9) invalid_status_fails
{ const d = clone(DATA); setCol(d, 0, "reviewer_status", "maybe"); const ret = tmp("c9.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("invalid_status_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 10) applied_status_fails
{ const d = clone(DATA); setCol(d, 0, "reviewer_status", "applied"); const ret = tmp("c10.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("applied_status_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 11) ready_true_without_approved_fails
{ const d = clone(DATA); setCol(d, 0, "reviewer_status", "needs_review"); setCol(d, 0, "ready_for_upsert", "true"); const ret = tmp("c11.csv"); write(ret, HEADER, d); const r = run(sent, ret, "P1"); rec("ready_true_without_approved_fails", "FAIL(exit1)", r.status, r.status === 1); }

// 12) wrong_priority_for_expected_fails (arquivo todo P2, --expect-priority P1; sent==returned)
{ const d = clone(DATA); d.forEach((_, i) => setCol(d, i, "max_priority", "P2"));
  const sentP2 = tmp("c12-sent.csv"); write(sentP2, HEADER, d);
  const retP2 = tmp("c12-ret.csv"); write(retP2, HEADER, clone(d));
  const r = run(sentP2, retP2, "P1"); rec("wrong_priority_for_expected_fails", "FAIL(exit1)", r.status, r.status === 1); }

const passN = results.filter((r) => r.pass).length;
console.log("=== Testes Return Guard (offline) ===");
console.log(`tmpdir: ${TMP}`);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  ::  esperado[${r.esperado}]  observado[${r.observado}]`);
console.log(`\nTOTAL: ${results.length} | PASS: ${passN} | FAIL: ${results.length - passN}`);
console.log("JSON_RESULTS=" + JSON.stringify(results));

fs.rmSync(TMP, { recursive: true, force: true });
console.log("tmp removido:", !fs.existsSync(TMP));
process.exit(passN === results.length ? 0 : 1);
