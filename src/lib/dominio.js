// =====================================================================
// dominio.js — fonte di verità condivisa fra CorsiaPro e SwimCoach AI.
//
// REGOLA: questo file si modifica in UN SOLO POSTO. Copialo identico nei
// due progetti (o mettilo in un package quando i due si stabilizzano).
// Le funzioni qui dentro rispecchiano esattamente quelle SQL di
// 003_viste_volumi.sql: se cambia una, cambia l'altra.
//
// Nessuna dipendenza: importabile da qualsiasi front-end.
// =====================================================================

export const TUTTI = "*";

// Stesso ordine dell'enum squadra.specializzazione (Fondo aggiunto dopo
// Mezzofondo con la 026): le viste che ciclano su enum_range elencano le
// righe in quest'ordine, e le tendine qui devono coincidere.
export const SPECIALIZZAZIONI = ["Velocità", "Mezzofondo", "Fondo", "Salvamento", "Generale"];

// Fallback locale: a runtime le zone si leggono da squadra.zone.
// Qui servono solo per rendering offline e per i test.
export const ZONE = [
  { codice: "A1", nome: "Aerobico lento / ripristino", famiglia: "aerobico" },
  { codice: "A2", nome: "Aerobico medio", famiglia: "aerobico" },
  { codice: "B1", nome: "Soglia anaerobica", famiglia: "aerobico" },
  { codice: "B2", nome: "Massimo consumo di ossigeno", famiglia: "vo2" },
  { codice: "C1", nome: "Tolleranza lattacida", famiglia: "lattacido" },
  { codice: "C2", nome: "Potenza lattacida", famiglia: "lattacido" },
  { codice: "C3", nome: "Velocità alattacida", famiglia: "alattacido" },
];

export const FAMIGLIE = ["aerobico", "vo2", "lattacido", "alattacido"];

export const CATEGORIE = [
  { codice: "PROP_01", nome: "Propaganda 0-1", ordine: 10 },
  { codice: "PROP_2", nome: "Propaganda 2", ordine: 20 },
  { codice: "TEEN_0", nome: "Teen 0", ordine: 30 },
  { codice: "TEEN_1", nome: "Teen 1", ordine: 40 },
  { codice: "TEEN_2", nome: "Teen 2", ordine: 50 },
  { codice: "ESO_B1", nome: "Esordienti B1", ordine: 60 },
  { codice: "ESO_B2", nome: "Esordienti B2", ordine: 70 },
  { codice: "ESO_A1", nome: "Esordienti A1", ordine: 80 },
  { codice: "ESO_A2", nome: "Esordienti A2", ordine: 90 },
  { codice: "RAG_1", nome: "Ragazzi 1", ordine: 100 },
  { codice: "RAG_2", nome: "Ragazzi 2", ordine: 110 },
  { codice: "RAG_3M", nome: "Ragazzi 3 (M)", ordine: 120 },
  { codice: "JUN_1", nome: "Junior 1", ordine: 130 },
  { codice: "JUN_2", nome: "Junior 2", ordine: 140 },
  { codice: "CAD_1", nome: "Cadetti 1", ordine: 150 },
  { codice: "CAD_2", nome: "Cadetti 2", ordine: 160 },
  { codice: "SEN_1", nome: "Senior 1", ordine: 170 },
  { codice: "SEN_2", nome: "Senior 2", ordine: 180 },
  { codice: "ASS", nome: "Assoluti", ordine: 190 },
  // Master: unica categoria, non le fasce quinquennali FIN. Non ha fasce
  // d'età in categorie_stagione ed è di proposito: Master è un tipo di
  // tesseramento, non un'età. Si assegna a mano con categoria_override,
  // altrimenti ci finirebbe dentro ogni agonista adulto.
  { codice: "MAS", nome: "Master", ordine: 200 },
];

// ---------------------------------------------------------------------
// Seduta — il contratto. Stessa forma se scritta a mano o generata.
// ---------------------------------------------------------------------
export function sedutaVuota({ data, categorie = [] } = {}) {
  return {
    data: data || new Date().toISOString().slice(0, 10),
    categorie,
    origine: "manuale",
    titolo: "",
    sezioni: [
      { titolo: "Warm Up", destinatari: [TUTTI], serie: [] },
      { titolo: "Parte centrale", destinatari: [TUTTI], serie: [] },
      { titolo: "Sciolto", destinatari: [TUTTI], serie: [] },
    ],
  };
}

export function serieVuota() {
  // La zona parte da A1: è il caso più frequente, si cambia solo quando serve.
  return { notazione: "", zona: "A1", metri: 0, recupero: "", note: "" };
}

// ---------------------------------------------------------------------
// METRI DALLA NOTAZIONE
// "1x400" = 400 · "2x200" = 400 · "4x(1x100 + 2x50)" = 800
// "12/10/8x100" = 3000 (scaletta) · "8x50 sl" = 400 (il testo si ignora)
// Restituisce null se non riesce a leggere: in quel caso i metri restano
// quelli scritti a mano, senza inventare nulla.
// ---------------------------------------------------------------------
export function metriDaNotazione(testo) {
  if (!testo) return null;

  // Via lo stile, restano cifre e operatori. Lo spazio conta: "4x100 @1'40"
  // deve dare 400, non attaccare il recupero alla distanza.
  const grezzo = String(testo)
    .toLowerCase()
    .replace(/[×*]/g, "x")
    .replace(/[^0-9x()+/]/g, " ");

  let s = "";
  let prof = 0;
  for (let k = 0; k < grezzo.length; k++) {
    const ch = grezzo[k];
    if (ch === " ") {
      if (prof > 0) continue;                    // dentro parentesi lo spazio non conta
      let j = k;
      while (j < grezzo.length && grezzo[j] === " ") j++;
      if (j >= grezzo.length) break;
      const dopo = grezzo[j];
      const prima = s[s.length - 1];
      // Lo spazio si ignora solo attorno a un operatore.
      if ("+x/)".includes(dopo) || s === "" || "+x/(".includes(prima || "")) {
        k = j - 1;
        continue;
      }
      break;                                     // un numero staccato: l'espressione finisce qui
    }
    if (ch === "(") prof++;
    if (ch === ")") prof = Math.max(0, prof - 1);
    s += ch;
  }

  if (!s) return null;

  let i = 0;
  const fine = () => i >= s.length;
  const guarda = () => s[i];

  function numero() {
    let n = "";
    while (!fine() && /[0-9]/.test(guarda())) n += s[i++];
    return n === "" ? null : parseInt(n, 10);
  }

  // fattore := numero | ( somma )
  function fattore() {
    if (guarda() === "(") {
      i++;
      const v = somma();
      if (guarda() === ")") i++;
      return v;
    }
    return numero();
  }

  // termine := [ripetizioni x] fattore   (ripetizioni anche "12/10/8")
  function termine() {
    const partenza = i;
    let reps = [];
    let n = numero();
    if (n === null) return fattore();

    reps.push(n);
    while (guarda() === "/") {
      i++;
      const m = numero();
      if (m === null) { i = partenza; return fattore(); }
      reps.push(m);
    }

    if (guarda() === "x") {
      i++;
      const f = fattore();
      if (f === null) return null;
      return reps.reduce((t, r) => t + r * f, 0);
    }

    // Nessuna "x": era una distanza secca, e la scaletta non aveva senso.
    if (reps.length > 1) { i = partenza; return numero(); }
    return n;
  }

  // somma := termine { + termine }
  function somma() {
    let tot = termine();
    if (tot === null) return null;
    while (guarda() === "+") {
      i++;
      const t = termine();
      if (t === null) return null;
      tot += t;
    }
    return tot;
  }

  const risultato = somma();
  if (risultato === null || !isFinite(risultato) || risultato <= 0) return null;
  return risultato;
}

