// Motor determinístico de nutrição (Fase D3) — tipos compartilhados.
// Puro/determinístico: mesma entrada ⇒ mesma saída (sem IA).

export type NutritionObjective =
  | "hipertrofia"
  | "emagrecimento"
  | "manutencao"
  | "performance";

export type Sex = "masculino" | "feminino";

export type ActivityLevel =
  | "sedentario"
  | "leve"
  | "moderado"
  | "intenso"
  | "muito_intenso";

export interface NutritionInput {
  objective: NutritionObjective;
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activity: ActivityLevel;
  mealsPerDay: number; // 3..6
}

export interface MealItem {
  food: string;
  amount: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  name: string;
  time: string;
  items: MealItem[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export interface MacroTargets {
  calories: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  waterMl: number;
}

export interface NutritionPlanResult {
  input: NutritionInput;
  bmr: number;
  tdee: number;
  targets: MacroTargets;
  meals: Meal[];
  rationale: string[];
  warnings: string[];
}
