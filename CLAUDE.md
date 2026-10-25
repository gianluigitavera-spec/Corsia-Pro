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
perché chi legge il repo sappia com'è fatto davvero il database. Si genera
nel pannello SQL con `query_schema.sql`, che sta nella cartella del
progetto ma fuori dal repo (`.gitignore`): restituisce una cella sola, da
copiarne il contenuto. Se arriva come tabella Markdown (`| schema_sql |`,
`<br>`, `\|`) va riconvertita prima di committarla.

**Ogni vista nasce con `security_invoker = true`.** Senza, la vista gira
coi permessi del suo proprietario, salta le RLS e mostra le righe di tutte
le società a chiunque abbia fatto l'accesso: è successo con
`v_atleti_doppioni`, che esponeva gli atleti — minori — di ogni squadra
(chiusa con la 029). Vale anche per le viste ricreate con `drop` e
`create`: l'opzione non sopravvive al `drop`, va riscritta.

**Il controllo si rifà a ogni migrazione**, non solo quando si tocca una
vista. In `schema.sql` la sezione delle viste comincia con l'elenco di
quelle scoperte; dal pannello, questa deve restituire zero righe:

```sql
select c.relname, c.reloptions
  from pg_class c
 where c.relnamespace = 'squadra'::regnamespace
   and c.relkind = 'v'
   and not coalesce(c.reloptions @> array['security_invoker=true'], false);
```

**Dopo ogni passo che scrive, un controllo che legge.** Il "Success" del
pannello SQL non è una verifica. Con la 032 il passo con due
`create or replace view` dentro lo stesso `begin`/`commit` ha risposto
"Success" e non ha applicato niente; eseguite una alla volta, senza
transazione, le viste sono entrate. Quindi in ogni migrazione:

- ogni passo che scrive è seguito da una `select` che mostra il
  risultato atteso (la colonna c'è, le righe sono quelle, il vincolo
  esiste), e si guarda quella, non il messaggio;
- le viste si ricreano una alla volta, senza `begin`/`commit` intorno:
  ogni `create or replace view` è già atomico da sé;
