// Conversione dei valori grezzi (date e importi) provenienti dai rendiconti.

/**
 * Converte una stringa data secondo il formato indicato in ISO yyyy-mm-dd.
 * Formati supportati: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mm-yyyy, dd.mm.yyyy.
 */
export function parseDate(raw: string, format: string): string | null {
  if (!raw) return null;
  const value = raw.trim();

  // Formato ISO già pronto
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const parts = value.split(/[/.\-]/).map((p) => p.trim());
  if (parts.length < 3) return null;

  const fmt = format.toLowerCase();
  let day: string, month: string, year: string;

  if (fmt.startsWith('yyyy')) {
    [year, month, day] = parts;
  } else if (fmt.startsWith('mm')) {
    [month, day, year] = parts;
  } else {
    // default dd/mm/yyyy
    [day, month, year] = parts;
  }

  if (year && year.length === 2) year = '20' + year;
  const d = day.padStart(2, '0');
  const m = month.padStart(2, '0');

  const nd = Number(d);
  const nm = Number(m);
  const ny = Number(year);
  if (!ny || nm < 1 || nm > 12 || nd < 1 || nd > 31) return null;

  return `${year}-${m}-${d}`;
}

/**
 * Converte una stringa importo in numero, gestendo separatori italiani
 * (1.234,56) o inglesi (1,234.56) e simboli di valuta.
 */
export function parseAmount(raw: string, decimalSeparator: ',' | '.'): number | null {
  if (raw === undefined || raw === null) return null;
  let value = String(raw).trim();
  if (!value) return null;

  // Rimuove simboli di valuta e spazi (anche lo spazio unificatore)
  value = value.replace(/[€$£\s ]/g, '');

  // Gestione parentesi per i negativi, es. (150,00)
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
  }

  if (decimalSeparator === ',') {
    // migliaia = punto, decimali = virgola
    value = value.replace(/\./g, '').replace(',', '.');
  } else {
    // migliaia = virgola, decimali = punto
    value = value.replace(/,/g, '');
  }

  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}
