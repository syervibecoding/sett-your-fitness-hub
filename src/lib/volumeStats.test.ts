import { describe, it, expect } from "vitest";
import { buildExerciseMeta, volumeLoadByWeek, volumeByMuscleGroup } from "./volumeStats";

const cycles = [
  {
    workouts: [
      { id: "w1", exercises: [
        { exercise_name: "Supino", muscle_group: "peitoral" },
        { exercise_name: "Agacho", muscle_group: "quadríceps" },
      ] },
    ],
  },
];

describe("volumeLoadByWeek", () => {
  it("soma volume-load por semana ISO e conta dias treinados", () => {
    const logs = [
      // semana de 2026-06-08 (seg) a 14 — duas datas distintas
      { weight: 100, reps_done: 10, session_date: "2026-06-08", workout_id: "w1", exercise_index: 0 },
      { weight: 50, reps_done: 10, session_date: "2026-06-10", workout_id: "w1", exercise_index: 1 },
      // semana seguinte
      { weight: 80, reps_done: 5, session_date: "2026-06-15", workout_id: "w1", exercise_index: 0 },
    ];
    const out = volumeLoadByWeek(logs);
    expect(out).toHaveLength(2);
    expect(out[0].weekStart).toBe("2026-06-08");
    expect(out[0].volume).toBe(1500); // 100*10 + 50*10
    expect(out[0].sessions).toBe(2);
    expect(out[1].volume).toBe(400); // 80*5
  });

  it("ignora logs sem data ou inválidos sem quebrar", () => {
    const out = volumeLoadByWeek([
      { weight: 10, reps_done: 10, session_date: null, workout_id: "w1", exercise_index: 0 },
      { weight: 10, reps_done: 10, session_date: "lixo", workout_id: "w1", exercise_index: 0 },
    ]);
    expect(out).toHaveLength(0);
  });
});

describe("volumeByMuscleGroup", () => {
  it("agrega volume por grupamento via meta dos ciclos", () => {
    const meta = buildExerciseMeta(cycles);
    const logs = [
      { weight: 100, reps_done: 10, session_date: "2026-06-08", workout_id: "w1", exercise_index: 0 }, // peitoral 1000
      { weight: 60, reps_done: 10, session_date: "2026-06-08", workout_id: "w1", exercise_index: 1 },  // quadríceps 600
      { weight: 40, reps_done: 5, session_date: "2026-06-10", workout_id: "w1", exercise_index: 0 },   // peitoral +200
    ];
    const out = volumeByMuscleGroup(logs, meta);
    expect(out[0]).toEqual({ group: "peitoral", volume: 1200 });
    expect(out[1]).toEqual({ group: "quadríceps", volume: 600 });
  });
});