- dove i numeri non devono muoversi, la fotografia prima e dopo
  (un'impronta md5 delle righe, come nella 032) va fatta in un'ora
  morta, senza salvataggi in mezzo.

**Ogni tabella nuova in `squadra` nasce con RLS attiva e le sue policy,
nella stessa migrazione.** I privilegi di default dello schema danno in
automatico `arwd` (select, insert, update, delete) ad `authenticated`
(`authenticated=arwd/postgres`, verificato il 18/10/2026; ad `anon`
niente): senza RLS, chiunque abbia fatto l'accesso legge e scrive le
righe di tutte le società. Una tabella con RLS attiva e senza policy è
chiusa a tutti, che è l'errore giusto da fare; il contrario no. Le
policy si scrivono nel file stesso, non "dopo".

Al controllo di ogni migrazione, accanto a quello delle viste, si
aggiunge questo — anche lui deve restituire zero righe:

```sql
select c.relname
  from pg_class c
 where c.relnamespace = 'squadra'::regnamespace
   and c.relkind in ('r', 'p')
   and not c.relrowsecurity;
```

Le categorie **non** sono un enum: sono la tabella `squadra.categorie`
(`codice`, `nome`, `ordine`, `colore` NOT NULL), e `atleti.categoria_override`
è una colonna `text` con foreign key su `squadra.categorie(codice)`. In
`squadra` l'unico enum pertinente è `specializzazione` — quello sì vuole
`alter type ... add value`, fuori transazione. Aggiungere una categoria è
un `insert ... on conflict`, sul modello della 020. Il `colore` è un nome
della mappa `TINTE` in `src/lib/colori.js`: se manca, `tinta()` non lascia
un buco visibile ma ripiega sul ciano, quindi la categoria nuova sembra
colorata come le altre.

Stato delle migrazioni. **Verificato sul database il 29/09/2026:** c'è
l'indice `atleti_chiave_unica` (021); `v_carico_zona_reale` legge `svolto`
e `v_fase_reale` si appoggia a lei (023); `v_serie` filtra il lavoro a
secco (027); fra le categorie ci sono `TRI`, i `TEEN_*` e `MAS`.

**Eseguite a mano e verificate il 18/10/2026:** la 031
(`v_carico_zona_reale` legge i metri di `svolto` come numeric e
arrotonda) e la 032 (`squadra.livelli_zona`, `livello` su
`squadra.zone` e in coda alle due viste di carico, impronte prima e
dopo identiche), e la 030: `anon` ha solo `SELECT` su `categorie`,
`categorie_stagione` e `zone`. SwimCoach AI tocca `squadra` (`membri`,
`periodizzazione`, insert in `sedute`) solo con l'utente loggato: il
dettaglio è nel file della 030. Infine la 033: le fasce d'età della
2026/27 in `categorie_stagione`, copiate dalla 2025/26 con gli anni +1,
Propaganda compresi (27 righe per stagione, confronto riga per riga
vuoto). Solo dati: `schema.sql` non cambia.

**Eseguita a mano e verificata il 22/10/2026: la 034** (`v_frequenza`
con le regole del 19/10: G fuori dal conto, R presenza, percentuale
null senza denominatore, tre colonne `pct_*` in coda), dopo il deploy
della 0.58.0 che la legge. Confronto con le presenze ricontate vuoto,
fotografia di atleti e ritardi identica. Le finestre `_sett` e
`_mese` della vista restano gli ultimi 7 e 30 giorni: l'app non le
legge più, Sett. e Mese li calcola lei.

**Eseguita a mano e verificata il 25/10/2026: la 035**, dopo il deploy
della 0.60.0, un passo alla volta: `passo_gara` nell'enum
`famiglia_zona` (passo 1, da solo), la D in `squadra.zone` con ordine
90, colore `'indigo'` (le altre zone hanno tutte un colore; in `TINTE`
è lo stesso `#818CF8` della famiglia) e livello vuoto, come vuole la
032. Fotografia di `v_carico_zona` identica prima e dopo (3114 righe,
3073149 m), viste e tabelle tutte protette. `schema.sql` da
rigenerare: l'enum ha un valore in più.

La D c'era nell'app anche prima della 035, e il codice resta: la mette
nell'elenco delle zone `zoneConLaD` (dove App legge le zone), che ora
trova quella del database e non ne aggiunge una seconda; revisore ed
editor prendono le voci della tendina da `opzioniZona`, dove la D è
«D». Nei grafici è una famiglia a sé, `passo_gara`, col suo colore;
`famigliaDiRiga` la completa quando una riga arriva senza famiglia.
Confronto, che legge `v_fase_confronto` già raggruppata per famiglia,
la conta come passo gara da quando c'è la 035: prima la contava come
«altro».
Percentuali sempre sulle quattro famiglie; la D ha la sua quota sul
totale nuotato, distinta dai metri senza zona (`percentualiPerFamiglia`).

**Non verificate direttamente**, ma presunte applicate perché l'app usa
quello che portano: la 025 (colonna `sedute.atleti`) e la 026
(specializzazione Fondo). E non sappiamo quale file abbia inserito i
`TEEN_*` e `MAS` in `squadra.categorie`: la 020 mette solo Master, dei
Teen nel repo non c'è traccia.

La 021 nel repo è un file unico. Se corrisponda a quello che è stato
eseguito davvero lo dirà `schema.sql`, non il file.

**Resta aperto** il censimento delle sedute vecchie con sezioni tipo
"Palestra" **non marcate a secco** e con metri scritti: la 027 non le
copre, perché filtra sul campo `aSecco` e quelle sezioni non lo hanno.
Portano metri fantasma dentro i volumi, e per trovarle serve guardare i
titoli, non il campo.

`schema.sql` da rigenerare e committare: chiude i dubbi su 021, 025, 026 e
sull'origine dei `TEEN_*`. Il censimento Palestra no: serve una query sui
titoli delle sezioni.

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

**La D è una zona come le altre: il passo gara** (decisione del
25/10/2026, che sostituisce quella del 23). La distanza della gara NON
è obbligatoria e non si salva a parte: se c'è, la tiene il testo della
riga. D, D200, D200SL, d200, «D 200», «passo 200» e «Passo 200/100» si
riconoscono tutte come D, e nessuna va in revisione. Nella tendina c'è
solo «D». La D non si confonde con DO e DE: vale da sola o seguita da
cifre, mai seguita da una lettera. Tutto in `dominio.js`
(`leggiPassoGara`), prove in `prova_passo_gara.mjs`.

Il 23/10 si era deciso il contrario (distanza obbligatoria, salvata in
`garaDistanza` e `garaStile`, «D200» in tendina e in stampa): è durato
due giorni ed è stato tolto. Le righe salvate in quei giorni su
`sviluppo` possono avere ancora quei due campi: non li legge più
nessuno.

**La D non sposta i metri.** Il 200 di D200 è la gara, non un tratto:
`leggiRiga` lo toglie prima di contare (`senzaPassoGara`), altrimenti
nella regola del «+ tratto» fermava la somma — «6x100 + 100 D200»
valeva 600. Si toglie solo la forma sicura: quella dubbia lascia la
lettura com'era. Verificato sul CSV dei blocchi di SwimCoach (17934
letture): zero metri diversi.

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

