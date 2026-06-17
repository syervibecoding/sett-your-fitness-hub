#!/usr/bin/env node
// =====================================================================================
// Runner OFFLINE do pipeline de devolução da curadoria (ATENA / ORDEM 039).
// JavaScript ESM puro. Apenas Node nativo (fs, path, process, child_process). Sem deps.
//
// Encadeia, NESTA ORDEM, os 4 scripts já existentes (cada um via subprocesso):
//   1) check-curation-review-return.mjs    (return guard)
//   2) validate-curation-review-board.mjs  (validador do review board)
//   3) build-approved-curation-manifest.mjs (approved manifest protegido)
//   4) build-curation-upsert-sql.mjs        (SQL — SEMPRE --mode noop)
//
// PARA NO PRIMEIRO ERRO. Mesmo com --keep-going true, NUNCA gera SQL se o return guard
// OU o validador falharem.
//
// NÃO conecta no banco. NÃO executa SQL. NÃO faz deploy. NÃO toca flag/cutover.
// Única escrita: relatórios markdown / CSV / SQL no-op gerados pelos scripts subjacentes,
// mais o relatório final do pipeline.
//
// Uso:
//   node scripts/prescription/run-curation-review-return-pipeline.mjs \
//     --manifest <csv> --sent <csv> --returned <csv> \
//     --priority P1|P2|P3 --out-dir <dir> [--label <short>] [--keep-going false|true]
//
// Exit: 0 se todos os passos passarem; 1 se qualquer passo falhar.
// =====================================================================================
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const SCRIPTS_DIR = "scripts/prescription";
const SCRIPT = {
  guard: path.join(SCRIPTS_DIR, "check-curation-review-return.mjs"),
  validator: path.join(SCRIPTS_DIR, "validate-curation-review-board.mjs"),
  approved: path.join(SCRIPTS_DIR, "build-approved-curation-manifest.mjs"),
  sql: path.join(SCRIPTS_DIR, "build-curation-upsert-sql.mjs"),
};

