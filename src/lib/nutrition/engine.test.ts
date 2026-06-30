import { describe, it, expect } from "vitest";
import { calcBmr, calcTargets, generateNutritionPlan } from "./engine";
import type { NutritionInput } from "./types";

const base: NutritionInput = {
  objective: "hipertrofia",
  sex: "masculino",
  age: 30,
  weightKg: 80,
  heightCm: 180,
  activity: "moderado",
  mealsPerDay: 4,
};

describe("nutrition engine", () => {
  it("calcula TMB Mifflin-St Jeor (homem)", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calcBmr(base)).toBe(1780);
  });

  it("calcula TMB Mifflin-St Jeor (mulher)", () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
    expect(calcBmr({ ...base, sex: "feminino", age: 28, weightKg: 60, heightCm: 165 })).toBe(1330);
  });

  it("é determinístico: mesma entrada ⇒ mesma saída", () => {
    const a = generateNutritionPlan(base);
    const b = generateNutritionPlan(base);
    expect(a.targets).toEqual(b.targets);
    expect(a.meals.length).toBe(b.meals.length);
  });

  it("aplica superávit para hipertrofia e déficit para emagrecimento", () => {
    const bulk = calcTargets(base);
    const cut = calcTargets({ ...base, objective: "emagrecimento" });
    expect(bulk.calories).toBeGreaterThan(cut.calories);
  });

  it("proteína escala com o peso corporal", () => {
    const t = calcTargets(base);
    // 2.0 g/kg * 80 = 160
    expect(t.protein).toBe(160);
  });

  it("gera o número de refeições solicitado", () => {
    expect(generateNutritionPlan({ ...base, mealsPerDay: 5 }).meals.length).toBe(5);
    expect(generateNutritionPlan({ ...base, mealsPerDay: 3 }).meals.length).toBe(3);
  });

  it("calcula água a 35 ml/kg", () => {
    expect(calcTargets(base).waterMl).toBe(80 * 35);
  });

  it("avisa quando dados antropométricos faltam", () => {
    const r = generateNutritionPlan({ ...base, weightKg: 0 });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
