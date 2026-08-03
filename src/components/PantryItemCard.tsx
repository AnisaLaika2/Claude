"use client";

import { useState } from "react";
import { Badge } from "./ui";
import { toast } from "./toast";
import {
  CATEGORY_META, EXPIRY_META, LOCATION_META, expiryStatus, fmtQty, stockLevel,
} from "@/lib/food";
import { fmtRelative } from "@/lib/format";
import { consumePantryItem, deletePantryItem, logWaste, updatePantryItem } from "@/lib/actions";
import { IconTrash } from "./icons";
import type { PantryItem } from "@/lib/types";

export function PantryItemCard({ item, onEdit }: { item: PantryItem; onEdit: (i: PantryItem) => void }) {
  const [busy, setBusy] = useState(false);
  const status = expiryStatus(item.expiryDate);
  const level = stockLevel(item);
  const meta = CATEGORY_META[item.category];

  const step = item.unit === "g" || item.unit === "ml" ? 50 : 1;

  async function change(delta: number) {
    setBusy(true);
    const next = Math.max(0, +(item.quantity + delta).toFixed(2));
    if (delta < 0) await consumePantryItem(item.id, Math.min(-delta, item.quantity));
    else await updatePantryItem(item.id, { quantity: next, initialQuantity: Math.max(item.initialQuantity, next) });
    setBusy(false);
  }

  async function toss() {
    await logWaste(item, item.quantity, status === "expired" ? "expired" : "spoiled");
    toast.info(`${item.name} segnato come sprecato`);
  }

  return (
    <div className="card group relative flex flex-col gap-3 p-3.5 transition-all hover:shadow-lift">
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: `${meta.color}22` }}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            meta.emoji
          )}
        </div>
        <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(item)}>
          <p className="truncate font-semibold leading-tight">{item.name}</p>
          <p className="truncate text-xs text-muted">
            {item.brand ? `${item.brand} · ` : ""}
            {LOCATION_META[item.location].label}
          </p>
        </button>
        <button
          onClick={toss}
          className="rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          aria-label="Sprecato"
          title="Segna come sprecato / eliminato"
        >
          <IconTrash width={16} height={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {status !== "none" && status !== "ok" && (
          <Badge color={EXPIRY_META[status].color}>
            {status === "expired" ? "Scaduto" : fmtRelative(item.expiryDate)}
          </Badge>
        )}
        {status === "ok" && (
          <span className="text-[11px] text-faint">Scade {fmtRelative(item.expiryDate)}</span>
        )}
        {level === "low" && <Badge color="var(--warning)">Quasi finito</Badge>}
        {level === "empty" && <Badge color="var(--danger)">Terminato</Badge>}
        {item.opened && <Badge color="var(--info)">Aperto</Badge>}
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex items-center rounded-xl border border-border">
          <button className="px-2.5 py-1.5 text-lg leading-none text-muted hover:text-fg disabled:opacity-40" onClick={() => change(-step)} disabled={busy || item.quantity <= 0}>−</button>
          <span className="min-w-[62px] text-center text-sm font-semibold tabular-nums">{fmtQty(item.quantity, item.unit)}</span>
          <button className="px-2.5 py-1.5 text-lg leading-none text-muted hover:text-fg disabled:opacity-40" onClick={() => change(step)} disabled={busy}>+</button>
        </div>
        {item.price != null && item.initialQuantity > 0 && (
          <span className="text-xs font-medium text-faint">
            €{((item.price / item.initialQuantity) * item.quantity).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

export { deletePantryItem };
