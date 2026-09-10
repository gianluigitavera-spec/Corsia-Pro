# CorsiaPro — istruzioni per Claude

App di gestione squadra per allenatori di nuoto. PWA, React 18 + Vite, CSS
scritto a mano, Supabase (PostgreSQL), deploy su Vercel.

Chi ci lavora è anche chi la usa: allenatore, sviluppatore solo, prove sul
campo con iPhone e iPad a bordo vasca. **Si parla italiano**, sempre — nel
codice, nei commenti, nei messaggi di commit e nelle risposte.

Nel database ci sono dati di minori. La chiave `service_role` non deve mai
comparire nel frontend né su GitHub.

---

## Schema del database

Due app condividono lo stesso progetto Supabase:

- schema `public` → SwimCoach AI (atleti e allenatori)
- schema `squadra` → **CorsiaPro** (solo allenatori) ← questo progetto

### Regola numero uno: guardare prima di scrivere

Il file su disco **non è** il database. Una vista può essere stata cambiata a
mano, una migrazione può essere stata eseguita senza che il file esista, un
tipo può non essere quello che sembra.

Prima di scrivere SQL che tocca oggetti esistenti:

```sql
select pg_get_viewdef('squadra.nome_vista', true);
select unnest(enum_range(null::squadra.nome_enum));
```

Errori realmente costati tempo, tutti dalla stessa causa:

- `famiglia` è l'enum `squadra.famiglia_zona` (aerobico, vo2, lattacido,
  alattacido, altro). Non è testo, e `'nonclass'` non esiste.
- `specializzazione` è l'enum `squadra.specializzazione` (Velocità,
  Mezzofondo, Fondo, Salvamento, Generale — Fondo aggiunto dopo Mezzofondo
  con la 026). Non è testo. L'ordine conta: le viste ciclano con
  `unnest(enum_range(...))`, e `SPECIALIZZAZIONI` in `src/lib/dominio.js`
  ripete lo stesso ordine.
- `v_serie` non aveva gli indici di posizione: sono stati aggiunti con la 023
  (`sez_n`, `ser_m`, base zero, via `with ordinality`).

Quando serve una vista parallela a una esistente, si parte dalla definizione
reale di quella che funziona e si cambia solo il minimo. I tipi devono
coincidere per costruzione, non per fortuna: sopra ci sono altre viste che si
rompono al primo tipo diverso.

### Migrazioni

Stanno in `migrazioni/`, numerate. **Ogni esecuzione deve lasciare un file**,
anche quando l'SQL è stato lanciato a mano dal pannello: la catena deve essere
ripetibile su un ambiente pulito. È già successo di perdere la 025.

Dopo ogni migrazione, rigenerare `schema.sql` e committarlo. È l'unico modo
perché chi legge il repo sappia com'è fatto davvero il database.

Migrazioni: la 025 (atleti sulla seduta) e la 026 (specializzazione Fondo)
sono eseguite e salvate. La **027** (`v_serie` esclude le sezioni a secco)
è scritta ma **non ancora eseguita** su Supabase; in coda porta anche il
censimento delle sedute vecchie con sezioni tipo "Palestra" che portano
metri fantasma, da guardare prima di decidere se correggerle.

`schema.sql` non esiste ancora nel repo: da rigenerare e committare.

---

## Dominio: le regole che non si negoziano

Sono regole da allenatore, non scelte tecniche. Sbagliarle produce numeri
plausibili e falsi.

**Il volume di una seduta con lo split non è la somma delle sezioni.** Il
volume di un velocista è il riscaldamento comune più la sua parte centrale.
Sommare tutte le sezioni gonfia i metri di chiunque. Vale ovunque: viste SQL,
`dominio.js`, grafici.

**Distanze sotto i 25 m contano 25** (regola della vasca).

**Il lavoro a secco non fa metri e non ha zona.** Palestra, elastici,
core: sta nella seduta, occupa tempo, ma non si nuota. La sezione porta
`aSecco: true` e una `durataMin` scritta a mano, che è l'unica durata che
si ha (le altre sezioni la deducono dai tempi di partenza). Il titolo
decide una volta sola, in lettura (`TITOLO_A_SECCO`), poi comanda il
campo: il titolo è libero e rinominarlo non deve far rientrare i metri.
Dalla 027 il filtro sta anche in `v_serie`, in `where` e non dentro la
`from` — `with ordinality` deve numerare prima di scartare, o `sez_n` si
sfasa dalle chiavi di `svolto`.

**Righe con lavoro ma senza metri** = programmato ma non svolto: zero reale,
programma diverso da zero.

**Notazione:** `@1:30`, mai `@1'30`. `@3'` sono tre minuti. `1 serie x` e
`MX 1x` sono descrittori, non moltiplicatori per 4.

