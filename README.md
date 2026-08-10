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

## 📱 Usarla su iPhone (installazione come app)

L'app è una **PWA**: si installa sulla schermata Home dell'iPhone, si apre a
tutto schermo come un'app normale e funziona **offline**. I dati restano salvati
solo sul telefono.

Per usarla su iPhone servono due cose: pubblicarla una volta online (gratis, con
GitHub Pages) e poi aggiungerla alla Home.

### 1. Pubblicazione (una sola volta) con GitHub Pages

Il repository include già il workflow `.github/workflows/deploy.yml` che compila
e pubblica il sito ad ogni push. Devi solo attivare Pages:

1. Vai su **GitHub → repository → Settings → Pages**.
2. Alla voce **Build and deployment → Source** scegli **GitHub Actions**.
3. Attendi che l'azione **"Deploy su GitHub Pages"** finisca (scheda *Actions*).

Al termine l'app sarà raggiungibile a:

```
https://<tuo-utente>.github.io/<nome-repo>/
```

(per questo repository: `https://anisalaika2.github.io/Claude/`).

> Nota privacy: su GitHub Pages viene pubblicato solo il **codice** dell'app. I
> tuoi movimenti **non** vengono caricati da nessuna parte: restano nel database
> locale del telefono.

### 2. Aggiungere l'app alla schermata Home

Sull'iPhone:

1. Apri il link qui sopra con **Safari** (serve Safari, non Chrome).
2. Tocca il pulsante **Condividi** (il quadrato con la freccia).
3. Scegli **"Aggiungi alla schermata Home"** e conferma.

Comparirà l'icona 👛 **Spese**: aprendola parte a schermo intero e funziona anche
senza connessione.

### Alternativa: dal tuo computer sulla stessa rete Wi-Fi

Se preferisci non pubblicarla online, puoi avviarla dal computer e aprirla dal
telefono (stessa rete Wi-Fi), tenendo il computer acceso:

```bash
npm run dev -- --host
```

Vite mostrerà un indirizzo tipo `http://192.168.1.50:5173`: aprilo in Safari
sull'iPhone. In questa modalità l'app funziona solo con il computer acceso e la
modalità offline non è disponibile (richiede HTTPS come su GitHub Pages).

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
