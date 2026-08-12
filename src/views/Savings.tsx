import { useState } from 'react';
import { useData } from '../store/DataContext';
import { EmptyState } from '../components/ui';
import type { SavingsGoal } from '../types';
import { formatCurrency, formatDate, todayISO, uid } from '../lib/format';
import { parseAmount } from '../lib/parse-values';
import { monthsUntil } from './Planned';

export default function Savings() {
  const { savings, saveSavings, removeSavings } = useData();

  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [savedText, setSavedText] = useState('');

  function add() {
    const target = parseAmount(targetText, ',') ?? 0;
    const saved = parseAmount(savedText, ',') ?? 0;
    if (!name.trim() || !(target > 0) || !targetDate) {
      alert('Inserisci nome, importo obiettivo e data.');
      return;
    }
    saveSavings({
      id: uid(),
      name: name.trim(),
      targetAmount: target,
      targetDate,
      savedAmount: saved,
    });
    setName('');
    setTargetText('');
    setTargetDate('');
    setSavedText('');
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Obiettivi di risparmio 🎯</h2>
        <p className="mt-1 text-sm text-slate-500">
          Poni un traguardo (es. “a dicembre 2.000€ da parte”). Ti dico{' '}
          <strong>quanto mettere via ogni mese</strong> per arrivarci e vedi il progresso.
        </p>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Nuovo obiettivo</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome</label>
            <input
              className="input"
              placeholder="Es. Vacanza, Fondo emergenza, Auto nuova…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Obiettivo (€)</label>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="2000,00"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Entro il</label>
            <input
              className="input"
              type="date"
              min={todayISO()}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Già messi da parte (facoltativo)</label>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={savedText}
              onChange={(e) => setSavedText(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="btn-primary" onClick={add}>
            + Aggiungi obiettivo
          </button>
        </div>
      </div>

      {savings.length === 0 ? (
        <EmptyState title="Nessun obiettivo di risparmio." />
      ) : (
        <div className="space-y-3">
          {savings
            .slice()
            .sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1))
            .map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onSave={saveSavings}
                onDelete={() => removeSavings(g.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onSave,
  onDelete,
}: {
  goal: SavingsGoal;
  onSave: (g: SavingsGoal) => void;
  onDelete: () => void;
}) {
  const [savedText, setSavedText] = useState(
    goal.savedAmount ? String(goal.savedAmount).replace('.', ',') : '',
  );

  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const ratio = goal.targetAmount ? goal.savedAmount / goal.targetAmount : 0;
  const pct = Math.min(ratio * 100, 100);
  const reached = goal.savedAmount >= goal.targetAmount;
  const months = monthsUntil(goal.targetDate);
  const monthly = reached ? 0 : months > 0 ? remaining / months : remaining;
  const overdue = months === 0 && !reached;

  function commitSaved(raw: string) {
    setSavedText(raw);
    onSave({ ...goal, savedAmount: parseAmount(raw, ',') ?? 0 });
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">🎯</span>
        <span className="font-semibold text-slate-800">{goal.name}</span>
        {reached && <span className="badge bg-emerald-100 text-emerald-700">raggiunto 🎉</span>}
        {overdue && <span className="badge bg-red-100 text-red-700">scaduto</span>}
        <button
          className="btn-ghost ml-auto !px-2 !py-1 text-red-500"
          onClick={() => window.confirm('Eliminare questo obiettivo?') && onDelete()}
        >
          🗑️
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {formatCurrency(goal.savedAmount)} di {formatCurrency(goal.targetAmount)}
        </span>
        <span className="text-slate-400">entro il {formatDate(goal.targetDate)}</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Aggiorna messi da parte:</span>
          <input
            className="input w-32 text-right"
            type="text"
            inputMode="decimal"
            value={savedText}
            onChange={(e) => commitSaved(e.target.value)}
            placeholder="0,00"
          />
          <span className="text-slate-400">€</span>
        </label>
        {!reached && (
          <span className="ml-auto rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">
            {overdue
              ? `mancano ${formatCurrency(remaining)}`
              : `metti da parte ${formatCurrency(monthly)}/mese`}
          </span>
        )}
      </div>
    </div>
  );
}
