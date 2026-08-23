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

export interface SharedConfig {
  /** nome della persona con cui si dividono le spese (per le etichette) */
  partnerName: string;
  /** quota a mio carico, in percentuale 0–100 (il resto è del partner) */
  myShare: number;
}

/** Configurazione della divisione delle spese condivise. Default: 50/50. */
export function getSharedConfig(): SharedConfig {
  const partnerName = localStorage.getItem(SHARED_PARTNER) || 'Compagno';
  const raw = Number(localStorage.getItem(SHARED_MYSHARE));
  const myShare = raw >= 0 && raw <= 100 ? raw : 50;
  return { partnerName, myShare };
}

export function setSharedConfig(cfg: SharedConfig): void {
  localStorage.setItem(SHARED_PARTNER, cfg.partnerName.trim() || 'Compagno');
  const s = Math.min(100, Math.max(0, Math.round(cfg.myShare) || 0));
  localStorage.setItem(SHARED_MYSHARE, String(s));
}