**`moltiplicato` vuol dire due cose opposte secondo cosa si sta
contando.** Sui **metri** è una didascalia: in archivio i metri sono già
moltiplicati, e chi legge somma e basta — `dominio.js`, `v_serie` e
`svolto` non moltiplicano mai una seconda volta. Sui **tempi** è un
fattore da applicare: la durata non deriva dai metri, è ripartenza ×
ripetute, e le ripetute di una figlia stanno metà nella notazione
(`8x50` fa otto partenze) e metà nel blocco che la contiene (tre giri) —
8 × 3 = 24. Fino alla 0.55.5 `durataStimata` leggeva solo la notazione:
un blocco ×3 dava lo stesso tempo della sezione piatta, 15' tanto per
2400 m quanto per 800.

Chi arriva qui dalla regola dei metri è a un passo dal togliere quella
moltiplicazione citando la regola giusta nel posto sbagliato. Sono due
significati dello stesso campo, e sbagliarli costa in entrambi i versi:
metri gonfiati di là, durata bassa di qua. Il caso è fissato in
`prova_blocchi.mjs`.

Il contatore `senzaPartenza` invece **non** si moltiplica: conta righe
da sistemare per l'avviso "N serie senza partenza non contate", non
lavoro non stimato. Una riga dentro un ×3 resta una riga. Se un giorno
l'avviso dovrà dire quanto lavoro manca alla stima, si dice in metri o
in minuti, non in righe.

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
`null`: righe vuote **e** nessuna volta **e** nessuna nota.

**Dalla 0.56.13 `svolto` ha anche `volte`**, accanto a `righe` e `nota`:
le volte davvero fatte di un blocco, sulla chiave della sua apertura. In
"Com'è andata" il campo dell'apertura è il numero di volte, non i metri
(fino alla 0.56.12 scrivere 4 su un "8x" registrava +4 m, col blocco
ancora a otto giri). Cambiarlo riscala in `righe` le figlie in
proporzione, anche quelle corrette a mano; se la divisione non è esatta
la riga resta com'era e si segnala. Toccare i metri di una figlia cambia
solo lei. Niente campo sulle aperture a secco, sulle aperture nude delle
sedute vecchie e sulla fine della ripetizione. Logica in `dominio.js`
(`campoAndata`, `cambiaVolteSvolto`, `cambiaMetriSvolto`), prove in
`prova_svolto.mjs`.

`volte` serve solo a ridisegnare il campo: **nessuno lo somma**. I metri
del blocco stanno sulle figlie in `righe`, ed è lì che li leggono
`v_serie` e `metri_svolti()`. Le volte sono posizionali come i metri, e
`rimappaSvolto` le rimappa con le stesse regole. Le sedute salvate prima
della 0.56.13 possono avere un numero in `righe` sulla chiave di
un'apertura: sono metri finti, che le viste contano. Se ne vanno al primo
cambio di volte di quel blocco.

**Nel passaggio testo → editor si elencano i campi da SCARTARE, mai
quelli da tenere.** `sedutaDaLettura` in `src/lib/importaTesto.js` parte
dalla sezione che il lettore ha prodotto e toglie per nome quello che non
deve finire in archivio (`SCARTA_RIGA`, `SCARTA_SEZIONE`). L'elenco dei
campi da tenere sembra la forma prudente ed è quella che perde: ogni
campo aggiunto al modello e non aggiunto anche lì cade in silenzio. È
successo tre volte, cinque campi — `aSecco` e `durataMin` con la 0.52.0
(la sezione "Palestra" arrivava come lavoro in acqua, con zona e metri),
`apreBlocco`, `moltiplicato` e `senzaMetri` con la 0.54.0 (il blocco
arrivava piatto). I campi del lettore cambiano di rado, quelli del
dominio crescono: l'elenco di scarto è la parte ferma, e un campo nuovo
passa da sé invece di sparire. La conversione sta in un file suo, e non
dentro `RevisioneTesto`, per poterla provare senza montare React:
`prova_import.mjs`, che parte dal testo e non da strutture montate a
mano.

**`metriManuali` vuol dire una cosa sola: i metri li ha decisi
l'allenatore.** Lo mette `cambiaMetri` nell'editor e, dalla 0.56.10,
l'import solo sulle righe coi metri **corretti nel revisore** (una
correzione uguale al numero letto non conta). Fino alla 0.56.9 stava su
tutte le righe importate: serviva a non far riscrivere i metri al
vecchio `metriDaNotazione`, che leggeva diversamente dal lettore del
testo. Dalla 0.56.6 il lettore è uno, e il tappo teneva fermi i metri di
qualunque riga importata ritoccata nell'editor, e quelli delle figlie di
un blocco importato cambiando le volte. **Sulle sedute importate prima
della 0.56.10 il campo non distingue niente.**

