// Store globale dell'app: carica i dati da IndexedDB in memoria e fornisce le
// azioni CRUD che aggiornano sia lo stato React sia il database locale.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Account,
  Category,
  CategoryGroup,
  ImportProfile,
  PlannedExpense,
  Recurring,
  Rule,
  SavingsGoal,
  Transaction,
} from '../types';
import * as db from '../db/db';

interface DataContextValue {
  loading: boolean;
  transactions: Transaction[];
  categories: Category[];
  groups: CategoryGroup[];
  accounts: Account[];
  planned: PlannedExpense[];
  savings: SavingsGoal[];
  rules: Rule[];
  recurring: Recurring[];
  profiles: ImportProfile[];

  // transazioni
  saveTransaction: (t: Transaction) => Promise<void>;
  addTransactions: (list: Transaction[]) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  /** Sostituisce i movimenti importati nel periodo [from,to] con quelli nuovi. */
  replaceImportedRange: (from: string, to: string, list: Transaction[]) => Promise<void>;

  // categorie
  saveCategory: (c: Category) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;

  // gruppi (macro-categorie)
  saveGroup: (g: CategoryGroup) => Promise<void>;
  removeGroup: (id: string) => Promise<void>;

  // conti (saldi)
  saveAccount: (a: Account) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;

  // spese in programma
  savePlanned: (p: PlannedExpense) => Promise<void>;
  removePlanned: (id: string) => Promise<void>;

  // obiettivi di risparmio
  saveSavings: (g: SavingsGoal) => Promise<void>;
  removeSavings: (id: string) => Promise<void>;

  // regole
  saveRule: (r: Rule) => Promise<void>;
  removeRule: (id: string) => Promise<void>;

  // ricorrenti
  saveRecurring: (r: Recurring) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;

  // profili import
  saveProfile: (p: ImportProfile) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;

  reloadAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [planned, setPlanned] = useState<PlannedExpense[]>([]);
  const [savings, setSavings] = useState<SavingsGoal[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);

  async function reloadAll() {
    const [txs, cats, grps, accs, plan, sav, rls, recs, profs] = await Promise.all([
      db.getTransactions(),
      db.getCategories(),
      db.getGroups(),
      db.getAccounts(),
      db.getPlanned(),
      db.getSavings(),
      db.getRules(),
      db.getRecurring(),
      db.getProfiles(),
    ]);
    setTransactions(txs);
    setCategories(cats);
    setGroups(grps);
    setAccounts(accs);
    setPlanned(plan);
    setSavings(sav);
    setRules(rls);
    setRecurring(recs);
    setProfiles(profs);
  }

  useEffect(() => {
    (async () => {
      try {
        await db.ensureSeed();
        await db.ensureGroupsMigration();
        // Le ricorrenti ora sono solo previsione: rimuovo i movimenti generati
        // in passato che falsavano i totali.
        await db.removeGeneratedRecurring();
        await reloadAll();
      } catch (err) {
        // Non lasciare l'app bloccata sul caricamento in caso di errore.
        console.error('Errore inizializzazione dati:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      loading,
      transactions,
      categories,
      groups,
      accounts,
      planned,
      savings,
      rules,
      recurring,
      profiles,

      saveTransaction: async (t) => {
        await db.putTransaction(t);
        // Aggiorna in memoria senza rileggere tutto il database (più veloce).
        setTransactions((prev) => {
          const i = prev.findIndex((x) => x.id === t.id);
          if (i === -1) return [...prev, t];
          const copy = prev.slice();
          copy[i] = t;
          return copy;
        });
      },
      addTransactions: async (list) => {
        await db.bulkPutTransactions(list);
        setTransactions((prev) => [...prev, ...list]);
      },
      removeTransaction: async (id) => {
        await db.deleteTransaction(id);
        setTransactions((prev) => prev.filter((x) => x.id !== id));
      },
      replaceImportedRange: async (from, to, list) => {
        await db.deleteImportedInRange(from, to);
        await db.bulkPutTransactions(list);
        setTransactions(await db.getTransactions());
      },

      saveCategory: async (c) => {
        await db.putCategory(c);
        setCategories(await db.getCategories());
      },
      removeCategory: async (id) => {
        await db.deleteCategory(id);
        setCategories(await db.getCategories());
      },

      saveGroup: async (g) => {
        await db.putGroup(g);
        setGroups(await db.getGroups());
      },
      removeGroup: async (id) => {
        await db.deleteGroup(id);
        // deleteGroup stacca le categorie: ricarico entrambi.
        setGroups(await db.getGroups());
        setCategories(await db.getCategories());
      },

      saveAccount: async (a) => {
        await db.putAccount(a);
        setAccounts(await db.getAccounts());
      },
      removeAccount: async (id) => {
        await db.deleteAccount(id);
        setAccounts(await db.getAccounts());
      },

      savePlanned: async (p) => {
        await db.putPlanned(p);
        setPlanned(await db.getPlanned());
      },
      removePlanned: async (id) => {
        await db.deletePlanned(id);
        setPlanned(await db.getPlanned());
      },

      saveSavings: async (g) => {
        await db.putSavings(g);
        setSavings(await db.getSavings());
      },
      removeSavings: async (id) => {
        await db.deleteSavings(id);
        setSavings(await db.getSavings());
      },

      saveRule: async (r) => {
        await db.putRule(r);
        setRules(await db.getRules());
      },
      removeRule: async (id) => {
        await db.deleteRule(id);
        setRules(await db.getRules());
      },

      saveRecurring: async (r) => {
        await db.putRecurring(r);
        setRecurring(await db.getRecurring());
      },
      removeRecurring: async (id) => {
        await db.deleteRecurring(id);
        setRecurring(await db.getRecurring());
      },

      saveProfile: async (p) => {
        await db.putProfile(p);
        setProfiles(await db.getProfiles());
      },
      removeProfile: async (id) => {
        await db.deleteProfile(id);
        setProfiles(await db.getProfiles());
      },

      reloadAll,
    }),
    [loading, transactions, categories, groups, accounts, planned, savings, rules, recurring, profiles],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve essere usato dentro DataProvider');
  return ctx;
}