// ---------------------------------------------------------------------
// RECUPERO — si scrive @1'40, e chi scrive 1'40 lo ottiene lo stesso.
// ---------------------------------------------------------------------
export function normalizzaRecupero(testo) {
  let t = String(testo || "").trim();
  if (!t) return "";
  // "3'" da solo sono tre MINUTI: l'apice è il segno dei minuti.
  t = t.replace(/^@?\s*(\d{1,2})\s*'\s*$/, "@$1:00");
  // Convenzione unica: @1:30. L'apice e il punto diventano due punti.
  t = t.replace(/(\d{1,2})\s*['.]\s*(\d{2})\s*"?/, "$1:$2");
  // "@3'" senza secondi vuol dire tre minuti, non tre secondi.
  t = t.replace(/^@?(\d{1,2})'\s*$/, "@$1:00");
  return t.startsWith("@") ? t : "@" + t;
}

// Una sezione senza "destinatari" vale per tutti.
function destinatariDi(sezione) {
  const d = sezione?.destinatari;
  if (!Array.isArray(d) || d.length === 0) return [TUTTI];
  return d;
}

export function sezionePer(sezione, specializzazione) {
  const d = destinatariDi(sezione);
  return d.includes(TUTTI) || d.includes(specializzazione);
}

// ---------------------------------------------------------------------
// LAVORO A SECCO
// Palestra, elastici, core: sta nella seduta, occupa tempo, non fa metri
// e non ha zona. Il titolo lo riconosce l'analizzatore una volta sola e
// segna il campo; da lì in avanti comanda il campo, non il titolo — che
// l'allenatore può riscrivere quando vuole senza far rientrare i metri
// di soppiatto. Chi conta metri passa tutto di qui.
// ---------------------------------------------------------------------
export const eSecco = (sezione) => sezione?.aSecco === true;

export function sezioneSeccaVuota(titolo = "Palestra") {
  return { titolo, destinatari: [TUTTI], aSecco: true, durataMin: 20, serie: [] };
}

// ---------------------------------------------------------------------
// VOLUMI — la regola che il prototipo sbagliava.
// Il volume di chi fa velocità è warm-up comune + sezione velocisti,
// NON la somma di tutte le sezioni della seduta.
// ---------------------------------------------------------------------
export function metriPerSpecializzazione(sezioni, specializzazione, svolto) {
  const righe = svolto?.righe || {};
  let totale = 0;
  (sezioni || []).forEach((sez, i) => {
    if (eSecco(sez)) return;
    if (!sezionePer(sez, specializzazione)) return;
    (sez.serie || []).forEach((s, j) => {
      const c = righe[chiaveRiga(i, j)];
      totale += c !== undefined && c !== null && c !== '' && Number.isFinite(+c)
        ? +c
        : (Number(s.metri) || 0);
    });
  });
  return totale;
}

// Gli stessi metri, spaccati per zona. Serve al grafico settimanale e al
// confronto con gli obiettivi di fase: se il finale duro salta, non
// cambia solo il totale, cambia la ripartizione.
export function zonePerSpecializzazione(sezioni, specializzazione, svolto) {
  const righe = svolto?.righe || {};
  const per = new Map();
  (sezioni || []).forEach((sez, i) => {
    if (eSecco(sez)) return;
    if (!sezionePer(sez, specializzazione)) return;
    (sez.serie || []).forEach((s, j) => {
      const c = righe[chiaveRiga(i, j)];
      const metri = c !== undefined && c !== null && c !== '' && Number.isFinite(+c)
        ? +c
        : (Number(s.metri) || 0);
      if (!metri) return;
      const zona = s.zona || '';
      const famiglia = ZONE.find((z) => z.codice === zona)?.famiglia || 'nonclass';
      const k = zona || 'nonclass';
      const gia = per.get(k) || { zona, famiglia, metri: 0 };
      gia.metri += metri;
      per.set(k, gia);
    });
  });
  return [...per.values()];
}

export function caricoPerZona(sezioni, specializzazione) {
  const out = {};
  for (const sez of sezioni || []) {
    if (eSecco(sez)) continue;
    if (!sezionePer(sez, specializzazione)) continue;
    for (const s of sez.serie || []) {
      const z = (s.zona || "").trim() || "?";
      out[z] = (out[z] || 0) + (Number(s.metri) || 0);
    }
  }
  return out;
}

export function caricoPerFamiglia(sezioni, specializzazione, zone = ZONE) {
  const mappa = Object.fromEntries(zone.map((z) => [z.codice, z.famiglia]));
  const perZona = caricoPerZona(sezioni, specializzazione);
  const out = { aerobico: 0, vo2: 0, lattacido: 0, alattacido: 0, nonClassificati: 0 };
  for (const [codice, metri] of Object.entries(perZona)) {
    const fam = mappa[codice];
    if (fam && fam in out) out[fam] += metri;
    else out.nonClassificati += metri;
  }
  return out;
}

// Metri realmente nuotati dalla squadra in una seduta, dati gli atleti
// presenti (ognuno col proprio percorso).
export function volumeEffettivoSquadra(sezioni, atletiPresenti) {
  return (atletiPresenti || []).reduce(
    (tot, a) => tot + metriPerSpecializzazione(sezioni, a.specializzazione || "Generale"),
    0
  );
}

// ---------------------------------------------------------------------
// CATEGORIE — derivate, mai salvate sull'atleta.
// "fasce" arriva da squadra.categorie_stagione.
// ---------------------------------------------------------------------
export function categoriaDi(annoNascita, sesso, fasce) {
  const match = (fasce || []).find(
    (f) =>
      f.sesso === sesso &&
      annoNascita >= f.anno_nascita_da &&
      annoNascita <= f.anno_nascita_a
  );
  return match ? match.categoria : null;
}

// ---------------------------------------------------------------------
// CHIAVE ANTI-DOPPIONE
// Stessa persona scritta in due modi dev'essere la stessa chiave:
// "D'Amico Luca 2012" e "d' amico  luca 2012" → damicoluca2012.
// Deve restare allineata a squadra.chiave_atleta() in SQL (migrazione 021):
// se cambi qui, cambia anche là, o il vincolo del database e l'anteprima
// dell'import smettono di dire la stessa cosa.
// ---------------------------------------------------------------------
const ACCENTI = { à:'a', á:'a', â:'a', ä:'a', ã:'a', è:'e', é:'e', ê:'e', ë:'e',
  ì:'i', í:'i', î:'i', ï:'i', ò:'o', ó:'o', ô:'o', ö:'o', õ:'o',
  ù:'u', ú:'u', û:'u', ü:'u', ç:'c', ñ:'n' };

export function chiaveAtleta({ cognome, nome, anno_nascita } = {}) {
  return `${cognome || ''}${nome || ''}${anno_nascita ?? ''}`
    .toLowerCase()
    .replace(/[àáâäãèéêëìíîïòóôöõùúûüçñ]/g, (c) => ACCENTI[c])
    .replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------
// PROGRAMMA CONTRO VASCA
// Il programma è quello scritto nelle sezioni. "svolto" tiene solo le
// righe andate diversamente: il gruppo che si pianta all'ottavo cento,
// la serie chiusa prima. Chi non è nella mappa è andato come previsto.
// Gemella di squadra.metri_svolti() in SQL (migrazione 022).
// ---------------------------------------------------------------------
export function chiaveRiga(iSezione, iSerie) { return `${iSezione}-${iSerie}`; }

export function metriSvolti(sezioni, svolto) {
  const righe = svolto?.righe || {};
  let totale = 0;
  (sezioni || []).forEach((sezione, i) => {
    (sezione?.serie || []).forEach((serie, j) => {
      const corretto = righe[chiaveRiga(i, j)];
      totale += Number.isFinite(+corretto) && corretto !== null && corretto !== ''
        ? +corretto
        : (+serie?.metri || 0);
    });
  });
  return totale;
}

// ---------------------------------------------------------------------
// APERTURA DI BLOCCO
// "3x" da solo su una riga: da qui in giù si ripete tre volte, fino a
// fine blocco. La riga non è un lavoro, è un'intestazione: zero metri.
//
// Questa funzione è l'UNICA che decide cos'è un'apertura, e la usano
// tutte e due le strade — il lettore del testo e l'editor a campi. Prima
// la regola stava solo nel lettore, e l'editor non ne sapeva niente: una
// riga "3x" battuta nelle mascherine restava un lavoro qualunque e le
// righe sotto non si moltiplicavano, con la sezione che faceva 1003
// invece di 3000. Due regole scritte in due posti divergono sempre:
// tenerne una sola è il motivo per cui questa funzione è esportata.
//
// Accetta esattamente quello che accettava il lettore, riga per riga:
// "4x", "4x volte:", "6x (gio 4 volte)" e "4x A2", dove la zona scritta
// sull'apertura vale per tutto il blocco. Non accetta "4x100" — quello è
// un lavoro, non un blocco.
//
// Accetta anche "1x", che ripete una volta sola e quindi non ripete
// niente: è una stranezza del lettore, ma toglierla cambierebbe come
// vengono lette le sedute già scritte, e le correzioni al lettore vanno
// in un rilascio loro. Chi offre il comando "ripeti ×N" nell'editor si
// ferma da sé sotto il 2.
// ---------------------------------------------------------------------
export function aperturaDiBlocco(testo) {
  const t = String(testo || '').replace(/[×*]/g, 'x').trim();
  if (!t) return null;
  const m = t.match(/^\s*(\d{1,3})\s*x\s*(?:volte?\s*)?(?:\(.*\))?\s*(A1|A2|B1|B2\+?|C1|C2|C3|D)?\s*:?\s*$/i);
  if (!m) return null;
  if (/\(\s*\d/.test(t)) return null;      // "4x(2x50)" è un gruppo, non un'apertura
  return { ripetizioni: +m[1], zona: m[2] ? m[2].toUpperCase().replace('+', '') : null };
}

// ---------------------------------------------------------------------
// BLOCCHI RIPETUTI
//
// "3x" su una riga per sé apre un blocco: da lì in giù si ripete tre
// volte. Il dato è piatto, senza contenitore — l'apertura è una serie a
// zero metri con `apreBlocco: N`, le figlie portano `moltiplicato: N` e
// i loro `metri` sono GIÀ moltiplicati. Chi legge somma e basta: né
// dominio.js né v_serie né svolto moltiplicano una seconda volta.
//
// Un contenitore sarebbe più bello da guardare e molto peggio da avere:
// annidare le righe sposterebbe ogni `ser_m` e le chiavi posizionali di
// svolto finirebbero sulla riga sbagliata su tutto lo storico.
//
// IN LETTURA il confine si ricava riga per riga da `moltiplicato`, così
// una seduta salvata si ridisegna esattamente com'è — comprese quelle
// dove il lettore chiuse il blocco a metà sezione. IN SCRITTURA il
// blocco va dall'apertura alla prossima apertura o a fine sezione.
// ---------------------------------------------------------------------

// Le figlie del blocco aperto alla posizione `m`, in scrittura.
export function figlieDelBlocco(sezione, m) {
  const serie = sezione?.serie || [];
  const fuori = [];
  for (let k = m + 1; k < serie.length; k++) {
    if (serie[k]?.apreBlocco) break;            // un altro blocco: qui il nostro finisce
    // Anche un'apertura NUDA chiude il blocco: se non la contassimo,
    // applicando il primo blocco ci si mangerebbe il secondo e le sue
    // righe si moltiplicherebbero per il numero sbagliato.
    const altra = aperturaDiBlocco(serie[k]?.notazione);
    if (altra && altra.ripetizioni > 1) break;
    fuori.push(k);
  }
  return fuori;
}

// I metri di una riga dentro un blocco ripetuto N volte. I metri scritti
// a mano non si toccano: quel numero l'ha messo l'allenatore e solo lui
// sa se è il totale o il giro.
export function metriInBlocco(serie, n) {
  if (serie?.metriManuali) return Number(serie.metri) || 0;
  const base = metriDaNotazione(serie?.notazione);
  if (base === null) return Number(serie?.metri) || 0;
  return base * (n || 1);
}

// ---------------------------------------------------------------------
// IL RICALCOLO — un posto solo che decide chi sta in quale blocco
//
// `moltiplicato` sulla riga è una COPIA di "a quale blocco appartengo".
// Scritta una volta e mai più mantenuta, invecchia al primo gesto: una
// riga aggiunta sotto un'apertura non la prendeva mai (e restava a metri
// non moltiplicati, sezione da 900 invece di 3600), una riga spostata
// fuori dal blocco se la teneva addosso. Tre sintomi, un difetto solo.
//
// Quindi l'appartenenza si DERIVA scorrendo la sezione dall'alto, come
// fa il lettore di testo con moltiplicatoreAttivo, e questa funzione la
// riscrive dopo ogni gesto. `moltiplicato` resta nel JSON salvato, ma
// come esito del ricalcolo, non come verità che qualcuno deve ricordarsi
// di aggiornare.
//
// GIRA SOLO DOPO UN GESTO, mai in lettura: aprire una seduta e salvarla
// senza toccarla non deve cambiarne un byte.
//
// I metri NON si rileggono dalla notazione. Se lo facessimo, riscriveremmo
// righe che nessuno ha toccato — la regola della vasca ("2x10" vale 50,
// non 20), le righe di composizione che valgono 0 apposta, senzaMetri —
// e spostare una riga cambierebbe i metri di un'altra, in silenzio.
// Si riscala per rapporto, e solo se il fattore è davvero cambiato.
// ---------------------------------------------------------------------
export function ricalcolaBlocchi(sezione) {
  if (!sezione || eSecco(sezione)) return sezione;   // a secco non ci sono metri
  let attivo = 1;

  for (const riga of sezione.serie || []) {
    if (!riga) continue;

    // Un'apertura: da qui in giù comanda lei, e lei non è un lavoro.
    if (riga.apreBlocco > 1) {
      attivo = riga.apreBlocco;
      riga.metri = 0;
      riga.senzaMetri = true;
      delete riga.moltiplicato;
      delete riga.metriManuali;
      continue;
    }
    // "×1" non ripete niente: il blocco è stato sciolto.
    if (riga.apreBlocco !== undefined) {
      delete riga.apreBlocco;
      delete riga.senzaMetri;
      attivo = 1;
    }

    const vecchio = Number(riga.moltiplicato) || 1;
    if (attivo > 1) riga.moltiplicato = attivo; else delete riga.moltiplicato;
    if (attivo === vecchio) continue;                // niente da fare, e non si tocca

    // I metri scritti a mano restano quelli: solo l'allenatore sa se
    // quel numero è il totale o il giro.
    if (riga.metriManuali) continue;

    const metri = Number(riga.metri) || 0;
    // Se la divisione non è esatta non si riscala. Meglio una riga non
    // aggiornata che un numero inventato: chi la guarda vede un valore
    // che qualcuno ha scritto davvero, non una stima arrotondata.
    if (metri % vecchio !== 0) continue;
    riga.metri = (metri / vecchio) * attivo;
  }

  return sezione;
}

// Metti l'apertura su una riga e lascia che il ricalcolo faccia il resto.
// È la stessa strada del tasto "+ ripetizione": un blocco creato a mano e
// uno recuperato da una seduta vecchia finiscono identici.
export function applicaAperturaBlocco(sezione, m, ripetizioni) {
  const riga = sezione?.serie?.[m];
  if (!riga) return false;
  const n = ripetizioni ?? aperturaDiBlocco(riga.notazione)?.ripetizioni;
  if (!(n > 1)) return false;
  const zona = aperturaDiBlocco(riga.notazione)?.zona;
  riga.apreBlocco = n;
  if (zona) riga.zona = zona;
  ricalcolaBlocchi(sezione);
  return true;
}

// ---------------------------------------------------------------------
// I BLOCCHI DA SISTEMARE
//
// Due forme dello stesso guaio, tutte e due da sedute salvate prima che
// l'editor sapesse fare i blocchi:
//
//   NUDA        una riga "3x" senza `apreBlocco`: sembra un'apertura ma
//               non lo è, e le righe sotto non sono moltiplicate.
//   A META'     `apreBlocco` c'è (l'ha messo il tasto della 0.54.0) ma le
//               figlie non hanno mai preso `moltiplicato`. Invisibile a
//               occhio: il blocco si DISEGNA giusto e conta sbagliato.
//
// Questa funzione le trova E dice quanti metri mancano; è la stessa che
// usa il tasto per applicarle. Un'anteprima calcolata a parte prima o
// poi mentirebbe sul numero che promette.
//
// `applicabile: false` sta qui dentro, non nel componente: così la
// regola si può provare senza montare React.
// ---------------------------------------------------------------------
export function apertureNude(seduta, { puoScrivere = true } = {}) {
  const trovate = [];
  const conSvolto = Object.keys(seduta?.svolto?.righe || {}).length > 0;

  (seduta?.sezioni || []).forEach((sezione, sezN) => {
    if (eSecco(sezione)) return;                      // a secco non ci sono metri da moltiplicare
    (sezione.serie || []).forEach((riga, serM) => {
      const n = riga?.apreBlocco > 1
        ? riga.apreBlocco                             // blocco a metà
        : aperturaDiBlocco(riga?.notazione)?.ripetizioni;   // apertura nuda
      if (!(n > 1)) return;

      const figlie = figlieDelBlocco(sezione, serM)
        .filter((k) => (Number(sezione.serie[k]?.moltiplicato) || 1) !== n);
      if (!figlie.length) return;

      // I metri fissi non si toccano, quindi non entrano nemmeno nel
      // conto: prometterebbero metri che il tasto non consegna. Lo stesso
      // per le righe che il ricalcolo lascerebbe stare, perché la
      // divisione non torna: promettere metri che non arrivano è peggio
      // che non prometterli.
      const daMoltiplicare = figlie.filter((k) => {
        const f = sezione.serie[k];
        if (f?.metriManuali) return false;
        const vecchio = Number(f?.moltiplicato) || 1;
        return (Number(f?.metri) || 0) % vecchio === 0;
      });
      const fermeCosi = figlie.length - daMoltiplicare.length;

      const ora = daMoltiplicare.reduce((t, k) => t + (Number(sezione.serie[k].metri) || 0), 0);
      const dopo = daMoltiplicare.reduce((t, k) => {
        const f = sezione.serie[k];
        const vecchio = Number(f.moltiplicato) || 1;
        return t + ((Number(f.metri) || 0) / vecchio) * n;
      }, 0);
      const mancanti = dopo - ora - (Number(riga.metri) || 0);
      if (mancanti <= 0) return;

      trovate.push({
        sezN,
        serM,
        sezione: sezione.titolo || `Sezione ${sezN + 1}`,
        forma: riga?.apreBlocco > 1 ? 'a-meta' : 'nuda',
        ripetizioni: n,
        righe: figlie.length,
        righeAMetriFissi: fermeCosi,
        metriOra: ora + (Number(riga.metri) || 0),
        metriDopo: dopo,
        metriMancanti: mancanti,
        applicabile: !conSvolto && puoScrivere,
        perche: conSvolto ? 'svolto' : (puoScrivere ? null : 'sola-lettura'),
      });
    });
  });

  return trovate;
}

// ---------------------------------------------------------------------
// LE CHIAVI DI svolto SEGUONO LE RIGHE
//
// Le chiavi sono posizionali ("sez_n-ser_m") e non hanno dentro niente
// che dica a quale riga appartengono: se le righe si spostano e le
// chiavi restano ferme, i metri davvero nuotati finiscono su un'altra
// riga. Il totale resta credibile — sono gli stessi numeri, in posti
// diversi — ma il carico è attribuito al lavoro sbagliato, e la
// ripartizione per zona cambia senza che si veda.
//
// Quindi ogni gesto che cambia gli indici rimappa le chiavi nello stesso
// passaggio. L'aritmetica sta tutta qui: negli spostamenti il fuori-di-
// uno cambia segno a seconda che si salga o si scenda, ed è il genere di
// errore che non si nota mai guardando un totale.
//
// Il formato di svolto non cambia: stesse chiavi, stessi valori, solo
// rinumerate. Niente migrazioni, e v_serie non se ne accorge.
// ---------------------------------------------------------------------

// Quando svolto smette di esistere. Un posto solo che lo decide: una
// seduta andata come prevista non tiene un oggetto vuoto in archivio.
// La nota però non è posizionale e non c'entra con le righe: finché c'è
// lei, svolto resta.
export function svoltoCollassato(svolto) {
  const righe = Object.fromEntries(
    Object.entries(svolto?.righe || {})
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
  const nota = svolto?.nota || undefined;
  if (!Object.keys(righe).length && !nota) return null;
  return { righe, nota };
}

// Il nucleo. `dove(i, j)` torna la posizione nuova come [i2, j2], oppure
// null se quella riga non esiste più.
export function rimappaSvolto(svolto, dove) {
  if (!svolto?.righe) return svolto ?? null;
  const righe = {};
  for (const [chiave, valore] of Object.entries(svolto.righe)) {
    const [i, j] = chiave.split('-').map(Number);
    if (!Number.isInteger(i) || !Number.isInteger(j)) continue;  // chiave malfatta: si lascia cadere
    const nuova = dove(i, j);
    if (!nuova) continue;
    righe[chiaveRiga(nuova[0], nuova[1])] = valore;
  }
  return svoltoCollassato({ ...svolto, righe });
}

// Lo spostamento, in un posto solo: da `da` a `a`, tutto il resto scorre
// per riempire il buco. Vale identico per le righe e per le sezioni.
function posizioneDopoSpostamento(p, da, a) {
  if (p === da) return a;
  if (da < a) return p > da && p <= a ? p - 1 : p;
  return p >= a && p < da ? p + 1 : p;
}

export const svoltoDopoTogliRiga = (svolto, i, j) => rimappaSvolto(svolto, (si, sj) => {
  if (si !== i) return [si, sj];
  if (sj === j) return null;                 // la riga non c'è più
  return [si, sj > j ? sj - 1 : sj];
});

export const svoltoDopoTogliSezione = (svolto, i) => rimappaSvolto(svolto, (si, sj) => {
  if (si === i) return null;                 // con la sezione se ne vanno tutte le sue righe
  return [si > i ? si - 1 : si, sj];
});

export const svoltoDopoMuoviRiga = (svolto, i, da, a) => rimappaSvolto(svolto, (si, sj) =>
  (si !== i ? [si, sj] : [si, posizioneDopoSpostamento(sj, da, a)]));

export const svoltoDopoMuoviSezione = (svolto, da, a) => rimappaSvolto(svolto, (si, sj) =>
  [posizioneDopoSpostamento(si, da, a), sj]);

// Inserimenti. In coda non muovono niente (j è la lunghezza, nessuna
// chiave le sta sopra) — ma in cima sì: sezioneSeccaVuota entra con
// unshift e fa scalare ogni sezione della seduta.
export const svoltoDopoInserisciRiga = (svolto, i, j) => rimappaSvolto(svolto, (si, sj) =>
  (si === i && sj >= j ? [si, sj + 1] : [si, sj]));

export const svoltoDopoInserisciSezione = (svolto, i) => rimappaSvolto(svolto, (si, sj) =>
  [si >= i ? si + 1 : si, sj]);

// I metri nuotati che si perderebbero cancellando. Servono all'avviso:
// una riga rilevata non deve sparire in silenzio.
export function metriSvoltiDiRiga(svolto, i, j) {
  const v = svolto?.righe?.[chiaveRiga(i, j)];
  return Number.isFinite(+v) && v !== null && v !== '' ? +v : null;
}

export function metriSvoltiDiSezione(svolto, i) {
  let totale = 0;
  let quante = 0;
  for (const [chiave, valore] of Object.entries(svolto?.righe || {})) {
    const [si] = chiave.split('-').map(Number);
    if (si !== i) continue;
    if (!Number.isFinite(+valore) || valore === null || valore === '') continue;
    totale += +valore;
    quante += 1;
  }
  return quante ? { metri: totale, righe: quante } : null;
}

// Quanto manca all'appello, zona per zona: quando tagli il finale tagli
// quasi sempre la parte tosta, e la ripartizione si sposta senza che si
// veda dal totale.
export function scartoPerZona(sezioni, svolto) {
  const righe = svolto?.righe || {};
  const per = {};
  (sezioni || []).forEach((sezione, i) => {
    (sezione?.serie || []).forEach((serie, j) => {
      const previsti = +serie?.metri || 0;
      const c = righe[chiaveRiga(i, j)];
      const fatti = Number.isFinite(+c) && c !== null && c !== '' ? +c : previsti;
      if (fatti === previsti) return;
      const zona = serie?.zona || '—';
      per[zona] = (per[zona] || 0) + (fatti - previsti);
    });
  });
  return per;
}


// ---------------------------------------------------------------------
// RIPARTIZIONE PROPOSTA — da dove vengono questi numeri
//
// Una tabella federale pubblica per categoria non esiste. Questi valori
// sono costruiti su tre appoggi, e restano una PROPOSTA da correggere:
//
// 1. Il dato osservato sugli élite (coorte di 127 nuotatori su 20
//    stagioni, Frontiers in Physiology 2019): 86-90% del volume sotto
//    le 4 mmol/l, di cui ~43% sotto le 2; 6-9,5% fra 4 e 6; 3,5-4,5%
//    sopra le 6. È un modello piramidale, non polarizzato.
// 2. Sui giovani la letteratura è concorde: la base aerobica non si
//    tocca, il lavoro lattacido si usa con parsimonia e in serie più
//    corte che nei senior, e diventa specifico solo a crescita
//    completata. La capacità di resistenza matura verso i 15 anni,
//    quella anaerobica verso i 19.
// 3. La velocità pura (C3) è un'altra cosa: è lavoro neuromuscolare,
//    non produce lattato, e va fatta a tutte le età. Per questo anche
//    gli Esordienti hanno una fetta di alattacido, mentre il lattacido
//    resta a zero.
//
// Le famiglie sono quelle dell'app: aerobico = A1+A2+B1, vo2 = B2,
// lattacido = C1+C2, alattacido = C3. Attenzione: B1 sta dentro
// "aerobico", quindi la fetta aerobica è larga per costruzione.
// ---------------------------------------------------------------------
export const FONTE_RIPARTIZIONE =
  'Proposta costruita sui dati osservati negli élite (Frontiers in Physiology, 2019) '
  + 'e sulle indicazioni per le categorie giovanili. Non è una tabella federale: '
  + 'correggila con quello che sai del tuo gruppo.';

// Per ogni gruppo di categorie, la ripartizione nelle quattro fasi.
// Ogni riga somma 100.
const RIPARTIZIONI = {
  eso_b: {
    generale:  { aerobico: 90, vo2: 3, lattacido: 0, alattacido: 7 },
    speciale:  { aerobico: 88, vo2: 4, lattacido: 0, alattacido: 8 },
    specifica: { aerobico: 85, vo2: 6, lattacido: 1, alattacido: 8 },
    tapering:  { aerobico: 85, vo2: 4, lattacido: 1, alattacido: 10 },
  },
  eso_a: {
    generale:  { aerobico: 89, vo2: 4, lattacido: 0, alattacido: 7 },
    speciale:  { aerobico: 86, vo2: 5, lattacido: 1, alattacido: 8 },
    specifica: { aerobico: 82, vo2: 7, lattacido: 3, alattacido: 8 },
    tapering:  { aerobico: 83, vo2: 5, lattacido: 2, alattacido: 10 },
  },
  ragazzi: {
    generale:  { aerobico: 87, vo2: 5, lattacido: 1, alattacido: 7 },
    speciale:  { aerobico: 83, vo2: 7, lattacido: 3, alattacido: 7 },
    specifica: { aerobico: 78, vo2: 8, lattacido: 6, alattacido: 8 },
    tapering:  { aerobico: 80, vo2: 6, lattacido: 4, alattacido: 10 },
  },
  juniores: {
    generale:  { aerobico: 86, vo2: 6, lattacido: 1, alattacido: 7 },
    speciale:  { aerobico: 81, vo2: 8, lattacido: 4, alattacido: 7 },
    specifica: { aerobico: 75, vo2: 9, lattacido: 8, alattacido: 8 },
    tapering:  { aerobico: 78, vo2: 6, lattacido: 6, alattacido: 10 },
  },
  senior: {
    generale:  { aerobico: 85, vo2: 6, lattacido: 2, alattacido: 7 },
    speciale:  { aerobico: 79, vo2: 8, lattacido: 6, alattacido: 7 },
    specifica: { aerobico: 73, vo2: 9, lattacido: 10, alattacido: 8 },
    tapering:  { aerobico: 76, vo2: 6, lattacido: 8, alattacido: 10 },
  },
  master: {
    generale:  { aerobico: 90, vo2: 4, lattacido: 0, alattacido: 6 },
    speciale:  { aerobico: 86, vo2: 6, lattacido: 2, alattacido: 6 },
    specifica: { aerobico: 82, vo2: 7, lattacido: 4, alattacido: 7 },
    tapering:  { aerobico: 84, vo2: 5, lattacido: 3, alattacido: 8 },
  },
};

// Dal codice categoria al gruppo della tabella. Si guarda la categoria
// più ALTA fra quelle selezionate: se alleni A1 e A2 insieme, comanda
// la più grande.
const GRUPPO_DI = [
  { gruppo: 'master',   codici: ['MAS'] },
  { gruppo: 'senior',   codici: ['CAD_1', 'CAD_2', 'SEN_1', 'SEN_2', 'ASS'] },
  { gruppo: 'juniores', codici: ['JUN_1', 'JUN_2'] },
  { gruppo: 'ragazzi',  codici: ['RAG_1', 'RAG_2', 'RAG_3'] },
  { gruppo: 'eso_a',    codici: ['ESO_A1', 'ESO_A2'] },
  { gruppo: 'eso_b',    codici: ['ESO_B1', 'ESO_B2'] },
];

export function gruppoRipartizione(codici) {
  const scelti = codici || [];
  // Ordine: dal più maturo al meno. Il primo che combacia vince.
  for (const g of GRUPPO_DI) {
    if (scelti.some((c) => g.codici.includes(c))) return g.gruppo;
  }
  return null;   // Propaganda, Teen: qui non si propone niente
}

// La proposta per una fase. Torna null dove non abbiamo niente da dire.
export function proponiRipartizione(codici, fase) {
  const g = gruppoRipartizione(codici);
  if (!g) return null;
  const r = RIPARTIZIONI[g]?.[fase];
  return r ? { ...r } : null;
}

// Tutte e quattro le fasi in un colpo, per il tasto "Proponi".
export function proponiTutteLeFasi(codici) {
  const g = gruppoRipartizione(codici);
  if (!g) return null;
  return Object.fromEntries(
    Object.entries(RIPARTIZIONI[g]).map(([fase, r]) => [fase, { ...r }])
  );
}


// ---------------------------------------------------------------------
// DUPLICARE
// Le sedute si somigliano: una settimana è quasi la precedente con due
// righe cambiate. Qui si copia il PROGRAMMA e basta — mai le presenze,
// mai "com'è andata": quelle appartengono al giorno in cui è successo.
// ---------------------------------------------------------------------
export const lunediDi = (isoData) => {
  const d = new Date(isoData + 'T12:00');
  const scarto = (d.getDay() + 6) % 7;          // lunedì = 0
  d.setDate(d.getDate() - scarto);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function copiaSeduta(seduta, nuovaData) {
  return {
    societa_id: seduta.societa_id,
    data: nuovaData,
    titolo: seduta.titolo || '',
    categorie: [...(seduta.categorie || [])],
    origine: seduta.origine || 'manuale',
    // Copia profonda: se restasse un riferimento, correggere una riga
    // nella copia cambierebbe anche l'originale.
    sezioni: JSON.parse(JSON.stringify(seduta.sezioni || [])),
    // svolto NON si copia: sono i metri di quel giorno, non di questo.
  };
}

// Le sedute raggruppate per settimana, dalla più recente.
export function perSettimana(sedute) {
  const per = new Map();
  for (const s of sedute || []) {
    const k = lunediDi(s.data);
    const g = per.get(k) || { lunedi: k, sedute: [] };
    g.sedute.push(s);
    per.set(k, g);
  }
  return [...per.values()]
    .map((g) => ({ ...g, sedute: g.sedute.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.lunedi.localeCompare(a.lunedi));
}

// La colonna "categoria" del CSV. Teen, Master e Propaganda non sono
// età ma percorsi, quindi dall'anno di nascita non si ricavano: o li
// scrivi nel foglio, o l'app non può saperlo.
// L'unica scorciatoia è il Master sopra i 25 anni, ed è una PROPOSTA:
// tira dentro anche i Senior e gli Assoluti adulti, che Master non sono.
// Per questo l'import li elenca a parte, da controllare.
export function categoriaDaCsv(scritta, annoNascita, oggi = new Date()) {
  const pulita = String(scritta || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (pulita) {
    const trovata = CATEGORIE.find((c) => c.codice === pulita);
    if (trovata) return { codice: trovata.codice, indovinata: false };
    // Scritta per esteso: "Master", "Teen 2", "Propaganda 2"
    const perNome = CATEGORIE.find(
      (c) => c.nome.toUpperCase().replace(/[\s-]+/g, '_') === pulita
    );
    if (perNome) return { codice: perNome.codice, indovinata: false };
  }
  const eta = oggi.getFullYear() - Number(annoNascita || 0);
  if (annoNascita && eta >= 25) return { codice: 'MAS', indovinata: true };
  return { codice: null, indovinata: false };   // null = si calcola dall'età
}

export function categoriaAtleta(atleta, fasce) {
  if (atleta?.categoria_override) return atleta.categoria_override;
  return categoriaDi(atleta?.anno_nascita, atleta?.sesso, fasce);
}

// Stagione FIN corrente. Il cambio è a LUGLIO, non a settembre: quando
// finiscono i regionali e gli italiani estivi la stagione è chiusa, e
// il lavoro di luglio e agosto è già preparazione per quella nuova.
// Con settembre, per due mesi l'app metteva le sedute nella stagione
// appena finita.
// È solo il valore proposto all'apertura: la stagione resta scegliibile
// dal selettore in testata, e le sedute vecchie non si spostano.
const MESE_CAMBIO_STAGIONE = 6;   // 0 = gennaio, quindi 6 = luglio

export function stagioneCorrente(oggi = new Date()) {
  const anno = oggi.getFullYear();
  const inizio = oggi.getMonth() >= MESE_CAMBIO_STAGIONE ? anno : anno - 1;
  return `${inizio}/${String(inizio + 1).slice(2)}`;
}

// ---------------------------------------------------------------------
// VALIDAZIONE — stesse regole per la seduta scritta a mano e per quella
// generata. Se passa di qui, i volumi si calcolano.
// ---------------------------------------------------------------------
export function validaSeduta(seduta, zoneValide = ZONE.map((z) => z.codice)) {
  const problemi = [];
  if (!seduta?.data) problemi.push({ campo: "data", msg: "Manca la data" });
  if (!seduta?.categorie?.length)
    problemi.push({ campo: "categorie", msg: "Scegli almeno una categoria" });

  const sezioni = seduta?.sezioni || [];
  if (sezioni.length === 0) problemi.push({ campo: "sezioni", msg: "Seduta vuota" });

  sezioni.forEach((sez, i) => {
    const dest = destinatariDi(sez);
    const ignoti = dest.filter((d) => d !== TUTTI && !SPECIALIZZAZIONI.includes(d));
    if (ignoti.length)
      problemi.push({ campo: `sezioni[${i}].destinatari`, msg: `Destinatari sconosciuti: ${ignoti.join(", ")}` });

    (sez.serie || []).forEach((s, j) => {
      const dove = `${sez.titolo || "sezione " + (i + 1)} → serie ${j + 1}`;
      if (!s.notazione) problemi.push({ campo: dove, msg: "Manca la notazione" });
      // Partenze, virate, lavoro a secco: stanno nella seduta senza fare metri.
      if (s.senzaMetri) return;
      if (!Number(s.metri)) problemi.push({ campo: dove, msg: "Metri a zero" });
      if (!s.zona) problemi.push({ campo: dove, msg: "Zona non indicata" });
      else if (!zoneValide.includes(s.zona))
        problemi.push({ campo: dove, msg: `Zona "${s.zona}" non riconosciuta` });
    });
  });

  return problemi;
}

// ---------------------------------------------------------------------
// Da SwimCoach AI a CorsiaPro: un solo punto di contatto.
// Adatta i nomi dei campi alla forma delle sezioni di SwimCoach.
// ---------------------------------------------------------------------
export function daSwimCoach(workout, { societaId, categorie = [] }) {
  return {
    societa_id: societaId,
    data: workout.data || new Date().toISOString().slice(0, 10),
    categorie,
    origine: "swimcoach",
    riferimento_esterno: workout.id ? String(workout.id) : null,
    titolo: workout.titolo || workout.nome || "",
    fase: workout.fase || null,
    sezioni: (workout.sezioni || []).map((sez) => ({
      titolo: sez.titolo || sez.nome || "",
      destinatari: sez.destinatari?.length ? sez.destinatari : [TUTTI],
      serie: (sez.serie || sez.items || []).map((s) => ({
        notazione: s.notazione || "",
        zona: s.zona || "",
        metri: Number(s.metri) || 0,
        recupero: s.recupero || s.partenza || "",
        note: s.note || "",
      })),
    })),
  };
}


// ---------------------------------------------------------------------
// RAGGRUPPAMENTI PER LA SCELTA DELLE CATEGORIE
// Un flag seleziona più codici insieme, come li tratti in vasca:
// gli Esordienti B nuotano assieme, i Ragazzi 3 restano a parte.
// ---------------------------------------------------------------------
export const RAGGRUPPAMENTI = [
  { nome: "Propaganda",   codici: ["PROP_01", "PROP_2"] },
  { nome: "Teen",         codici: ["TEEN_0", "TEEN_1", "TEEN_2"] },
  { nome: "Esordienti B", codici: ["ESO_B1", "ESO_B2"] },
  { nome: "Esordienti A", codici: ["ESO_A1", "ESO_A2"] },
  { nome: "Ragazzi 1-2",  codici: ["RAG_1", "RAG_2"] },
  { nome: "Ragazzi 3",    codici: ["RAG_3M"] },
  { nome: "Juniores",     codici: ["JUN_1", "JUN_2"] },
  { nome: "Cadetti",      codici: ["CAD_1", "CAD_2"] },
  { nome: "Senior",       codici: ["SEN_1", "SEN_2"] },
  { nome: "Assoluti",     codici: ["ASS"] },
  { nome: "Master",       codici: ["MAS"] },
];

// Filtri del calendario: come guardi la settimana quando pianifichi.
// Vecchi filtri per scheda. CorsiaPro non li usa più — la categoria si
// sceglie una volta sola in testata (RAGGRUPPAMENTI) — ma dominio.js è
// condiviso con SwimCoach, quindi restano dove sono.
export const MACRO_CALENDARIO = [
  { id: "tutte",      nome: "Tutte",        codici: null },
  { id: "propaganda", nome: "Propaganda",   codici: ["PROP_01", "PROP_2"] },
  { id: "teen",       nome: "Teen",         codici: ["TEEN_0", "TEEN_1", "TEEN_2"] },
  { id: "eso_b",      nome: "Esordienti B", codici: ["ESO_B1", "ESO_B2"] },
  { id: "eso_a",      nome: "Esordienti A", codici: ["ESO_A1", "ESO_A2"] },
  { id: "ragazzi",    nome: "Ragazzi",      codici: ["RAG_1", "RAG_2", "RAG_3M"] },
  { id: "jcs",        nome: "J/C/S e Assoluti", codici: ["JUN_1", "JUN_2", "CAD_1", "CAD_2", "SEN_1", "SEN_2", "ASS"] },
  { id: "master",     nome: "Master",       codici: ["MAS"] },
];

// Un elemento (seduta o gara) rientra nel filtro se una delle sue
// categorie è fra quelle del macro-gruppo.
export function rientraNelMacro(categorie, codici) {
  if (!codici) return true;
  const c = categorie || [];
  if (c.length === 0) return true;        // senza categorie resta sempre visibile
  return c.some((x) => codici.includes(x));
}

// ---------------------------------------------------------------------
// STAGIONI — partono a settembre. "2025/26", "2026/27", ...
// ---------------------------------------------------------------------
export function stagioneDa(annoIniziale) {
  return `${annoIniziale}/${String(annoIniziale + 1).slice(2)}`;
}

export function annoInizialeDi(stagione) {
  const n = parseInt(String(stagione).slice(0, 4), 10);
  return isNaN(n) ? null : n;
}

// La prima stagione gestita: prima non c'erano dati.
export const STAGIONE_MINIMA = "2025/26";

// Elenco per il selettore: tre stagioni, dalla corrente in avanti, mai
// prima della minima. Le stagioni già presenti nel database entrano
// comunque, purché non siano più vecchie della minima.
export function stagioniProposte(daDatabase = [], corrente = stagioneCorrente(), quante = 3) {
  const minimo = annoInizialeDi(STAGIONE_MINIMA);
  const partenza = Math.max(minimo, annoInizialeDi(corrente) || minimo);

  const insieme = new Set();
  for (let i = 0; i < quante; i++) insieme.add(stagioneDa(partenza + i));
  for (const s of daDatabase) {
    const a = annoInizialeDi(s);
    if (a && a >= minimo) insieme.add(stagioneDa(a));
  }
  return [...insieme].sort().reverse();
}


// ---------------------------------------------------------------------
// FASCE DI UNA STAGIONE QUALSIASI
// Le fasce d'età scalano di un anno esatto ogni stagione. Basta averle
// inserite UNA volta: per le altre stagioni si proiettano spostando gli
// anni della differenza. Così cambiando stagione tutta la squadra passa
// di categoria, senza compilare nuove tabelle a settembre.
// ---------------------------------------------------------------------
export function fasceRisolte(tutte, stagione) {
  const perStagione = {};
  for (const r of tutte || []) {
    (perStagione[r.stagione] ||= []).push(r);
  }

  if (perStagione[stagione]?.length) {
    return { fasce: perStagione[stagione], proiettata: false, base: stagione, scarto: 0 };
  }

  const target = annoInizialeDi(stagione);
  const anni = Object.keys(perStagione).map(annoInizialeDi).filter((x) => x != null);
  if (!target || anni.length === 0) return { fasce: [], proiettata: false, base: null, scarto: 0 };

  // La stagione compilata più vicina fa da riferimento.
  const base = anni.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const scarto = target - base;

  const fasce = perStagione[stagioneDa(base)].map((r) => ({
    ...r,
    stagione,
    anno_nascita_da: r.anno_nascita_da + scarto,
    anno_nascita_a: r.anno_nascita_a + scarto,
  }));

  return { fasce, proiettata: true, base: stagioneDa(base), scarto };
}

// ---------------------------------------------------------------------
// PERIODIZZAZIONE
// Quattro fasi, generate a ritroso dalla gara obiettivo. Le durate sono
// una PROPOSTA: si trascinano. Il totale (21 settimane) segue il
// macrociclo che usiamo anche in SwimCoach.
// ---------------------------------------------------------------------
export const FASI = [
  { codice: 'generale',  nome: 'Generale',  settimane: 6, colore: '#3B82F6',
    zone: 'A1 · A2, volume alto, tecnica' },
  { codice: 'speciale',  nome: 'Speciale',  settimane: 8, colore: '#06B6D4',
    zone: 'A2 · B1 su fondo aerobico' },
  { codice: 'specifica', nome: 'Specifica', settimane: 5, colore: '#F59E0B',
    zone: 'B1 · B2 e ritmo gara, volume in calo' },
  { codice: 'tapering',  nome: 'Tapering',  settimane: 2, colore: '#EF4444',
    zone: 'C1 · C3, volume ridotto, freschezza' },
];

export const faseDi = (codice) => FASI.find((f) => f.codice === codice);

export const giorno = (iso, delta) => {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

// Costruisce le quattro fasce all'indietro: il tapering finisce il
// giorno prima della gara, e a ritroso si incastrano le altre.
//
// Il macrociclo dura 21 settimane, ma la stagione comincia prima: se
// passi inizioStagione, la fase generale parte da lì e si allunga fino
// all'attacco del macrociclo. Con un obiettivo ad aprile e la stagione
// aperta a settembre, la generale copre da settembre a fine novembre.
// "inizioStagione" è il limite a sinistra: per il primo macrociclo è
// l'inizio della stagione, per il secondo e il terzo è il giorno dopo la
// gara obiettivo precedente. La generale si allunga fino a lì se c'è
// spazio, e si accorcia se ce n'è poco — mai sotto la settimana.
export function proponiFasi(dataGara, { durate = null, inizioStagione = null } = {}) {
  const settimane = durate || Object.fromEntries(FASI.map((f) => [f.codice, f.settimane]));
  const blocchi = [];
  let fine = giorno(dataGara, -1);

  for (const f of [...FASI].reverse()) {
    const giorni = (settimane[f.codice] || f.settimane) * 7;
    const inizio = giorno(fine, -(giorni - 1));
    blocchi.unshift({ fase: f.codice, dal: inizio, al: fine });
    fine = giorno(inizio, -1);
  }

  if (inizioStagione) {
    if (inizioStagione < blocchi[0].dal) {
      // C'è spazio davanti: la generale si allunga fino al paletto.
      blocchi[0].dal = inizioStagione;
    } else if (inizioStagione > blocchi[0].dal) {
      // Spazio meno del previsto — stagione aperta tardi, o è il secondo
      // macrociclo che parte dopo la gara precedente. Si comprime TUTTO
      // in proporzione, non solo la generale: schiacciare solo la prima
      // fase la faceva finire prima del paletto, e il secondo macrociclo
      // si mangiava la coda del primo.
      const ultimo = blocchi[blocchi.length - 1].al;
      const disponibili = giorniFra(inizioStagione, ultimo) + 1;
      const previsti = blocchi.reduce((t, b) => t + giorniFra(b.dal, b.al) + 1, 0);
      const minimo = disponibili >= blocchi.length * 7 ? 7 : 1;

      let cursore = inizioStagione;
      blocchi.forEach((b, i) => {
        const quota = (giorniFra(b.dal, b.al) + 1) / previsti;
        const durata = i === blocchi.length - 1
          ? Math.max(1, giorniFra(cursore, ultimo) + 1)
          : Math.max(minimo, Math.round(disponibili * quota));
        b.dal = cursore;
        b.al = i === blocchi.length - 1 ? ultimo : giorno(cursore, durata - 1);
        cursore = giorno(b.al, 1);
      });
    }
  }

  return blocchi;
}

// Il 1° settembre dell'anno di apertura, come punto di partenza.
export function inizioStagionePredefinito(stagione) {
  const anno = annoInizialeDi(stagione);
  return anno ? `${anno}-09-01` : null;
}

export function giorniFra(dal, al) {
  return Math.round((new Date(al + 'T12:00') - new Date(dal + 'T12:00')) / 86400000) + 1;
}

export const settimaneFra = (dal, al) => (giorniFra(dal, al) / 7).toFixed(1).replace('.0', '');

// Sposta il confine fra due fasi adiacenti, senza farle sparire.
export function spostaConfine(blocchi, indice, nuovoInizio) {
  const copia = blocchi.map((b) => ({ ...b }));
  const prima = copia[indice - 1];
  const dopo = copia[indice];
  if (!prima || !dopo) return copia;

  const minimo = giorno(prima.dal, 6);           // almeno una settimana
  const massimo = giorno(dopo.al, -6);
  let data = nuovoInizio;
  if (data < minimo) data = minimo;
  if (data > massimo) data = massimo;

  dopo.dal = data;
  prima.al = giorno(data, -1);
  return copia;
}

export const faseDelGiorno = (blocchi, iso) =>
  (blocchi || []).find((b) => iso >= b.dal && iso <= b.al) || null;


// ---------------------------------------------------------------------
// RIPARTENZA CALCOLATA DAL PASSO BASE
// Si scrive @@2:00 nel campo recupero: è il tempo base sui 100. L'app
// lo scala sulla distanza della singola ripetizione — 250 con base 2:00
// diventa @5:00 — e arrotonda ai 5 secondi, come si legge sul cronometro.
// La base resta memorizzata: se cambi la distanza, la partenza si rifà.
// ---------------------------------------------------------------------

// La distanza di UNA ripetizione: "12x75" → 75 · "300 stile" → 300
export function distanzaSingola(notazione) {
  const t = String(notazione || '').replace(/[×*]/g, 'x');
  let m = t.match(/(\d{1,3})\s*x\s*(\d{2,4})/);
  if (m) return +m[2];
  m = t.match(/(\d{2,4})/);
  return m ? +m[1] : null;
}

const inSecondi = (testo) => {
  const m = String(testo || '').match(/(\d{1,2})[:.'](\d{2})/);
  if (m) return +m[1] * 60 + +m[2];
  const soli = String(testo || '').match(/^(\d{1,3})$/);
  return soli ? +soli[1] : null;
};

const inTempo = (secondi) => {
  const s = Math.max(5, Math.round(secondi / 5) * 5);       // ai 5 secondi
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Restituisce { recupero, base } oppure null se non è una base.
export function ripartenzaDaBase(testo, notazione, suMetriPredefiniti = 100) {
  // "@@2:00" = base sui 100 · "@@0:35/25" = base sui 25
  const m = String(testo || '').trim().match(/^@@\s*([^/]+?)(?:\s*\/\s*(\d{2,3}))?$/);
  if (!m) return null;
  const suMetri = m[2] ? +m[2] : suMetriPredefiniti;
  const base = inSecondi(m[1]);
  const distanza = distanzaSingola(notazione);
  if (!base || !distanza) return null;
  return {
    recupero: `@${inTempo(base * (distanza / suMetri))}`,
    base: `${inTempo(base)}/${suMetri}`,
  };
}


// ---------------------------------------------------------------------
// DATE — sempre gg.mm.aaaa
// ---------------------------------------------------------------------
export function dataIt(iso) {
  if (!iso) return "";
  const [a, m, g] = String(iso).slice(0, 10).split("-");
  return g && m && a ? `${g}.${m}.${a}` : String(iso);
}

export function dataItLunga(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00").toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ---------------------------------------------------------------------
// DURATA STIMATA
// Si somma solo quello che ha una ripartenza: ripetizioni × tempo. Le
// serie senza partenza non si contano, e l'app lo dice invece di
// inventare un'andatura.
// ---------------------------------------------------------------------
const secondiDaRipartenza = (testo) => {
  const t = String(testo || "").replace("@", "").trim();
  let m = t.match(/^(\d{1,2})[:.'](\d{2})/);
  if (m) return +m[1] * 60 + +m[2];
  m = t.match(/^(\d{1,2})'\s*$/);              // "3'" = tre minuti
  if (m) return +m[1] * 60;
  m = t.match(/^(\d{1,3})"?\s*$/);             // "45" = quarantacinque secondi
  return m ? +m[1] : null;
};

export function ripetizioniDa(notazione) {
  const t = String(notazione || "").replace(/[×*]/g, "x");
  const m = t.match(/^\s*(\d{1,3})\s*x\s*\d/);
  return m ? +m[1] : 1;
}

export function durataStimata(sezioni) {
  let secondi = 0;
  let conRipartenza = 0;
  let senza = 0;
  let secchi = 0;

  for (const sez of sezioni || []) {
    // Il lavoro a secco non ha tempi di partenza da cui dedurre nulla:
    // i minuti li scrive l'allenatore e valgono come sono.
    if (eSecco(sez)) {
      const min = Number(sez.durataMin) || 0;
      if (min > 0) { secondi += min * 60; secchi += 1; }
      continue;
    }
    for (const s of sez.serie || []) {
      if (!s.metri && !s.senzaMetri) continue;
      const base = secondiDaRipartenza(s.recupero);
      if (base) {
        secondi += base * ripetizioniDa(s.notazione);
        conRipartenza += 1;
      } else if (s.metri) {
        senza += 1;
      }
    }
  }
  return { secondi, conPartenza: conRipartenza, senzaPartenza: senza, sezioniSecche: secchi };
}

export function inOreMinuti(secondi) {
  const m = Math.round(secondi / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}'` : `${m}'`;
}
