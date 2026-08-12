import { useState } from 'react';
import { useData } from './store/DataContext';
import Dashboard from './views/Dashboard';
import Transactions from './views/Transactions';
import ImportWizard from './views/ImportWizard';
import Categories from './views/Categories';
import Rules from './views/Rules';
import RecurringView from './views/Recurring';
import Planned from './views/Planned';
import Savings from './views/Savings';
import Settings from './views/Settings';
import Assistant from './views/Assistant';

type View =
  | 'dashboard'
  | 'assistant'
  | 'categories'
  | 'transactions'
  | 'import'
  | 'rules'
  | 'recurring'
  | 'planned'
  | 'savings'
  | 'settings';

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Riepilogo', icon: '📊' },
  { id: 'assistant', label: 'Assistente', icon: '🤖' },
  { id: 'categories', label: 'Categorie & Budget', icon: '🏷️' },
  { id: 'transactions', label: 'Movimenti', icon: '💳' },
  { id: 'import', label: 'Importa', icon: '📥' },
  { id: 'rules', label: 'Regole', icon: '⚙️' },
  { id: 'recurring', label: 'Ricorrenti', icon: '🔁' },
  { id: 'planned', label: 'In programma', icon: '📅' },
  { id: 'savings', label: 'Risparmi', icon: '🎯' },
  { id: 'settings', label: 'Backup', icon: '💾' },
];

export interface TxFilter {
  cat: string;
  month: string;
  nonce: number;
}

export default function App() {
  const { loading } = useData();
  const [view, setView] = useState<View>('dashboard');
  const [txFilter, setTxFilter] = useState<TxFilter>({ cat: 'all', month: 'all', nonce: 0 });

  // Apre la lista Movimenti filtrata (usata dal budget/grafici del Riepilogo).
  function openTransactions(cat: string, month: string) {
    setTxFilter((f) => ({ cat, month, nonce: f.nonce + 1 }));
    setView('transactions');
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Caricamento dati locali…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <header className="safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-2xl">👛</span>
          <h1 className="text-lg font-bold text-slate-800">Gestione Spese</h1>
          <span className="ml-auto hidden text-xs text-slate-400 sm:inline">
            App locale · i dati restano su questo dispositivo
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`btn whitespace-nowrap ${
                view === n.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-4">
        {view === 'dashboard' && (
          <Dashboard
            onOpenTransactions={openTransactions}
            onGoImport={() => setView('import')}
          />
        )}
        {view === 'assistant' && <Assistant />}
        {view === 'transactions' && <Transactions applyFilter={txFilter} />}
        {view === 'import' && <ImportWizard onDone={() => setView('transactions')} />}
        {view === 'categories' && <Categories />}
        {view === 'rules' && <Rules />}
        {view === 'recurring' && <RecurringView />}
        {view === 'planned' && <Planned />}
        {view === 'savings' && <Savings />}
        {view === 'settings' && <Settings />}
      </main>

      <footer className="safe-bottom px-4 py-6 text-center text-xs text-slate-400">
        Gestione Spese · Funziona completamente offline nel tuo browser
      </footer>
    </div>
  );
}
