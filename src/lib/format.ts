export function fmtMoney(value: number, currency = "€"): string {
  return `${currency}${value.toFixed(2)}`;
}

export function fmtDate(iso?: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", opts ?? { day: "numeric", month: "short" });
}

export function fmtRelative(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diff === 0) return "oggi";
  if (diff === 1) return "domani";
  if (diff === -1) return "ieri";
  if (diff > 1) return `tra ${diff} giorni`;
  return `${Math.abs(diff)} giorni fa`;
}

export function weekDays(anchor = new Date()): string[] {
  // Monday-first week containing `anchor`.
  const d = new Date(anchor);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

export const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
export const MEAL_LABELS: Record<string, string> = {
  breakfast: "Colazione",
  snack: "Spuntino mattina",
  lunch: "Pranzo",
  snack2: "Spuntino pomeriggio",
  dinner: "Cena",
};

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return clamp(Math.round((part / whole) * 100), 0, 100);
}
