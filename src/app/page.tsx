"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayKey } from "@/lib/db";
import { CATEGORY_META, expiryStatus, daysUntil, fmtQty } from "@/lib/food";
import { recipeMatchScore } from "@/lib/actions";
import { fmtRelative, fmtMoney } from "@/lib/format";
import { Ring, SectionHeader, EmptyState } from "@/components/ui";
import {
  IconScan, IconChef, IconCart, IconSpark, IconChevron, IconFlame, IconLeaf, IconWarning,
} from "@/components/icons";

export default function HomePage() {
  const pantry = useLiveQuery(() => db.pantry.toArray(), [], undefined);
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], []);
  const consumption = useLiveQuery(
    () => db.consumption.where("date").equals(todayKey()).toArray(),
    [],
    []
  );
  const waste = useLiveQuery(() => db.waste.toArray(), [], []);
  const profile = useLiveQuery(() => db.profile.get("me"), [], undefined);

  if (!pantry) return null;

  const active = pantry.filter((p) => p.quantity > 0);
  const expiring = active
    .filter((p) => {
      const s = expiryStatus(p.expiryDate);
      return s === "expired" || s === "critical" || s === "soon";
    })
    .sort((a, b) => (daysUntil(a.expiryDate) ?? 99) - (daysUntil(b.expiryDate) ?? 99));

  const todayKcal = consumption.reduce((s, c) => s + (c.nutrition?.kcal || 0), 0);
  const targetKcal = profile?.targetKcal || 2000;
  const savedTotal = waste.reduce((s, w) => s + 0, 0);
  const moneySaved = consumption.reduce((s, c) => s + (c.savedValue || 0), 0);
  const wastedMoney = waste.reduce((s, w) => s + w.estValue, 0);

  // Recipe suggestions prioritising expiring ingredients
  const expiringNames = new Set(expiring.map((e) => e.name.toLowerCase()));
  const suggestions = [...recipes]
    .map((r) => {
      const score = recipeMatchScore(r, active);
      const usesExpiring = r.ingredients.some((i) =>
        [...expiringNames].some((n) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase()))
      );
      return { r, score: score + (usesExpiring ? 0.5 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">{greet} 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">La tua cucina</h1>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2.5">
        <QuickAction href="/scan" icon={<IconScan />} label="Scansiona" />
        <QuickAction href="/recipes" icon={<IconChef />} label="Ricette AI" />
        <QuickAction href="/shopping" icon={<IconCart />} label="Spesa" />
        <QuickAction href="/assistant" icon={<IconSpark />} label="Assistente" />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <Ring value={targetKcal ? (todayKcal / targetKcal) * 100 : 0} label={`${Math.round(todayKcal)}`} sublabel="kcal" size={58} stroke={6} />
          <div>
            <p className="text-xs text-muted">Oggi</p>
            <p className="text-sm font-bold">di {targetKcal}</p>
          </div>
        </div>
        <StatCard icon={<IconWarning />} color="var(--warning)" value={String(expiring.length)} label="In scadenza" />
        <StatCard icon={<IconLeaf />} color="var(--success)" value={fmtMoney(moneySaved)} label="Risparmiati" />
        <StatCard icon={<IconFlame />} color="var(--danger)" value={fmtMoney(wastedMoney)} label="Sprecati" />
      </div>

      {/* Expiring soon */}
      <section>
        <SectionHeader
          title="Da consumare presto"
          action={<Link href="/pantry" className="text-sm font-medium text-brand">Dispensa</Link>}
        />
        {expiring.length === 0 ? (
          <EmptyState title="Tutto sotto controllo" subtitle="Nessun prodotto sta per scadere. Continua così!" />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {expiring.slice(0, 8).map((item) => {
              const status = expiryStatus(item.expiryDate);
              const color = status === "expired" || status === "critical" ? "var(--danger)" : "var(--warning)";
              return (
                <div key={item.id} className="card flex w-40 shrink-0 flex-col gap-2 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{CATEGORY_META[item.category].emoji}</span>
                    <span className="text-[11px] font-bold" style={{ color: `rgb(${color})` }}>
                      {status === "expired" ? "Scaduto" : fmtRelative(item.expiryDate)}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-faint">{fmtQty(item.quantity, item.unit)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recipe suggestions */}
      <section>
        <SectionHeader
          title="Cosa cucino oggi?"
          action={<Link href="/recipes" className="text-sm font-medium text-brand">Tutte</Link>}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {suggestions.map(({ r, score }) => (
            <Link key={r.id} href={`/recipes?open=${r.id}`} className="card group flex flex-col gap-2 p-4 transition-all hover:shadow-lift">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🍽️</span>
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                  {Math.round(Math.min(score, 1) * 100)}% pronto
                </span>
              </div>
              <p className="font-semibold leading-tight">{r.title}</p>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{r.minutes} min</span>
                <span>{r.nutrition.kcal} kcal</span>
                <span>{r.nutrition.protein}g prot.</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                Vedi ricetta <IconChevron width={14} height={14} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card flex flex-col items-center gap-2 p-3 text-center transition-all hover:shadow-lift active:scale-95">
      <span className="text-brand">{icon}</span>
      <span className="text-[11px] font-semibold leading-tight">{label}</span>
    </Link>
  );
}

function StatCard({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: string; label: string }) {
  return (
    <div className="card flex flex-col gap-1.5 p-4">
      <span style={{ color: `rgb(${color})` }}>{icon}</span>
      <p className="text-lg font-extrabold leading-none tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
