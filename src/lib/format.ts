// Formattazione valuta e date in italiano.

const currencyFmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

export function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

/** Converte una data ISO (yyyy-mm-dd) nel formato gg/mm/aaaa. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Etichetta mese, es. "Agosto 2026" da "2026-08". */
export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  const label = date.toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Genera un id univoco compatibile con tutti i browser moderni. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
