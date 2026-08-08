// Calcolo dell'hash usato per riconoscere i movimenti duplicati in import.

/**
 * L'hash combina data, importo e una versione normalizzata della descrizione.
 * Due movimenti con stessa data, importo e descrizione sono considerati duplicati.
 */
export function computeDedupHash(
  date: string,
  amount: number,
  description: string,
): string {
  const normDesc = description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const base = `${date}|${amount.toFixed(2)}|${normDesc}`;

  // Hash deterministico (djb2) — sufficiente per il confronto locale.
  let hash = 5381;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 33) ^ base.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
