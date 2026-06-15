import { describe, expect, it } from "vitest";
import { generateTrainingProgram } from "./engine";
import type { ExerciseCatalogEntry, PrescriptionInput } from "./types";

const catalog: ExerciseCatalogEntry[] = [
  { id: "mob-ankle", name: "Mobilidade de Tornozelo e Quadril", muscle_group: "mobilidade", equipment: "livre", targets: [{ muscle_group: "mobilidade" }] },
  { id: "plank", name: "Prancha Frontal", muscle_group: "core", equipment: "livre", targets: [{ muscle_group: "core" }] },
  { id: "dead-bug", name: "Dead Bug", muscle_group: "core", equipment: "livre", targets: [{ muscle_group: "core" }] },
  { id: "glute-band", name: "Abdução de Quadril Mini Band", muscle_group: "glúteos", equipment: "mini band", targets: [{ muscle_group: "glúteos" }] },
  { id: "box-squat", name: "Agachamento na Caixa", muscle_group: "quadríceps", equipment: "livre", pain_limitation_tags: ["joelho"], regressions: ["Reduzir amplitude"], targets: [{ muscle_group: "quadríceps" }] },
  { id: "leg-press", name: "Leg Press", muscle_group: "quadríceps", equipment: "máquina", targets: [{ muscle_group: "quadríceps" }] },
  { id: "leg-curl", name: "Mesa Flexora", muscle_group: "posterior", equipment: "máquina", targets: [{ muscle_group: "posterior" }] },
  { id: "thoracic-mob", name: "Mobilidade Torácica", muscle_group: "ombros", equipment: "livre", targets: [{ muscle_group: "ombros" }] },
  { id: "face-pull", name: "Face Pull", muscle_group: "ombros", equipment: "cabo", targets: [{ muscle_group: "ombros" }, { muscle_group: "costas" }] },
  { id: "row", name: "Remada Baixa", muscle_group: "costas", equipment: "máquina", targets: [{ muscle_group: "costas" }] },
  { id: "machine-press", name: "Supino Máquina Pegada Neutra", muscle_group: "peitoral", equipment: "máquina", targets: [{ muscle_group: "peitoral" }] },
  { id: "lat-pulldown", name: "Puxada Frente", muscle_group: "costas", equipment: "máquina", targets: [{ muscle_group: "costas" }] },
  { id: "step-up", name: "Step Up Baixo", muscle_group: "glúteos", equipment: "livre", targets: [{ muscle_group: "glúteos" }] },
  { id: "hip-thrust", name: "Hip Thrust", muscle_group: "glúteos", equipment: "máquina", targets: [{ muscle_group: "glúteos" }] },
  { id: "rdl", name: "Terra Romeno", muscle_group: "posterior", equipment: "halteres", contraindications: ["lombar"], targets: [{ muscle_group: "posterior" }] },
  { id: "calf-core", name: "Panturrilha em Pé + Core", muscle_group: "core", equipment: "livre", targets: [{ muscle_group: "panturrilhas" }, { muscle_group: "core" }] },
];

function baseInput(overrides: Partial<PrescriptionInput> = {}): PrescriptionInput {
  return {
    studentName: "Aluno Teste",
    objective: "hipertrofia",
    fitnessLevel: "iniciante",
    daysPerWeek: 3,
    durationWeeks: 6,
    equipment: "academia completa",
    restrictions: "",
    catalog,
    ...overrides,
  };
}

function allExerciseIds(program: ReturnType<typeof generateTrainingProgram>) {
  return program.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.exercise_id));
}

