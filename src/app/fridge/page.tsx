"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { CATEGORY_META, LOCATION_META, expiryStatus, EXPIRY_META, fmtQty, stockLevel } from "@/lib/food";
import { fmtRelative } from "@/lib/format";
import { Segmented } from "@/components/ui";
import { ItemForm } from "@/components/ItemForm";
import { IconPlus } from "@/components/icons";
import type { PantryItem, StorageLocation } from "@/lib/types";

export default function FridgePage() {
  const items = useLiveQuery(() => db.pantry.toArray(), [], undefined);
  const [loc, setLoc] = useState<StorageLocation>("fridge");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PantryItem | null>(null);

  if (!items) return null;
  const inLoc = items.filter((i) => i.location === loc && i.quantity > 0);

  // Split into 3 shelves for visual layout
  const shelves: PantryItem[][] = [[], [], []];
  inLoc.forEach((it, idx) => shelves[idx % 3].push(it));

  const open = (i: PantryItem) => { setEditing(i); setFormOpen(true); };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Frigo virtuale</h1>
          <p className="text-sm text-muted">Una vista realistica dei tuoi spazi</p>
        </div>
        <button className="btn-secondary" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <IconPlus width={18} height={18} />
        </button>
      </div>

      <Segmented
        value={loc}
        onChange={setLoc}
        options={[
          { value: "fridge", label: "🧊 Frigo" },
          { value: "freezer", label: "❄️ Freezer" },
          { value: "pantry", label: "🗄️ Dispensa" },
        ]}
      />

      {/* Appliance */}
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border-2 border-border bg-gradient-to-b from-surface to-surface-2 p-3 shadow-lift">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-sm font-bold">{LOCATION_META[loc].label}</span>
          <span className="text-xs text-muted">{inLoc.length} prodotti</span>
        </div>
        <div className="space-y-2.5">
          {shelves.map((shelf, si) => (
            <div key={si} className="rounded-2xl border border-border bg-bg/60 p-2.5">
              {shelf.length === 0 ? (
                <div className="flex h-16 items-center justify-center text-xs text-faint">Ripiano vuoto</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {shelf.map((item) => {
                    const s = expiryStatus(item.expiryDate);
                    const lvl = stockLevel(item);
                    const color = s === "expired" || s === "critical" ? "var(--danger)" : s === "soon" ? "var(--warning)" : "var(--success)";
                    return (
                      <button
                        key={item.id}
                        onClick={() => open(item)}
                        className="group relative flex w-[84px] flex-col items-center gap-1 rounded-xl border border-border bg-surface p-2 transition-all hover:-translate-y-0.5 hover:shadow-soft"
                        title={`${item.name} · ${fmtQty(item.quantity, item.unit)}`}
                      >
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: `rgb(${color})` }} />
                        <span className="text-2xl">{CATEGORY_META[item.category].emoji}</span>
                        <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">{item.name}</span>
                        <span className="text-[10px] text-faint">{fmtQty(item.quantity, item.unit)}</span>
                        {lvl !== "full" && (
                          <span className="text-[9px] font-bold" style={{ color: "rgb(var(--warning))" }}>basso</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted">
        {(["ok", "soon", "critical"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `rgb(${EXPIRY_META[s].color})` }} />
            {s === "ok" ? "Fresco" : s === "soon" ? "In scadenza" : "Urgente"}
          </span>
        ))}
      </div>

      {inLoc.some((i) => expiryStatus(i.expiryDate) === "soon" || expiryStatus(i.expiryDate) === "critical") && (
        <div className="card border-warning/30 bg-warning/5 p-4">
          <p className="text-sm font-semibold">⚡ Da usare presto in {LOCATION_META[loc].label.toLowerCase()}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {inLoc
              .filter((i) => ["soon", "critical", "expired"].includes(expiryStatus(i.expiryDate)))
              .map((i) => (
                <span key={i.id} className="chip">{i.name} · {fmtRelative(i.expiryDate)}</span>
              ))}
          </div>
        </div>
      )}

      <ItemForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} defaultLocation={loc} />
    </div>
  );
}
