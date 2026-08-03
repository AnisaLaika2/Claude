import { NextResponse } from "next/server";
import type { FoodCategory, Nutrition } from "@/lib/types";

export const runtime = "nodejs";

function mapCategory(tags: string[] = []): FoodCategory {
  const t = tags.join(" ").toLowerCase();
  if (/meat|chicken|beef|pork|sausage/.test(t)) return "meat";
  if (/fish|seafood|salmon|tuna/.test(t)) return "fish";
  if (/dairy|milk|cheese|yogurt|butter/.test(t)) return "dairy";
  if (/fruit|vegetable|produce/.test(t)) return "produce";
  if (/bread|bakery|pastry/.test(t)) return "bakery";
  if (/beverage|drink|water|juice|soda/.test(t)) return "beverages";
  if (/frozen/.test(t)) return "frozen";
  if (/snack|biscuit|chocolate|candy/.test(t)) return "snacks";
  if (/sauce|condiment|oil|vinegar/.test(t)) return "condiments";
  if (/spice|herb/.test(t)) return "spices";
  if (/pasta|rice|flour|cereal|legume/.test(t)) return "pantry";
  return "other";
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return isFinite(n) ? n : undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        code
      )}?fields=product_name,brands,image_front_url,categories_tags,nutriments,ingredients_text,allergens_tags,quantity`,
      { headers: { "User-Agent": "Cibo/1.0 (food management app)" }, next: { revalidate: 86400 } }
    );

    if (!res.ok) return NextResponse.json({ product: null });
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ product: null });
    }

    const p = data.product;
    const nm = p.nutriments || {};
    const nutrition: Nutrition | undefined =
      nm["energy-kcal_100g"] != null
        ? {
            kcal: Math.round(num(nm["energy-kcal_100g"]) || 0),
            protein: num(nm.proteins_100g) || 0,
            carbs: num(nm.carbohydrates_100g) || 0,
            fat: num(nm.fat_100g) || 0,
            fiber: num(nm.fiber_100g),
            sugar: num(nm.sugars_100g),
            salt: num(nm.salt_100g),
          }
        : undefined;

    const qtyText: string | undefined = p.quantity;
    let unitWeightG: number | undefined;
    if (qtyText) {
      const m = qtyText.match(/(\d+[.,]?\d*)\s*(g|kg|ml|l)/i);
      if (m) {
        const val = parseFloat(m[1].replace(",", "."));
        const u = m[2].toLowerCase();
        unitWeightG = u === "kg" || u === "l" ? val * 1000 : val;
      }
    }

    const allergens: string[] = (p.allergens_tags || []).map((a: string) =>
      a.replace(/^en:/, "")
    );

    return NextResponse.json({
      product: {
        barcode: code,
        name: p.product_name || "Prodotto",
        brand: p.brands?.split(",")[0]?.trim(),
        category: mapCategory(p.categories_tags),
        imageUrl: p.image_front_url,
        nutrition,
        ingredients: p.ingredients_text,
        allergens,
        quantityText: qtyText,
        unitWeightG,
      },
    });
  } catch {
    return NextResponse.json({ product: null });
  }
}
