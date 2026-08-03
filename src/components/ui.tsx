"use client";

import { useEffect, type ReactNode } from "react";
import { IconClose } from "./icons";
import { clamp } from "@/lib/format";

// ── Modal / bottom sheet ────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-lift animate-scale-in sm:rounded-3xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-surface-2">
              <IconClose width={18} height={18} />
            </button>
          </div>
        )}
        {children}
        {footer && <div className="mt-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ── Segmented control ───────────────────────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
            value === o.value ? "bg-surface text-fg shadow-soft" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Progress ring ───────────────────────────────────────────
export function Ring({
  value,
  size = 68,
  stroke = 7,
  color = "var(--brand)",
  label,
  sublabel,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = clamp(value, 0, 100);
  const offset = c - (v / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke="rgb(var(--surface-2))" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={`rgb(${color})`}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && <span className="text-sm font-bold leading-none">{label}</span>}
          {sublabel && <span className="mt-0.5 text-[10px] text-faint">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

// ── Progress bar ────────────────────────────────────────────
export function Bar({ value, color = "var(--brand)" }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamp(value, 0, 100)}%`, background: `rgb(${color})` }}
      />
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-muted">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────
export function Badge({ children, color = "var(--muted)" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `rgb(${color} / 0.12)`, color: `rgb(${color})` }}
    >
      {children}
    </span>
  );
}

// ── Sparkline ───────────────────────────────────────────────
export function Sparkline({ data, color = "var(--brand)", height = 36 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * w},${height - ((d - min) / range) * height}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={`rgb(${color})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Section header ──────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-bold">{title}</h2>
      {action}
    </div>
  );
}
