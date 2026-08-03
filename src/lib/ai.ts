import type { Nutrition, Recipe } from "./types";

export interface RecipeConstraints {
  maxMinutes?: number;
  maxKcal?: number;
  servings?: number;
  diet?: string;
  avoid?: string[]; // allergens / disliked
}

export interface GeneratedRecipe {
  title: string;
  description: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
  minutes: number;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  nutrition: Nutrition;
  tags: string[];
}

// Calls the server AI route. If no key is configured, the route returns a
// heuristic recipe so the feature always works.
export async function generateRecipe(
  ingredients: string[],
  constraints: RecipeConstraints = {}
): Promise<GeneratedRecipe> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "recipe", ingredients, constraints }),
  });
  if (!res.ok) throw new Error("AI request failed");
  const data = await res.json();
  return data.recipe as GeneratedRecipe;
}

export interface AssistantContext {
  pantrySummary: string;
  expiringSoon: string;
  todayNutrition?: Nutrition;
  targets?: Partial<Nutrition>;
}

export async function askAssistant(
  question: string,
  context: AssistantContext
): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "assistant", question, context }),
  });
  if (!res.ok) throw new Error("AI request failed");
  const data = await res.json();
  return data.answer as string;
}

export function toRecipe(g: GeneratedRecipe): Omit<Recipe, "id" | "createdAt"> {
  return {
    title: g.title,
    description: g.description,
    ingredients: g.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: (i.unit as Recipe["ingredients"][number]["unit"]) || "g",
    })),
    steps: g.steps,
    minutes: g.minutes,
    difficulty: g.difficulty,
    servings: g.servings,
    nutrition: g.nutrition,
    tags: g.tags,
    source: "ai",
  };
}
