"use client";

import { useRef, useState } from "react";
import { Segmented, Modal, Badge } from "@/components/ui";
import { toast } from "@/components/toast";
import { IconCamera, IconBarcode, IconScan, IconTrash, IconPlus } from "@/components/icons";
import { parseReceipt, lookupBarcode, type ParsedReceiptItem, type BarcodeProduct } from "@/lib/scan";
import { addPantryItem } from "@/lib/actions";
import { CATEGORY_META, ALL_CATEGORIES, ALL_UNITS, UNIT_LABELS } from "@/lib/food";
import type { FoodCategory, StorageLocation, Unit } from "@/lib/types";

type Mode = "receipt" | "barcode";

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("receipt");
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Scanner</h1>
        <p className="text-sm text-muted">Fotografa uno scontrino o scansiona un codice a barre</p>
      </div>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "receipt", label: "🧾 Scontrino" },
          { value: "barcode", label: "📷 Codice a barre" },
        ]}
      />
      {mode === "receipt" ? <ReceiptScanner /> : <BarcodeScanner />}
    </div>
  );
}

// ── Receipt ─────────────────────────────────────────────────
function ReceiptScanner() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedReceiptItem[]>([]);
  const [store, setStore] = useState<string | undefined>();
  const [location, setLocation] = useState<StorageLocation>("pantry");
  const [rawText, setRawText] = useState("");

  async function handleFile(file: File) {
    setStatus("reading");
    setProgress(0);
    setPreview(URL.createObjectURL(file));
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(file, "ita+eng", {
        logger: (m: any) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      finishParse(data.text);
    } catch {
      toast.error("Lettura non riuscita. Prova con testo manuale.");
      setStatus("idle");
    }
  }

  function finishParse(text: string) {
    setRawText(text);
    const parsed = parseReceipt(text);
    setItems(parsed.items);
    setStore(parsed.store);
    setStatus("done");
    if (parsed.items.length === 0) toast.info("Nessun prodotto riconosciuto, prova a correggere manualmente");
    else toast.success(`${parsed.items.length} prodotti riconosciuti`);
  }

  function parseManual() {
    if (rawText.trim()) finishParse(rawText);
  }

  async function confirmAll() {
    let n = 0;
    for (const it of items) {
      await addPantryItem({
        name: it.name,
        category: it.category,
        location,
        quantity: it.quantity,
        unit: it.unit,
        price: it.price,
        store,
      });
      n++;
    }
    toast.success(`${n} prodotti aggiunti alla dispensa`);
    setItems([]);
    setStatus("idle");
    setPreview(null);
  }

  const total = items.reduce((s, i) => s + (i.price || 0), 0);

  return (
    <div className="space-y-4">
      {status === "idle" && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface py-12 transition-colors hover:border-brand/50 hover:bg-brand/5"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <IconCamera width={30} height={30} />
            </span>
            <span className="font-semibold">Fotografa lo scontrino</span>
            <span className="max-w-xs text-center text-sm text-muted">
              Riconoscimento automatico di prodotti, quantità, prezzi e supermercato
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium text-muted">Oppure incolla il testo dello scontrino</summary>
            <textarea
              className="input mt-3 h-32 resize-none font-mono text-xs"
              placeholder={"ESSELUNGA\nPetto pollo 500g   5,90\nZucchine          1,80\n..."}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <button className="btn-secondary mt-2 w-full" onClick={parseManual}>Analizza testo</button>
          </details>
        </>
      )}

      {status === "reading" && (
        <div className="card flex flex-col items-center gap-4 p-8">
          {preview && <img src={preview} alt="scontrino" className="max-h-48 rounded-xl object-contain" />}
          <div className="w-full max-w-xs">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium">Lettura in corso…</span>
              <span className="tabular-nums text-muted">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {store && <Badge color="var(--info)">{store}</Badge>}
              <span className="text-sm text-muted">{items.length} prodotti · €{total.toFixed(2)}</span>
            </div>
            <select className="input w-auto py-1.5 text-sm" value={location} onChange={(e) => setLocation(e.target.value as StorageLocation)}>
              <option value="pantry">In dispensa</option>
              <option value="fridge">In frigo</option>
              <option value="freezer">Nel freezer</option>
            </select>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => (
              <ReceiptRow
                key={idx}
                item={it}
                onChange={(patch) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))}
                onDelete={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}
            <button
              className="btn-ghost w-full border border-dashed border-border"
              onClick={() => setItems((prev) => [...prev, { name: "", quantity: 1, unit: "pcs", price: 0, category: "other" }])}
            >
              <IconPlus width={16} height={16} /> Aggiungi riga
            </button>
          </div>

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => { setStatus("idle"); setItems([]); setPreview(null); }}>Annulla</button>
            <button className="btn-primary flex-1" disabled={items.length === 0} onClick={confirmAll}>
              Aggiungi {items.length} alla dispensa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptRow({ item, onChange, onDelete }: { item: ParsedReceiptItem; onChange: (p: Partial<ParsedReceiptItem>) => void; onDelete: () => void }) {
  return (
    <div className="card flex items-center gap-2 p-2.5">
      <select className="w-14 shrink-0 rounded-lg bg-surface-2 py-2 text-center text-lg" value={item.category} onChange={(e) => onChange({ category: e.target.value as FoodCategory })}>
        {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].emoji}</option>)}
      </select>
      <input className="min-w-0 flex-1 bg-transparent text-sm font-medium focus:outline-none" value={item.name} placeholder="Nome prodotto" onChange={(e) => onChange({ name: e.target.value })} />
      <input type="number" step="0.1" className="w-14 rounded-lg bg-surface-2 px-2 py-1.5 text-center text-sm" value={item.quantity} onChange={(e) => onChange({ quantity: Number(e.target.value) })} />
      <select className="w-16 rounded-lg bg-surface-2 py-1.5 text-center text-xs" value={item.unit} onChange={(e) => onChange({ unit: e.target.value as Unit })}>
        {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
      </select>
      <div className="flex items-center">
        <span className="text-xs text-faint">€</span>
        <input type="number" step="0.01" className="w-14 rounded-lg bg-surface-2 px-1.5 py-1.5 text-center text-sm" value={item.price ?? ""} onChange={(e) => onChange({ price: Number(e.target.value) })} />
      </div>
      <button className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger" onClick={onDelete}><IconTrash width={16} height={16} /></button>
    </div>
  );
}

