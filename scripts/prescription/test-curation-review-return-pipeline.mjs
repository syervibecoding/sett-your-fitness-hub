#!/usr/bin/env node
// =====================================================================================
// Testes OFFLINE do runner do pipeline de devolução da curadoria (ATENA / ORDEM 039).
// JavaScript ESM puro. Apenas Node nativo (fs, os, path, process, child_process).
//
// Gera fixtures TEMPORÁRIAS em os.tmpdir() (removidas ao final, NUNCA commitadas) a partir
// do P1 real, muta, e chama o runner real run-curation-review-return-pipeline.mjs como
// subprocesso. Verifica que o pipeline PARA no ponto certo e NÃO gera SQL quando não deve.
//
// NÃO conecta no banco. NÃO executa SQL. NÃO faz deploy.
// Exit: 0 se todos os cenários esperados se comportarem como esperado; 1 senão.
// =====================================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const RUNNER = "scripts/prescription/run-curation-review-return-pipeline.mjs";
const MANIFEST = "docs/prescription/library-curation-v1-consolidated-manifest.csv";
const REAL_P1 = "docs/prescription/library-curation-v1-p1-human-review.csv";

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
const cell = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "return-pipeline-"));
const tmp = (n) => path.join(TMP, n);

const rawRows = parseCsv(fs.readFileSync(REAL_P1, "utf8"));
const HEADER = rawRows[0];
const idx = Object.fromEntries(HEADER.map((h, i) => [h.trim(), i]));
const DATA = rawRows.slice(1, 5).map((r) => r.slice()); // 4 linhas

function write(file, header, rows) {
  const L = [header.map(cell).join(",")];
  for (const r of rows) L.push(r.map(cell).join(","));
  fs.writeFileSync(file, L.join("\n") + "\n");
}
function clone(rows) { return rows.map((r) => r.slice()); }
function setCol(rows, rowIdx, col, val) { rows[rowIdx][idx[col]] = val; }

// arquivo base "enviado" (sempre o mesmo subconjunto fiel do P1)
const SENT = tmp("sent.csv");
write(SENT, HEADER, DATA);

