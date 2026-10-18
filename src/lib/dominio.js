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
  // Triathlon: percorso, non età, esattamente come Teen e Master. Niente
  // riga in categorie_stagione, nessuna fascia, nessuna deduzione
  // automatica: o è scritto nel foglio, o si mette a mano.
  { codice: "TRI", nome: "Triathlon", ordine: 210 },
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

// =====================================================================
// IL LETTORE DI UNA RIGA
//
// Stava nell'analizzatore, e sta qui per due motivi: qui c'è già
// metriDaNotazione, cioè l'altro posto che legge la stessa notazione, e
// l'arco di import esiste già in questo verso — l'analizzatore importa
// dominio, dominio non importa nessuno. Mettere il lettore in un terzo
// file farebbe un arco nuovo e romperebbe la promessa in testa a questo
// file, che è di non avere dipendenze.
//
// Quello che NON è qui è tutto ciò che vuole il contesto: sezioni,
// titoli, destinatari, zone, lavoro a secco, blocchi, composizione,
// note. Quello resta nell'analizzatore, e il lettore di una riga non lo
// sa — legge una riga e basta.
//
// Tre funzioni restano pubbliche per l'analizzatore e per nessun altro:
// pezziDiPrimoLivello, gruppoInTesta e valoreDelPezzo, che gli servono
// per spezzare una riga con due andature.
// =====================================================================

// LA REGOLA DELLA VASCA
// Partenze, virate, scivolamenti: si scrivono con la distanza a cui si
// arriva ("2x10", "partendo dai 10m"), ma l'atleta la vasca la finisce
// comunque. Quindi qualsiasi tratto sotto i 25 vale 25: "2x10" fa 50,
// non 20. Deciso dal coach, agosto 2026.
const VASCA = 25;
const almenoUnaVasca = (d) => (d > 0 && d < VASCA ? VASCA : d);

// Divide su "+" di primo livello: quello dentro le parentesi resta
// dov'è. "4x(150 + 4x25) 150SL" è UN pezzo, non due.
export function pezziDiPrimoLivello(t) {
  const pezzi = [];
  let dentro = 0;
  let corrente = '';
  for (const c of t) {
    if (c === '(') dentro++;
    else if (c === ')') dentro = Math.max(0, dentro - 1);
    if (c === '+' && dentro === 0) { pezzi.push(corrente); corrente = ''; continue; }
    corrente += c;
  }
  pezzi.push(corrente);
  return pezzi;
}

