import { useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { EmptyState } from '../components/ui';
import type { PlannedExpense } from '../types';
import { formatCurrency, formatDate, todayISO, uid } from '../lib/format';
import { parseAmount } from '../lib/parse-values';

/** Mesi (arrotondati per eccesso) da oggi alla scadenza; 0 se scaduta/oggi. */
export function monthsUntil(due: string, from = new Date()): number {
  const now = new Date(from);
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = due.split('-').map(Number);
  const dd = new Date(y, m - 1, d);
  const ms = dd.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

export default function Planned() {
  const { planned, categories, savePlanned, removePlanned } = useData();

  const [desc, setDesc] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const expenseCats = categories.filter((c) => c.type === 'expense');

  const upcoming = useMemo(
    () =>
      planned
        .filter((p) => !p.paid)
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
    [planned],
  );
  const paid = useMemo(() => planned.filter((p) => p.paid), [planned]);

  const totalDue = upcoming.reduce((s, p) => s + p.amount, 0);
  const totalMonthly = upcoming.reduce((s, p) => {
    const m = monthsUntil(p.dueDate);
    return s + (m > 0 ? p.amount / m : 0);
  }, 0);

  function add() {
    const amount = parseAmount(amountText, ',') ?? 0;
    if (!desc.trim() || !(amount > 0) || !dueDate) {
      alert('Inserisci descrizione, importo e data di scadenza.');
      return;
    }
    savePlanned({
      id: uid(),
      description: desc.trim(),
      amount,
      dueDate,
      categoryId: categoryId || null,
      paid: false,
    });
    setDesc('');
    setAmountText('');
    setDueDate('');
    setCategoryId('');
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Spese in programma 📅</h2>
        <p className="mt-1 text-sm text-slate-500">
          Spese future una-tantum con una scadenza (bollo auto, assicurazione,
          condominio…). Ti dico <strong>quanto mettere da parte ogni mese</strong> per
          arrivarci pronta. Nel Riepilogo vedrai il totale da accantonare.
        </p>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Nuova spesa in programma</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Descrizione</label>
            <input
              className="input"
              placeholder="Es. Bollo auto, Assicurazione, Condominio…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Importo (€)</label>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Scadenza (entro il)</label>
            <input
              className="input"
              type="date"
              value={dueDate}
              min={todayISO()}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Categoria (facoltativa)</label>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— nessuna —</option>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="btn-primary" onClick={add}>
            + Aggiungi
          </button>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState title="Nessuna spesa in programma." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card p-4">
              <p className="text-sm text-slate-500">Totale da pagare</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {formatCurrency(totalDue)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-500">Da accantonare ogni mese</p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                {formatCurrency(totalMonthly)}
              </p>
            </div>
          </div>

          <div className="card divide-y divide-slate-100">
            {upcoming.map((p) => (
              <PlannedRow
                key={p.id}
                item={p}
                onSave={savePlanned}
                onDelete={() => removePlanned(p.id)}
              />
            ))}
          </div>
        </>
      )}

      {paid.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-500">Già pagate</h3>
          <div className="card divide-y divide-slate-100 opacity-70">
            {paid.map((p) => (
              <PlannedRow
                key={p.id}
                item={p}
                onSave={savePlanned}
                onDelete={() => removePlanned(p.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlannedRow({
  item,
  onSave,
  onDelete,
}: {
  item: PlannedExpense;
  onSave: (p: PlannedExpense) => void;
  onDelete: () => void;
}) {
  const months = monthsUntil(item.dueDate);
  const monthly = months > 0 ? item.amount / months : item.amount;
  const overdue = months === 0 && !item.paid;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-800">
          {item.description}
          {overdue && (
            <span className="badge ml-2 bg-red-100 text-red-700">scaduta</span>
          )}
        </div>
        <div className="text-xs text-slate-400">
          entro il {formatDate(item.dueDate)}
          {!item.paid &&
            !overdue &&
            ` · accantona ${formatCurrency(monthly)}/mese (${months} ${months === 1 ? 'mese' : 'mesi'})`}
        </div>
      </div>
      <span className="font-semibold text-slate-800">{formatCurrency(item.amount)}</span>
      <label className="flex items-center gap-1 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={!!item.paid}
          onChange={(e) => onSave({ ...item, paid: e.target.checked })}
        />
        pagata
      </label>
      <button
        className="btn-ghost !px-2 !py-1 text-red-500"
        onClick={() => window.confirm('Eliminare questa spesa in programma?') && onDelete()}
      >
        🗑️
      </button>
    </div>
  );
}