Finché `moltiplicato` si perdeva era stato lui, per combinazione, a
impedire che un blocco importato venisse moltiplicato due volte. La
prova in `prova_import.mjs` spoglia le righe di `metriManuali` apposta,
e così resta: a reggere deve essere `moltiplicato`, non lui.

**Una riga di composizione resta composizione anche dopo un ritocco.**
"4x100" seguito da "50 sl" e "50 do": le sotto-righe sommano la
ripetuta sopra, la descrivono, e valgono 0 apposta. Fino alla 0.56.9
l'import scartava il flag `composizione` (stava in `SCARTA_RIGA`, con
l'idea che lo zero lo dicesse già `metri`), e a tenerle a zero era di
nuovo `metriManuali`, per combinazione. Tolto quel tappo, ritoccare "50
sl" in "50 sl forte" la rileggeva come lavoro suo: +50 metri in
silenzio. Dalla 0.56.10 il flag arriva in archivio, `cambiaNotazione`
non riscrive i metri di una riga di composizione e `annotaLettura` le
mette `metriLetti: 0`, coerente coi metri. Lo zero di una composizione
non è un'assenza di metri, è una scelta.

Si smette di essere composizione **scrivendo i metri a mano**: con
`cambiaMetri` nell'editor e con una correzione dei metri nel revisore.
Da lì la riga è un lavoro deciso dall'allenatore e `metriLetti` torna a
leggere la notazione. Il caso è fissato in `prova_import.mjs` e
`prova_blocchi.mjs`.

Il flag lo scrive solo l'analizzatore (`chiudiGruppo`). Nell'editor non
si crea una composizione: una riga battuta lì sotto una ripetuta è un
lavoro, finché non esiste un gesto per dire il contrario. E le sedute
importate prima della 0.56.10 il flag non ce l'hanno — le loro righe a
zero si riconoscono solo ricostruendo la somma, come fa il censimento.

**`metriLetti` è il numero del lettore, accanto a `metri`.** Stessa
unità — dentro un blocco già moltiplicato — così che `metri !==
metriLetti` voglia dire una cosa sola: qualcuno l'ha cambiato a mano.
Serve al controllo delle sedute, per non scambiare una scelta
dell'allenatore per una lettura sbagliata. Tre stati, e la differenza
conta: un **numero** (letto questo), **`null`** (il lettore c'è passato e
non ha trovato metri: la riga «rossa» all'import, una notazione non
capita nell'editor), **assente** (riga salvata prima della 0.56.10, oppure
apertura di blocco o lavoro a secco, dove non c'è niente da leggere).

Chi lo scrive: `sedutaDaLettura` all'import, col numero dell'analizzatore
**prima** delle correzioni del revisore (le composizioni a zero e le
figlie già moltiplicate sono lettura anche loro); `annotaLettura` in
`dominio.js` quando cambia la notazione, chiamata **dopo**
`ricalcolaBlocchi` perché legge il fattore da `moltiplicato`;
`ricalcolaBlocchi` lo riscala per rapporto quando cambia il blocco,
**anche sulle righe a metri fissi** — è proprio lì che lo scarto deve
restare visibile — e se la divisione non torna lo toglie. Mai in lettura,
mai all'apertura di una seduta, nessun riempimento retroattivo.

**Nessuno lo somma.** Volumi, carico, viste e svolto leggono `metri`. Chi
un giorno lo trovasse comodo per un totale sta contando quello che il
lettore pensa, non quello che l'allenatore ha programmato. L'invariante
«senza metri battuti a mano, dopo qualsiasi gesto, `metri ===
metriLetti`» è fissata in `prova_blocchi.mjs`: se si rompe, ogni riga
sembra corretta a mano.

**"+ tratto" dopo un set è lavoro in più.** Convenzione dell'allenatore:
"6x100 + 100 sl" fa 700, "4x50 @45" + 100 B1" fa 300, "4x50 @1'30 SL +
50GB TAV Bocc + tavola" fa 250. La ripartenza, gli attrezzi e una coda
di testo non cambiano niente. L'allenatore intendeva 200 metri ma ha
scritto la riga male: per la sua convenzione "+ tratto dopo un set =
lavoro in più" quella notazione vale 250, ed è giusto che il lettore la
legga così. Si corregge la notazione, non il lettore. L'ipotesi «la ripartenza nel primo termine vuol dire
che il resto descrive» va contro "2x (4x50 SL @45" + 100 B1)", che fa
300 a giro: non si rimette. Le
eccezioni sono tre, e sono tutte scritte in `sommaInTesta`: il termine
prima vale una ripetuta sola (`1x75`, gruppo senza moltiplicatore), il
tratto ha il decimale (`12,5`), oppure la coda del tratto contiene
un'altra misura.

