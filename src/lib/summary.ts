// Funzioni di aggregazione per dashboard e report.

import type { Category, CategoryGroup, Transaction } from '../types';

/** Esclude i giroconti (ricariche carta ecc.) dai conteggi. */
export function countable(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => !t.excludeFromTotals);
}

export function filterByMonth(txs: Transaction[], ym: string): Transaction[] {
  return txs.filter((t) => t.date.startsWith(ym));
}

export function totals(txs: Transaction[]): {
  income: number;
  expense: number;
  balance: number;
} {
  let income = 0;
  let expense = 0;
  for (const t of countable(txs)) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string;
  value: number;
}

export function expenseByCategory(
  txs: Transaction[],
  categories: Category[],
): CategorySlice[] {
  const map = new Map<string | null, number>();
  for (const t of countable(txs)) {
    if (t.type !== 'expense') continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  const slices: CategorySlice[] = [];
  for (const [categoryId, value] of map) {
    const cat = categoryId ? byId.get(categoryId) : undefined;
    slices.push({
      categoryId,
      name: cat?.name ?? 'Senza categoria',
      color: cat?.color ?? '#94a3b8',
      value,
    });
  }
  return slices.sort((a, b) => b.value - a.value);
}

export interface GroupSlice {
  id: string;
  name: string;
  color: string;
  value: number;
}

/** Spese del periodo raggruppate per macro-categoria (gruppo). */
export function expenseByGroup(
  txs: Transaction[],
  categories: Category[],
  groups: CategoryGroup[],
): GroupSlice[] {
  const groupOfCat = new Map<string, string>();
  for (const c of categories) if (c.groupId) groupOfCat.set(c.id, c.groupId);

  const byGroup = new Map<string, number>();
  let senzaGruppo = 0;
  for (const t of countable(txs)) {
    if (t.type !== 'expense') continue;
    const gId = t.categoryId ? groupOfCat.get(t.categoryId) : undefined;
    if (gId) byGroup.set(gId, (byGroup.get(gId) ?? 0) + t.amount);
    else senzaGruppo += t.amount;
  }

  const byId = new Map(groups.map((g) => [g.id, g]));
  const slices: GroupSlice[] = [];
  for (const [gId, value] of byGroup) {
    const g = byId.get(gId);
    slices.push({
      id: gId,
      name: g?.name ?? 'Gruppo',
      color: g?.color ?? '#94a3b8',
      value,
    });
  }
  if (senzaGruppo > 0) {
    slices.push({ id: '__none__', name: 'Senza gruppo', color: '#cbd5e1', value: senzaGruppo });
  }
  return slices.sort((a, b) => b.value - a.value);
}

export interface MonthPoint {
  month: string; // yyyy-mm
  income: number;
  expense: number;
}

export function monthlyTrend(txs: Transaction[], months: number): MonthPoint[] {
  const now = new Date();
  const points: MonthPoint[] = [];
  const index = new Map<string, MonthPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    const p: MonthPoint = { month: ym, income: 0, expense: 0 };
    points.push(p);
    index.set(ym, p);
  }
  for (const t of countable(txs)) {
    const ym = t.date.slice(0, 7);
    const p = index.get(ym);
    if (!p) continue;
    if (t.type === 'income') p.income += t.amount;
    else p.expense += t.amount;
  }
  return points;
}

export interface BudgetStatus {
  group: CategoryGroup;
  spent: number;
  budget: number;
  ratio: number;
}

/**
 * Budget per macro-categoria (gruppo): somma le spese di tutte le micro-categorie
 * del gruppo e le confronta con il budget del gruppo.
 */
export function budgetStatus(
  monthTxs: Transaction[],
  categories: Category[],
  groups: CategoryGroup[],
): BudgetStatus[] {
  // Mappa categoria -> gruppo di appartenenza.
  const groupOfCat = new Map<string, string>();
  for (const c of categories) if (c.groupId) groupOfCat.set(c.id, c.groupId);

  const spentByGroup = new Map<string, number>();
  for (const t of countable(monthTxs)) {
    if (t.type !== 'expense' || !t.categoryId) continue;
    const gId = groupOfCat.get(t.categoryId);
    if (!gId) continue;
    spentByGroup.set(gId, (spentByGroup.get(gId) ?? 0) + t.amount);
  }

  return groups
    .filter((g) => g.type === 'expense' && g.budget > 0)
    .map((group) => {
      const spent = spentByGroup.get(group.id) ?? 0;
      return {
        group,
        spent,
        budget: group.budget,
        ratio: group.budget ? spent / group.budget : 0,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Totali complessivi del budget del mese (pianificato / speso / rimanente). */
export function budgetOverview(status: BudgetStatus[]): {
  budget: number;
  spent: number;
  remaining: number;
  ratio: number;
} {
  const budget = status.reduce((s, b) => s + b.budget, 0);
  const spent = status.reduce((s, b) => s + b.spent, 0);
  return { budget, spent, remaining: budget - spent, ratio: budget ? spent / budget : 0 };
}

/** Soglia oltre la quale si avvisa che ci si sta avvicinando al budget. */
export const BUDGET_WARN_RATIO = 0.8;
