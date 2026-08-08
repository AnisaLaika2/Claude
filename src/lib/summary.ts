// Funzioni di aggregazione per dashboard e report.

import type { Category, Transaction } from '../types';

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
  for (const t of txs) {
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
  for (const t of txs) {
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
  for (const t of txs) {
    const ym = t.date.slice(0, 7);
    const p = index.get(ym);
    if (!p) continue;
    if (t.type === 'income') p.income += t.amount;
    else p.expense += t.amount;
  }
  return points;
}

export interface BudgetStatus {
  category: Category;
  spent: number;
  budget: number;
  ratio: number;
}

export function budgetStatus(
  monthTxs: Transaction[],
  categories: Category[],
): BudgetStatus[] {
  const spentByCat = new Map<string, number>();
  for (const t of monthTxs) {
    if (t.type !== 'expense' || !t.categoryId) continue;
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount);
  }
  return categories
    .filter((c) => c.type === 'expense' && c.budget > 0)
    .map((category) => {
      const spent = spentByCat.get(category.id) ?? 0;
      return {
        category,
        spent,
        budget: category.budget,
        ratio: category.budget ? spent / category.budget : 0,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
