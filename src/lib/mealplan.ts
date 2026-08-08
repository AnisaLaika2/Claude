import type { DietProfile, MealType, Nutrition, PlannedMeal, Recipe } from "./types";
import { computeTargets } from "./nutrition";

// Per-serving nutrition for a small library of balanced meals.
interface MealTemplate {
  meal: MealType;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  veg?: boolean;
  vegan?: boolean;
  allergens?: string[];
}

export const MEAL_SPLIT: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

export const MEAL_LIBRARY: MealTemplate[] = [
  { meal: "breakfast", title: "Yogurt greco, avena e frutti di bosco", kcal: 320, protein: 22, carbs: 38, fat: 9, veg: true, allergens: ["latte", "glutine"] },
  { meal: "breakfast", title: "Porridge d'avena con banana e mandorle", kcal: 360, protein: 12, carbs: 55, fat: 11, veg: true, vegan: true, allergens: ["glutine", "frutta a guscio", "mandorle"] },
  { meal: "breakfast", title: "Uova strapazzate e pane integrale", kcal: 340, protein: 22, carbs: 30, fat: 14, veg: true, allergens: ["uova", "glutine"] },
  { meal: "breakfast", title: "Ricotta, pane integrale e miele", kcal: 330, protein: 18, carbs: 40, fat: 10, veg: true, allergens: ["latte", "glutine"] },
  { meal: "breakfast", title: "Pancake d'avena e albumi", kcal: 330, protein: 24, carbs: 42, fat: 6, veg: true, allergens: ["uova", "glutine"] },
  { meal: "breakfast", title: "Overnight oats con latte di soia e frutta", kcal: 340, protein: 14, carbs: 52, fat: 9, veg: true, vegan: true, allergens: ["glutine", "soia"] },
  { meal: "breakfast", title: "Macedonia di frutta con semi di chia", kcal: 260, protein: 6, carbs: 44, fat: 7, veg: true, vegan: true, allergens: [] },
  { meal: "breakfast", title: "Smoothie di frutta, spinaci e semi", kcal: 280, protein: 7, carbs: 46, fat: 8, veg: true, vegan: true, allergens: [] },
  { meal: "lunch", title: "Insalata di pollo, quinoa e verdure", kcal: 480, protein: 38, carbs: 40, fat: 16, allergens: [] },
  { meal: "lunch", title: "Riso integrale, ceci e verdure", kcal: 450, protein: 16, carbs: 70, fat: 10, veg: true, vegan: true, allergens: [] },
  { meal: "lunch", title: "Wrap integrale con tacchino e insalata", kcal: 430, protein: 32, carbs: 42, fat: 12, allergens: ["glutine"] },
  { meal: "lunch", title: "Farro con tonno, pomodorini e olive", kcal: 470, protein: 28, carbs: 55, fat: 12, allergens: ["pesce", "glutine"] },
  { meal: "lunch", title: "Bowl di lenticchie e verdure arrosto", kcal: 420, protein: 20, carbs: 58, fat: 9, veg: true, vegan: true, allergens: [] },
  { meal: "lunch", title: "Insalatona di ceci, feta e cetrioli", kcal: 440, protein: 20, carbs: 38, fat: 22, veg: true, allergens: ["latte"] },
  { meal: "dinner", title: "Salmone al forno con verdure", kcal: 420, protein: 34, carbs: 12, fat: 24, allergens: ["pesce"] },
  { meal: "dinner", title: "Petto di pollo grigliato e insalata", kcal: 380, protein: 44, carbs: 8, fat: 16, allergens: [] },
  { meal: "dinner", title: "Frittata di verdure e insalata", kcal: 340, protein: 22, carbs: 12, fat: 20, veg: true, allergens: ["uova"] },
  { meal: "dinner", title: "Zuppa di legumi e pane integrale", kcal: 380, protein: 20, carbs: 55, fat: 8, veg: true, vegan: true, allergens: ["glutine"] },
  { meal: "dinner", title: "Merluzzo al vapore con patate e broccoli", kcal: 360, protein: 34, carbs: 32, fat: 8, allergens: ["pesce"] },
  { meal: "dinner", title: "Tofu saltato con verdure e riso", kcal: 400, protein: 22, carbs: 45, fat: 14, veg: true, vegan: true, allergens: ["soia"] },
  { meal: "dinner", title: "Curry di ceci e verdure con riso", kcal: 430, protein: 18, carbs: 62, fat: 12, veg: true, vegan: true, allergens: [] },
  { meal: "snack", title: "Frutta fresca e mandorle", kcal: 180, protein: 5, carbs: 22, fat: 9, veg: true, vegan: true, allergens: ["frutta a guscio", "mandorle"] },
  { meal: "snack", title: "Yogurt greco", kcal: 150, protein: 15, carbs: 8, fat: 5, veg: true, allergens: ["latte"] },
  { meal: "snack", title: "Hummus con carote", kcal: 170, protein: 6, carbs: 18, fat: 9, veg: true, vegan: true, allergens: ["sesamo"] },
  { meal: "snack", title: "Ricotta e noci", kcal: 200, protein: 12, carbs: 6, fat: 14, veg: true, allergens: ["latte", "frutta a guscio", "noci"] },
  { meal: "snack", title: "Gallette di riso e burro d'arachidi", kcal: 190, protein: 7, carbs: 20, fat: 9, veg: true, vegan: true, allergens: ["arachidi"] },
  { meal: "snack", title: "Frutta fresca di stagione", kcal: 120, protein: 2, carbs: 28, fat: 1, veg: true, vegan: true, allergens: [] },
];

