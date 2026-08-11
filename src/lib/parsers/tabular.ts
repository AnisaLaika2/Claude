// Parser per file tabellari: CSV e XLSX (SheetJS).
// Riconosce automaticamente la riga dei titoli anche quando l'estratto conto
// contiene righe di intestazione (periodo, intestatario, ecc.) prima della tabella.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { RawRow } from '../../types';

export interface TabularData {
  columns: string[];
  rows: RawRow[];
}

// Parole che di solito compaiono nella riga dei titoli di un estratto conto.
const HEADER_TOKENS = [
  'data', 'date', 'importo', 'amount', 'valore', 'operazione', 'operazioni',
  'descrizione', 'descrizion', 'dettagli', 'causale', 'valuta', 'dare',
  'avere', 'entrate', 'uscite', 'accredito', 'addebito', 'saldo', 'categoria',
  'contabilizzazione', 'conto', 'carta', 'movimento', 'transazione',
];

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Conta quante celle della riga assomigliano a un titolo di colonna. */
function headerScore(row: unknown[]): number {
  let score = 0;
  for (const cell of row) {
    const t = String(cell ?? '').toLowerCase().trim();
    if (!t) continue;
    if (HEADER_TOKENS.some((tok) => t.includes(tok))) score++;
  }
  return score;
}

/**
 * Converte una matrice di celle (array di array) in tabella con intestazioni,
 * individuando automaticamente la riga dei titoli.
 */
function matrixToTable(matrix: unknown[][]): TabularData {
  if (!matrix.length) return { columns: [], rows: [] };

  // Cerca la riga con più parole-chiave da titolo nelle prime 30 righe.
  let headerIdx = 0;
  let bestScore = 0;
  const limit = Math.min(matrix.length, 30);
  for (let i = 0; i < limit; i++) {
    const s = headerScore(matrix[i] || []);
    if (s > bestScore) {
      bestScore = s;
      headerIdx = i;
    }
  }
  // Se nessuna riga sembra un'intestazione, si assume la prima.
  if (bestScore < 2) headerIdx = 0;

  const rawHeaders = (matrix[headerIdx] || []).map((h) => String(h ?? '').trim());

  // Nomi di colonna univoci e non vuoti.
  const used = new Map<string, number>();
  const columns = rawHeaders.map((h, i) => {
    let name = h || `Colonna ${i + 1}`;
    const count = used.get(name);
    if (count) {
      used.set(name, count + 1);
      name = `${name} (${count + 1})`;
    } else {
      used.set(name, 1);
    }
    return name;
  });

  const rows: RawRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const arr = matrix[i] || [];
    if (!arr.some((c) => String(c ?? '').trim() !== '')) continue; // riga vuota
    const obj: RawRow = {};
    for (let c = 0; c < columns.length; c++) {
      obj[columns[c]] = String(arr[c] ?? '').trim();
    }
    rows.push(obj);
  }

  return { columns, rows };
}

async function parseCSV(file: File): Promise<TabularData> {
  const text = await readFileAsText(file);
  // header:false → otteniamo le righe grezze, poi individuiamo i titoli noi.
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
    delimitersToGuess: [',', ';', '\t', '|'],
  });
  if (result.errors.length && result.data.length === 0) {
    throw new Error(`Errore nella lettura del CSV: ${result.errors[0].message}`);
  }
  return matrixToTable(result.data as unknown[][]);
}

async function parseXLSX(file: File): Promise<TabularData> {
  const buffer = await readFileAsArrayBuffer(file);
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Il file Excel non contiene fogli.');
  const sheet = wb.Sheets[sheetName];
  // header:1 → matrice di celle; raw:false → date/numeri già formattati come testo.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  return matrixToTable(matrix as unknown[][]);
}

export async function parseTabular(file: File): Promise<TabularData> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCSV(file);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXLSX(file);
  }
  throw new Error('Formato tabellare non supportato.');
}
