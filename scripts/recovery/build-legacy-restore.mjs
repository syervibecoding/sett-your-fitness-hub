#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const sourceDir = args.get("--source-dir");
const baselineDir = args.get("--baseline-dir");
const outputFile = args.get("--output");
const targetCompanyId = args.get("--target-company-id");
const targetSchemaFile = args.get("--target-schema");
const transactionEnd = args.get("--transaction-end") || "ROLLBACK";

if (!sourceDir || !baselineDir || !outputFile || !targetCompanyId || !targetSchemaFile) {
  throw new Error(
    "Usage: build-legacy-restore.mjs --source-dir <dir> --baseline-dir <dir> " +
      "--output <file> --target-company-id <uuid> --target-schema <json> " +
      "[--transaction-end ROLLBACK|COMMIT]",
  );
}

if (!/^[0-9a-f-]{36}$/i.test(targetCompanyId)) {
  throw new Error("target-company-id must be a UUID");
}

if (!new Set(["ROLLBACK", "COMMIT"]).has(transactionEnd)) {
  throw new Error("transaction-end must be ROLLBACK or COMMIT");
}

const load = (directory, table) =>
  JSON.parse(fs.readFileSync(path.join(directory, `${table}.json`), "utf8"));
const targetSchema = JSON.parse(fs.readFileSync(targetSchemaFile, "utf8"));
const droppedFieldsByTable = new Map();

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const source = {
  plans: load(sourceDir, "plans"),
  exercises: load(sourceDir, "exercise_library"),
  exerciseTargets: load(sourceDir, "exercise_muscle_targets"),
  muscleGroups: load(sourceDir, "muscle_groups"),
  achievements: load(sourceDir, "achievements"),
  enrollments: load(sourceDir, "enrollments"),
};

const baseline = {
  plans: load(baselineDir, "plans"),
  exercises: load(baselineDir, "exercise_library"),
  muscleGroups: load(baselineDir, "muscle_groups"),
  achievements: load(baselineDir, "achievements"),
};

function uniqueMap(rows, keySelector, valueSelector, label) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keySelector(row);
    if (!key) continue;
    const values = grouped.get(key) || [];
    values.push(valueSelector(row));
    grouped.set(key, values);
  }

  const result = new Map();
  for (const [key, values] of grouped) {
    const unique = [...new Set(values)];
    if (unique.length !== 1) throw new Error(`${label} is ambiguous for ${key}`);
    result.set(key, unique[0]);
  }
  return result;
}

const currentPlanByName = uniqueMap(
  baseline.plans,
  (row) => normalizeName(row.name),
  (row) => row.id,
  "plan name",
);
const planIdMap = new Map(
  source.plans.map((row) => {
    const currentId = currentPlanByName.get(normalizeName(row.name));
    if (!currentId) throw new Error(`Target plan missing: ${row.name}`);
    return [row.id, currentId];
  }),
);
const referencedPlanIds = new Set(
  [
    ...source.enrollments.map((row) => row.plan_id),
    ...load(sourceDir, "students").map((row) => row.selected_plan_id),
  ].filter(Boolean),
);
const sourcePlanIds = new Set(source.plans.map((row) => row.id));
const orphanPlans = [...referencedPlanIds]
  .filter((id) => !sourcePlanIds.has(id))
  .map((id) => {
    const relatedEnrollments = source.enrollments.filter((row) => row.plan_id === id);
    const cycleDuration = relatedEnrollments.find((row) => row.cycle_duration_days)?.cycle_duration_days || 42;
    planIdMap.set(id, id);
    return {
      id,
      company_id: targetCompanyId,
      name: `Plano legado recuperado (${id.slice(0, 8)})`,
      description: "Referência preservada da base anterior; o plano original já havia sido removido.",
      cycle_duration_days: cycleDuration,
      duration_days: cycleDuration,
      duration_weeks: Math.max(1, Math.round(cycleDuration / 7)),
      is_active: false,
    };
  });

const currentMuscleGroupByName = uniqueMap(
  baseline.muscleGroups,
  (row) => normalizeName(row.name),
  (row) => row.id,
  "muscle group name",
);
const muscleGroupIdMap = new Map(
  source.muscleGroups.map((row) => [
    row.id,
    currentMuscleGroupByName.get(normalizeName(row.name)) || row.id,
  ]),
);

const currentExerciseIds = new Set(baseline.exercises.map((row) => row.id));
const currentExercisesByName = new Map();
for (const exercise of baseline.exercises) {
  const key = normalizeName(exercise.name);
  const matches = currentExercisesByName.get(key) || [];
  matches.push(exercise);
  currentExercisesByName.set(key, matches);
}

