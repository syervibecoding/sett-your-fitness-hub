import { buildDeterministicAssessmentJson } from "../supabase/functions/_shared/assessment/engine.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPLY = Deno.args.includes("--apply");

interface LegacyAssessmentRow {
  id: string;
  assessment_json: Record<string, unknown> | null;
  queixa_principal: string | null;
  historico_lesoes: string | null;
  modalidade: string | null;
  nivel: string | null;
}

function decode(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

async function runSupabaseQuery(sql: string) {
  const command = new Deno.Command("supabase", {
    args: ["db", "query", "--linked", sql],
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  if (!result.success) {
    throw new Error(decode(result.stderr) || `supabase db query exited with ${result.code}`);
  }
  const payload = JSON.parse(decode(result.stdout));
  return Array.isArray(payload?.rows) ? payload.rows : [];
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64Json(value: unknown) {
  return base64Utf8(JSON.stringify(value));
}

function normalizeFindingList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function frameId(index: number) {
  return `legacy-frame-${index + 1}`;
}

function normalizeRow(row: LegacyAssessmentRow) {
  const legacy = row.assessment_json && typeof row.assessment_json === "object"
    ? row.assessment_json
    : {};
  const views = Array.isArray(legacy.vistas) ? legacy.vistas : [];
  const frameRefs = views.map((view: any, index) => ({
    frameId: frameId(index),
    vista: String(view?.vista || `Vista ${index + 1}`),
  }));
  const frameFindings = views.map((view: any, index) => ({
    frameId: frameId(index),
    vista: String(view?.vista || `Vista ${index + 1}`),
    timestamp_seconds: typeof view?.time === "number" ? view.time : null,
    findings: normalizeFindingList(view?.compensacoes),
    observacao: normalizeFindingList(view?.compensacoes).length
      ? "Achados preservados da avaliacao original do professor."
      : "Sem compensacao registrada na avaliacao original.",
  }));
  const normalized = buildDeterministicAssessmentJson({
    frameRefs,
    frame_findings: frameFindings,
    queixa_principal: row.queixa_principal,
    historico_lesoes: row.historico_lesoes,
    modalidade: row.modalidade,
    nivel: row.nivel,
    observacoes_tecnicas: views.map((view: any) => ({
      vista: view?.vista || null,
      compensacoes: normalizeFindingList(view?.compensacoes),
    })),
    protocol_hint: legacy.protocol_hint,
    expected_movements: legacy.expected_movements,
    assessment_source: "legacy_video_assessment",
    reason: "legacy_assessment_normalization_2026_07_17",
  });

  return {
    ...legacy,
    ...normalized,
    legacy_source: {
      migrated_at: new Date().toISOString(),
      original_contract: "video_assessment_v0",
      vistas: legacy.vistas || [],
      total_compensacoes: legacy.total_compensacoes ?? null,
      protocol_hint: legacy.protocol_hint ?? null,
      expected_movements: legacy.expected_movements ?? null,
    },
  };
}

const rows = await runSupabaseQuery(`
  select id, assessment_json, queixa_principal, historico_lesoes, modalidade, nivel
  from public.functional_assessments
  where coalesce(assessment_json->>'schema', '') <> 'bn_functional_assessment_v1'
  order by created_at asc
`);

const updates = rows.map((raw: LegacyAssessmentRow) => {
  if (!UUID_RE.test(raw.id)) throw new Error("Invalid assessment id returned by database.");
  const assessment = normalizeRow(raw);
  const encodedAssessment = base64Json(assessment);
  const encodedReport = base64Utf8(String(assessment.relatorio_para_aluno || ""));
  return `
    update public.functional_assessments
       set assessment_json = convert_from(decode('${encodedAssessment}', 'base64'), 'UTF8')::jsonb,
           report_text = convert_from(decode('${encodedReport}', 'base64'), 'UTF8'),
           status = coalesce(status, 'completed')
     where id = '${raw.id}'::uuid
       and coalesce(assessment_json->>'schema', '') <> 'bn_functional_assessment_v1';
  `;
});

console.log(JSON.stringify({ found: rows.length, normalized: updates.length, apply: APPLY }));

if (APPLY && updates.length) {
  await runSupabaseQuery(`begin; ${updates.join("\n")} commit;`);
  const verification = await runSupabaseQuery(`
    select
      count(*) as total,
      count(*) filter (where assessment_json->>'schema' = 'bn_functional_assessment_v1') as normalized,
      count(*) filter (where assessment_json ? 'report_sections') as with_report,
      count(*) filter (where jsonb_array_length(coalesce(assessment_json->'ohs_compensations', '[]'::jsonb)) = 7) as with_seven_ohs
    from public.functional_assessments
  `);
  console.log(JSON.stringify({ verification: verification[0] || null }));
}
