"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { CATEGORY_META } from "@/lib/food";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Sparkline } from "@/components/ui";
import { IconLeaf, IconEuro, IconFlame } from "@/components/icons";

const WASTE_REASON_LABEL: Record<string, string> = {
  expired: "Scaduto", spoiled: "Andato a male", leftover: "Avanzo", other: "Altro",
};

const TIPS = [
  "Conserva le erbe aromatiche in un bicchiere d'acqua come i fiori: durano il doppio.",
  "Congela il pane a fette: puoi tostarne solo quanto ti serve.",
  "Metti gli alimenti in scadenza davanti nel frigo, la regola FIFO riduce gli sprechi del 30%.",
  "Le verdure un po' molli sono perfette per zuppe, sughi e vellutate.",
  "Pianifica i pasti prima di fare la spesa: comprerai solo ciò che serve.",
];

export default function WastePage() {
  const waste = useLiveQuery(() => db.waste.toArray(), [], undefined);
  const consumption = useLiveQuery(() => db.consumption.toArray(), [], []);

  if (!waste) return null;

  const totalMoney = waste.reduce((s, w) => s + w.estValue, 0);
  const totalCo2 = waste.reduce((s, w) => s + w.co2, 0);
  const totalKg = waste.reduce((s, w) => s + (w.unit === "kg" ? w.quantity : w.unit === "g" ? w.quantity / 1000 : 0.15 * w.quantity), 0);
  const savedMoney = consumption.reduce((s, c) => s + (c.savedValue || 0), 0);
  const savedItems = consumption.filter((c) => (c.savedValue || 0) > 0).length;

  // Trend: money wasted per day, last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const trend = days.map((d) => waste.filter((w) => w.date === d).reduce((s, w) => s + w.estValue, 0));

  const tip = TIPS[new Date().getDate() % TIPS.length];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Riduzione sprechi</h1>
        <p className="text-sm text-muted">Il tuo impatto su portafoglio e pianeta</p>
      </div>

      {/* Hero impact */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          <Impact icon={<IconFlame />} color="var(--danger)" big={`${totalKg.toFixed(1)}kg`} label="Cibo buttato" />
          <Impact icon={<IconEuro />} color="var(--danger)" big={fmtMoney(totalMoney)} label="Soldi persi" />
          <Impact icon={<IconLeaf />} color="var(--success)" big={fmtMoney(savedMoney)} label="Risparmiati" />
          <Impact icon={<IconLeaf />} color="var(--brand)" big={`${totalCo2.toFixed(1)}kg`} label="CO₂ emessa" />
        </div>
      </div>

      {/* Saved highlight */}
      <div className="card flex items-center gap-4 border-success/30 bg-success/5 p-4">
        <span className="text-3xl">🌱</span>
        <div className="flex-1">
          <p className="font-semibold">Hai salvato {savedItems} alimenti dallo spreco</p>
          <p className="text-sm text-muted">consumandoli prima della scadenza. Ottimo lavoro!</p>
        </div>
      </div>

      {/* Trend */}
      {trend.some((t) => t > 0) && (
        <div className="card p-4">
          <p className="mb-1 text-sm font-bold">Andamento sprechi (14 giorni)</p>
          <Sparkline data={trend} color="var(--danger)" height={48} />
        </div>
      )}

      {/* Tip */}
      <div className="card flex gap-3 p-4">
        <span className="text-2xl">💡</span>
        <div>
          <p className="text-sm font-semibold">Consiglio del giorno</p>
          <p className="text-sm text-muted">{tip}</p>
        </div>
      </div>

      {/* Log */}
      <div>
        <p className="mb-2 text-sm font-bold">Storico sprechi</p>
        {waste.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">🎉</span>
            <p className="font-semibold">Zero sprechi finora</p>
            <p className="text-sm text-muted">Quando elimini un prodotto scaduto, comparirà qui.</p>
          </div>
        ) : (
          <div className="card divide-y divide-border overflow-hidden">
            {[...waste].reverse().map((w) => (
              <div key={w.id} className="flex items-center gap-3 p-3">
                <span className="text-xl">{CATEGORY_META[w.category].emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <p className="text-[11px] text-faint">{WASTE_REASON_LABEL[w.reason]} · {fmtDate(w.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-danger">−{fmtMoney(w.estValue)}</p>
                  <p className="text-[10px] text-faint">{w.co2.toFixed(1)}kg CO₂</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Impact({ icon, color, big, label }: { icon: React.ReactNode; color: string; big: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-5 text-center">
      <span style={{ color: `rgb(${color})` }}>{icon}</span>
      <p className="text-xl font-extrabold tabular-nums">{big}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
