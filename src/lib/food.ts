import type { FoodCategory, PantryItem, StorageLocation, Unit } from "./types";

export const CATEGORY_META: Record<FoodCategory, { label: string; emoji: string; color: string }> = {
  produce: { label: "Frutta e verdura", emoji: "🥬", color: "#4caf6d" },
  dairy: { label: "Latticini", emoji: "🧀", color: "#e6b84c" },
  meat: { label: "Carne", emoji: "🥩", color: "#d05a5a" },
  fish: { label: "Pesce", emoji: "🐟", color: "#4a9fd0" },
  bakery: { label: "Panetteria", emoji: "🍞", color: "#c99a5b" },
  pantry: { label: "Dispensa", emoji: "🥫", color: "#9b8b6b" },
  frozen: { label: "Surgelati", emoji: "🧊", color: "#6bb6d0" },
  beverages: { label: "Bevande", emoji: "🥤", color: "#7a6bd0" },
  snacks: { label: "Snack", emoji: "🍪", color: "#d0a05a" },
  condiments: { label: "Condimenti", emoji: "🫙", color: "#c07a4a" },
  spices: { label: "Spezie", emoji: "🌶️", color: "#c04a4a" },
  other: { label: "Altro", emoji: "📦", color: "#8b8b95" },
};

export const LOCATION_META: Record<StorageLocation, { label: string; emoji: string }> = {
  fridge: { label: "Frigorifero", emoji: "🧊" },
  freezer: { label: "Freezer", emoji: "❄️" },
  pantry: { label: "Dispensa", emoji: "🗄️" },
};

export const UNIT_LABELS: Record<Unit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  pcs: "pz",
  pack: "conf.",
  can: "lattina",
  bottle: "bottiglia",
  slice: "fetta",
  tbsp: "cucchiaio",
  tsp: "cucchiaino",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as FoodCategory[];
export const ALL_LOCATIONS = Object.keys(LOCATION_META) as StorageLocation[];
export const ALL_UNITS = Object.keys(UNIT_LABELS) as Unit[];

// Default shelf life (days) by category to estimate expiry when unknown.
const SHELF_LIFE: Record<FoodCategory, Partial<Record<StorageLocation, number>>> = {
  produce: { fridge: 7, pantry: 4, freezer: 240 },
  dairy: { fridge: 10, freezer: 60 },
  meat: { fridge: 3, freezer: 180 },
  fish: { fridge: 2, freezer: 120 },
  bakery: { pantry: 4, freezer: 90 },
  pantry: { pantry: 365 },
  frozen: { freezer: 300 },
  beverages: { pantry: 300, fridge: 30 },
  snacks: { pantry: 120 },
  condiments: { fridge: 120, pantry: 300 },
  spices: { pantry: 720 },
  other: { pantry: 90 },
};

export function estimateExpiry(
  category: FoodCategory,
  location: StorageLocation,
  from = new Date()
): string {
  const days = SHELF_LIFE[category]?.[location] ?? 30;
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  const now = new Date();
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - n.getTime()) / 86400000);
}

export type ExpiryStatus = "expired" | "critical" | "soon" | "ok" | "none";

export function expiryStatus(iso?: string): ExpiryStatus {
  const d = daysUntil(iso);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d <= 1) return "critical";
  if (d <= 7) return "soon";
  return "ok";
}

export const EXPIRY_META: Record<ExpiryStatus, { label: string; color: string }> = {
  expired: { label: "Scaduto", color: "var(--danger)" },
  critical: { label: "Scade oggi/domani", color: "var(--danger)" },
  soon: { label: "In scadenza", color: "var(--warning)" },
  ok: { label: "Ok", color: "var(--success)" },
  none: { label: "Nessuna scadenza", color: "var(--faint)" },
};

// CO2e (kg per kg of food) — rough averages for waste footprint.
const CO2_FACTOR: Record<FoodCategory, number> = {
  produce: 0.9,
  dairy: 3.2,
  meat: 15,
  fish: 5,
  bakery: 1.4,
  pantry: 1.1,
  frozen: 2.5,
  beverages: 0.8,
  snacks: 2.3,
  condiments: 1.5,
  spices: 1.0,
  other: 1.5,
};

// Convert a quantity to approximate kilograms for CO2 / value math.
export function approxKg(quantity: number, unit: Unit, unitWeightG = 150): number {
  switch (unit) {
    case "kg":
      return quantity;
    case "g":
      return quantity / 1000;
    case "l":
      return quantity;
    case "ml":
      return quantity / 1000;
    default:
      return (quantity * unitWeightG) / 1000;
  }
}

export function co2ForItem(item: Pick<PantryItem, "category" | "quantity" | "unit" | "unitWeightG">): number {
  const kg = approxKg(item.quantity, item.unit, item.unitWeightG);
  return +(kg * CO2_FACTOR[item.category]).toFixed(2);
}

export function stockLevel(item: PantryItem): "full" | "low" | "empty" {
  if (item.quantity <= 0) return "empty";
  const ratio = item.initialQuantity > 0 ? item.quantity / item.initialQuantity : 1;
  return ratio <= 0.25 ? "low" : "full";
}

export function fmtQty(q: number, unit: Unit): string {
  const rounded = Math.round(q * 100) / 100;
  return `${rounded} ${UNIT_LABELS[unit]}`;
}
