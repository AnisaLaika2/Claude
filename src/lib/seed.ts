import { db, uid, nowISO, todayKey } from "./db";
import { estimateExpiry } from "./food";
import type { PantryItem, Recipe, FamilyMember, Settings } from "./types";

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const SEED_PANTRY: Omit<PantryItem, "id" | "updatedAt">[] = [
  { name: "Petto di pollo", category: "meat", location: "fridge", quantity: 500, unit: "g", initialQuantity: 500, purchaseDate: daysAgo(1), expiryDate: daysFromNow(2), price: 5.9, nutrition: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, nutritionBasis: "per100g", store: "Esselunga" },
  { name: "Zucchine", category: "produce", location: "fridge", quantity: 4, unit: "pcs", initialQuantity: 4, purchaseDate: daysAgo(2), expiryDate: daysFromNow(3), price: 1.8, unitWeightG: 200, nutrition: { kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1 }, nutritionBasis: "per100g" },
  { name: "Parmigiano Reggiano", category: "dairy", location: "fridge", quantity: 200, unit: "g", initialQuantity: 300, purchaseDate: daysAgo(6), expiryDate: daysFromNow(40), price: 6.5, nutrition: { kcal: 392, protein: 33, carbs: 0, fat: 29 }, nutritionBasis: "per100g", opened: true, openedDate: daysAgo(3) },
  { name: "Uova", category: "dairy", location: "fridge", quantity: 6, unit: "pcs", initialQuantity: 6, purchaseDate: daysAgo(3), expiryDate: daysFromNow(14), price: 2.4, unitWeightG: 60, nutrition: { kcal: 143, protein: 13, carbs: 0.7, fat: 9.5 }, nutritionBasis: "per100g" },
  { name: "Spaghetti", category: "pantry", location: "pantry", quantity: 500, unit: "g", initialQuantity: 500, purchaseDate: daysAgo(20), expiryDate: daysFromNow(400), price: 1.2, nutrition: { kcal: 359, protein: 13, carbs: 71, fat: 1.5, fiber: 3 }, nutritionBasis: "per100g", brand: "Barilla" },
  { name: "Passata di pomodoro", category: "pantry", location: "pantry", quantity: 700, unit: "g", initialQuantity: 700, purchaseDate: daysAgo(15), expiryDate: daysFromNow(300), price: 1.1, nutrition: { kcal: 32, protein: 1.4, carbs: 6, fat: 0.2 }, nutritionBasis: "per100g", brand: "Mutti" },
  { name: "Latte", category: "dairy", location: "fridge", quantity: 1, unit: "l", initialQuantity: 1, purchaseDate: daysAgo(2), expiryDate: daysFromNow(4), price: 1.3, nutrition: { kcal: 46, protein: 3.2, carbs: 4.8, fat: 1.5 }, nutritionBasis: "per100g" },
  { name: "Yogurt greco", category: "dairy", location: "fridge", quantity: 2, unit: "pcs", initialQuantity: 4, purchaseDate: daysAgo(4), expiryDate: daysFromNow(6), price: 3.2, unitWeightG: 150, nutrition: { kcal: 97, protein: 9, carbs: 4, fat: 5 }, nutritionBasis: "per100g" },
  { name: "Pane integrale", category: "bakery", location: "pantry", quantity: 1, unit: "pack", initialQuantity: 1, purchaseDate: daysAgo(2), expiryDate: daysFromNow(2), price: 2.0, unitWeightG: 400, nutrition: { kcal: 247, protein: 9, carbs: 41, fat: 3.4, fiber: 7 }, nutritionBasis: "per100g" },
  { name: "Olio extravergine", category: "condiments", location: "pantry", quantity: 750, unit: "ml", initialQuantity: 1000, purchaseDate: daysAgo(30), expiryDate: daysFromNow(300), price: 8.9, nutrition: { kcal: 884, protein: 0, carbs: 0, fat: 100 }, nutritionBasis: "per100g" },
  { name: "Piselli surgelati", category: "frozen", location: "freezer", quantity: 400, unit: "g", initialQuantity: 800, purchaseDate: daysAgo(10), expiryDate: daysFromNow(200), price: 1.9, nutrition: { kcal: 81, protein: 5, carbs: 14, fat: 0.4, fiber: 5 }, nutritionBasis: "per100g" },
  { name: "Salmone", category: "fish", location: "freezer", quantity: 300, unit: "g", initialQuantity: 300, purchaseDate: daysAgo(8), expiryDate: daysFromNow(90), price: 7.5, nutrition: { kcal: 208, protein: 20, carbs: 0, fat: 13 }, nutritionBasis: "per100g" },
];

