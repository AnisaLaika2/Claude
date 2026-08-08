// Modello dati dell'applicazione.

export type TxType = 'expense' | 'income';

export interface Transaction {
  id: string;
  /** Data in formato ISO yyyy-mm-dd */
  date: string;
  /** Importo sempre positivo; il segno è dato da `type`. */
  amount: number;
  type: TxType;
  description: string;
  /** id della categoria oppure null se non categorizzata */
  categoryId: string | null;
  paymentMethod: string;
  notes: string;
  /** origine del movimento */
  source: 'manual' | 'import' | 'recurring';
  /** hash usato per il rilevamento dei duplicati in importazione */
  dedupHash?: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  type: TxType;
  /** budget mensile (solo per le categorie di spesa), 0 = nessun budget */
  budget: number;
}

export type RuleMatch = 'contains' | 'startsWith' | 'equals' | 'regex';

export interface Rule {
  id: string;
  pattern: string;
  match: RuleMatch;
  categoryId: string;
  /** priorità: valore più alto = valutata prima */
  priority: number;
}

export interface Recurring {
  id: string;
  description: string;
  amount: number;
  type: TxType;
  categoryId: string | null;
  paymentMethod: string;
  /** giorno del mese (1-28) in cui generare il movimento */
  dayOfMonth: number;
  /** ultima data (yyyy-mm) per cui è stato generato il movimento */
  lastGenerated: string | null;
  active: boolean;
}

/** Profilo di mappatura colonne salvato per una banca. */
export interface ImportProfile {
  id: string;
  name: string;
  /** indice o nome colonna per ciascun campo */
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  /** colonna importo uscite separata (opzionale, alcune banche la usano) */
  debitColumn?: string;
  creditColumn?: string;
  /** formato data atteso, es. dd/mm/yyyy */
  dateFormat: string;
  /** separatore decimale usato dalla banca */
  decimalSeparator: ',' | '.';
}

/** Riga grezza estratta da un file importato prima della mappatura. */
export interface RawRow {
  [column: string]: string;
}

/** Transazione candidata all'importazione (dopo mappatura + categorizzazione). */
export interface StagedTransaction {
  tempId: string;
  date: string;
  amount: number;
  type: TxType;
  description: string;
  categoryId: string | null;
  dedupHash: string;
  duplicate: boolean;
  selected: boolean;
}
