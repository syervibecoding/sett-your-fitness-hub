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

function prescribedExerciseText(program: ReturnType<typeof generateTrainingProgram>) {
  return program.workouts
    .flatMap((workout) => workout.exercises)
    .map((exercise) => `${exercise.exercise_name} ${exercise.cues} ${exercise.biomechanical_note}`)
    .join(" ")
    .toLowerCase();
}

function weeklySetsByGroup(program: ReturnType<typeof generateTrainingProgram>) {
  const out = new Map<string, number>();
  for (const exercise of program.workouts.flatMap((workout) => workout.exercises)) {
    const group = exercise.muscle_group.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    out.set(group, (out.get(group) || 0) + exercise.sets);
  }
  return out;
}

describe("BN Prescription Engine v1", () => {
  it("gera plano para iniciante com dor no joelho priorizando glúteo/controle e sem inventar exercício", () => {
    const program = generateTrainingProgram(baseInput({
      restrictions: "dor no joelho e valgo dinâmico",
      assessmentContext: { ohs_compensations: [{ key: "dynamic_valgus", presente: true }] },
    }));

    expect(program.generated_by).toBe("bn_prescription_engine_v1");
    expect(program.methodology_preset.key).toBe("retorno_lesao");
    expect(program.explanations.some((e) => e.rule_id.includes("valgo") || e.rule_id.includes("joelho"))).toBe(true);
    expect(program.biomechanical_notes.toLowerCase()).toContain("joelho");
    expect(allExerciseIds(program).every((id) => catalog.some((exercise) => exercise.id === id))).toBe(true);
    expect(prescribedExerciseText(program)).not.toMatch(/pliometr|salto|atg/);
    expect(JSON.stringify(program).toLowerCase()).toContain("glute");
  });

  it("reduz carga axial quando há dor lombar", () => {
    const program = generateTrainingProgram(baseInput({
      restrictions: "dor lombar ao agachar",
      assessmentContext: { ohs_compensations: [{ key: "butt_wink", presente: true }] },
    }));

    expect(program.explanations.some((e) => e.rule_id.includes("lombar") || e.rule_id.includes("butt"))).toBe(true);
    expect(JSON.stringify(program).toLowerCase()).toContain("lombar");
    expect(JSON.stringify(program).toLowerCase()).toContain("anti-rotação");
    expect(prescribedExerciseText(program)).not.toMatch(/good morning|terra convencional pesado|flexão espinhal carregada/);
    expect(program.validator.pre_save.status).not.toBe("blocked");
  });

  it("aplica restrição de ombro e prioriza estabilidade escapular", () => {
    const program = generateTrainingProgram(baseInput({
      restrictions: "dor no ombro em movimentos overhead",
      assessmentContext: { ohs_compensations: [{ key: "shoulder_protraction_kyphosis", presente: true }] },
    }));

    expect(program.explanations.some((e) => e.rule_id.includes("ombro"))).toBe(true);
    expect(program.workouts.flatMap((w) => w.exercises).some((e) => /face pull|remada/i.test(e.exercise_name))).toBe(true);
    expect(JSON.stringify(program).toLowerCase()).not.toMatch(/atrás da nuca|remada alta|dips/);
  });

  it("ajusta musculação quando há corrida/endurance junto", () => {
    const program = generateTrainingProgram(baseInput({
      isEnduranceAthlete: true,
      runningDaysContext: { days_per_week: 3, sport: "corrida" },
    }));

    expect(program.methodology_preset.key).toBe("corrida_musculacao");
    expect(program.explanations.some((e) => e.rule_id === "reduzi_mmii_por_corrida")).toBe(true);
    expect(program.validator.pre_save.warnings.some((w) => w.code === "endurance_agenda_missing")).toBe(true);
    expect(program.weekly_structure).toContain("sessões/semana");
  });

  it("rebaixa iniciante com 6 dias para 3-4 dias estruturados e explica a decisão", () => {
    const program = generateTrainingProgram(baseInput({ fitnessLevel: "iniciante", daysPerWeek: 6 }));

    expect(program.workouts.length).toBeLessThanOrEqual(4);
    expect(program.weekly_structure).toContain("3-4 dias estruturados");
    expect(program.explanations.some((e) => e.rule_id === "rebaixei_frequencia_iniciante_6_dias")).toBe(true);
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
    const largeGroups = program.validator.pre_save.volume_review.filter((item) => ["quadriceps", "posterior", "gluteos", "costas", "peitoral"].includes(item.muscle_group));
    const smallGroups = program.validator.pre_save.volume_review.filter((item) => ["core", "ombros", "panturrilhas"].includes(item.muscle_group));

    expect(highVolume.every((item) => item.weekly_sets <= 16)).toBe(true);
    expect(largeGroups.every((item) => item.weekly_sets <= 12)).toBe(true);
    expect(smallGroups.every((item) => item.weekly_sets <= 8)).toBe(true);
    expect(program.progression_protocol.toLowerCase()).toContain("reps");
  });

  it("aplica progressão BN de 6 semanas e trava quando há dor/técnica quebrada", () => {
    const program = generateTrainingProgram(baseInput({ techniqueBreakdown: true, restrictions: "dor EVA 4 no joelho" }));
    const blocks = JSON.stringify(program.periodization_blocks).toLowerCase();

    expect(blocks).toContain("1-2");
    expect(blocks).toContain("rir 3-4");
    expect(blocks).toContain("2-3");
    expect(blocks).toContain("rir 2");
    expect(program.progression_protocol.toLowerCase()).toContain("hold/regress");
    expect(blocks).toContain("sem metodos avancados");
  });

  it("aplica deload reduzindo volume, usando RIR 4-5 e removendo métodos avançados", () => {
    const normal = generateTrainingProgram(baseInput());
    const deload = generateTrainingProgram(baseInput({ deload: true }));
    const normalSets = normal.workouts.flatMap((w) => w.exercises).reduce((sum, e) => sum + e.sets, 0);
    const deloadSets = deload.workouts.flatMap((w) => w.exercises).reduce((sum, e) => sum + e.sets, 0);

    expect(deloadSets).toBeLessThan(normalSets);
    expect(deload.workouts.flatMap((w) => w.exercises).every((e) => e.rir === "4-5")).toBe(true);
    expect(deload.progression_protocol.toLowerCase()).toContain("deload");
    expect(deload.explanations.some((e) => e.category === "deload")).toBe(true);
  });

  it("retorna contrato de saída compatível com Studio/PDF/publicação", () => {
    const program = generateTrainingProgram(baseInput());

    expect(program).toMatchObject({
      schemaVersion: "bn-prescription-v1",
      engineMeta: {
        version: "v1",
        library_only: true,
        requested_days: 3,
        structured_days: 3,
      },
      cycle_name: expect.any(String),
      objective: expect.any(String),
      duration_weeks: 6,
      generated_by: "bn_prescription_engine_v1",
      library_policy: { only_library_exercises: true, catalog_count: catalog.length },
      validator: { pre_save: expect.any(Object) },
      validation: expect.any(Object),
      bnito_after_generation: { intent: "notify_student_prescription_ready" },
    });
    expect(program.workouts.length).toBe(3);
    expect(program.explanations[0]).toMatchObject({
      rule_id: expect.any(String),
      category: expect.any(String),
      source: expect.any(String),
      target: expect.any(String),
      action: expect.any(String),
      reason: expect.any(String),
    });
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

  it("seleciona preset de emagrecimento para iniciante sem subir volume agressivo", () => {
    const program = generateTrainingProgram(baseInput({ objective: "emagrecimento", fitnessLevel: "iniciante", daysPerWeek: 3 }));

    expect(program.methodology_preset.key).toBe("emagrecimento");
    expect(program.periodization_blocks.flatMap((block) => block.methods).join(" ").toLowerCase()).not.toMatch(/drop|cluster|rest-pause/);
    expect(program.validator.pre_save.volume_review.filter((item) => ["quadriceps", "posterior", "gluteos", "costas", "peitoral"].includes(item.muscle_group)).every((item) => item.weekly_sets <= 12)).toBe(true);
  });

  it("limita avançado em hipertrofia ao teto duro v1 de 16 séries por grupo grande", () => {
    const program = generateTrainingProgram(baseInput({ fitnessLevel: "avancado", objective: "hipertrofia", daysPerWeek: 5 }));

    expect(program.methodology_preset.key).toBe("hipertrofia_intermediario");
    expect(program.validator.pre_save.volume_review
      .filter((item) => ["quadriceps", "posterior", "gluteos", "costas", "peitoral"].includes(item.muscle_group))
      .every((item) => item.weekly_sets <= 16)).toBe(true);
  });

  it("usa retorno gradual com rampa conservadora quando objetivo pede retorno", () => {
    const program = generateTrainingProgram(baseInput({
      objective: "retorno gradual",
      restrictions: "retornando após lesão leve, sem dor atual",
      painEva: 2,
    }));

    expect(program.methodology_preset.key).toBe("retorno_lesao");
    expect(program.progression_protocol.toLowerCase()).toContain("progressao por tolerancia");
    expect(JSON.stringify(program.periodization_blocks).toLowerCase()).toContain("sem metodos avancados");
  });

  it("respeita equipamento limitado quando há alternativas reais na biblioteca", () => {
    const limitedCatalog: ExerciseCatalogEntry[] = [
      { id: "mob", name: "Mobilidade de Quadril Livre", muscle_group: "mobilidade", equipment: "livre" },
      { id: "dead-bug-livre", name: "Dead Bug Livre", muscle_group: "core", equipment: "livre" },
      { id: "glute-band-livre", name: "Abdução de Quadril com Mini Band", muscle_group: "glúteos", equipment: "mini band" },
      { id: "goblet", name: "Agachamento Goblet com Halteres", muscle_group: "quadríceps", equipment: "halteres" },
      { id: "rdl-halteres", name: "Terra Romeno com Halteres", muscle_group: "posterior", equipment: "halteres" },
      { id: "thoracic", name: "Mobilidade Torácica Livre", muscle_group: "ombros", equipment: "livre" },
      { id: "face-band", name: "Face Pull com Elástico", muscle_group: "ombros", equipment: "elástico" },
      { id: "row-db", name: "Remada Unilateral com Halteres", muscle_group: "costas", equipment: "halteres" },
      { id: "pushup", name: "Flexão de Braços", muscle_group: "peitoral", equipment: "livre" },
      { id: "band-pulldown", name: "Puxada com Elástico", muscle_group: "costas", equipment: "elástico" },
      { id: "step-livre", name: "Step Up Baixo Livre", muscle_group: "glúteos", equipment: "livre" },
      { id: "bridge", name: "Ponte de Glúteos Livre", muscle_group: "glúteos", equipment: "livre" },
      { id: "calf", name: "Panturrilha em Pé Livre + Core", muscle_group: "core", equipment: "livre" },
    ];
    const program = generateTrainingProgram(baseInput({ catalog: limitedCatalog, equipment: "halteres elástico livre", daysPerWeek: 3 }));

    expect(allExerciseIds(program).every((id) => limitedCatalog.some((exercise) => exercise.id === id))).toBe(true);
    expect(program.workouts.flatMap((w) => w.exercises).every((exercise) => !/máquina|maquina/i.test(exercise.exercise_name))).toBe(true);
  });

  it("bloqueia quando o catálogo existe mas não há substituto seguro para padrão necessário", () => {
    const unsafeCatalog: ExerciseCatalogEntry[] = [
      {
        id: "unsafe-squat",
        name: "Agachamento Livre Profundo ATG",
        muscle_group: "quadríceps",
        equipment: "barra",
        contraindications: ["joelho"],
        pain_limitation_tags: ["joelho"],
      },
    ];
    const program = generateTrainingProgram(baseInput({
      catalog: unsafeCatalog,
      restrictions: "dor no joelho EVA 4 e valgo dinâmico",
      painEva: 4,
      assessmentContext: { ohs_compensations: [{ key: "dynamic_valgus", presente: true, severidade: "moderada" }] },
    }));

    expect(program.validator.pre_save.status).toBe("blocked");
    expect(program.validator.pre_save.blockers.some((blocker) => blocker.code === "safe_alternative_unavailable")).toBe(true);
    expect(allExerciseIds(program).every((id) => unsafeCatalog.some((exercise) => exercise.id === id))).toBe(true);
    expect(allExerciseIds(program)).not.toContain("unsafe-squat");
  });

  it("bloqueia EVA maior que 5 e registra handoff obrigatório ao professor", () => {
    const program = generateTrainingProgram(baseInput({
      restrictions: "dor no joelho forte",
      painEva: 7,
      painReports: [{ region: "joelho", eva: 7 }],
    }));

    expect(program.validator.pre_save.status).toBe("blocked");
    expect(program.validator.pre_save.blockers.some((blocker) => blocker.code === "high_pain_requires_professional_review")).toBe(true);
    expect(program.validator.pre_save.corrections.some((correction) => correction.code.includes("teacher_alert"))).toBe(true);
  });

  it("gera hipertrofia padrão 4 dias para intermediário sem dor", () => {
    const program = generateTrainingProgram(baseInput({ fitnessLevel: "intermediario", objective: "hipertrofia", daysPerWeek: 4 }));

    expect(program.methodology_preset.key).toBe("hipertrofia_intermediario");
    expect(program.workouts.length).toBe(4);
    expect(program.validator.pre_save.blockers).toEqual([]);
    expect(program.periodization_blocks).toHaveLength(3);
  });

  it("mantém 100% das explicações BNITO rastreáveis por rule_id", () => {
    const program = generateTrainingProgram(baseInput({ restrictions: "dor lombar EVA 4", painEva: 4 }));

    expect(program.explanations.length).toBeGreaterThan(0);
    expect(program.explanations.every((explanation) => Boolean(explanation.rule_id && explanation.category && explanation.source && explanation.target && explanation.action && explanation.reason))).toBe(true);
  });

  it("nunca retorna exercício fora da biblioteca quando catálogo existe", () => {
    const program = generateTrainingProgram(baseInput({ fitnessLevel: "intermediario", daysPerWeek: 4 }));
    const validIds = new Set(catalog.map((exercise) => exercise.id));

    expect(allExerciseIds(program).every((id) => validIds.has(id))).toBe(true);
  });

  it("não aplica volume de grupo grande a grupos pequenos", () => {
    const program = generateTrainingProgram(baseInput({ fitnessLevel: "intermediario", daysPerWeek: 4 }));
    const sets = weeklySetsByGroup(program);

    expect((sets.get("core") || 0)).toBeLessThanOrEqual(10);
    expect((sets.get("ombros") || 0)).toBeLessThanOrEqual(10);
  });
});
