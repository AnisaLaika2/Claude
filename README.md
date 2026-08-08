# 👛 Gestione Spese

Web app **locale** per la gestione delle spese personali. Tutti i dati restano
sul tuo dispositivo (salvati nel browser tramite IndexedDB): nessun account,
nessun server, nessun invio di dati su Internet.

## Funzionalità

- **Movimenti manuali**: aggiungi, modifica ed elimina spese ed entrate con
  data, importo, categoria, metodo di pagamento e note.
- **Importazione dal rendiconto bancario**: importa file **CSV, XLSX, OFX/QFX e
  QIF** scaricati dalla tua banca.
  - Mappatura delle colonne guidata, con **profili salvabili** per ogni banca.
  - **Anteprima** delle transazioni prima dell'importazione.
  - **Rilevamento automatico dei duplicati** (anche all'interno dello stesso file
    e rispetto ai movimenti già presenti).
- **Aggiunta automatica delle spese**:
  - **Categorizzazione automatica** tramite regole (es. la descrizione contiene
    `ESSELUNGA` → categoria *Alimentari*).
  - Le regole **si imparano dalle correzioni**: quando ricategorizzi un
    movimento, l'app propone di creare la regola corrispondente.
  - **Spese ricorrenti** (abbonamenti, bollette) generate automaticamente ogni
    mese all'avvio.
- **Dashboard e report**: riepilogo mensile (entrate/spese/saldo), grafico a
  torta per categoria, andamento a barre su 6 mesi e **budget per categoria** con
  avviso al superamento.
- **Backup**: esportazione/ripristino completo in **JSON** ed esportazione dei
  movimenti in **CSV**.
- Interfaccia in italiano, valuta in EUR, date in formato `gg/mm/aaaa`.

## Requisiti

- [Node.js](https://nodejs.org/) 18 o superiore (testato su Node 22).

## Avvio

```bash
# 1. Installa le dipendenze
npm install

# 2. Avvia l'app in sviluppo
npm run dev
```

Apri il browser all'indirizzo mostrato nel terminale (di default
`http://127.0.0.1:5173`).

### Build di produzione

```bash
npm run build      # genera la cartella dist/
npm run preview    # anteprima della build
```

## Come provare l'importazione

Nella cartella [`samples/`](./samples) trovi due file di esempio:

- `estratto-conto-esempio.csv` — estratto conto in formato CSV (separatore `;`,
  decimali con la virgola). Contiene anche una riga duplicata per mostrare il
  rilevamento dei duplicati.
- `estratto-conto-esempio.ofx` — stesso estratto in formato OFX.

Vai su **Importa**, carica uno dei file e segui i passaggi. Per il CSV l'app
prova già a indovinare le colonne (Data / Causale / Importo); verifica la
mappatura e conferma.

## Struttura del progetto

```
src/
├── App.tsx                 # shell e navigazione
├── main.tsx                # entry point
├── types.ts                # modello dati
├── db/db.ts                # persistenza IndexedDB + backup
├── store/DataContext.tsx   # stato globale e azioni CRUD
├── lib/
│   ├── categorize.ts       # motore regole di categorizzazione
│   ├── dedup.ts            # hash per i duplicati
│   ├── recurring.ts        # generazione movimenti ricorrenti
│   ├── summary.ts          # aggregazioni per la dashboard
│   ├── format.ts           # formattazione valuta/date
│   ├── parse-values.ts     # parsing di date e importi
│   └── parsers/            # lettura CSV/XLSX e OFX/QIF
└── views/                  # Dashboard, Movimenti, Import, Categorie, Regole, Ricorrenti, Backup
```

## Note sulla privacy

I dati sono salvati solo in **IndexedDB**, il database locale del browser.
Se svuoti i dati del browser o usi un altro dispositivo, ricordati di fare prima
un **Backup** dalla sezione dedicata.
