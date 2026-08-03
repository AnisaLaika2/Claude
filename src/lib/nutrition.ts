import type { Activity, DietProfile, Goal, Nutrition, Sex } from "./types";

// Mifflin–St Jeor BMR
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const GOAL_KCAL: Record<Goal, number> = {
  lose: -450,
  maintain: 0,
  gain: 350,
  muscle: 250,
};

// Protein g/kg by goal
const GOAL_PROTEIN: Record<Goal, number> = {
  lose: 2.0,
  maintain: 1.6,
  gain: 1.8,
  muscle: 2.2,
};

export function computeTargets(p: DietProfile): Required<
  Pick<DietProfile, "targetKcal" | "targetProtein" | "targetCarbs" | "targetFat">
> {
  const tdee = bmr(p.sex, p.weightKg, p.heightCm, p.age) * ACTIVITY_FACTOR[p.activity];
  const targetKcal = Math.round(tdee + GOAL_KCAL[p.goal]);
  const targetProtein = Math.round(p.weightKg * GOAL_PROTEIN[p.goal]);
  // Fat ~ 27% of kcal, remainder carbs
  const fatKcal = targetKcal * 0.27;
  const targetFat = Math.round(fatKcal / 9);
  const proteinKcal = targetProtein * 4;
  const carbsKcal = Math.max(targetKcal - fatKcal - proteinKcal, 0);
  const targetCarbs = Math.round(carbsKcal / 4);
  return { targetKcal, targetProtein, targetCarbs, targetFat };
}

export const emptyNutrition = (): Nutrition => ({
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  salt: 0,
});

export function addNutrition(a: Nutrition, b?: Nutrition): Nutrition {
  if (!b) return { ...a };
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: (a.fiber || 0) + (b.fiber || 0),
    sugar: (a.sugar || 0) + (b.sugar || 0),
    salt: (a.salt || 0) + (b.salt || 0),
  };
}

export function scaleNutrition(n: Nutrition, factor: number): Nutrition {
  return {
    kcal: Math.round(n.kcal * factor),
    protein: +(n.protein * factor).toFixed(1),
    carbs: +(n.carbs * factor).toFixed(1),
    fat: +(n.fat * factor).toFixed(1),
    fiber: n.fiber ? +(n.fiber * factor).toFixed(1) : undefined,
    sugar: n.sugar ? +(n.sugar * factor).toFixed(1) : undefined,
    salt: n.salt ? +(n.salt * factor).toFixed(2) : undefined,
  };
}

export function roundNutrition(n: Nutrition): Nutrition {
  return {
    kcal: Math.round(n.kcal),
    protein: Math.round(n.protein),
    carbs: Math.round(n.carbs),
    fat: Math.round(n.fat),
    fiber: n.fiber != null ? Math.round(n.fiber) : undefined,
    sugar: n.sugar != null ? Math.round(n.sugar) : undefined,
    salt: n.salt != null ? +n.salt.toFixed(1) : undefined,
  };
}