**Zone** (`squadra.zone`): A1 aerobico lento/ripristino, A2 aerobico medio,
B1 soglia anaerobica, B2 massimo consumo di ossigeno, C1 tolleranza lattacida,
C2 potenza lattacida, C3 velocità alattacida. Altre sigle in uso: PS, BN, ff,
FP/PF, CP, TC, regr. Crono vale C3 o D a seconda della fase di periodizzazione.

**Ogni atleta può fare qualunque zona.** Un velocista fa lavori di C, un
fondista pure. Non deve esistere nessun filtro che leghi la zona alla
specializzazione.

**Un blocco ripetuto ha i metri già moltiplicati in archivio.**
L'apertura è una serie a zero metri con `apreBlocco: N`, le figlie
portano `moltiplicato: N` e i loro `metri` sono **già** il totale. Chi
legge somma e basta — `dominio.js`, `v_serie` e `svolto` non moltiplicano
mai una seconda volta. Niente contenitore: annidare sposterebbe ogni
`ser_m` e le chiavi di `svolto` finirebbero sulla riga sbagliata.
`aperturaDiBlocco` in `dominio.js` dice cos'è un'apertura **nel testo**.
Nell'editor la notazione non crea blocchi: si usa solo il tasto
"+ ripetizione". Il riconoscimento scattava a ogni tasto, e scrivendo
`2x200` si passava per `2x` — la riga apriva un blocco per un istante,
si prendeva le righe sotto e al tasto dopo le lasciava staccate da quello
vero, coi metri divisi.

**L'appartenenza a un blocco si deriva, non si ricorda.**
`ricalcolaBlocchi(sezione)` scorre dall'alto col fattore dell'apertura più
vicina sopra e riscrive `moltiplicato` e i metri. Va chiamata **dopo ogni
gesto strutturale** (aggiunta, digitazione, spostamento, cancellazione,
cambio di N, sciogli) e **mai in lettura**: aprire una seduta e salvarla
senza toccarla non deve cambiarne un byte. Prima `moltiplicato` era una
copia scritta una volta e mai mantenuta, e invecchiava al primo gesto —
riga aggiunta sotto un'apertura che non prendeva mai il fattore (sezione
da 900 invece di 3600), riga spostata fuori che se lo teneva addosso.

I metri **non si rileggono dalla notazione**: si riscalano per rapporto,
e solo se il fattore è cambiato davvero. Rileggerli riscriverebbe righe
che nessuno ha toccato — la regola della vasca (`2x10` vale 50, non 20),
le righe di composizione che valgono 0 apposta. E **se la divisione non è
esatta non si riscala**: meglio una riga non aggiornata che un numero
inventato.

Le prove in `prova_blocchi.mjs` partono dai **gesti**, non da strutture
montate a mano: la versione che partiva dalle strutture era tutta verde
mentre l'app dava 900 invece di 3600.

**Le chiavi di `svolto` sono posizionali e devono seguire le righe.**
`"sez_n-ser_m"` non contiene niente che dica a quale riga appartiene: se
le righe si spostano e le chiavi restano ferme, i metri nuotati finiscono
sul lavoro sbagliato — il totale resta credibile, la ripartizione per
zona no. Dalla 0.53.1 ogni gesto che cambia gli indici rimappa nello
stesso `aggiorna()`: nucleo `rimappaSvolto` e involucri in `dominio.js`,
provati in `prova_svolto.mjs`. Chi aggiunge un gesto nuovo che tocca
`sezioni` o `serie` deve richiamare l'involucro giusto — attenzione ai
casi che inseriscono **in cima** (`unshift`), che spostano tutto.
`svoltoCollassato` è l'unico posto che decide quando `svolto` torna
`null`: righe vuote **e** nessuna nota.

**Cambiare la specializzazione di un atleta gli sposta anche i volumi
storici.** `sezionePer()` in `dominio.js` confronta stringhe esatte fra la
specializzazione dell'atleta e i `destinatari` scritti nella sezione. Chi
passa da Mezzofondo a Fondo smette di ricadere nelle sezioni storiche
intestate `Mezzofondo`: i suoi metri passati si riducono al riscaldamento
comune, e Volumi e Dashboard mostrano numeri più bassi di prima. È il
comportamento corretto, ma è una sorpresa che altrimenti si scopre davanti
a un grafico che non torna. Se un giorno servisse difendere il pregresso,
la via è riclassificare a partire da una data, non retroattivamente.

**Chiave atleta:** `cognomenome+annonascita` normalizzato, con l'equivalente
SQL in `squadra.chiave_atleta()`. Dalla 021 c'è un indice unico su
`(societa_id, chiave)`: lo stesso atleta non entra due volte nella stessa
società, ma può esistere in società diverse (è normale, es. account di prova).

---

## Come si lavora qui

**Il registro delle novità è obbligatorio.** Ogni cambio di versione vuole la
sua voce in `src/versione.js`, o `sincronizza_versione.mjs` ferma la build.
Le voci si scrivono per un allenatore, non per uno sviluppatore: cosa cambia
per chi usa l'app, non quale funzione è stata toccata.

