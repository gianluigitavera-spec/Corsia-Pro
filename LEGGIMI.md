# CorsiaPro — app · v0.46.0

Gestionale per allenatori di nuoto: sedute, presenze, volumi reali per
atleta, periodizzazione, benessere, esercizi.

React 18 + Vite, CSS scritto a mano, `lucide-react` per le icone, grafici
in SVG puro. Legge lo schema `squadra` su Supabase, con RLS su tutto. PWA
installabile. Parallela e collegata a SwimCoach AI: stesso progetto
Supabase, stesso account. SwimCoach è per atleti e allenatori, CorsiaPro
solo per allenatori.

## Avvio

```bash
npm install
cp .env.example .env      # poi riempi URL e anon key
npm run dev
```

URL e anon key: Supabase → Project Settings → API. La `service_role` non
entra mai nel front-end.

## Le tre idee da cui dipende il resto

**Il programma e la vasca sono due cose diverse.** `sedute.sezioni` è
quello che hai scritto e non si riscrive mai. `sedute.svolto` tiene solo
gli scostamenti — `{ "righe": { "1-3": 1400 }, "nota": "…" }`, dove
`"1-3"` è la quarta serie della seconda sezione. Seduta andata come
previsto: `svolto` resta vuoto.

**Le categorie non si salvano sull'atleta**, si derivano da anno di
nascita, sesso e stagione. Eccezioni: **Master e Teen**, che non sono
un'età ma un percorso — un agonista di 28 anni è Senior, un Master di 28 è
Master. Quelli usano `categoria_override`, che è congelato: chi ce l'ha non
cambia categoria al girare della stagione.

**Il volume con lo split non è la somma delle sezioni.** Ogni atleta nuota
il riscaldamento comune più la sezione della propria specializzazione.

## La categoria si sceglie una volta sola

In testata, accanto alla stagione, con le spunte e la multi-selezione.
Vale per tutte le schede e resta fra una visita e l'altra. **Non ci sono
più filtri dentro le singole schede**: se cerchi quelli, sono stati tolti
nella 0.43.

## Le schede

- **Dashboard** — calendario del mese, programmazione in una riga apribile
  (chiusa di default, dice comunque la fase di oggi), obiettivi di fase col
  tasto Proponi. Periodizzazione e obiettivi compaiono con una categoria
  sola spuntata, perché è lì che hanno senso.
- **Sedute** — editor a corsie, scrittura libera con analizzatore, lavagna,
  PDF, duplica seduta e copia settimana, bozza locale di quello che stai
  scrivendo.
- **Appello** — prima la categoria, poi la seduta di quel gruppo (scelta da
  sola se è di oggi). Quattro stati: P, R, G, A. Solo l'assenza fa scendere
  la frequenza; i metri di chi arriva in ritardo entrano nel carico, perché
  in acqua c'era. Sotto: **Com'è andata**, dove correggi riga per riga
  quello che è stato davvero nuotato.
- **Benessere** — quattro valori per atleta (sonno, fatica, dolori, umore) e
  la prontezza. In cima i meno pronti. Non è una valutazione clinica: è un
  indicatore da leggere accanto al carico.
- **Atleti** — anagrafica, selezione multipla e azioni di massa, import CSV
  con anti-doppione e aggiornamento della categoria di chi c'è già.
- **Carico atleti** — periodi, tabella, programmato contro nuotato **sui
  metri veri**.
- **Esercizi** — questa settimana / della squadra / comuni. Il codice
  (DO-01, TC-03) nasce con l'esercizio e non cambia mai.
- **Squadra** — anagrafica, codice di ingresso rigenerabile, richieste da
  approvare, ruoli. L'app scrive solo se il tuo ruolo in `squadra.membri` è
  `coach` o `collega`; un `lettore` vede tutto senza toccare niente.

## Come si scrive una seduta

Due modi: **a corsie** (l'editor strutturato) e **scrivi o incolla** (un
riquadro unico, con la seduta interpretata a fianco mentre digiti e un
semaforo per riga — verde letta, gialla da confermare, rossa non capita).

| Scrittura | Vale |
|---|---|
| `8x75` | 600 |
| `4x(1x100 + 2x50)` | 800 |
| `(3x25) + (1x75)` | 150 — più gruppi si sommano |
| `3x25 + 1x75 Remate DO` | 150 — somma finché sono misure, poi è descrizione |
| `2x(4x50 SL + 100 B1)` | 600 — stili e zone dentro le parentesi sono etichette |
| `3x(2x(4x25) + 100)` | 900 — gruppi annidati |
| `12/10/8x100` | 3000 — **le scale** |
| `400/300/200` | 900 — scala di sole distanze |
| `PS 12x25 progr 1-4` | 300 — la misura può stare dopo il lavoro |
| `100GB 50 (…) 4x(100 + 2x50)` | 800 — se una somma arriva a fine riga, quella è il set |
| `Centrale A2` | apre la sezione e l'andatura vale per le righe sotto |
| `CP 2x10` | 50 — **regola della vasca**: sotto i 25 vale 25 |

**Una riga, una andatura.** Se su una riga scrivi due zone diverse, la riga
si apre da sola in due righe — una per andatura, i metri restano gli
stessi. `8x50 A2 + 4x25 C1` diventa due righe da 400 e 100. Col
moltiplicatore davanti resta il blocco:

