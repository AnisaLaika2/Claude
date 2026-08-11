import { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { Modal, EmptyState } from '../components/ui';
import type { Transaction, TxType } from '../types';
import { formatCurrency, formatDate, todayISO, uid } from '../lib/format';
import { computeDedupHash } from '../lib/dedup';
import { suggestKeyword } from '../lib/categorize';

const emptyForm = (): Transaction => ({
  id: '',
  date: todayISO(),
  amount: 0,
  type: 'expense',
  description: '',
  categoryId: null,
  paymentMethod: 'Carta',
  notes: '',
  source: 'manual',
  createdAt: Date.now(),
});

export default function Transactions() {
  const {
    transactions,
    categories,
    saveTransaction,
    removeTransaction,
    rules,
    saveRule,
  } = useData();

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  // Riga per cui è aperto il menù categoria (uno solo alla volta = più leggero).
  const [editCatId, setEditCatId] = useState<string | null>(null);
  // Paginazione: mostra un blocco di righe per volta.
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  const methods = useMemo(() => {
    const set = new Set(
      transactions.map((t) => t.paymentMethod).filter(Boolean) as string[],
    );
    return Array.from(set).sort();
  }, [transactions]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => (monthFilter === 'all' ? true : t.date.startsWith(monthFilter)))
      .filter((t) =>
        catFilter === 'all'
          ? true
          : catFilter === 'none'
            ? t.categoryId === null
            : t.categoryId === catFilter,
      )
      .filter((t) => (methodFilter === 'all' ? true : t.paymentMethod === methodFilter))
      .filter((t) =>
        search.trim()
          ? t.description.toLowerCase().includes(search.toLowerCase())
          : true,
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  }, [transactions, monthFilter, catFilter, methodFilter, search]);

  // Torna alla prima pagina quando cambiano i filtri o i dati.
  useEffect(() => {
    setPage(0);
  }, [monthFilter, catFilter, methodFilter, search, transactions.length]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  async function onSave(t: Transaction) {
    const toSave: Transaction = {
      ...t,
      id: t.id || uid(),
      dedupHash: computeDedupHash(t.date, t.amount, t.description),
    };
    await saveTransaction(toSave);
    setEditing(null);
  }

  // Cambio categoria inline: apprende una regola dalla correzione dell'utente.
  async function onInlineCategory(t: Transaction, categoryId: string | null) {
    await saveTransaction({ ...t, categoryId });
    if (!categoryId) return;
    const keyword = suggestKeyword(t.description);
    const alreadyCovered = rules.some(
      (r) =>
        r.categoryId === categoryId &&
        t.description.toLowerCase().includes(r.pattern.toLowerCase()),
    );
    if (keyword && !alreadyCovered) {
      const cat = catById.get(categoryId);
      const ok = window.confirm(
        `Creare una regola automatica?\n\nI movimenti che contengono "${keyword}" verranno assegnati a "${cat?.name}".`,
      );
      if (ok) {
        await saveRule({
          id: uid(),
          pattern: keyword,
          match: 'contains',
          categoryId,
          priority: 10,
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Movimenti</h2>
        <button className="btn-primary ml-auto" onClick={() => setEditing(emptyForm())}>
          + Nuovo movimento
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="input"
          placeholder="Cerca descrizione…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="all">Tutti i mesi</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="all">Tutte le categorie</option>
          <option value="none">Senza categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {methods.length > 0 && (
          <select
            className="input"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="all">Conto e Carta</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nessun movimento trovato con questi filtri." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Descrizione</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">Importo</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">
                      {t.description}
                      {t.excludeFromTotals && (
                        <span className="badge ml-2 bg-slate-200 text-slate-600">
                          giroconto
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {t.paymentMethod}
                      {t.source !== 'manual' && ` · ${t.source === 'import' ? 'importato' : 'ricorrente'}`}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {editCatId === t.id ? (
                      <select
                        autoFocus
                        className="input !py-1 !text-xs"
                        value={t.categoryId ?? ''}
                        onChange={(e) => {
                          onInlineCategory(t, e.target.value || null);
                          setEditCatId(null);
                        }}
                        onBlur={() => setEditCatId(null)}
                      >
                        <option value="">— nessuna —</option>
                        {categories
                          .filter((c) => c.type === t.type)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100"
                        onClick={() => setEditCatId(t.id)}
                        title="Tocca per cambiare categoria"
                      >
                        {t.categoryId ? (
                          <>
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: catById.get(t.categoryId)?.color ?? '#94a3b8' }}
                            />
                            {catById.get(t.categoryId)?.name ?? '—'}
                          </>
                        ) : (
                          <span className="text-slate-400">assegna…</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
                      t.excludeFromTotals
                        ? 'text-slate-400 line-through'
                        : t.type === 'income'
                          ? 'text-emerald-600'
                          : 'text-slate-800'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '−'}
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button className="btn-ghost !px-2 !py-1" onClick={() => setEditing(t)}>
                      ✏️
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-1 text-red-500"
                      onClick={() => {
                        if (window.confirm('Eliminare questo movimento?')) {
                          removeTransaction(t.id);
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span>
            {filtered.length} movimenti
            {pageCount > 1 && ` · pagina ${safePage + 1} di ${pageCount}`}
          </span>
          {pageCount > 1 && (
            <div className="flex gap-2">
              <button
                className="btn-secondary"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Precedenti
              </button>
              <button
                className="btn-secondary"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Successivi →
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <TransactionForm
          value={editing}
          onCancel={() => setEditing(null)}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function TransactionForm({
  value,
  onSave,
  onCancel,
}: {
  value: Transaction;
  onSave: (t: Transaction) => void;
  onCancel: () => void;
}) {
  const { categories } = useData();
  const [form, setForm] = useState<Transaction>(value);
  const isNew = !value.id;

  function set<K extends keyof Transaction>(key: K, v: Transaction[K]) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  function submit() {
    if (!form.description.trim()) {
      alert('Inserisci una descrizione.');
      return;
    }
    if (!(form.amount > 0)) {
      alert("Inserisci un importo maggiore di zero.");
      return;
    }
    onSave(form);
  }

  const cats = categories.filter((c) => c.type === form.type);

  return (
    <Modal open title={isNew ? 'Nuovo movimento' : 'Modifica movimento'} onClose={onCancel}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={form.type === 'expense' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => set('type', 'expense' as TxType)}
          >
            Spesa
          </button>
          <button
            className={form.type === 'income' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => set('type', 'income' as TxType)}
          >
            Entrata
          </button>
        </div>

        <div>
          <label className="label">Descrizione</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Importo (€)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={form.amount || ''}
              onChange={(e) => set('amount', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Data</label>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoria</label>
            <select
              className="input"
              value={form.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value || null)}
            >
              <option value="">— nessuna —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Metodo di pagamento</label>
            <input
              className="input"
              value={form.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value)}
              list="payment-methods"
            />
            <datalist id="payment-methods">
              <option value="Carta" />
              <option value="Contanti" />
              <option value="Bonifico" />
              <option value="Addebito diretto" />
            </datalist>
          </div>
        </div>

        <div>
          <label className="label">Note</label>
          <textarea
            className="input"
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={!!form.excludeFromTotals}
            onChange={(e) => set('excludeFromTotals', e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-700">Giroconto</span> — non contare
            nei totali (es. ricarica della carta: sposta soldi tra conto e carta, non è
            una spesa reale).
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onCancel}>
            Annulla
          </button>
          <button className="btn-primary" onClick={submit}>
            Salva
          </button>
        </div>
      </div>
    </Modal>
  );
}
