"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayKey } from "@/lib/db";
import {
  recipeMatchScore, recipeMissing, saveRecipe, toggleFavorite, deleteRecipe,
  addShoppingItem, addPlannedMeal, cookMeal,
} from "@/lib/actions";
import { generateRecipe, toRecipe } from "@/lib/ai";
import { Modal, Badge, Segmented, EmptyState } from "@/components/ui";
import { toast } from "@/components/toast";
import { IconSpark, IconClock, IconFlame, IconHeart, IconChef, IconCart, IconCalendar, IconTrash } from "@/components/icons";
import { guessCategoryExport } from "@/lib/misc";
import type { Recipe, MealType, PantryItem } from "@/lib/types";

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
      <RecipesInner />
    </Suspense>
  );
}

function RecipesInner() {
  const params = useSearchParams();
  const recipes = useLiveQuery(() => db.recipes.reverse().toArray(), [], undefined);
  const pantry = useLiveQuery(() => db.pantry.toArray(), [], []);
  const [tab, setTab] = useState<"all" | "cookable" | "fav">("all");
  const [genOpen, setGenOpen] = useState(false);
  const [detail, setDetail] = useState<Recipe | null>(null);

  useEffect(() => {
    const openId = params.get("open");
    if (openId && recipes) {
      const r = recipes.find((x) => x.id === openId);
      if (r) setDetail(r);
    }
  }, [params, recipes]);

  const list = useMemo(() => {
    if (!recipes) return [];
    let l = recipes.map((r) => ({ r, score: recipeMatchScore(r, pantry) }));
    if (tab === "cookable") l = l.filter((x) => x.score >= 0.6);
    if (tab === "fav") l = l.filter((x) => x.r.favorite);
    return l.sort((a, b) => b.score - a.score);
  }, [recipes, pantry, tab]);

  if (!recipes) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Ricette</h1>
          <p className="text-sm text-muted">{recipes.length} ricette · generate dall'AI o salvate</p>
        </div>
        <button className="btn-primary" onClick={() => setGenOpen(true)}>
          <IconSpark width={18} height={18} /> Genera
        </button>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "all", label: "Tutte" },
          { value: "cookable", label: "Cucinabili" },
          { value: "fav", label: "❤️ Preferite" },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<IconChef width={40} height={40} />}
          title="Nessuna ricetta"
          subtitle="Genera una ricetta con l'AI a partire dagli ingredienti che hai in casa."
          action={<button className="btn-primary" onClick={() => setGenOpen(true)}><IconSpark width={18} height={18} /> Genera ricetta</button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ r, score }) => (
            <RecipeCard key={r.id} recipe={r} score={score} onOpen={() => setDetail(r)} />
          ))}
        </div>
      )}

      <AIGenerator open={genOpen} onClose={() => setGenOpen(false)} onGenerated={(r) => setDetail(r)} />
      {detail && <RecipeDetail recipe={detail} pantry={pantry} onClose={() => setDetail(null)} />}
    </div>
  );
}

function RecipeCard({ recipe, score, onOpen }: { recipe: Recipe; score: number; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card group flex flex-col gap-3 p-4 text-left transition-all hover:shadow-lift">
      <div className="flex items-start justify-between">
        <span className="text-3xl">🍽️</span>
        <div className="flex items-center gap-2">
          {recipe.source === "ai" && <Badge color="var(--info)"><IconSpark width={11} height={11} /> AI</Badge>}
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">{Math.round(score * 100)}%</span>
        </div>
      </div>
      <div>
        <p className="font-semibold leading-tight">{recipe.title}</p>
        {recipe.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{recipe.description}</p>}
      </div>
      <div className="mt-auto flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1"><IconClock width={13} height={13} /> {recipe.minutes}m</span>
        <span className="flex items-center gap-1"><IconFlame width={13} height={13} /> {recipe.nutrition.kcal}</span>
        <span>{recipe.nutrition.protein}g P</span>
        {recipe.favorite && <IconHeart width={13} height={13} className="ml-auto text-danger" fill="currentColor" />}
      </div>
    </button>
  );
}

