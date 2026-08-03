"use client";

import { useState } from "react";
import { Modal } from "./ui";
import { toast } from "./toast";
import { addPantryItem, updatePantryItem } from "@/lib/actions";
import { ALL_CATEGORIES, ALL_LOCATIONS, ALL_UNITS, CATEGORY_META, LOCATION_META, UNIT_LABELS } from "@/lib/food";
import type { FoodCategory, PantryItem, StorageLocation, Unit } from "@/lib/types";

type Draft = Partial<PantryItem>;

export function ItemForm({
  open,
  onClose,
  initial,
  defaultLocation,
}: {
  open: boolean;
  onClose: () => void;
  initial?: PantryItem | null;
  defaultLocation?: StorageLocation;
}) {
  const editing = !!initial?.id;
  const [d, setD] = useState<Draft>(
    initial || {
      name: "",
      category: "produce",
      location: defaultLocation || "fridge",
      quantity: 1,
      unit: "pcs",
    }
  );

  const set = (patch: Draft) => setD((prev) => ({ ...prev, ...patch }));

  const dateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");

  async function submit() {
    if (!d.name?.trim()) return toast.error("Inserisci un nome");
    try {
      if (editing && initial) {
        await updatePantryItem(initial.id, {
          name: d.name!.trim(),
          brand: d.brand,
          category: d.category as FoodCategory,
          location: d.location as StorageLocation,
          quantity: Number(d.quantity) || 0,
          unit: d.unit as Unit,
          price: d.price != null ? Number(d.price) : undefined,
          expiryDate: d.expiryDate,
          purchaseDate: d.purchaseDate,
          store: d.store,
          opened: d.opened,
        });
        toast.success("Prodotto aggiornato");
      } else {
        await addPantryItem({
          name: d.name!.trim(),
          brand: d.brand,
          category: (d.category as FoodCategory) || "other",
          location: (d.location as StorageLocation) || "fridge",
          quantity: Number(d.quantity) || 1,
          unit: (d.unit as Unit) || "pcs",
          price: d.price != null ? Number(d.price) : undefined,
          expiryDate: d.expiryDate,
          store: d.store,
        });
        toast.success("Aggiunto alla dispensa");
      }
      onClose();
    } catch {
      toast.error("Errore nel salvataggio");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Modifica prodotto" : "Nuovo prodotto"}
      footer={
        <>
          <button className="btn-secondary flex-1" onClick={onClose}>Annulla</button>
          <button className="btn-primary flex-1" onClick={submit}>{editing ? "Salva" : "Aggiungi"}</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <label className="label">Nome</label>
          <input className="input mt-1" value={d.name || ""} onChange={(e) => set({ name: e.target.value })} placeholder="es. Petto di pollo" autoFocus />
        </div>

        <div>
          <label className="label">Categoria</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => set({ category: c })}
                className={`chip ${d.category === c ? "chip-active" : ""}`}
              >
                <span>{CATEGORY_META[c].emoji}</span>
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label className="label">Quantità</label>
            <input type="number" min={0} step="0.1" className="input mt-1" value={d.quantity ?? ""} onChange={(e) => set({ quantity: Number(e.target.value) })} />
          </div>
          <div className="col-span-1">
            <label className="label">Unità</label>
            <select className="input mt-1" value={d.unit} onChange={(e) => set({ unit: e.target.value as Unit })}>
              {ALL_UNITS.map((u) => (
                <option key={u} value={u}>{UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <label className="label">Prezzo €</label>
            <input type="number" min={0} step="0.01" className="input mt-1" value={d.price ?? ""} onChange={(e) => set({ price: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="—" />
          </div>
        </div>

        <div>
          <label className="label">Posizione</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {ALL_LOCATIONS.map((l) => (
              <button
                key={l}
                onClick={() => set({ location: l })}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all ${
                  d.location === l ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-muted hover:bg-surface-2"
                }`}
              >
                <span className="text-lg">{LOCATION_META[l].emoji}</span>
                {LOCATION_META[l].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Scadenza</label>
            <input type="date" className="input mt-1" value={dateInput(d.expiryDate)} onChange={(e) => set({ expiryDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </div>
          <div>
            <label className="label">Supermercato</label>
            <input className="input mt-1" value={d.store || ""} onChange={(e) => set({ store: e.target.value })} placeholder="es. Coop" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