const SEED_RECIPES: Omit<Recipe, "id" | "createdAt">[] = [
  {
    title: "Pasta zucchine e parmigiano",
    description: "Un primo cremoso e veloce con zucchine saltate e una nuvola di parmigiano.",
    ingredients: [
      { name: "Spaghetti", quantity: 160, unit: "g" },
      { name: "Zucchine", quantity: 2, unit: "pcs" },
      { name: "Parmigiano Reggiano", quantity: 40, unit: "g" },
      { name: "Olio extravergine", quantity: 15, unit: "ml" },
    ],
    steps: [
      "Porta a bollore l'acqua salata e cuoci gli spaghetti.",
      "Taglia le zucchine a rondelle e saltale in padella con l'olio per 6-7 minuti.",
      "Scola la pasta tenendo un mestolo di acqua di cottura e mantecala con le zucchine.",
      "Aggiungi il parmigiano e l'acqua di cottura fino a ottenere una crema. Servi subito.",
    ],
    minutes: 20,
    difficulty: "easy",
    servings: 2,
    nutrition: { kcal: 520, protein: 22, carbs: 68, fat: 18 },
    tags: ["vegetariano", "veloce", "primo"],
    source: "seed",
  },
  {
    title: "Pollo alle zucchine",
    description: "Bocconcini di pollo dorati con zucchine, leggero e proteico.",
    ingredients: [
      { name: "Petto di pollo", quantity: 300, unit: "g" },
      { name: "Zucchine", quantity: 2, unit: "pcs" },
      { name: "Olio extravergine", quantity: 15, unit: "ml" },
    ],
    steps: [
      "Taglia il pollo a cubetti e rosolalo in padella con un filo d'olio.",
      "Aggiungi le zucchine a dadini e cuoci a fuoco vivo per 8 minuti.",
      "Sala, pepa e completa con una spolverata di parmigiano.",
    ],
    minutes: 25,
    difficulty: "easy",
    servings: 2,
    nutrition: { kcal: 340, protein: 42, carbs: 8, fat: 15 },
    tags: ["proteico", "light", "secondo"],
    source: "seed",
  },
  {
    title: "Frittata di piselli",
    description: "Soffice frittata con piselli e parmigiano, perfetta per svuotare il frigo.",
    ingredients: [
      { name: "Uova", quantity: 4, unit: "pcs" },
      { name: "Piselli surgelati", quantity: 150, unit: "g" },
      { name: "Parmigiano Reggiano", quantity: 30, unit: "g" },
    ],
    steps: [
      "Sbatti le uova con il parmigiano, sale e pepe.",
      "Salta i piselli in padella per 5 minuti, poi versa le uova.",
      "Cuoci a fuoco medio, gira e completa la cottura.",
    ],
    minutes: 15,
    difficulty: "easy",
    servings: 2,
    nutrition: { kcal: 300, protein: 24, carbs: 10, fat: 18 },
    tags: ["vegetariano", "veloce", "svuota-frigo"],
    source: "seed",
  },
  {
    title: "Salmone al forno con contorno",
    description: "Filetto di salmone al forno, ricco di omega-3.",
    ingredients: [
      { name: "Salmone", quantity: 300, unit: "g" },
      { name: "Zucchine", quantity: 1, unit: "pcs" },
      { name: "Olio extravergine", quantity: 10, unit: "ml" },
    ],
    steps: [
      "Preriscalda il forno a 200°C.",
      "Disponi il salmone e le zucchine a fette su una teglia, condisci con olio e sale.",
      "Cuoci per 18-20 minuti finché il salmone è cotto.",
    ],
    minutes: 25,
    difficulty: "easy",
    servings: 2,
    nutrition: { kcal: 380, protein: 34, carbs: 6, fat: 24 },
    tags: ["pesce", "omega3", "secondo"],
    source: "seed",
  },
];

const SEED_FAMILY: Omit<FamilyMember, "id">[] = [
  { name: "Tu", color: "#34c798", role: "owner" },
];

export async function ensureSeeded(): Promise<void> {
  const settings = await db.settings.get("app");
  if (settings) return; // already initialised

  const defaultSettings: Settings = {
    id: "app",
    theme: "system",
    currency: "€",
    notifExpiry: true,
    language: "it",
    onboarded: false,
  };

  await db.transaction(
    "rw",
    db.pantry,
    db.recipes,
    db.family,
    db.settings,
    async () => {
      await db.settings.put(defaultSettings);
      for (const p of SEED_PANTRY) {
        const expiry = (p as any).expiryDate ?? estimateExpiry(p.category, p.location);
        await db.pantry.add({
          ...p,
          expiryDate: typeof expiry === "string" ? expiry : estimateExpiry(p.category, p.location),
          id: uid("pan"),
          updatedAt: nowISO(),
        });
      }
      for (const r of SEED_RECIPES) {
        await db.recipes.add({ ...r, id: uid("rec"), createdAt: nowISO() });
      }
      for (const f of SEED_FAMILY) {
        await db.family.add({ ...f, id: uid("fam") });
      }
    }
  );
  void todayKey;
}
