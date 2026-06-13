import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_PATH = process.env.REPLICA_OUTPUT_PATH ?? "replica/non-personal-config.json";

const SAFE_TABLES = [
  "platform_settings",
  "plans",
  "student_categories",
  "form_fields",
  "muscle_groups",
  "exercise_library",
  "exercise_muscle_targets",
  "company_exercise_volumes",
  "achievements",
  "role_permissions",
  "message_templates",
  "automation_flows",
  "automation_flow_nodes",
  "automation_flow_edges",
  "whatsapp_labels",
];

const EXCLUDED_TABLES = {
  admin_alerts: "operational alerts can reference students, enrollments, users, and actions",
  ai_strength_plans: "student-specific AI prescriptions",
  anamnesis: "student health and personal questionnaire data",
  announcement_reads: "student read history",
  announcements: "can contain person-targeted operational communication",
  body_measurements: "student body data",
  company_billing: "billing identifiers",
  company_members: "user membership data",
  enrollments: "student contracts/enrollment history",
  evaluations: "student evaluation data",
  external_activities: "student activity history",
  flow_sessions: "runtime automation sessions",
  functional_assessments: "student assessment data",
  payments: "billing and payer data",
  prescription_bundles: "student-specific prescription packages",
  profiles: "people profiles",
  running_plans: "student-specific running plans",
  student_achievements: "student progress data",
  student_anamneses: "student health and questionnaire data",
  student_evaluations: "student evaluation files and notes",
  students: "student personal data",
  trainer_assignments_history: "student/trainer assignment history",
  training_cycles: "student training cycles",
  user_roles: "people authorization assignments",
  whatsapp_chat_labels: "chat-person label relationships",
  whatsapp_chats: "conversation/contact data",
  whatsapp_instances: "messaging integration identifiers",
  whatsapp_messages: "conversation content",
  workout_logs: "student workout log data",
  workout_sessions: "student workout session data",
  workouts: "student cycle prescriptions",
  xp_events: "student activity/progress events",
};

const STRIP_COLUMNS = new Set([
  "author_id",
  "created_by",
  "evaluator_id",
  "owner_id",
  "owner_user_id",
  "resolved_by",
  "student_id",
  "target_user_id",
  "trainer_id",
  "user_id",
  "stripe_customer_id",
  "stripe_subscription_id",
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_RE = /(^|[^\w-])((?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4})(?![\w-])/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ID_FIELD_RE = /(^id$|_id$|_ids$|^source_node_id$|^target_node_id$)/i;

async function loadEnvFile(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Env file is optional.
  }
}

function env(name, fallback) {
  return process.env[name] ?? (fallback ? process.env[fallback] : undefined);
}

function sanitizeText(value) {
  const uuidMasks = [];
  const masked = value.replace(UUID_RE, (match) => {
    const token = `__UUID_MASK_${uuidMasks.length}__`;
    uuidMasks.push(match);
    return token;
  });

  const redacted = masked
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(CPF_RE, "[redacted-cpf]")
    .replace(PHONE_RE, "$1[redacted-phone]");

  return uuidMasks.reduce((text, uuid, index) => text.replace(`__UUID_MASK_${index}__`, uuid), redacted);
}

function isIdentityField(key) {
  return typeof key === "string" && ID_FIELD_RE.test(key);
}

function sanitizeValue(value, key) {
  if (isIdentityField(key)) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, key));
  if (value && typeof value === "object") return sanitizeRow(value);
  if (typeof value === "string") return sanitizeText(value);
  return value;
}

function sanitizeRow(row) {
  const clean = {};
  for (const [key, value] of Object.entries(row)) {
    if (STRIP_COLUMNS.has(key)) continue;
    clean[key] = sanitizeValue(value, key);
  }
  return clean;
}

async function fetchAll(client, table) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function main() {
  await loadEnvFile(".env.local");

  const supabaseUrl = env("SOURCE_SUPABASE_URL", "VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
  const supabaseKey =
    env("SOURCE_SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY") ??
    env("SOURCE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");
  const email = env("SOURCE_APP_EMAIL");
  const password = env("SOURCE_APP_PASSWORD");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SOURCE_SUPABASE_URL/SOURCE_SUPABASE_ANON_KEY or Vite Supabase env vars.");
  }
  if (!email || !password) {
    throw new Error("Missing SOURCE_APP_EMAIL and SOURCE_APP_PASSWORD.");
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw authError;

  const userId = authData.user.id;
  const [{ data: role }, { data: membership, error: membershipError }] = await Promise.all([
    client.rpc("get_user_role", { _user_id: userId }),
    client.from("company_members").select("company_id").eq("user_id", userId).limit(1).maybeSingle(),
  ]);

  if (membershipError) throw membershipError;
  if (!membership?.company_id) throw new Error("The source user is not linked to a company.");

  const { data: company, error: companyError } = await client
    .from("companies")
    .select("*")
    .eq("id", membership.company_id)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!company) throw new Error("Source company was not found.");

  const tables = {};
  const counts = {};
  for (const table of SAFE_TABLES) {
    const rows = await fetchAll(client, table);
    tables[table] = rows.map(sanitizeRow);
    counts[table] = rows.length;
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    version: 1,
    exportedAt,
    source: {
      projectUrl: supabaseUrl,
      role,
      companyId: membership.company_id,
    },
    privacy: {
      mode: "non-personal-config-only",
      excludedTables: EXCLUDED_TABLES,
      strippedColumns: [...STRIP_COLUMNS].sort(),
      redactions: ["email", "cpf", "phone"],
    },
    companyTemplate: sanitizeRow({
      name: company.name,
      slug: company.slug,
      tier: company.tier,
      subscription_status: company.subscription_status,
      max_students: company.max_students,
      is_active: company.is_active,
    }),
    counts,
    tables,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  await client.auth.signOut();

  console.log(`Replica export written to ${OUTPUT_PATH}`);
  console.log(JSON.stringify({ exportedAt, counts }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { sanitizeRow, sanitizeText, sanitizeValue };