// Legge la misura in TESTA a un pezzo e dice cosa resta dopo. Quello che
// resta è descrizione: "1x75 Remate DO" sono 75 metri di remate, non 75
// più qualcos'altro.
// Trova la parentesi in testa contando le aperture, non fermandosi alla
// prima chiusa: "3x(2x(4x25) + 100)" ha un gruppo dentro il gruppo, e con
// la ricerca ingenua si fermava a "(2x(4x25)" leggendo cento metri.
export function gruppoInTesta(p) {
  const m = p.match(/^(\d{1,3})?\s*x?\s*\(/i);
  if (!m || !p.slice(m[0].length - 1).startsWith('(')) return null;
  const inizio = m[0].length - 1;
  let profondita = 0;
  for (let i = inizio; i < p.length; i++) {
    if (p[i] === '(') profondita++;
    else if (p[i] === ')') {
      profondita--;
      if (profondita === 0) {
        return {
          moltiplicatore: m[1] ? +m[1] : 1,
          dentro: p.slice(inizio + 1, i),
          resto: p.slice(i + 1).trim(),
        };
      }
    }
  }
  return null;   // parentesi mai chiusa: non è un gruppo
}

// I tempi non sono distanze: "1'40", '45"', "@1:30" vanno tolti prima di
// cercare le misure, o un recupero passa per una vasca. Sta qui in alto
// perché lo usano anche le scale, poco più sotto.
// ---------------------------------------------------------------------
// GLI APICI, RADDRIZZATI
//
// Le tastiere dei tablet non scrivono ' e ": con la punteggiatura
// intelligente di iOS mettono la virgoletta curva, e a seconda del
// layout arrivano l'apice tipografico, l'accento grave e quello acuto.
// Per chi scrive sono tutti minuti e secondi; per le regex no, e
// "@1’45" non veniva letto — o peggio, leggendo il testo diventava
// @0:01, un secondo.
//
// L'elenco dei caratteri sta QUI, una volta sola. I lettori di tempo
// sono otto e ognuno ha la sua espressione: ciascuno chiama questa
// funzione in testa, così un carattere nuovo si aggiunge in un posto e
// non in otto. Unificare gli otto lettori è un altro lavoro.
//
// I due apostrofi dritti diventano un doppio apice: "@45''" è come si
// scrivono i secondi quando sulla tastiera il doppio non si trova.
// ---------------------------------------------------------------------
const APICI_SINGOLI = /[\u2018\u2019\u2032\u0060\u00b4]/g;   // ‘ ’ ′ ` ´
const APICI_DOPPI = /[\u201c\u201d\u2033]/g;                 // “ ” ″

export const apiciDritti = (t) => String(t ?? '')
  .replace(APICI_SINGOLI, "'")
  .replace(APICI_DOPPI, '"')
  .replace(/''/g, '"');

const senzaTempi = (t) => apiciDritti(t)
  .replace(/@+\s*\d{1,2}\s*[:.']\s*\d{2}/g, ' ')
  .replace(/@+\s*\d{1,3}\s*["']?/g, ' ')
  .replace(/\d{1,2}\s*'\s*\d{2}/g, ' ')
  .replace(/\d{1,3}\s*"/g, ' ');

// LE SCALE
// "12/10/8x100" sono tremila metri: dodici cento, poi dieci, poi otto.
// "400/300/200" sono novecento. Le barre separano i pezzi della scala,
// non sono una divisione.
//
// Due trappole, ed è per questo che i controlli sono così stretti:
// · una data — "12/10/2025" — ha la stessa forma. Per questo la scala di
//   sole distanze pretende che OGNI pezzo sia una misura vera (almeno una
//   vasca, multiplo di 25): il 12 e il 10 di una data non lo sono.
// · "4x50/4x25" non è una scala: dentro ci si legge "50/4x25", che come
//   scala farebbe 1350 metri dal nulla. Per questo la scala non può
//   cominciare subito dopo una x o una cifra.
const SCALA_RIPETUTE = /^(\d{1,3}(?:\s*\/\s*\d{1,3}){1,9})\s*x\s*(\d{2,4})(?![\d])/i;
const SCALA_DISTANZE = /^(\d{2,4}(?:\s*\/\s*\d{2,4}){1,9})(?![\d/])/;

function scalaInTesta(pezzo) {
  const p = senzaTempi(String(pezzo || '')).trim();

  let m = p.match(SCALA_RIPETUTE);
  if (m) {
    const parti = m[1].split('/').map((n) => +n.trim());
    if (parti.every((n) => n >= 1 && n <= 99)) {
      const giri = parti.reduce((a, b) => a + b, 0);
      return { metri: giri * almenoUnaVasca(+m[2]), resto: p.slice(m[0].length).trim() };
    }
  }

  m = p.match(SCALA_DISTANZE);
  if (m) {
    const parti = m[1].split('/').map((n) => +n.trim());
    if (parti.every((n) => n >= VASCA && n <= 1500 && n % VASCA === 0)) {
      return { metri: parti.reduce((a, b) => a + b, 0), resto: p.slice(m[0].length).trim() };
    }
  }
  return null;
}

// La stessa scala, ma cercata anche in mezzo alla riga: "PS 12/10/8x100".
// Non può attaccarsi a una cifra o a una x che la precede — vedi sopra.
function scalaOvunque(riga) {
  const t = senzaTempi(String(riga || ''));
  for (const m of t.matchAll(/(?<![\dxX,./])\d{1,4}(?:\s*\/\s*\d{1,4}){1,9}(?:\s*x\s*\d{2,4})?/g)) {
    const letta = scalaInTesta(m[0]);
    if (letta && letta.metri > 0 && !letta.resto) return letta;
  }
  return null;
}

function misuraInTesta(pezzo) {
  const p = pezzo.trim();
  const g = gruppoInTesta(p);
  if (g) {
    const s = sommaGruppo(g.dentro);
    if (s) return { metri: g.moltiplicatore * s, resto: g.resto, gruppo: true, fattore: g.moltiplicatore };
  }
  const scala = scalaInTesta(p);
  if (scala) return { metri: scala.metri, resto: scala.resto, scala: true };
  let m;
  m = p.match(/^(\d{1,3})\s*x\s*(\d{2,4})(?!\d)(?!\s*[x×])/i);
  if (m) return { metri: +m[1] * almenoUnaVasca(+m[2]), resto: p.slice(m[0].length).trim(), fattore: +m[1] };
  m = p.match(/^(\d{2,4})(?!\d)/);
  if (m) return { metri: +m[1], resto: p.slice(m[0].length).trim(), secco: true };
  return null;
}

// C'è una misura DA QUALCHE PARTE in questa coda? È una domanda diversa
// da quella di trovaMisure, che chiede se la coda È una misura: qui si
// scorre, e a ogni inizio di numero si chiede a misuraInTesta da lì in
// avanti. Serve a distinguere "25 DO" — un tratto col suo stile — da
// "25 remate 25 completo 25gb 25 ps", che descrive com'è fatta la
// ripetuta e non aggiunge vasche.
//
// Una percentuale non è una misura: "al 75%" è un'andatura, non 75 metri.
function primaMisuraInCoda(resto) {
  const t = senzaTempi(resto);
  for (const m of t.matchAll(/\d/g)) {
    if (m.index > 0 && /\d/.test(t[m.index - 1])) continue;   // metà di un numero
    const da = t.slice(m.index);
    if (/^\d+\s*%/.test(da)) continue;
    const misura = misuraInTesta(da);
    if (misura) return misura;
  }
  return null;
}
const codaConMisure = (resto) => primaMisuraInCoda(resto) !== null;

// Somma i pezzi di primo livello: "(3x25) + (1x75) Remate SL" = 150,
// "400 sl + 200 mix + 4x50 gambe" = 800.
//
// Una regola sola, uguale per ogni pezzo: un pezzo è una misura con la
// sua coda, e la coda è descrizione. La somma NON si ferma perché un
// pezzo ha del testo dietro — era così che il primo stile scritto
// ("400 sl") la spegneva, e la riga valeva soltanto il suo primo numero.
// Si ferma dove il pezzo misura non è: da lì in poi la riga racconta
// com'è fatta la ripetuta e non aggiunge vasche.
//
// "300 stile" esce di qui con un pezzo solo, e un pezzo solo non è una
// somma: a tenerlo fuori è il `quanti > 1` di trovaMisure, che lo manda
// alla regola della misura in testa come ha sempre fatto. Prima lo
// teneva fuori di qui una guardia sul primo pezzo, e insieme a lui
// buttava via ogni somma che cominciasse con uno stile.
function sommaInTesta(riga) {
  let totale = 0;
  let quanti = 0;
  let gruppo = false;
  // L'unica distinzione che resta, e non è sul posto del pezzo: è il
  // FATTORE con cui è scritto il termine prima.
  //
  // Dopo un set vero il tratto secco è lavoro in più — "6x100 + 100 sl"
  // sono settecento, e l'archivio è pieno di riscaldamenti così. Dopo un
  // termine che vale UNA ripetuta sola, invece, il numero che segue
  // ripete quel termine e lo descrive: in "3x25 + 1x75 Remate DO + 75 DO
  // completo" il 75 in coda è il modo in cui si nuota l'1x75, e la riga
  // vale 150. Lo stesso per i gruppi scritti senza moltiplicatore,
  // "(3x25) + (1x75) Remate DO + 75 DO completo": un gruppo nudo non
  // moltiplica niente, quindi vale uno.
  //
  // I tratti secchi non spostano il fattore: nella scaletta
  // "100+75+50+25 DO" non c'è nessun set, e la somma arriva in fondo.
  let unaSola = false;
  // I metri del tratto scartato per il fattore 1. Non sono un errore di
  // lettura ed è per questo che vanno detti: la riga vale meno di quanto
  // c'è scritto sopra, e chi rilegge deve poter dare torto alla scelta.
  let scartati = 0;
  // La somma fermata dalla coda di un set (vedi sotto). Quando c'è, la
  // riga NON va cercata anche da destra: sommaInCoda troverebbe i numeri
  // della descrizione ("8x75 MX 50+25" diventava 75).
  let fermata = null;
  const pezzi = pezziDiPrimoLivello(riga);
  for (const [k, pezzo] of pezzi.entries()) {
    const m = misuraInTesta(pezzo);
    if (!m) break;
    // Un tratto secco con la coda si conta se nella coda non c'è un'ALTRA
    // misura. Se c'è, quel numero apre una descrizione ("100 + 25 remate
    // 25 completo") e la somma finisce lì: lo chiede codaConMisure, che
    // usa lo stesso misuraInTesta e non una definizione sua di "misura".
    //
    // E non si conta un numero col decimale: "2X25 12,5 Remate verticali
    // + 12,5 RA" sono cinquanta metri, non sessantadue. Il 12,5 è mezza
    // vasca scritta a mano, cioè il modo in cui si fa il 25 — descrizione,
    // non un tratto in più. Si guarda qui e non in misuraInTesta, perché
    // una riga che dice soltanto "12,5 RA" resta mezza vasca e vale 25
    // metri per la regola della vasca.
    const decimale = /^[,.]\d/.test(m.resto || '');
    if (m.secco && m.resto && (unaSola || decimale || codaConMisure(m.resto))) {
      // Degli altri due motivi non si dice niente: una coda con dentro
      // un'altra misura e una mezza vasca col decimale sono descrizione
      // evidente, e un avviso su ogni riga di composizione sarebbe
      // rumore. Il fattore 1 no: quella è una convenzione, e si vede.
      if (unaSola) scartati = m.metri;
      break;
    }
    totale += m.metri;
    quanti++;
    if (m.fattore) unaSola = m.fattore === 1;
    if (m.gruppo) gruppo = true;
    // LA CODA DI UN SET CHE CONTIENE UN'ALTRA MISURA lo descrive, e il "+"
    // che viene dopo sta dentro la descrizione: "6x(1x100 + 4x25) 100MX +
    // 4x25 SL super sub" sono 1200, "8x50 MX 25GB lat + 25MX 2x" 400. Il
    // set si conta e la somma finisce qui. Per i tratti secchi la regola
    // c'era già, sopra; mancava per i set e i gruppi.
    //
    // Limite noto, fissato in prova_analizzatore.mjs: "1x400 palette SL
    // 400 + 2x200 + ..." ripete la distanza in coda invece di descriverne
    // una parte, e il "+" lì aggiunge lavoro. Distinguerlo con "la misura
    // in coda è più corta della ripetuta" ne rompeva 25 su archivio vero.
    if (!m.secco && m.resto) {
      const inCoda = primaMisuraInCoda(m.resto);
      if (inCoda) {
        // `ripete`: la forma del limite noto, e chi legge deve poterlo
        // sapere. Due condizioni, e servono tutte e due: la coda ripete la
        // distanza della ripetuta, e dopo il "+" comincia un SET. Con la
        // prima sola, su archivio vero scattava su 13 righe e 12 erano
        // lette giuste ("12x25 25remate + 25MX", "8x25 25 apnea + 25
        // completo"): lì dopo il "+" viene un tratto, che descrive.
        const dopo = k < pezzi.length - 1 ? misuraInTesta(pezzi[k + 1]) : null;
        fermata = {
          ripete: inCoda.metri === m.metri / (m.fattore || 1) && Boolean(dopo) && !dopo.secco,
        };
        break;
      }
    }
  }
  return { totale, quanti, gruppo, scartati, fermata };
}

// Nel foglio del coach il set sta in fondo alla riga: la descrizione a
// sinistra, la misura vera a destra. Quindi si cerca anche una somma che
// arrivi FINO IN FONDO, e si prende quella che comincia più a sinistra:
// in "100GB 50 (25 mono 25compl) 4x(100 + 2x50)" la misura è 4x(...),
// non il 100 iniziale che descrive.
function sommaInCoda(riga) {
  const partenze = [...riga.matchAll(/(?:\d{1,3}\s*x\s*)?\(|\d{1,3}\s*x\s*\d{2,4}|\d{2,4}/gi)]
    .map((m) => m.index);

  for (const da of partenze) {
    const coda = riga.slice(da);
    const pezzi = pezziDiPrimoLivello(coda);
    let totale = 0;
    let quanti = 0;
    let gruppo = false;
    let arrivaInFondo = false;

    for (let i = 0; i < pezzi.length; i++) {
      const m = misuraInTesta(pezzi[i]);
      if (!m) break;
      if (m.secco && m.resto) break;
      totale += m.metri;
      quanti++;
      if (m.gruppo) gruppo = true;
      // Vale solo se l'ultimo pezzo finisce con la misura e non con
      // altro testo: se dopo c'è ancora roba, quella non era la coda.
      if (i === pezzi.length - 1 && !m.resto) arrivaInFondo = true;
      if (m.resto) break;
    }

    if (arrivaInFondo && totale > 0 && (gruppo || quanti > 1)) {
      return { totale, quanti, gruppo };
    }
  }
  return { totale: 0, quanti: 0, gruppo: false };
}


// Dentro le parentesi: "4x25 + 1x100" = 200, "200+2x100+4x50" = 600, e
// anche "4x50 SL + 100 B1" = 300, perché stili e zone sono etichette.
function sommaGruppo(dentro) {
  let somma = 0;
  for (const pezzo of pezziDiPrimoLivello(dentro)) {
    somma += valoreDelPezzo(pezzo.trim());
  }
  return somma;
}

// Le zone e gli stili sono etichette, non numeri: "100 B1" è un cento in
// soglia, "4x50 SL" sono duecento a stile. Dopo averle tolte non deve
// restare nessuna cifra, se no il pezzo sta descrivendo qualcosa —
// "(50 resp 5-3 7-3)" resta una nota, non diventa mai metri.
const ETICHETTE = /\b(A1|A2|B1|B2\+?|C1|C2|C3|D|SL|DO|RA|DE|FA|MX|PS|BN|GB|TC|CP|SUB|TAV|PINNE|PALETTE|COMPL|FFF?|PROG\w*|REGR|MONO|REMATE|SCIVOL\w*)\b/gi;

function soloEtichette(resto) {
  return !/\d/.test(resto.replace(ETICHETTE, ' '));
}

export function valoreDelPezzo(p) {
  // Gruppo dentro il gruppo: "2x(4x25)" dentro "3x(2x(4x25) + 100)".
  let m = p.match(/^(\d{1,3})\s*x\s*\((.+)\)\s*$/i);
  if (m) return +m[1] * sommaGruppo(m[2]);
  m = p.match(/^\((.+)\)\s*$/);
  if (m) return sommaGruppo(m[1]);

  // I tempi non sono distanze: 4x20" sono venti secondi, non venti metri.
  const t = senzaTempi(p).trim();

  // "2x(12/10/8x100)": la scala vive anche dentro le parentesi.
  const scala = scalaInTesta(t);
  if (scala && soloEtichette(scala.resto)) return scala.metri;

  m = t.match(/^(\d{1,3})\s*x\s*(\d{2,4})(?!\d)(?!\s*[x\u00d7])/i);
  if (m && soloEtichette(t.slice(m[0].length))) return +m[1] * almenoUnaVasca(+m[2]);

  // La distanza attaccata allo stile: "50gb", "50sl", e con la riga sopra
  // anche "4x50gb". Fra una cifra e una lettera non c'è confine di parola,
  // quindi `\b` qui non scattava mai e dentro un gruppo quei cinquanta
  // valevano zero. Basta chiedere che il numero sia finito; quello che gli
  // sta dietro lo pesa soloEtichette, come per tutte le altre forme.
  m = t.match(/^(\d{2,4})(?!\d)/);
  if (m && soloEtichette(t.slice(m[0].length))) return +m[1];

  return 0;
}

// Ripetizioni e distanza: "12x75", "6x100", "4x", "300", "2x50",
// "2x(4x25 + 1x100)", e anche "PS 12x25 progr 1-4" — cioè la misura
// scritta DOPO il lavoro, che è come scrive il coach nel foglio.
function trovaMisure(riga) {
  const t = riga.replace(/[×*]/g, 'x');

  // 0. Le scale: "12/10/8x100" = 3000, "400/300/200" = 900. Vanno lette
  // prima di tutto il resto, o la regola 3 legge il primo numero e basta:
  // "12/10/8x100" diventava dodici metri, cioè una vasca.
  const scalaTesta = scalaInTesta(t);
  if (scalaTesta && scalaTesta.metri > 0) {
    return { ripetizioni: 1, distanza: scalaTesta.metri, scala: true };
  }

  // 1. Somme e gruppi in testa alla riga: "3x25 + 1x75 Remate DO",
  // "(3x25) + (1x75)", "4x(150 + 4x25) 150SL". Vale solo se i pezzi sono
  // più d'uno o se ci sono parentesi — se no ci pensano le regole sotto,
  // che tengono ripetizioni e distanza separate.
  const somma = sommaInTesta(t);
  const scartati = somma.scartati || undefined;
  // La somma fermata da una coda che ripete la distanza ("1x400 palette
  // SL 400 + 2x200 ..."): il limite noto. Lo dice la lettura, così il
  // controllo delle sedute non ci propone sopra un numero.
  const dubbia = somma.fermata?.ripete || undefined;
  if (somma.totale > 0 && (somma.quanti > 1 || somma.gruppo)) {
    return {
      ripetizioni: 1, distanza: somma.totale, gruppo: somma.gruppo,
      somma: somma.quanti > 1, scartati, dubbia,
    };
  }

  // 1b. La stessa somma, ma cercata a partire da destra: è dove il coach
  // mette il set quando a sinistra ha scritto com'è fatto il lavoro. Non
  // se la somma in testa l'ha fermata la coda di un set: da destra si
  // leggerebbero i numeri della descrizione.
  const coda = somma.fermata ? { totale: 0 } : sommaInCoda(t);
  if (coda.totale > 0) {
    return { ripetizioni: 1, distanza: coda.totale, gruppo: coda.gruppo, somma: coda.quanti > 1 };
  }

  // 2. La misura in testa alla riga: il caso sicuro.
  let m = t.match(/^\s*(\d{1,3})\s*x\s*(\d{2,4})\b/i);
  if (m) return { ripetizioni: +m[1], distanza: +m[2], scartati, dubbia };

  // 2. "4x", "6x (gio 4 volte)", "4 volte:", e anche "4x A2" — la zona
  // scritta sull'apertura vale per tutto il blocco.
  const apre = aperturaDiBlocco(t);
  if (apre) return { moltiplicatore: apre.ripetizioni, zonaBlocco: apre.zona };

  // 3. Un gruppo fra parentesi, con o senza il moltiplicatore davanti:
  // "2x(4x25 + 1x100)" = 400, "(2x50+4x25)" da solo = 200 (il 3x della
  // riga sopra ci si moltiplica dopo).
  m = t.match(/^\s*(\d{2,4})(?!\d)/);              // "300 stile"
  if (m) return { ripetizioni: 1, distanza: +m[1] };

  // 4. Ultima spiaggia: NxD in mezzo alla riga. È il modo in cui scrivi
  // tu — prima il lavoro, poi la misura — quindi va letto, ma resta
  // giallo in revisione perché qui è più facile prendere un abbaglio.
  // Se ce n'è più d'uno si prende l'ULTIMO: nel foglio la descrizione sta
  // a sinistra e il set a destra, quindi la misura vera è quella in fondo.
  // "(?!\s*x)" evita di leggere "1x 10" dentro "1x 10x100": la misura
  // vera è quella in fondo, non la prima metà di un numero spezzato.
  // 4a. La scala scritta dopo il lavoro: "PS 12/10/8x100".
  const scalaDentro = scalaOvunque(t);
  if (scalaDentro && scalaDentro.metri > 0) {
    return { ripetizioni: 1, distanza: scalaDentro.metri, scala: true, dedotta: true };
  }

  const trovati = [...senzaTempi(t).matchAll(/(?<![\d,.])(\d{1,3})\s*x\s*(\d{2,4})(?![\d])(?!\s*[x×])/gi)];
  if (trovati.length) {
    const ultimo = trovati[trovati.length - 1];
    return { ripetizioni: +ultimo[1], distanza: +ultimo[2], dedotta: true };
  }

  return null;
}

// ---------------------------------------------------------------------
// LEGGI UNA RIGA — la porta pubblica del lettore.
//
// `trovaMisure` trova le misure, `leggiRiga` le conta applicando la
// regola della vasca: due nomi perché sono due cose, una lettura e un
// totale. Il totale lo faceva il ciclo del testo, ed è salito qui perché
// la regola della vasca non è una scelta del ciclo, è della vasca.
//
// `null` vuol dire NON HO CAPITO, e non è zero metri: cosa farne lo
// decide chi chiama — l'import ne fa una riga a zero da rivedere,
// l'editor non tocca i metri che ci sono scritti.
// ---------------------------------------------------------------------
export function leggiRiga(riga) {
  if (!riga) return null;
  const m = trovaMisure(riga);
  if (!m) return null;
  // L'apertura di un blocco ("3x") non è un lavoro: zero metri, e il
  // fattore lo applica chi sa in quale blocco sta la riga.
  if (m.moltiplicatore) return { ...m, metri: 0 };
  return { ...m, metri: (m.ripetizioni || 0) * almenoUnaVasca(m.distanza || 0) };
}

// ---------------------------------------------------------------------
// METRI DALLA NOTAZIONE — la stessa lettura del testo, su una riga sola.
// "1x400" = 400 · "2x200" = 400 · "4x(1x100 + 2x50)" = 800
// "12/10/8x100" = 3000 (scaletta) · "8x50 sl" = 400 (il testo si ignora)
//
// Qui c'era una mini-grammatica tutta sua: novanta righe che leggevano la
// stessa notazione del lettore di testo e la leggevano diversamente, in
// silenzio. Sulle righe della tabella di prova i due numeri erano due su
// 37 righe di 86, e a sbagliare era sempre questa:
//
//   · i tempi contati come metri — 2x (4x50 SL @45" + 100 B1) @3' = 42362
//   · le scalette — "400/300/200" = 400 invece di 900
//   · la regola della vasca, che non aveva — "CP 2x10" = 20 invece di 50
//   · una zona scritta da sola che diventava un metro — "B1" = 1
//   · la x di qualunque parola, rimasta nella stringa dopo la ripulitura:
//     "mix", "max", "mx" rompevano o troncavano l'espressione
//
// Ora la lettura è una, e qui resta solo la mappa dei casi — che è il
// contratto con l'editor, non un dettaglio:
//
//   non ho capito        → null   i metri scritti non si toccano
//   apertura di blocco   → null   "3x" non è un lavoro; e battendo
//                                 "2x200" si passa per "2x", quindi
//                                 azzerare qui cancellerebbe la riga
//                                 che stai scrivendo
//   capito, zero metri   → null   non c'è nessun numero da scrivere
//   capito, N metri      → N
//
// Il null non è zero: "non ho capito" lascia i metri dove sono, zero
// metri li scriverebbe. Chi tocca questa mappa tocca quella differenza.
// ---------------------------------------------------------------------
export function metriDaNotazione(testo) {
  const letta = leggiRiga(testo);
  if (!letta) return null;
  if (letta.moltiplicatore) return null;
  return letta.metri > 0 ? letta.metri : null;
}

// ---------------------------------------------------------------------
// RECUPERO — si scrive @1'40, e chi scrive 1'40 lo ottiene lo stesso.
// ---------------------------------------------------------------------
export function normalizzaRecupero(testo) {
  let t = apiciDritti(testo).trim();
  if (!t) return "";
  // "3'" da solo sono tre MINUTI: l'apice è il segno dei minuti.
  t = t.replace(/^@?\s*(\d{1,2})\s*'\s*$/, "@$1:00");
  // Convenzione unica: @1:30. L'apice e il punto diventano due punti.
  t = t.replace(/(\d{1,2})\s*['.]\s*(\d{2})\s*"?/, "$1:$2");
  // "@3'" senza secondi vuol dire tre minuti, non tre secondi.
  t = t.replace(/^@?(\d{1,2})'\s*$/, "@$1:00");
  // '45"' sono quarantacinque SECONDI: il doppio apice è il loro segno,
  // e qui non lo leggeva nessuno — il campo si teneva '@45"' e la durata
  // ci faceva zero. Oltre il minuto si riporta in minuti: 90" = @1:30.
  t = t.replace(/^@?\s*(\d{1,3})\s*"\s*$/, (_, s) => {
    const n = Number(s);
    return `@${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  });
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

// ---------------------------------------------------------------------
// LA FINE DELLA RIPETIZIONE — dove il blocco smette
//
// Una riga a sé, simmetrica all'apertura: niente metri, niente zona,
// niente lettura. Prima il blocco andava fino a fine sezione, e nel
// testo lo chiudeva una riga vuota che in archivio non arrivava: il
// confine restava solo come ASSENZA di `moltiplicato` sulla riga dopo, e
// al primo gesto il ricalcolo lo cancellava ("3x / 8x50 / (vuota) /
// 200": il 200 diventava 600, dalla 0.56.10 in produzione).
//
// È una riga e non un campo sull'ultima figlia: spostando quella riga il
// confine viaggerebbe con lei, e cancellandola sparirebbe. Ha un suo
// indice, quindi inserirla, spostarla e toglierla passano dagli stessi
// involucri di svolto di ogni altra riga.
// ---------------------------------------------------------------------
export const rigaFineBlocco = () => ({
  notazione: '', metri: 0, zona: '', recupero: '', note: '', senzaMetri: true, chiudeBlocco: true,
});

// Le figlie del blocco aperto alla posizione `m`, in scrittura.
export function figlieDelBlocco(sezione, m) {
  const serie = sezione?.serie || [];
  const fuori = [];
  for (let k = m + 1; k < serie.length; k++) {
    if (serie[k]?.apreBlocco) break;            // un altro blocco: qui il nostro finisce
    if (serie[k]?.chiudeBlocco) break;          // la sua fine
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
      delete riga.metriLetti;
      continue;
    }
    // La fine: da qui in giù non si ripete più niente. Come l'apertura,
    // non è un lavoro, e si rimette in forma a ogni ricalcolo.
    if (riga.chiudeBlocco) {
      attivo = 1;
      riga.metri = 0;
      riga.senzaMetri = true;
      delete riga.moltiplicato;
      delete riga.metriManuali;
      delete riga.metriLetti;
      continue;
    }
    // "×1" non ripete niente: il blocco è stato sciolto. Dalla 0.56.12
    // "Sciogli" toglie la riga (sciogliBlocco) e qui non ci si arriva più
    // dall'editor; il ramo resta per i dati salvati prima.
    if (riga.apreBlocco !== undefined) {
      delete riga.apreBlocco;
      delete riga.senzaMetri;
      attivo = 1;
    }

    const vecchio = Number(riga.moltiplicato) || 1;
    if (attivo > 1) riga.moltiplicato = attivo; else delete riga.moltiplicato;
    if (attivo === vecchio) continue;                // niente da fare, e non si tocca

    // Il numero del lettore segue il blocco anche sulle righe coi metri
    // scritti a mano: è quello che il lettore scriverebbe ORA in questa
    // posizione, ed è proprio lo scarto da `metri` che deve restare
    // visibile. Stessa prudenza dei metri: se la divisione non torna non
    // si inventa, si dimentica.
    if (typeof riga.metriLetti === 'number') {
      if (riga.metriLetti % vecchio === 0) riga.metriLetti = (riga.metriLetti / vecchio) * attivo;
      else delete riga.metriLetti;
    }

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

// ---------------------------------------------------------------------
// I METRI DEL LETTORE, accanto a quelli in archivio
//
// `metri` è il numero che conta. `metriLetti` è quello che il lettore ci
// avrebbe scritto, nella stessa unità — già moltiplicato per il blocco —
// così che `metri !== metriLetti` voglia dire una cosa sola: qualcuno
// l'ha cambiato a mano. `metriManuali` dice la stessa cosa solo dalla
// 0.56.10: prima stava su tutte le righe importate, corrette o no, e
// sulle sedute vecchie non distingue niente.
//
// Tre stati, e la differenza conta:
//   numero    il lettore ha letto questo
//   null      il lettore c'è passato e non ha trovato metri
//   assente   riga salvata prima della 0.56.10, o che non si legge
//             (aperture di blocco, lavoro a secco)
//
// NESSUNO LO SOMMA: volumi, carico e viste leggono `metri` e basta.
//
// Si scrive quando cambia la notazione (qui, chiamata DOPO il ricalcolo,
// che ha appena messo il fattore giusto su `moltiplicato`) e si riscala
// quando cambia il blocco (ricalcolaBlocchi). Mai in lettura.
// All'import lo scrive sedutaDaLettura, col numero dell'analizzatore.
// ---------------------------------------------------------------------
export function annotaLettura(sezione, riga) {
  if (!riga) return riga;
  if (eSecco(sezione) || riga.apreBlocco > 1 || riga.chiudeBlocco) {
    delete riga.metriLetti;
    return riga;
  }
  // Una riga di composizione descrive la ripetuta sopra: vale zero, e
  // il lettore — che la composizione la conosce — zero ci scriverebbe.
  // Rileggerla da sola ("50 sl forte" = 50) farebbe sembrare lo zero
  // una correzione a mano.
  if (riga.composizione) {
    riga.metriLetti = 0;
    return riga;
  }
  const giro = metriDaNotazione(riga.notazione);
  riga.metriLetti = giro === null ? null : giro * (Number(riga.moltiplicato) || 1);
  return riga;
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

// Il fattore del blocco che resta aperto in fondo alla sezione, o 0:
// dice all'editor quando offrire "fine ripetizione" accanto a "+ serie".
export function bloccoApertoInFondo(sezione) {
  let attivo = 0;
  for (const riga of sezione?.serie || []) {
    if (riga?.apreBlocco > 1) attivo = riga.apreBlocco;
    else if (riga?.chiudeBlocco || riga?.apreBlocco !== undefined) attivo = 0;
  }
  return attivo;
}

// Il fattore del blocco che una riga di fine chiude, o 0 se sopra non
// c'è niente da chiudere (una fine spostata sopra la sua apertura).
export function fattoreChiuso(sezione, j) {
  const serie = sezione?.serie || [];
  for (let k = j - 1; k >= 0; k--) {
    if (serie[k]?.chiudeBlocco) return 0;
    if (serie[k]?.apreBlocco > 1) return serie[k].apreBlocco;
  }
  return 0;
}

// ---------------------------------------------------------------------
// I BLOCCHI DA CHIUDERE — le sedute importate prima della 0.56.12
//
// "3x / 8x50 / (riga vuota) / 200" è arrivato in archivio senza la
// fine: il confine c'è solo come ASSENZA di `moltiplicato` sul 200. Il
// segno è questo, e solo questo: sotto righe col fattore del blocco, una
// riga senza. Il tasto inserisce la fine lì; i metri non si muovono, e
// svolto si rimappa — per questo il tasto c'è anche con lo svolto.
//
// Finché non si chiude, il primo gesto nella sezione estende il blocco
// fino in fondo (il ricalcolo non può distinguere la riga appena
// aggiunta, che il fattore lo deve prendere, da quella dopo una riga
// vuota che non c'è più). Dopo quel gesto la riga ha `moltiplicato` e il
// segno è perso: per questo l'avviso sta in testa alla seduta.
// ---------------------------------------------------------------------
export function blocchiDaChiudere(seduta, { puoScrivere = true } = {}) {
  const trovati = [];
  (seduta?.sezioni || []).forEach((sezione, sezN) => {
    if (eSecco(sezione)) return;
    let attivo = 1;
    let apertura = -1;
    let conFattore = false;
    (sezione.serie || []).forEach((riga, serM) => {
      if (!riga) return;
      if (riga.apreBlocco > 1) { attivo = riga.apreBlocco; apertura = serM; conFattore = false; return; }
      if (riga.apreBlocco !== undefined || riga.chiudeBlocco) { attivo = 1; return; }
      if (attivo === 1) return;
      if (Number(riga.moltiplicato) === attivo) { conFattore = true; return; }
      if (!riga.moltiplicato && conFattore) {
        trovati.push({
          sezN,
          serM,
          apertura,
          sezione: sezione.titolo || `Sezione ${sezN + 1}`,
          notazione: riga.notazione,
          ripetizioni: attivo,
          applicabile: puoScrivere,
          perche: puoScrivere ? null : 'sola-lettura',
        });
        attivo = 1;                 // da qui il blocco è già finito
      }
    });
  });
  return trovati;
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

      // Sotto righe che il fattore ce l'hanno, una che non ce l'ha non è
      // un blocco "a metà": è dove il blocco finiva, con una riga vuota
      // che in archivio non è arrivata (blocchiDaChiudere). Da lì in giù
      // non è roba di questo avviso: moltiplicarla aggiungeva metri finti.
      const tutte = figlieDelBlocco(sezione, serM);
      const taglio = tutte.findIndex((k, x) => !sezione.serie[k]?.moltiplicato
        && tutte.slice(0, x).some((q) => Number(sezione.serie[q]?.moltiplicato) === n));
      const figlie = (taglio >= 0 ? tutte.slice(0, taglio) : tutte)
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
// I METRI DA RICONTROLLARE
//
// Il lettore della notazione cambia, i metri in archivio no. Questa
// funzione cerca le righe dove i due non tornano e dice, riga per riga,
// cosa si può proporre e cosa no. Come apertureNude: trova E applica,
// così il numero promesso è per costruzione quello che arriva. Il tasto
// scrive nella bozza; in archivio va solo con Salva.
//
// Due famiglie di righe, e due domande diverse.
//
// CON `metriLetti` (importate o ritoccate dalla 0.56.10): `metri !==
// metriLetti` è una scelta dell'allenatore, e non si propone di
// cambiarla. Si guarda solo se il lettore di OGGI legge diverso da
// quello che c'era quando la riga è stata scritta:
//   lettore-cambiato   metri = metriLetti, oggi si legge altro → si
//                      propone la lettura di oggi
//   corretta-a-mano    metri ≠ metriLetti, e il lettore è cambiato
//                      sotto: si segnala, senza proposta
//
// SENZA `metriLetti` (prima della 0.56.10): l'unico confronto possibile
// è coi metri che la notazione dà oggi, fattore del blocco compreso.
//   lettura-vecchia    metri scritti da un lettore vecchio: si propone,
//                      anche tutte insieme
//   metri-fissi        `metriManuali` o `perStile`: corretta a mano o
//                      letta male, dai dati non si sa. Riga per riga
//   a-zero             zero in archivio e oggi si legge un numero: riga
//                      non capita all'import, o composizione che non si
//                      riconosce più. Riga per riga
// Sulle sedute importate prima della 0.56.10 `metriManuali` sta su tutte
// le righe: per loro "aggiorna tutte" non c'è mai, ed è voluto.
//
// Si salta, senza segnalare:
//   - la seduta di SwimCoach: notazione scritta con le regole di un'altra
//     app (torna in `saltate`, per contarla)
//   - il lavoro a secco, le aperture di blocco, `senzaMetri`
//   - le righe di composizione: col flag, o ricostruite (un NxD seguito
//     da righe a zero la cui lettura somma D — le vecchie il flag non
//     ce l'hanno)
//   - la notazione che il lettore non capisce, o che vale zero
//   - le sezioni che apertureNude segnala: prima i blocchi, se no due
//     avvisi propongono numeri diversi sulle stesse righe; e le righe col
//     `moltiplicato` diverso dal blocco in cui stanno (tornano in
//     `saltate`)
//
// Il fattore del blocco si deriva dall'alto come in ricalcolaBlocchi, non
// dal campo `moltiplicato`: fino alla 0.55.1 all'import si perdeva.
//
// I BLOCCHI IMPORTATI PRIMA DELLA 0.54 non si saltano. Lì il "3x" è
// arrivato senza `apreBlocco` e le figlie senza `moltiplicato`, ma coi
// metri già moltiplicati dal lettore e fissati: apertureNude non li vede,
// perché non manca niente, e nessun tasto li sistema. Il fattore si
// prende dalla riga di apertura (aperturaDiBlocco), fino alla prossima
// apertura o a fine sezione come in figlieDelBlocco, e le figlie sono
// sempre metri-fissi: riga per riga, mai "aggiorna tutte". Il confine
// del blocco è una ricostruzione: le righe vuote che lo chiudevano nel
// testo non sono state salvate. Una riga salvata esattamente a un giro
// chiude il blocco (vedi sotto), e le righe proposte dentro portano
// `bloccoRicostruito: N`, perché l'editor lo dica accanto alla proposta.
//
// `svolto` non si tocca mai, e la riga che ci ha una chiave non ha tasto:
// il valore rilevato può essere stato scritto partendo dal numero
// sbagliato, e quello lo sa solo chi c'era.
// ---------------------------------------------------------------------

// Null e zero, qui, dicono la stessa cosa: nessun metro letto. L'import
// scrive 0 dove annotaLettura scriverebbe null, e non è un cambio di
// lettore.
const comeLetto = (v) => (typeof v === 'number' ? v : 0);

// Le righe a zero che descrivono la ripetuta sopra, in una seduta che il
// flag non ce l'ha. È la regola di chiudiGruppo dell'analizzatore, alla
// rovescia: sotto un NxD, righe a zero la cui lettura somma D.
function composizioniRicostruite(serie) {
  const trovate = new Set();
  serie.forEach((padre, i) => {
    if (padre?.apreBlocco || !(Number(padre?.metri) > 0)) return;
    const letto = leggiRiga(padre.notazione);
    if (!letto || letto.moltiplicatore || !(letto.ripetizioni > 1)) return;
    let somma = 0;
    const figlie = [];
    for (let k = i + 1; k < serie.length; k++) {
      const r = serie[k];
      if (r?.apreBlocco || (Number(r?.metri) || 0) !== 0) break;
      const l = leggiRiga(r.notazione);
      if (!l || l.moltiplicatore) break;
      somma += l.metri;
      figlie.push(k);
      if (somma >= letto.distanza) break;
    }
    if (somma === letto.distanza) figlie.forEach((k) => trovate.add(k));
  });
  return trovate;
}

export function metriDaRicontrollare(seduta, { puoScrivere = true } = {}) {
  const righe = [];
  const saltate = [];
  if (seduta?.origine === 'swimcoach') {
    saltate.push({ sezN: null, perche: 'swimcoach' });
    return { righe, saltate };
  }

  const daSistemare = new Set(apertureNude(seduta).map((n) => n.sezN));
  // Dove finiva un blocco che in archivio non ha la sua fine: da lì in
  // giù fino alla prossima apertura o fine, niente proposte di metri.
  const daChiudere = new Set(blocchiDaChiudere(seduta).map((b) => `${b.sezN}-${b.serM}`));

  (seduta?.sezioni || []).forEach((sezione, sezN) => {
    if (eSecco(sezione)) return;
    const serie = sezione.serie || [];
    if (daSistemare.has(sezN)) {
      saltate.push({ sezN, perche: 'blocchi' });
      return;
    }
    const ricostruite = composizioniRicostruite(serie);

    let attivo = 1;
    let nudo = false;        // il blocco attivo viene da un "3x" senza apreBlocco
    let senzaFine = false;   // sotto un blocco che andava chiuso qui sopra
    serie.forEach((riga, serM) => {
      if (!riga) return;
      if (riga.apreBlocco > 1) { attivo = riga.apreBlocco; nudo = false; senzaFine = false; return; }
      if (riga.chiudeBlocco) { attivo = 1; nudo = false; senzaFine = false; return; }
      if (riga.apreBlocco !== undefined) { attivo = 1; nudo = false; }
      if (daChiudere.has(`${sezN}-${serM}`)) senzaFine = true;
      if (senzaFine) {
        saltate.push({ sezN, serM, perche: 'blocco-da-chiudere' });
        return;
      }
      const aperta = riga.apreBlocco ? null : aperturaDiBlocco(riga.notazione);
      if (aperta?.ripetizioni > 1) { attivo = aperta.ripetizioni; nudo = true; return; }
      if (riga.senzaMetri || riga.composizione) return;
      // LA RIGA VUOTA CHE NON C'È PIÙ. Nel testo "3x / 8x50 / (vuota) /
      // 200" il lettore chiudeva il blocco alla riga vuota e salvava il 200
      // a un giro. La riga vuota non è stata salvata: senza questa guardia
      // il 200 sembrerebbe dentro il ×3 e verrebbe proposto a 600. Il
      // lettore di allora dentro il blocco moltiplicava sempre, quindi una
      // riga salvata esattamente a un giro di oggi vuol dire "ero fuori":
      // il blocco si chiude lì, e da lì in giù.
      if (nudo && !riga.moltiplicato) {
        const unGiro = metriDaNotazione(riga.notazione);
        if (unGiro !== null && (Number(riga.metri) || 0) === unGiro) { attivo = 1; nudo = false; }
      }
      // `moltiplicato` rimasto indietro rispetto al blocco in cui la riga
      // sta (un ×4 sotto un ×3, che apertureNude non vede perché lì i
      // metri calerebbero). Scrivere i metri e lasciare il fattore
      // sbagliato peggiorerebbe la riga: la sistema il primo gesto nella
      // sezione, col ricalcolo.
      // Sotto un "3x" nudo `moltiplicato` manca per costruzione: è proprio
      // quello che l'import di allora perdeva.
      if (!(nudo && !riga.moltiplicato) && (Number(riga.moltiplicato) || 1) !== attivo) {
        saltate.push({ sezN, serM, perche: 'fattore' });
        return;
      }

      const metri = Number(riga.metri) || 0;
      const giro = metriDaNotazione(riga.notazione);
      const oggi = giro === null ? null : giro * attivo;
      let voce;

      if ('metriLetti' in riga) {
        if (comeLetto(riga.metriLetti) === comeLetto(oggi)) return;
        const corretta = metri !== comeLetto(riga.metriLetti);
        voce = {
          caso: corretta ? 'corretta-a-mano' : 'lettore-cambiato',
          metriLetti: riga.metriLetti,
          proposta: corretta ? null : oggi,
          tutteInsieme: !corretta && !riga.metriManuali && !nudo,
        };
      } else {
        if (oggi === null || oggi === metri || ricostruite.has(serM)) return;
        const fissa = riga.metriManuali || riga.perStile || nudo;
        voce = {
          caso: metri === 0 ? 'a-zero' : (fissa ? 'metri-fissi' : 'lettura-vecchia'),
          proposta: oggi,
          tutteInsieme: metri !== 0 && !fissa,
        };
      }

      // La lettura che il lettore stesso dichiara dubbia (il limite noto
      // in sommaInTesta): si segnala, ma un numero sopra non si propone.
      if (voce.proposta !== null && leggiRiga(riga.notazione)?.dubbia) {
        voce = { ...voce, proposta: null, tutteInsieme: false, dubbia: true };
      }

      const svolta = metriSvoltiDiRiga(seduta.svolto, sezN, serM) !== null;
      // Senza proposta: la correzione dell'allenatore, una lettura dubbia,
      // oppure un lettore che oggi non capisce più quello che prima capiva
      // — e lì zero sarebbe un numero inventato.
      const perche = voce.proposta === null
        ? (voce.caso === 'corretta-a-mano' ? 'corretta-a-mano'
          : voce.dubbia ? 'lettura-dubbia' : 'non-capita')
        : svolta ? 'svolto'
          : (puoScrivere ? null : 'sola-lettura');
      righe.push({
        sezN,
        serM,
        sezione: sezione.titolo || `Sezione ${sezN + 1}`,
        notazione: riga.notazione,
        metri,
        oggi,
        ...voce,
        delta: voce.proposta === null ? 0 : voce.proposta - metri,
        applicabile: perche === null,
        tutteInsieme: perche === null && voce.tutteInsieme,
        perche,
        // Il confine del blocco è dedotto, non scritto: chi decide la riga
        // deve saperlo. Il numero è il fattore che la proposta ha usato.
        ...(nudo ? { bloccoRicostruito: attivo } : {}),
      });
    });
  });

  return { righe, saltate };
}

// Il tasto di una riga. Rifà il controllo e scrive solo se la riga è
// ancora quella promessa: i metri, e la lettura di oggi accanto quando
// la riga ne aveva una. `metriManuali`, `svolto` e il resto non si
// toccano. Lavora sulla bozza, come applicaAperturaBlocco.
export function applicaRicontrollo(seduta, sezN, serM, opzioni) {
  const voce = metriDaRicontrollare(seduta, opzioni).righe
    .find((r) => r.sezN === sezN && r.serM === serM);
  if (!voce?.applicabile) return false;
  const riga = seduta.sezioni[sezN].serie[serM];
  riga.metri = voce.proposta;
  if ('metriLetti' in riga) riga.metriLetti = voce.oggi;
  return true;
}

// "Aggiorna tutte": solo le righe dove nessuno ha deciso a mano.
export function applicaRicontrolloInBlocco(seduta, opzioni) {
  const voci = metriDaRicontrollare(seduta, opzioni).righe.filter((r) => r.tutteInsieme);
  for (const v of voci) applicaRicontrollo(seduta, v.sezN, v.serM, opzioni);
  return voci.length;
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
//
// `volte` (dalla 0.56.13) sono le volte davvero fatte di un blocco, sulla
// chiave della sua apertura: le scrive "Com'è andata" e servono solo a
// ridisegnare il campo. I metri del blocco stanno comunque in `righe`,
// sulle figlie, ed è lì che li leggono v_serie e metri_svolti().
export function svoltoCollassato(svolto) {
  const pieni = (mappa) => Object.fromEntries(
    Object.entries(mappa || {})
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
  const righe = pieni(svolto?.righe);
  const volte = pieni(svolto?.volte);
  const nota = svolto?.nota || undefined;
  const conVolte = Object.keys(volte).length > 0;
  if (!Object.keys(righe).length && !conVolte && !nota) return null;
  return { righe, volte: conVolte ? volte : undefined, nota };
}

// Il nucleo. `dove(i, j)` torna la posizione nuova come [i2, j2], oppure
// null se quella riga non esiste più. Le volte sono posizionali come i
// metri e si rimappano con le stesse regole.
export function rimappaSvolto(svolto, dove) {
  if (!svolto?.righe && !svolto?.volte) return svolto ?? null;
  const rimappa = (mappa) => {
    const fuori = {};
    for (const [chiave, valore] of Object.entries(mappa || {})) {
      const [i, j] = chiave.split('-').map(Number);
      if (!Number.isInteger(i) || !Number.isInteger(j)) continue;  // chiave malfatta: si lascia cadere
      const nuova = dove(i, j);
      if (!nuova) continue;
      fuori[chiaveRiga(nuova[0], nuova[1])] = valore;
    }
    return fuori;
  };
  return svoltoCollassato({ ...svolto, righe: rimappa(svolto.righe), volte: rimappa(svolto.volte) });
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

// I gesti della fine della ripetizione stanno qui, dopo gli involucri
// di svolto che usano: inserire e sciogliere spostano righe.
// Il tasto "fine ripetizione", e il tasto dell'avviso sulle sedute
// vecchie: la fine entra alla posizione `j` della sezione `i`. Inserita
// in mezzo sposta di uno tutte le righe sotto, quindi svolto si rimappa
// nello stesso passaggio. Lavora sulla bozza; in archivio va con Salva.
export function inserisciFineBlocco(seduta, i, j) {
  const sezione = seduta?.sezioni?.[i];
  if (!sezione || eSecco(sezione)) return false;
  const serie = sezione.serie || [];
  const dove = Math.max(0, Math.min(j, serie.length));
  sezione.serie = [...serie.slice(0, dove), rigaFineBlocco(), ...serie.slice(dove)];
  if (seduta.svolto) seduta.svolto = svoltoDopoInserisciRiga(seduta.svolto, i, dove);
  ricalcolaBlocchi(sezione);
  return true;
}

// "Sciogli": via la riga di apertura, e la sua fine se c'è. Prima
// l'apertura restava lì con apreBlocco tolto, una "3x" qualunque: al
// ricalcolo dopo non chiudeva più niente, e l'avviso dei blocchi la
// vedeva come un'apertura nuda e proponeva subito di rimetterla.
export function sciogliBlocco(seduta, i, j) {
  const sezione = seduta?.sezioni?.[i];
  const serie = sezione?.serie || [];
  if (!(serie[j]?.apreBlocco > 1)) return false;
  let fine = -1;
  for (let k = j + 1; k < serie.length; k++) {
    if (serie[k]?.apreBlocco > 1) break;
    if (serie[k]?.chiudeBlocco) { fine = k; break; }
  }
  // Prima la più in basso: così l'indice dell'altra non si sposta.
  for (const k of [fine, j].filter((x) => x >= 0)) {
    sezione.serie = sezione.serie.filter((_, x) => x !== k);
    if (seduta.svolto) seduta.svolto = svoltoDopoTogliRiga(seduta.svolto, i, k);
  }
  ricalcolaBlocchi(sezione);
  return true;
}

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
// COM'È ANDATA — il campo di ogni riga
//
// Fino alla 0.56.12 ogni riga aveva il campo dei metri, anche l'apertura
// "8x": scrivendo 4 si registravano +4 m, e le righe del blocco restavano
// a otto giri. L'apertura non è un lavoro, è un numero di volte.
//
//   'volte'  apertura di un blocco in acqua: il campo dice quante volte,
//            e cambiarlo riscala le figlie (cambiaVolteSvolto)
//   'metri'  ogni altra riga, come prima
//   null     nessun campo: l'apertura a secco (lì non c'è un metro da
//            riscalare), l'apertura nuda di una seduta vecchia (non si
//            sa quali righe stiano dentro) e la fine della ripetizione
// ---------------------------------------------------------------------
export function campoAndata(sezione, j) {
  const riga = sezione?.serie?.[j];
  if (!riga || riga.chiudeBlocco) return null;
  if (riga.apreBlocco > 1) return eSecco(sezione) ? null : 'volte';
  if (aperturaDiBlocco(riga.notazione)) return null;
  return 'metri';
}

// Le figlie IN LETTURA: il confine si ricava da `moltiplicato`, come
// quando si ridisegna la seduta. Qui non si ricalcola niente: svolto non
// tocca il programma.
function figlieInLettura(sezione, m) {
  const serie = sezione?.serie || [];
  const n = serie[m]?.apreBlocco;
  const fuori = [];
  for (let k = m + 1; k < serie.length; k++) {
    const r = serie[k];
    if (!r || r.apreBlocco > 1 || r.chiudeBlocco) break;
    if (Number(r.moltiplicato) !== n) break;
    fuori.push(k);
  }
  return fuori;
}

const numeroSvolto = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : undefined);

// Le volte fatte: quelle rilevate, o quelle scritte nel programma.
export function volteDiBlocco(sezioni, svolto, i, m) {
  const rilevate = numeroSvolto(svolto?.volte?.[chiaveRiga(i, m)]);
  return rilevate ?? sezioni?.[i]?.serie?.[m]?.apreBlocco;
}

// Solo cifre: un intero da zero in su. Niente decimali, segni o
// esponenti — "1e2" per Number vale 100, per chi lo scrive no.
const SOLO_INTERO = /^\s*\d+\s*$/;

// Il campo dei metri di una riga qualunque: cambia lei e basta.
//
// I metri sono interi. Fino alla 0.56.13 un decimale passava, e
// v_carico_zona_reale lo convertiva con ::integer: la conversione
// falliva, e con la vista non si apriva più la Dashboard della società.
// Quello che non è un intero non si scrive, e svolto resta com'era.
export function cambiaMetriSvolto(svolto, i, j, valore) {
  const vuoto = valore === '' || valore === null || valore === undefined;
  if (!vuoto && !SOLO_INTERO.test(String(valore))) return svolto ?? null;
  const righe = { ...(svolto?.righe || {}) };
  const k = chiaveRiga(i, j);
  if (vuoto) delete righe[k];
  else righe[k] = Number(valore);
  return svoltoCollassato({ ...svolto, righe });
}

// Il campo delle volte. Ogni figlia si riscala in proporzione dal suo
// valore di adesso — anche quella corretta a mano: se il blocco è andato
// a metà, è andata a metà anche lei. Tornando alle volte scritte le
// figlie tornano al programma e la chiave sparisce.
//
// Da zero volte la proporzione non esiste: si riparte dal programma, e
// le correzioni fatte prima dello zero sono perse (lo zero le aveva già
// cancellate).
//
// Se la divisione non è esatta la riga non si tocca e torna in
// `nonRiscalate`: meglio un numero non aggiornato, che si vede e si
// corregge a mano, che uno arrotondato in silenzio.
//
// Un numero sulla chiave dell'apertura in `righe` è il "+4" scritto prima
// della 0.56.13: al primo cambio di volte se ne va.
export function cambiaVolteSvolto(sezioni, svolto, i, m, valore) {
  const sezione = sezioni?.[i];
  const nessuno = { svolto: svolto ?? null, nonRiscalate: [] };
  if (campoAndata(sezione, m) !== 'volte') return nessuno;
  const scritte = sezione.serie[m].apreBlocco;
  const vuoto = valore === '' || valore === null || valore === undefined;
  if (!vuoto && !SOLO_INTERO.test(String(valore))) return nessuno;
  const dopo = vuoto ? scritte : Number(valore);
  const prima = volteDiBlocco(sezioni, svolto, i, m);

  const righe = { ...(svolto?.righe || {}) };
  const volte = { ...(svolto?.volte || {}) };
  const k = chiaveRiga(i, m);
  delete righe[k];
  if (dopo === scritte) delete volte[k]; else volte[k] = dopo;

  const nonRiscalate = [];
  for (const j of figlieInLettura(sezione, m)) {
    const kj = chiaveRiga(i, j);
    const programmati = +sezione.serie[j].metri || 0;
    const [base, da] = prima > 0
      ? [numeroSvolto(righe[kj]) ?? programmati, prima]
      : [programmati, scritte];
    if ((base * dopo) % da !== 0) { nonRiscalate.push(kj); continue; }
    const nuovi = (base * dopo) / da;
    if (nuovi === programmati) delete righe[kj]; else righe[kj] = nuovi;
  }
  return { svolto: svoltoCollassato({ ...svolto, righe, volte }), nonRiscalate };
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
  { gruppo: 'ragazzi',  codici: ['RAG_1', 'RAG_2', 'RAG_3M'] },
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

// La colonna "categoria" del CSV. Teen, Master, Propaganda e Triathlon
// non sono età ma percorsi, quindi dall'anno di nascita non si ricavano:
// o li scrivi nel foglio, o l'app non può saperlo.
//
// COLONNA VUOTA VUOL DIRE "DALL'ANNO", A QUALSIASI ETÀ.
// Fino alla 0.55.5 c'era una scorciatoia: sopra i 25 anni proponeva
// Master. Era nata come proposta e si comportava come una scrittura — il
// codice finiva in `categoria_override` indistinguibile da uno messo a
// mano, e l'import lo riscriveva anche sugli atleti già in squadra. Un
// Senior o un Assoluto adulto, o chiunque avesse l'override azzerato
// apposta, tornava Master al primo foglio con la colonna vuota. Master è
// un tipo di tesseramento, non un'età: non si indovina. Chi vuole
// ritrovarseli lo scrive nel foglio.
export function categoriaDaCsv(scritta) {
  const pulita = String(scritta || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!pulita) return { codice: null };          // null = si calcola dall'età
  const trovata = CATEGORIE.find((c) => c.codice === pulita);
  if (trovata) return { codice: trovata.codice };
  // Scritta per esteso: "Master", "Triathlon", "Teen 2", "Propaganda 2"
  const perNome = CATEGORIE.find(
    (c) => c.nome.toUpperCase().replace(/[\s-]+/g, '_') === pulita
  );
  return { codice: perNome ? perNome.codice : null };
}

// Come si scrive la categoria di un atleta nell'elenco. Quando c'è un
// override, accanto va il derivato dall'età: "Master (SEN_1)". Serve a
// sapere DOVE ricade l'atleta prima di azzerargli l'override — senza,
// si toglie il Master alla cieca e si scopre dopo in quale gruppo è
// finito. Il derivato non compare quando è nullo (fasce non caricate,
// o età fuori da ogni fascia) né quando non c'è override, che è il caso
// in cui la categoria mostrata È già il derivato.
export function etichettaCategoria(atleta, fasce) {
  const derivato = categoriaDi(atleta?.anno_nascita, atleta?.sesso, fasce);
  const override = atleta?.categoria_override || null;
  return {
    testo: override || derivato || null,
    derivato: override && derivato ? derivato : null,
    conOverride: !!override,
  };
}

// ---------------------------------------------------------------------
// I SOSPETTI DI UN IMPORT — si guardano PRIMA di salvare.
//
// Un avviso a cose fatte non serve a niente: dice cosa è già stato
// scritto in archivio, e per rimediare bisogna ricordarsi di andare a
// sistemare a mano. Questa funzione gira sulle righe lette dal foglio e
// restituisce cosa vale la pena rileggere prima di premere. Non decide
// niente: decide l'allenatore.
//
// Tre motivi, e nessuno è un errore certo:
//
//   mas_fuori_fascia  Master la cui fascia derivata NON è SEN_1. Master
//                     è un tesseramento, non un'età, ma un 2006 marcato
//                     MAS che per età sarebbe CAD_2 è quasi sempre una
//                     colonna compilata male.
//   tri               Triathlon, elencati sempre: è un gruppo piccolo e
//                     rileggerlo costa niente.
//   cambia_override   Chi è già in squadra con un override e nel foglio
//                     ha un codice DIVERSO. La riga sembra innocua e
//                     riscrive una scelta fatta a mano: un Master che
//                     diventa Teen, un Senior che diventa Triathlon.
//
// LA COLONNA VUOTA NON SI SEGNALA, perché non cambia niente: l'import
// scrive solo quello che è scritto nel foglio, e su un override esistente
// una casella vuota non passa (vedi il filtro in Atleti.jsx, che aggiorna
// solo quando la categoria del foglio è valorizzata). Segnalarla direbbe
// il falso. Ed è giusto che non passi: i fogli scaricati prima della
// 0.56.0 non hanno affatto la colonna categoria, quindi reimportarne uno
// a inizio stagione azzererebbe in un colpo gli override di tutta la
// squadra — ogni Master, Teen, Propaganda e Triathlon tornerebbe alla
// categoria per età. Per togliere un override c'è la voce
// "— (dall'anno)" nella scheda Atleti, che lo fa dove si vede.
//
// UNA RIGA PUÒ ESSERE SOSPETTA PER PIÙ MOTIVI INSIEME, e deve comparire
// per ciascuno: un atleta oggi MAS che nel foglio è TRI va letto sia fra
// i Triathlon sia fra le sovrascritture, o il cambio di percorso passa
// inosservato proprio perché il codice nuovo era legittimo.
//
// I MAS che derivano SEN_1 NON si segnalano: sono la norma, e un avviso
// che scatta sempre smette di essere letto.
// ---------------------------------------------------------------------
export function sospettiImport(righe, esistenti, fasce) {
  const gia = new Map((esistenti || []).map((a) => [chiaveAtleta(a), a]));
  const fuori = [];

  for (const r of righe || []) {
    const chiave = chiaveAtleta(r);
    const nome = `${r.cognome} ${r.nome} ${r.anno_nascita}`;
    const derivato = categoriaDi(r.anno_nascita, r.sesso, fasce);
    const nuovo = r.categoria_override || null;
    const comune = { chiave, nome, anno: r.anno_nascita, derivato };

    if (nuovo === 'MAS' && derivato !== 'SEN_1') {
      fuori.push({ ...comune, tipo: 'mas_fuori_fascia' });
    }
    if (nuovo === 'TRI') {
      fuori.push({ ...comune, tipo: 'tri' });
    }
    // `nuovo` deve esserci: senza, l'import non tocca l'override e non
    // c'è niente da segnalare.
    const vecchio = gia.get(chiave)?.categoria_override || null;
    if (vecchio && nuovo && vecchio !== nuovo) {
      fuori.push({ ...comune, tipo: 'cambia_override', perdeva: vecchio, diventa: nuovo });
    }
  }
  return fuori;
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
      if (s.chiudeBlocco) return;          // la fine di una ripetizione non è una riga di lavoro
      if (!s.notazione) problemi.push({ campo: dove, msg: "Manca la notazione" });
      // Partenze, virate, lavoro a secco: stanno nella seduta senza fare metri.
      if (s.senzaMetri) return;
      // La composizione descrive la ripetuta sopra: il suo zero è una scelta.
      if (!Number(s.metri) && !s.composizione) problemi.push({ campo: dove, msg: "Metri a zero" });
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
  { nome: "Triathlon",    codici: ["TRI"] },
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
// IL FILTRO DI TESTATA — un posto solo
//
// La categoria si sceglie una volta in alto, e ogni schermata deve
// rispondere alla stessa domanda: questo sta nel gruppo scelto? La
// risposta era riscritta a mano in sei schermate, ognuna un po' diversa,
// e due sbagliavano: la Lista Sedute non filtrava affatto (il componente
// non riceveva nemmeno i codici), e Carico atleti filtrava le righe per
// DATA — così in un giorno con una seduta Esordienti A e una Esordienti
// B passavano gli atleti di tutte e due.
//
// `null` vuol dire NESSUN FILTRO, non "nessuna categoria": è la testata
// su "Tutte". Le tre funzioni lo trattano allo stesso modo, ed è metà
// del motivo per cui stanno qui invece che in sei schermate.
// ---------------------------------------------------------------------

// I codici dietro i nomi scelti in testata. Niente scelte, niente filtro.
export function codiciDelGruppo(nomi) {
  const scelti = (nomi || [])
    .flatMap((n) => RAGGRUPPAMENTI.find((r) => r.nome === n)?.codici || []);
  return scelti.length ? [...new Set(scelti)] : null;
}

// Una seduta si vede se una delle sue categorie sta nel gruppo. Senza
// categorie resta visibile — è una seduta appena creata, e nasconderla
// vorrebbe dire non ritrovarla più. La regola è quella di
// rientraNelMacro, che il calendario usa da sempre: le copie a mano la
// scartavano, quindi la stessa seduta si vedeva sul calendario e in
// nessun altro posto.
export const sedutaNelGruppo = (seduta, codici) =>
  rientraNelMacro(seduta?.categorie, codici);

// Un atleta si vede se la SUA categoria sta nel gruppo: l'override se c'è,
// altrimenti quella dell'anno. Le fasce non sono un parametro facoltativo
// per comodità — senza di loro gli atleti senza override finiscono tutti
// fuori, e non lo dice nessuno.
export const atletaNelGruppo = (atleta, codici, fasce) =>
  !codici || codici.includes(categoriaAtleta(atleta, fasce));

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
  const t = apiciDritti(testo);
  const m = t.match(/(\d{1,2})[:.'](\d{2})/);
  if (m) return +m[1] * 60 + +m[2];
  const soli = t.match(/^(\d{1,3})$/);
  return soli ? +soli[1] : null;
};

const inTempo = (secondi) => {
  const s = Math.max(5, Math.round(secondi / 5) * 5);       // ai 5 secondi
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Restituisce { recupero, base } oppure null se non è una base.
export function ripartenzaDaBase(testo, notazione, suMetriPredefiniti = 100) {
  // "@@2:00" = base sui 100 · "@@0:35/25" = base sui 25
  const m = apiciDritti(testo).trim().match(/^@@\s*([^/]+?)(?:\s*\/\s*(\d{2,3}))?$/);
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
  const t = apiciDritti(testo).replace("@", "").trim();
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

// "Comune" senza leggere destinatari: una sezione vale per tutti se vale
// per OGNUNA delle specializzazioni del dominio. Così anche una sezione
// priva del campo — che destinatariDi tratta come [TUTTI] — risulta
// comune, e il vincolo di passare sempre da sezionePer resta rispettato.
//
// Qui SPECIALIZZAZIONI sta scritto per intero di proposito, e NON è
// l'elenco che durataStimata riceve: "comune" è una proprietà della
// sezione, non del gruppo che si sta guardando. Con un gruppo di soli
// ['Generale'], every() sull'elenco iniettato direbbe che una sezione
// destinata a Generale vale per tutti — ma quella è un ramo, e finirebbe
// contata fra le comuni in "di cui Nm' comuni".
const sezioneComune = (sez) => SPECIALIZZAZIONI.every((s) => sezionePer(sez, s));

// Quanto dura UNA sezione, da sola. Il lavoro a secco non ha tempi di
// partenza da cui dedurre niente: i minuti li scrive l'allenatore e
// valgono come sono. Le sue serie non entrano fra le "righe senza
// partenza" — sono a zero per costruzione, e segnalarle vorrebbe dire
// chiedere una ripartenza a dei piegamenti.
function durataDiSezione(sez) {
  if (eSecco(sez)) {
    const min = Number(sez.durataMin) || 0;
    return { secondi: min * 60, conPartenza: 0, senzaPartenza: 0, secca: min > 0 };
  }

  let secondi = 0;
  let conPartenza = 0;
  let senzaPartenza = 0;

  for (const s of sez.serie || []) {
    if (!s.metri && !s.senzaMetri) continue;
    // SUI TEMPI `moltiplicato` È UN FATTORE, non una didascalia.
    // Sui metri è il contrario (vedi il commento dei blocchi ripetuti
    // più sopra), e confondere i due significati costa in entrambi i
    // versi: qui la durata restava bassa — un blocco ×3 dava lo stesso
    // tempo della sezione piatta, 15' tanto per 2400 m quanto per 800
    // — mentre sui metri moltiplicare di nuovo li gonfierebbe.
    //
    // Il tempo non deriva dai metri: è ripartenza × ripetute. E le
    // ripetute di una figlia stanno metà nella notazione ("8x50" fa
    // otto partenze) e metà nel blocco che la contiene (tre giri):
    // 8 × 3 = 24 partenze da un minuto.
    const base = secondiDaRipartenza(s.recupero);
    if (base) {
      secondi += base * ripetizioniDa(s.notazione) * (Number(s.moltiplicato) || 1);
      conPartenza += 1;
    } else if (s.metri) {
      // `senzaPartenza` conta RIGHE da sistemare, non lavoro: alimenta
      // l'avviso in testa al riepilogo. Moltiplicarlo per il blocco lo
      // renderebbe illeggibile (una riga dentro un ×3 diventerebbe 3, o
      // 24 col fattore intero) senza dire niente di più. Se un giorno
      // dovrà dire QUANTO lavoro manca alla stima, si dice in metri o
      // in minuti, non in righe.
      senzaPartenza += 1;
    }
  }

  return { secondi, conPartenza, senzaPartenza, secca: false };
}

// LA DURATA DI UN RAMO: le sezioni comuni più quelle di quella
// specializzazione. Stessa forma di metriPerSpecializzazione, e per lo
// stesso motivo: si filtra con sezionePer, che è l'unico posto che sa
// cosa vuol dire "destinata a".
//
// `comuni` viaggia a parte perché la card lo mostra sotto il tempo ("di
// cui Nm' comuni"): serve a capire quanto di quel tempo è lavoro fatto
// insieme agli altri e quanto è suo.
export function durataPerSpecializzazione(sezioni, specializzazione) {
  let secondi = 0;
  let comuni = 0;
  let conPartenza = 0;
  let senzaPartenza = 0;
  let secche = 0;

  for (const sez of sezioni || []) {
    if (!sezionePer(sez, specializzazione)) continue;
    const d = durataDiSezione(sez);
    secondi += d.secondi;
    conPartenza += d.conPartenza;
    senzaPartenza += d.senzaPartenza;
    if (d.secca) secche += 1;
    if (sezioneComune(sez)) comuni += d.secondi;
  }

  return { secondi, comuni, conPartenza, senzaPartenza, sezioniSecche: secche };
}

// LA DURATA DELLA SEDUTA: comune + il ramo più lungo, NON la somma dei
// rami. Nessun atleta fa sia il lavoro dei velocisti sia quello dei
// fondisti — è la stessa regola che vale per i volumi, e che i tempi
// ignoravano: una seduta con due rami dava 57' dove se ne nuotano 45.
//
// Il massimo si prende sulle durate per ramo, che sono già comune + ramo
// per costruzione: ogni ramo include le sezioni comuni, il lavoro a
// secco compreso. Niente somma da bilanciare a mano, e un ramo in più
// domani non richiede di cambiare questo conto.
//
// `specializzazioni` si può restringere a quelle presenti fra gli atleti
// del gruppo: una sezione destinata a chi non c'è non deve allungare la
// durata di una seduta che nessuno nuoterà. Per difetto sono tutte, e un
// elenco vuoto o nullo vale come "tutte" — altrimenti il massimo
// resterebbe a zero e una seduta piena mostrerebbe durata zero, cosa che
// succede davvero: il riepilogo si disegna prima che la lista degli
// atleti sia arrivata.
export function durataStimata(sezioni, specializzazioni = SPECIALIZZAZIONI) {
  const lista = sezioni || [];
  const rami = (specializzazioni || []).length ? specializzazioni : SPECIALIZZAZIONI;

  let secondi = 0;
  for (const spec of rami) {
    const d = durataPerSpecializzazione(lista, spec);
    if (d.secondi > secondi) secondi = d.secondi;
  }

  // I CONTATORI guardano TUTTA la seduta, non il solo ramo più lungo:
  // sono righe da sistemare, non tempo. Una riga senza ripartenza fra i
  // velocisti va segnalata anche quando il ramo più lungo è un altro,
  // altrimenti l'avviso tace proprio sulle righe che nessuno ha visto.
  let conPartenza = 0;
  let senzaPartenza = 0;
  let sezioniSecche = 0;
  for (const sez of lista) {
    const d = durataDiSezione(sez);
    conPartenza += d.conPartenza;
    senzaPartenza += d.senzaPartenza;
    if (d.secca) sezioniSecche += 1;
  }

  return { secondi, conPartenza, senzaPartenza, sezioniSecche };
}

// ---------------------------------------------------------------------
// QUALI CARD MOSTRARE NEL RIEPILOGO
//
// Le card sono quelle degli atleti che hai in acqua, non le cinque del
// dominio: un gruppo di soli Esordienti non ha bisogno di quattro
// riquadri vuoti. Ma il lavoro scritto non deve sparire, e la lista degli
// atleti arriva dalla rete — quindi servono tre elenchi diversi, e il
// componente li combina.
// ---------------------------------------------------------------------

// STATO INIZIALE, senza rete: le specializzazioni che le SEZIONI citano.
// Generale entra solo se c'è almeno una sezione comune: su una seduta
// tutta divisa in rami, chi è Generale non nuota niente e una card sua
// sarebbe vuota. Senza questa condizione la card compariva per l'istante
// del caricamento e poi spariva.
export function specializzazioniDaSezioni(sezioni) {
  const viste = new Set();
  let comune = false;
  for (const sez of sezioni || []) {
    if (sezioneComune(sez)) { comune = true; continue; }   // il comune non cita nessuno
    for (const spec of SPECIALIZZAZIONI) {
      if (spec !== 'Generale' && sezionePer(sez, spec)) viste.add(spec);
    }
  }
  if (comune) viste.add('Generale');
  return SPECIALIZZAZIONI.filter((s) => viste.has(s));     // ordine del dominio
}

// Le specializzazioni presenti fra ATLETI dati. Campo vuoto, o un valore
// che il dominio non conosce, conta come Generale: è quello che fa già
// categoriaAtleta con le categorie, e serve a non perdere nessuno.
export function specializzazioniDiAtleti(atleti) {
  const viste = new Set();
  for (const a of atleti || []) {
    const s = a?.specializzazione;
    viste.add(SPECIALIZZAZIONI.includes(s) ? s : 'Generale');
  }
  return SPECIALIZZAZIONI.filter((s) => viste.has(s));
}

// Chi ha un LAVORO DEDICATO con metri: una sezione non comune, intestata a
// lui, che porta metri. È l'eccezione all'intersezione — una sezione
// "Velocisti" scritta e piena non sparisce dal riepilogo solo perché in
// gruppo non c'è nessun velocista.
//
// NON basta metriPerSpecializzazione > 0: quello somma anche le sezioni
// comuni, quindi con un riscaldamento per tutti sarebbe vero per tutte e
// cinque, e l'eccezione se le riporterebbe dentro in blocco — cioè
// l'opposto di quello che l'intersezione serve a fare.
export function specializzazioniConLavoroDedicato(sezioni) {
  const viste = new Set();
  for (const sez of sezioni || []) {
    if (sezioneComune(sez)) continue;
    const metri = (sez.serie || []).reduce((t, s) => t + (Number(s.metri) || 0), 0);
    if (metri <= 0) continue;                              // ramo scritto ma ancora vuoto
    for (const spec of SPECIALIZZAZIONI) {
      if (spec !== 'Generale' && sezionePer(sez, spec)) viste.add(spec);
    }
  }
  return SPECIALIZZAZIONI.filter((s) => viste.has(s));
}

// ---------------------------------------------------------------------
// NOTE DA MOSTRARE E NOTE DA NASCONDERE
//
// L'analizzatore appende alle note dei promemoria suoi, utili mentre si
// rilegge il testo appena importato e inutili su un foglio stampato:
// "somma letta: 200 m a giro" ripete un numero che è già nella colonna
// dei metri, e "controlla" invita a rivedere una riga che, quando il
// foglio arriva a bordo vasca, è già stata rivista.
//
// I prefissi stanno qui e non nell'analizzatore, che non si tocca:
// continua a scrivere quello che scrive, e le note in archivio non
// cambiano di un byte. Se un giorno cambiasse una dicitura, questa
// costante resterebbe muta — per questo prova_riepilogo.mjs verifica che
// le stringhe prodotte dall'analizzatore comincino davvero per questi
// prefissi.
//
// Restano visibili "una serie per stile" e "blocco aperto dalla riga
// scritta con più andature": dicono qualcosa sul lavoro, non sulla
// lettura.
export const NOTE_DA_NASCONDERE = [
  'somma letta:',
  'misura letta in mezzo alla riga: controlla',
  // "tratto non contato: 75 m dopo una ripetuta sola": dice come è stata
  // letta la riga, non come si nuota. Nel revisore serve — è il solo
  // posto dove si può dare torto alla lettura — sul foglio a bordo vasca
  // no: quei metri non si fanno, e il numero giusto è già in colonna.
  'tratto non contato:',
];

// La nota ripulita dai promemoria di lettura. Il separatore è " · ", lo
// stesso con cui analizzatore e import le impilano.
//
// SOLO IN STAMPA. Nel revisore le note vanno lasciate intere: è
// esattamente il posto dove "controlla" deve farsi vedere.
export function notaLeggibile(note) {
  return String(note || '')
    .split(' · ')
    .map((p) => p.trim())
    .filter((p) => p && !NOTE_DA_NASCONDERE.some(
      (pre) => p.toLowerCase().startsWith(pre.toLowerCase())))
    .join(' · ');
}

export function inOreMinuti(secondi) {
  const m = Math.round(secondi / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}'` : `${m}'`;
}
