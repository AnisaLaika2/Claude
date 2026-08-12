// Livello di persistenza locale basato su IndexedDB (libreria idb).
// Tutti i dati restano sul dispositivo dell'utente: nessuna chiamata di rete.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Account,
  Category,
  CategoryGroup,
  ImportProfile,
  PlannedExpense,
  Recurring,
  Rule,
  Transaction,
} from '../types';
import { uid } from '../lib/format';

interface SpeseDB extends DBSchema {
  transactions: { key: string; value: Transaction; indexes: { byDate: string } };
  categories: { key: string; value: Category };
  groups: { key: string; value: CategoryGroup };
  accounts: { key: string; value: Account };
  planned: { key: string; value: PlannedExpense };
  rules: { key: string; value: Rule };
  recurring: { key: string; value: Recurring };
  profiles: { key: string; value: ImportProfile };
}

const DB_NAME = 'gestione-spese';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<SpeseDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SpeseDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpeseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Idempotente: crea solo gli store mancanti (nuovi utenti o upgrade).
        if (!db.objectStoreNames.contains('transactions')) {
          const tx = db.createObjectStore('transactions', { keyPath: 'id' });
          tx.createIndex('byDate', 'date');
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('planned')) {
          db.createObjectStore('planned', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('rules')) {
          db.createObjectStore('rules', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recurring')) {
          db.createObjectStore('recurring', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ---- Categorie predefinite (create al primo avvio) ----
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Alimentari', color: '#22c55e', type: 'expense', budget: 400 },
  { name: 'Trasporti', color: '#3b82f6', type: 'expense', budget: 150 },
  { name: 'Casa', color: '#f59e0b', type: 'expense', budget: 800 },
  { name: 'Bollette', color: '#ef4444', type: 'expense', budget: 200 },
  { name: 'Svago', color: '#a855f7', type: 'expense', budget: 150 },
  { name: 'Salute', color: '#ec4899', type: 'expense', budget: 100 },
  { name: 'Ristoranti', color: '#14b8a6', type: 'expense', budget: 150 },
  { name: 'Shopping', color: '#f97316', type: 'expense', budget: 100 },
  { name: 'Stipendio', color: '#10b981', type: 'income', budget: 0 },
  { name: 'Altre entrate', color: '#06b6d4', type: 'income', budget: 0 },
];

export async function ensureSeed(): Promise<void> {
  const db = await getDB();
  const count = await db.count('categories');
  if (count === 0) {
    const tx = db.transaction('categories', 'readwrite');
    for (const c of DEFAULT_CATEGORIES) {
      await tx.store.add({ ...c, id: uid() });
    }
    await tx.done;
  }
}

/**
 * Migrazione una-tantum: se non esistono ancora gruppi ma alcune categorie
 * hanno un budget, crea un gruppo (macro-categoria) per ciascuna e vi sposta la
 * categoria, spostando il budget sul gruppo. Così i budget esistenti non si
 * perdono e l'utente ha già delle macro-categorie di partenza.
 */
export async function ensureGroupsMigration(): Promise<void> {
  const db = await getDB();
  const groupCount = await db.count('groups');
  if (groupCount > 0) return;

  const categories = await db.getAll('categories');
  const budgeted = categories.filter((c) => c.type === 'expense' && c.budget > 0);
  if (budgeted.length === 0) return;

  const tx = db.transaction(['groups', 'categories'], 'readwrite');
  for (const c of budgeted) {
    const groupId = uid();
    await tx.objectStore('groups').put({
      id: groupId,
      name: c.name,
      color: c.color,
      type: 'expense',
      budget: c.budget,
    });
    await tx.objectStore('categories').put({ ...c, groupId, budget: 0 });
  }
  await tx.done;
}

// ---- Transazioni ----
export async function getTransactions(): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAll('transactions');
}
export async function putTransaction(t: Transaction): Promise<void> {
  const db = await getDB();
  await db.put('transactions', t);
}
export async function bulkPutTransactions(list: Transaction[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('transactions', 'readwrite');
  for (const t of list) await tx.store.put(t);
  await tx.done;
}
export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('transactions', id);
}
export async function clearTransactions(): Promise<void> {
  const db = await getDB();
  await db.clear('transactions');
}
/**
 * Rimuove i movimenti generati automaticamente dalle spese ricorrenti.
 * Le ricorrenti ora servono solo per la previsione e non creano più movimenti.
 */
export async function removeGeneratedRecurring(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('transactions', 'readwrite');
  let removed = 0;
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.source === 'recurring') {
      await cursor.delete();
      removed++;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return removed;
}

// ---- Categorie ----
export async function getCategories(): Promise<Category[]> {
  const db = await getDB();
  return db.getAll('categories');
}
export async function putCategory(c: Category): Promise<void> {
  const db = await getDB();
  await db.put('categories', c);
}
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('categories', id);
}

// ---- Gruppi (macro-categorie) ----
export async function getGroups(): Promise<CategoryGroup[]> {
  const db = await getDB();
  return db.getAll('groups');
}
export async function putGroup(g: CategoryGroup): Promise<void> {
  const db = await getDB();
  await db.put('groups', g);
}
/** Elimina un gruppo e stacca le categorie che vi appartenevano. */
export async function deleteGroup(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['groups', 'categories'], 'readwrite');
  await tx.objectStore('groups').delete(id);
  const cats = await tx.objectStore('categories').getAll();
  for (const c of cats) {
    if (c.groupId === id) {
      await tx.objectStore('categories').put({ ...c, groupId: null });
    }
  }
  await tx.done;
}

