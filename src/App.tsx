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
  { id: 'categories', label: 'Categorie & Budget', icon: '🏷️' },
  { id: 'transactions', label: 'Movimenti', icon: '💳' },
  { id: 'assistant', label: 'Assistente', icon: '🤖' },
  { id: 'import', label: 'Importa', icon: '📥' },
  { id: 'savings', label: 'Risparmi', icon: '🎯' },
  { id: 'planned', label: 'In programma', icon: '📅' },
  { id: 'recurring', label: 'Ricorrenti', icon: '🔁' },
  { id: 'rules', label: 'Regole', icon: '⚙️' },
  { id: 'settings', label: 'Backup', icon: '💾' },
];

// Voci principali nella barra in basso; le altre stanno nel menù "Altro".
const PRIMARY: View[] = ['dashboard', 'categories', 'transactions', 'assistant'];

export interface TxFilter {
  cat: string;
  month: string;
  nonce: number;
}

export default function App() {
  const { loading } = useData();
  const [view, setView] = useState<View>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>({ cat: 'all', month: 'all', nonce: 0 });

  function openTransactions(cat: string, month: string) {
    setTxFilter((f) => ({ cat, month, nonce: f.nonce + 1 }));
    setView('transactions');
  }

  function go(v: View) {
    setView(v);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Caricamento dati locali…
      </div>
    );
  }

  const primaryItems = PRIMARY.map((id) => NAV.find((n) => n.id === id)!);
  const currentLabel = NAV.find((n) => n.id === view)?.label ?? '';
  const otherActive = !PRIMARY.includes(view);

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <header className="safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-2xl">👛</span>
          <h1 className="text-lg font-bold text-slate-800">Gestione Spese</h1>
          <span className="ml-auto text-sm font-medium text-slate-400">{currentLabel}</span>
        </div>
      </header>

      <main className="flex-1 p-4 pb-28">
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

      {/* Menù "Altro": tutte le sezioni da toccare (niente scorrimento). */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="safe-bottom w-full rounded-t-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <h2 className="mb-3 text-center text-sm font-semibold text-slate-500">
              Tutte le sezioni
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center text-xs ${
                    view === n.id
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {n.icon}
                  </span>
                  <span className="leading-tight">{n.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra di navigazione in basso */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-stretch">
          {primaryItems.map((n) => (
            <TabButton
              key={n.id}
              icon={n.icon}
              label={n.label}
              active={view === n.id}
              onClick={() => go(n.id)}
            />
          ))}
          <TabButton
            icon="⋯"
            label="Altro"
            active={otherActive || menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  // Etichette corte per la barra.
  const short = label.split(' ')[0];
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
        active ? 'text-brand-700' : 'text-slate-500'
      }`}
    >
      <span className="text-xl leading-none" aria-hidden>
        {icon}
      </span>
      <span className="leading-none">{short}</span>
    </button>
  );
}
