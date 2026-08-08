import { useState } from 'react';
import { useData } from '../store/DataContext';
import type { Category, TxType } from '../types';
import { formatCurrency, uid } from '../lib/format';

const PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#10b981', '#06b6d4',
  '#6366f1', '#84cc16', '#eab308', '#f43f5e', '#8b5cf6',
];

export default function Categories() {
  const { categories, saveCategory, removeCategory, transactions } = useData();
  const [name, setName] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [color, setColor] = useState(PALETTE[0]);

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');

  function add() {
    if (!name.trim()) return;
    saveCategory({
      id: uid(),
      name: name.trim(),
      color,
      type,
      budget: 0,
    });
    setName('');
    setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  }

  function onDelete(c: Category) {
    const used = transactions.some((t) => t.categoryId === c.id);
    const msg = used
      ? `La categoria "${c.name}" è usata da alcuni movimenti, che resteranno senza categoria. Eliminare comunque?`
      : `Eliminare la categoria "${c.name}"?`;
    if (window.confirm(msg)) removeCategory(c.id);
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Categorie & Budget</h2>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Nuova categoria</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="label">Nome</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as TxType)}
            >
              <option value="expense">Spesa</option>
              <option value="income">Entrata</option>
            </select>
          </div>
          <div>
            <label className="label">Colore</label>
            <div className="flex flex-wrap gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={add}>
            + Aggiungi
          </button>
        </div>
      </div>

      <CategoryTable
        title="Categorie di spesa (con budget mensile)"
        cats={expenseCats}
        showBudget
        onSave={saveCategory}
        onDelete={onDelete}
      />
      <CategoryTable
        title="Categorie di entrata"
        cats={incomeCats}
        showBudget={false}
        onSave={saveCategory}
        onDelete={onDelete}
      />
    </div>
  );
}

function CategoryTable({
  title,
  cats,
  showBudget,
  onSave,
  onDelete,
}: {
  title: string;
  cats: Category[];
  showBudget: boolean;
  onSave: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  if (cats.length === 0) return null;
  return (
    <div className="card p-4">
      <h3 className="mb-3 font-semibold text-slate-700">{title}</h3>
      <div className="space-y-2">
        {cats.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3">
            <span className="h-4 w-4 rounded-full" style={{ background: c.color }} />
            <input
              className="input max-w-[220px]"
              value={c.name}
              onChange={(e) => onSave({ ...c, name: e.target.value })}
            />
            {showBudget && (
              <label className="flex items-center gap-2 text-sm text-slate-500">
                Budget:
                <input
                  className="input w-32"
                  type="number"
                  min="0"
                  step="10"
                  value={c.budget || ''}
                  placeholder="0"
                  onChange={(e) => onSave({ ...c, budget: Number(e.target.value) || 0 })}
                />
                <span className="text-xs text-slate-400">
                  {c.budget ? `(${formatCurrency(c.budget)}/mese)` : 'nessuno'}
                </span>
              </label>
            )}
            <button
              className="btn-ghost ml-auto !px-2 !py-1 text-red-500"
              onClick={() => onDelete(c)}
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