**La coda di un set che contiene un'altra misura lo descrive (A′, dalla
0.56.11).** "6x(1x100 + 4x25) 100MX + 4x25 SL super sub" fa 1200, "8x50
MX 25GB lat + 25MX 2x" fa 400: il "+" sta dentro la descrizione. Il set
si conta, la somma finisce lì, e la riga **non** si cerca anche da
destra con `sommaInCoda`, che troverebbe i numeri della descrizione
("8x75 MX 50+25" diventava 75). Sulle prove esistenti non cambia niente;
sull'archivio di prova (il CSV dei blocchi di SwimCoach, 2935 righe)
fa sparire 153 disaccordi col foglio e ne crea uno.

Quell'uno è il **limite noto**: "1x400 palette SL 400 + 2x200 + 4x100 +
8x50" fa 1600 nel foglio, e il lettore legge 400. Il 400 in coda ripete
la distanza invece di descriverne una parte. Distinguerlo con "la misura
in coda è più corta della ripetuta" ne rompeva 25: non si fa. La lettura
resta 400 e `leggiRiga` la dichiara `dubbia` quando valgono **tutte e
due** le condizioni: la coda ripete la distanza della ripetuta, e dopo
il "+" comincia un set. Con la prima sola scattava su 13 righe
dell'archivio e 12 erano giuste ("8x25 25 apnea + 25 completo": dopo il
"+" viene un tratto). `dubbia` la usa solo il controllo delle sedute;
revisore ed editor non la mostrano. Il limite è fissato in
`prova_analizzatore.mjs`: se un giorno la riga vale 1600, la prova
salta per dire che il limite è stato tolto.

**Controlla le sedute (0.56.11).** `metriDaRicontrollare` in `dominio.js`
confronta i metri salvati con quello che la notazione dà oggi, fattore
del blocco compreso; `applicaRicontrollo` e `applicaRicontrolloInBlocco`
rifanno il controllo e scrivono solo la riga promessa. Come
`apertureNude`: la stessa funzione trova e applica, così il numero
promesso è quello che arriva. Prove in `prova_controllo.mjs`.

Due famiglie di righe, due domande diverse:

- **Con `metriLetti`.** `metri !== metriLetti` è una scelta
  dell'allenatore e non si propone mai di cambiarla. Si guarda solo se
  il lettore di oggi legge diverso da `metriLetti`:
  `lettore-cambiato` (mai corretta: si propone la lettura di oggi) o
  `corretta-a-mano` (si segnala, senza numero e senza tasto). Null e
  zero valgono uguale: l'import scrive 0 dove l'editor scriverebbe null.
- **Senza `metriLetti`** (prima della 0.56.10). `lettura-vecchia` si
  propone, anche con "aggiorna tutte"; `metri-fissi` (`metriManuali` o
  `perStile`) e `a-zero` solo una per una. Le sedute importate prima
  della 0.56.10 hanno `metriManuali` su tutte le righe: per loro
  "aggiorna tutte" non c'è mai, ed è voluto.

Niente numero, mai: la notazione che oggi non si legge (`non-capita`)
e la lettura `dubbia` (`lettura-dubbia`). Zero sarebbe un numero
inventato.

Si salta senza segnalare: il lavoro a secco, le aperture, `senzaMetri`,
le composizioni (col flag o ricostruite: sotto un NxD, righe a zero la
cui lettura somma D), la notazione che non vale metri. Torna in
`saltate`, per contarla: la seduta da SwimCoach (scritta con le regole
di un'altra app), la sezione che `apertureNude` segnala (prima i
blocchi, o due avvisi propongono numeri diversi sulle stesse righe) e la
riga col `moltiplicato` diverso dal blocco in cui sta (scrivere i metri
lasciando il fattore sbagliato la peggiorerebbe; la sistema il primo
ritocco nella sezione).

**Mai `svolto`, mai senza Salva.** La riga con una chiave in `svolto`
non ha tasto: il rilevato può essere stato scritto partendo dal numero
sbagliato, e lo sa solo chi c'era. Il tasto scrive nella bozza; prima di
Salva l'editor chiede conferma dicendo quanti metri cambiano e in quale
settimana, perché sono date storiche e Volumi e Dashboard di quei giorni
si muovono. Applicare scrive `metri`, e `metriLetti` accanto solo sulle
righe che lo avevano già: nessun riempimento retroattivo.
`metriManuali` resta dov'è. In sola lettura il riquadro si vede, i tasti
no. In Calendario il conto è sulla stagione intera, una lettura per
società e stagione, e sta in un `useMemo`: disegnare il calendario non
lo rifà.