function resolveExerciseId(sourceExercise) {
  if (currentExerciseIds.has(sourceExercise.id)) return sourceExercise.id;

  const candidates = currentExercisesByName.get(normalizeName(sourceExercise.name)) || [];
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length === 0) return null;

  const scored = candidates.map((candidate) => {
    let score = 0;
    if (sourceExercise.video_path && sourceExercise.video_path === candidate.video_path) score += 8;
    if (sourceExercise.video_url && sourceExercise.video_url === candidate.video_url) score += 8;
    if (sourceExercise.equipment && sourceExercise.equipment === candidate.equipment) score += 4;
    if (
      sourceExercise.muscle_group &&
      normalizeName(sourceExercise.muscle_group) === normalizeName(candidate.muscle_group)
    ) score += 4;
    if (sourceExercise.difficulty && sourceExercise.difficulty === candidate.difficulty) score += 2;
    if (sourceExercise.category && sourceExercise.category === candidate.category) score += 2;
    if (sourceExercise.description && sourceExercise.description === candidate.description) score += 1;
    return { id: candidate.id, score };
  });
  const bestScore = Math.max(...scored.map((candidate) => candidate.score));
  const best = scored.filter((candidate) => candidate.score === bestScore);
  return bestScore > 0 && best.length === 1 ? best[0].id : null;
}

const missingExercises = source.exercises
  .filter((row) => !resolveExerciseId(row))
  .map((row) => ({
    ...row,
    company_id: row.company_id ? targetCompanyId : null,
    muscle_group_id: row.muscle_group_id
      ? muscleGroupIdMap.get(row.muscle_group_id) || row.muscle_group_id
      : null,
  }));
const missingExerciseIds = new Set(missingExercises.map((row) => row.id));
const exerciseIdMap = new Map(
  source.exercises.map((row) => [
    row.id,
    resolveExerciseId(row) || row.id,
  ]),
);

const currentAchievementByCode = uniqueMap(
  baseline.achievements,
  (row) => normalizeName(row.code || row.name),
  (row) => row.id,
  "achievement code",
);
const achievementIdMap = new Map(
  source.achievements.map((row) => {
    const currentId = currentAchievementByCode.get(normalizeName(row.code || row.name));
    if (!currentId) throw new Error(`Target achievement missing: ${row.code || row.name}`);
    return [row.id, currentId];
  }),
);

function mapExerciseIds(value) {
  if (Array.isArray(value)) return value.map(mapExerciseIds);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (key === "exercise_id" && typeof child === "string") {
        return [key, exerciseIdMap.get(child) || child];
      }
      return [key, mapExerciseIds(child)];
    }),
  );
}

const enrollmentStudentById = new Map(
  source.enrollments.map((row) => [row.id, row.student_id]),
);

function withTargetCompany(row) {
  return Object.hasOwn(row, "company_id") ? { ...row, company_id: targetCompanyId } : { ...row };
}

function prepare(table) {
  const rows = load(sourceDir, table).map(withTargetCompany);

  switch (table) {
    case "students":
      return rows.map((row) => ({
        ...row,
        selected_plan_id: row.selected_plan_id
          ? planIdMap.get(row.selected_plan_id) || row.selected_plan_id
          : null,
        weekly_contact_enabled: false,
      }));
    case "enrollments":
      return rows.map((row) => ({
        ...row,
        plan_id: row.plan_id ? planIdMap.get(row.plan_id) || row.plan_id : null,
      }));
    case "training_cycles":
      return rows.map((row) => ({
        ...row,
        student_id: enrollmentStudentById.get(row.enrollment_id),
      }));
    case "workouts":
      return rows.map((row) => ({ ...row, exercises: mapExerciseIds(row.exercises) }));
    case "workout_logs":
      return rows.map((row) => ({ ...row, exercises_data: mapExerciseIds(row.exercises_data) }));
    case "ai_strength_plans":
      return rows.map((row) => ({ ...row, plan: mapExerciseIds(row.plan) }));
    case "student_anamneses":
      return rows.map((row) => {
        const modalities = Array.isArray(row.prescribed_modalities) ? row.prescribed_modalities : [];
        const migrated = { ...row };
        delete migrated.prescribed_modalities;
        return {
          ...migrated,
          wants_strength: modalities.includes("musculacao"),
          wants_running: modalities.includes("corrida"),
          wants_swimming: modalities.includes("natacao"),
          wants_cycling: modalities.includes("ciclismo"),
          wants_nutrition: modalities.includes("nutricao"),
        };
      });
    case "student_achievements":
      return rows.map((row) => ({
        ...row,
        achievement_id: achievementIdMap.get(row.achievement_id) || row.achievement_id,
      }));
    default:
      return rows;
  }
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function jsonExpression(rows) {
  const encoded = Buffer.from(JSON.stringify(rows), "utf8").toString("base64");
  return `convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb`;
}

function insertRows(table, rows, conflictColumns = ["id"]) {
  if (rows.length === 0) return `-- ${table}: no rows\n`;
  const allowedColumns = new Set(targetSchema[table] || []);
  if (allowedColumns.size === 0) throw new Error(`Target table missing from schema: ${table}`);

  const filteredRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([column]) => {
        const allowed = allowedColumns.has(column);
        if (!allowed) {
          const dropped = droppedFieldsByTable.get(table) || new Set();
          dropped.add(column);
          droppedFieldsByTable.set(table, dropped);
        }
        return allowed;
      }),
    ),
  );
  const columns = [...new Set(filteredRows.flatMap((row) => Object.keys(row)))];
  const quotedColumns = columns.map(quoteIdentifier).join(", ");
  const conflict = conflictColumns.map(quoteIdentifier).join(", ");

  return `
WITH source_rows AS (
  SELECT * FROM jsonb_populate_recordset(NULL::public.${quoteIdentifier(table)}, ${jsonExpression(filteredRows)})
)
INSERT INTO public.${quoteIdentifier(table)} (${quotedColumns})
SELECT ${quotedColumns} FROM source_rows
ON CONFLICT (${conflict}) DO NOTHING;
`;
}

