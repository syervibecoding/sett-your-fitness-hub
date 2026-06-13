// Seed APENAS os dados de referência da réplica (sem criar empresa/admin).
// Conserta a biblioteca de exercícios e demais dados que ficaram para trás no Bn-app.
//
// Uso:
//   TARGET_SUPABASE_URL="https://zshrcgbyhzxpnlccssyz.supabase.co" \
//   TARGET_SUPABASE_SERVICE_ROLE_KEY="<service_role_key_do_bn_app>" \
//   [TARGET_COMPANY_ID="<uuid_de_uma_empresa_existente>"] \
//   node scripts/seed-reference.mjs
//
// - SEM TARGET_COMPANY_ID: importa só os GLOBAIS (muscle_groups, exercícios globais,
//   exercise_muscle_targets, achievements). Já conserta a biblioteca, zero decisão.
// - COM TARGET_COMPANY_ID: também importa os dados POR EMPRESA (plans, form_fields,
//   whatsapp_labels, platform_settings, automation_*) remapeados para essa empresa,
//   e os 14 exercícios company-scoped.
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const INPUT_PATH = process.env.REPLICA_INPUT_PATH ?? "replica/non-personal-config.json";
const url = process.env.TARGET_SUPABASE_URL;
const key = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;
const targetCompanyId = process.env.TARGET_COMPANY_ID || null;

if (!url || !key) {
  console.error("Faltam TARGET_SUPABASE_URL e TARGET_SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const GLOBAL_TABLES = ["muscle_groups", "exercise_library", "exercise_muscle_targets"];
// Curado: só o que é valioso e seguro. Pula platform_settings (branding) e automation_* (nós corrompidos / baixo valor).
const COMPANY_TABLES = ["plans", "form_fields", "whatsapp_labels", "role_permissions"];

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function upsert(table, rows) {
  if (!rows.length) return 0;
  const batchSize = 500;
  let n = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const hasId = batch.every((r) => r.id);
    const q = hasId ? client.from(table).upsert(batch, { onConflict: "id" }) : client.from(table).insert(batch);
    const { error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    n += batch.length;
  }
  return n;
}

const payload = JSON.parse(await readFile(INPUT_PATH, "utf8"));
const t = payload.tables ?? {};
const imported = {};

// Reparo: a redação do export corrompeu uuids (trocou dígitos por "[redacted-phone]").
// Substitui qualquer valor não-uuid por um uuid NOVO, de forma CONSISTENTE entre tabelas
// (mesma string corrompida -> mesmo uuid novo), preservando as FKs internas.
const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const uuidMap = new Map();
const fixId = (v) => { if (v == null || isUuid(v)) return v; if (!uuidMap.has(v)) uuidMap.set(v, randomUUID()); return uuidMap.get(v); };
const repair = (rows, fields) => rows.map((r) => { const c = { ...r }; for (const f of fields) if (c[f] != null) c[f] = fixId(c[f]); return c; });

const mg = repair(t.muscle_groups ?? [], ["id"]);
const exAll = repair(t.exercise_library ?? [], ["id", "muscle_group_id", "company_id"]);
const tgAll = repair(t.exercise_muscle_targets ?? [], ["id", "exercise_id", "muscle_group_id"]);
const mgIds = new Set(mg.map((r) => r.id));

// 1) Globais (ordem de FK). muscle_groups -> exercise_library -> exercise_muscle_targets.
// SKIP_GLOBAL=1 pula esta parte (use quando os globais já foram semeados — não é idempotente p/ ids reparados).
if (!process.env.SKIP_GLOBAL) {
imported.muscle_groups = await upsert("muscle_groups", mg);

let exRows = exAll.filter((r) => !r.muscle_group_id || mgIds.has(r.muscle_group_id));
if (!targetCompanyId) exRows = exRows.filter((r) => !r.company_id);                       // só globais
else exRows = exRows.map((r) => (r.company_id ? { ...r, company_id: targetCompanyId } : r));
imported.exercise_library = await upsert("exercise_library", exRows);

// targets só dos exercícios/grupos que realmente inserimos (evita violar FK)
const exIds = new Set(exRows.map((r) => r.id));
const targets = tgAll.filter((r) => exIds.has(r.exercise_id) && (!r.muscle_group_id || mgIds.has(r.muscle_group_id)));
imported.exercise_muscle_targets = await upsert("exercise_muscle_targets", targets);
}

// 2) Por empresa (só com TARGET_COMPANY_ID)
if (targetCompanyId) {
  for (const table of COMPANY_TABLES) {
    // repara id corrompido e força a empresa alvo
    const rows = repair(t[table] ?? [], ["id"]).map((r) => ({ ...r, company_id: targetCompanyId }));
    imported[table] = await upsert(table, rows);
  }
} else {
  console.log("(sem TARGET_COMPANY_ID: importei só os dados globais; planos/form_fields/etc. ficaram de fora)");
}

console.log(JSON.stringify({ success: true, targetCompanyId, imported }, null, 2));
