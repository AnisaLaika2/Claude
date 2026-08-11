import { useEffect, useMemo, useState } from 'react';
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
  BUDGET_WARN_RATIO,
  budgetOverview,
  budgetStatus,
  expenseByCategory,
  expenseByGroup,
  filterByMonth,
  monthlyTrend,
  totals,
} from '../lib/summary';
import { notificationsEnabled, showNotification } from '../lib/notify';

export default function Dashboard() {
  const { transactions, categories, groups } = useData();
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
  const groupSlices = useMemo(
    () => expenseByGroup(monthTxs, categories, groups),
    [monthTxs, categories, groups],
  );
  const trend = useMemo(() => monthlyTrend(transactions, 6), [transactions]);
  const budgets = useMemo(
    () => budgetStatus(monthTxs, categories, groups),
    [monthTxs, categories, groups],
  );
  const overview = useMemo(() => budgetOverview(budgets), [budgets]);
  const alerts = useMemo(
    () => budgets.filter((b) => b.ratio >= BUDGET_WARN_RATIO),
    [budgets],
  );

  const months = useMemo(() => {
    const set = new Set<string>(transactions.map((x) => x.date.slice(0, 7)));
    set.add(currentMonth());
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Notifica (una volta per sessione) se ci si avvicina/supera un budget del mese corrente.
  useEffect(() => {
    if (!notificationsEnabled() || month !== currentMonth() || alerts.length === 0) return;
    const key = `gs_notified_${month}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const over = alerts.filter((b) => b.ratio >= 1);
    const title = over.length ? '🔴 Budget superato' : '⚠️ Budget quasi raggiunto';
    const body = alerts
      .map((b) => `${b.group.name}: ${Math.round(b.ratio * 100)}%`)
      .join(' · ');
    showNotification(title, body);
  }, [alerts, month]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Nessun movimento ancora registrato"
        hint="Aggiungi una spesa dalla sezione Movimenti oppure importa il rendiconto della tua banca."
      />
    );
  }

  const totalGroupExpense = groupSlices.reduce((s, g) => s + g.value, 0);

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

      {/* Avvisi budget */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((b) => {
            const over = b.ratio >= 1;
            return (
              <div
                key={b.group.id}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
                  over
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                <span>{over ? '🔴' : '⚠️'}</span>
                <span className="font-medium">{b.group.name}</span>
                <span>
                  {over ? 'budget superato' : 'ti stai avvicinando'} —{' '}
                  {formatCurrency(b.spent)} di {formatCurrency(b.budget)} (
                  {Math.round(b.ratio * 100)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Entrate" value={formatCurrency(t.income)} tone="positive" />
        <StatCard label="Spese" value={formatCurrency(t.expense)} tone="negative" />
        <StatCard
          label="Saldo del mese"
          value={formatCurrency(t.balance)}
          tone={t.balance >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* Budget del mese: pianificato / speso / rimanente */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">Budget del mese</h3>
          <span className="text-xs text-slate-400">stile "ogni euro ha un compito"</span>
        </div>

        {overview.budget === 0 ? (
          <p className="text-sm text-slate-400">
            Nessun budget impostato. Vai in <strong>Categorie &amp; Budget</strong> e
            assegna un budget mensile ai tuoi gruppi.
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-500">Pianificato</p>
                <p className="text-lg font-bold text-slate-800">
                  {formatCurrency(overview.budget)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Speso</p>
                <p className="text-lg font-bold text-slate-800">
                  {formatCurrency(overview.spent)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Rimanente</p>
                <p
                  className={`text-lg font-bold ${
                    overview.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(overview.remaining)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {budgets.map((b) => (
                <BudgetBar
                  key={b.group.id}
                  name={b.group.name}
                  color={b.group.color}
                  spent={b.spent}
                  budget={b.budget}
                  ratio={b.ratio}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Spese per macro-categoria */}
      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Spese per gruppo (macro)</h3>
        {groupSlices.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Nessuna spesa in questo mese.
          </p>
        ) : (
          <div className="space-y-2">
            {groupSlices.map((g) => {
              const pct = totalGroupExpense ? (g.value / totalGroupExpense) * 100 : 0;
              return (
                <div key={g.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                      {g.name}
                    </span>
                    <span className="text-slate-600">
                      {formatCurrency(g.value)}{' '}
                      <span className="text-xs text-slate-400">
                        ({Math.round(pct)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: g.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-700">
            Spese per categoria (dettaglio)
          </h3>
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
    </div>
  );
}

function BudgetBar({
  name,
  color,
  spent,
  budget,
  ratio,
}: {
  name: string;
  color: string;
  spent: number;
  budget: number;
  ratio: number;
}) {
  const over = ratio >= 1;
  const near = !over && ratio >= BUDGET_WARN_RATIO;
  const pct = Math.min(ratio * 100, 100);
  const barColor = over ? '#ef4444' : near ? '#f59e0b' : '#10b981';
  const remaining = budget - spent;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: color }} />
          {name}
          {near && <span className="badge bg-amber-100 text-amber-700">vicino</span>}
          {over && <span className="badge bg-red-100 text-red-700">superato</span>}
        </span>
        <span className={over ? 'font-semibold text-red-600' : 'text-slate-500'}>
          {formatCurrency(spent)} / {formatCurrency(budget)}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="mt-0.5 text-right text-xs text-slate-400">
        {remaining >= 0
          ? `restano ${formatCurrency(remaining)}`
          : `sforato di ${formatCurrency(-remaining)}`}
      </div>
    </div>
  );
}
