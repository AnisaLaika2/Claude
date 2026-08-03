"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { IconCheck, IconWarning } from "./icons";

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
interface ToastStore {
  toasts: Toast[];
  push: (message: string, kind?: Toast["kind"]) => void;
  remove: (id: number) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, kind = "success") =>
    set((s) => ({ toasts: [...s.toasts, { id: Date.now() + Math.random(), message, kind }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToast.getState().push(m, "success"),
  error: (m: string) => useToast.getState().push(m, "error"),
  info: (m: string) => useToast.getState().push(m, "info"),
};

export function ToastHost() {
  const toasts = useToast((s) => s.toasts);
  const remove = useToast((s) => s.remove);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);
  const color =
    t.kind === "success" ? "var(--success)" : t.kind === "error" ? "var(--danger)" : "var(--info)";
  return (
    <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium shadow-lift animate-scale-in">
      <span style={{ color: `rgb(${color})` }}>
        {t.kind === "error" ? <IconWarning width={18} height={18} /> : <IconCheck width={18} height={18} />}
      </span>
      {t.message}
    </div>
  );
}
