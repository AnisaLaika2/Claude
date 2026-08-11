// Conversione dei valori grezzi (date e importi) provenienti dai rendiconti.

// Abbreviazioni dei mesi (italiano e inglese) per date testuali tipo "11 ago 2026".
const MONTHS: Record<string, number> = {
  gen: 1, gennaio: 1, jan: 1, january: 1,
  feb: 2, febbraio: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  apr: 4, aprile: 4, april: 4,
  mag: 5, maggio: 5, may: 5,
  giu: 6, giugno: 6, jun: 6, june: 6,
  lug: 7, luglio: 7, jul: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, settembre: 9, sett: 9, sep: 9, sept: 9, september: 9,
  ott: 10, ottobre: 10, oct: 10, october: 10,
  nov: 11, novembre: 11, november: 11,
  dic: 12, dicembre: 12, dec: 12, december: 12,
};

function monthToNumber(token: string): number | null {
  const t = token.toLowerCase().replace(/\./g, '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (MONTHS[t] != null) return MONTHS[t];
  // prova con le prime 3 lettere (es. "ago" da "agosto")
  const short = t.slice(0, 3);
  return MONTHS[short] ?? null;
}

/**
 * Converte una stringa data in ISO yyyy-mm-dd.
 * Gestisce separatori / . - e spazi, anni a 2 cifre, mesi testuali (ago, lug…)
 * e date ISO con orario. `format` indica solo l'ordine giorno/mese/anno.
 */
export function parseDate(raw: string, format: string): string | null {
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  // Formato ISO già pronto (eventualmente con orario)
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const parts = value.split(/[/.\-\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const fmt = format.toLowerCase();
  let dayS: string, monthS: string, yearS: string;

  if (fmt.startsWith('yyyy')) {
    [yearS, monthS, dayS] = parts;
  } else if (fmt.startsWith('mm')) {
    [monthS, dayS, yearS] = parts;
  } else {
    // default dd/mm/yyyy
    [dayS, monthS, yearS] = parts;
  }

  let year = yearS;
  if (year && year.length === 2) year = '20' + year;

  const nd = Number(dayS);
  const nm = monthToNumber(monthS);
  const ny = Number(year);
  if (!ny || nm == null || nm < 1 || nm > 12 || !(nd >= 1 && nd <= 31)) return null;

  const d = String(nd).padStart(2, '0');
  const m = String(nm).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Converte una stringa importo in numero.
 *
 * Riconosce automaticamente il separatore decimale osservando il valore:
 * - se ci sono sia "." sia ",", l'ultimo che compare è il separatore decimale
 *   (es. 1.234,56 → 1234.56 ; 1,234.56 → 1234.56);
 * - se ce n'è uno solo, due cifre finali indicano i decimali, tre le migliaia.
 * `decimalSeparator` è usato solo come ripiego nei casi ambigui.
 */
export function parseAmount(raw: string, decimalSeparator: ',' | '.'): number | null {
  if (raw === undefined || raw === null) return null;
  let value = String(raw).trim();
  if (!value) return null;

  // Rimuove simboli di valuta e spazi (incluso lo spazio unificatore).
  value = value.replace(/[€$£\s ]/g, '');
  // Sigle valuta testuali a fine stringa (EUR, USD…)
  value = value.replace(/(eur|usd|gbp|chf)$/i, '');

  // Normalizza i vari caratteri "meno" usati dalle banche (segno matematico −,
  // trattini lunghi, meno a tutta larghezza) nel trattino ASCII.
  value = value.replace(/[−‒–—﹣－]/g, '-');

  // Gestione del segno per i negativi: parentesi (150,00), meno iniziale -150,00
  // oppure meno finale 150,00- (usato da alcuni estratti conto).
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  } else if (value.endsWith('-')) {
    negative = true;
    value = value.slice(0, -1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
  }

  // Tiene solo cifre e separatori.
  value = value.replace(/[^\d.,]/g, '');
  if (!value) return null;

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  let normalized: string;
  if (hasComma && hasDot) {
    // L'ultimo separatore che compare è quello decimale.
    const decSep = value.lastIndexOf(',') > value.lastIndexOf('.') ? ',' : '.';
    const thouSep = decSep === ',' ? '.' : ',';
    normalized = value.split(thouSep).join('').replace(decSep, '.');
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const segments = value.split(sep);
    if (segments.length > 2) {
      // separatore ripetuto (es. 1.234.567) → sono migliaia
      normalized = segments.join('');
    } else {
      const last = segments[1];
      if (last.length === 3 && sep !== decimalSeparator) {
        // esattamente 3 cifre e NON è il separatore decimale indicato → migliaia
        // (es. 1.234 → 1234). La valuta ha al massimo 2 decimali.
        normalized = segments.join('');
      } else {
        // decimale: 1 o 2 cifre (es. "54.3" = 54,30 dai numeri Excel, "10,5"),
        // oppure molte cifre (arrotondamenti in virgola mobile), oppure 3 cifre
        // se è proprio il separatore decimale scelto.
        normalized = segments[0] + '.' + last;
      }
    }
  } else {
    normalized = value;
  }

  const n = Number(normalized);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}
