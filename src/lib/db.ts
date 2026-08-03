import Dexie, { type Table } from "dexie";
import type {
  PantryItem,
  ShoppingItem,
  Recipe,
  PlannedMeal,
  WasteLog,
  ConsumptionLog,
  FamilyMember,
  DietProfile,
  Settings,
} from "./types";

// Local-first source of truth. Runs fully offline in IndexedDB.
// A cloud sync adapter (Supabase) can mirror these tables — see lib/sync.ts.
export class CiboDB extends Dexie {
  pantry!: Table<PantryItem, string>;
  shopping!: Table<ShoppingItem, string>;
  recipes!: Table<Recipe, string>;
  meals!: Table<PlannedMeal, string>;
  waste!: Table<WasteLog, string>;
  consumption!: Table<ConsumptionLog, string>;
  family!: Table<FamilyMember, string>;
  kv!: Table<{ key: string; value: unknown }, string>;
  profile!: Table<DietProfile & { id: string }, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("cibo");
    this.version(1).stores({
      pantry: "id, name, category, location, expiryDate, barcode, updatedAt",
      shopping: "id, name, category, checked, createdAt",
      recipes: "id, title, source, favorite, createdAt",
      meals: "id, date, meal, recipeId",
      waste: "id, date, category, reason",
      consumption: "id, date, name",
      family: "id, role",
      kv: "key",
      profile: "id",
      settings: "id",
    });
  }
}

export const db = new CiboDB();

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const nowISO = () => new Date().toISOString();
export const todayKey = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