**I blocchi importati prima della 0.54 si ricostruiscono.** Lì il "3x"
è arrivato senza `apreBlocco` e le figlie senza `moltiplicato`, ma coi
metri già moltiplicati e fissati: `apertureNude` non li vede, perché non
manca niente, e nessun tasto li sistema. Il controllo prende il fattore
dalla riga di apertura (`aperturaDiBlocco`) fino alla prossima apertura
o a fine sezione, come `figlieDelBlocco`. Le figlie sono sempre
`metri-fissi`, una per una e mai "tutte", e portano `bloccoRicostruito:
N` perché l'editor dica «controlla che la riga fosse dentro il ×N».

Il confine è dedotto, non scritto: nel testo "3x / 8x50 / (riga vuota) /
200" la riga vuota chiudeva il blocco, ma in archivio non c'è. Quindi
**una riga salvata esattamente a un giro di oggi chiude il blocco**, da
lì in giù: il lettore di allora dentro il blocco moltiplicava sempre.
Il prezzo: una figlia letta male, il cui numero sbagliato coincide per
caso con un giro, chiude il blocco troppo presto. Si perde una
segnalazione, non arriva un numero sbagliato. Restano non riconoscibili
dai dati: un "3x" ritoccato a mano dopo l'import, le aperture che il
lettore di allora leggeva diversamente, le righe spostate nel blocco
prima della 0.55. Per quelle c'è il confronto riga per riga.

Un pericolo che non è di questo controllo: un blocco importato prima
della 0.48 **senza** `metriManuali` lo segnala `apertureNude`, e il suo
tasto triplicherebbe righe già moltiplicate. Dalla 0.48 l'import ha
sempre messo `metriManuali`, quindi riguarda solo sedute più vecchie del
repo.

**Cambiare la specializzazione di un atleta gli sposta anche i volumi
storici.** `sezionePer()` in `dominio.js` confronta stringhe esatte fra la
specializzazione dell'atleta e i `destinatari` scritti nella sezione. Chi
passa da Mezzofondo a Fondo smette di ricadere nelle sezioni storiche
intestate `Mezzofondo`: i suoi metri passati si riducono al riscaldamento
comune, e Volumi e Dashboard mostrano numeri più bassi di prima. È il
comportamento corretto, ma è una sorpresa che altrimenti si scopre davanti
a un grafico che non torna. Se un giorno servisse difendere il pregresso,
la via è riclassificare a partire da una data, non retroattivamente.

**Ci sono categorie che sono percorsi, non età: Teen, Master e
Triathlon.** Non hanno righe in `categorie_stagione` e non devono
averne: se gliene dai una, ogni atleta di quell'età ci cade dentro da
solo — un agonista di 28 anni diventa Master, e Master è un tipo di
tesseramento. Si assegnano a mano (`categoria_override`) o scrivendole
nella colonna categoria del CSV.

**I Propaganda invece hanno fasce d'età**, dalla 024: sotto gli
Esordienti B la tabella FIN non ha niente, e i Propaganda sono solo
bambini più piccoli, quindi le fasce continuano a ritroso (`PROP_2`,
`PROP_01`). Ogni stagione nuova li copia come tutte le altre — la 033
ha fatto così con la 2026/27. Escluderli cambierebbe le categorie dei
più piccoli: la proiezione dell'app li contiene già.

Per lo stesso motivo **non si deducono**. Fino alla 0.55.5
`categoriaDaCsv` proponeva Master sopra i 25 anni: era nata come
proposta, ma il codice finiva in `categoria_override` indistinguibile da
uno scritto a mano, e al reimport successivo riscriveva la scelta
dell'allenatore. Dalla 0.56.0 colonna vuota vuol dire "dall'anno" a
qualsiasi età. Chi guarda quel codice tenendo presente solo l'import
nuovo è tentato di rimetterla: non è una comodità mancante, è una
scrittura mascherata da suggerimento.

Nota di sicurezza sull'import: una colonna categoria **vuota** non tocca
un override esistente, e non è un dettaglio — i fogli scaricati prima
della 0.56.0 non hanno affatto quella colonna, quindi reimportarne uno a
inizio stagione azzererebbe gli override di tutta la squadra. Per
togliere un override c'è la voce "— (dall'anno)" nella scheda Atleti.

