"use client";

import { create } from "zustand";
import { useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeStore {
  mode: ThemeMode;
  set: (m: ThemeMode) => void;
}

function apply(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export const useTheme = create<ThemeStore>((set) => ({
  mode: "system",
  set: (m) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("cibo-theme", m);
    apply(m);
    set({ mode: m });
  },
}));

export function ThemeInit() {
  const set = useTheme((s) => s.set);
  useEffect(() => {
    const stored = (localStorage.getItem("cibo-theme") as ThemeMode) || "system";
    useTheme.setState({ mode: stored });
    apply(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useTheme.getState().mode === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [set]);
  return null;
}

// Inline script to set the theme class before paint (no FOUC).
export const themeScript = `(function(){try{var m=localStorage.getItem('cibo-theme')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
