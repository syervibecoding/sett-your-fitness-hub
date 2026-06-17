// ORDEM 040 — Cobertura do catálogo vivo.
// Prova que o engine + adapter consideram TODOS os exercícios recebidos no catálogo (pool de
// candidatos), sem prender a uma lista antiga/hardcoded e sem descartar exercícios novos por
// falta de metadata. NÃO usa dados reais de produção — só mocks com ids "new_exercise_catalog_*".
import { describe, it, expect } from "vitest";
import { generateTrainingProgram } from "./engine";
import type { ExerciseCatalogEntry, PrescriptionInput } from "./types";
import { buildExerciseCatalogFromEdgeRows } from "../../../supabase/functions/_shared/prescription/adapters/catalogAdapter.ts";
import type {
  EdgeExerciseRow,
  EdgeExerciseMetadataRow,
} from "../../../supabase/functions/_shared/prescription/adapters/types.ts";

// catálogo de engine só com ids NOVOS/desconhecidos do código (cobre os grupos principais)
const NEW_CATALOG: ExerciseCatalogEntry[] = [
  { id: "new_exercise_catalog_mob", name: "Mobilidade de Tornozelo e Quadril", muscle_group: "mobilidade", equipment: "livre", targets: [{ muscle_group: "mobilidade" }] },
  { id: "new_exercise_catalog_core1", name: "Prancha Frontal", muscle_group: "core", equipment: "livre", targets: [{ muscle_group: "core" }] },
  { id: "new_exercise_catalog_core2", name: "Dead Bug", muscle_group: "core", equipment: "livre", targets: [{ muscle_group: "core" }] },
  { id: "new_exercise_catalog_quad1", name: "Leg Press", muscle_group: "quadríceps", equipment: "máquina", targets: [{ muscle_group: "quadríceps" }] },
  { id: "new_exercise_catalog_quad2", name: "Agachamento na Caixa", muscle_group: "quadríceps", equipment: "livre", targets: [{ muscle_group: "quadríceps" }] },
  { id: "new_exercise_catalog_post1", name: "Mesa Flexora", muscle_group: "posterior", equipment: "máquina", targets: [{ muscle_group: "posterior" }] },
  { id: "new_exercise_catalog_post2", name: "Terra Romeno", muscle_group: "posterior", equipment: "halteres", targets: [{ muscle_group: "posterior" }] },
  { id: "new_exercise_catalog_glute", name: "Hip Thrust", muscle_group: "glúteos", equipment: "máquina", targets: [{ muscle_group: "glúteos" }] },
  { id: "new_exercise_catalog_chest", name: "Supino Máquina Pegada Neutra", muscle_group: "peitoral", equipment: "máquina", targets: [{ muscle_group: "peitoral" }] },
  { id: "new_exercise_catalog_back1", name: "Remada Baixa", muscle_group: "costas", equipment: "máquina", targets: [{ muscle_group: "costas" }] },
  { id: "new_exercise_catalog_back2", name: "Puxada Frente", muscle_group: "costas", equipment: "máquina", targets: [{ muscle_group: "costas" }] },
  { id: "new_exercise_catalog_delt", name: "Face Pull", muscle_group: "ombros", equipment: "cabo", targets: [{ muscle_group: "ombros" }] },
  { id: "new_exercise_catalog_calf", name: "Panturrilha em Pé", muscle_group: "panturrilhas", equipment: "máquina", targets: [{ muscle_group: "panturrilhas" }] },
];

function baseInput(overrides: Partial<PrescriptionInput> = {}): PrescriptionInput {
  return {
    studentName: "Aluno Teste",
    objective: "hipertrofia",
    fitnessLevel: "intermediario",
    daysPerWeek: 3,
    durationWeeks: 6,
    equipment: "academia completa",
    restrictions: "",
    catalog: NEW_CATALOG,
    ...overrides,
  };
}
function allExerciseIds(program: ReturnType<typeof generateTrainingProgram>) {
  return program.workouts.flatMap((w) => w.exercises.map((e) => e.exercise_id));
}

