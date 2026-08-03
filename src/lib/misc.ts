import type { FoodCategory } from "./types";

// Guess a food category from a free-text product name (Italian-first).
export function guessCategoryExport(name: string): FoodCategory {
  const n = name.toLowerCase();
  if (/pollo|manzo|maiale|carne|salsicc|tacchino|prosciutto|bresaola|wurstel/.test(n)) return "meat";
  if (/pesce|salmone|tonno|gamber|merluzzo|orata|branzino/.test(n)) return "fish";
  if (/latte|formagg|parmigian|yogurt|burro|mozzarell|ricotta|panna|uova|uovo/.test(n)) return "dairy";
  if (/mela|banana|zucchin|pomodor|insalat|verdur|frutta|carota|patat|cipoll|arance|limone|pere|uva|melanzan|peperon|broccol|spinac/.test(n)) return "produce";
  if (/pane|pizza|focacc|brioche|cornett|grissini/.test(n)) return "bakery";
  if (/pasta|riso|farina|spaghett|penne|fusilli|legumi|fagioli|ceci|lenticchie|passata|pelati/.test(n)) return "pantry";
  if (/olio|sale|aceto|salsa|maionese|ketchup|senape/.test(n)) return "condiments";
  if (/acqua|succo|bibita|coca|birra|vino|tè|caffè/.test(n)) return "beverages";
  if (/gelato|surgelat/.test(n)) return "frozen";
  if (/biscott|patatine|snack|cioccolat|caramell|merend/.test(n)) return "snacks";
  if (/sale|pepe|spezie|origano|basilico|prezzemolo|curcuma|paprika/.test(n)) return "spices";
  return "other";
}