**Una sezione si destina solo a Tutti o a una specializzazione.** Non
esiste la sezione destinata a una categoria: le categorie vivono su
`seduta.categorie`, a livello di seduta, e dicono a chi è rivolta la
seduta intera. Lo dicono tre posti indipendenti, e vanno tenuti
d'accordo: l'editor offre «Tutti» più `SPECIALIZZAZIONI` senza Generale
(`EditorSeduta.jsx`), l'analizzatore mappa solo specializzazioni
(`DESTINATARI_TITOLO`), e `validaSeduta` segnala tutto il resto come
«Destinatari sconosciuti».

Di conseguenza `sezionePer` scarta una sezione con destinatari diversi,
e con lei la scartano sia i volumi sia la durata. Se un giorno servisse
davvero dividere per categoria dentro una seduta — «oggi gli Esordienti
questo, i Ragazzi quello» — non è una correzione al calcolo: va estesa
`sezionePer` perché conosca anche la categoria dell'atleta, e insieme a
lei `validaSeduta`, i volumi e la durata. Farne una sola lascia il
lavoro invisibile da qualche parte.

**Una card a zero metri non è un difetto da filtrare.** Nel riepilogo può
comparire una specializzazione con `0 m`, e di solito è informazione. Due
casi diversi:

- **Palestra comune più un ramo dedicato**, gruppo tutto Generale: la card
  Generale ha zero metri e venti minuti veri, perché il lavoro a secco è
  comune e il tempo è tempo. Toglierla per via dei metri cancellerebbe
  anche quello.
- **Seduta tutta divisa in rami**, gruppo che non li fa: card a zero metri
  *e* zero secondi. Non è un errore del conto — dice che il lavoro è
  scritto per specializzazioni che nel gruppo non ci sono, e vale la pena
  accorgersene.

Se un filtro servirà mai, il test è **metri 0 E secondi 0**, mai i soli
metri. Il caso è fissato in `prova_riepilogo.mjs`, apposta per bloccare
l'idea sbagliata.

**Chiave atleta:** `cognomenome+annonascita` normalizzato, con l'equivalente
SQL in `squadra.chiave_atleta()`. Dalla 021 c'è un indice unico su
`(societa_id, chiave)`: lo stesso atleta non entra due volte nella stessa
società, ma può esistere in società diverse (è normale, es. account di prova).

---

## Come si lavora qui

**Tutto il lavoro va su `sviluppo`.** Commit e push si fanno lì. `main`
si aggiorna **solo quando lo dice l'allenatore**, con un rilascio unico
che porta dentro tutto quello che è maturato su `sviluppo`: non si
fondono pezzi alla spicciolata, non si fa push su `main` di propria
iniziativa, nemmeno per una patch che sembra innocua.

L'unica eccezione sono i difetti che **scrivono dati sbagliati** o
**bloccano l'app**: lì la correzione può andare su `main` subito, e poi
si riporta su `sviluppo` perché i due rami non divergano. Un difetto
che si vede male, o un numero mostrato storto ma salvato giusto, non è
un'eccezione: aspetta il rilascio.

**La correzione urgente si riporta UNENDO `main` dentro `sviluppo`**
(`git switch sviluppo` e `git merge main`), **mai ricopiandola con
`cherry-pick`**. La copia crea un secondo commit con lo stesso contenuto
e un altro nome: git non sa che sono la stessa modifica, e al rilascio
ogni riga che `sviluppo` ha ritoccato dopo diventa un conflitto. È
successo con la 0.57.0: la 0.56.13 stava su `main` come `51ed18a` e su
`sviluppo` come `82bd8d6`, identiche, e il merge si è fermato su sette
file. Col merge invece il commit è uno solo, sta in tutti e due i rami,
e il rilascio dopo non lo rivede.

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

**Il push si fa solo dopo una build verde, nello stesso comando:**
`npm run build && git push ...`. Con due comandi separati, o legati da
`;`, il push parte anche quando la build si è fermata: il 23/10/2026
`3159488` è arrivato su `prova-ios` con ESLint rosso. Vale anche per
commit e merge che precedono un push: tutto dietro `&&`.

**Prima di pacchettizzare si esegue `npm run build`**, che è la catena
completa: allineamento versione, eslint, controllo import, poi tutte le
prove (`prove.mjs`, che esegue ogni `prova_*.mjs` della cartella
principale), poi la build Vite col guardiano sui chunk circolari. Non si
consegna niente senza averla vista passare.

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

