"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayKey } from "@/lib/db";
import { computeTargets } from "@/lib/nutrition";
import { addPlannedMeal } from "@/lib/actions";
import { buildHealthyWeek } from "@/lib/mealplan";
import { weekDays } from "@/lib/format";
import { Ring, Segmented } from "@/components/ui";
import { toast } from "@/components/toast";
import { IconUser, IconSpark } from "@/components/icons";
import type { Activity, DietProfile, Goal, Sex } from "@/lib/types";

const GOALS: [Goal, string, string][] = [
  ["lose", "Dimagrire", "📉"],
  ["maintain", "Mantenere", "⚖️"],
  ["gain", "Aumentare", "📈"],
  ["muscle", "Massa muscolare", "💪"],
];
const ACTIVITIES: [Activity, string][] = [
  ["sedentary", "Sedentario"],
  ["light", "Leggero"],
  ["moderate", "Moderato"],
  ["active", "Attivo"],
  ["athlete", "Atleta"],
];
const DIETS = [
  ["none", "Onnivora"], ["vegetarian", "Vegetariana"], ["vegan", "Vegana"],
  ["pescatarian", "Pescetariana"], ["mediterranean", "Mediterranea"], ["keto", "Keto"],
];

const DEFAULT: DietProfile = {
  name: "Tu", sex: "female", age: 30, heightCm: 170, weightKg: 68,
  goal: "maintain", activity: "moderate", allergies: [], preferences: [], dislikes: [], diet: "none",
};

export default function DietPage() {
  const stored = useLiveQuery(() => db.profile.get("me"), [], undefined);
  const [p, setP] = useState<DietProfile>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [allergyInput, setAllergyInput] = useState("");
  const [prefInput, setPrefInput] = useState("");

  useEffect(() => {
    if (stored && !loaded) { setP(stored); setLoaded(true); }
    if (stored === undefined) setLoaded(true);
  }, [stored, loaded]);

  const set = (patch: Partial<DietProfile>) => setP((prev) => ({ ...prev, ...patch }));
  const targets = computeTargets(p);

  async function save() {
    await db.profile.put({ ...p, ...targets, id: "me" });
    toast.success("Profilo salvato, piano aggiornato");
  }

  function addTag(field: "allergies" | "preferences", value: string) {
    const v = value.trim();
    if (!v) return;
    set({ [field]: [...new Set([...(p[field] as string[]), v])] } as Partial<DietProfile>);
  }
  function removeTag(field: "allergies" | "preferences", value: string) {
    set({ [field]: (p[field] as string[]).filter((x) => x !== value) } as Partial<DietProfile>);
  }

  async function generatePlan() {
    const recipes = await db.recipes.toArray();
    const days = weekDays();
    // Replace any existing meals for this week, then build a balanced plan.
    const existing = await db.meals.where("date").between(days[0], days[6] + "￿").toArray();
    await db.meals.bulkDelete(existing.map((m) => m.id));
    const plan = buildHealthyWeek({ ...p, ...targets }, recipes, days);
    for (const m of plan) await addPlannedMeal(m);
    toast.success(`Piano salutare di ${plan.length} pasti · ${targets.targetKcal} kcal/g`);
  }

  const macros = [
    { label: "Proteine", value: targets.targetProtein, color: "var(--info)", kcal: targets.targetProtein * 4 },
    { label: "Carboidrati", value: targets.targetCarbs, color: "var(--warning)", kcal: targets.targetCarbs * 4 },
    { label: "Grassi", value: targets.targetFat, color: "var(--danger)", kcal: targets.targetFat * 9 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Dieta personalizzata</h1>
        <p className="text-sm text-muted">Imposta i tuoi dati e ottieni un piano su misura</p>
      </div>

      {/* Targets card */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand/15 to-transparent p-5">
          <div className="flex items-center gap-5">
            <Ring value={100} label={String(targets.targetKcal)} sublabel="kcal/g" size={92} stroke={9} />
            <div className="flex-1 space-y-2">
              {macros.map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs"><span className="font-medium">{m.label}</span><span className="text-muted">{m.value}g · {Math.round(m.kcal)} kcal</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(m.kcal / targets.targetKcal) * 100}%`, background: `rgb(${m.color})` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card space-y-5 p-5">
        <div className="flex items-center gap-2 text-sm font-bold"><IconUser width={18} height={18} /> I tuoi dati</div>

        <Segmented value={p.sex} onChange={(v: Sex) => set({ sex: v })} options={[{ value: "female", label: "Donna" }, { value: "male", label: "Uomo" }]} />

        <div className="grid grid-cols-3 gap-3">
          {([["age", "Età", "anni"], ["heightCm", "Altezza", "cm"], ["weightKg", "Peso", "kg"]] as const).map(([key, label, u]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="mt-1 flex items-center rounded-xl border border-border bg-surface px-3">
                <input type="number" className="w-full bg-transparent py-2.5 text-sm focus:outline-none" value={p[key]} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<DietProfile>)} />
                <span className="text-xs text-faint">{u}</span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="label">Obiettivo</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GOALS.map(([g, label, emoji]) => (
              <button key={g} onClick={() => set({ goal: g })} className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition-all ${p.goal === g ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-muted hover:bg-surface-2"}`}>
                <span className="text-xl">{emoji}</span>{label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Attività fisica</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ACTIVITIES.map(([a, label]) => (
              <button key={a} onClick={() => set({ activity: a })} className={`chip ${p.activity === a ? "chip-active" : ""}`}>{label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Regime alimentare</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DIETS.map(([v, label]) => (
              <button key={v} onClick={() => set({ diet: v as DietProfile["diet"] })} className={`chip ${p.diet === v ? "chip-active" : ""}`}>{label}</button>
            ))}
          </div>
        </div>

        <TagField label="Allergie / intolleranze" tags={p.allergies} input={allergyInput} setInput={setAllergyInput} onAdd={(v) => { addTag("allergies", v); setAllergyInput(""); }} onRemove={(v) => removeTag("allergies", v)} color="var(--danger)" placeholder="es. lattosio, glutine…" />
        <TagField label="Alimenti preferiti" tags={p.preferences} input={prefInput} setInput={setPrefInput} onAdd={(v) => { addTag("preferences", v); setPrefInput(""); }} onRemove={(v) => removeTag("preferences", v)} color="var(--success)" placeholder="es. pollo, avocado…" />
      </div>

      <div className="sticky bottom-24 z-10 flex gap-2 lg:bottom-4">
        <button className="btn-secondary flex-1" onClick={generatePlan}><IconSpark width={18} height={18} /> Genera piano salutare</button>
        <button className="btn-primary flex-1" onClick={save}>Salva profilo</button>
      </div>
    </div>
  );
}

function TagField({ label, tags, input, setInput, onAdd, onRemove, color, placeholder }: {
  label: string; tags: string[]; input: string; setInput: (v: string) => void; onAdd: (v: string) => void; onRemove: (v: string) => void; color: string; placeholder: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="mt-1 flex gap-2">
        <input className="input flex-1" placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(input); } }} />
        <button className="btn-secondary" onClick={() => onAdd(input)}>+</button>
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button key={t} onClick={() => onRemove(t)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: `rgb(${color} / 0.12)`, color: `rgb(${color})` }}>
              {t} <span className="text-sm leading-none">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
