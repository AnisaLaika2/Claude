// Generazione automatica dei movimenti ricorrenti (abbonamenti, bollette...).

import type { Recurring, Transaction } from '../types';
import { computeDedupHash } from './dedup';
import { uid } from './format';

/**
 * Per ogni ricorrenza attiva genera i movimenti mancanti dall'ultima data
 * generata fino al mese corrente incluso. Restituisce i nuovi movimenti
 * e le ricorrenze aggiornate (con lastGenerated aggiornato).
 */
export function generateDueTransactions(
  recurrings: Recurring[],
  today = new Date(),
): { transactions: Transaction[]; updated: Recurring[] } {
  const transactions: Transaction[] = [];
  const updated: Recurring[] = [];
  const currentYM = today.toISOString().slice(0, 7);

  for (const r of recurrings) {
    if (!r.active) continue;

    // Punto di partenza: il mese successivo all'ultimo generato, oppure il mese corrente.
    let cursor = r.lastGenerated ? nextMonth(r.lastGenerated) : currentYM;
    let changed = false;
    let lastGenerated = r.lastGenerated;

    // Genera fino al mese corrente incluso (limite di sicurezza: 60 mesi).
    let guard = 0;
    while (cursor <= currentYM && guard < 60) {
      const day = String(Math.min(Math.max(r.dayOfMonth, 1), 28)).padStart(2, '0');
      const date = `${cursor}-${day}`;
      transactions.push({
        id: uid(),
        date,
        amount: r.amount,
        type: r.type,
        description: r.description,
        categoryId: r.categoryId,
        paymentMethod: r.paymentMethod,
        notes: 'Generato automaticamente',
        source: 'recurring',
        dedupHash: computeDedupHash(date, r.amount, r.description),
        createdAt: Date.now(),
      });
      lastGenerated = cursor;
      changed = true;
      cursor = nextMonth(cursor);
      guard++;
    }

    if (changed) {
      updated.push({ ...r, lastGenerated });
    }
  }

  return { transactions, updated };
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(y, m, 1); // m è già +1 grazie all'indice 0-based
  return date.toISOString().slice(0, 7);
}
