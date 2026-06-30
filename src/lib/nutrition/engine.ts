// Motor determinístico de nutrição (Fase D3).
// Calcula TMB (Mifflin-St Jeor) → GET → ajuste por objetivo → macros → refeições.
import type {
  ActivityLevel,
  Meal,
  MealItem,
  MacroTargets,
  NutritionInput,
  NutritionObjective,
  NutritionPlanResult,
} from "./types";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muito_intenso: 1.9,
};

// Ajuste calórico por objetivo (fração do GET).
const OBJECTIVE_CALORIE_ADJUST: Record<NutritionObjective, number> = {
  hipertrofia: 0.12, // superávit ~12%
  emagrecimento: -0.2, // déficit ~20%
  manutencao: 0,
  performance: 0.05,
};

// Proteína (g/kg) e gordura (g/kg) por objetivo. Carbo é o resto.
const MACRO_RULES: Record<NutritionObjective, { proteinPerKg: number; fatPerKg: number }> = {
  hipertrofia: { proteinPerKg: 2.0, fatPerKg: 0.9 },
  emagrecimento: { proteinPerKg: 2.2, fatPerKg: 0.8 },
  manutencao: { proteinPerKg: 1.8, fatPerKg: 0.9 },
  performance: { proteinPerKg: 1.8, fatPerKg: 1.0 },
};

const MEAL_NAMES = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];
const MEAL_TIMES = ["07:00", "10:00", "12:30", "16:00", "19:30", "22:00"];

// Distribuição calórica por número de refeições (frações que somam 1).
const MEAL_DISTRIBUTION: Record<number, number[]> = {
  3: [0.3, 0.4, 0.3],
  4: [0.25, 0.15, 0.35, 0.25],
  5: [0.25, 0.1, 0.3, 0.1, 0.25],
  6: [0.2, 0.1, 0.3, 0.1, 0.2, 0.1],
};

function round(n: number) {
  return Math.round(n);
}

export function calcBmr(input: NutritionInput): number {
  const { sex, weightKg, heightCm, age } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return round(sex === "masculino" ? base + 5 : base - 161);
}

export function calcTargets(input: NutritionInput): MacroTargets {
  const bmr = calcBmr(input);
  const tdee = bmr * ACTIVITY_FACTOR[input.activity];
  const calories = round(tdee * (1 + OBJECTIVE_CALORIE_ADJUST[input.objective]));

  const { proteinPerKg, fatPerKg } = MACRO_RULES[input.objective];
  const protein = round(proteinPerKg * input.weightKg);
  const fat = round(fatPerKg * input.weightKg);
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbs = Math.max(0, round((calories - proteinKcal - fatKcal) / 4));
  const waterMl = round(input.weightKg * 35);

  return { calories, protein, carbs, fat, waterMl };
}

// Template de alimento por refeição (proporções de macro), preenchido com gramas.
const MEAL_FOOD_TEMPLATES: Record<string, { food: string; macro: "protein" | "carbs" | "fat" | "mixed" }[]> = {
  "Café da manhã": [
    { food: "Ovos / claras", macro: "protein" },
    { food: "Aveia / pão integral", macro: "carbs" },
    { food: "Fruta", macro: "carbs" },
  ],
  "Lanche da manhã": [
    { food: "Iogurte / whey", macro: "protein" },
    { food: "Castanhas", macro: "fat" },
  ],
  "Almoço": [
    { food: "Carne / frango / peixe", macro: "protein" },
    { food: "Arroz / batata", macro: "carbs" },
    { food: "Legumes + azeite", macro: "fat" },
  ],
  "Lanche da tarde": [
    { food: "Whey / iogurte", macro: "protein" },
    { food: "Fruta / tapioca", macro: "carbs" },
  ],
  "Jantar": [
    { food: "Proteína magra", macro: "protein" },
    { food: "Carboidrato", macro: "carbs" },
    { food: "Salada + azeite", macro: "fat" },
  ],
  "Ceia": [
    { food: "Caseína / ovos", macro: "protein" },
    { food: "Pasta de amendoim", macro: "fat" },
  ],
};

function buildMealItems(
  mealName: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
): MealItem[] {
  const templates = MEAL_FOOD_TEMPLATES[mealName] || [
    { food: "Refeição balanceada", macro: "mixed" as const },
  ];
  // Aproxima quantidade em gramas a partir do macro dominante.
  return templates.map((t) => {
    let grams = 0;
    if (t.macro === "protein") grams = round((protein * 4) / 4); // g de proteína
    else if (t.macro === "carbs") grams = round(carbs);
    else if (t.macro === "fat") grams = round(fat);
    else grams = round((kcal / templates.length) / 4);
    return {
      food: t.food,
      amount: grams > 0 ? `~${grams} g` : "a definir",
      kcal: round(kcal / templates.length),
      protein: t.macro === "protein" ? protein : round(protein / templates.length),
      carbs: t.macro === "carbs" ? carbs : round(carbs / templates.length),
      fat: t.macro === "fat" ? fat : round(fat / templates.length),
    };
  });
}

export function generateNutritionPlan(input: NutritionInput): NutritionPlanResult {
  const warnings: string[] = [];
  const mealsPerDay = Math.min(6, Math.max(3, input.mealsPerDay || 4));
  if (input.weightKg <= 0 || input.heightCm <= 0 || input.age <= 0) {
    warnings.push("Dados antropométricos incompletos — informe peso, altura e idade.");
  }

  const bmr = calcBmr(input);
  const tdee = round(bmr * ACTIVITY_FACTOR[input.activity]);
  const targets = calcTargets(input);

  const distribution = MEAL_DISTRIBUTION[mealsPerDay] || MEAL_DISTRIBUTION[4];
  const meals: Meal[] = distribution.map((frac, i) => {
    const kcal = round(targets.calories * frac);
    const protein = round(targets.protein * frac);
    const carbs = round(targets.carbs * frac);
    const fat = round(targets.fat * frac);
    const name = MEAL_NAMES[i] || `Refeição ${i + 1}`;
    return {
      name,
      time: MEAL_TIMES[i] || "",
      kcal,
      protein,
      carbs,
      fat,
      items: buildMealItems(name, kcal, protein, carbs, fat),
    };
  });

  const rationale: string[] = [
    `TMB (Mifflin-St Jeor): ${bmr} kcal · GET (×${ACTIVITY_FACTOR[input.activity]}): ${tdee} kcal.`,
    `Meta calórica para ${input.objective}: ${targets.calories} kcal/dia.`,
    `Proteína ${MACRO_RULES[input.objective].proteinPerKg} g/kg · Gordura ${MACRO_RULES[input.objective].fatPerKg} g/kg · Carbo preenche o restante.`,
    `Hidratação sugerida: ${targets.waterMl} ml/dia (35 ml/kg).`,
    `${mealsPerDay} refeições/dia distribuídas pela rotina padrão.`,
  ];

  if (input.objective === "emagrecimento" && targets.calories < bmr) {
    warnings.push("Meta calórica abaixo da TMB — acompanhe de perto para evitar déficit excessivo.");
  }

  return { input, bmr, tdee, targets, meals, rationale, warnings };
}
