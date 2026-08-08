import type { DietProfile, MealType, Nutrition, PlannedMeal, Recipe, RecipeIngredient, Unit } from "./types";
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

// Ingredients (per 1 serving) + steps for each library meal.
const g = (name: string, quantity: number, unit: Unit): RecipeIngredient => ({ name, quantity, unit });
const MEAL_DETAILS: Record<string, { minutes: number; ingredients: RecipeIngredient[]; steps: string[] }> = {
  "Yogurt greco, avena e frutti di bosco": { minutes: 5, ingredients: [g("Yogurt greco", 170, "g"), g("Fiocchi d'avena", 40, "g"), g("Frutti di bosco", 80, "g"), g("Miele", 10, "g")], steps: ["Versa lo yogurt in una ciotola.", "Aggiungi avena e frutti di bosco.", "Completa con un filo di miele."] },
  "Porridge d'avena con banana e mandorle": { minutes: 8, ingredients: [g("Fiocchi d'avena", 50, "g"), g("Latte vegetale", 200, "ml"), g("Banana", 1, "pcs"), g("Mandorle", 15, "g")], steps: ["Scalda avena e latte 3-4 minuti mescolando.", "Unisci la banana a fette.", "Completa con le mandorle."] },
  "Uova strapazzate e pane integrale": { minutes: 10, ingredients: [g("Uova", 2, "pcs"), g("Pane integrale", 60, "g"), g("Olio evo", 5, "ml")], steps: ["Sbatti le uova con un pizzico di sale.", "Cuoci in padella mescolando.", "Servi con pane tostato."] },
  "Ricotta, pane integrale e miele": { minutes: 5, ingredients: [g("Ricotta", 100, "g"), g("Pane integrale", 60, "g"), g("Miele", 10, "g")], steps: ["Spalma la ricotta sul pane.", "Completa con il miele."] },
  "Pancake d'avena e albumi": { minutes: 12, ingredients: [g("Fiocchi d'avena", 40, "g"), g("Albumi", 120, "g"), g("Banana", 0.5, "pcs")], steps: ["Frulla tutti gli ingredienti.", "Cuoci piccoli pancake in padella antiaderente."] },
  "Overnight oats con latte di soia e frutta": { minutes: 5, ingredients: [g("Fiocchi d'avena", 50, "g"), g("Latte di soia", 150, "ml"), g("Frutta", 80, "g"), g("Semi di chia", 10, "g")], steps: ["Mescola avena, latte e chia.", "Lascia in frigo tutta la notte.", "Completa con frutta fresca."] },
  "Macedonia di frutta con semi di chia": { minutes: 8, ingredients: [g("Frutta mista", 250, "g"), g("Semi di chia", 15, "g"), g("Succo di limone", 10, "ml")], steps: ["Taglia la frutta a pezzetti.", "Aggiungi chia e limone.", "Mescola e servi."] },
  "Smoothie di frutta, spinaci e semi": { minutes: 5, ingredients: [g("Banana", 1, "pcs"), g("Spinaci", 40, "g"), g("Frutta", 100, "g"), g("Acqua", 150, "ml"), g("Semi misti", 10, "g")], steps: ["Frulla tutto fino a consistenza liscia."] },
  "Insalata di pollo, quinoa e verdure": { minutes: 25, ingredients: [g("Petto di pollo", 120, "g"), g("Quinoa", 60, "g"), g("Verdure miste", 150, "g"), g("Olio evo", 10, "ml")], steps: ["Cuoci la quinoa e falla raffreddare.", "Griglia il pollo a strisce.", "Unisci con le verdure e condisci."] },
  "Riso integrale, ceci e verdure": { minutes: 25, ingredients: [g("Riso integrale", 70, "g"), g("Ceci lessati", 120, "g"), g("Verdure", 150, "g"), g("Olio evo", 10, "ml")], steps: ["Cuoci il riso integrale.", "Salta ceci e verdure.", "Unisci il tutto e condisci."] },
  "Wrap integrale con tacchino e insalata": { minutes: 10, ingredients: [g("Piadina integrale", 1, "pcs"), g("Fesa di tacchino", 100, "g"), g("Insalata", 50, "g"), g("Pomodoro", 60, "g")], steps: ["Farcisci la piadina con tacchino e verdure.", "Arrotola e taglia a metà."] },
  "Farro con tonno, pomodorini e olive": { minutes: 20, ingredients: [g("Farro", 70, "g"), g("Tonno al naturale", 80, "g"), g("Pomodorini", 100, "g"), g("Olive", 20, "g")], steps: ["Cuoci il farro e raffreddalo.", "Unisci tonno, pomodorini e olive.", "Condisci con olio."] },
  "Bowl di lenticchie e verdure arrosto": { minutes: 30, ingredients: [g("Lenticchie lessate", 150, "g"), g("Verdure miste", 200, "g"), g("Olio evo", 10, "ml")], steps: ["Arrostisci le verdure in forno.", "Scalda le lenticchie.", "Componi la bowl e condisci."] },
  "Insalatona di ceci, feta e cetrioli": { minutes: 12, ingredients: [g("Ceci lessati", 120, "g"), g("Feta", 50, "g"), g("Cetrioli", 100, "g"), g("Pomodori", 100, "g")], steps: ["Taglia le verdure.", "Unisci ceci e feta.", "Condisci con olio e origano."] },
  "Salmone al forno con verdure": { minutes: 25, ingredients: [g("Salmone", 150, "g"), g("Zucchine", 150, "g"), g("Olio evo", 10, "ml")], steps: ["Preriscalda il forno a 200°C.", "Cuoci salmone e verdure 18-20 minuti."] },
  "Petto di pollo grigliato e insalata": { minutes: 18, ingredients: [g("Petto di pollo", 150, "g"), g("Insalata mista", 150, "g"), g("Olio evo", 8, "ml")], steps: ["Griglia il pollo 6 minuti per lato.", "Servi con insalata condita."] },
  "Frittata di verdure e insalata": { minutes: 15, ingredients: [g("Uova", 3, "pcs"), g("Verdure", 150, "g"), g("Insalata", 80, "g")], steps: ["Salta le verdure in padella.", "Aggiungi le uova sbattute e cuoci.", "Servi con insalata."] },
  "Zuppa di legumi e pane integrale": { minutes: 30, ingredients: [g("Legumi misti", 200, "g"), g("Verdure", 150, "g"), g("Pane integrale", 40, "g")], steps: ["Soffriggi le verdure.", "Aggiungi legumi e acqua, cuoci 20 minuti.", "Servi con pane."] },
  "Merluzzo al vapore con patate e broccoli": { minutes: 25, ingredients: [g("Merluzzo", 180, "g"), g("Patate", 150, "g"), g("Broccoli", 150, "g")], steps: ["Cuoci a vapore patate e broccoli.", "Aggiungi il merluzzo per 8 minuti.", "Condisci con olio e limone."] },
  "Tofu saltato con verdure e riso": { minutes: 20, ingredients: [g("Tofu", 150, "g"), g("Verdure", 150, "g"), g("Riso", 60, "g"), g("Salsa di soia", 15, "ml")], steps: ["Cuoci il riso.", "Salta tofu e verdure con salsa di soia.", "Servi sul riso."] },
  "Curry di ceci e verdure con riso": { minutes: 25, ingredients: [g("Ceci lessati", 150, "g"), g("Verdure", 150, "g"), g("Latte di cocco", 100, "ml"), g("Riso", 60, "g")], steps: ["Soffriggi le spezie del curry.", "Aggiungi ceci, verdure e cocco, cuoci 15 minuti.", "Servi con riso."] },
  "Frutta fresca e mandorle": { minutes: 3, ingredients: [g("Frutta", 150, "g"), g("Mandorle", 20, "g")], steps: ["Servi la frutta con le mandorle."] },
  "Yogurt greco": { minutes: 2, ingredients: [g("Yogurt greco", 170, "g")], steps: ["Servi freddo, con un pizzico di cannella se gradito."] },
  "Hummus con carote": { minutes: 5, ingredients: [g("Hummus", 60, "g"), g("Carote", 150, "g")], steps: ["Taglia le carote a bastoncini.", "Servi con l'hummus."] },
  "Ricotta e noci": { minutes: 3, ingredients: [g("Ricotta", 100, "g"), g("Noci", 20, "g"), g("Miele", 5, "g")], steps: ["Unisci ricotta e noci.", "Completa con un filo di miele."] },
  "Gallette di riso e burro d'arachidi": { minutes: 3, ingredients: [g("Gallette di riso", 2, "pcs"), g("Burro d'arachidi", 20, "g")], steps: ["Spalma il burro d'arachidi sulle gallette."] },
  "Frutta fresca di stagione": { minutes: 2, ingredients: [g("Frutta di stagione", 200, "g")], steps: ["Lava e servi la frutta."] },
};

// Build a saveable recipe from a library meal title (used to give planned meals full recipes).
export function recipeFromTemplate(title: string): Omit<Recipe, "id" | "createdAt"> | null {
  const tmpl = MEAL_LIBRARY.find((m) => m.title === title);
  if (!tmpl) return null;
  const det = MEAL_DETAILS[title] || { minutes: 15, ingredients: [], steps: ["Prepara gli ingredienti e componi il piatto."] };
  const mealTag = { breakfast: "colazione", lunch: "pranzo", dinner: "cena", snack: "spuntino" }[tmpl.meal];
  return {
    title,
    description: "Piatto del piano salutare, bilanciato per il tuo obiettivo.",
    ingredients: det.ingredients,
    steps: det.steps,
    minutes: det.minutes,
    difficulty: "easy",
    servings: 1,
    nutrition: { kcal: tmpl.kcal, protein: tmpl.protein, carbs: tmpl.carbs, fat: tmpl.fat },
    tags: [tmpl.vegan ? "vegano" : tmpl.veg ? "vegetariano" : "", mealTag].filter(Boolean) as string[],
    source: "plan",
  };
}