// ---- Conti (saldi) ----
export async function getAccounts(): Promise<Account[]> {
  const db = await getDB();
  return db.getAll('accounts');
}
export async function putAccount(a: Account): Promise<void> {
  const db = await getDB();
  await db.put('accounts', a);
}
export async function deleteAccount(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('accounts', id);
}

// ---- Spese in programma ----
export async function getPlanned(): Promise<PlannedExpense[]> {
  const db = await getDB();
  return db.getAll('planned');
}
export async function putPlanned(p: PlannedExpense): Promise<void> {
  const db = await getDB();
  await db.put('planned', p);
}
export async function deletePlanned(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('planned', id);
}

// ---- Regole ----
export async function getRules(): Promise<Rule[]> {
  const db = await getDB();
  return db.getAll('rules');
}
export async function putRule(r: Rule): Promise<void> {
  const db = await getDB();
  await db.put('rules', r);
}
export async function deleteRule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('rules', id);
}

// ---- Movimenti ricorrenti ----
export async function getRecurring(): Promise<Recurring[]> {
  const db = await getDB();
  return db.getAll('recurring');
}
export async function putRecurring(r: Recurring): Promise<void> {
  const db = await getDB();
  await db.put('recurring', r);
}
export async function deleteRecurring(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('recurring', id);
}

// ---- Profili di importazione ----
export async function getProfiles(): Promise<ImportProfile[]> {
  const db = await getDB();
  return db.getAll('profiles');
}
export async function putProfile(p: ImportProfile): Promise<void> {
  const db = await getDB();
  await db.put('profiles', p);
}
export async function deleteProfile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('profiles', id);
}

// ---- Backup / ripristino ----
export interface BackupData {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  categories: Category[];
  groups?: CategoryGroup[];
  accounts?: Account[];
  planned?: PlannedExpense[];
  rules: Rule[];
  recurring: Recurring[];
  profiles: ImportProfile[];
}

export async function exportAll(): Promise<BackupData> {
  const [transactions, categories, groups, accounts, planned, rules, recurring, profiles] =
    await Promise.all([
      getTransactions(),
      getCategories(),
      getGroups(),
      getAccounts(),
      getPlanned(),
      getRules(),
      getRecurring(),
      getProfiles(),
    ]);
  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    transactions,
    categories,
    groups,
    accounts,
    planned,
    rules,
    recurring,
    profiles,
  };
}

export async function importAll(data: BackupData): Promise<void> {
  const db = await getDB();
  const stores = ['transactions', 'categories', 'groups', 'accounts', 'planned', 'rules', 'recurring', 'profiles'] as const;
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  for (const t of data.transactions ?? []) await tx.objectStore('transactions').put(t);
  for (const c of data.categories ?? []) await tx.objectStore('categories').put(c);
  for (const g of data.groups ?? []) await tx.objectStore('groups').put(g);
  for (const a of data.accounts ?? []) await tx.objectStore('accounts').put(a);
  for (const p of data.planned ?? []) await tx.objectStore('planned').put(p);
  for (const r of data.rules ?? []) await tx.objectStore('rules').put(r);
  for (const r of data.recurring ?? []) await tx.objectStore('recurring').put(r);
  for (const p of data.profiles ?? []) await tx.objectStore('profiles').put(p);
  await tx.done;
}
