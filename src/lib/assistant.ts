// Assistente locale: analizza i movimenti sul dispositivo e risponde a domande
// in italiano (spese per negozio/categoria, risparmio, scenari di spesa...).
// Non usa servizi esterni: tutto avviene in locale, i dati non escono dal telefono.

import type {
  Account,
  Category,
  CategoryGroup,
  PlannedExpense,
  Recurring,
  Transaction,
} from '../types';
import { formatCurrency } from './format';
import { suggestKeyword } from './categorize';
import { accountBalance, budgetOverview, budgetStatus, countable } from './summary';

export interface AssistantContext {
  transactions: Transaction[];
  categories: Category[];
  groups: CategoryGroup[];
  accounts: Account[];
  recurring: Recurring[];
  planned: PlannedExpense[];
}

export interface AssistantAnswer {
  text: string;
  stats?: { label: string; value: string }[];
  list?: { label: string; value: string }[];
}

const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthStart(year: number, month0: number): Date {
  return new Date(year, month0, 1);
}
function monthsInWindow(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}

interface Window {
  from: string;
  to: string;
  label: string;
  cleaned: string;
}

/** Estrae il periodo dalla domanda e restituisce anche il testo ripulito. */
function parseWindow(q: string): Window {
  const now = new Date();
  const y = now.getFullYear();
  let cleaned = q;
  const strip = (re: RegExp) => {
    cleaned = cleaned.replace(re, ' ');
  };

  let m: RegExpMatchArray | null;

  if ((m = q.match(/ultim[oi]\s+(\d{1,2})\s+mes/))) {
    const n = Math.max(1, Math.min(60, Number(m[1])));
    strip(/ultim[oi]\s+\d{1,2}\s+mes\w*/);
    const start = monthStart(now.getFullYear(), now.getMonth() - (n - 1));
    return { from: iso(start), to: iso(now), label: `ultimi ${n} mesi`, cleaned };
  }
  if (/ultim[oi]\s+ann/.test(q) || /ultimi\s+12\s+mesi/.test(q)) {
    strip(/ultim[oi]\s+ann\w*/);
    const start = monthStart(now.getFullYear(), now.getMonth() - 11);
    return { from: iso(start), to: iso(now), label: 'ultimi 12 mesi', cleaned };
  }
  if (/mese scorso|scorso mese|mese passato/.test(q)) {
    strip(/(mese scorso|scorso mese|mese passato)/);
    const start = monthStart(y, now.getMonth() - 1);
    const end = new Date(y, now.getMonth(), 0);
    return { from: iso(start), to: iso(end), label: 'il mese scorso', cleaned };
  }
  if (/quest[o']?\s*mese|questo mese|in questo mese|nel mese/.test(q)) {
    strip(/(quest[o']?\s*mese|in questo mese|nel mese)/);
    const start = monthStart(y, now.getMonth());
    return { from: iso(start), to: iso(now), label: 'questo mese', cleaned };
  }
  if (/ann[o]?\s+scorso|scorso anno/.test(q)) {
    strip(/(ann[o]?\s+scorso|scorso anno)/);
    return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `nel ${y - 1}`, cleaned };
  }
  if (/quest[o']?\s*anno|quest'anno|questo anno/.test(q)) {
    strip(/(quest[o']?\s*anno|quest'anno|questo anno)/);
    return { from: `${y}-01-01`, to: iso(now), label: "quest'anno", cleaned };
  }
  if ((m = q.match(/\b(20\d{2})\b/))) {
    const yy = Number(m[1]);
    strip(/\b20\d{2}\b/);
    return { from: `${yy}-01-01`, to: `${yy}-12-31`, label: `nel ${yy}`, cleaned };
  }
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (new RegExp(`\\b${MONTH_NAMES[i]}\\b`).test(q)) {
      strip(new RegExp(MONTH_NAMES[i]));
      const start = monthStart(y, i);
      const end = new Date(y, i + 1, 0);
      return { from: iso(start), to: iso(end), label: `a ${MONTH_NAMES[i]}`, cleaned };
    }
  }

  // Predefinito: ultimi 6 mesi.
  const start = monthStart(now.getFullYear(), now.getMonth() - 5);
  return { from: iso(start), to: iso(now), label: 'ultimi 6 mesi', cleaned };
}

const STOPWORDS = new Set([
  'quanto', 'quanti', 'ho', 'hai', 'abbiamo', 'speso', 'spesa', 'spese', 'spendo',
  'pagato', 'pago', 'costato', 'costa', 'di', 'in', 'per', 'da', 'con', 'su',
  'presso', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'del', 'della',
  'dei', 'degli', 'delle', 'nel', 'nei', 'negli', 'nella', 'a', 'ad', 'e', 'ed',
  'soldi', 'euro', 'totale', 'mi', 'sono', 'stato', 'stati', 'quest', 'questo',
  'mese', 'anno', 'ultimi', 'ultimo', 'scorso', 'me', 'quanto?',
]);

function extractTarget(cleaned: string): string {
  return cleaned
    .replace(/[€?!.]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim();
}

function windowTxs(ctx: AssistantContext, w: Window): Transaction[] {
  return countable(ctx.transactions).filter((t) => t.date >= w.from && t.date <= w.to);
}

function amountFromQuery(q: string): number | null {
  const m = q.match(/(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)?/);
  if (!m) return null;
  let s = m[1].replace(/\s/g, '');
  // gestione separatori: l'ultimo tra , e . è decimale
  if (s.includes(',') && s.includes('.')) {
    const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const th = dec === ',' ? '.' : ',';
    s = s.split(th).join('').replace(dec, '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

// ---- Risposte ----

function spendAnswer(ctx: AssistantContext, q: string): AssistantAnswer {
  const w = parseWindow(q);
  const target = extractTarget(w.cleaned);
  const txs = windowTxs(ctx, w).filter((t) => t.type === 'expense');
  const months = monthsInWindow(w.from, w.to);

  if (!target) {
    const total = txs.reduce((s, t) => s + t.amount, 0);
    return {
      text: `Nel periodo "${w.label}" hai speso in totale ${formatCurrency(total)}.`,
      stats: [
        { label: 'Totale spese', value: formatCurrency(total) },
        { label: 'Media al mese', value: formatCurrency(total / months) },
        { label: 'Movimenti', value: String(txs.length) },
      ],
    };
  }

  // Corrisponde a un gruppo?
  const group = ctx.groups.find(
    (g) => g.name.toLowerCase().includes(target) || target.includes(g.name.toLowerCase()),
  );
  if (group) {
    const ids = new Set(
      ctx.categories.filter((c) => c.groupId === group.id).map((c) => c.id),
    );
    const sel = txs.filter((t) => t.categoryId && ids.has(t.categoryId));
    const total = sel.reduce((s, t) => s + t.amount, 0);
    return {
      text: `Nel gruppo "${group.name}" (${w.label}) hai speso ${formatCurrency(total)} in ${sel.length} movimenti.`,
      stats: [
        { label: 'Totale', value: formatCurrency(total) },
        { label: 'Media al mese', value: formatCurrency(total / months) },
      ],
      list: topMerchants(sel),
    };
  }

  // Corrisponde a una categoria?
  const cat = ctx.categories.find(
    (c) => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase()),
  );
  if (cat) {
    const sel = txs.filter((t) => t.categoryId === cat.id);
    const total = sel.reduce((s, t) => s + t.amount, 0);
    return {
      text: `Nella categoria "${cat.name}" (${w.label}) hai speso ${formatCurrency(total)} in ${sel.length} movimenti.`,
      stats: [
        { label: 'Totale', value: formatCurrency(total) },
        { label: 'Media al mese', value: formatCurrency(total / months) },
      ],
      list: topMerchants(sel),
    };
  }

  // Altrimenti: ricerca per negozio/testo nella descrizione.
  const sel = txs.filter((t) => t.description.toLowerCase().includes(target));
  const total = sel.reduce((s, t) => s + t.amount, 0);
  if (sel.length === 0) {
    return {
      text: `Non ho trovato spese con "${target}" nel periodo "${w.label}". Prova con un'altra parola (es. il nome del negozio) o un periodo diverso.`,
    };
  }
  return {
    text: `Con "${target}" (${w.label}) hai speso ${formatCurrency(total)} in ${sel.length} movimenti.`,
    stats: [
      { label: 'Totale', value: formatCurrency(total) },
      { label: 'Media al mese', value: formatCurrency(total / months) },
      { label: 'Movimenti', value: String(sel.length) },
    ],
    list: sel
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6)
      .map((t) => ({ label: `${t.date} · ${t.description}`.slice(0, 60), value: formatCurrency(t.amount) })),
  };
}

function topMerchants(txs: Transaction[]): { label: string; value: string }[] {
  const byKey = new Map<string, number>();
  for (const t of txs) {
    const k = suggestKeyword(t.description) || t.description.slice(0, 20);
    byKey.set(k, (byKey.get(k) ?? 0) + t.amount);
  }
  return [...byKey.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => ({ label: k, value: formatCurrency(v) }));
}

function adviceAnswer(ctx: AssistantContext, q: string): AssistantAnswer {
  const w = parseWindow(/ultim|mese|anno|20\d{2}/.test(q) ? q : q + ' ultimi 3 mesi');
  const txs = windowTxs(ctx, w).filter((t) => t.type === 'expense');
  const months = monthsInWindow(w.from, w.to);

  // Top gruppi per spesa media mensile.
  const groupOfCat = new Map<string, string>();
  for (const c of ctx.categories) if (c.groupId) groupOfCat.set(c.id, c.groupId);
  const byGroup = new Map<string, number>();
  for (const t of txs) {
    const g = t.categoryId ? groupOfCat.get(t.categoryId) : undefined;
    if (g) byGroup.set(g, (byGroup.get(g) ?? 0) + t.amount);
  }
  const gName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const topGroups = [...byGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, v]) => ({ label: gName.get(id) ?? 'Gruppo', value: `${formatCurrency(v / months)}/mese` }));

  const merchants = topMerchants(txs);

  // Gruppi oltre/vicino al budget nel mese corrente.
  const now = new Date();
  const cm = now.toISOString().slice(0, 7);
  const monthTxs = ctx.transactions.filter((t) => t.date.startsWith(cm));
  const bs = budgetStatus(monthTxs, ctx.categories, ctx.groups);
  const over = bs.filter((b) => b.ratio >= 1).map((b) => b.group.name);
  const near = bs.filter((b) => b.ratio >= 0.8 && b.ratio < 1).map((b) => b.group.name);

  const lines: string[] = [];
  lines.push(`Analisi su "${w.label}".`);
  if (topGroups[0]) {
    lines.push(
      `La voce più alta è "${topGroups[0].label}" (${topGroups[0].value}). Se la riduci del 10% risparmi circa ${formatCurrency((byGroup.get([...byGroup.entries()].sort((a, b) => b[1] - a[1])[0][0]) ?? 0) / months * 0.1)} al mese.`,
    );
  }
  if (over.length) lines.push(`Questo mese sei oltre budget in: ${over.join(', ')}.`);
  if (near.length) lines.push(`Ti stai avvicinando al budget in: ${near.join(', ')}.`);
  if (!over.length && !near.length && bs.length)
    lines.push('Sei dentro i budget questo mese: bene così! 👍');
  lines.push('Punta a ridurre le voci più alte qui sotto e le spese ripetute nei negozi ricorrenti.');

  return {
    text: lines.join('\n'),
    stats: topGroups,
    list: merchants,
  };
}

function scenarioAnswer(ctx: AssistantContext, q: string): AssistantAnswer {
  const extra = amountFromQuery(q) ?? 0;
  const now = new Date();
  const cm = now.toISOString().slice(0, 7);
  const monthTxs = ctx.transactions.filter((t) => t.date.startsWith(cm));
  const bs = budgetStatus(monthTxs, ctx.categories, ctx.groups);
  const ov = budgetOverview(bs);
  const accountsTotal = ctx.accounts.reduce(
    (s, a) => s + accountBalance(a, ctx.transactions),
    0,
  );
  const remainingAfter = ov.remaining - extra;
  const balanceAfter = accountsTotal - extra;

  // Gruppi con margine di budget (dove puoi ancora spendere / tagliare).
  const margin = bs
    .filter((b) => b.budget - b.spent > 0)
    .sort((a, b) => (b.budget - b.spent) - (a.budget - a.spent))
    .slice(0, 5)
    .map((b) => ({ label: b.group.name, value: `${formatCurrency(b.budget - b.spent)} liberi` }));

  const lines: string[] = [];
  lines.push(`Ipotesi: una spesa extra di ${formatCurrency(extra)}.`);
  if (ov.budget > 0) {
    lines.push(
      remainingAfter >= 0
        ? `Ti resterebbero ${formatCurrency(remainingAfter)} di budget questo mese: ci stai dentro.`
        : `Sforeresti il budget del mese di ${formatCurrency(-remainingAfter)}. Per rientrare, taglia da queste voci con margine (sotto) o rimanda la spesa.`,
    );
  }
  if (ctx.accounts.length > 0) {
    lines.push(
      balanceAfter >= 0
        ? `Il saldo scenderebbe a circa ${formatCurrency(balanceAfter)}.`
        : `Attenzione: il saldo andrebbe in negativo (${formatCurrency(balanceAfter)}).`,
    );
  }

  return {
    text: lines.join('\n'),
    stats: [
      { label: 'Budget rimanente dopo', value: formatCurrency(remainingAfter) },
      ...(ctx.accounts.length ? [{ label: 'Saldo dopo', value: formatCurrency(balanceAfter) }] : []),
    ],
    list: margin.length ? margin : undefined,
  };
}

function balanceAnswer(ctx: AssistantContext): AssistantAnswer {
  if (ctx.accounts.length === 0) {
    return {
      text: 'Non hai ancora impostato il saldo. Vai nel Riepilogo e inserisci il saldo dei tuoi conti/carte.',
    };
  }
  const total = ctx.accounts.reduce((s, a) => s + accountBalance(a, ctx.transactions), 0);
  return {
    text: `Il tuo saldo attuale stimato è ${formatCurrency(total)}.`,
    list: ctx.accounts.map((a) => ({
      label: a.name,
      value: formatCurrency(accountBalance(a, ctx.transactions)),
    })),
  };
}

function recurringAnswer(ctx: AssistantContext): AssistantAnswer {
  const active = ctx.recurring.filter((r) => r.active && r.type === 'expense');
  if (active.length === 0) {
    return { text: 'Non hai spese fisse ricorrenti impostate. Puoi aggiungerle nella sezione Ricorrenti.' };
  }
  const total = active.reduce((s, r) => s + r.amount, 0);
  return {
    text: `Le tue spese fisse mensili valgono ${formatCurrency(total)}.`,
    list: active
      .sort((a, b) => b.amount - a.amount)
      .map((r) => ({ label: `il ${r.dayOfMonth} · ${r.description}`, value: formatCurrency(r.amount) })),
  };
}

function plannedMonthsUntil(due: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = due.split('-').map(Number);
  const ms = new Date(y, m - 1, d).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

function plannedAnswer(ctx: AssistantContext): AssistantAnswer {
  const up = ctx.planned
    .filter((p) => !p.paid)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  if (up.length === 0) {
    return {
      text: 'Non hai spese in programma. Aggiungile nella sezione "In programma" (es. bollo, assicurazione, condominio).',
    };
  }
  const total = up.reduce((s, p) => s + p.amount, 0);
  const monthly = up.reduce((s, p) => {
    const m = plannedMonthsUntil(p.dueDate);
    return s + (m > 0 ? p.amount / m : 0);
  }, 0);
  return {
    text: `Hai ${formatCurrency(total)} di spese in programma. Per arrivarci pronta metti da parte circa ${formatCurrency(monthly)} al mese.`,
    stats: [
      { label: 'Totale in arrivo', value: formatCurrency(total) },
      { label: 'Da accantonare/mese', value: formatCurrency(monthly) },
    ],
    list: up.map((p) => ({
      label: `${p.description} (entro ${p.dueDate})`,
      value: formatCurrency(p.amount),
    })),
  };
}

function help(): AssistantAnswer {
  return {
    text: [
      'Posso rispondere analizzando i tuoi movimenti (tutto in locale). Prova a chiedermi:',
      '• "Quanto ho speso da Amazon negli ultimi 6 mesi?"',
      '• "Quanto ho speso in Trasporti questo mese?"',
      '• "Dove spendo di più? Come posso risparmiare?"',
      '• "Se ho una spesa extra di 300€, come sto a budget?"',
      '• "Quanto ho di spese fisse?"',
      '• "Qual è il mio saldo?"',
    ].join('\n'),
  };
}

export function runAssistant(query: string, ctx: AssistantContext): AssistantAnswer {
  const q = ' ' + query.toLowerCase().trim() + ' ';
  if (!query.trim()) return help();

  if (/risparmi|tagli|dove spendo|spendo di piu|spendo di più|come posso|consigl|ridurre|dove devo|meno soldi/.test(q)) {
    return adviceAnswer(ctx, q);
  }
  if (
    /(extra|aggiuntiv|in più|in piu|se spendo|se aggiungo|posso permett|mi posso permett|avr[òo]\s+(una|delle)?\s*spes)/.test(q) &&
    amountFromQuery(q) !== null
  ) {
    return scenarioAnswer(ctx, q);
  }
  if (/saldo|in banca|sul conto/.test(q)) return balanceAnswer(ctx);
  if (/in programma|spese future|future|accantonar|da pagare entro|scadenz|bollo|assicurazion|condominio/.test(q))
    return plannedAnswer(ctx);
  if (/spese fisse|ricorrent|abbonament|fiss[ao]/.test(q)) return recurringAnswer(ctx);
  if (/speso|spesa|spese|pagato|pago|costa|quanto/.test(q)) return spendAnswer(ctx, q);

  return help();
}
