// Parser per file tabellari: CSV e XLSX (SheetJS).

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { RawRow } from '../../types';

export interface TabularData {
  columns: string[];
  rows: RawRow[];
}

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

async function parseCSV(file: File): Promise<TabularData> {
  const text = await readFileAsText(file);
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    // Rileva automaticamente il separatore (virgola o punto e virgola).
    delimitersToGuess: [',', ';', '\t', '|'],
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length && result.data.length === 0) {
    throw new Error(`Errore nella lettura del CSV: ${result.errors[0].message}`);
  }
  const columns = result.meta.fields ?? [];
  return { columns, rows: result.data };
}

async function parseXLSX(file: File): Promise<TabularData> {
  const buffer = await readFileAsArrayBuffer(file);
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Il file Excel non contiene fogli.');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: '',
    raw: false, // mantiene i valori come stringhe formattate
  });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { columns, rows };
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
