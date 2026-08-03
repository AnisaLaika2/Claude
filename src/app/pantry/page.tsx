"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ALL_CATEGORIES, ALL_LOCATIONS, CATEGORY_META, LOCATION_META, expiryStatus } from "@/lib/food";
import { PantryItemCard } from "@/components/PantryItemCard";
import { ItemForm } from "@/components/ItemForm";
import { EmptyState } from "@/components/ui";
import { IconPlus, IconSearch, IconPantry } from "@/components/icons";
import type { FoodCategory, PantryItem, StorageLocation } from "@/lib/types";

type ExpiryFilter = "all" | "soon" | "expired" | "opened" | "low" | "out";

export default function PantryPage() {
  const items = useLiveQuery(() => db.pantry.orderBy("expiryDate").toArray(), [], undefined);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FoodCategory | "all">("all");
  const [loc, setLoc] = useState<StorageLocation | "all">("all");
  const [exp, setExp] = useState<ExpiryFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PantryItem | null>(null);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q.toLowerCase()) && !(i.brand || "").toLowerCase().includes(q.toLowerCase())) return false;
      if (cat !== "all" && i.category !== cat) return false;
      if (loc !== "all" && i.location !== loc) return false;
      const s = expiryStatus(i.expiryDate);
      const ratio = i.initialQuantity > 0 ? i.quantity / i.initialQuantity : 1;
      if (exp === "soon" && !(s === "soon" || s === "critical")) return false;
      if (exp === "expired" && s !== "expired") return false;
      if (exp === "opened" && !i.opened) return false;
      if (exp === "low" && !(i.quantity > 0 && ratio <= 0.25)) return false;
      if (exp === "out" && i.quantity > 0) return false;
      return true;
    });
  }, [items, q, cat, loc, exp]);

  const openEdit = (i: PantryItem) => { setEditing(i); setFormOpen(true); };
  const openNew = () => { setEditing(null); setFormOpen(true); };

  const catCounts = useMemo(() => {
    const m = new Map<FoodCategory, number>();
    (items || []).forEach((i) => m.set(i.category, (m.get(i.category) || 0) + 1));
    return m;
  }, [items]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dispensa</h1>
          <p className="text-sm text-muted">{(items || []).filter((i) => i.quantity > 0).length} prodotti attivi</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <IconPlus width={18} height={18} /> Aggiungi
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <IconSearch width={18} height={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input pl-10" placeholder="Cerca un prodotto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Expiry filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {([
          ["all", "Tutti"], ["soon", "In scadenza"], ["expired", "Scaduti"],
          ["low", "Quasi finiti"], ["out", "Terminati"], ["opened", "Aperti"],
        ] as [ExpiryFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setExp(v)} className={`chip whitespace-nowrap ${exp === v ? "chip-active" : ""}`}>{l}</button>
        ))}
      </div>

      {/* Location + category filters */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setLoc("all")} className={`chip ${loc === "all" ? "chip-active" : ""}`}>Ovunque</button>
        {ALL_LOCATIONS.map((l) => (
          <button key={l} onClick={() => setLoc(loc === l ? "all" : l)} className={`chip ${loc === l ? "chip-active" : ""}`}>
            {LOCATION_META[l].emoji} {LOCATION_META[l].label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setCat("all")} className={`chip ${cat === "all" ? "chip-active" : ""}`}>Tutte</button>
        {ALL_CATEGORIES.filter((c) => catCounts.get(c)).map((c) => (
          <button key={c} onClick={() => setCat(cat === c ? "all" : c)} className={`chip ${cat === c ? "chip-active" : ""}`}>
            {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconPantry width={40} height={40} />}
          title="Nessun prodotto"
          subtitle="Aggiungi prodotti manualmente o scansiona uno scontrino per riempire la dispensa."
          action={<button className="btn-primary" onClick={openNew}><IconPlus width={18} height={18} /> Aggiungi prodotto</button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <PantryItemCard key={item.id} item={item} onEdit={openEdit} />
          ))}
        </div>
      )}

      <ItemForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
    </div>
  );
}
