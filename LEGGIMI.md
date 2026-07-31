# CorsiaPro — app · v0.15.0

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
- **Appello** — elenco filtrabile per categoria, con quattro stati per
  riga: **P** presente, **R** ritardo, **G** giustificato, **A** assente.
  Ritoccando lo stesso stato si annulla. Chi non tocchi resta "non
  rilevato" e non entra in nessun conteggio.
  Accanto a ogni nome la frequenza a **settimana / mese / totale** e il
  numero di ritardi. Regola: solo l'assenza fa scendere la percentuale —
  ritardo e giustificato contano come presenza. I metri di chi arriva in
  ritardo entrano nel carico, perché in acqua c'era.
  Richiede `013_ritardi_frequenza.sql`.
- **Atleti** — anagrafica e import CSV (`nome,cognome,sesso,anno_nascita,specializzazione`).
  La categoria è derivata, non salvata.
- **Carico atleti** — scegli l'orizzonte (settimana, mese, periodo libero,
  stagione) e vedi tre numeri distinti: **km delle sedute** (il volume del
  programma, contato una volta sola), **frequenza media**, **km nuotati
  dagli atleti** (la somma dei percorsi individuali). Sotto, la tabella con
  presenze, frequenza, ritardi, previsti e nuotati, e due grafici.
- **Squadra** — anagrafica completa (indirizzo, P.IVA, codice FIN, contatti),
  codice di ingresso rigenerabile, richieste da approvare, ruoli dello staff.
  Visibile a tutti, modificabile solo dal capo allenatore.
- **Dashboard** — calendario del mese (sedute e competizioni) più la
  ripartizione per zona energetica.

## Due modi di scrivere una seduta

**A corsie** — l'editor strutturato, sezione per sezione.

**Scrivi o incolla** — un riquadro unico dove scrivi come sei abituato.
A destra la seduta compare interpretata mentre digiti, con un semaforo per
riga: verde letta, gialla da confermare, rossa non capita. Correggi metri e
zona lì, premi "Usa questa seduta" e finisce nell'editor a corsie come
qualsiasi altra.

Cosa riconosce: `8x75`, `4x(100+2x50)`, i blocchi aperti da `4x` da solo,
le ripartenze (`@1:30`, `40"`, `rec 3'`), stili, attrezzi, e le tue sigle
(PS, BN, FP, PF, CP, fff, TC, GB, c25, fraz, prog, sub, regr, crono).
Partenze, virate e lavoro a secco entrano con zero metri.

La regola più utile: **le sotto-righe che sommano la distanza della riga
sopra sono composizione**, non lavoro in più. `6x100` seguito da
`25 remate 25 completo 25gb 25 ps` resta 600 m, non 700.

## Come si scrive una seduta

- I **metri si calcolano da soli** dalla notazione: `1x400` → 400,
  `2x200` → 400, `4x(1x100 + 2x50)` → 800, `12/10/8x100` → 3000.
  Se scrivi i metri a mano, quella serie smette di ricalcolarsi.
- La **zona parte da A1**: la cambi solo dove serve.
- Il **recupero si scrive `@1:40`** (se ometti la chiocciola la mette lei;
  se scrivi `1'40` lo converte).
- **Ripartenza dal passo base**: scrivi `@@2:00` e l'app la calcola sulla
  distanza della singola ripetizione — su un 250 diventa `@5:00`, su un 50
  `@1:00`. Arrotonda ai 5 secondi. La base resta legata alla serie: se
  cambi la distanza, la partenza si rifà da sola. Per una base diversa dai
  100 metri: `@@0:35/25`.
- Le frecce a sinistra spostano **sezioni e serie** su e giù.
- Ogni seduta si rivolge a **una o più categorie**, scelte con i flag:
  Esordienti B, Esordienti A, Ragazzi 1-2, Ragazzi 3, Juniores, Cadetti,
  Senior, Assoluti, Propaganda, Teen. Il flag mezzo giallo significa che
  hai preso solo una parte del raggruppamento.
- I gruppi di allenamento non esistono più, in nessuna schermata.

## Calendario

