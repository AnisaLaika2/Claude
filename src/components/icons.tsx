import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></svg>
);
export const IconPantry = (p: P) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M12 3v18" /></svg>
);
export const IconFridge = (p: P) => (
  <svg {...base(p)}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M6 10h12M9 5v2M9 13v3" /></svg>
);
export const IconCart = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h2l2.4 12.3a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H6" /></svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>
);
export const IconChef = (p: P) => (
  <svg {...base(p)}><path d="M7 21h10M6 13.5A4 4 0 0 1 7 5.7 4.5 4.5 0 0 1 16.9 5 4 4 0 0 1 18 13.5" /><path d="M6 13.5h12V17a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" /></svg>
);
export const IconScan = (p: P) => (
  <svg {...base(p)}><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M4 12h16" /></svg>
);
export const IconChart = (p: P) => (
  <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconLeaf = (p: P) => (
  <svg {...base(p)}><path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-5 14-9 14Z" /><path d="M9 15c2-4 5-6 8-7" /></svg>
);
export const IconSpark = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconFlame = (p: P) => (
  <svg {...base(p)}><path d="M12 3c3 3.5 5 6 5 9a5 5 0 0 1-10 0c0-1.5.5-3 2-4.5 0 2 1 3 2 3 .5 0 1-.5 1-1.5 0-2-1-4-0-6z" /></svg>
);
export const IconHeart = (p: P) => (
  <svg {...base(p)}><path d="M12 20s-7-4.3-9.3-8.5C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.5.8-1.3 2-2.5 4-2.5 3.5 0 5 3.5 3.3 7C19 15.7 12 20 12 20z" /></svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="M5 12.5 10 17l9-10" /></svg>
);
export const IconBell = (p: P) => (
  <svg {...base(p)}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const IconBarcode = (p: P) => (
  <svg {...base(p)}><path d="M3 5v14M6 5v14M9 5v10M9 17v2M12 5v14M15 5v14M18 5v10M18 17v2M21 5v14" /></svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const IconSend = (p: P) => (
  <svg {...base(p)}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
);
export const IconMoon = (p: P) => (
  <svg {...base(p)}><path d="M21 12.8A8 8 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z" /></svg>
);
export const IconSun = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>
);
export const IconEuro = (p: P) => (
  <svg {...base(p)}><path d="M17 5.5A6 6 0 0 0 7 10m0 4a6 6 0 0 0 10 4.5M4 10h9M4 14h9" /></svg>
);
export const IconWarning = (p: P) => (
  <svg {...base(p)}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.5" /></svg>
);
