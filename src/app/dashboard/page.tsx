"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { db } from "@/lib/db";
import { CATEGORY_META } from "@/lib/food";
import { fmtMoney } from "@/lib/format";
import { Ring, Segmented } from "@/components/ui";
import { IconFlame, IconLeaf, IconEuro, IconCart } from "@/components/icons";
import { useState } from "react";

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function DashboardPage() {
  const consumption = useLiveQuery(() => db.consumption.toArray(), [], undefined);
  const waste = useLiveQuery(() => db.waste.toArray(), [], []);
  const pantry = useLiveQuery(() => db.pantry.toArray(), [], []);
  const profile = useLiveQuery(() => db.profile.get("me"), [], undefined);
  const [range, setRange] = useState<7 | 30>(7);

  const days = useMemo(() => lastNDays(range), [range]);

  if (!consumption) return null;

  // Daily kcal & macros
  const daily = days.map((d) => {
    const items = consumption.filter((c) => c.date === d);
    const n = items.reduce(
      (a, c) => ({
        kcal: a.kcal + (c.nutrition?.kcal || 0),
        protein: a.protein + (c.nutrition?.protein || 0),
        carbs: a.carbs + (c.nutrition?.carbs || 0),
        fat: a.fat + (c.nutrition?.fat || 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return { day: new Date(d).toLocaleDateString("it-IT", { weekday: "short" }), ...n };
  });

  const totalMacro = daily.reduce((a, d) => ({ p: a.p + d.protein, c: a.c + d.carbs, f: a.f + d.fat }), { p: 0, c: 0, f: 0 });
  const macroData = [
    { name: "Proteine", value: Math.round(totalMacro.p), color: "var(--info)" },
    { name: "Carboidrati", value: Math.round(totalMacro.c), color: "var(--warning)" },
    { name: "Grassi", value: Math.round(totalMacro.f), color: "var(--danger)" },
  ].filter((m) => m.value > 0);

  const rangeWaste = waste.filter((w) => days.includes(w.date));
  const rangeCons = consumption.filter((c) => days.includes(c.date));
  const moneySaved = rangeCons.reduce((s, c) => s + (c.savedValue || 0), 0);
  const moneyWasted = rangeWaste.reduce((s, w) => s + w.estValue, 0);
  const co2Saved = rangeCons.reduce((s, c) => s + 0.001 * c.quantity, 0);
  const productsConsumed = rangeCons.length;
  const productsWasted = rangeWaste.length;

  // Waste by category
  const wasteByCat = new Map<string, number>();
  rangeWaste.forEach((w) => wasteByCat.set(w.category, (wasteByCat.get(w.category) || 0) + w.estValue));
  const wasteBars = [...wasteByCat.entries()].map(([cat, val]) => ({
    name: CATEGORY_META[cat as keyof typeof CATEGORY_META]?.label || cat,
    value: +val.toFixed(2),
    color: CATEGORY_META[cat as keyof typeof CATEGORY_META]?.color || "#888",
  }));

  const targetKcal = profile?.targetKcal || 2000;
  const avgKcal = daily.reduce((s, d) => s + d.kcal, 0) / range;
  const pantryValue = pantry.filter((p) => p.quantity > 0 && p.price && p.initialQuantity).reduce((s, p) => s + (p.price! / p.initialQuantity) * p.quantity, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Statistiche</h1>
          <p className="text-sm text-muted">I tuoi progressi e i tuoi risparmi</p>
        </div>
        <Segmented value={range} onChange={(v) => setRange(v as 7 | 30)} options={[{ value: 7 as any, label: "7g" }, { value: 30 as any, label: "30g" }]} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={<IconEuro />} color="var(--success)" value={fmtMoney(moneySaved)} label="Risparmiati" />
        <Kpi icon={<IconFlame />} color="var(--danger)" value={fmtMoney(moneyWasted)} label="Sprecati" />
        <Kpi icon={<IconCart />} color="var(--info)" value={String(productsConsumed)} label="Consumati" />
        <Kpi icon={<IconLeaf />} color="var(--brand)" value={`${co2Saved.toFixed(1)}kg`} label="CO₂ evitata" />
      </div>

      {/* Calories over time */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Calorie assunte</p>
          <span className="text-xs text-muted">media {Math.round(avgKcal)} / {targetKcal} kcal</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={daily} margin={{ left: -20, right: 4, top: 4 }}>
            <defs>
              <linearGradient id="kcal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(52 199 152)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="rgb(52 199 152)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "rgb(var(--faint))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "rgb(var(--faint))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="kcal" stroke="rgb(52 199 152)" strokeWidth={2.5} fill="url(#kcal)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Macros pie */}
        <div className="card p-4">
          <p className="mb-3 text-sm font-bold">Ripartizione macro</p>
          {macroData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={170}>
                <PieChart>
                  <Pie data={macroData} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none">
                    {macroData.map((m, i) => <Cell key={i} fill={`rgb(${m.color})`} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {macroData.map((m) => (
                  <div key={m.name} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: `rgb(${m.color})` }} />
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted">{m.value}g</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Waste by category */}
        <div className="card p-4">
          <p className="mb-3 text-sm font-bold">Sprechi per categoria</p>
          {wasteBars.length === 0 ? (
            <div className="flex h-[170px] flex-col items-center justify-center gap-1 text-center">
              <span className="text-3xl">🎉</span>
              <p className="text-sm font-medium">Nessuno spreco!</p>
              <p className="text-xs text-muted">Continua a consumare tutto in tempo</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={wasteBars} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`€${v}`, "Sprecato"]} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {wasteBars.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Protein target ring */}
      <div className="card flex items-center gap-5 p-5">
        <Ring value={(avgKcal / targetKcal) * 100} label={`${Math.round((avgKcal / targetKcal) * 100)}%`} sublabel="obiettivo" size={88} stroke={9} />
        <div className="flex-1">
          <p className="text-sm font-bold">Aderenza all'obiettivo calorico</p>
          <p className="mt-1 text-sm text-muted">
            In media assumi {Math.round(avgKcal)} kcal al giorno rispetto al tuo obiettivo di {targetKcal} kcal.
          </p>
          <p className="mt-2 text-xs text-faint">Valore stimato della dispensa attuale: <span className="font-semibold text-fg">{fmtMoney(pantryValue)}</span></p>
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "rgb(var(--surface))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "rgb(var(--fg))",
};

function Kpi({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: string; label: string }) {
  return (
    <div className="card flex flex-col gap-1.5 p-4">
      <span style={{ color: `rgb(${color})` }}>{icon}</span>
      <p className="text-xl font-extrabold leading-none tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[170px] flex-col items-center justify-center gap-1 text-center text-muted">
      <span className="text-3xl">📊</span>
      <p className="text-sm">Ancora nessun dato</p>
      <p className="text-xs text-faint">Cucina o consuma prodotti per popolare i grafici</p>
    </div>
  );
}