**Descrizione delle righe di composizione.** Quando i sotto-tratti
sommano la distanza della riga sopra, l'analizzatore appende alla riga
padre una `descrizione` (`analizzatore.js:610`). Nel passaggio testo →
editor si perde: `importaTesto.js` la scarta di proposito, perché
l'editor non ha dove mostrarla e scriverla in archivio senza che nessuno
la legga è peggio che non averla. Si recupera quando l'editor saprà
cosa farsene — non prima.

**Due fughe della stessa forma, lasciate aperte di proposito.** Con la
0.55.3 l'azzeramento di `moltiplicatoreAttivo` è passato dentro
`nuovaSezione`, perché era scritto in cinque rami su otto e tre se lo
dimenticavano. Nello stesso ciclo ce ne sono altre due con la stessa
forma, non toccate per tenere il rilascio leggibile:

- `zonaCorrente` si propaga oltre i titoli di sezione. Non produce metri
  sbagliati, solo zone ereditate dove magari non le vuoi — va deciso
  caso per caso se è un difetto o è comodo.
- `chiudiGruppo()` è ripetuto in tutti e otto i rami che aprono una
  sezione, esattamente com'era l'azzeramento. Assorbirlo in
  `nuovaSezione` è lo stesso ragionamento, ma tocca il calcolo della
  composizione — dove stanno i metri veri — e vuole un rilascio suo.

**Promemoria su `annuncia` mancante, solo per minor e major.** È già
successo di consegnare una minor senza `annuncia: true` e accorgersene
dal campo: la 0.56.0 portava il Master che non si indovina più, e il
pannello non si è aperto (rimediato con la 0.56.1, perché App.jsx segna
la versione vista a ogni apertura e ripubblicare la stessa non avrebbe
annunciato niente a chi l'aveva già aperta).

Da fare in `sincronizza_versione.mjs`, che già legge sia `package.json`
sia il registro. Due vincoli, e sono il punto:

- **Solo quando cambia minor o major.** Su ogni patch sarebbe rumore —
  delle sette voci fino alla 0.56.0, sei giustamente non annunciavano, e
  un avviso che scatta quasi sempre si impara a saltare. È lo stesso
  motivo per cui `sospettiImport` non segnala i MAS che derivano SEN_1.
  Una patch è una correzione e il silenzio è il default giusto; una
  minor è roba nuova, e lì l'assenza è quasi sempre una dimenticanza.
- **Non bloccante**, un promemoria stampato e non un errore. Se fermasse
  la build, la scorciatoia sarebbe mettere `annuncia: true` per farla
  passare, e la decisione tornerebbe automatica — esattamente quello che
  `novita.js` rifiuta in apertura. Il messaggio chiede conferma, non
  accusa: «0.57.0 è una minor senza annuncio: confermi?».

**Chiuso il 25/10/2026: le prove le trova `prove.mjs`.** Prima lo script
`build` in `package.json` nominava i `prova_*.mjs` uno per uno: una prova
nuova restava fuori in silenzio (è successo con `prova_riepilogo.mjs`),
e il 24/10, con `prova_passo_gara.mjs` aggiunta, la riga era così lunga
che `npm run build` su Windows si bloccava prima del primo comando, senza
scrivere niente. Ora `prove.mjs` esegue ogni `prova_*.mjs` della
cartella principale (non delle sottocartelle), in ordine alfabetico,
stampando il nome di ognuno, e si ferma al primo che fallisce dicendo
quale. Una prova nuova si aggiunge creando il file, e basta.

**Da guardare: `pannelloAtleti` non torna mai a `false`.** In
`EditorSeduta.jsx` si accende quando apri il pannello delle doppie, e
anche da sé quando la seduta che apri ha già una selezione di atleti
(«non si richiude mai da sola», e per quella seduta è voluto). Ma non si
azzera **cambiando seduta**: passando a una seduta normale il pannello
resta aperto, e tornando all'elenco resta acceso pure lì. Non rompe
niente — da quando la lettura degli atleti guarda `seduta` e non più lo
stato del pannello, non provoca nemmeno più letture a vuoto — però è uno
stato che sopravvive al suo contesto. Si chiude azzerandolo quando cambia
`seduta?.id`, tenendo l'apertura automatica per le sedute che hanno
davvero degli atleti scelti.

**Altro in coda:** duplicazione seduta; offline vero con coda di sincronizzazione
per l'appello; import seduta da foto (Edge Function OpenAI già presente);
esercizi legati a notazione e lavagna; modifica gare già salvate; Crono che
propone C3 o D secondo la fase; import risultati FIN; privacy e consenso dei
genitori prima del lancio pubblico.

**Passi (tempi obiettivo) da non progettare:** c'è un'idea non ancora
raccontata. Non si disegna niente sui tempi finché non è stata ascoltata.