function verifyRowsByIds(table, rows, idColumn = "id") {
  if (rows.length === 0) return `-- ${table}: no rows to verify\n`;
  const ids = rows.map((row) => row[idColumn]);
  if (ids.some((id) => !id)) throw new Error(`${table}.${idColumn} missing during verification`);

  return `
DO $$
DECLARE restored_count integer;
BEGIN
  SELECT count(*) INTO restored_count
  FROM public.${quoteIdentifier(table)}
  WHERE ${quoteIdentifier(idColumn)} = ANY (ARRAY[${ids.map((id) => `'${id}'::uuid`).join(", ")}]);
  IF restored_count <> ${rows.length} THEN
    RAISE EXCEPTION '${table} restore verification failed: % of ${rows.length}', restored_count;
  END IF;
END $$;
`;
}

function removeCyclesGeneratedByEnrollmentTrigger(enrollments, preservedCycles) {
  if (enrollments.length === 0) return "-- no enrollment-triggered cycles to remove\n";
  const enrollmentIds = enrollments.map((row) => `'${row.id}'::uuid`).join(", ");
  const cycleIds = preservedCycles.map((row) => `'${row.id}'::uuid`).join(", ");
  const preserveClause = cycleIds
    ? `AND NOT (id = ANY (ARRAY[${cycleIds}]))`
    : "";

  return `
DELETE FROM public.training_cycles
WHERE enrollment_id = ANY (ARRAY[${enrollmentIds}])
  AND created_at = transaction_timestamp()
  ${preserveClause};
`;
}

const missingTargets = source.exerciseTargets
  .filter((row) => missingExerciseIds.has(row.exercise_id))
  .map((row) => ({
    ...row,
    muscle_group_id: muscleGroupIdMap.get(row.muscle_group_id) || row.muscle_group_id,
  }));
const missingMetadata = missingExercises.map((row) => ({ exercise_id: row.id }));

const strengthPlanSource = prepare("ai_strength_plans");
const enrollmentSource = prepare("enrollments");
const trainingCycleSource = prepare("training_cycles");
const automationFlowSource = prepare("automation_flows").map((row) => ({
  ...row,
  is_active: false,
}));
const automationNodeSource = prepare("automation_flow_nodes");
const automationEdgeSource = prepare("automation_flow_edges");
const bundleSource = prepare("prescription_bundles");
const knownBundleIds = new Set(bundleSource.map((row) => row.id));
const recoveredBundles = strengthPlanSource
  .filter((row) => row.bundle_id && !knownBundleIds.has(row.bundle_id))
  .map((row) => ({
    id: row.bundle_id,
    company_id: targetCompanyId,
    student_id: row.student_id,
    anamnese_id: row.anamnese_id || null,
    strength_plan_id: row.id,
    running_plan_id: null,
    has_strength: true,
    has_cardio: false,
    has_nutrition: false,
    status: "active",
    modalities: ["musculacao"],
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  }));
const completeBundleSource = [...bundleSource, ...recoveredBundles].map((row) => ({
  ...row,
  updated_at: row.updated_at || row.created_at,
}));
const bundlesWithoutCircularReferences = completeBundleSource.map((row) => ({
  ...row,
  strength_plan_id: null,
  running_plan_id: null,
}));

