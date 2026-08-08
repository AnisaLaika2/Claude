import { useState } from 'react';
import { useData } from '../store/DataContext';
import { EmptyState } from '../components/ui';
import type { Rule, RuleMatch, Transaction } from '../types';
import { uid } from '../lib/format';
import { categorize } from '../lib/categorize';

const MATCH_LABEL: Record<RuleMatch, string> = {
  contains: 'contiene',
  startsWith: 'inizia con',
  equals: 'è uguale a',
  regex: 'espressione regolare',
};

export default function Rules() {
  const {
    rules,
    categories,
    saveRule,
    removeRule,
    transactions,
    addTransactions,
  } = useData();

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const [pattern, setPattern] = useState('');
  const [match, setMatch] = useState<RuleMatch>('contains');
  const [categoryId, setCategoryId] = useState(expenseCats[0]?.id ?? '');

  const catById = new Map(categories.map((c) => [c.id, c]));

  function add() {
    if (!pattern.trim() || !categoryId) return;
    saveRule({
      id: uid(),
      pattern: pattern.trim(),
      match,
      categoryId,
      priority: 10,
    });
    setPattern('');
  }

  // Applica le regole ai movimenti di spesa ancora senza categoria.
  async function applyToUncategorized() {
    const updated: Transaction[] = [];
    for (const t of transactions) {
      if (t.type !== 'expense' || t.categoryId) continue;
      const cat = categorize(t.description, rules);
      if (cat) updated.push({ ...t, categoryId: cat });
    }
    if (updated.length === 0) {
      alert('Nessun movimento senza categoria corrisponde alle regole.');
      return;
    }
    await addTransactions(updated);
    alert(`Categorizzati automaticamente ${updated.length} movimenti.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Regole di categorizzazione</h2>
        <button className="btn-secondary ml-auto" onClick={applyToUncategorized}>
          Applica ai movimenti senza categoria
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Le regole assegnano automaticamente una categoria ai movimenti importati in
        base alla descrizione. Puoi anche crearle correggendo la categoria di un
        movimento nella sezione Movimenti.
      </p>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Nuova regola</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Se la descrizione</label>
            <select
              className="input"
              value={match}
              onChange={(e) => setMatch(e.target.value as RuleMatch)}
            >
              {Object.entries(MATCH_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="label">Testo / pattern</label>
            <input
              className="input"
              placeholder="Es. ESSELUNGA"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>
          <div>
            <label className="label">Assegna a categoria</label>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={add}>
            + Aggiungi
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState title="Nessuna regola definita." />
      ) : (
        <div className="card divide-y divide-slate-100">
          {rules.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              categoryName={catById.get(r.categoryId)?.name ?? '—'}
              categoryColor={catById.get(r.categoryId)?.color ?? '#94a3b8'}
              expenseCats={expenseCats}
              onSave={saveRule}
              onDelete={() => removeRule(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  categoryName,
  categoryColor,
  expenseCats,
  onSave,
  onDelete,
}: {
  rule: Rule;
  categoryName: string;
  categoryColor: string;
  expenseCats: { id: string; name: string }[];
  onSave: (r: Rule) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 text-sm">
      <span className="text-slate-500">{MATCH_LABEL[rule.match]}</span>
      <code className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
        {rule.pattern}
      </code>
      <span className="text-slate-400">→</span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full" style={{ background: categoryColor }} />
        <select
          className="input !py-1 !text-xs"
          value={rule.categoryId}
          onChange={(e) => onSave({ ...rule, categoryId: e.target.value })}
        >
          {expenseCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </span>
      <span className="sr-only">{categoryName}</span>
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-400">
          priorità
          <input
            className="input w-16 !py-1 !text-xs"
            type="number"
            value={rule.priority}
            onChange={(e) => onSave({ ...rule, priority: Number(e.target.value) || 0 })}
          />
        </label>
        <button className="btn-ghost !px-2 !py-1 text-red-500" onClick={onDelete}>
          🗑️
        </button>
      </div>
    </div>
  );
}
