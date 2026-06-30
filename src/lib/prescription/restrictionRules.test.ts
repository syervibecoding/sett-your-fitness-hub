import { describe, it, expect } from "vitest";
import { analyzeRestrictions, isExerciseAllowed } from "./restrictionRules";
import { normalizePoolItem } from "./muscles";

describe("restrictionRules", () => {
  it("não restringe nada com texto vazio", () => {
    const r = analyzeRestrictions("");
    expect(r.avoidNamePatterns).toHaveLength(0);
    expect(r.notes).toHaveLength(0);
  });

  it("bloqueia agachamento com lesão de joelho", () => {
    const r = analyzeRestrictions("dor no joelho direito");
    const agacho = normalizePoolItem({ id: "1", name: "Agachamento livre", muscle_group: "quadríceps" });
    const cadeira = normalizePoolItem({ id: "2", name: "Cadeira extensora", muscle_group: "quadríceps" });
    expect(isExerciseAllowed(agacho, r)).toBe(false);
    expect(isExerciseAllowed(cadeira, r)).toBe(false);
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("bloqueia terra/stiff com problema lombar", () => {
    const r = analyzeRestrictions("hérnia de disco lombar");
    const terra = normalizePoolItem({ id: "1", name: "Levantamento terra", muscle_group: "posterior de coxa" });
    expect(isExerciseAllowed(terra, r)).toBe(false);
  });

  it("permite exercício não relacionado à restrição", () => {
    const r = analyzeRestrictions("dor no ombro");
    const rosca = normalizePoolItem({ id: "1", name: "Rosca direta", muscle_group: "bíceps" });
    expect(isExerciseAllowed(rosca, r)).toBe(true);
  });
});
