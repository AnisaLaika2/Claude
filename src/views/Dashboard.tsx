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
import {
  formatCurrency,
  formatMonthLabel,
  currentMonth,
  todayISO,
  uid,
} from '../lib/format';
import type { Account, PlannedExpense, Recurring, Transaction } from '../types';
import { monthsUntil } from './Planned';
import {
  BUDGET_WARN_RATIO,
  accountBalance,
  budgetOverview,
  budgetStatus,
  expenseByCategory,
  expenseByGroup,
  filterByMonth,
  monthlyTrend,
  totals,
} from '../lib/summary';
import { parseAmount } from '../lib/parse-values';
import { notificationsEnabled, showNotification } from '../lib/notify';

export default function Dashboard({
  onOpenTransactions,
}: {
  onOpenTransactions: (cat: string, month: string) => void;
}) {
  const {
    transactions,
    categories,
    groups,
    accounts,
    recurring,
    planned,
    saveAccount,
    removeAccount,
  } = useData();
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
      <div className="space-y-5">
        <AccountsCard
          accounts={accounts}
          transactions={transactions}
          onSave={saveAccount}
          onRemove={removeAccount}
        />
        <EmptyState
          title="Nessun movimento ancora registrato"
          hint="Aggiungi una spesa dalla sezione Movimenti oppure importa il rendiconto della tua banca."
        />
      </div>
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

      {/* Saldo attuale in banca (impostato a mano, aggiornato dai movimenti) */}
      <AccountsCard
        accounts={accounts}
        transactions={transactions}
        onSave={saveAccount}
        onRemove={removeAccount}
      />

      {/* Previsione: spese fisse in arrivo */}
      <ForecastCard
        recurring={recurring}
        accountsTotal={accounts.reduce((s, a) => s + accountBalance(a, transactions), 0)}
        hasAccounts={accounts.length > 0}
      />

      {/* Spese future in programma (bollo, assicurazione…) */}
      <PlannedCard planned={planned} />

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
                  onClick={() => onOpenTransactions(`group:${b.group.id}`, month)}
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
              const clickable = g.id !== '__none__';
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onOpenTransactions(`group:${g.id}`, month)}
                  className={`block w-full text-left ${
                    clickable ? 'rounded-lg p-1 hover:bg-slate-50' : ''
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                      {g.name}
                    </span>
                    <span className="text-slate-600">
                      {formatCurrency(g.value)}{' '}
                      <span className="text-xs text-slate-400">({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: g.color }}
                    />
                  </div>
                </button>
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

function AccountsCard({
  accounts,
  transactions,
  onSave,
  onRemove,
}: {
  accounts: Account[];
  transactions: Transaction[];
  onSave: (a: Account) => void;
  onRemove: (id: string) => void;
}) {
  const total = accounts.reduce((s, a) => s + accountBalance(a, transactions), 0);

  function add(name: string) {
    onSave({ id: uid(), name, balance: 0, asOf: todayISO() });
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
      <p className="text-sm font-medium text-brand-700">💰 Saldo attuale in banca</p>
      {accounts.length > 0 && (
        <p
          className={`mt-1 text-4xl font-extrabold tracking-tight ${
            total >= 0 ? 'text-slate-900' : 'text-red-600'
          }`}
        >
          {formatCurrency(total)}
        </p>
      )}

      {accounts.length === 0 ? (
        <div className="mt-2">
          <p className="mb-3 text-sm text-slate-600">
            Inserisci il saldo reale dei tuoi conti/carte per avere il quadro
            completo. Si aggiorna da solo con i movimenti che aggiungi/importi dopo.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => add('Conto corrente')}>
              + Conto corrente
            </button>
            <button className="btn-secondary" onClick={() => add('Carta prepagata')}>
              + Carta prepagata
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              computed={accountBalance(a, transactions)}
              onSave={onSave}
              onRemove={() => onRemove(a.id)}
            />
          ))}
          <button className="btn-ghost text-brand-700" onClick={() => add('Nuovo conto')}>
            + Aggiungi conto
          </button>
        </div>
      )}
    </div>
  );
}

function AccountRow({
  account,
  computed,
  onSave,
  onRemove,
}: {
  account: Account;
  computed: number;
  onSave: (a: Account) => void;
  onRemove: () => void;
}) {
  // Stato locale della stringa importo per permettere di digitare i centesimi
  // (virgola o punto) senza che il campo si "resetti" a ogni tasto.
  const [text, setText] = useState(
    account.balance ? String(account.balance).replace('.', ',') : '',
  );

  function commit(raw: string) {
    setText(raw);
    const n = parseAmount(raw, ',') ?? 0;
    // Ri-àncora il saldo a oggi: i movimenti successivi lo aggiorneranno.
    onSave({ ...account, balance: n, asOf: todayISO() });
  }

  const adjusted = Math.abs(computed - account.balance) > 0.005;

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          className="input min-w-0 flex-1 bg-white"
          value={account.name}
          onChange={(e) => onSave({ ...account, name: e.target.value })}
          placeholder="Nome conto/carta"
        />
        <input
          className="input w-32 bg-white text-right"
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => commit(e.target.value)}
          placeholder="0,00"
        />
        <span className="text-sm text-slate-400">€</span>
        <button
          className="btn-ghost shrink-0 !px-2 !py-1 text-red-500"
          onClick={onRemove}
          title="Rimuovi"
        >
          ✕
        </button>
      </div>
      {adjusted && (
        <p className="mt-0.5 pl-1 text-xs text-slate-500">
          aggiornato con i movimenti:{' '}
          <span className="font-semibold text-slate-700">{formatCurrency(computed)}</span>
        </p>
      )}
    </div>
  );
}

function ForecastCard({
  recurring,
  accountsTotal,
  hasAccounts,
}: {
  recurring: Recurring[];
  accountsTotal: number;
  hasAccounts: boolean;
}) {
  const active = recurring.filter((r) => r.active);
  if (active.length === 0) return null;

  const today = new Date().getDate();
  // In arrivo entro fine mese (giorno di addebito non ancora passato).
  const upcoming = active
    .filter((r) => r.dayOfMonth >= today)
    .sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const upExpense = upcoming
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + r.amount, 0);
  const upIncome = upcoming
    .filter((r) => r.type === 'income')
    .reduce((s, r) => s + r.amount, 0);
  const predicted = accountsTotal - upExpense + upIncome;
  const shortfall = hasAccounts && predicted < 0;

  return (
    <div className="card p-4">
      <h3 className="mb-1 font-semibold text-slate-700">🔮 Spese fisse in arrivo</h3>
      <p className="mb-3 text-xs text-slate-400">
        Previsione dalle spese ricorrenti — non conta nei totali del mese.
      </p>

      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nessuna spesa fissa in arrivo entro fine mese. 👍
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {upcoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  <span className="mr-2 inline-block w-14 text-slate-400">
                    il {r.dayOfMonth}
                  </span>
                  {r.description}
                </span>
                <span
                  className={r.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}
                >
                  {r.type === 'income' ? '+' : '−'}
                  {formatCurrency(r.amount)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Da tenere per le spese fisse</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(upExpense)}
              </span>
            </div>
            {hasAccounts && (
              <div className="mt-1 flex justify-between">
                <span className="text-slate-500">Saldo previsto dopo di esse</span>
                <span
                  className={`font-semibold ${
                    predicted >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(predicted)}
                </span>
              </div>
            )}
          </div>

          {shortfall && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              ⚠️ Attenzione: le spese fisse in arrivo ({formatCurrency(upExpense)})
              superano il saldo disponibile. Rischi di andare sotto di{' '}
              {formatCurrency(-predicted)}.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlannedCard({ planned }: { planned: PlannedExpense[] }) {
  const upcoming = planned
    .filter((p) => !p.paid)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  if (upcoming.length === 0) return null;

  const totalDue = upcoming.reduce((s, p) => s + p.amount, 0);
  const totalMonthly = upcoming.reduce((s, p) => {
    const m = monthsUntil(p.dueDate);
    return s + (m > 0 ? p.amount / m : 0);
  }, 0);

  return (
    <div className="card p-4">
      <h3 className="mb-1 font-semibold text-slate-700">📅 Spese in programma</h3>
      <p className="mb-3 text-xs text-slate-400">
        Spese future con scadenza — mettine da parte un po’ ogni mese.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Totale in arrivo</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(totalDue)}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-3">
          <p className="text-xs text-brand-700">Da accantonare/mese</p>
          <p className="text-lg font-bold text-brand-700">{formatCurrency(totalMonthly)}</p>
        </div>
      </div>

      <div className="space-y-1">
        {upcoming.slice(0, 6).map((p) => {
          const m = monthsUntil(p.dueDate);
          return (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {p.description}
                <span className="ml-2 text-xs text-slate-400">
                  {m === 0 ? 'scaduta' : `tra ${m} ${m === 1 ? 'mese' : 'mesi'}`}
                </span>
              </span>
              <span className="font-medium text-slate-800">{formatCurrency(p.amount)}</span>
            </div>
          );
        })}
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
  onClick,
}: {
  name: string;
  color: string;
  spent: number;
  budget: number;
  ratio: number;
  onClick?: () => void;
}) {
  const over = ratio >= 1;
  const near = !over && ratio >= BUDGET_WARN_RATIO;
  const pct = Math.min(ratio * 100, 100);
  const barColor = over ? '#ef4444' : near ? '#f59e0b' : '#10b981';
  const remaining = budget - spent;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg p-1 text-left hover:bg-slate-50"
      title="Tocca per vedere i movimenti di questo gruppo"
    >
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
      <div className="mt-0.5 flex justify-between text-xs text-slate-400">
        <span className="text-brand-600">vedi movimenti →</span>
        <span>
          {remaining >= 0
            ? `restano ${formatCurrency(remaining)}`
            : `sforato di ${formatCurrency(-remaining)}`}
        </span>
      </div>
    </button>
  );
}
