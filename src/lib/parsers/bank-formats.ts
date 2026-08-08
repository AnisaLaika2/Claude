// Parser per i formati bancari OFX e QIF, che contengono già i campi normalizzati.

export interface BankTransaction {
  date: string; // ISO yyyy-mm-dd
  amount: number; // con segno: negativo = uscita
  description: string;
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Estrae yyyy-mm-dd da una data OFX (yyyymmdd o yyyymmddhhmmss). */
function ofxDate(raw: string): string {
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : raw.trim();
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}>([^<\r\n]*)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

export function parseOFXText(text: string): BankTransaction[] {
  const transactions: BankTransaction[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/<\/STMTTRN>/i)[0];
    const dateRaw = tag(body, 'DTPOSTED');
    const amountRaw = tag(body, 'TRNAMT');
    const name = tag(body, 'NAME') || tag(body, 'MEMO') || tag(body, 'PAYEE');
    const amount = Number(amountRaw.replace(',', '.'));
    if (!dateRaw || Number.isNaN(amount)) continue;
    transactions.push({
      date: ofxDate(dateRaw),
      amount,
      description: name || 'Movimento',
    });
  }
  return transactions;
}

export function parseQIFText(text: string): BankTransaction[] {
  const transactions: BankTransaction[] = [];
  const entries = text.split(/^\^\s*$/m);
  for (const entry of entries) {
    const lines = entry.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let date = '';
    let amount = NaN;
    let payee = '';
    let memo = '';
    for (const line of lines) {
      const code = line[0];
      const val = line.slice(1).trim();
      switch (code) {
        case 'D': {
          // QIF usa spesso mm/dd/yyyy o dd/mm/yyyy — proviamo dd/mm/yyyy poi ISO.
          const parts = val.split(/[/.'\-]/).map((p) => p.trim());
          if (parts.length >= 3) {
            let [d, m, y] = parts;
            if (y.length === 2) y = '20' + y;
            date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          break;
        }
        case 'T':
        case 'U':
          amount = Number(val.replace(/\./g, '').replace(',', '.')) ||
            Number(val.replace(/,/g, ''));
          break;
        case 'P':
          payee = val;
          break;
        case 'M':
          memo = val;
          break;
      }
    }
    if (!date || Number.isNaN(amount)) continue;
    transactions.push({
      date,
      amount,
      description: payee || memo || 'Movimento',
    });
  }
  return transactions;
}

export async function parseBankFile(file: File): Promise<BankTransaction[]> {
  const name = file.name.toLowerCase();
  const text = await readText(file);
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
    return parseOFXText(text);
  }
  if (name.endsWith('.qif')) {
    return parseQIFText(text);
  }
  throw new Error('Formato bancario non supportato.');
}

export function isBankFormat(fileName: string): boolean {
  const n = fileName.toLowerCase();
  return n.endsWith('.ofx') || n.endsWith('.qfx') || n.endsWith('.qif');
}
