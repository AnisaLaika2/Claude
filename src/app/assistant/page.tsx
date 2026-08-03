"use client";

import { useEffect, useRef, useState } from "react";
import { db, todayKey } from "@/lib/db";
import { expiryStatus, fmtQty } from "@/lib/food";
import { askAssistant, type AssistantContext } from "@/lib/ai";
import { IconSpark, IconSend } from "@/components/icons";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Cosa cucino stasera?",
  "Cosa sta per scadere?",
  "Quali alimenti devo comprare?",
  "Fammi una cena da 600 calorie",
  "Ho mangiato abbastanza proteine oggi?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Ciao! Sono il tuo assistente di cucina. Posso aiutarti con ricette, scadenze, spesa e nutrizione. Cosa ti serve?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function buildContext(): Promise<AssistantContext> {
    const pantry = await db.pantry.toArray();
    const active = pantry.filter((p) => p.quantity > 0);
    const expiring = active.filter((p) => ["expired", "critical", "soon"].includes(expiryStatus(p.expiryDate)));
    const consumption = await db.consumption.where("date").equals(todayKey()).toArray();
    const profile = await db.profile.get("me");
    const today = consumption.reduce(
      (a, c) => ({
        kcal: a.kcal + (c.nutrition?.kcal || 0),
        protein: a.protein + (c.nutrition?.protein || 0),
        carbs: a.carbs + (c.nutrition?.carbs || 0),
        fat: a.fat + (c.nutrition?.fat || 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return {
      pantrySummary: active.slice(0, 25).map((p) => `${p.name} (${fmtQty(p.quantity, p.unit)})`).join(", ") || "vuota",
      expiringSoon: expiring.map((p) => p.name).join(", "),
      todayNutrition: today,
      targets: profile
        ? { kcal: profile.targetKcal, protein: profile.targetProtein, carbs: profile.targetCarbs, fat: profile.targetFat }
        : undefined,
    };
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const ctx = await buildContext();
      const answer = await askAssistant(text, ctx);
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Ops, si è verificato un problema. Riprova tra poco." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col animate-fade-in lg:h-[calc(100vh-4rem)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"><IconSpark width={20} height={20} /></span>
        <div>
          <h1 className="text-lg font-extrabold leading-tight">Assistente</h1>
          <p className="text-xs text-muted">Conosce la tua dispensa e i tuoi obiettivi</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "user" ? "rounded-br-md bg-brand text-brand-fg" : "rounded-bl-md bg-surface border border-border"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 2 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="chip hover:chip-active">{s}</button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Scrivi un messaggio…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <button className="btn-primary" onClick={() => send(input)} disabled={loading || !input.trim()}>
          <IconSend width={18} height={18} />
        </button>
      </div>
    </div>
  );
}
