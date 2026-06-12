import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const INPUT_PATH = process.env.REPLICA_INPUT_PATH ?? "replica/non-personal-config.json";

const IMPORT_ORDER = [
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

async function findUserByEmail(client, email) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function upsertRows(client, table, rows) {
  if (!rows.length) return { count: 0 };
  const batchSize = 500;
  let count = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const hasId = batch.every((row) => row.id);
    const query = hasId
      ? client.from(table).upsert(batch, { onConflict: "id" })
      : client.from(table).insert(batch);
    const { error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    count += batch.length;
  }

  return { count };
}

function mapRow(row, targetCompanyId) {
  const mapped = { ...row };
  if (mapped.company_id) mapped.company_id = targetCompanyId;
  return mapped;
}

async function main() {
  const supabaseUrl = process.env.TARGET_SUPABASE_URL;
  const serviceRoleKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = process.env.REPLICA_ADMIN_EMAIL;
  const adminPassword = process.env.REPLICA_ADMIN_PASSWORD;
  const adminName = process.env.REPLICA_ADMIN_NAME ?? "Replica Admin";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!adminEmail || !adminPassword) {
    throw new Error("Missing REPLICA_ADMIN_EMAIL and REPLICA_ADMIN_PASSWORD.");
  }
  if (adminPassword.length < 6) {
    throw new Error("REPLICA_ADMIN_PASSWORD must be at least 6 characters.");
  }

  const payload = JSON.parse(await readFile(INPUT_PATH, "utf8"));
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId;
  const { data: created, error: createError } = await client.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName },
  });

  if (createError) {
    const existing = await findUserByEmail(client, adminEmail);
    if (!existing) throw createError;
    userId = existing.id;
    const { error: updateError } = await client.auth.admin.updateUserById(userId, {
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName },
    });
    if (updateError) throw updateError;
  } else {
    userId = created.user.id;
  }

  const requestedCompanyName = process.env.REPLICA_COMPANY_NAME ?? payload.companyTemplate?.name ?? "Replica Fitness Hub";
  const requestedCompanySlug =
    process.env.REPLICA_COMPANY_SLUG ??
    payload.companyTemplate?.slug ??
    requestedCompanyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const companyPayload = {
    name: requestedCompanyName,
    slug: requestedCompanySlug,
    tier: payload.companyTemplate?.tier ?? "pro",
    subscription_status: payload.companyTemplate?.subscription_status ?? "active",
    max_students: payload.companyTemplate?.max_students ?? 100,
    is_active: payload.companyTemplate?.is_active ?? true,
    owner_id: userId,
    owner_user_id: userId,
  };

  let { data: company, error: companyLookupError } = await client
    .from("companies")
    .select("id")
    .eq("slug", requestedCompanySlug)
    .maybeSingle();
  if (companyLookupError) throw companyLookupError;

  if (company?.id) {
    const { error } = await client.from("companies").update(companyPayload).eq("id", company.id);
    if (error) throw error;
  } else {
    const { data, error } = await client.from("companies").insert(companyPayload).select("id").single();
    if (error) throw error;
    company = data;
  }

  const companyId = company.id;

  const setupRows = [
    client.from("profiles").upsert({ user_id: userId, full_name: adminName }, { onConflict: "user_id" }),
    client.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" }),
    client.from("company_members").upsert({ user_id: userId, company_id: companyId }, { onConflict: "user_id" }),
  ];

  for (const resultPromise of setupRows) {
    const { error } = await resultPromise;
    if (error) throw error;
  }

  const imported = {};
  for (const table of IMPORT_ORDER) {
    const rows = (payload.tables?.[table] ?? []).map((row) => mapRow(row, companyId));
    const result = await upsertRows(client, table, rows);
    imported[table] = result.count;
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        company_id: companyId,
        admin_user_id: userId,
        imported,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
