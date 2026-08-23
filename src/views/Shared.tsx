// Schermata "Condivise": mostra solo le spese di categorie contrassegnate come
// condivise (es. spesa alimentare, luce, gas, acqua, affitto…) e calcola quanto
// spetta a ciascuno secondo la divisione impostata con il partner.

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
} from '../lib/summary';
import { getBudgetStartDay, getSharedConfig, setSharedConfig } from '../lib/settings';

export default function Shared() {
  const { categories, transactions, saveCategory } = useData();

  const startDay = getBudgetStartDay();
  const [cfg, setCfg] = useState(() => getSharedConfig());
  const [editCats, setEditCats] = useState(false);

  // Categorie di spesa contrassegnate come condivise.
  const sharedCats = useMemo(
    () => categories.filter((c) => c.type === 'expense' && c.shared),
    [categories],
  );
  const sharedIds = useMemo(() => new Set(sharedCats.map((c) => c.id)), [sharedCats]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Selettore del periodo (allineato al ciclo della busta paga).
  const periods = useMemo(
    () => listPeriods(transactions.map((t) => t.date), startDay),
    [transactions, startDay],
  );
  const [periodFrom, setPeriodFrom] = useState<string>('all');
  const period =
    periodFrom === 'all'
      ? null
      : periods.find((p) => p.from === periodFrom) ?? periodRange(new Date(), startDay);

  // Movimenti condivisi del periodo (solo spese, esclusi i giroconti).
  const sharedTxs = useMemo(() => {
    let list = countable(transactions).filter(
      (t) => t.type === 'expense' && t.categoryId && sharedIds.has(t.categoryId),
    );
    if (period) list = filterByRange(list, period.from, period.to);
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactions, sharedIds, period]);

  const total = sharedTxs.reduce((s, t) => s + t.amount, 0);
  const mine = (total * cfg.myShare) / 100;
  const partner = total - mine;

  // Ripartizione per categoria.
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of sharedTxs) {
      if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
    }
    return Array.from(m.entries())
      .map(([id, value]) => ({ cat: catById.get(id), value }))
      .sort((a, b) => b.value - a.value);
  }, [sharedTxs, catById]);

  function updateCfg(patch: Partial<typeof cfg>) {
    const next = { ...cfg, ...patch };
    setCfg(next);
    setSharedConfig(next);
  }

  const expenseCats = categories.filter((c) => c.type === 'expense');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Spese condivise 🤝</h2>
        <p className="mt-1 text-sm text-slate-500">
          Le spese che dividi con {cfg.partnerName || 'il partner'} (spesa, luce, gas, acqua,
          affitto…). Scegli quali categorie sono condivise e qui vedi solo quelle, con la parte
          che spetta a ciascuno.
        </p>
      </div>

      {/* Divisione */}
      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Come dividete</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-500">
            <span className="mb-1 block">Con chi dividi</span>
            <input
              className="input"
              value={cfg.partnerName}
              placeholder="Es. Marco"
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
                % · a {cfg.partnerName || 'partner'} il {100 - cfg.myShare}%
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
      </div>

      {/* Periodo */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Periodo</span>
        <select
          className="input w-auto"
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
        >
          <option value="all">Tutti i movimenti</option>
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
            {cfg.partnerName || 'Partner'} ({100 - cfg.myShare}%)
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(partner)}</p>
        </div>
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
            {cfg.partnerName || 'il partner'} (es. Alimentari, Bollette, Casa).
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

      {/* Elenco movimenti condivisi */}
      <div>
        <h3 className="mb-2 font-semibold text-slate-700">
          Movimenti condivisi
          {sharedTxs.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              {sharedTxs.length}
            </span>
          )}
        </h3>
        {sharedTxs.length === 0 ? (
          <EmptyState
            title="Nessuna spesa condivisa in questo periodo."
            hint="Seleziona le categorie condivise qui sopra, oppure cambia periodo."
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
