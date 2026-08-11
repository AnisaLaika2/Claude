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
