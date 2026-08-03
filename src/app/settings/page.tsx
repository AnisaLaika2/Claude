"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, uid } from "@/lib/db";
import { useTheme, type ThemeMode } from "@/components/theme";
import { Segmented } from "@/components/ui";
import { toast } from "@/components/toast";
import { IconUser, IconBell, IconPlus, IconTrash, IconMoon } from "@/components/icons";
import type { FamilyMember } from "@/lib/types";

const MEMBER_COLORS = ["#34c798", "#5e9cf8", "#f0ba54", "#f06e6e", "#a78bfa", "#f472b6"];

export default function SettingsPage() {
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.set);
  const settings = useLiveQuery(() => db.settings.get("app"), [], undefined);
  const family = useLiveQuery(() => db.family.toArray(), [], []);
  const [memberName, setMemberName] = useState("");

  async function updateSetting(patch: Partial<NonNullable<typeof settings>>) {
    const cur = settings || { id: "app" as const, theme: "system" as const, currency: "€", notifExpiry: true, language: "it" as const, onboarded: true };
    await db.settings.put({ ...cur, ...patch });
  }

  async function addMember() {
    if (!memberName.trim()) return;
    const member: FamilyMember = {
      id: uid("fam"), name: memberName.trim(), color: MEMBER_COLORS[family.length % MEMBER_COLORS.length], role: "member",
    };
    await db.family.add(member);
    setMemberName("");
    toast.success(`${member.name} aggiunto alla famiglia`);
  }

  async function removeMember(id: string) {
    await db.family.delete(id);
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return toast.error("Notifiche non supportate");
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      await updateSetting({ notifExpiry: true });
      new Notification("Cibo", { body: "Notifiche attive! Ti avviseremo prima delle scadenze.", icon: "/icon.svg" });
      toast.success("Notifiche attivate");
    } else {
      toast.error("Permesso negato");
    }
  }

  async function resetData() {
    if (!confirm("Sicuro di voler cancellare tutti i dati? L'azione è irreversibile.")) return;
    await Promise.all([
      db.pantry.clear(), db.shopping.clear(), db.recipes.clear(), db.meals.clear(),
      db.waste.clear(), db.consumption.clear(), db.family.clear(), db.profile.clear(), db.settings.clear(),
    ]);
    toast.success("Dati cancellati. Ricarico…");
    setTimeout(() => location.reload(), 800);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-muted">Personalizza Cibo su misura per te</p>
      </div>

      {/* Appearance */}
      <Section title="Aspetto" icon={<IconMoon width={18} height={18} />}>
        <div className="flex items-center justify-between">
          <span className="text-sm">Tema</span>
          <Segmented value={mode} onChange={(v: ThemeMode) => setMode(v)} options={[{ value: "light", label: "Chiaro" }, { value: "dark", label: "Scuro" }, { value: "system", label: "Auto" }]} />
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifiche" icon={<IconBell width={18} height={18} />}>
        <p className="text-sm text-muted">Ricevi avvisi 7, 3, 1 giorno prima e il giorno della scadenza dei tuoi prodotti.</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm">Avvisi di scadenza</span>
          <Toggle checked={settings?.notifExpiry ?? true} onChange={(v) => v ? requestNotifications() : updateSetting({ notifExpiry: false })} />
        </div>
      </Section>

      {/* Family */}
      <Section title="Famiglia" icon={<IconUser width={18} height={18} />}>
        <p className="text-sm text-muted">Condividi dispensa, spesa e planner. Le modifiche si sincronizzano in tempo reale su tutti i dispositivi.</p>
        <div className="mt-3 space-y-2">
          {family.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-[11px] text-faint">{m.role === "owner" ? "Proprietario" : "Membro"}</p>
              </div>
              {m.role !== "owner" && (
                <button onClick={() => removeMember(m.id)} className="rounded-lg p-1.5 text-faint hover:text-danger"><IconTrash width={16} height={16} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="input flex-1" placeholder="Nome membro…" value={memberName} onChange={(e) => setMemberName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMember()} />
          <button className="btn-secondary" onClick={addMember}><IconPlus width={18} height={18} /></button>
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferenze">
        <div className="flex items-center justify-between">
          <span className="text-sm">Valuta</span>
          <select className="input w-24 py-2 text-sm" value={settings?.currency || "€"} onChange={(e) => updateSetting({ currency: e.target.value })}>
            {["€", "$", "£", "CHF"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm">Lingua</span>
          <select className="input w-32 py-2 text-sm" value={settings?.language || "it"} onChange={(e) => updateSetting({ language: e.target.value as "it" | "en" })}>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </div>
      </Section>

      {/* Data */}
      <Section title="Dati e privacy">
        <p className="text-sm text-muted">I tuoi dati sono salvati localmente sul dispositivo (offline-first) e pronti per la sincronizzazione cloud.</p>
        <button onClick={resetData} className="btn-danger mt-3 w-full">Cancella tutti i dati</button>
      </Section>

      <p className="pb-4 text-center text-xs text-faint">Cibo v1.0 · Fatto con 🍃 per mangiare meglio e sprecare meno</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">{icon}{title}</div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-brand" : "bg-surface-2 border border-border"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}