function RecipeDetail({ recipe, pantry, onClose }: { recipe: Recipe; pantry: PantryItem[]; onClose: () => void }) {
  const p = pantry;
  const missing = recipeMissing(recipe, p);
  const missingSet = new Set(missing.map((m) => m.name));
  const [servings, setServings] = useState(recipe.servings);
  const factor = servings / recipe.servings;

  async function addMissingToShopping() {
    for (const m of missing) {
      await addShoppingItem({ name: m.name, category: guessCategoryExport(m.name), quantity: +(m.quantity * factor).toFixed(1), unit: m.unit, auto: true, reason: `Ricetta: ${recipe.title}` });
    }
    toast.success(`${missing.length} ingredienti aggiunti alla spesa`);
  }

  async function addToPlanner(meal: MealType) {
    await addPlannedMeal({
      date: todayKey(),
      meal,
      recipeId: recipe.id,
      title: recipe.title,
      servings,
      nutrition: { kcal: recipe.nutrition.kcal * servings, protein: recipe.nutrition.protein * servings, carbs: recipe.nutrition.carbs * servings, fat: recipe.nutrition.fat * servings },
    });
    toast.success("Aggiunto al planner di oggi");
    onClose();
  }

  async function cookNow() {
    // Create a temporary planned meal and cook it to deduct from pantry.
    const id = await addPlannedMeal({ date: todayKey(), meal: "dinner", recipeId: recipe.id, title: recipe.title, servings });
    const res = await cookMeal(id);
    if (res.missing.length) toast.info(`Cucinato! Mancavano: ${res.missing.join(", ")}`);
    else toast.success("Cucinato! Ingredienti scalati dalla dispensa");
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={recipe.title} wide
      footer={
        <>
          <button className="btn-secondary flex-1" onClick={cookNow}>👨‍🍳 Cucina ora</button>
          <button className="btn-primary flex-1" onClick={() => addToPlanner("dinner")}><IconCalendar width={16} height={16} /> Pianifica</button>
        </>
      }>
      <div className="space-y-4">
        {recipe.description && <p className="text-sm text-muted">{recipe.description}</p>}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => toggleFavorite(recipe.id)} className={`chip ${recipe.favorite ? "chip-active" : ""}`}>
            <IconHeart width={13} height={13} /> {recipe.favorite ? "Preferita" : "Salva"}
          </button>
          {recipe.tags.map((t) => <span key={t} className="chip">{t}</span>)}
          {recipe.source !== "seed" && (
            <button onClick={() => { deleteRecipe(recipe.id); onClose(); }} className="chip text-danger"><IconTrash width={13} height={13} /> Elimina</button>
          )}
        </div>

        {/* Nutrition per serving */}
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
          {[["kcal", recipe.nutrition.kcal], ["Proteine", recipe.nutrition.protein], ["Carb", recipe.nutrition.carbs], ["Grassi", recipe.nutrition.fat]].map(([l, v]) => (
            <div key={l as string}>
              <p className="font-bold">{Math.round(Number(v))}<span className="text-xs font-normal text-faint">{l === "kcal" ? "" : "g"}</span></p>
              <p className="text-[10px] text-muted">{l}</p>
            </div>
          ))}
          <p className="col-span-4 text-[10px] text-faint">per porzione · {recipe.minutes} min · {recipe.difficulty}</p>
        </div>

        {/* Servings */}
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
          <span className="text-sm font-medium">Porzioni</span>
          <div className="inline-flex items-center gap-3">
            <button className="text-lg text-muted" onClick={() => setServings(Math.max(1, servings - 1))}>−</button>
            <span className="w-6 text-center font-semibold">{servings}</span>
            <button className="text-lg text-muted" onClick={() => setServings(servings + 1)}>+</button>
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label">Ingredienti</p>
            {missing.length > 0 && (
              <button onClick={addMissingToShopping} className="flex items-center gap-1 text-xs font-medium text-brand">
                <IconCart width={13} height={13} /> Aggiungi {missing.length} mancanti
              </button>
            )}
          </div>
          <div className="space-y-1">
            {recipe.ingredients.map((ing, i) => {
              const has = !missingSet.has(ing.name);
              return (
                <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${has ? "bg-success" : "bg-danger"}`} />
                    {ing.name}
                  </span>
                  <span className="text-muted">{+(ing.quantity * factor).toFixed(1)} {ing.unit}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps */}
        <div>
          <p className="label mb-2">Preparazione</p>
          <ol className="space-y-2.5">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  );
}

function AIGenerator({ open, onClose, onGenerated }: { open: boolean; onClose: () => void; onGenerated: (r: Recipe) => void }) {
  const pantry = useLiveQuery(() => db.pantry.toArray(), [], []);
  const [ingredients, setIngredients] = useState("");
  const [maxMinutes, setMaxMinutes] = useState<number | "">("");
  const [maxKcal, setMaxKcal] = useState<number | "">("");
  const [diet, setDiet] = useState("none");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && !ingredients) {
      // Prefill with expiring / available ingredients
      const names = pantry.filter((p) => p.quantity > 0).slice(0, 6).map((p) => p.name);
      setIngredients(names.join(", "));
    }
  }, [open, pantry, ingredients]);

  async function generate() {
    const list = ingredients.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return toast.error("Inserisci almeno un ingrediente");
    setLoading(true);
    try {
      const g = await generateRecipe(list, {
        maxMinutes: maxMinutes || undefined,
        maxKcal: maxKcal || undefined,
        diet,
      });
      const id = await saveRecipe(toRecipe(g));
      const saved = await db.recipes.get(id);
      toast.success("Ricetta generata!");
      onClose();
      if (saved) onGenerated(saved);
    } catch {
      toast.error("Generazione non riuscita, riprova");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Genera ricetta con AI"
      footer={<button className="btn-primary w-full" onClick={generate} disabled={loading}>{loading ? "Sto cucinando…" : "✨ Genera ricetta"}</button>}>
      <div className="space-y-4">
        <div>
          <label className="label">Ingredienti che hai</label>
          <textarea className="input mt-1 h-20 resize-none" placeholder="pollo, zucchine, parmigiano…" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
          <p className="mt-1 text-[11px] text-faint">Separa con la virgola. Precompilato dalla tua dispensa.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Max minuti</label>
            <input type="number" className="input mt-1" placeholder="es. 20" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Max kcal</label>
            <input type="number" className="input mt-1" placeholder="es. 500" value={maxKcal} onChange={(e) => setMaxKcal(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="label">Dieta</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[["none", "Nessuna"], ["vegetarian", "Vegetariana"], ["vegan", "Vegana"], ["mediterranean", "Mediterranea"], ["keto", "Keto"]].map(([v, l]) => (
              <button key={v} onClick={() => setDiet(v)} className={`chip ${diet === v ? "chip-active" : ""}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
          💡 L'AI usa prima gli ingredienti in scadenza per aiutarti a ridurre gli sprechi.
        </div>
      </div>
    </Modal>
  );
}
