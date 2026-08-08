import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '../store/DataContext';
import { StatCard, EmptyState } from '../components/ui';
import { formatCurrency, formatMonthLabel, currentMonth } from '../lib/format';
import {
  budgetStatus,
  expenseByCategory,
  filterByMonth,
  monthlyTrend,
  totals,
} from '../lib/summary';

export default function Dashboard() {
  const { transactions, categories } = useData();
  const [month, setMonth] = useState(currentMonth());

  const monthTxs = useMemo(
    () => filterByMonth(transactions, month),
    [transactions, month],
  );
  const t = useMemo(() => totals(monthTxs), [monthTxs]);
  const slices = useMemo(
    () => expenseByCategory(monthTxs, categories),
    [monthTxs, categories],
  );
  const trend = useMemo(() => monthlyTrend(transactions, 6), [transactions]);
  const budgets = useMemo(
    () => budgetStatus(monthTxs, categories),
    [monthTxs, categories],
  );

  // Elenco dei mesi che contengono movimenti + mese corrente.
  const months = useMemo(() => {
    const set = new Set<string>(transactions.map((x) => x.date.slice(0, 7)));
    set.add(currentMonth());
    return Array.from(set).sort().reverse();
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Nessun movimento ancora registrato"
        hint="Aggiungi una spesa dalla sezione Movimenti oppure importa il rendiconto della tua banca."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Riepilogo</h2>
        <select
          className="input max-w-xs"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Entrate" value={formatCurrency(t.income)} tone="positive" />
        <StatCard label="Spese" value={formatCurrency(t.expense)} tone="negative" />
        <StatCard
          label="Saldo del mese"
          value={formatCurrency(t.balance)}
          tone={t.balance >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-700">Spese per categoria</h3>
          {slices.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Nessuna spesa in questo mese.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(e) => e.name}
                >
                  {slices.map((s) => (
                    <Cell key={s.categoryId ?? 'none'} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-700">Andamento (6 mesi)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend}>
              <XAxis
                dataKey="month"
                tickFormatter={(m) => formatMonthLabel(m).split(' ')[0].slice(0, 3)}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(m) => formatMonthLabel(String(m))}
              />
              <Legend />
              <Bar dataKey="income" name="Entrate" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Spese" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Budget del mese</h3>
        {budgets.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nessun budget impostato. Definiscili nella sezione Categorie & Budget.
          </p>
        ) : (
          <div className="space-y-3">
            {budgets.map((b) => {
              const over = b.ratio > 1;
              const pct = Math.min(b.ratio * 100, 100);
              return (
                <div key={b.category.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: b.category.color }}
                      />
                      {b.category.name}
                    </span>
                    <span className={over ? 'font-semibold text-red-600' : 'text-slate-500'}>
                      {formatCurrency(b.spent)} / {formatCurrency(b.budget)}
                      {over && ' · superato!'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-brand-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
