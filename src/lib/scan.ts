import type { FoodCategory, Nutrition, Unit } from "./types";

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  category: FoodCategory;
  imageUrl?: string;
  nutrition?: Nutrition;
  ingredients?: string;
  allergens?: string[];
  quantityText?: string;
  unitWeightG?: number;
}

// Looks a product up via the /api/barcode route (OpenFoodFacts).
export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.product ?? null;
}

// ── Receipt parsing ────────────────────────────────────────
export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit: Unit;
  price?: number;
  category: FoodCategory;
}

export interface ParsedReceipt {
  store?: string;
  date?: string;
  items: ParsedReceiptItem[];
  total?: number;
}

const STORE_PATTERNS = [
  "esselunga", "coop", "conad", "carrefour", "lidl", "eurospin", "penny",
  "pam", "iper", "bennet", "md", "aldi", "todis", "crai", "despar", "sigma",
];

const NON_FOOD = /sacchetto|shopper|busta|sconto|totale|subtotale|iva|resto|contante|carta|punti|fidelity|pagamento|scontrino|documento/i;

const PRICE_RE = /(\d{1,3}[.,]\d{2})\s*[A-Z]?\s*$/;
const QTY_X_RE = /^(\d+)\s*[xX]\s*/;
const WEIGHT_RE = /(\d+[.,]?\d*)\s*(kg|g|gr|l|ml|cl)\b/i;
const DATE_RE = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/;

function categorize(name: string): FoodCategory {
  const n = name.toLowerCase();
  if (/pollo|manzo|maiale|carne|salsicc|tacchino|prosciutto|bresaola|wurstel/.test(n)) return "meat";
  if (/pesce|salmone|tonno|gamber|merluzzo|orata|branzino/.test(n)) return "fish";
  if (/latte|formagg|parmigian|yogurt|burro|mozzarell|ricotta|stracchino|panna/.test(n)) return "dairy";
  if (/uova|uovo/.test(n)) return "dairy";
  if (/mela|banana|zucchin|pomodor|insalat|verdur|frutta|carota|patat|cipoll|arance|limone|pere|uva|melanzan|peperon/.test(n)) return "produce";
  if (/pane|pizza|focacc|brioche|cornett|grissini/.test(n)) return "bakery";
  if (/pasta|riso|farina|spaghett|penne|fusilli|legumi|fagioli|ceci|lenticchie|passata|pelati|tonno/.test(n)) return "pantry";
  if (/olio|sale|aceto|salsa|maionese|ketchup|senape/.test(n)) return "condiments";
  if (/acqua|succo|bibita|coca|birra|vino|tè|caffè/.test(n)) return "beverages";
  if (/gelato|surgelat|piselli.*surg/.test(n)) return "frozen";
  if (/biscott|patatine|snack|cioccolat|caramell|merend/.test(n)) return "snacks";
  return "other";
}

// Parse raw OCR text from a supermarket receipt into structured items.
export function parseReceipt(raw: string): ParsedReceipt {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let store: string | undefined;
  let date: string | undefined;
  let total: number | undefined;
  const items: ParsedReceiptItem[] = [];

  for (const line of lines) {
    const low = line.toLowerCase();

    if (!store) {
      const s = STORE_PATTERNS.find((p) => low.includes(p));
      if (s) store = s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (!date) {
      const m = line.match(DATE_RE);
      if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) y = "20" + y;
        date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
    if (/totale/i.test(low) && !/subtotale/i.test(low)) {
      const m = line.match(PRICE_RE);
      if (m) total = parseFloat(m[1].replace(",", "."));
      continue;
    }
    if (NON_FOOD.test(low)) continue;

    const priceMatch = line.match(PRICE_RE);
    if (!priceMatch) continue;
    const price = parseFloat(priceMatch[1].replace(",", "."));
    if (isNaN(price) || price <= 0 || price > 500) continue;

    let name = line.slice(0, line.length - priceMatch[0].length).trim();
    if (name.length < 2) continue;

    let quantity = 1;
    let unit: Unit = "pcs";

    const qx = name.match(QTY_X_RE);
    if (qx) {
      quantity = parseInt(qx[1], 10);
      name = name.replace(QTY_X_RE, "").trim();
    }
    const w = name.match(WEIGHT_RE);
    if (w) {
      const val = parseFloat(w[1].replace(",", "."));
      const u = w[2].toLowerCase();
      if (u === "kg") { quantity = val; unit = "kg"; }
      else if (u === "g" || u === "gr") { quantity = val; unit = "g"; }
      else if (u === "l") { quantity = val; unit = "l"; }
      else if (u === "ml") { quantity = val; unit = "ml"; }
      else if (u === "cl") { quantity = val * 10; unit = "ml"; }
    }

    // Clean stray codes / prices left in the name.
    name = name.replace(/\b\d{4,}\b/g, "").replace(/\s{2,}/g, " ").replace(/[*€]/g, "").trim();
    name = name.replace(/^[-.\s]+|[-.\s]+$/g, "");
    if (name.length < 2 || /^\d+$/.test(name)) continue;

    // Title-case
    name = name
      .toLowerCase()
      .split(" ")
      .map((w2) => w2.charAt(0).toUpperCase() + w2.slice(1))
      .join(" ");

    items.push({ name, quantity, unit, price, category: categorize(name) });
  }

  return { store, date, items, total };
}
