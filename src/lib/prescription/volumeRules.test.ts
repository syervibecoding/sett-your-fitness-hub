import { describe, it, expect } from "vitest";
import { volumeTarget, computeWeeklyVolume } from "./volumeRules";
import type { GeneratedWorkout } from "./types";

describe("volumeRules", () => {
  it("ajusta alvo de volume por nível", () => {
    const ini = volumeTarget("peito", "iniciante");
    const inter = volumeTarget("peito", "intermediario");
    const av = volumeTarget("peito", "avancado");
    expect(ini[1]).toBeLessThan(inter[1]);
    expect(av[1]).toBeGreaterThan(inter[1]);
  });

  it("soma séries por grupo e marca status", () => {
    const workouts: GeneratedWorkout[] = [
      {
        label: "A",
        title: "A",
        focus: "",
        description: "",
        exercises: [
          { exercise_id: "1", exercise_name: "Supino", muscle_group: "peito", canonical: "peito", video_url: null, video_path: null, sets: "4", reps: "8", rest: "90s", rpe: "8", notes: "" },
          { exercise_id: "2", exercise_name: "Crucifixo", muscle_group: "peito", canonical: "peito", video_url: null, video_path: null, sets: "3", reps: "12", rest: "60s", rpe: "9", notes: "" },
        ],
      },
    ];
    const vol = computeWeeklyVolume(workouts, "intermediario");
    const peito = vol.find((v) => v.muscle === "peito");
    expect(peito?.sets).toBe(7);
    expect(["low", "ok", "high"]).toContain(peito?.status);
  });
});