// ---------- args ----------
function parseArgs(argv) {
  const out = {
    manifest: null, sent: null, returned: null, priority: null,
    outDir: null, label: null, keepGoing: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--sent") out.sent = argv[++i];
    else if (a === "--returned") out.returned = argv[++i];
    else if (a === "--priority") out.priority = argv[++i];
    else if (a === "--out-dir") out.outDir = argv[++i];
    else if (a === "--label") out.label = argv[++i];
    else if (a === "--keep-going") out.keepGoing = String(argv[++i]).toLowerCase() === "true";
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function usage() {
  console.log(
    "Uso: node scripts/prescription/run-curation-review-return-pipeline.mjs " +
      "--manifest <csv> --sent <csv> --returned <csv> --priority P1|P2|P3 --out-dir <dir> " +
      "[--label <short>] [--keep-going false|true]"
  );
}

// ---------- helpers ----------
function runScript(scriptPath, args) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return {
    status: typeof r.status === "number" ? r.status : 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    error: r.error ? r.error.message : null,
  };
}

// extrai "| metrica | valor |" de uma tabela markdown
function parseMetricFromReport(reportPath, metric) {
  try {
    if (!fs.existsSync(reportPath)) return null;
    const text = fs.readFileSync(reportPath, "utf8");
    const re = new RegExp("\\|\\s*" + metric + "\\s*\\|\\s*([0-9]+)\\s*\\|");
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

const VALID_PRIORITIES = ["P1", "P2", "P3"];

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  const missing = [];
  if (!args.manifest) missing.push("--manifest");
  if (!args.sent) missing.push("--sent");
  if (!args.returned) missing.push("--returned");
  if (!args.priority) missing.push("--priority");
  if (!args.outDir) missing.push("--out-dir");
  if (missing.length) {
    console.error("ERROR: argumentos obrigatórios ausentes: " + missing.join(", "));
    usage();
    process.exit(1);
  }
  if (!VALID_PRIORITIES.includes(args.priority)) {
    console.error(`ERROR: --priority inválida: ${args.priority} (use P1|P2|P3).`);
    process.exit(1);
  }

  const priority = args.priority;
  const label = args.label || `library-curation-v1-${priority.toLowerCase()}`;
  const outDir = args.outDir;
  fs.mkdirSync(outDir, { recursive: true });

  // nomes de saída (alinhados ao spec da ORDEM 039)
  const F = {
    guardReport: path.join(outDir, `${label}-return-guard-report.md`),
    validationReport: path.join(outDir, `${label}-human-review-validation-report.md`),
    approvedManifest: path.join(outDir, `library-curation-v1-approved-manifest-${priority.toLowerCase()}.csv`),
    approvedReport: path.join(outDir, `library-curation-v1-approved-manifest-${priority.toLowerCase()}-report.md`),
    noopSql: path.join(outDir, `library-curation-v1-approved-manifest-${priority.toLowerCase()}-upsert.noop.sql`),
    finalReport: path.join(outDir, `${label}-return-pipeline-report.md`),
  };

  const timestamp = new Date().toISOString();
  const steps = []; // { n, name, status, code, finalStatus, script, reportPath }
  let pipelineFailed = false;
  let abortReason = null;

  const recordStep = (n, name, run, finalStatus, reportPath) => {
    const ok = run.status === 0;
    steps.push({
      n,
      name,
      ok,
      code: run.status,
      finalStatus: ok ? "PASS" : finalStatus,
      reportPath: reportPath || null,
      stderr: run.stderr.trim(),
      spawnError: run.error,
    });
    return ok;
  };

  console.log("=== Curation Return Pipeline (offline) ===");
  console.log(`label: ${label}`);
  console.log(`priority: ${priority}`);
  console.log(`manifest: ${args.manifest}`);
  console.log(`sent: ${args.sent}`);
  console.log(`returned: ${args.returned}`);
  console.log(`out-dir: ${outDir}`);
  console.log(`keep-going: ${args.keepGoing}`);
  console.log("");

  // ---------- STEP 1: return guard ----------
  console.log("[1/4] return guard ...");
  const guardRun = runScript(SCRIPT.guard, [
    "--sent", args.sent,
    "--returned", args.returned,
    "--expect-priority", priority,
    "--report", F.guardReport,
  ]);
  const guardOk = recordStep(1, "return_guard", guardRun, "RETURN_GUARD_FAILED", F.guardReport);
  if (!guardOk) {
    pipelineFailed = true;
    abortReason = "RETURN_GUARD_FAILED";
    // HARD RULE: return guard falhou -> NUNCA roda validator/approved/SQL, mesmo com keep-going.
    console.log("  -> RETURN_GUARD_FAILED (parando antes do validador / approved / SQL).");
    return finish();
  }

  // ---------- STEP 2: validador ----------
  console.log("[2/4] validador do review board ...");
  const validatorRun = runScript(SCRIPT.validator, [
    "--manifest", args.manifest,
    "--review", args.returned,
    "--expect-priority", priority,
    "--report", F.validationReport,
  ]);
  const validatorOk = recordStep(2, "validator", validatorRun, "VALIDATION_FAILED", F.validationReport);
  if (!validatorOk) {
    pipelineFailed = true;
    abortReason = "VALIDATION_FAILED";
    // HARD RULE: validador falhou -> NUNCA gera SQL, mesmo com keep-going.
    console.log("  -> VALIDATION_FAILED (parando antes do approved / SQL).");
    return finish();
  }

  // ---------- STEP 3: approved manifest ----------
  console.log("[3/4] approved manifest ...");
  const approvedRun = runScript(SCRIPT.approved, [
    "--manifest", args.manifest,
    "--review", args.returned,
    "--expect-priority", priority,
    "--out", F.approvedManifest,
    "--report", F.approvedReport,
  ]);
  const approvedOk = recordStep(3, "approved_manifest", approvedRun, "APPROVED_MANIFEST_FAILED", F.approvedReport);
  if (!approvedOk) {
    pipelineFailed = true;
    abortReason = "APPROVED_MANIFEST_FAILED";
    // approved falhou -> NUNCA gera SQL.
    console.log("  -> APPROVED_MANIFEST_FAILED (parando antes do SQL).");
    return finish();
  }

  // ---------- STEP 4: SQL no-op (SEMPRE noop) ----------
  console.log("[4/4] SQL no-op (mode noop) ...");
  const sqlRun = runScript(SCRIPT.sql, [
    "--approved", F.approvedManifest,
    "--out", F.noopSql,
    "--mode", "noop",
  ]);
  const sqlOk = recordStep(4, "noop_sql", sqlRun, "NOOP_SQL_FAILED", F.noopSql);
  if (!sqlOk) {
    pipelineFailed = true;
    abortReason = "NOOP_SQL_FAILED";
    console.log("  -> NOOP_SQL_FAILED.");
  }

  return finish();

  // ---------- relatório final + saída ----------
  function finish() {
    const finalStatus = pipelineFailed ? "FAIL" : "PASS";
    const approvedRows = parseMetricFromReport(F.approvedReport, "approved_rows");
    const readyRows = parseMetricFromReport(F.approvedReport, "ready_for_upsert_rows");

    // relatórios markdown gerados pelos passos (o CSV e o SQL no-op são listados à parte)
    const generated = steps
      .filter((s) => s.reportPath && s.reportPath !== F.noopSql && fs.existsSync(s.reportPath))
      .map((s) => s.reportPath);

    const L = [];
    L.push("# Relatório do Pipeline de Devolução da Curadoria (offline)");
    L.push("");
    L.push("> Gerado por `scripts/prescription/run-curation-review-return-pipeline.mjs` (ATENA / ORDEM 039).");
    L.push("> **Offline** — encadeia return guard → validador → approved manifest → SQL no-op → este relatório.");
    L.push("");
    L.push(`## Status final: ${finalStatus === "PASS" ? "✅ PASS" : "❌ FAIL"}`);
    if (abortReason) L.push(`\n- Motivo da parada: **${abortReason}**`);
    L.push("");
    L.push("## Entradas");
    L.push(`- Label: \`${label}\``);
    L.push(`- Prioridade: \`${priority}\``);
    L.push(`- Manifesto: \`${args.manifest}\``);
    L.push(`- Enviado (sent): \`${args.sent}\``);
    L.push(`- Devolvido (returned): \`${args.returned}\``);
    L.push(`- Out-dir: \`${outDir}\``);
    L.push(`- keep-going: \`${args.keepGoing}\``);
    L.push(`- Timestamp: \`${timestamp}\``);
    L.push("");
    L.push("## Status por passo");
    L.push("| # | passo | resultado | exit |");
    L.push("|---|---|---|---|");
    const stepNames = { 1: "return guard", 2: "validador", 3: "approved manifest", 4: "SQL no-op" };
    for (let n = 1; n <= 4; n++) {
      const s = steps.find((x) => x.n === n);
      if (s) L.push(`| ${n} | ${stepNames[n]} | ${s.finalStatus} | ${s.code} |`);
      else L.push(`| ${n} | ${stepNames[n]} | NÃO EXECUTADO | — |`);
    }
    L.push("");
    L.push("## Relatórios e artefatos gerados");
    if (generated.length === 0) {
      L.push("- (nenhum)");
    } else {
      for (const g of generated) L.push(`- \`${g}\``);
    }
    if (fs.existsSync(F.approvedManifest)) L.push(`- \`${F.approvedManifest}\` (approved manifest CSV)`);
    if (fs.existsSync(F.noopSql)) L.push(`- \`${F.noopSql}\` (SQL no-op)`);
    L.push("");
    L.push("## Métricas do approved manifest");
    L.push("| métrica | valor |");
    L.push("|---|---|");
    L.push(`| approved_rows | ${approvedRows === null ? "n/d" : approvedRows} |`);
    L.push(`| ready_for_upsert_rows | ${readyRows === null ? "n/d" : readyRows} |`);
    L.push("| SQL mode | noop |");
    L.push("");
    L.push("## Confirmações de segurança");
    L.push("- offline");
    L.push("- sem banco");
    L.push("- sem SQL executado");
    L.push("- sem dados aplicados");
    L.push("- sem deploy");
    L.push("- sem flag");
    L.push("- sem cutover");
    L.push("");
    if (pipelineFailed) {
      L.push("## Erros capturados");
      for (const s of steps) {
        if (s.ok) continue;
        L.push(`### Passo ${s.n} (${stepNames[s.n]}) — ${s.finalStatus}`);
        if (s.spawnError) L.push(`- spawn error: ${s.spawnError}`);
        if (s.stderr) {
          L.push("```");
          L.push(s.stderr);
          L.push("```");
        }
        L.push("");
      }
    }

    fs.writeFileSync(F.finalReport, L.join("\n") + "\n");

    console.log("");
    console.log(`status final: ${finalStatus}`);
    if (abortReason) console.log(`abort reason: ${abortReason}`);
    console.log(`approved_rows: ${approvedRows === null ? "n/d" : approvedRows}`);
    console.log(`ready_for_upsert_rows: ${readyRows === null ? "n/d" : readyRows}`);
    console.log("SQL mode: noop");
    console.log(`relatório final: ${F.finalReport}`);
    console.log("offline / sem banco / sem SQL executado / sem dados aplicados / sem deploy / sem flag / sem cutover");

    process.exit(pipelineFailed ? 1 : 0);
  }
}

main();