Sulla voce si può mettere **`annuncia: true`**: dalla 0.53.0 fa aprire la
finestra delle novità alla prima apertura dopo l'aggiornamento (`src/lib/
novita.js`, puro e sotto prova in `prova_novita.mjs`). Si decide a mano,
voce per voce — una regola automatica dovrebbe indovinare cosa è
importante, e indovinerebbe male. Senza il campo la voce resta solo nel
registro consultabile, e non interrompe nessuno a bordo vasca.

**Prima di pacchettizzare si esegue `npm run build`**, che è la catena
completa: allineamento versione, eslint, controllo import, 61 prove
dell'analizzatore, prove stagioni, build Vite col guardiano sui chunk
circolari. Non si consegna niente senza averla vista passare.

Le prove dell'analizzatore sono ancorate a notazione vera, presa da
allenamenti reali e verificata contro un foglio Excel. Quando si tocca il
parser, si aggiunge il caso nuovo alle prove.

**Segnalazioni dal campo.** Arrivano come «non funziona più» o come messaggio
inoltrato da un altro allenatore. Prima di correggere conviene cercare la
causa nel sorgente e distinguere il difetto vero dall'equivoco di interfaccia:
il C3 dei velocisti che «spariva» dalla Dashboard era il menu della
specializzazione fermo su Mezzofondo, non un dato perso.

**iOS e PWA.** Si prova su dispositivo vero. Niente
`orientation: portrait-primary`; le apple-touch-icon servono anche nelle
misure 152 e 167.

---

## Struttura

```
src/lib/dominio.js    regole di dominio pure (volumi, zone, categorie)
src/lib/analizzatore.js  parser della notazione
src/lib/dati.js       tutte le query Supabase, in un posto solo
src/componenti/       React, un file per scheda
migrazioni/           SQL numerato
```

I componenti non parlano mai direttamente con Supabase: passano da `dati.js`.

---

## In lavorazione

**Zone automatiche dal titolo della sezione.** La zona scritta nella notazione
vince sempre; l'automatismo riempie solo le tendine vuote; se l'allenatore
cambia una tendina la sua scelta non si tocca più. Le righe riempite in
automatico restano col punto interrogativo, non col segno di spunta.

| titolo contiene | zona |
|---|---|
| riscaldamento, warm up, riscaldo | A1 |
| defaticamento, sciolto, ripristino | A1 |
| aerobico, medio | A2 |
| soglia | B1 |
| vo2, vo2max, massimo consumo | B2 |
| tolleranza | C1 |
| potenza | C2 |
| velocità, sprint | C3 (in codice: lookahead invece di `\b` finale — in JavaScript `\b` non chiude mai dopo una lettera accentata come la "à") |

**Sedute per pochi atleti (doppie).** Oggi la seduta ha solo `categorie`, e
in `Appello.jsx` i convocati (`visibili`) si deducono dal filtro categoria
scelto in testata (`codiciGruppi`), non da `categorie` della seduta — quel
campo filtra solo quali sedute compaiono nel selettore. Chi fa il doppio
trascina dentro tutta la categoria, e mettere assenti gli altri falsa le
statistiche.

FATTO: migrazione 025, colonna `squadra.sedute.atleti` (`uuid[]`, opzionale,
`NULL` = comportamento attuale) creata su Supabase e nel repo.

DA FARE:
- in `Appello.jsx`, nel calcolo di `visibili` (righe ~86-89): quando
  `seduta.atleti` è valorizzato, usare quella lista al posto del filtro
  categoria di testata;
- nell'editor, la selezione atleti accanto alle categorie.

NOTA: `v_frequenza` NON va toccata — conta dal registro presenze, non dalle
categorie. Non segnare gli altri (invece di segnarli assenti) vuol dire che
non entrano nel loro denominatore: le medie restano giuste.

**Coda offline e chiavi di `svolto`.** `salvaSvolto` accoda quando manca
la linea (`dati.js:118`) e la coda parte più tardi (`:667`). Se rilevi
senza linea e poi sposti una riga nell'editor, la voce accodata arriva
**con le chiavi vecchie** e si riprende il posto sbagliato: il payload è
stato congelato prima dello spostamento, e la rimappatura agisce solo
sull'oggetto in memoria. Da chiudere — probabilmente rimappando anche la
coda, o rifiutando l'accodamento quando la seduta è cambiata sotto.

**Altro in coda:** duplicazione seduta; offline vero con coda di sincronizzazione
per l'appello; import seduta da foto (Edge Function OpenAI già presente);
esercizi legati a notazione e lavagna; modifica gare già salvate; Crono che
propone C3 o D secondo la fase; import risultati FIN; privacy e consenso dei
genitori prima del lancio pubblico.

**Passi (tempi obiettivo) da non progettare:** c'è un'idea non ancora
raccontata. Non si disegna niente sui tempi finché non è stata ascoltata.