```
4x(8x50 B1 + 4x50 B2)          4x
                        →      8x50 B1
                               4x50 B2
```

Con una zona sola non si tocca niente: lì il `+` è la composizione della
ripetuta, non due lavori.

**Righe di composizione**: se le sotto-righe sommano la riga sopra, valgono
zero. `6x100` seguito da `25 remate 25 completo 25gb 25 ps` resta 600.

**Ripartenze**: `@1:30`, `@3'`, `@45`. Passo base: `@@2:00` è sui 100 e si
scala sulla distanza (su un 250 diventa `@5:00`); per una base diversa,
`@@0:35/25`.

Non sa leggere: le corsie A/B (non si usano più) e i nomi di atleti dentro
la riga.

## Offline

In piscina il wifi c'è ma ogni tanto molla, che è peggio di non averlo. Il
criterio non è `navigator.onLine` ma il **tempo massimo**: 6 secondi in
lettura, 4 sul tocco dell'appello. Magazzino locale per leggere, coda per
scrivere, spia in testata col conto di quello che deve ancora partire.

Non funziona offline creare o modificare una seduta, perché servirebbe che
il dispositivo generi gli id. Ma la **bozza locale** protegge quello che
stai scrivendo.

## Installazione sul dispositivo

- **iPhone** — Safari, tasto Condividi in basso, "Aggiungi a Home".
- **iPad** — **Safari** (da Chrome non si può). Il tasto Condividi è in
  **alto a destra** e la voce "Aggiungi a Home" sta più in basso
  nell'elenco: scorri. Se non compare, sei in navigazione privata: apri una
  scheda normale. Dalla 0.46 l'app installata si tiene anche di traverso.
- **Android** — menù ⋮ di Chrome, "Installa app".

## Come entra un collega

Si registra (o usa il suo account SwimCoach), vede "Non fai ancora parte di
una squadra", incolla il codice che gli hai dato (Squadra → Codice di
ingresso), tu approvi. Chi non ha il codice non trova la squadra: non
esiste nessun elenco consultabile.

## Prove automatiche

Girano prima di ogni build e **bloccano il pacchetto**:

| Script | Cosa protegge |
|---|---|
| `eslint` | variabili lette prima di esistere, e variabili che non esistono più |
| `controlla_import.mjs` | funzioni usate senza importarle |
| `sincronizza_versione.mjs` | versione allineata ovunque |
| `prova_analizzatore.mjs` | 61 casi presi dagli allenamenti veri |
| `prova_stagioni.mjs` | stagioni, fasce, volumi con `svolto`, split, macrocicli |
| `vite.config.js` → `onwarn` | circular chunk, che rompe la pagina a runtime |

Se un controllo sembra pedante è perché quel guasto è già successo.

## Le funzioni gemelle JS ↔ SQL

Devono restare allineate: se cambi la regola da una parte sola, database e
schermo dicono numeri diversi e nessuno se ne accorge.

| Regola | JavaScript | SQL |
|---|---|---|
| Volume per specializzazione | `metriPerSpecializzazione()` | `squadra.metri_per_specializzazione()` |
| Chiave anti-doppione | `chiaveAtleta()` | `squadra.chiave_atleta()` (021) |
| Metri davvero nuotati | `metriSvolti()`, `zonePerSpecializzazione()` | `squadra.metri_svolti()` (022), `v_carico_zona_reale` (023) |

Tutte in `src/lib/dominio.js`, che è **la copia del file condiviso con
SwimCoach AI**: se lo modifichi qui, riportalo anche là.

## La versione si scrive in un posto solo

`version` in `package.json`. Da lì `sincronizza_versione.mjs` allinea la
cache del service worker; `src/versione.js` tiene solo il registro delle
novità — e senza la voce della versione che stai costruendo, la build si
ferma. **Non ci sono tre posti da toccare a mano: ce n'è uno.**

## Aggiornare il sito

GitHub → Upload files → trascinare `src` e `public` interi, più
`package.json`, `index.html`, `vite.config.js`, `eslint.config.js` e gli
script `.mjs`. Vercel ridistribuisce da solo. Il caricamento web non
cancella i file rimossi.

Su Vercel servono `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Se il sito mostra ancora la versione vecchia

Il numero è in alto accanto al marchio: cliccalo e si apre il registro dei
cambiamenti. Se non è quello dello zip che hai caricato, il deploy non è
andato a fondo.

1. Su GitHub, la data dell'ultimo commit sui file
2. Su Vercel → Deployments, che l'ultimo sia "Ready"
3. Sul dispositivo: chiudi e riapri l'app **due volte**, o svuota i dati del
   sito. Nel service worker ci sono due cache — una versionata per il
   guscio, una senza versione per i file di `/assets/`, che hanno
   l'impronta del contenuto nel nome. Conseguenza: se un pacchetto arriva
   rotto, il file guasto resta nel dispositivo finché non lo sfratti.

## Rete di sicurezza

`Recinto.jsx` cattura gli errori di disegno e mostra il messaggio invece
dello schermo nero. Non è il gestore delle corsie.

**Le librerie stanno in un chunk solo.** Erano tre e si rimandavano l'una
all'altra — `librerie → react → librerie` — e la pagina moriva con "Cannot
access 'h' before initialization". Non rifarlo.
