// Impostazioni locali dell'app (salvate nel browser).

const BUDGET_START_DAY = 'gs_budget_start_day';

/** Giorno di inizio del "mese di budget" (1–28). 1 = mese solare. */
export function getBudgetStartDay(): number {
  const v = Number(localStorage.getItem(BUDGET_START_DAY));
  if (!v || v < 1 || v > 28) return 1;
  return Math.floor(v);
}

export function setBudgetStartDay(day: number): void {
  const d = Math.min(28, Math.max(1, Math.floor(day) || 1));
  localStorage.setItem(BUDGET_START_DAY, String(d));
}

// ---- Spese condivise (divisione con il partner) ----
const SHARED_PARTNER = 'gs_shared_partner';
const SHARED_MYSHARE = 'gs_shared_myshare';
const SHARED_INCOMING = 'gs_shared_incoming';

export interface SharedConfig {
  /** nome della persona con cui si dividono le spese (per le etichette) */
  partnerName: string;
  /** quota a mio carico, in percentuale 0–100 (il resto è del partner) */
  myShare: number;
  /** testo da cercare nei bonifici in arrivo del partner (es. "Luca Mercurio") */
  incomingName: string;
}

/** Configurazione della divisione delle spese condivise. Default: 50/50. */
export function getSharedConfig(): SharedConfig {
  const partnerName = localStorage.getItem(SHARED_PARTNER) || 'Compagno';
  const raw = Number(localStorage.getItem(SHARED_MYSHARE));
  const myShare = raw >= 0 && raw <= 100 ? raw : 50;
  const incomingName = localStorage.getItem(SHARED_INCOMING) ?? '';
  return { partnerName, myShare, incomingName };
}

export function setSharedConfig(cfg: SharedConfig): void {
  localStorage.setItem(SHARED_PARTNER, cfg.partnerName.trim() || 'Compagno');
  const s = Math.min(100, Math.max(0, Math.round(cfg.myShare) || 0));
  localStorage.setItem(SHARED_MYSHARE, String(s));
  localStorage.setItem(SHARED_INCOMING, cfg.incomingName.trim());
}

// Giorno di inizio del "mese" nella schermata Condivise, indipendente dalla home.
const SHARED_START_DAY = 'gs_shared_start_day';

/**
 * Giorno di inizio del mese per la sola schermata Condivise (1–28), oppure null
 * per seguire l'impostazione della home.
 */
export function getSharedStartDay(): number | null {
  const raw = localStorage.getItem(SHARED_START_DAY);
  if (raw === null || raw === '') return null;
  const v = Number(raw);
  if (!v || v < 1 || v > 28) return null;
  return Math.floor(v);
}

/** Imposta il giorno di inizio della schermata Condivise; null = come la home. */
export function setSharedStartDay(day: number | null): void {
  if (day === null) {
    localStorage.removeItem(SHARED_START_DAY);
    return;
  }
  const d = Math.min(28, Math.max(1, Math.floor(day) || 1));
  localStorage.setItem(SHARED_START_DAY, String(d));
}
