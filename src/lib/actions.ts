import { db, uid, nowISO, todayKey } from "./db";
import { approxKg, co2ForItem, estimateExpiry } from "./food";
import { addNutrition, emptyNutrition, scaleNutrition } from "./nutrition";
import type {
  ConsumptionLog,
  Nutrition,
  PantryItem,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
  Unit,
  WasteLog,
} from "./types";

// ── Pantry ──────────────────────────────────────────────────
export async function addPantryItem(
  partial: Partial<PantryItem> & Pick<PantryItem, "name" | "category" | "location" | "quantity" | "unit">
): Promise<string> {
  // Merge into an existing item with the same name + location.
  const existing = await db.pantry
    .where("name")
    .equalsIgnoreCase(partial.name.trim())
    .filter((p) => p.location === partial.location && p.unit === partial.unit)
    .first();

  if (existing) {
    await db.pantry.update(existing.id, {
      quantity: existing.quantity + partial.quantity,
      initialQuantity: existing.initialQuantity + partial.quantity,
      price: (existing.price || 0) + (partial.price || 0),
      purchaseDate: partial.purchaseDate || existing.purchaseDate,
      expiryDate: partial.expiryDate || existing.expiryDate,
      updatedAt: nowISO(),
    });
    return existing.id;
  }

  const id = uid("pan");
  const item: PantryItem = {
    id,
    name: partial.name.trim(),
    brand: partial.brand,
    category: partial.category,
    location: partial.location,
    quantity: partial.quantity,
    unit: partial.unit,
    initialQuantity: partial.initialQuantity ?? partial.quantity,
    purchaseDate: partial.purchaseDate || nowISO(),
    expiryDate: partial.expiryDate || estimateExpiry(partial.category, partial.location),
    price: partial.price,
    barcode: partial.barcode,
    imageUrl: partial.imageUrl,
    nutrition: partial.nutrition,
    nutritionBasis: partial.nutritionBasis || "per100g",
    unitWeightG: partial.unitWeightG,
    allergens: partial.allergens,
    opened: partial.opened,
    openedDate: partial.openedDate,
    store: partial.store,
    updatedAt: nowISO(),
  };
  await db.pantry.add(item);
  return id;
}

export async function updatePantryItem(id: string, patch: Partial<PantryItem>): Promise<void> {
  await db.pantry.update(id, { ...patch, updatedAt: nowISO() });
}

export async function deletePantryItem(id: string): Promise<void> {
  await db.pantry.delete(id);
}

export function itemNutritionFor(item: PantryItem, quantity: number, unit: Unit): Nutrition | undefined {
  if (!item.nutrition) return undefined;
  // Compute grams consumed, then scale per-100g nutrition.
  const grams = approxKg(quantity, unit, item.unitWeightG) * 1000;
  if (item.nutritionBasis === "perUnit") {
    return scaleNutrition(item.nutrition, quantity);
  }
  return scaleNutrition(item.nutrition, grams / 100);
}

// Consume a quantity from the pantry, logging consumption + nutrition.
export async function consumePantryItem(
  id: string,
  quantity: number,
  opts: { logConsumption?: boolean } = {}
): Promise<void> {
  const item = await db.pantry.get(id);
  if (!item) return;
  const used = Math.min(quantity, item.quantity);
  const remaining = +(item.quantity - used).toFixed(3);

  if (opts.logConsumption !== false && used > 0) {
    const savedValue =
      item.price && item.initialQuantity > 0
        ? +((item.price / item.initialQuantity) * used).toFixed(2)
        : 0;
    const log: ConsumptionLog = {
      id: uid("con"),
      name: item.name,
      quantity: used,
      unit: item.unit,
      nutrition: itemNutritionFor(item, used, item.unit),
      savedValue,
      date: todayKey(),
    };
    await db.consumption.add(log);
  }

  if (remaining <= 0) {
    await db.pantry.update(id, { quantity: 0, updatedAt: nowISO() });
  } else {
    await db.pantry.update(id, { quantity: remaining, updatedAt: nowISO() });
  }
}

// Match a recipe ingredient to a pantry item by fuzzy name.
export async function findPantryMatch(name: string): Promise<PantryItem | undefined> {
  const all = await db.pantry.toArray();
  const n = name.toLowerCase().trim();
  return (
    all.find((p) => p.name.toLowerCase() === n) ||
    all.find((p) => p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase()))
  );
}