interface Candidate {
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  recipeId?: string;
  veg?: boolean;
  vegan?: boolean;
  allergens: string[];
}

const clampN = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// Build a 7-day plan that hits the daily calorie target for the goal,
// split across balanced meals and respecting allergies + diet.
export function buildHealthyWeek(
  profile: DietProfile,
  recipes: Recipe[],
  days: string[]
): Omit<PlannedMeal, "id">[] {
  const t = computeTargets(profile);
  const allergies = profile.allergies.map((a) => a.toLowerCase()).filter(Boolean);

  const okDiet = (c: Candidate) => {
    if (profile.diet === "vegetarian") return !!(c.veg || c.vegan);
    if (profile.diet === "vegan") return !!c.vegan;
    return true;
  };
  const okAllergy = (c: Candidate) =>
    !c.allergens.some((a) => allergies.some((x) => a.includes(x) || x.includes(a)));
  const suitable = (c: Candidate) => okDiet(c) && okAllergy(c);

  const recCand: Candidate[] = recipes.map((r) => ({
    title: r.title,
    kcal: r.nutrition.kcal,
    protein: r.nutrition.protein,
    carbs: r.nutrition.carbs,
    fat: r.nutrition.fat,
    recipeId: r.id,
    veg: r.tags.includes("vegetariano") || r.tags.includes("vegano"),
    vegan: r.tags.includes("vegano"),
    allergens: [],
  }));

  const libCand = (meal: MealType): Candidate[] =>
    MEAL_LIBRARY.filter((m) => m.meal === meal).map((m) => ({ ...m, allergens: m.allergens || [] }));

  const build = (meal: MealType): Candidate[] => {
    let all = libCand(meal);
    if (meal === "lunch" || meal === "dinner") all = all.concat(recCand);
    // Allergies are safety-critical: relax diet before ever relaxing an allergy.
    let f = all.filter(suitable);
    if (!f.length) f = all.filter(okAllergy);
    if (!f.length) f = all.filter(okDiet);
    if (!f.length) f = all;
    return f;
  };

  const pools: Record<MealType, Candidate[]> = {
    breakfast: build("breakfast"),
    lunch: build("lunch"),
    dinner: build("dinner"),
    snack: build("snack"),
  };

  const meals: Omit<PlannedMeal, "id">[] = [];
  const last: Partial<Record<MealType, string>> = {};

  days.forEach((date, di) => {
    (Object.keys(MEAL_SPLIT) as MealType[]).forEach((meal) => {
      const budget = t.targetKcal * MEAL_SPLIT[meal];
      const pool = pools[meal].slice().sort((a, b) => Math.abs(a.kcal - budget) - Math.abs(b.kcal - budget));
      const top = pool.slice(0, Math.min(4, pool.length));
      let cand = top[di % top.length];
      if (top.length > 1 && cand.title === last[meal]) cand = top[(di + 1) % top.length];
      last[meal] = cand.title;

      const serv = clampN(budget / cand.kcal, 0.5, 2.5);
      const nutrition: Nutrition = {
        kcal: Math.round(cand.kcal * serv),
        protein: Math.round(cand.protein * serv),
        carbs: Math.round(cand.carbs * serv),
        fat: Math.round(cand.fat * serv),
      };
      const hint = serv < 0.85 ? " · porzione piccola" : serv > 1.6 ? " · porzione doppia" : serv > 1.25 ? " · porzione abbondante" : "";
      meals.push({
        date,
        meal,
        recipeId: cand.recipeId,
        title: cand.title + hint,
        servings: +serv.toFixed(2),
        nutrition,
      });
    });
  });

  return meals;
}
