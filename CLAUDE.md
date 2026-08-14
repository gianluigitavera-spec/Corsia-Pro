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
  Mezzofondo, Salvamento, Generale). Non è testo.
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

Migrazioni ancora aperte: **025** da riscrivere (eseguita, file mai salvato) e
**026** da ripensare, ora che `v_carico_zona_reale` esiste.

---

## Dominio: le regole che non si negoziano

Sono regole da allenatore, non scelte tecniche. Sbagliarle produce numeri
plausibili e falsi.

**Il volume di una seduta con lo split non è la somma delle sezioni.** Il
volume di un velocista è il riscaldamento comune più la sua parte centrale.
Sommare tutte le sezioni gonfia i metri di chiunque. Vale ovunque: viste SQL,
`dominio.js`, grafici.

**Distanze sotto i 25 m contano 25** (regola della vasca).

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

**Sedute per pochi atleti (doppie).** Oggi la seduta ha solo `categorie` e
l'appello deduce i convocati da lì: chi fa il doppio trascina dentro tutta la
categoria, e mettere assenti gli altri falsa le statistiche. Serve un elenco
atleti esplicito e opzionale sulla seduta: se c'è, l'appello mostra solo quelli
e le percentuali si calcolano solo su di loro; se non c'è, tutto resta com'è
adesso.

**Altro in coda:** duplicazione seduta; offline vero con coda di sincronizzazione
per l'appello; import seduta da foto (Edge Function OpenAI già presente);
esercizi legati a notazione e lavagna; modifica gare già salvate; Crono che
propone C3 o D secondo la fase; import risultati FIN; privacy e consenso dei
genitori prima del lancio pubblico.

**Passi (tempi obiettivo) da non progettare:** c'è un'idea non ancora
raccontata. Non si disegna niente sui tempi finché non è stata ascoltata.
