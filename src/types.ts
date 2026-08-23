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
  /** se true è un giroconto/trasferimento: non conta nei totali di spese/entrate */
  excludeFromTotals?: boolean;
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
  /** budget mensile legacy (ora il budget è sul gruppo), 0 = nessuno */
  budget: number;
  /** macro-categoria (gruppo) di appartenenza, null se senza gruppo */
  groupId?: string | null;
  /** true se è una spesa condivisa (es. con il partner): appare nella schermata "Condivise" */
  shared?: boolean;
}

/** Conto/carta con il saldo attuale inserito manualmente dall'utente. */
export interface Account {
  id: string;
  name: string;
  /** saldo di base inserito dall'utente */
  balance: number;
  /** data (yyyy-mm-dd) a cui si riferisce il saldo: i movimenti successivi lo aggiornano */
  asOf?: string;
}

/** Macro-categoria: raggruppa più micro-categorie e porta il budget mensile. */
export interface CategoryGroup {
  id: string;
  name: string;
  color: string;
  type: TxType;
  /** budget mensile del gruppo (0 = nessuno) */
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

/** Spesa futura una-tantum con una scadenza (bollo, assicurazione, condominio...). */
export interface PlannedExpense {
  id: string;
  description: string;
  amount: number;
  /** data entro cui va pagata (yyyy-mm-dd) */
  dueDate: string;
  categoryId?: string | null;
  /** già pagata: esce dalle previsioni */
  paid?: boolean;
  notes?: string;
}

/** Obiettivo di risparmio: metti da parte fino a una certa cifra entro una data. */
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  /** data entro cui raggiungere l'obiettivo (yyyy-mm-dd) */
  targetDate: string;
  /** quanto è già stato accantonato */
  savedAmount: number;
  notes?: string;
}

/** Profilo di mappatura colonne salvato per una banca. */
export interface ImportProfile {
  id: string;
  name: string;
  /** indice o nome colonna per ciascun campo */
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  /** colonna con i dettagli, aggiunta alla descrizione (opzionale) */
  detailsColumn?: string;
  /** colonna con la categoria della banca (opzionale) */
  categoryColumn?: string;
  /** colonna "Conto o carta": se vuota, il movimento è della carta (opzionale) */
  accountColumn?: string;
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
  /** nome categoria letto dal file, da creare/associare in fase di import */
  fileCategory?: string;
  /** metodo/origine per questa riga (Conto o Carta), se rilevato dal file */
  paymentMethod?: string;
  /** giroconto (ricarica carta): escluso dai totali */
  excludeFromTotals?: boolean;
  dedupHash: string;
  duplicate: boolean;
  selected: boolean;
}
