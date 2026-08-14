// Impostazioni locali dell'app (salvate nel browser).

const BUDGET_START_DAY = 'gs_budget_start_day';

/** Giorno di inizio del "mese di budget" (1–28). 1 = mese solare. */
export function getBudgetStartDay(): number {
  const v = Number(localStorage.getItem(BUDGET_START_DAY));
  if (!v || v < 1 || v > 28) return 1;
  return Math.floor(v);
}

export function setBudgetStartDay(day: number): void {
  const d = Math.min(28, Math.max(1, Math.floor(day) || 1));
  localStorage.setItem(BUDGET_START_DAY, String(d));
}
