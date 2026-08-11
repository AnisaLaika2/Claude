import { useState } from 'react';
import { useData } from '../store/DataContext';
import { EmptyState } from '../components/ui';
import type { Recurring, TxType } from '../types';
import { formatCurrency, uid } from '../lib/format';

const empty = (): Recurring => ({
  id: '',
  description: '',
  amount: 0,
  type: 'expense',
  categoryId: null,
  paymentMethod: 'Addebito diretto',
  dayOfMonth: 1,
  lastGenerated: null,
  active: true,
});

export default function RecurringView() {
  const {
    recurring,
    categories,
    saveRecurring,
    removeRecurring,
  } = useData();
  const [form, setForm] = useState<Recurring>(empty());

  const catById = new Map(categories.map((c) => [c.id, c]));

  function set<K extends keyof Recurring>(k: K, v: Recurring[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add() {
    if (!form.description.trim() || !(form.amount > 0)) {
      alert('Inserisci descrizione e importo.');
      return;
    }
    await saveRecurring({ ...form, id: uid() });
    setForm(empty());
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Spese fisse ricorrenti</h2>
      <p className="text-sm text-slate-500">
        Abbonamenti e bollette (es. affitto, luce, Netflix). Servono solo per la
        <strong> previsione</strong>: nel Riepilogo vedrai le spese fisse in arrivo e
        quanto tenere da parte. <strong>Non creano movimenti</strong> e non toccano i
        totali di spese/entrate. Il “giorno” indica quando arriva l’addebito.
      </p>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Nuova ricorrenza</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="label">Descrizione</label>
            <input
              className="input"
              placeholder="Es. Netflix, Bolletta luce…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Importo (€)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.amount || ''}
              onChange={(e) => set('amount', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as TxType;
                set('type', type);
                set('categoryId', null);
              }}
            >
              <option value="expense">Spesa</option>
              <option value="income">Entrata</option>
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select
              className="input"
              value={form.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value || null)}
            >
              <option value="">— nessuna —</option>
              {categories
                .filter((c) => c.type === form.type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Giorno del mese (1-28)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="28"
              value={form.dayOfMonth}
              onChange={(e) =>
                set('dayOfMonth', Math.min(28, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="btn-primary" onClick={add}>
            + Aggiungi ricorrenza
          </button>
        </div>
      </div>

      {recurring.length === 0 ? (
        <EmptyState title="Nessuna spesa ricorrente impostata." />
      ) : (
        <div className="card divide-y divide-slate-100">
          {recurring.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium text-slate-800">{r.description}</span>
              <span className="badge bg-slate-100 text-slate-600">
                ogni {r.dayOfMonth} del mese
              </span>
              {r.categoryId && (
                <span className="flex items-center gap-1 text-slate-500">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: catById.get(r.categoryId)?.color }}
                  />
                  {catById.get(r.categoryId)?.name}
                </span>
              )}
              <span
                className={`font-semibold ${r.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}
              >
                {r.type === 'income' ? '+' : '−'}
                {formatCurrency(r.amount)}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => saveRecurring({ ...r, active: e.target.checked })}
                  />
                  attiva
                </label>
                <button
                  className="btn-ghost !px-2 !py-1 text-red-500"
                  onClick={() =>
                    window.confirm('Eliminare questa ricorrenza?') && removeRecurring(r.id)
                  }
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
