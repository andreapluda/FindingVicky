# Finding Vicky — Mappa degli adesivi

Sito statico su GitHub Pages con mappa interattiva per segnalare e visualizzare gli adesivi di Vicky nel mondo.

## Stack

- **Frontend**: HTML + CSS + JS vanilla (no build step)
- **Mappa**: Leaflet.js + OpenStreetMap
- **Backend**: Supabase (database Postgres + storage foto)
- **EXIF**: `exifr` — estrazione automatica coordinate GPS dalla foto

---

## Setup (una volta sola)

### 1. Crea un progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → crea account → **New project**
2. Scegli nome, password DB, regione (es. `eu-west-2` per Europa)
3. Attendi l'inizializzazione (~2 min)

### 2. Crea tabella e storage

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Incolla il contenuto di `supabase-setup.sql` ed esegui

### 3. Configura le credenziali

1. Supabase Dashboard → **Project Settings** → **API**
2. Copia **Project URL** e **anon public key**
3. Apri `supabase-config.js` e sostituisci i placeholder:

```js
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
const SUPABASE_ADMIN_PASSWORD = 'una-password-segreta-per-te';
```

> L'`anon key` è sicura da esporre sul client (è progettata per questo).
> La `SUPABASE_ADMIN_PASSWORD` è una protezione UI leggera per la pagina admin.

### 4. Pubblica su GitHub Pages

1. Push del repo su GitHub
2. Repository → **Settings** → **Pages** → Source: `main` branch, root `/`
3. Il sito sarà disponibile su `https://tuoutente.github.io/FindingVicky/`

---

## Utilizzo

| Pagina | URL | Descrizione |
|---|---|---|
| Mappa pubblica | `/` | Visualizza tutti i pin approvati |
| Aggiungi pin | Pulsante "+ Aggiungi adesivo" | Chiunque può segnalare |
| Moderazione | `/admin.html` | Approva/rifiuta pin pendenti |

### Flusso di un nuovo pin

1. Utente clicca **+ Aggiungi adesivo**
2. Carica la foto → coordinate GPS estratte automaticamente da EXIF (se presenti)
3. In alternativa usa "Usa la mia posizione attuale" o inserisce le coordinate manualmente
4. Compila nome utente, data/ora, note → **Invia segnalazione**
5. Il pin viene salvato come `approved: false` e non appare sulla mappa
6. L'admin va su `/admin.html`, inserisce la password e approva o rifiuta

---

## Struttura file

```
/
├── index.html          # Mappa pubblica
├── admin.html          # Pagina di moderazione
├── style.css           # Stili
├── app.js              # Logica mappa + form
├── supabase-config.js  # Credenziali (da compilare)
└── supabase-setup.sql  # Script SQL per Supabase
```