describe("BN Prescription Engine v1", () => {
  it("gera plano para iniciante com dor no joelho priorizando glúteo/controle e sem inventar exercício", () => {
    const program = generateTrainingProgram(baseInput({
      restrictions: "dor no joelho e valgo dinâmico",
      assessmentContext: { ohs_compensations: [{ key: "dynamic_valgus", presente: true }] },
    }));

    expect(program.generated_by).toBe("bn_prescription_engine_v1");
    expect(program.methodology_preset.key).toBe("retorno_lesao");
    expect(program.explanations.some((e) => e.code.includes("valgo") || e.code.includes("joelho"))).toBe(true);
    expect(program.biomechanical_notes.toLowerCase()).toContain("joelho");
    expect(allExerciseIds(program).every((id) => catalog.some((exercise) => exercise.id === id))).toBe(true);
  });

  it("reduz carga axial quando há dor lombar", () => {
    const program = generateTrainingProgram(baseInput({
      restrictions: "dor lombar ao agachar",
      assessmentContext: { ohs_compensations: [{ key: "butt_wink", presente: true }] },
    }));

    expect(program.explanations.some((e) => e.code.includes("lombar") || e.code.includes("butt"))).toBe(true);
    expect(JSON.stringify(program).toLowerCase()).toContain("lombar");
    expect(program.validator.pre_save.status).not.toBe("blocked");
  });

  it("aplica restrição de ombro e prioriza estabilidade escapular", () => {
    const program = generateTrainingProgram(baseInput({
      restrictions: "dor no ombro em movimentos overhead",
      assessmentContext: { ohs_compensations: [{ key: "shoulder_protraction_kyphosis", presente: true }] },
    }));

    expect(program.explanations.some((e) => e.code.includes("ombro"))).toBe(true);
    expect(program.workouts.flatMap((w) => w.exercises).some((e) => /face pull|remada/i.test(e.exercise_name))).toBe(true);
  });

  it("ajusta musculação quando há corrida/endurance junto", () => {
    const program = generateTrainingProgram(baseInput({
      isEnduranceAthlete: true,
      runningDaysContext: { days_per_week: 3, sport: "corrida" },
    }));

    expect(program.methodology_preset.key).toBe("corrida_musculacao");
    expect(program.explanations.some((e) => e.code === "reduzi_mmii_por_corrida")).toBe(true);
    expect(program.weekly_structure).toContain("sessões/semana");
  });

  it("não inventa exercícios quando a biblioteca está vazia", () => {
    const program = generateTrainingProgram(baseInput({ catalog: [] }));

    expect(program.workouts.flatMap((w) => w.exercises)).toEqual([]);
    expect(program.library_policy.gaps.length).toBeGreaterThan(0);
    expect(program.validator.pre_save.status).toBe("blocked");
    expect(program.validator.pre_save.blockers.some((b) => b.code === "empty_exercise_library")).toBe(true);
  });

  it("funciona com biblioteca incompleta sem criar IDs falsos", () => {
    const partialCatalog = catalog.slice(0, 3);
    const program = generateTrainingProgram(baseInput({ catalog: partialCatalog }));

    expect(allExerciseIds(program).every((id) => partialCatalog.some((exercise) => exercise.id === id))).toBe(true);
    expect(program.library_policy.catalog_count).toBe(3);
  });

  it("protege volume de iniciante de excesso grosseiro", () => {
    const program = generateTrainingProgram(baseInput({ fitnessLevel: "iniciante", daysPerWeek: 5 }));
    const highVolume = program.validator.pre_save.volume_review.filter((item) => item.status === "alto");

    expect(highVolume.every((item) => item.weekly_sets <= 16)).toBe(true);
    expect(program.progression_protocol.toLowerCase()).toContain("reps");
  });

  it("retorna contrato de saída compatível com Studio/PDF/publicação", () => {
    const program = generateTrainingProgram(baseInput());

    expect(program).toMatchObject({
      cycle_name: expect.any(String),
      objective: expect.any(String),
      duration_weeks: 6,
      generated_by: "bn_prescription_engine_v1",
      library_policy: { only_library_exercises: true, catalog_count: catalog.length },
      validator: { pre_save: expect.any(Object) },
      bnito_after_generation: { intent: "notify_student_prescription_ready" },
    });
    expect(program.workouts.length).toBe(3);
    expect(program.workouts[0].exercises[0]).toMatchObject({
      phase: expect.any(String),
      exercise_id: expect.any(String),
      exercise_name: expect.any(String),
      sets: expect.any(Number),
      reps: expect.any(String),
      rest_seconds: expect.any(Number),
      exercise_order: expect.any(Number),
    });
  });
});
