"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayKey } from "@/lib/db";
import { addPlannedMeal, updatePlannedMeal, deletePlannedMeal, cookMeal, totalNutrition } from "@/lib/actions";
import { weekDays, DAY_LABELS, MEAL_LABELS } from "@/lib/format";
import { Modal, Bar } from "@/components/ui";
import { toast } from "@/components/toast";
import { IconPlus, IconChevron, IconTrash, IconCheck } from "@/components/icons";
import type { MealType, PlannedMeal, Recipe } from "@/lib/types";

const MEALS: MealType[] = ["breakfast", "snack", "lunch", "snack2", "dinner"];

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const anchor = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);
  const days = useMemo(() => weekDays(anchor), [anchor]);

  const meals = useLiveQuery(
    () => db.meals.where("date").between(days[0], days[6] + "￿").toArray(),
    [days],
    undefined
  );
  const profile = useLiveQuery(() => db.profile.get("me"), [], undefined);
  const [picker, setPicker] = useState<{ date: string; meal: MealType } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  if (!meals) return null;

  const byCell = (date: string, meal: MealType) => meals.filter((m) => m.date === date && m.meal === meal);
  const targetKcal = profile?.targetKcal || 2000;

  async function onDrop(date: string, meal: MealType) {
    if (!dragId) return;
    await updatePlannedMeal(dragId, { date, meal });
    setDragId(null);
  }

  const todayStr = todayKey();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Meal Planner</h1>
          <p className="text-sm text-muted">Pianifica la settimana, trascina i pasti</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-2" onClick={() => setWeekOffset((w) => w - 1)}><IconChevron width={18} height={18} className="rotate-180" /></button>
          <button className="btn-ghost text-sm" onClick={() => setWeekOffset(0)}>Oggi</button>
          <button className="btn-ghost px-2" onClick={() => setWeekOffset((w) => w + 1)}><IconChevron width={18} height={18} /></button>
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div className="grid min-w-[720px] grid-cols-[80px_repeat(7,1fr)] gap-1.5">
          <div />
          {days.map((d, i) => {
            const dayMeals = meals.filter((m) => m.date === d);
            const kcal = totalNutrition(dayMeals).kcal;
            return (
              <div key={d} className={`rounded-xl p-2 text-center ${d === todayStr ? "bg-brand/10" : ""}`}>
                <p className="text-xs font-bold">{DAY_LABELS[i]}</p>
                <p className="text-[11px] text-muted">{new Date(d).getDate()}</p>
                <p className="mt-1 text-[10px] text-faint">{Math.round(kcal)} kcal</p>
              </div>
            );
          })}
          {MEALS.map((meal) => (
            <div key={meal} className="contents">
              <div className="flex items-center justify-end pr-1 text-xs font-semibold text-muted">{MEAL_LABELS[meal]}</div>
              {days.map((d) => (
                <Cell
                  key={d + meal}
                  meals={byCell(d, meal)}
                  onAdd={() => setPicker({ date: d, meal })}
                  onDragStart={setDragId}
                  onDrop={() => onDrop(d, meal)}
                  isToday={d === todayStr}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: day-by-day accordion */}
      <div className="space-y-3 lg:hidden">
        {days.map((d, i) => {
          const dayMeals = meals.filter((m) => m.date === d);
          const nut = totalNutrition(dayMeals);
          return (
            <div key={d} className={`card p-3 ${d === todayStr ? "border-brand/40" : ""}`}>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold">{DAY_LABELS[i]} {new Date(d).getDate()}{d === todayStr && <span className="ml-2 text-xs text-brand">oggi</span>}</p>
                <span className="text-xs text-muted">{Math.round(nut.kcal)} kcal</span>
              </div>
              <div className="space-y-1.5">
                {MEALS.map((meal) => {
                  const cm = byCell(d, meal);
                  return (
                    <div key={meal} className="flex items-start gap-2">
                      <span className="w-16 shrink-0 pt-1.5 text-[11px] font-medium text-faint">{MEAL_LABELS[meal]}</span>
                      <div className="flex-1 space-y-1">
                        {cm.map((m) => <MealChip key={m.id} meal={m} />)}
                        <button onClick={() => setPicker({ date: d, meal })} className="flex w-full items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1.5 text-xs text-faint hover:border-brand/40 hover:text-brand">
                          <IconPlus width={12} height={12} /> Aggiungi
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly nutrition summary */}
      <WeekSummary meals={meals} days={days} targetKcal={targetKcal} />

      {picker && <MealPicker slot={picker} onClose={() => setPicker(null)} />}
    </div>
  );
}

function Cell({ meals, onAdd, onDragStart, onDrop, isToday }: {
  meals: PlannedMeal[]; onAdd: () => void; onDragStart: (id: string) => void; onDrop: () => void; isToday: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(); }}
      className={`min-h-[72px] rounded-xl border p-1 transition-colors ${over ? "border-brand bg-brand/5" : isToday ? "border-brand/20" : "border-border"}`}
    >
      <div className="space-y-1">
        {meals.map((m) => <MealChip key={m.id} meal={m} draggable onDragStart={() => onDragStart(m.id)} />)}
        <button onClick={onAdd} className="flex w-full items-center justify-center rounded-lg py-1 text-faint hover:bg-surface-2 hover:text-brand">
          <IconPlus width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

function MealChip({ meal, draggable, onDragStart }: { meal: PlannedMeal; draggable?: boolean; onDragStart?: () => void }) {
  const [open, setOpen] = useState(false);
  async function cook() {
    const res = await cookMeal(meal.id);
    if (res.missing.length) toast.info(`Cucinato. Mancavano: ${res.missing.join(", ")}`);
    else toast.success("Cucinato! Dispensa aggiornata");
    setOpen(false);
  }
  return (
    <>
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onClick={() => setOpen(true)}
        className={`cursor-pointer rounded-lg px-1.5 py-1 text-[11px] font-medium leading-tight transition-all hover:brightness-95 ${meal.cooked ? "bg-success/15 text-success line-through" : "bg-brand/12 text-brand"}`}
      >
        {meal.title}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={meal.title}
        footer={
          <>
            <button className="btn-danger" onClick={() => { deletePlannedMeal(meal.id); setOpen(false); }}><IconTrash width={16} height={16} /></button>
            {!meal.cooked && <button className="btn-primary flex-1" onClick={cook}><IconCheck width={16} height={16} /> Segna cucinato</button>}
          </>
        }>
        <div className="space-y-2 text-sm">
          <p className="text-muted">{MEAL_LABELS[meal.meal]} · {meal.servings} porzioni</p>
          {meal.nutrition && (
            <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center">
              {[["kcal", meal.nutrition.kcal], ["P", meal.nutrition.protein], ["C", meal.nutrition.carbs], ["G", meal.nutrition.fat]].map(([l, v]) => (
                <div key={l as string}><p className="font-bold">{Math.round(Number(v))}</p><p className="text-[10px] text-muted">{l}</p></div>
              ))}
            </div>
          )}
          {meal.cooked && <p className="text-xs text-success">✓ Già cucinato: gli ingredienti sono stati scalati dalla dispensa.</p>}
        </div>
      </Modal>
    </>
  );
}

function WeekSummary({ meals, days, targetKcal }: { meals: PlannedMeal[]; days: string[]; targetKcal: number }) {
  const nut = totalNutrition(meals);
  const avg = nut.kcal / 7;
  return (
    <div className="card p-4">
      <p className="mb-3 text-sm font-bold">Riepilogo settimanale</p>
      <div className="grid grid-cols-4 gap-3">
        {[["Media kcal/g", Math.round(avg)], ["Proteine", Math.round(nut.protein) + "g"], ["Carboidrati", Math.round(nut.carbs) + "g"], ["Grassi", Math.round(nut.fat) + "g"]].map(([l, v]) => (
          <div key={l as string}>
            <p className="text-lg font-extrabold">{v}</p>
            <p className="text-xs text-muted">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted"><span>Media giornaliera vs obiettivo</span><span>{Math.round(avg)}/{targetKcal}</span></div>
        <Bar value={(avg / targetKcal) * 100} />
      </div>
    </div>
  );
}

function MealPicker({ slot, onClose }: { slot: { date: string; meal: MealType }; onClose: () => void }) {
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], []);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");

  async function pick(r: Recipe) {
    await addPlannedMeal({
      date: slot.date, meal: slot.meal, recipeId: r.id, title: r.title, servings: r.servings,
      nutrition: { kcal: r.nutrition.kcal * r.servings, protein: r.nutrition.protein * r.servings, carbs: r.nutrition.carbs * r.servings, fat: r.nutrition.fat * r.servings },
    });
    toast.success("Pasto pianificato");
    onClose();
  }
  async function addCustom() {
    if (!custom.trim()) return;
    await addPlannedMeal({ date: slot.date, meal: slot.meal, title: custom.trim(), servings: 1 });
    onClose();
  }

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal open onClose={onClose} title={`${MEAL_LABELS[slot.meal]} · ${new Date(slot.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric" })}`}>
      <div className="space-y-3">
        <input className="input" placeholder="Cerca ricetta…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {filtered.map((r) => (
            <button key={r.id} onClick={() => pick(r)} className="flex w-full items-center gap-3 rounded-xl border border-border p-2.5 text-left transition-colors hover:bg-surface-2">
              <span className="text-xl">🍽️</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="text-[11px] text-muted">{r.minutes}m · {r.nutrition.kcal} kcal · {r.nutrition.protein}g P</p>
              </div>
              <IconPlus width={16} height={16} className="text-brand" />
            </button>
          ))}
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-faint">Nessuna ricetta trovata</p>}
        </div>
        <div className="flex gap-2 border-t border-border pt-3">
          <input className="input flex-1" placeholder="Pasto libero (es. Insalata)" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} />
          <button className="btn-secondary" onClick={addCustom}><IconPlus width={16} height={16} /></button>
        </div>
      </div>
    </Modal>
  );
}
