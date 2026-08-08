// Motore di categorizzazione automatica basato su regole.

import type { Rule } from '../types';

/** Restituisce l'id categoria della prima regola che corrisponde, o null. */
export function categorize(description: string, rules: Rule[]): string | null {
  const text = description.toLowerCase();
  // Regole ordinate per priorità decrescente.
  const ordered = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of ordered) {
    const pattern = rule.pattern.toLowerCase();
    if (!pattern) continue;
    switch (rule.match) {
      case 'contains':
        if (text.includes(pattern)) return rule.categoryId;
        break;
      case 'startsWith':
        if (text.startsWith(pattern)) return rule.categoryId;
        break;
      case 'equals':
        if (text.trim() === pattern) return rule.categoryId;
        break;
      case 'regex':
        try {
          if (new RegExp(rule.pattern, 'i').test(description)) {
            return rule.categoryId;
          }
        } catch {
          // regex non valida: la ignoriamo
        }
        break;
    }
  }
  return null;
}

/**
 * Suggerisce una parola chiave a partire da una descrizione, per proporre
 * la creazione automatica di una regola quando l'utente ricategorizza.
 */
export function suggestKeyword(description: string): string {
  const cleaned = description
    .replace(/[0-9]{2,}/g, ' ')
    .replace(/[^a-zA-Zàèéìòù\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter((w) => w.length >= 3);
  // La parola più lunga è di solito la più caratterizzante (es. il negozio).
  words.sort((a, b) => b.length - a.length);
  return (words[0] || description.trim().split(' ')[0] || '').toUpperCase();
}
