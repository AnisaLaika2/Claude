"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { CATEGORY_META, ALL_CATEGORIES, ALL_UNITS, UNIT_LABELS } from "@/lib/food";
import {
  addShoppingItem, toggleShoppingItem, deleteShoppingItem, clearCheckedShopping,
  completeShopping, regenerateShoppingSuggestions,
} from "@/lib/actions";
import { toast } from "@/components/toast";
import { EmptyState } from "@/components/ui";
import { IconPlus, IconCart, IconSpark, IconCheck, IconTrash } from "@/components/icons";
import type { FoodCategory, Unit } from "@/lib/types";

export default function ShoppingPage() {
  const items = useLiveQuery(() => db.shopping.toArray(), [], undefined);
  const [name, setName] = useState("");
  const [cat, setCat] = useState<FoodCategory>("produce");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<Unit>("pcs");
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const g = new Map<FoodCategory, typeof items>();
    (items || []).forEach((it) => {
      const arr = g.get(it.category) || [];
      arr!.push(it);
      g.set(it.category, arr);
    });
    return g;
  }, [items]);

  if (!items) return null;
  const checked = items.filter((i) => i.checked).length;
  const estTotal = items.reduce((s, i) => s + (i.estPrice || 0), 0);

  async function add() {
    if (!name.trim()) return;
    await addShoppingItem({ name, category: cat, quantity: qty, unit });
    setName("");
    setQty(1);
  }

  async function regen() {
    setBusy(true);
    const n = await regenerateShoppingSuggestions();
    setBusy(false);
    toast.success(n ? `${n} suggerimenti aggiunti` : "Lista già aggiornata");
  }

  async function done() {
    const n = await completeShopping();
    toast.success(n ? `${n} prodotti spostati in dispensa` : "Nessun prodotto selezionato");
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Lista della spesa</h1>
          <p className="text-sm text-muted">{items.length} articoli{estTotal > 0 ? ` · ~€${estTotal.toFixed(2)}` : ""}</p>
        </div>
        <button className="btn-secondary" onClick={regen} disabled={busy}>
          <IconSpark width={18} height={18} /> {busy ? "…" : "Genera"}
        </button>
      </div>

      {/* Add row */}
      <div className="card space-y-2 p-3">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Aggiungi articolo…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn-primary" onClick={add}><IconPlus width={18} height={18} /></button>
        </div>
        <div className="flex gap-2">
          <select className="input flex-1 py-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value as FoodCategory)}>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].emoji} {CATEGORY_META[c].label}</option>)}
          </select>
          <input type="number" min={0.1} step="0.1" className="input w-20 py-2 text-sm" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <select className="input w-24 py-2 text-sm" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<IconCart width={40} height={40} />}
          title="Lista vuota"
          subtitle="Aggiungi articoli manualmente o lascia che l'app li generi in base a dispensa e pasti pianificati."
          action={<button className="btn-primary" onClick={regen}><IconSpark width={18} height={18} /> Genera automaticamente</button>}
        />
      ) : (
        <div className="space-y-4">
          {ALL_CATEGORIES.filter((c) => grouped.get(c)?.length).map((c) => (
            <div key={c}>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-faint">
                <span>{CATEGORY_META[c].emoji}</span> {CATEGORY_META[c].label}
              </p>
              <div className="card divide-y divide-border overflow-hidden">
                {grouped.get(c)!.map((it) => (
                  <div key={it.id} className={`flex items-center gap-3 p-3 transition-colors ${it.checked ? "opacity-55" : ""}`}>
                    <button
                      onClick={() => toggleShoppingItem(it.id)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        it.checked ? "border-brand bg-brand text-brand-fg" : "border-border"
                      }`}
                    >
                      {it.checked && <IconCheck width={14} height={14} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${it.checked ? "line-through" : ""}`}>{it.name}</p>
                      {it.reason && <p className="truncate text-[11px] text-faint">{it.auto ? "🤖 " : ""}{it.reason}</p>}
                    </div>
                    <span className="text-xs text-muted">{it.quantity} {UNIT_LABELS[it.unit]}</span>
                    <button onClick={() => deleteShoppingItem(it.id)} className="rounded-lg p-1 text-faint hover:text-danger">
                      <IconTrash width={15} height={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {checked > 0 && (
        <div className="sticky bottom-24 z-10 flex gap-2 lg:bottom-4">
          <button className="btn-secondary flex-1" onClick={() => clearCheckedShopping()}>
            Rimuovi {checked} selezionati
          </button>
          <button className="btn-primary flex-1" onClick={done}>
            <IconCheck width={18} height={18} /> Sposta in dispensa
          </button>
        </div>
      )}
    </div>
  );
}