// ── Waste ───────────────────────────────────────────────────
export async function logWaste(
  item: PantryItem,
  quantity: number,
  reason: WasteLog["reason"]
): Promise<void> {
  const estValue =
    item.price && item.initialQuantity > 0
      ? +((item.price / item.initialQuantity) * quantity).toFixed(2)
      : 0;
  const co2 = co2ForItem({ ...item, quantity });
  const log: WasteLog = {
    id: uid("was"),
    name: item.name,
    category: item.category,
    quantity,
    unit: item.unit,
    reason,
    estValue,
    co2,
    date: todayKey(),
  };
  await db.waste.add(log);
  await consumePantryItem(item.id, quantity, { logConsumption: false });
}

// ── Shopping list ───────────────────────────────────────────
export async function addShoppingItem(
  partial: Partial<ShoppingItem> & Pick<ShoppingItem, "name" | "category">
): Promise<void> {
  const item: ShoppingItem = {
    id: uid("shp"),
    name: partial.name.trim(),
    category: partial.category,
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? "pcs",
    checked: false,
    auto: partial.auto ?? false,
    reason: partial.reason,
    estPrice: partial.estPrice,
    createdAt: nowISO(),
  };
  await db.shopping.add(item);
}

export async function toggleShoppingItem(id: string): Promise<void> {
  const it = await db.shopping.get(id);
  if (it) await db.shopping.update(id, { checked: !it.checked });
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await db.shopping.delete(id);
}

export async function clearCheckedShopping(): Promise<void> {
  const checked = await db.shopping.filter((s) => s.checked).toArray();
  await db.shopping.bulkDelete(checked.map((c) => c.id));
}

// Move purchased (checked) items into the pantry.
export async function completeShopping(): Promise<number> {
  const checked = await db.shopping.filter((s) => s.checked).toArray();
  for (const s of checked) {
    await addPantryItem({
      name: s.name,
      category: s.category,
      location: "pantry",
      quantity: s.quantity,
      unit: s.unit,
      price: s.estPrice,
    });
  }
  await db.shopping.bulkDelete(checked.map((c) => c.id));
  return checked.length;
}

// Regenerate automatic suggestions: low/empty stock + planned meals gaps.
export async function regenerateShoppingSuggestions(): Promise<number> {
  const [pantry, meals, existing] = await Promise.all([
    db.pantry.toArray(),
    db.meals.toArray(),
    db.shopping.toArray(),
  ]);

  // Remove previous auto items that are unchecked (keep manual + checked).
  const oldAuto = existing.filter((s) => s.auto && !s.checked);
  await db.shopping.bulkDelete(oldAuto.map((s) => s.id));

  const currentNames = new Set(
    (await db.shopping.toArray()).map((s) => s.name.toLowerCase())
  );
  const pantryByName = new Map(pantry.map((p) => [p.name.toLowerCase(), p]));
  const additions: ShoppingItem[] = [];

  const push = (name: string, category: ShoppingItem["category"], reason: string, qty = 1, unit: Unit = "pcs") => {
    const key = name.toLowerCase();
    if (currentNames.has(key)) return;
    currentNames.add(key);
    additions.push({
      id: uid("shp"),
      name,
      category,
      quantity: qty,
      unit,
      checked: false,
      auto: true,
      reason,
      createdAt: nowISO(),
    });
  };

  // 1. Low or empty stock
  for (const p of pantry) {
    const ratio = p.initialQuantity > 0 ? p.quantity / p.initialQuantity : 1;
    if (p.quantity <= 0) push(p.name, p.category, "Terminato", p.initialQuantity || 1, p.unit);
    else if (ratio <= 0.25) push(p.name, p.category, "Quasi terminato", 1, p.unit);
  }

  // 2. Ingredients for planned but uncooked meals not in pantry
  const upcoming = meals.filter((m) => !m.cooked && m.date >= todayKey());
  for (const m of upcoming) {
    if (!m.recipeId) continue;
    const recipe = await db.recipes.get(m.recipeId);
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      const match = pantryByName.get(ing.name.toLowerCase());
      if (!match || match.quantity <= 0) {
        push(ing.name, guessCategory(ing.name), `Ricetta: ${recipe.title}`, ing.quantity, ing.unit);
      }
    }
  }

  if (additions.length) await db.shopping.bulkAdd(additions);
  return additions.length;
}