Clicca un giorno: aggiungi una seduta (si apre l'editor già datato) o una
competizione. Sei tipi, sei colori — Trofeo, Prova tempi, Campionati
Regionali, Campionati Italiani, Regionali Salvamento, Italiani Salvamento.
Il filtro in cima al calendario mostra solo una fascia per volta: Propaganda,
Teen, Esordienti B, Esordienti A, Ragazzi, oppure J/C/S e Assoluti.
Richiede le migrazioni `007_gare.sql` e `008_categorie_stagioni.sql`.

## Benessere

Scheda dedicata: per ogni atleta quattro valori da 1 a 5 — sonno, fatica,
dolori, umore — e la **prontezza** calcolata invertendo fatica e dolori.
L'elenco mette in cima i meno pronti, che è l'ordine con cui guardi la
squadra prima di far partire la serie. Non è una valutazione clinica: è un
indicatore da leggere accanto al carico. Richiede `009_benessere.sql`.

## Lavagna e PDF

Dentro una seduta aperta, tre tasti:

- **Lavagna** — schermo pieno, una sezione per volta, caratteri enormi con
  zoom regolabile. Frecce ← → per cambiare sezione, Esc per uscire.
  Da tablet a bordo vasca si legge da lontano.
- **PDF** — apre la stampa del sistema con un foglio A4 bianco ed
  essenziale (niente veste grafica). Da telefono: "Salva come PDF".
- **Invia** — la seduta in testo semplice: usa la condivisione del
  telefono (WhatsApp, mail) o la copia negli appunti sul computer.

## Periodizzazione

Compare **solo quando scegli una categoria** nel calendario: su "Tutte"
restano gare e allenamenti, senza fasce.

1. Imposta **Stagione dal** (il 1° settembre è solo il valore di partenza)
2. Metti sul calendario la gara obiettivo, con i flag di chi partecipa
3. Scegli la gara nella tendina e premi **Proponi**: il macrociclo di 21
   settimane si dispone a ritroso — Speciale 8, Specifica 5, Tapering 2 —
   e la **Generale si allunga fino all'inizio stagione**. Con obiettivo
   ad aprile e stagione da settembre la generale dura circa 18 settimane
   invece di 6, senza lasciare mesi scoperti
4. **Trascina i confini** sul nastro colorato, o usa le frecce per
   spostare di una settimana per volta. Nessuna fase può scendere sotto
   la settimana
5. Salva: i giorni del calendario si tingono del colore della fase

Ogni categoria ha la sua periodizzazione, indipendente dalle altre: gli
Assoluti possono essere in tapering mentre gli Esordienti A sono ancora
in generale.

Richiede `014_periodizzazione.sql` e `015_inizio_stagione.sql`.

## Competizioni e categorie

Creando una competizione scegli **chi partecipa** con gli stessi flag
delle sedute: un trofeo può andare dagli Esordienti B agli Assoluti, i
Campionati Italiani solo a una fascia. Senza nessun flag la gara compare
in tutti i filtri. Il filtro del calendario nasconde le gare che non
riguardano la categoria scelta.

## Stagione

Il selettore in alto a destra cambia la stagione. Le categorie degli atleti
si ricalcolano da sole: cambi stagione e tutta la squadra passa alla
categoria dell'anno dopo, senza toccare un solo record.

## Installazione sul telefono

L'app è una PWA. Da telefono, apri l'indirizzo nel browser e scegli
"Aggiungi a schermata Home" (Safari: tasto condividi; Chrome: menù ⋮).
Compare l'icona e si apre a schermo pieno, senza barra del browser.

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


## Tutorial

Al primo accesso parte da solo: nove passi che **cambiano scheda mentre
spiegano**, così dietro al riquadro si vede la schermata vera. Uno dei
passi è dedicato a come invitare un collega con il codice di ingresso.

Si esce con la ✕ in alto o con Esc; il flag **Non mostrare più** lo
disattiva per sempre su quel dispositivo (è salvato nel browser, non nel
database: su un altro telefono riparte una volta). Il punto interrogativo
accanto a Esci lo riapre quando vuoi.

## Versioni

Il numero è in alto accanto al marchio: cliccalo e si apre il registro dei
cambiamenti, versione per versione. Serve a sapere **cosa stai guardando**:
se il numero a schermo non è quello dello zip che hai caricato, il deploy
non è andato a fondo.

Ad ogni consegna cambio `src/versione.js` (numero + voci), il `CACHE` in
`public/sw.js` e la `version` di `package.json`. Sono i tre posti, non ce
ne sono altri.

## Se il sito mostra ancora la versione vecchia

1. Su GitHub controlla la data dell'ultimo commit sui file
2. Su Vercel → Deployments, verifica che l'ultimo sia "Ready" e non fallito
3. Sul telefono, se l'hai installata come app: chiudila e riaprila (il
   service worker prende la build nuova al secondo avvio), o rimuovi
   l'icona e riaggiungila
