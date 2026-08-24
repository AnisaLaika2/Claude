// Schermata "Condivise": mostra solo le spese di categorie contrassegnate come
// condivise (es. spesa alimentare, luce, gas, acqua, affitto…) e calcola quanto
// spetta a ciascuno secondo la divisione impostata con il partner. Include i
// bonifici in arrivo dal partner per verificare se i conti tornano, con storico
// mese per mese (ciclo allineato alla busta paga).

import { useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { EmptyState } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/format';
import {
  countable,
  filterByRange,
  listPeriods,
  periodRange,
  formatPeriod,
  type Period,
} from '../lib/summary';
import {
  getBudgetStartDay,
  getSharedConfig,
  setSharedConfig,
  getSharedStartDay,
  setSharedStartDay,
} from '../lib/settings';
import type { Transaction } from '../types';

export default function Shared() {
  const { categories, transactions, saveCategory } = useData();

  const homeStartDay = getBudgetStartDay();
  // Giorno di inizio mese specifico di questa schermata (null = come la home).
  const [sharedStart, setSharedStart] = useState<number | null>(() => getSharedStartDay());
  const startDay = sharedStart ?? homeStartDay;
  const [cfg, setCfg] = useState(() => getSharedConfig());
  const [editCats, setEditCats] = useState(false);

  function updateStartDay(value: number | null) {
    setSharedStart(value);
    setSharedStartDay(value);
    setPeriodFrom('all'); // i cicli cambiano: torno a "Tutti i mesi"
  }

  // Categorie di spesa contrassegnate come condivise.
  const sharedCats = useMemo(
    () => categories.filter((c) => c.type === 'expense' && c.shared),
    [categories],
  );
  const sharedIds = useMemo(() => new Set(sharedCats.map((c) => c.id)), [sharedCats]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Nome usato per riconoscere i bonifici del partner (fallback al suo nome).
  const incomingNeedle = (cfg.incomingName || cfg.partnerName).trim().toLowerCase();

  // Tutte le spese condivise (solo spese, esclusi i giroconti).
  const sharedExpensesAll = useMemo(
    () =>
      countable(transactions).filter(
        (t) => t.type === 'expense' && t.categoryId && sharedIds.has(t.categoryId),
      ),
    [transactions, sharedIds],
  );

  // Tutti i bonifici in arrivo dal partner (entrate con il suo nome).
  const incomingAll = useMemo(() => {
    if (!incomingNeedle) return [] as Transaction[];
    return countable(transactions).filter(
      (t) => t.type === 'income' && t.description.toLowerCase().includes(incomingNeedle),
    );
  }, [transactions, incomingNeedle]);

  // Selettore del periodo (allineato al ciclo della busta paga).
  const periods = useMemo(() => {
    const dates = [...sharedExpensesAll, ...incomingAll].map((t) => t.date);
    return listPeriods(dates, startDay);
  }, [sharedExpensesAll, incomingAll, startDay]);

  const [periodFrom, setPeriodFrom] = useState<string>('all');
  const period: Period | null =
    periodFrom === 'all'
      ? null
      : periods.find((p) => p.from === periodFrom) ?? periodRange(new Date(), startDay);

  // Movimenti condivisi del periodo selezionato.
  const sharedTxs = useMemo(() => {
    const list = period
      ? filterByRange(sharedExpensesAll, period.from, period.to)
      : sharedExpensesAll;
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [sharedExpensesAll, period]);

  const incomingTxs = useMemo(() => {
    const list = period ? filterByRange(incomingAll, period.from, period.to) : incomingAll;
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [incomingAll, period]);

  const total = sharedTxs.reduce((s, t) => s + t.amount, 0);
  const mine = (total * cfg.myShare) / 100;
  const partner = total - mine;
  const received = incomingTxs.reduce((s, t) => s + t.amount, 0);
  const owedBalance = partner - received; // >0 ti deve ancora, <0 ti ha dato in più

  // Ripartizione per categoria (periodo selezionato).
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of sharedTxs) {
      if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
    }
    return Array.from(m.entries())
      .map(([id, value]) => ({ cat: catById.get(id), value }))
      .sort((a, b) => b.value - a.value);
  }, [sharedTxs, catById]);

  // Storico mese per mese (ciclo): totale, quota partner, ricevuto, saldo.
  const history = useMemo(() => {
    return periods.map((p) => {
      const exp = filterByRange(sharedExpensesAll, p.from, p.to).reduce(
        (s, t) => s + t.amount,
        0,
      );
      const inc = filterByRange(incomingAll, p.from, p.to).reduce((s, t) => s + t.amount, 0);
      const partnerShare = (exp * (100 - cfg.myShare)) / 100;
      return { period: p, total: exp, partnerShare, received: inc, balance: partnerShare - inc };
    });
  }, [periods, sharedExpensesAll, incomingAll, cfg.myShare]);

  function updateCfg(patch: Partial<typeof cfg>) {
    const next = { ...cfg, ...patch };
    setCfg(next);
    setSharedConfig(next);
  }

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const partnerLabel = cfg.partnerName || 'partner';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Spese condivise 🤝</h2>
        <p className="mt-1 text-sm text-slate-500">
          Le spese che dividi con {partnerLabel} (spesa, luce, gas, acqua, affitto…). Scegli quali
          categorie sono condivise e qui vedi solo quelle, con la parte che spetta a ciascuno e i
          bonifici che ti arrivano da {partnerLabel}, così controlli se i conti tornano.
        </p>
      </div>

      {/* Periodo (mese, dal giorno di inizio ciclo) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">📅 Mese</span>
        <select
          className="input w-auto"
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
        >
          <option value="all">Tutti i mesi</option>
          {periods.map((p) => (
            <option key={p.from} value={p.from}>
              {formatPeriod(p, startDay)}
            </option>
          ))}
        </select>
      </div>

      {/* Riepilogo divisione */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Totale condiviso</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">La tua parte ({cfg.myShare}%)</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{formatCurrency(mine)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">
            {partnerLabel} ({100 - cfg.myShare}%)
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(partner)}</p>
        </div>
      </div>

      {/* Verifica bonifici: quota partner vs ricevuto */}
      {incomingNeedle && (
        <div className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-700">Tornano i conti?</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Quota di {partnerLabel}</span>
              <span className="font-medium text-slate-800">{formatCurrency(partner)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bonifici ricevuti</span>
              <span className="font-medium text-emerald-600">{formatCurrency(received)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
              <span className="font-medium text-slate-700">
                {owedBalance > 0.005
                  ? `${partnerLabel} ti deve ancora`
                  : owedBalance < -0.005
                    ? `${partnerLabel} ti ha dato in più`
                    : 'In pari ✅'}
              </span>
              <span
                className={`font-bold ${
                  owedBalance > 0.005
                    ? 'text-red-600'
                    : owedBalance < -0.005
                      ? 'text-emerald-600'
                      : 'text-slate-700'
                }`}
              >
                {formatCurrency(Math.abs(owedBalance))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Divisione e riconoscimento bonifici */}
      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Impostazioni divisione</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-500">
            <span className="mb-1 block">Con chi dividi</span>
            <input
              className="input"
              value={cfg.partnerName}
              placeholder="Es. Luca"
              onChange={(e) => updateCfg({ partnerName: e.target.value })}
            />
          </label>
          <label className="text-sm text-slate-500">
            <span className="mb-1 block">La tua quota</span>
            <div className="flex items-center gap-2">
              <input
                className="input w-24"
                type="number"
                min="0"
                max="100"
                step="5"
                value={cfg.myShare}
                onChange={(e) => updateCfg({ myShare: Number(e.target.value) || 0 })}
              />
              <span className="text-slate-500">
                % · a {partnerLabel} il {100 - cfg.myShare}%
              </span>
            </div>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[50, 60, 40, 100].map((v) => (
            <button
              key={v}
              className={`badge ${
                cfg.myShare === v ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => updateCfg({ myShare: v })}
            >
              {v === 50 ? 'Metà (50/50)' : v === 100 ? 'Tutto io' : `${v}%`}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-sm text-slate-500">
          <span className="mb-1 block">Nome sui bonifici in arrivo</span>
          <input
            className="input"
            value={cfg.incomingName}
            placeholder="Es. Luca Mercurio"
            onChange={(e) => updateCfg({ incomingName: e.target.value })}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Le entrate che contengono questo nome vengono contate come rimborsi di {partnerLabel}.
            Se lo lasci vuoto uso “{cfg.partnerName}”.
          </span>
        </label>

        <label className="mt-3 block text-sm text-slate-500">
          <span className="mb-1 block">Inizio del mese (solo in questa schermata)</span>
          <select
            className="input"
            value={sharedStart === null ? 'home' : String(sharedStart)}
            onChange={(e) =>
              updateStartDay(e.target.value === 'home' ? null : Number(e.target.value))
            }
          >
            <option value="home">
              Come la home (dal {homeStartDay}
              {homeStartDay === 1 ? '° · mese solare' : ''})
            </option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Dal giorno {d}
                {d === 1 ? ' (mese solare)' : ''}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-400">
            Qui puoi contare il mese in modo diverso dal resto dell'app (es. dal 1° qui, dal{' '}
            {homeStartDay} nella home).
          </span>
        </label>
      </div>

      {/* Quali categorie sono condivise */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">
            Categorie condivise
            {sharedCats.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                {sharedCats.length} selezionate
              </span>
            )}
          </h3>
          <button className="btn-secondary !py-1 !text-sm" onClick={() => setEditCats((v) => !v)}>
            {editCats ? 'Fatto' : 'Modifica'}
          </button>
        </div>

        {editCats ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {expenseCats.length === 0 && (
              <span className="text-sm text-slate-400">Nessuna categoria di spesa.</span>
            )}
            {expenseCats.map((c) => (
              <button
                key={c.id}
                className={`badge ${
                  c.shared ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'
                }`}
                style={{ borderLeft: `3px solid ${c.color}` }}
                onClick={() => saveCategory({ ...c, shared: !c.shared })}
              >
                {c.shared ? '✓ ' : '+ '}
                {c.name}
              </button>
            ))}
          </div>
        ) : sharedCats.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Nessuna categoria condivisa. Tocca “Modifica” e scegli quelle che dividi con{' '}
            {partnerLabel} (es. Alimentari, Bollette, Casa).
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {sharedCats.map((c) => (
              <span
                key={c.id}
                className="badge bg-slate-100 text-slate-700"
                style={{ borderLeft: `3px solid ${c.color}` }}
              >
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ripartizione per categoria */}
      {byCat.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-700">Per categoria</h3>
          <div className="card divide-y divide-slate-100">
            {byCat.map(({ cat, value }) => (
              <div key={cat?.id ?? 'x'} className="flex items-center gap-3 p-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: cat?.color ?? '#94a3b8' }}
                />
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {cat?.name ?? 'Categoria'}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold text-slate-800">
                    {formatCurrency(value)}
                  </span>
                  <span className="block text-xs text-slate-400">
                    tu {formatCurrency((value * cfg.myShare) / 100)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonifici in arrivo dal partner */}
      {incomingNeedle && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-700">
            Bonifici da {partnerLabel}
            {incomingTxs.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">{incomingTxs.length}</span>
            )}
          </h3>
          {incomingTxs.length === 0 ? (
            <EmptyState
              title={`Nessun bonifico da ${partnerLabel} in questo periodo.`}
              hint="Controlla che il nome sui bonifici sia scritto come nell'estratto conto."
            />
          ) : (
            <div className="card divide-y divide-slate-100">
              {incomingTxs.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3">
                  <span className="shrink-0 text-lg">↘️</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-800">{t.description}</p>
                    <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-emerald-600">
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Storico mese per mese */}
      {history.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-700">Storico mese per mese</h3>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="p-3 font-medium">Mese</th>
                  <th className="p-3 text-right font-medium">Speso</th>
                  <th className="p-3 text-right font-medium">Quota {partnerLabel}</th>
                  {incomingNeedle && <th className="p-3 text-right font-medium">Ricevuto</th>}
                  {incomingNeedle && <th className="p-3 text-right font-medium">Saldo</th>}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.period.from}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    onClick={() => setPeriodFrom(h.period.from)}
                  >
                    <td className="p-3 text-slate-700">{formatPeriod(h.period, startDay)}</td>
                    <td className="p-3 text-right font-medium text-slate-800">
                      {formatCurrency(h.total)}
                    </td>
                    <td className="p-3 text-right text-slate-600">
                      {formatCurrency(h.partnerShare)}
                    </td>
                    {incomingNeedle && (
                      <td className="p-3 text-right text-emerald-600">
                        {formatCurrency(h.received)}
                      </td>
                    )}
                    {incomingNeedle && (
                      <td
                        className={`p-3 text-right font-medium ${
                          h.balance > 0.005
                            ? 'text-red-600'
                            : h.balance < -0.005
                              ? 'text-emerald-600'
                              : 'text-slate-500'
                        }`}
                      >
                        {h.balance > 0.005
                          ? `−${formatCurrency(h.balance)}`
                          : h.balance < -0.005
                            ? `+${formatCurrency(-h.balance)}`
                            : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {incomingNeedle && (
            <p className="mt-2 text-xs text-slate-400">
              Saldo: <span className="text-red-600">−</span> = {partnerLabel} ti deve ancora ·{' '}
              <span className="text-emerald-600">+</span> = ti ha dato in più. Tocca un mese per
              filtrare.
            </p>
          )}
        </div>
      )}

      {/* Elenco movimenti condivisi */}
      <div>
        <h3 className="mb-2 font-semibold text-slate-700">
          Movimenti condivisi
          {sharedTxs.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">{sharedTxs.length}</span>
          )}
        </h3>
        {sharedTxs.length === 0 ? (
          <EmptyState
            title="Nessuna spesa condivisa in questo periodo."
            hint="Seleziona le categorie condivise qui sopra, oppure cambia mese."
          />
        ) : (
          <div className="card divide-y divide-slate-100">
            {sharedTxs.map((t) => {
              const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
              return (
                <div key={t.id} className="flex items-center gap-3 p-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: cat?.color ?? '#94a3b8' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-800">{t.description}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(t.date)}
                      {cat ? ` · ${cat.name}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold text-slate-800">
                      {formatCurrency(t.amount)}
                    </span>
                    <span className="block text-xs text-slate-400">
                      tu {formatCurrency((t.amount * cfg.myShare) / 100)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
