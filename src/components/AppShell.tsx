"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { expiryStatus } from "@/lib/food";
import { useTheme } from "./theme";
import {
  IconHome, IconPantry, IconFridge, IconCart, IconCalendar, IconChef,
  IconScan, IconChart, IconLeaf, IconSpark, IconUser, IconSettings,
  IconMoon, IconSun, IconBell,
} from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: (p: any) => ReactNode;
  primary?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome, primary: true },
  { href: "/pantry", label: "Dispensa", icon: IconPantry, primary: true },
  { href: "/fridge", label: "Frigo", icon: IconFridge },
  { href: "/scan", label: "Scanner", icon: IconScan, primary: true },
  { href: "/shopping", label: "Spesa", icon: IconCart, primary: true },
  { href: "/planner", label: "Planner", icon: IconCalendar },
  { href: "/recipes", label: "Ricette", icon: IconChef },
  { href: "/assistant", label: "Assistant", icon: IconSpark, primary: true },
  { href: "/diet", label: "Dieta", icon: IconUser },
  { href: "/dashboard", label: "Statistiche", icon: IconChart },
  { href: "/waste", label: "Sprechi", icon: IconLeaf },
  { href: "/settings", label: "Impostazioni", icon: IconSettings },
];

const MOBILE_NAV = NAV.filter((n) => n.primary);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureSeeded().finally(() => setReady(true));
  }, []);

  const expiringCount = useLiveQuery(async () => {
    const items = await db.pantry.toArray();
    return items.filter((i) => {
      const s = expiryStatus(i.expiryDate);
      return (s === "critical" || s === "expired") && i.quantity > 0;
    }).length;
  }, [], 0);

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface/60 px-3 py-5 lg:flex">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} badge={item.href === "/pantry" ? expiringCount : 0} />
          ))}
        </nav>
        <ThemeToggle />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border glass px-4 py-3 lg:hidden">
        <Brand small />
        <div className="flex items-center gap-1">
          <Link href="/pantry" className="relative rounded-full p-2 text-muted hover:bg-surface-2">
            <IconBell width={20} height={20} />
            {expiringCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {expiringCount}
              </span>
            )}
          </Link>
          <ThemeToggle compact />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 lg:pb-10 lg:pl-64 lg:pr-6">
        {ready ? children : <BootSkeleton />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border glass px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-brand" : "text-faint"
              }`}
            >
              <Icon width={22} height={22} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function Brand({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg text-brand-fg shadow-soft">
        🍃
      </div>
      {!small && (
        <div className="leading-tight">
          <p className="text-base font-extrabold tracking-tight">Cibo</p>
          <p className="text-[10px] font-medium text-faint">Cucina intelligente</p>
        </div>
      )}
      {small && <p className="text-lg font-extrabold tracking-tight">Cibo</p>}
    </Link>
  );
}

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <Icon width={20} height={20} />
      <span className="flex-1">{item.label}</span>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function ThemeToggle({ compact }: { compact?: boolean }) {
  const mode = useTheme((s) => s.mode);
  const set = useTheme((s) => s.set);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && document.documentElement.classList.contains("dark");
  const toggle = () => set(isDark ? "light" : "dark");

  if (compact) {
    return (
      <button onClick={toggle} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Tema">
        {isDark ? <IconSun width={20} height={20} /> : <IconMoon width={20} height={20} />}
      </button>
    );
  }
  return (
    <button
      onClick={toggle}
      className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2"
    >
      {isDark ? <IconSun width={20} height={20} /> : <IconMoon width={20} height={20} />}
      {isDark ? "Tema chiaro" : "Tema scuro"}
    </button>
  );
}

function BootSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-40 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
