import assert from "node:assert/strict";
import { sanitizeRow, sanitizeText } from "./replica-export.mjs";

const uuid = "a0000001-0000-0000-0000-000000000010";
const muscleGroupUuid = "835ef882-94b4-4567-8901-d6ebc143192d";

assert.equal(sanitizeText(uuid), uuid, "plain UUID text must not be redacted as phone");
assert.equal(
  sanitizeText(`Use ${uuid} e ligue (11) 98765-4321`),
  `Use ${uuid} e ligue [redacted-phone]`,
  "text redaction must preserve UUIDs while still redacting phones",
);

const clean = sanitizeRow({
  id: uuid,
  exercise_id: "e1000001-0000-0000-0000-000000000004",
  muscle_group_id: muscleGroupUuid,
  source_node_id: "a0000001-0000-0000-0000-000000000001",
  target_node_id: "a0000001-0000-0000-0000-000000000002",
  related_ids: ["a0000001-0000-0000-0000-000000000003"],
  name: "Exercicio (11) 98765-4321",
  notes: "contato teste@exemplo.com CPF 123.456.789-09",
  student_id: "must-be-stripped",
});

assert.equal(clean.id, uuid);
assert.equal(clean.exercise_id, "e1000001-0000-0000-0000-000000000004");
assert.equal(clean.muscle_group_id, muscleGroupUuid);
assert.equal(clean.source_node_id, "a0000001-0000-0000-0000-000000000001");
assert.equal(clean.target_node_id, "a0000001-0000-0000-0000-000000000002");
assert.deepEqual(clean.related_ids, ["a0000001-0000-0000-0000-000000000003"]);
assert.equal(clean.name, "Exercicio [redacted-phone]");
assert.equal(clean.notes, "contato [redacted-email] CPF [redacted-cpf]");
assert.equal(Object.hasOwn(clean, "student_id"), false);

console.log("replica-export sanitization tests passed");