const sections = [
  "BEGIN;",
  "SET LOCAL lock_timeout = '10s';",
  "SET LOCAL statement_timeout = '180s';",
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '${targetCompanyId}'::uuid) THEN RAISE EXCEPTION 'Target company missing'; END IF; END $$;`,
  insertRows("exercise_library", missingExercises),
  insertRows("exercise_metadata", missingMetadata, ["exercise_id"]),
  insertRows("exercise_muscle_targets", missingTargets),
  insertRows("plans", orphanPlans),
  insertRows("profiles", prepare("profiles")),
  insertRows("company_members", prepare("company_members")),
  insertRows("user_roles", prepare("user_roles")),
  insertRows("students", prepare("students")),
  insertRows("enrollments", enrollmentSource),
  removeCyclesGeneratedByEnrollmentTrigger(enrollmentSource, trainingCycleSource),
  insertRows("anamnesis", prepare("anamnesis")),
  insertRows("student_anamneses", prepare("student_anamneses")),
  insertRows("prescription_bundles", bundlesWithoutCircularReferences),
  insertRows("ai_strength_plans", strengthPlanSource),
  insertRows("training_cycles", trainingCycleSource),
  insertRows("workouts", prepare("workouts")),
  insertRows("payments", prepare("payments")),
  insertRows("trainer_assignments_history", prepare("trainer_assignments_history")),
  insertRows("workout_sessions", prepare("workout_sessions")),
  insertRows("workout_logs", prepare("workout_logs")),
  insertRows("external_activities", prepare("external_activities")),
  insertRows("student_achievements", prepare("student_achievements")),
  insertRows("xp_events", prepare("xp_events")),
  insertRows("workout_feedback", prepare("workout_feedback")),
  insertRows("admin_alerts", prepare("admin_alerts")),
  insertRows("announcements", prepare("announcements")),
  insertRows("announcement_reads", prepare("announcement_reads")),
  insertRows("automation_flows", automationFlowSource),
  insertRows("automation_flow_nodes", automationNodeSource),
  insertRows("automation_flow_edges", automationEdgeSource),
];

if (completeBundleSource.length > 0) {
  sections.push(`
WITH source_rows AS (
  SELECT * FROM jsonb_populate_recordset(NULL::public.prescription_bundles, ${jsonExpression(completeBundleSource)})
)
UPDATE public.prescription_bundles AS target
SET strength_plan_id = source_rows.strength_plan_id,
    running_plan_id = source_rows.running_plan_id
FROM source_rows
WHERE target.id = source_rows.id;
`);
}

const verificationRows = {
  students: prepare("students"),
  enrollments: enrollmentSource,
  anamnesis: prepare("anamnesis"),
  student_anamneses: prepare("student_anamneses"),
  prescription_bundles: completeBundleSource,
  ai_strength_plans: strengthPlanSource,
  training_cycles: trainingCycleSource,
  workouts: prepare("workouts"),
  payments: prepare("payments"),
  trainer_assignments_history: prepare("trainer_assignments_history"),
  workout_sessions: prepare("workout_sessions"),
  workout_logs: prepare("workout_logs"),
  external_activities: prepare("external_activities"),
  student_achievements: prepare("student_achievements"),
  xp_events: prepare("xp_events"),
  workout_feedback: prepare("workout_feedback"),
  automation_flows: automationFlowSource,
  automation_flow_nodes: automationNodeSource,
  automation_flow_edges: automationEdgeSource,
};
const expected = Object.fromEntries(
  Object.entries(verificationRows).map(([table, rows]) => [table, rows.length]),
);

for (const [table, rows] of Object.entries(verificationRows)) {
  sections.push(verifyRowsByIds(table, rows));
}

sections.push(transactionEnd === "COMMIT" ? "COMMIT;" : "ROLLBACK;");
sections.push("");

fs.mkdirSync(path.dirname(outputFile), { recursive: true, mode: 0o700 });
fs.writeFileSync(outputFile, sections.join("\n"), { mode: 0o600 });

console.log(
  JSON.stringify(
    {
      outputFile,
      transactionEnd,
      expected,
      missingExercises: missingExercises.length,
      missingExerciseTargets: missingTargets.length,
      exerciseIdMappings: [...exerciseIdMap].filter(([oldId, newId]) => oldId !== newId).length,
      orphanPlans: orphanPlans.length,
      recoveredBundles: recoveredBundles.length,
      droppedFields: Object.fromEntries(
        [...droppedFieldsByTable].map(([table, fields]) => [table, [...fields].sort()]),
      ),
    },
    null,
    2,
  ),
);
