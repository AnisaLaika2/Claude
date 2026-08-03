import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Body {
  type: "recipe" | "assistant";
  ingredients?: string[];
  constraints?: {
    maxMinutes?: number;
    maxKcal?: number;
    servings?: number;
    diet?: string;
    avoid?: string[];
  };
  question?: string;
  context?: {
    pantrySummary?: string;
    expiringSoon?: string;
    todayNutrition?: Record<string, number>;
    targets?: Record<string, number>;
  };
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

async function callClaude(system: string, user: string, maxTokens = 1400): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = msg.content.find((b) => b.type === "text");
    return block && "text" in block ? block.text : null;
  } catch (e) {
    console.error("Claude call failed", e);
    return null;
  }
}

function extractJSON(text: string): any | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ── Heuristic fallback recipe generator (works without an API key) ──
function heuristicRecipe(ingredients: string[], c: Body["constraints"] = {}) {
  const main = ingredients.slice(0, 4);
  const has = (re: RegExp) => ingredients.some((i) => re.test(i.toLowerCase()));
  const hasProtein = has(/pollo|manzo|maiale|pesce|salmone|tonno|uova|uovo|tofu|legumi|ceci|fagioli/);
  const hasCarb = has(/pasta|riso|pane|patat|spaghett|couscous/);

  const title = main.length
    ? `${main[0].charAt(0).toUpperCase() + main[0].slice(1)}${
        main[1] ? " con " + main[1] : ""
      }`
    : "Piatto svuota-frigo";

  const minutes = Math.min(c?.maxMinutes || 25, 25);
  const servings = c?.servings || 2;

  const steps = [
    "Prepara e lava tutti gli ingredienti, tagliandoli in pezzi regolari.",
    hasProtein
      ? "Scalda un filo d'olio in padella e rosola la parte proteica finché dorata."
      : "Scalda un filo d'olio in una padella capiente.",
    `Aggiungi ${main.slice(1).join(", ") || "le verdure"} e cuoci a fuoco medio per ${Math.round(
      minutes / 2
    )} minuti, mescolando.`,
    hasCarb
      ? "Nel frattempo cuoci la parte di carboidrati secondo i tempi indicati, poi unisci il tutto."
      : "Regola di sale e pepe e insaporisci con erbe aromatiche.",
    "Manteca, impiatta e servi caldo.",
  ];

  const kcal = Math.min(c?.maxKcal || 520, 520);
  return {
    title,
    description: `Una ricetta veloce e bilanciata che usa ${main.join(", ")} già presenti nella tua dispensa.`,
    ingredients: ingredients.map((name) => ({
      name,
      quantity: /olio|sale/.test(name.toLowerCase()) ? 10 : 150,
      unit: /olio/.test(name.toLowerCase()) ? "ml" : "g",
    })),
    steps,
    minutes,
    difficulty: "easy" as const,
    servings,
    nutrition: {
      kcal,
      protein: hasProtein ? 34 : 16,
      carbs: hasCarb ? 55 : 24,
      fat: 18,
      fiber: 6,
    },
    tags: [
      c?.diet && c.diet !== "none" ? c.diet : "svuota-frigo",
      minutes <= 20 ? "veloce" : "facile",
    ],
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (body.type === "recipe") {
    const ingredients = (body.ingredients || []).filter(Boolean);
    const c = body.constraints || {};
    const system =
      "Sei uno chef esperto e nutrizionista. Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo. " +
      "Schema: {title, description, ingredients:[{name, quantity(number), unit}], steps:[string], minutes(number), difficulty('easy'|'medium'|'hard'), servings(number), nutrition:{kcal,protein,carbs,fat,fiber}, tags:[string]}. " +
      "Scrivi in italiano. La nutrizione è per porzione.";
    const constraintsText = [
      c.maxMinutes ? `massimo ${c.maxMinutes} minuti` : "",
      c.maxKcal ? `massimo ${c.maxKcal} kcal a porzione` : "",
      c.servings ? `${c.servings} porzioni` : "",
      c.diet && c.diet !== "none" ? `dieta ${c.diet}` : "",
      c.avoid?.length ? `evita: ${c.avoid.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    const user = `Crea una ricetta usando principalmente questi ingredienti: ${ingredients.join(
      ", "
    )}.${constraintsText ? " Vincoli: " + constraintsText + "." : ""}`;

    const text = await callClaude(system, user);
    const parsed = text ? extractJSON(text) : null;
    const recipe = parsed && parsed.title ? parsed : heuristicRecipe(ingredients, c);
    return NextResponse.json({ recipe, source: parsed ? "ai" : "heuristic" });
  }

  // Assistant
  const q = body.question || "";
  const ctx = body.context || {};
  const system =
    "Sei l'assistente di Cibo, un'app per la gestione della dispensa e dei pasti. " +
    "Rispondi in modo conciso, pratico e amichevole, in italiano. Usa i dati forniti sulla dispensa dell'utente. " +
    "Se mancano dati, dai comunque un consiglio utile.";
  const user = `Domanda: ${q}\n\nContesto dispensa:\n${ctx.pantrySummary || "(vuota)"}\n\nIn scadenza: ${
    ctx.expiringSoon || "niente"
  }\n\nNutrizione di oggi: ${JSON.stringify(ctx.todayNutrition || {})}\nObiettivi: ${JSON.stringify(
    ctx.targets || {}
  )}`;

  const text = await callClaude(system, user, 700);
  const answer = text || heuristicAssistant(q, ctx);
  return NextResponse.json({ answer, source: text ? "ai" : "heuristic" });
}

function heuristicAssistant(q: string, ctx: Body["context"] = {}): string {
  const low = q.toLowerCase();
  if (/scad/.test(low)) {
    return ctx.expiringSoon
      ? `Stanno per scadere: ${ctx.expiringSoon}. Ti consiglio di usarli in una ricetta oggi o domani.`
      : "Non ci sono prodotti in scadenza imminente. Ottimo lavoro!";
  }
  if (/cucino|cena|pranzo|cosa mangio/.test(low)) {
    return `In base alla tua dispensa (${
      ctx.pantrySummary || "vuota"
    }), puoi preparare un piatto veloce con gli ingredienti in scadenza. Apri la sezione Ricette AI per una proposta completa.`;
  }
  if (/comprare|spesa|manca/.test(low)) {
    return "Controlla la Lista della spesa: la aggiorno automaticamente con i prodotti terminati o quasi finiti e con gli ingredienti dei pasti pianificati.";
  }
  if (/proteine|calorie|macro/.test(low)) {
    return `Oggi hai assunto circa ${
      ctx.todayNutrition?.kcal || 0
    } kcal e ${ctx.todayNutrition?.protein || 0}g di proteine. Confronta con i tuoi obiettivi nella Dashboard.`;
  }
  return `Posso aiutarti con dispensa, ricette, scadenze e spesa. La tua dispensa contiene: ${
    ctx.pantrySummary || "nessun prodotto"
  }.`;
}