function guessCategory(name: string): ShoppingItem["category"] {
  const n = name.toLowerCase();
  if (/pollo|manzo|maiale|carne|salsiccia|tacchino/.test(n)) return "meat";
  if (/pesce|salmone|tonno|gamber/.test(n)) return "fish";
  if (/latte|formaggio|parmigiano|yogurt|burro|uova/.test(n)) return "dairy";
  if (/mela|banana|zucchin|pomodor|insalata|verdur|frutta|carota|patata/.test(n)) return "produce";
  if (/pane|pasta|riso|farina|spaghetti/.test(n)) return "pantry";
  if (/olio|sale|aceto|salsa|passata/.test(n)) return "condiments";
  return "other";
}

// ── Meal planner ────────────────────────────────────────────
export async function addPlannedMeal(meal: Omit<PlannedMeal, "id">): Promise<string> {
  const id = uid("mea");
  await db.meals.add({ ...meal, id });
  return id;
}

export async function updatePlannedMeal(id: string, patch: Partial<PlannedMeal>): Promise<void> {
  await db.meals.update(id, patch);
}

export async function deletePlannedMeal(id: string): Promise<void> {
  await db.meals.delete(id);
}

// Cook a planned meal: deduct ingredients from pantry and log consumption.
export async function cookMeal(mealId: string): Promise<{ used: string[]; missing: string[] }> {
  const meal = await db.meals.get(mealId);
  if (!meal || !meal.recipeId) return { used: [], missing: [] };
  const recipe = await db.recipes.get(meal.recipeId);
  if (!recipe) return { used: [], missing: [] };

  const factor = meal.servings / recipe.servings;
  const used: string[] = [];
  const missing: string[] = [];

  for (const ing of recipe.ingredients) {
    const match = await findPantryMatch(ing.name);
    const need = ing.quantity * factor;
    if (match && match.quantity > 0) {
      await consumePantryItem(match.id, convertQty(need, ing.unit, match.unit, match.unitWeightG));
      used.push(ing.name);
    } else if (!ing.optional) {
      missing.push(ing.name);
    }
  }
  await db.meals.update(mealId, { cooked: true });
  return { used, missing };
}

// Rough unit conversion between recipe unit and pantry unit.
function convertQty(qty: number, from: Unit, to: Unit, unitWeightG = 150): number {
  if (from === to) return qty;
  const grams = approxKg(qty, from, unitWeightG) * 1000;
  switch (to) {
    case "g":
      return grams;
    case "kg":
      return grams / 1000;
    case "ml":
      return grams;
    case "l":
      return grams / 1000;
    default:
      return grams / unitWeightG;
  }
}

// ── Recipes ─────────────────────────────────────────────────
export async function saveRecipe(recipe: Omit<Recipe, "id" | "createdAt">): Promise<string> {
  const id = uid("rec");
  await db.recipes.add({ ...recipe, id, createdAt: nowISO() });
  return id;
}

export async function toggleFavorite(id: string): Promise<void> {
  const r = await db.recipes.get(id);
  if (r) await db.recipes.update(id, { favorite: !r.favorite });
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id);
}

// Score how well a recipe can be cooked from current pantry (0..1).
export function recipeMatchScore(recipe: Recipe, pantry: PantryItem[]): number {
  if (!recipe.ingredients.length) return 0;
  const names = pantry.filter((p) => p.quantity > 0).map((p) => p.name.toLowerCase());
  let have = 0;
  for (const ing of recipe.ingredients) {
    const n = ing.name.toLowerCase();
    if (names.some((pn) => pn.includes(n) || n.includes(pn))) have++;
  }
  return have / recipe.ingredients.length;
}

export function recipeMissing(recipe: Recipe, pantry: PantryItem[]): RecipeIngredient[] {
  const names = pantry.filter((p) => p.quantity > 0).map((p) => p.name.toLowerCase());
  return recipe.ingredients.filter((ing) => {
    const n = ing.name.toLowerCase();
    return !names.some((pn) => pn.includes(n) || n.includes(pn));
  });
}

// Aggregate nutrition of a set of meals.
export function totalNutrition(meals: PlannedMeal[]): Nutrition {
  return meals.reduce((acc, m) => addNutrition(acc, m.nutrition), emptyNutrition());
}