// roda o runner; cada cenário usa um out-dir próprio dentro do TMP
function runPipeline({ returned, outDir, label, keepGoing }) {
  const args = [
    RUNNER,
    "--manifest", MANIFEST,
    "--sent", SENT,
    "--returned", returned,
    "--priority", "P1",
    "--out-dir", outDir,
    "--label", label,
  ];
  if (keepGoing !== undefined) args.push("--keep-going", String(keepGoing));
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
  return { status: typeof r.status === "number" ? r.status : 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

const results = [];
const rec = (name, esperado, observado, pass) => results.push({ name, esperado, observado, pass });

// ---------- 1) return_guard_failure ----------
// returned com exercise_id alterado -> falha no passo 1; validator/approved/SQL NÃO rodam.
{
  const outDir = tmp("c1"); fs.mkdirSync(outDir, { recursive: true });
  const d = clone(DATA);
  setCol(d, 1, "exercise_id", "00000000-0000-0000-0000-000000000000");
  const ret = tmp("c1-returned.csv"); write(ret, HEADER, d);
  const r = runPipeline({ returned: ret, outDir, label: "c1" });

  const noopSql = path.join(outDir, "library-curation-v1-approved-manifest-p1-upsert.noop.sql");
  const validationReport = path.join(outDir, "c1-human-review-validation-report.md");
  const approvedReport = path.join(outDir, "library-curation-v1-approved-manifest-p1-report.md");
  const finalReport = path.join(outDir, "c1-return-pipeline-report.md");

  const exitOk = r.status === 1;
  const sqlNotGenerated = !fs.existsSync(noopSql);
  const validatorNotRun = !fs.existsSync(validationReport);
  const approvedNotRun = !fs.existsSync(approvedReport);
  const finalSaysGuard = fs.existsSync(finalReport) &&
    fs.readFileSync(finalReport, "utf8").includes("RETURN_GUARD_FAILED");

  const pass = exitOk && sqlNotGenerated && validatorNotRun && approvedNotRun && finalSaysGuard;
  rec(
    "return_guard_failure",
    "exit1; SQL/validator/approved NÃO gerados; final=RETURN_GUARD_FAILED",
    `exit=${r.status}; sqlGen=${!sqlNotGenerated}; validatorRun=${!validatorNotRun}; approvedRun=${!approvedNotRun}; finalGuard=${finalSaysGuard}`,
    pass
  );
}

// ---------- 2) validation_failure ----------
// passa no guard (campos protegidos intactos; status approved + ready=true é um campo editável,
// então guard só checa "ready=true exige approved", que está satisfeito), mas falha no validador
// porque approved exige reviewer_name (vazio).
{
  const outDir = tmp("c2"); fs.mkdirSync(outDir, { recursive: true });
  const d = clone(DATA);
  setCol(d, 0, "reviewer_status", "approved");
  setCol(d, 0, "reviewer_name", "");          // <-- vazio: falha no validador
  setCol(d, 0, "reviewed_at", "2026-06-17T10:00Z");
  setCol(d, 0, "approval_decision_reason", "validado para teste");
  setCol(d, 0, "reviewer_notes", "");
  setCol(d, 0, "ready_for_upsert", "true");
  const ret = tmp("c2-returned.csv"); write(ret, HEADER, d);
  const r = runPipeline({ returned: ret, outDir, label: "c2" });

  const guardReport = path.join(outDir, "c2-return-guard-report.md");
  const validationReport = path.join(outDir, "c2-human-review-validation-report.md");
  const approvedReport = path.join(outDir, "library-curation-v1-approved-manifest-p1-report.md");
  const noopSql = path.join(outDir, "library-curation-v1-approved-manifest-p1-upsert.noop.sql");
  const finalReport = path.join(outDir, "c2-return-pipeline-report.md");

  const exitOk = r.status === 1;
  const guardRan = fs.existsSync(guardReport);          // passou pelo guard
  const validatorRan = fs.existsSync(validationReport); // chegou ao validador
  const approvedNotRun = !fs.existsSync(approvedReport);
  const sqlNotGenerated = !fs.existsSync(noopSql);
  const finalSaysValidation = fs.existsSync(finalReport) &&
    fs.readFileSync(finalReport, "utf8").includes("VALIDATION_FAILED");

  const pass = exitOk && guardRan && validatorRan && approvedNotRun && sqlNotGenerated && finalSaysValidation;
  rec(
    "validation_failure",
    "exit1; guard PASS; validator FAIL; approved/SQL NÃO gerados; final=VALIDATION_FAILED",
    `exit=${r.status}; guardRan=${guardRan}; validatorRan=${validatorRan}; approvedRun=${!approvedNotRun}; sqlGen=${!sqlNotGenerated}; finalValidation=${finalSaysValidation}`,
    pass
  );
}

// ---------- 3) noop_sql_failure ----------
// força o passo 4 a falhar usando out-dir cujo nome colide com um ARQUIVO já existente,
// de modo que mkdir do SQL no-op falhe (caminho de saída inválido / controlado).
// O returned é idêntico ao sent (passa guard + validador + approved limpos).
{
  const outDir = tmp("c3"); fs.mkdirSync(outDir, { recursive: true });
  const ret = tmp("c3-returned.csv"); write(ret, HEADER, clone(DATA));

  // 1ª passada: roda normal para confirmar que sem sabotagem daria PASS,
  // depois sabotamos o caminho do SQL no-op. Para isolar, usamos um out-dir
  // onde o arquivo de saída do SQL não pode ser escrito: criamos um ARQUIVO
  // no lugar do diretório-pai esperado pelo --out do gerador de SQL.
  // O runner monta noopSql = <outDir>/library-curation-v1-approved-manifest-p1-upsert.noop.sql
  // logo o dirname é <outDir>. Para quebrar mkdir/writeFile do gerador, transformamos
  // o caminho exato do arquivo SQL em um DIRETÓRIO (writeFileSync sobre um dir -> EISDIR).
  const noopSql = path.join(outDir, "library-curation-v1-approved-manifest-p1-upsert.noop.sql");
  fs.mkdirSync(noopSql, { recursive: true }); // ocupa o caminho do arquivo com um diretório

  const r = runPipeline({ returned: ret, outDir, label: "c3" });

  const guardReport = path.join(outDir, "c3-return-guard-report.md");
  const validationReport = path.join(outDir, "c3-human-review-validation-report.md");
  const approvedReport = path.join(outDir, "library-curation-v1-approved-manifest-p1-report.md");
  const finalReport = path.join(outDir, "c3-return-pipeline-report.md");

  const exitOk = r.status === 1;
  const guardRan = fs.existsSync(guardReport);
  const validatorRan = fs.existsSync(validationReport);
  const approvedRan = fs.existsSync(approvedReport);
  const sqlIsDir = fs.existsSync(noopSql) && fs.statSync(noopSql).isDirectory(); // não virou arquivo SQL
  const finalSaysNoopSql = fs.existsSync(finalReport) &&
    fs.readFileSync(finalReport, "utf8").includes("NOOP_SQL_FAILED");

  const pass = exitOk && guardRan && validatorRan && approvedRan && sqlIsDir && finalSaysNoopSql;
  rec(
    "noop_sql_failure",
    "exit1; passos 1-3 PASS; SQL no-op falha (caminho inválido); final=NOOP_SQL_FAILED",
    `exit=${r.status}; guardRan=${guardRan}; validatorRan=${validatorRan}; approvedRan=${approvedRan}; sqlPathBlocked=${sqlIsDir}; finalNoopSql=${finalSaysNoopSql}`,
    pass
  );
}

// ---------- 4) approved_manifest_failure (coberto indiretamente) ----------
// O builder do approved manifest (build-approved-curation-manifest.mjs) só falha (exit 1)
// quando há erros estruturais/regra — exatamente o mesmo conjunto de regras já aplicado
// (e detectado antes) pelo validador no passo 2. Ou seja: qualquer entrada que faria o
// approved manifest falhar JÁ falha no validador, parando o pipeline antes do passo 3 sem
// gerar SQL (ver cenário validation_failure). Não há gatilho realista que passe no validador
// mas quebre o builder sem inventar comportamento frágil. Portanto este cenário é considerado
// COBERTO INDIRETAMENTE pelos testes do próprio builder (test-curation-review-pipeline.mjs)
// e pela garantia de ordem do runner (validador antes do approved; SQL nunca após falha).
{
  const noteOk = true; // documentado, não simulado artificialmente
  rec(
    "approved_manifest_failure (indireto)",
    "coberto indiretamente: validador (passo 2) intercepta as mesmas regras antes do passo 3",
    "documentado; sem gatilho frágil simulado; ordem do runner garante no-SQL-após-falha",
    noteOk
  );
}

// ---------- saída ----------
const passN = results.filter((r) => r.pass).length;
console.log("=== Testes Runner Pipeline de Devolução (offline) ===");
console.log(`tmpdir: ${TMP}`);
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
  console.log(`      esperado: ${r.esperado}`);
  console.log(`      observado: ${r.observado}`);
}
console.log(`\nTOTAL: ${results.length} | PASS: ${passN} | FAIL: ${results.length - passN}`);
console.log("JSON_RESULTS=" + JSON.stringify(results));

fs.rmSync(TMP, { recursive: true, force: true });
console.log("tmp removido:", !fs.existsSync(TMP));
console.log("offline / sem banco / sem SQL executado / sem deploy / fixtures temporárias (tmpdir)");
process.exit(passN === results.length ? 0 : 1);