// ── Barcode ─────────────────────────────────────────────────
function BarcodeScanner() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function search(c: string) {
    if (!c.trim()) return;
    setLoading(true);
    setNotFound(false);
    setProduct(null);
    const p = await lookupBarcode(c.trim());
    setLoading(false);
    if (p) setProduct(p);
    else setNotFound(true);
  }

  async function startCamera() {
    // Uses the native BarcodeDetector when available.
    const BD = (window as any).BarcodeDetector;
    if (!BD) { toast.info("Scanner live non supportato: inserisci il codice manualmente"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new BD({ formats: ["ean_13", "ean_8", "upc_a", "code_128"] });
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length) {
            stream.getTracks().forEach((t) => t.stop());
            setScanning(false);
            setCode(codes[0].rawValue);
            search(codes[0].rawValue);
            return;
          }
        } catch {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      toast.error("Impossibile accedere alla fotocamera");
      setScanning(false);
    }
  }

  return (
    <div className="space-y-4">
      {scanning ? (
        <div className="relative overflow-hidden rounded-3xl bg-black">
          <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-56 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>
        </div>
      ) : (
        <button onClick={startCamera} className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface py-10 transition-colors hover:border-brand/50 hover:bg-brand/5">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand"><IconBarcode width={30} height={30} /></span>
          <span className="font-semibold">Scansiona con la fotocamera</span>
          <span className="text-sm text-muted">o inserisci il codice qui sotto</span>
        </button>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Codice a barre (EAN)"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(code)}
        />
        <button className="btn-primary" onClick={() => search(code)} disabled={loading}>
          <IconScan width={18} height={18} /> {loading ? "…" : "Cerca"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-faint">Prova:</span>
        {["8076809513388", "3017620422003", "8000500310427"].map((ex) => (
          <button key={ex} className="chip" onClick={() => { setCode(ex); search(ex); }}>{ex}</button>
        ))}
      </div>

      {notFound && (
        <div className="card border-warning/30 bg-warning/5 p-4 text-sm">
          Prodotto non trovato nel database. Puoi <a href="/pantry" className="font-semibold text-brand">aggiungerlo manualmente</a>.
        </div>
      )}

      {product && <ProductResult product={product} onDone={() => { setProduct(null); setCode(""); }} />}
    </div>
  );
}

function ProductResult({ product, onDone }: { product: BarcodeProduct; onDone: () => void }) {
  const [open, setOpen] = useState(true);
  const [location, setLocation] = useState<StorageLocation>("pantry");
  const [qty, setQty] = useState(1);

  async function add() {
    await addPantryItem({
      name: product.name,
      brand: product.brand,
      category: product.category,
      location,
      quantity: qty,
      unit: "pack",
      barcode: product.barcode,
      imageUrl: product.imageUrl,
      nutrition: product.nutrition,
      nutritionBasis: "per100g",
      unitWeightG: product.unitWeightG,
      allergens: product.allergens,
    });
    toast.success(`${product.name} aggiunto`);
    setOpen(false);
    onDone();
  }

  return (
    <Modal open={open} onClose={() => { setOpen(false); onDone(); }} title="Prodotto trovato"
      footer={<><button className="btn-secondary flex-1" onClick={() => { setOpen(false); onDone(); }}>Chiudi</button><button className="btn-primary flex-1" onClick={add}>Aggiungi</button></>}>
      <div className="space-y-4">
        <div className="flex gap-3">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="h-20 w-20 rounded-xl border border-border object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-2 text-3xl">{CATEGORY_META[product.category].emoji}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight">{product.name}</p>
            {product.brand && <p className="text-sm text-muted">{product.brand}</p>}
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge>{CATEGORY_META[product.category].label}</Badge>
              {product.quantityText && <Badge color="var(--info)">{product.quantityText}</Badge>}
            </div>
          </div>
        </div>

        {product.nutrition && (
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center">
            {[["kcal", product.nutrition.kcal], ["Prot", product.nutrition.protein], ["Carb", product.nutrition.carbs], ["Grassi", product.nutrition.fat]].map(([l, v]) => (
              <div key={l as string}>
                <p className="text-sm font-bold">{Math.round(Number(v))}</p>
                <p className="text-[10px] text-muted">{l}</p>
              </div>
            ))}
            <p className="col-span-4 text-[10px] text-faint">valori per 100g</p>
          </div>
        )}

        {product.allergens && product.allergens.length > 0 && (
          <div>
            <p className="label mb-1">Allergeni</p>
            <div className="flex flex-wrap gap-1">
              {product.allergens.map((a) => <Badge key={a} color="var(--danger)">{a}</Badge>)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Quantità</label>
            <input type="number" min={1} className="input mt-1" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Posizione</label>
            <select className="input mt-1" value={location} onChange={(e) => setLocation(e.target.value as StorageLocation)}>
              <option value="pantry">Dispensa</option>
              <option value="fridge">Frigo</option>
              <option value="freezer">Freezer</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
