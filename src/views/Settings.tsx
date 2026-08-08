import { useRef, useState } from 'react';
import { useData } from '../store/DataContext';
import { exportAll, importAll, type BackupData } from '../db/db';
import { formatCurrency } from '../lib/format';
import Papa from 'papaparse';

export default function Settings() {
  const { transactions, categories, reloadAll } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  async function downloadBackup() {
    const data = await exportAll();
    downloadBlob(
      JSON.stringify(data, null, 2),
      `backup-spese-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    setMsg('Backup JSON scaricato.');
  }

  function exportCSV() {
    const catById = new Map(categories.map((c) => [c.id, c.name]));
    const rows = transactions
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((t) => ({
        Data: t.date,
        Tipo: t.type === 'income' ? 'Entrata' : 'Spesa',
        Descrizione: t.description,
        Categoria: t.categoryId ? catById.get(t.categoryId) ?? '' : '',
        Importo: t.type === 'income' ? t.amount : -t.amount,
        Metodo: t.paymentMethod,
        Note: t.notes,
      }));
    const csv = Papa.unparse(rows);
    downloadBlob(csv, `movimenti-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    setMsg('Esportazione CSV completata.');
  }

  async function restoreBackup(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;
      if (!Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
        throw new Error('Il file non sembra un backup valido.');
      }
      if (
        !window.confirm(
          'Il ripristino sostituirà TUTTI i dati attuali. Continuare?',
        )
      ) {
        return;
      }
      await importAll(data);
      await reloadAll();
      setMsg(`Ripristinati ${data.transactions.length} movimenti dal backup.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Errore durante il ripristino.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const totalBalance = transactions.reduce(
    (acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount),
    0,
  );

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Backup e dati</h2>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {msg}
        </div>
      )}

      <div className="card p-4">
        <h3 className="mb-2 font-semibold text-slate-700">Riepilogo dati</h3>
        <ul className="text-sm text-slate-600">
          <li>Movimenti registrati: <strong>{transactions.length}</strong></li>
          <li>Categorie: <strong>{categories.length}</strong></li>
          <li>Saldo complessivo: <strong>{formatCurrency(totalBalance)}</strong></li>
        </ul>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Esporta</h3>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={downloadBackup}>
            💾 Backup completo (JSON)
          </button>
          <button className="btn-secondary" onClick={exportCSV}>
            📊 Esporta movimenti (CSV)
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Il backup JSON include movimenti, categorie, regole, ricorrenti e profili.
        </p>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Ripristina</h3>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) restoreBackup(f);
          }}
          className="text-sm"
        />
        <p className="mt-2 text-xs text-red-500">
          Attenzione: il ripristino sovrascrive tutti i dati presenti.
        </p>
      </div>

      <div className="card p-4">
        <h3 className="mb-2 font-semibold text-slate-700">Privacy</h3>
        <p className="text-sm text-slate-500">
          Tutti i dati sono salvati esclusivamente nel database locale del tuo
          browser (IndexedDB). Nessuna informazione viene inviata su Internet.
        </p>
      </div>
    </div>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
