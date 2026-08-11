import { useMemo, useRef, useState } from 'react';
import { useData } from '../store/DataContext';
import { EmptyState } from '../components/ui';
import type {
  ImportProfile,
  RawRow,
  StagedTransaction,
  Transaction,
} from '../types';
import { parseTabular, type TabularData } from '../lib/parsers/tabular';
import { isBankFormat, parseBankFile } from '../lib/parsers/bank-formats';
import { parseAmount, parseDate } from '../lib/parse-values';
import { computeDedupHash } from '../lib/dedup';
import { categorize } from '../lib/categorize';
import { formatCurrency, formatDate, uid } from '../lib/format';

type Step = 'upload' | 'mapping' | 'preview';

const blankMapping: Omit<ImportProfile, 'id' | 'name'> = {
  dateColumn: '',
  amountColumn: '',
  descriptionColumn: '',
  detailsColumn: '',
  categoryColumn: '',
  accountColumn: '',
  debitColumn: '',
  creditColumn: '',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

/** Unisce descrizione e dettagli in un unico testo leggibile. */
function combineDescription(main: string, details: string): string {
  const m = main.replace(/\s+/g, ' ').trim();
  const d = details.replace(/\s+/g, ' ').trim();
  if (!d || d === m || m.includes(d)) return m || d;
  if (!m) return d;
  return `${m} — ${d}`;
}

export default function ImportWizard({ onDone }: { onDone: () => void }) {
  const {
    transactions,
    categories,
    rules,
    profiles,
    addTransactions,
    saveProfile,
    saveCategory,
  } = useData();

  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [tabular, setTabular] = useState<TabularData | null>(null);
  const [mapping, setMapping] = useState<Omit<ImportProfile, 'id' | 'name'>>({
    ...blankMapping,
  });
  const [staged, setStaged] = useState<StagedTransaction[]>([]);
  const [saveProfileName, setSaveProfileName] = useState('');
  // Origine dei movimenti (Conto o Carta): salvata come metodo di pagamento,
  // senza importare il numero di conto/carta.
  const [origin, setOrigin] = useState('Conto corrente');

  const existingHashes = useMemo(
    () => new Set(transactions.map((t) => t.dedupHash).filter(Boolean) as string[]),
    [transactions],
  );

  function reset() {
    setStep('upload');
    setError('');
    setFileName('');
    setTabular(null);
    setMapping({ ...blankMapping });
    setStaged([]);
    setSaveProfileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onFile(file: File) {
    setError('');
    setFileName(file.name);
    try {
      if (isBankFormat(file.name)) {
        // OFX/QIF: già normalizzati, si va direttamente all'anteprima.
        const bankTxs = await parseBankFile(file);
        if (bankTxs.length === 0) {
          setError('Nessun movimento trovato nel file.');
          return;
        }
        const stagedTxs = bankTxs.map((b) =>
          toStaged(b.date, b.amount, b.description),
        );
        setStaged(stagedTxs);
        setStep('preview');
      } else {
        const data = await parseTabular(file);
        if (data.rows.length === 0) {
          setError('Il file non contiene righe di dati.');
          return;
        }
        setTabular(data);
        setMapping((m) => ({ ...m, ...autoGuessColumns(data.columns) }));
        setStep('mapping');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante la lettura del file.');
    }
  }

  function toStaged(
    dateISO: string,
    signedAmount: number,
    description: string,
    opts?: { fileCategory?: string; paymentMethod?: string; transfer?: boolean },
  ): StagedTransaction {
    const type = signedAmount < 0 ? 'expense' : 'income';
    const amount = Math.abs(signedAmount);
    const hash = computeDedupHash(dateISO, amount, description);

    // Priorità: le regole (imparate dalle correzioni dell'utente) vincono sulla
    // categoria del file. Se una regola corrisponde alla descrizione, la si usa;
    // altrimenti si terrà la categoria letta dall'estratto conto.
    const ruleCat = type === 'expense' ? categorize(description, rules) : null;
    const fileCat = opts?.fileCategory?.trim() || undefined;

    return {
      tempId: uid(),
      date: dateISO,
      amount,
      type,
      description,
      categoryId: ruleCat,
      fileCategory: ruleCat ? undefined : fileCat,
      paymentMethod: opts?.paymentMethod,
      excludeFromTotals: opts?.transfer || undefined,
      dedupHash: hash,
      duplicate: existingHashes.has(hash),
      selected: !existingHashes.has(hash),
    };
  }

  function buildPreviewFromTabular() {
    if (!tabular) return;
    setError('');
    if (!mapping.dateColumn || !mapping.descriptionColumn) {
      setError('Seleziona almeno le colonne Data e Descrizione.');
      return;
    }
    const hasSingleAmount = !!mapping.amountColumn;
    const hasSplit = !!mapping.debitColumn || !!mapping.creditColumn;
    if (!hasSingleAmount && !hasSplit) {
      setError('Seleziona la colonna Importo (oppure le colonne Uscite/Entrate).');
      return;
    }

    const seenInFile = new Set<string>();
    const result: StagedTransaction[] = [];
    let skipped = 0;

    for (const row of tabular.rows) {
      const dateISO = parseDate(get(row, mapping.dateColumn), mapping.dateFormat);
      const description = combineDescription(
        get(row, mapping.descriptionColumn),
        get(row, mapping.detailsColumn || ''),
      );
      if (!dateISO || !description) {
        skipped++;
        continue;
      }

      let signed: number | null = null;
      if (hasSingleAmount) {
        signed = parseAmount(get(row, mapping.amountColumn), mapping.decimalSeparator);
      } else {
        const debit = parseAmount(get(row, mapping.debitColumn || ''), mapping.decimalSeparator);
        const credit = parseAmount(get(row, mapping.creditColumn || ''), mapping.decimalSeparator);
        if (debit) signed = -Math.abs(debit);
        else if (credit) signed = Math.abs(credit);
      }
      if (signed === null || signed === 0 || Number.isNaN(signed)) {
        skipped++;
        continue;
      }

      const fileCategory = mapping.categoryColumn
        ? get(row, mapping.categoryColumn)
        : undefined;

      // Conto o Carta: se la colonna "Conto o carta" è vuota, è un movimento
      // della carta prepagata; altrimenti è del conto.
      let paymentMethod: string | undefined;
      if (mapping.accountColumn) {
        paymentMethod = get(row, mapping.accountColumn).trim()
          ? 'Conto corrente'
          : 'Carta prepagata';
      }

      // Giroconto: le ricariche della carta prepagata (uscita dal conto e
      // relativo accredito sulla carta) non sono spese/entrate reali.
      const op = get(row, mapping.descriptionColumn).trim().toLowerCase();
      const catText = (fileCategory || '').toLowerCase();
      const transfer =
        op === 'ricarica' ||
        op.includes('ricarica carta prepagata') ||
        catText.includes('ricarica cart');

      const st = toStaged(dateISO, signed, description, {
        fileCategory,
        paymentMethod,
        transfer,
      });
      // Duplicato anche all'interno dello stesso file.
      if (seenInFile.has(st.dedupHash)) {
        st.duplicate = true;
        st.selected = false;
      }
      seenInFile.add(st.dedupHash);
      result.push(st);
    }

    if (result.length === 0) {
      setError(
        `Nessuna riga valida trovata${skipped ? ` (${skipped} righe ignorate)` : ''}. Verifica la mappatura delle colonne.`,
      );
      return;
    }
    setStaged(result);
    setStep('preview');
  }

  async function doImport() {
    const toImport = staged.filter((s) => s.selected);
    if (toImport.length === 0) {
      setError('Nessuna transazione selezionata.');
      return;
    }

    // Risolve le categorie lette dal file: cerca una categoria esistente con lo
    // stesso nome (ignorando maiuscole), altrimenti la crea al volo.
    const byName = new Map<string, string>();
    for (const c of categories) byName.set(c.name.trim().toLowerCase(), c.id);
    const palette = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#84cc16', '#eab308', '#f43f5e', '#8b5cf6'];

    async function resolveCategory(name: string, type: 'expense' | 'income'): Promise<string> {
      const key = name.trim().toLowerCase();
      const existing = byName.get(key);
      if (existing) return existing;
      const id = uid();
      await saveCategory({
        id,
        name: name.trim(),
        color: palette[byName.size % palette.length],
        type,
        budget: 0,
      });
      byName.set(key, id);
      return id;
    }

    const txs: Transaction[] = [];
    for (const s of toImport) {
      let categoryId = s.categoryId;
      if (!categoryId && s.fileCategory) {
        categoryId = await resolveCategory(s.fileCategory, s.type);
      }
      txs.push({
        id: uid(),
        date: s.date,
        amount: s.amount,
        type: s.type,
        description: s.description,
        categoryId,
        paymentMethod: s.paymentMethod || origin.trim() || 'Banca',
        notes: '',
        excludeFromTotals: s.excludeFromTotals,
        source: 'import',
        dedupHash: s.dedupHash,
        createdAt: Date.now(),
      });
    }
    await addTransactions(txs);

    if (saveProfileName.trim() && tabular) {
      await saveProfile({
        id: uid(),
        name: saveProfileName.trim(),
        ...mapping,
      });
    }
    alert(`Importate ${txs.length} transazioni.`);
    reset();
    onDone();
  }

  function applyProfile(p: ImportProfile) {
    setMapping({
      dateColumn: p.dateColumn,
      amountColumn: p.amountColumn,
      descriptionColumn: p.descriptionColumn,
      detailsColumn: p.detailsColumn ?? '',
      categoryColumn: p.categoryColumn ?? '',
      accountColumn: p.accountColumn ?? '',
      debitColumn: p.debitColumn ?? '',
      creditColumn: p.creditColumn ?? '',
      dateFormat: p.dateFormat,
      decimalSeparator: p.decimalSeparator,
    });
  }

  // ---------------- RENDER ----------------
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Importa rendiconto</h2>
        {step !== 'upload' && (
          <button className="btn-secondary ml-auto" onClick={reset}>
            Ricomincia
          </button>
        )}
      </div>

      <Steps step={step} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="card p-6">
          <p className="mb-4 text-sm text-slate-600">
            Carica il file scaricato dalla tua banca. Formati supportati:{' '}
            <strong>CSV</strong>, <strong>XLSX</strong>, <strong>OFX/QFX</strong> e{' '}
            <strong>QIF</strong>.
          </p>

          <div className="mb-4 max-w-sm">
            <label className="label">Questi movimenti sono di…</label>
            <input
              className="input"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              list="origin-options"
              placeholder="Es. Conto corrente"
            />
            <datalist id="origin-options">
              <option value="Conto corrente" />
              <option value="Carta prepagata" />
              <option value="Carta di credito" />
            </datalist>
            <p className="mt-1 text-xs text-slate-400">
              Serve solo per distinguere Conto e Carta nei movimenti. Il numero di
              conto/carta non viene importato.
            </p>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center hover:border-brand-400 hover:bg-brand-50">
            <span className="text-3xl">📄</span>
            <span className="mt-2 font-medium text-slate-700">
              Clicca per scegliere un file
            </span>
            <span className="text-xs text-slate-400">o trascinalo qui</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.ofx,.qfx,.qif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
          {fileName && (
            <p className="mt-3 text-sm text-slate-500">File: {fileName}</p>
          )}
        </div>
      )}

      {step === 'mapping' && tabular && (
        <div className="card space-y-4 p-6">
          {profiles.length > 0 && (
            <div>
              <label className="label">Profilo salvato</label>
              <div className="flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    className="btn-secondary"
                    onClick={() => applyProfile(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ColumnSelect
              label="Colonna Data *"
              columns={tabular.columns}
              value={mapping.dateColumn}
              onChange={(v) => setMapping((m) => ({ ...m, dateColumn: v }))}
            />
            <ColumnSelect
              label="Colonna Descrizione *"
              columns={tabular.columns}
              value={mapping.descriptionColumn}
              onChange={(v) => setMapping((m) => ({ ...m, descriptionColumn: v }))}
            />
            <ColumnSelect
              label="Colonna Dettagli (facoltativa)"
              columns={tabular.columns}
              value={mapping.detailsColumn || ''}
              onChange={(v) => setMapping((m) => ({ ...m, detailsColumn: v }))}
            />
            <ColumnSelect
              label="Colonna Categoria (facoltativa)"
              columns={tabular.columns}
              value={mapping.categoryColumn || ''}
              onChange={(v) => setMapping((m) => ({ ...m, categoryColumn: v }))}
            />
            <ColumnSelect
              label="Colonna Conto/Carta (facoltativa)"
              columns={tabular.columns}
              value={mapping.accountColumn || ''}
              onChange={(v) => setMapping((m) => ({ ...m, accountColumn: v }))}
            />
            {mapping.accountColumn && (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Con la colonna Conto/Carta: le righe con il conto valorizzato sono
                del <strong>conto</strong>, quelle vuote della <strong>carta</strong>.
                Le <strong>ricariche della carta</strong> vengono segnate come
                giroconto e non contano nei totali (così non si sommano due volte).
              </p>
            )}
            <ColumnSelect
              label="Colonna Importo (con segno)"
              columns={tabular.columns}
              value={mapping.amountColumn}
              onChange={(v) => setMapping((m) => ({ ...m, amountColumn: v }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <ColumnSelect
                label="Colonna Uscite"
                columns={tabular.columns}
                value={mapping.debitColumn || ''}
                onChange={(v) => setMapping((m) => ({ ...m, debitColumn: v }))}
              />
              <ColumnSelect
                label="Colonna Entrate"
                columns={tabular.columns}
                value={mapping.creditColumn || ''}
                onChange={(v) => setMapping((m) => ({ ...m, creditColumn: v }))}
              />
            </div>
            <div>
              <label className="label">Formato data</label>
              <select
                className="input"
                value={mapping.dateFormat}
                onChange={(e) => setMapping((m) => ({ ...m, dateFormat: e.target.value }))}
              >
                <option value="dd/mm/yyyy">gg/mm/aaaa</option>
                <option value="mm/dd/yyyy">mm/gg/aaaa</option>
                <option value="yyyy-mm-dd">aaaa-mm-gg</option>
              </select>
            </div>
            <div>
              <label className="label">Separatore decimale</label>
              <select
                className="input"
                value={mapping.decimalSeparator}
                onChange={(e) =>
                  setMapping((m) => ({
                    ...m,
                    decimalSeparator: e.target.value as ',' | '.',
                  }))
                }
              >
                <option value=",">Virgola (1.234,56)</option>
                <option value=".">Punto (1,234.56)</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="mb-1 font-medium">Anteprima colonne dal file:</p>
            <div className="flex flex-wrap gap-1">
              {tabular.columns.map((c) => (
                <span key={c} className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={buildPreviewFromTabular}>
              Anteprima transazioni →
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <PreviewStep
          staged={staged}
          setStaged={setStaged}
          categories={categories}
          isTabular={!!tabular}
          saveProfileName={saveProfileName}
          setSaveProfileName={setSaveProfileName}
          onImport={doImport}
        />
      )}
    </div>
  );
}

function get(row: RawRow, column: string): string {
  return column ? (row[column] ?? '') : '';
}

function autoGuessColumns(columns: string[]): Partial<Omit<ImportProfile, 'id' | 'name'>> {
  const guess: Partial<Omit<ImportProfile, 'id' | 'name'>> = {};
  const find = (keys: string[]) =>
    columns.find((c) => keys.some((k) => c.toLowerCase().includes(k))) || '';
  guess.dateColumn = find(['data', 'date']);
  guess.descriptionColumn = find(['operazione', 'causale', 'descr', 'memo', 'payee']);
  guess.amountColumn = find(['importo', 'amount', 'valore']);
  // La colonna dettagli è una colonna descrittiva diversa da quella scelta.
  const details = columns.find(
    (c) =>
      c !== guess.descriptionColumn &&
      ['dettagli', 'descrizione', 'note'].some((k) => c.toLowerCase().includes(k)),
  );
  if (details) guess.detailsColumn = details;
  guess.categoryColumn = find(['categoria', 'category']);
  guess.accountColumn = find(['conto o carta', 'conto/carta', 'conto', 'carta', 'account']);
  return guess;
}

function Steps({ step }: { step: Step }) {
  const items: { id: Step; label: string }[] = [
    { id: 'upload', label: '1. Carica file' },
    { id: 'mapping', label: '2. Mappa colonne' },
    { id: 'preview', label: '3. Anteprima e import' },
  ];
  const order: Step[] = ['upload', 'mapping', 'preview'];
  return (
    <div className="flex gap-2 text-sm">
      {items.map((it) => {
        const active = it.id === step;
        const done = order.indexOf(it.id) < order.indexOf(step);
        return (
          <span
            key={it.id}
            className={`rounded-full px-3 py-1 ${
              active
                ? 'bg-brand-600 text-white'
                : done
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

function ColumnSelect({
  label,
  columns,
  value,
  onChange,
}: {
  label: string;
  columns: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— nessuna —</option>
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

function PreviewStep({
  staged,
  setStaged,
  categories,
  isTabular,
  saveProfileName,
  setSaveProfileName,
  onImport,
}: {
  staged: StagedTransaction[];
  setStaged: React.Dispatch<React.SetStateAction<StagedTransaction[]>>;
  categories: { id: string; name: string; type: string }[];
  isTabular: boolean;
  saveProfileName: string;
  setSaveProfileName: (v: string) => void;
  onImport: () => void;
}) {
  const selectedCount = staged.filter((s) => s.selected).length;
  const dupCount = staged.filter((s) => s.duplicate).length;

  if (staged.length === 0) {
    return <EmptyState title="Nessuna transazione da mostrare." />;
  }

  function update(tempId: string, patch: Partial<StagedTransaction>) {
    setStaged((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
        <span>
          <strong>{staged.length}</strong> transazioni ·{' '}
          <strong className="text-emerald-600">{selectedCount}</strong> selezionate
          {dupCount > 0 && (
            <>
              {' '}
              · <strong className="text-amber-600">{dupCount}</strong> possibili duplicati
            </>
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-ghost"
            onClick={() => setStaged((p) => p.map((s) => ({ ...s, selected: true })))}
          >
            Seleziona tutte
          </button>
          <button
            className="btn-ghost"
            onClick={() =>
              setStaged((p) => p.map((s) => ({ ...s, selected: !s.duplicate })))
            }
          >
            Escludi duplicati
          </button>
        </div>
      </div>

      <div className="card max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Descrizione</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Importo</th>
            </tr>
          </thead>
          <tbody>
            {staged.map((s) => (
              <tr
                key={s.tempId}
                className={`border-b border-slate-100 ${s.duplicate ? 'bg-amber-50' : ''}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={s.selected}
                    onChange={(e) => update(s.tempId, { selected: e.target.checked })}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {formatDate(s.date)}
                </td>
                <td className="px-3 py-2">
                  {s.description}
                  {s.paymentMethod === 'Carta prepagata' && (
                    <span className="badge ml-2 bg-violet-100 text-violet-700">carta</span>
                  )}
                  {s.excludeFromTotals && (
                    <span className="badge ml-2 bg-slate-200 text-slate-600">
                      giroconto · non contato
                    </span>
                  )}
                  {s.duplicate && (
                    <span className="badge ml-2 bg-amber-100 text-amber-700">duplicato</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {s.type === 'expense' ? (
                    <select
                      className="input !py-1 !text-xs"
                      value={s.categoryId ?? (s.fileCategory ? '__file__' : '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__file__') update(s.tempId, { categoryId: null });
                        else
                          update(s.tempId, {
                            categoryId: v || null,
                            fileCategory: undefined,
                          });
                      }}
                    >
                      <option value="">— nessuna —</option>
                      {s.fileCategory && (
                        <option value="__file__">{s.fileCategory} (dal file)</option>
                      )}
                      {categories
                        .filter((c) => c.type === 'expense')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  ) : s.fileCategory ? (
                    <span className="badge bg-emerald-100 text-emerald-700">
                      {s.fileCategory}
                    </span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-700">entrata</span>
                  )}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
                    s.type === 'income' ? 'text-emerald-600' : 'text-slate-800'
                  }`}
                >
                  {s.type === 'income' ? '+' : '−'}
                  {formatCurrency(s.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {isTabular && (
          <div className="max-w-xs">
            <label className="label">Salva mappatura come profilo (facoltativo)</label>
            <input
              className="input"
              placeholder="Es. Intesa Sanpaolo"
              value={saveProfileName}
              onChange={(e) => setSaveProfileName(e.target.value)}
            />
          </div>
        )}
        <button className="btn-primary ml-auto" onClick={onImport} disabled={selectedCount === 0}>
          Importa {selectedCount} transazioni
        </button>
      </div>
    </div>
  );
}
