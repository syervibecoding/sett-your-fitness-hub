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

const INPUT_PATH = process.env.REPLICA_INPUT_PATH ?? "replica/non-personal-config.json";
const url = process.env.TARGET_SUPABASE_URL;
const key = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;
const targetCompanyId = process.env.TARGET_COMPANY_ID || null;

if (!url || !key) {
  console.error("Faltam TARGET_SUPABASE_URL e TARGET_SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const GLOBAL_TABLES = ["muscle_groups", "exercise_library", "exercise_muscle_targets", "achievements"];
const COMPANY_TABLES = ["plans", "student_categories", "form_fields", "company_exercise_volumes",
  "role_permissions", "message_templates", "whatsapp_labels", "platform_settings",
  "automation_flows", "automation_flow_nodes", "automation_flow_edges"];

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

// 1) Globais (na ordem de FK). Para exercise_library, sem company alvo => só os globais.
for (const table of GLOBAL_TABLES) {
  let rows = t[table] ?? [];
  if (table === "exercise_library" && !targetCompanyId) {
    rows = rows.filter((r) => !r.company_id); // só globais
  } else if (table === "exercise_library" && targetCompanyId) {
    rows = rows.map((r) => (r.company_id ? { ...r, company_id: targetCompanyId } : r));
  }
  imported[table] = await upsert(table, rows);
}

// 2) Por empresa (só com TARGET_COMPANY_ID)
if (targetCompanyId) {
  for (const table of COMPANY_TABLES) {
    const rows = (t[table] ?? []).map((r) => (r.company_id ? { ...r, company_id: targetCompanyId } : r));
    imported[table] = await upsert(table, rows);
  }
} else {
  console.log("(sem TARGET_COMPANY_ID: importei só os dados globais; planos/form_fields/etc. ficaram de fora)");
}

console.log(JSON.stringify({ success: true, targetCompanyId, imported }, null, 2));
