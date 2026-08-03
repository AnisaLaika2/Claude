"use client";

import { useEffect } from "react";
import { db, todayKey } from "@/lib/db";
import { daysUntil } from "@/lib/food";

// Registers the service worker and runs the local expiry-notification
// scheduler (7, 3, 1 and 0 days before each product's expiry).
export function PWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const timer = setTimeout(checkExpiries, 2500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

const THRESHOLDS = [7, 3, 1, 0];

async function checkExpiries() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const settings = await db.settings.get("app");
  if (settings && settings.notifExpiry === false) return;

  const items = await db.pantry.toArray();
  const today = todayKey();
  const notified: Record<string, boolean> = JSON.parse(localStorage.getItem("cibo-notified") || "{}");

  for (const item of items) {
    if (item.quantity <= 0 || !item.expiryDate) continue;
    const d = daysUntil(item.expiryDate);
    if (d === null || d < 0 || !THRESHOLDS.includes(d)) continue;
    const key = `${today}:${item.id}:${d}`;
    if (notified[key]) continue;
    notified[key] = true;

    const body =
      d === 0
        ? `${item.name} scade oggi! Usalo subito.`
        : d === 1
        ? `${item.name} scade domani.`
        : `${item.name} scade tra ${d} giorni.`;
    try {
      new Notification("Cibo · Scadenza in arrivo", { body, icon: "/icon.svg", tag: key });
    } catch {}
  }
  // Keep only today's keys to avoid unbounded growth.
  const pruned: Record<string, boolean> = {};
  for (const k of Object.keys(notified)) if (k.startsWith(today)) pruned[k] = true;
  localStorage.setItem("cibo-notified", JSON.stringify(pruned));
}
