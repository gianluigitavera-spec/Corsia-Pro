# CorsiaPro — app

React + Vite, legge lo schema `squadra` che hai già creato su Supabase.

## Avvio

```bash
npm install
cp .env.example .env      # poi riempi URL e anon key
npm run dev
```

URL e anon key: Supabase → Project Settings → API.
Entri con lo stesso account che hai usato per creare la società.

## Cosa c'è

- **Sedute** — l'editor manuale. Ogni sezione è una corsia: scegli i
  destinatari (Tutti / Velocità / Mezzofondo / Salvamento) e i volumi
  per specializzazione si aggiornano mentre scrivi. Sotto, la validazione
  segnala le serie senza zona o senza metri.
- **Appello** — un tocco cicla non rilevato → P → A → G. Chi non tocchi
  resta "non rilevato": non finisce fra i presenti.
- **Atleti** — anagrafica e import CSV (`nome,cognome,sesso,anno_nascita,specializzazione`).
  La categoria è derivata, non salvata.
- **Volumi** — carico reale per atleta dalle viste SQL: metri della sua
  specializzazione, contati solo nelle sedute in cui era presente.
- **Squadra** — codice di ingresso, richieste da approvare, ruoli dello staff.
  Visibile a tutti, modificabile solo dal capo allenatore.

## Come entra un collega

1. Si registra su CorsiaPro (o usa il suo account SwimCoach)
2. Vede la schermata "Non fai ancora parte di una squadra"
3. Incolla il codice che gli hai dato (scheda Squadra → Codice di ingresso)
4. Tu approvi dalla scheda Squadra e da quel momento entra

Chi non ha il codice non trova la squadra: non esiste nessun elenco
consultabile. Un atleta che prova a entrare trova la spiegazione e il
rimando a SwimCoach AI.

Richiede la migrazione `005_adesioni.sql`.

## Deploy

Vercel → importa il repo → aggiungi le due variabili d'ambiente. Nient'altro.

## Note

`src/lib/dominio.js` è la copia del file condiviso con SwimCoach AI.
Se lo modifichi qui, riportalo anche là: è la fonte di verità comune.

L'app scrive solo se il tuo ruolo in `squadra.membri` è `coach` o
`collega`. Un `lettore` vede tutto senza poter modificare.
