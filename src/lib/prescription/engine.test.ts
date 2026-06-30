import { describe, it, expect } from "vitest";
import { generatePrescription } from "./engine";
import { normalizePoolItem } from "./muscles";
import type { ExercisePoolItem, PrescriptionInput } from "./types";

// Biblioteca sintética cobrindo os principais grupos.
const RAW = [
  { id: "1", name: "Supino reto", muscle_group: "peitoral" },
  { id: "2", name: "Crucifixo", muscle_group: "peito" },
  { id: "3", name: "Remada curvada", muscle_group: "costas" },
  { id: "4", name: "Puxada alta", muscle_group: "costas" },
  { id: "5", name: "Desenvolvimento", muscle_group: "ombro" },
  { id: "6", name: "Elevação lateral", muscle_group: "ombro" },
  { id: "7", name: "Rosca direta", muscle_group: "bíceps" },
  { id: "8", name: "Tríceps testa", muscle_group: "tríceps" },
  { id: "9", name: "Agachamento livre", muscle_group: "quadríceps" },
  { id: "10", name: "Cadeira extensora", muscle_group: "quadríceps" },
  { id: "11", name: "Stiff", muscle_group: "posterior de coxa" },
  { id: "12", name: "Mesa flexora", muscle_group: "posterior de coxa" },
  { id: "13", name: "Elevação pélvica", muscle_group: "glúteo" },
  { id: "14", name: "Panturrilha em pé", muscle_group: "panturrilha" },
  { id: "15", name: "Abdominal supra", muscle_group: "abdômen" },
  { id: "16", name: "Encolhimento", muscle_group: "trapézio" },
  { id: "17", name: "Rosca punho", muscle_group: "antebraço" },
];

const pool: ExercisePoolItem[] = RAW.map(normalizePoolItem);

function input(overrides: Partial<PrescriptionInput> = {}): PrescriptionInput {
  return {
    objective: "hipertrofia",
    experience: "intermediario",
    daysPerWeek: 3,
    sessionDurationMin: 60,
    equipment: "academia_completa",
    durationWeeks: 6,
    pool,
    ...overrides,
  };
}

describe("generatePrescription", () => {
  it("é determinístico (mesma entrada ⇒ mesma saída)", () => {
    const a = JSON.stringify(generatePrescription(input()).workouts);
    const b = JSON.stringify(generatePrescription(input()).workouts);
    expect(a).toBe(b);
  });

  it("gera o número de treinos igual aos dias/semana (≥3 → PPL)", () => {
    const plan = generatePrescription(input({ daysPerWeek: 3 }));
    expect(plan.workouts).toHaveLength(3);
    expect(plan.splitName).toContain("Push");
  });

  it("usa Full Body para iniciantes", () => {
    const plan = generatePrescription(input({ experience: "iniciante", daysPerWeek: 3 }));
    expect(plan.splitName).toContain("Full Body");
  });

  it("4 dias → Upper/Lower", () => {
    const plan = generatePrescription(input({ daysPerWeek: 4 }));
    expect(plan.workouts).toHaveLength(4);
    expect(plan.splitName).toContain("Upper");
  });

  it("força usa reps baixas em compostos", () => {
    const plan = generatePrescription(input({ objective: "forca" }));
    const supino = plan.workouts
      .flatMap((w) => w.exercises)
      .find((e) => e.exercise_name === "Supino reto");
    expect(supino?.reps).toBe("3-5");
  });

  it("calcula volume semanal por grupo", () => {
    const plan = generatePrescription(input());
    expect(plan.weeklyVolume.length).toBeGreaterThan(0);
    const peito = plan.weeklyVolume.find((v) => v.muscle === "peito");
    expect(peito && peito.sets).toBeGreaterThan(0);
  });
});
