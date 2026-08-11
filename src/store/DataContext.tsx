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
  Category,
  ImportProfile,
  Recurring,
  Rule,
  Transaction,
} from '../types';
import * as db from '../db/db';
import { generateDueTransactions } from '../lib/recurring';

interface DataContextValue {
  loading: boolean;
  transactions: Transaction[];
  categories: Category[];
  rules: Rule[];
  recurring: Recurring[];
  profiles: ImportProfile[];

  // transazioni
  saveTransaction: (t: Transaction) => Promise<void>;
  addTransactions: (list: Transaction[]) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  // categorie
  saveCategory: (c: Category) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;

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
  const [rules, setRules] = useState<Rule[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);

  async function reloadAll() {
    const [txs, cats, rls, recs, profs] = await Promise.all([
      db.getTransactions(),
      db.getCategories(),
      db.getRules(),
      db.getRecurring(),
      db.getProfiles(),
    ]);
    setTransactions(txs);
    setCategories(cats);
    setRules(rls);
    setRecurring(recs);
    setProfiles(profs);
  }

  useEffect(() => {
    (async () => {
      await db.ensureSeed();
      await reloadAll();

      // Genera automaticamente i movimenti ricorrenti dovuti.
      const recs = await db.getRecurring();
      const { transactions: newTx, updated } = generateDueTransactions(recs);
      if (newTx.length) {
        await db.bulkPutTransactions(newTx);
        for (const r of updated) await db.putRecurring(r);
        await reloadAll();
      }

      setLoading(false);
    })();
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      loading,
      transactions,
      categories,
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

      saveCategory: async (c) => {
        await db.putCategory(c);
        setCategories(await db.getCategories());
      },
      removeCategory: async (id) => {
        await db.deleteCategory(id);
        setCategories(await db.getCategories());
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
    [loading, transactions, categories, rules, recurring, profiles],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve essere usato dentro DataProvider');
  return ctx;
}
