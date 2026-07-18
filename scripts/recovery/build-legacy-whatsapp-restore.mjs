#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const sourceDir = args.get("--source-dir");
const baselineDir = args.get("--baseline-dir");
const outputDir = args.get("--output-dir");
const targetCompanyId = args.get("--target-company-id");
const targetSchemaFile = args.get("--target-schema");
const messageBatchSize = Number(args.get("--message-batch-size") || 750);

if (!sourceDir || !baselineDir || !outputDir || !targetCompanyId || !targetSchemaFile) {
  throw new Error(
    "Usage: build-legacy-whatsapp-restore.mjs --source-dir <dir> " +
      "--baseline-dir <dir> --output-dir <dir> --target-company-id <uuid> " +
      "--target-schema <json> [--message-batch-size <number>]",
  );
}

if (!/^[0-9a-f-]{36}$/i.test(targetCompanyId)) {
  throw new Error("target-company-id must be a UUID");
}

if (!Number.isInteger(messageBatchSize) || messageBatchSize < 1 || messageBatchSize > 2000) {
  throw new Error("message-batch-size must be an integer between 1 and 2000");
}

const load = (directory, table) =>
  JSON.parse(fs.readFileSync(path.join(directory, `${table}.json`), "utf8"));
const targetSchema = JSON.parse(fs.readFileSync(targetSchemaFile, "utf8"));

const source = {
  instances: load(sourceDir, "whatsapp_instances"),
  chats: load(sourceDir, "whatsapp_chats"),
  messages: load(sourceDir, "whatsapp_messages"),
  labels: load(sourceDir, "whatsapp_labels"),
  chatLabels: load(sourceDir, "whatsapp_chat_labels"),
  students: load(sourceDir, "students"),
};
const baselineLabels = load(baselineDir, "whatsapp_labels");

const instanceIds = new Set(source.instances.map((row) => row.id));
const chatIds = new Set(source.chats.map((row) => row.id));
const labelIds = new Set(source.labels.map((row) => row.id));
const studentIds = new Set(source.students.map((row) => row.id));

function assertReferences() {
  const checks = [
    [source.chats.every((row) => instanceIds.has(row.instance_id)), "chat instance"],
    [
      source.chats.every((row) => !row.student_id || studentIds.has(row.student_id)),
      "chat student",
    ],
    [source.messages.every((row) => chatIds.has(row.chat_id)), "message chat"],
    [source.chatLabels.every((row) => chatIds.has(row.chat_id)), "chat label chat"],
    [source.chatLabels.every((row) => labelIds.has(row.label_id)), "chat label label"],
  ];

  for (const [valid, label] of checks) {
    if (!valid) throw new Error(`Invalid legacy WhatsApp reference: ${label}`);
  }

  const baselineLabelById = new Map(baselineLabels.map((row) => [row.id, row]));
  for (const label of source.labels) {
    const current = baselineLabelById.get(label.id);
    if (current && (current.name !== label.name || current.color !== label.color)) {
      throw new Error(`WhatsApp label collision for ${label.id}`);
    }
  }
}

assertReferences();

const withTargetCompany = (row) =>
  Object.hasOwn(row, "company_id") ? { ...row, company_id: targetCompanyId } : { ...row };

const instances = source.instances.map((row) => ({
  ...withTargetCompany(row),
  status: "disconnected",
  qr_code: null,
}));
const chats = source.chats.map(withTargetCompany);
const messages = source.messages.map(withTargetCompany);
const labels = source.labels.map(withTargetCompany);
const chatLabels = source.chatLabels.map(withTargetCompany);

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function jsonExpression(rows) {
  const encoded = Buffer.from(JSON.stringify(rows), "utf8").toString("base64");
  return `convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb`;
}

function filterRows(table, rows) {
  const allowed = new Set(targetSchema[table] || []);
  if (allowed.size === 0) throw new Error(`Target table missing from schema: ${table}`);
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([column]) => allowed.has(column))),
  );
}

function insertRows(table, rows) {
  if (rows.length === 0) return `-- ${table}: no rows\n`;
  const filtered = filterRows(table, rows);
  const columns = [...new Set(filtered.flatMap((row) => Object.keys(row)))];
  const quotedColumns = columns.map(quoteIdentifier).join(", ");

  return `
WITH source_rows AS (
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.${quoteIdentifier(table)},
    ${jsonExpression(filtered)}
  )
)
INSERT INTO public.${quoteIdentifier(table)} (${quotedColumns})
SELECT ${quotedColumns} FROM source_rows
ON CONFLICT (id) DO NOTHING;
`;
}

function verifyRows(table, rows) {
  if (rows.length === 0) return `-- ${table}: no rows to verify\n`;
  const ids = rows.map((row) => row.id);
  return `
DO $$
DECLARE restored_count integer;
BEGIN
  SELECT count(*) INTO restored_count
  FROM public.${quoteIdentifier(table)}
  WHERE id = ANY (ARRAY[${ids.map((id) => `'${id}'::uuid`).join(", ")}]);
  IF restored_count <> ${rows.length} THEN
    RAISE EXCEPTION '${table} restore verification failed: % of ${rows.length}', restored_count;
  END IF;
END $$;
`;
}

function transaction(statements, end) {
  return [
    "BEGIN;",
    "SET LOCAL lock_timeout = '10s';",
    "SET LOCAL statement_timeout = '180s';",
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '${targetCompanyId}'::uuid) THEN RAISE EXCEPTION 'Target company missing'; END IF; END $$;`,
    ...statements,
    `${end};`,
    "",
  ].join("\n");
}

function writePair(name, statements) {
  for (const end of ["ROLLBACK", "COMMIT"]) {
    const file = path.join(outputDir, `${name}-${end.toLowerCase()}.sql`);
    fs.writeFileSync(file, transaction(statements, end), { mode: 0o600 });
  }
}

fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });

writePair("core", [
  insertRows("whatsapp_instances", instances),
  insertRows("whatsapp_labels", labels),
  insertRows("whatsapp_chats", chats),
  insertRows("whatsapp_chat_labels", chatLabels),
  verifyRows("whatsapp_instances", instances),
  verifyRows("whatsapp_labels", labels),
  verifyRows("whatsapp_chats", chats),
  verifyRows("whatsapp_chat_labels", chatLabels),
]);

const batches = [];
for (let offset = 0; offset < messages.length; offset += messageBatchSize) {
  const batch = messages.slice(offset, offset + messageBatchSize);
  const name = `messages-${String(batches.length + 1).padStart(3, "0")}`;
  writePair(name, [insertRows("whatsapp_messages", batch), verifyRows("whatsapp_messages", batch)]);
  batches.push({ name, rows: batch.length });
}

console.log(
  JSON.stringify(
    {
      outputDir,
      core: {
        instances: instances.length,
        labels: labels.length,
        chats: chats.length,
        chatLabels: chatLabels.length,
      },
      messages: messages.length,
      batches,
      safety: "Legacy instance status forced to disconnected; QR code omitted",
    },
    null,
    2,
  ),
);
