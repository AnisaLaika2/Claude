// Notifiche locali per gli avvisi di budget (best-effort: dipende dal supporto
// del browser/PWA; su iPhone richiede l'app installata dalla schermata Home).

const ENABLED_KEY = 'gs_notifications_enabled';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1';
}

export function setNotificationsEnabled(v: boolean): void {
  localStorage.setItem(ENABLED_KEY, v ? '1' : '0');
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch {
    return false;
  }
}

export function showNotification(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: 'icon-192.png' });
  } catch {
    /* alcuni contesti richiedono il service worker: si ignora l'errore */
  }
}

// ---- Promemoria settimanale di importazione ----
const WEEKLY_KEY = 'gs_weekly_reminder_enabled';
const WEEK_MARK = 'gs_import_reminded_week';

export function weeklyReminderEnabled(): boolean {
  return localStorage.getItem(WEEKLY_KEY) === '1';
}
export function setWeeklyReminderEnabled(v: boolean): void {
  localStorage.setItem(WEEKLY_KEY, v ? '1' : '0');
}

/** Chiave della settimana ISO corrente (es. "2026-W33"). */
export function currentWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // lunedì = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // giovedì della settimana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Il promemoria è dovuto se è attivo e non è già stato mostrato questa settimana. */
export function importReminderDue(): boolean {
  if (!weeklyReminderEnabled()) return false;
  return localStorage.getItem(WEEK_MARK) !== currentWeekKey();
}
export function markImportReminded(): void {
  localStorage.setItem(WEEK_MARK, currentWeekKey());
}