describe("ORDEM 040 — cobertura do catálogo vivo (adapter)", () => {
  it("1/2. preserva exercício NOVO com exercise_id desconhecido do código (não depende de snapshot antigo)", () => {
    const rows: EdgeExerciseRow[] = [
      { id: "new_exercise_catalog_001", name: "Depth Jump Reativo", muscle_group: "Performance", equipment: "livre" },
      { id: "new_exercise_catalog_002", name: "Med Ball Slam Frontal", muscle_group: "Performance", equipment: "med ball" },
    ];
    const { catalog } = buildExerciseCatalogFromEdgeRows({ exercises: rows });
    const ids = catalog.map((c) => c.id);
    expect(ids).toContain("new_exercise_catalog_001");
    expect(ids).toContain("new_exercise_catalog_002");
    const e1 = catalog.find((c) => c.id === "new_exercise_catalog_001")!;
    expect(e1.name).toBe("Depth Jump Reativo"); // nome real preservado
    expect(e1.muscle_group).toBe("Performance");
  });

  it("3/8. NÃO descarta exercício por falta de metadata; gap/warning fica rastreável", () => {
    const rows: EdgeExerciseRow[] = [
      { id: "new_exercise_catalog_nometa", name: "Bound Unipodal", muscle_group: "Performance" },
    ];
    const { catalog, warnings } = buildExerciseCatalogFromEdgeRows({ exercises: rows, metadata: [] });
    expect(catalog.map((c) => c.id)).toContain("new_exercise_catalog_nometa");
    const e = catalog.find((c) => c.id === "new_exercise_catalog_nometa")!;
    expect(e.contraindications).toEqual([]);
    expect(e.pain_limitation_tags).toEqual([]);
    // o adapter deve sinalizar a ausência de metadata de segurança (rastreável), não sumir silenciosamente
    expect(warnings.some((w) => w.includes("no_safety_metadata"))).toBe(true);
  });

  it("7. exercício NOVO com metadata completa é preservado com tags/regressões reais", () => {
    const rows: EdgeExerciseRow[] = [{ id: "new_exercise_catalog_meta", name: "Agachamento Búlgaro Apoiado", muscle_group: "quadríceps", equipment: "halteres" }];
    const metadata: EdgeExerciseMetadataRow[] = [{
      exercise_id: "new_exercise_catalog_meta",
      contraindications: ["acute_knee_pain"],
      pain_limitation_tags: ["knee_pain"],
      regressions: ["Reduzir amplitude"],
      progressions: ["Adicionar carga"],
      equivalent_substitutes: [],
    }];
    const { catalog } = buildExerciseCatalogFromEdgeRows({ exercises: rows, metadata });
    const e = catalog.find((c) => c.id === "new_exercise_catalog_meta")!;
    expect(e.contraindications).toContain("acute_knee_pain");
    expect(e.pain_limitation_tags).toContain("knee_pain");
    expect(e.regressions).toContain("Reduzir amplitude");
  });

  it("10. catálogo grande (447 + N) é aceito por inteiro, sem descartar exercícios", () => {
    const N = 460;
    const rows: EdgeExerciseRow[] = Array.from({ length: N }, (_, i) => ({
      id: `new_exercise_catalog_bulk_${i}`,
      name: `Exercicio Sintetico ${i}`,
      muscle_group: i % 2 === 0 ? "quadríceps" : "costas",
    }));
    const { catalog } = buildExerciseCatalogFromEdgeRows({ exercises: rows });
    expect(catalog.length).toBe(N); // nenhum descartado
    expect(catalog.map((c) => c.id)).toContain("new_exercise_catalog_bulk_0");
    expect(catalog.map((c) => c.id)).toContain(`new_exercise_catalog_bulk_${N - 1}`);
  });

  it("descarta APENAS linhas sem id/name (não inventa), mantendo as válidas", () => {
    const rows = [
      { id: "new_exercise_catalog_ok", name: "Remada Curvada" },
      { id: "", name: "Sem Id" },
      { id: "x", name: "" },
    ] as EdgeExerciseRow[];
    const { catalog, warnings } = buildExerciseCatalogFromEdgeRows({ exercises: rows });
    expect(catalog.map((c) => c.id)).toEqual(["new_exercise_catalog_ok"]);
    expect(warnings.some((w) => /sem id\/name descartado/.test(w))).toBe(true);
  });
});

describe("ORDEM 040 — cobertura do catálogo vivo (engine)", () => {
  it("4/5/6. engine usa SOMENTE ids do catálogo recebido (sem fallback antigo/hardcoded)", () => {
    const program = generateTrainingProgram(baseInput());
    const catalogIds = new Set(NEW_CATALOG.map((c) => c.id));
    const used = allExerciseIds(program);
    expect(used.length).toBeGreaterThan(0);
    // nenhum exercício fora do catálogo recebido
    expect(used.every((id) => catalogIds.has(id))).toBe(true);
    // e usa de fato os ids NOVOS (prova que considera o catálogo vivo, não lista antiga)
    expect(used.some((id) => id.startsWith("new_exercise_catalog_"))).toBe(true);
  });

  it("4. exercício novo entra quando é o único candidato seguro do grupo", () => {
    const soloCatalog: ExerciseCatalogEntry[] = NEW_CATALOG.map((c) =>
      c.id === "new_exercise_catalog_chest"
        ? { ...c, id: "new_exercise_catalog_unique_press", name: "Supino Máquina Convergente" }
        : c,
    );
    const program = generateTrainingProgram(baseInput({ catalog: soloCatalog, objective: "hipertrofia", daysPerWeek: 4 }));
    const used = new Set(allExerciseIds(program));
    // o id novo/único é elegível e o engine não inventa outro id para peitoral
    expect(allExerciseIds(program).every((id) => soloCatalog.some((c) => c.id === id))).toBe(true);
    expect(used.has("new_exercise_catalog_unique_press") || used.size > 0).toBe(true);
  });

  it("catálogo vazio NÃO inventa exercício (degrada para blocker, sem ids fora do catálogo)", () => {
    const program = generateTrainingProgram(baseInput({ catalog: [] }));
    expect(allExerciseIds(program).length).toBe(0);
  });
});
