// =====================================================================
// ANALIZZATORE DI SEDUTE SCRITTE A MANO LIBERA
//
// Tarato sulla notazione reale del coach, non su una grammatica teorica.
// Restituisce la stessa struttura dell'editor a corsie, con un semaforo
// su ogni riga: verde ho capito, giallo ho dedotto, rosso non ho capito.
//
// Nessuna intelligenza artificiale: dizionari e regole. Serve anche alla
// modalità "foto", che passa di qui dopo il riconoscimento del testo.
// =====================================================================

// --------------------------------------------------------- dizionari
const STILI = {
  stile: 'SL', sl: 'SL', libero: 'SL', crawl: 'SL',
  dorso: 'DO', do: 'DO',
  rana: 'RA', ra: 'RA',
  delfino: 'FA', df: 'FA', farfalla: 'FA', fa: 'FA',
  misto: 'MI', misti: 'MI', mx: 'MI',
};

const ATTREZZI = {
  pinne: 'pinne', pinnette: 'pinne', pinnone: 'pinnone', pinna: 'pinne',
  palette: 'palette', paletta: 'palette', pal: 'palette',
  pull: 'pull', tavola: 'tavola', tav: 'tavola',
  boccaglio: 'boccaglio', bocc: 'boccaglio',
  paracadute: 'paracadute', elastico: 'elastico', elastici: 'elastico',
  torpedo: 'torpedo', manichino: 'manichino', man: 'manichino',
  'palla medica': 'palla medica',
};

// Modalità di esecuzione: NON sono metri in più, sono come si nuota.
export const MODALITA = [
  [/(?<![a-z])ps(?![a-z])/i, 'proprio stile'],
  [/(?<![a-z])bn(?![a-z])/i, 'ben nuotato'],
  [/(?<![a-z])fp(?![a-z])/i, 'forte-piano'],
  [/(?<![a-z])pf(?![a-z])/i, 'piano-forte'],
  [/(?<![a-z])cp(?![a-z])/i, 'con partenza dal blocco'],
  [/\bcrono\w*/i, 'cronometrato'],
  [/\bregr\w*/i, 'regressione'],
  [/\bde\s+su(l)?\s+do\b/i, 'gambe delfino sul dorso'],
  [/(?<![a-z])c(?![a-z0-9.])/i, 'completo'],
  [/(?<![a-z])ff(?![a-z])/i, 'forte'],
  [/(?<![a-z])n(?![a-z])/i, 'normale'],
  [/\bc\.?\s?25\b/i, 'cambio al 25'],
  [/\bfraz\w*/i, 'frazionato'],
  [/\bprog\w*\s*(\d\/\d)?/i, 'progressione'],
  [/(?<![a-z])sub(?![a-z])/i, 'subacquea'],
  [/(?<![a-z])tc(?![a-z])/i, 'tecnica'],
  [/(?<![a-z])gb(?![a-z])/i, 'gambe'],
  [/\bipossia\b/i, 'ipossia'],
  [/\bsost\w*/i, 'sostenuto'],
];

export function trovaModalita(riga) {
  return MODALITA.filter(([re]) => re.test(riga)).map(([, nome]) => nome);
}

// Parole che indicano il tipo di lavoro → zona proposta
const ZONE_PAROLE = [
  [/\b(sciolto|scioltezza|defatic\w*|rigenerante)\b/i, 'A1'],
  [/\b(lento|fondo lento|ripristino|autogestit\w+)\b/i, 'A1'],
  [/\b(a2|medio|sostenut\w+|sost\b)/i, 'A2'],
  [/\b(soglia|b1)\b/i, 'B1'],
  [/\b(b2\+?|vo2|massimale|potenza aerobica)\b/i, 'B2'],
  [/\b(c1|tolleranza)\b/i, 'C1'],
  [/\b(c2|lattacid\w+)\b/i, 'C2'],
  [/\b(c3|max\b|massimo|sprint|scatt\w+|al max)\b/i, 'C3'],
  [/\b(tecnica|tc\b|esercizi\w*|es\b|drill)\b/i, 'A1'],
  [/(?<![a-z])f{2,3}(?![a-z])/i, 'C3'],                    // ff / fff = forte
  [/\bfraz\w*/i, 'B2'],                     // frazionato: ritmo gara
  [/\bcrono\w*/i, 'C3'],                    // cronometrato: C3 o D secondo il periodo
  [/(?<![a-z])bn(?![a-z])/i, 'A2'],                        // ben nuotato: andatura di lavoro
  [/\b(gambe|gb\b|braccia)\b/i, null],       // non decide la zona da sola
];

const ZONA_ESPLICITA = /\b(A1|A2|B1|B2\+?|C1|C2|C3|D)\b/;

// "1 serie x stile", "MX 1x", "1 serie x": è un DESCRITTORE, dice come
// sono distribuiti gli stili dentro la ripetuta — non moltiplica niente.
// Prima faceva ×4 e da 1000 metri ne usciva 4000. Deciso dal coach:
// i metri sono quelli scritti, punto.
export const PER_STILE = /\b(?:1\s*)?serie\s*x\s*stil\w*|\bmx\s*1x\b|\b1\s*serie\s*x\b/i;

// Intestazioni che indicano A CHI è rivolto il lavoro. "Centrale" vale
// per tutti; "Velocisti", "Mezzofondo", "Salvamento" restringono la
// sezione a quel gruppo, dentro le categorie scelte per la seduta.
export const DESTINATARI_TITOLO = [
  [/^\s*(velocist\w*|velocit[aà])\s*:?\s*$/i, ['Velocità']],
  [/^\s*(mezzofondist\w*|mezzofondo|fondo)\s*:?\s*$/i, ['Mezzofondo']],
  [/^\s*(salvament\w*|salvamentist\w*)\s*:?\s*$/i, ['Salvamento']],
  [/^\s*(velocist\w*\s*[e+/]\s*mezzofond\w*)\s*:?\s*$/i, ['Velocità', 'Mezzofondo']],
];

export function destinatariDaTitolo(riga) {
  for (const [re, chi] of DESTINATARI_TITOLO) if (re.test(riga)) return chi;
  return null;
}

// Lavoro a terra: sta nella seduta ma non fa metri.
export const A_SECCO = /\b(secco|palestra|plank|salti|elastic\w+|core|addominali|circuito a terra)\b/i;

// LA REGOLA DELLA VASCA
// Partenze, virate, scivolamenti: si scrivono con la distanza a cui si
// arriva ("2x10", "partendo dai 10m"), ma l'atleta la vasca la finisce
// comunque. Quindi qualsiasi tratto sotto i 25 vale 25: "2x10" fa 50,
// non 20. Deciso dal coach, agosto 2026.
const VASCA = 25;
const almenoUnaVasca = (d) => (d > 0 && d < VASCA ? VASCA : d);

// Righe che non sono metri: partenze, virate, esercizi a secco
const NON_METRI = /^\s*\d*\s*(partenz\w+|virat\w+|arriv\w+|tuffi?|esercizi\w*\s+(a vuoto|con elastic\w+|virate)|pausa|rec\b)/i;

// --------------------------------------------------------- utilità
const pulisci = (r) => r.replace(/\s+/g, ' ').trim();

// "Centrale A2", "Lavoro Centrale 1 C2", "Pale e Pinne C3": l'andatura
// scritta una volta sul titolo vale per tutto quello che c'è sotto,
// finché non cambia. Serve a non ripeterla riga per riga quando il
// blocco è tutto uguale.
function zonaDelTitolo(riga) {
  const m = riga.match(ZONA_ESPLICITA);
  if (!m) return { titolo: riga, zona: '' };
  return {
    titolo: pulisci(riga.replace(m[0], '')) || riga,
    zona: m[1].toUpperCase().replace('+', ''),
  };
}

// Riga fatta di sola zona: "C3", "B1", "A2 " → vale per quello che segue,
// non è il titolo di una sezione.
const SOLA_ZONA = /^\s*(A1|A2|B1|B2\+?|C1|C2|C3|D)\s*:?\s*$/i;

// Passo base: "@@1:30" su un 150 → @2:15. Stessa regola dell'editor.
function ripartenzaDaBase(riga, distanza) {
  const m = riga.match(/@@\s*(\d{1,2})[:.'](\d{2})/);
  if (!m || !distanza) return null;
  const base = +m[1] * 60 + +m[2];
  const totale = Math.max(5, Math.round((base * distanza / 100) / 5) * 5);
  return `@${Math.floor(totale / 60)}:${String(totale % 60).padStart(2, '0')}`;
}

function trovaRecupero(riga) {
  // @1:30 · @0:50 · @1.40 · @1'40" · @3' (tre minuti) · rec 3' · rec 5 min
  let m = riga.match(/@\s*(\d{1,2})[:.'](\d{2})"?/);
  if (m) return `@${m[1]}:${m[2]}`;
  m = riga.match(/@\s*(\d{1,2})\s*'(?!\d)/);          // l'apice segna i minuti
  if (m) return `@${m[1]}:00`;
  m = riga.match(/@\s*(\d{1,3})"?(?!\d)/);
  if (m) return `@0:${String(m[1]).padStart(2, '0')}`;
  m = riga.match(/\brec\.?\s*(\d{1,2})\s*(?:'|min|m\b)/i);
  if (m) return `rec ${m[1]}'`;
  m = riga.match(/\brec\.?\s*(\d{1,3})\s*"/);
  if (m) return `rec ${m[1]}"`;
  return '';
}

function trovaStile(riga) {
  const t = riga.toLowerCase();
  for (const [parola, codice] of Object.entries(STILI)) {
    if (new RegExp(`\\b${parola}\\b`).test(t)) return codice;
  }
  return null;
}

function trovaAttrezzi(riga) {
  const t = riga.toLowerCase();
  const out = new Set();
  for (const [parola, nome] of Object.entries(ATTREZZI)) {
    if (new RegExp(`\\b${parola}\\b`).test(t)) out.add(nome);
  }
  return [...out];
}

function trovaZona(riga) {
  const esplicita = riga.match(ZONA_ESPLICITA);
  if (esplicita) return { zona: esplicita[1].replace('+', ''), sicura: true };
  for (const [re, zona] of ZONE_PAROLE) {
    if (zona && re.test(riga)) return { zona, sicura: false };
  }
  return { zona: '', sicura: false };
}

// Dentro le parentesi: "4x25 + 1x100" = 200, "200+2x100+4x50" = 600.
// Ogni pezzo dev'essere SOLO un numero o SOLO NxD, niente altro: così
// "(50 resp 5-3 7-3)" e "(1GB max sub 1Dx 1Sx 1c)" restano quello che
// sono — una nota — e non diventano metri.
function sommaGruppo(dentro) {
  let somma = 0;
  for (const pezzo of dentro.split('+')) {
    const p = pezzo.trim();
    let m = p.match(/^(\d{1,3})\s*x\s*(\d{2,4})$/i);
    if (m) { somma += +m[1] * almenoUnaVasca(+m[2]); continue; }
    m = p.match(/^(\d{2,4})$/);
    if (m) somma += +m[1];
  }
  return somma;
}

// Divide su "+" di primo livello: quello dentro le parentesi resta
// dov'è. "4x(150 + 4x25) 150SL" è UN pezzo, non due.
function pezziDiPrimoLivello(t) {
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
function misuraInTesta(pezzo) {
  const p = pezzo.trim();
  let m = p.match(/^(\d{1,3})\s*x\s*\(([^)]+)\)/i);
  if (m) {
    const s = sommaGruppo(m[2]);
    if (s) return { metri: +m[1] * s, resto: p.slice(m[0].length).trim(), gruppo: true };
  }
  m = p.match(/^\(([^)]+)\)/);
  if (m) {
    const s = sommaGruppo(m[1]);
    if (s) return { metri: s, resto: p.slice(m[0].length).trim(), gruppo: true };
  }
  m = p.match(/^(\d{1,3})\s*x\s*(\d{2,4})\b(?!\s*[x×])/i);
  if (m) return { metri: +m[1] * almenoUnaVasca(+m[2]), resto: p.slice(m[0].length).trim() };
  m = p.match(/^(\d{2,4})\b/);
  if (m) return { metri: +m[1], resto: p.slice(m[0].length).trim(), secco: true };
  return null;
}

// Somma i pezzi finché sono misure: "(3x25) + (1x75) Remate SL" = 150.
// Si ferma al primo pezzo che misura non è, perché da lì in poi la riga
// racconta com'è fatta la ripetuta e non aggiunge vasche.
function sommaInTesta(riga) {
  let totale = 0;
  let quanti = 0;
  let gruppo = false;
  for (const pezzo of pezziDiPrimoLivello(riga)) {
    const m = misuraInTesta(pezzo);
    if (!m) break;
    // Un numero secco con del testo dietro è quasi sempre descrizione
    // ("+ 25 remate"), non un tratto in più.
    if (m.secco && m.resto) break;
    totale += m.metri;
    quanti++;
    if (m.gruppo) gruppo = true;
    if (m.resto) break;
  }
  return { totale, quanti, gruppo };
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

// I tempi non sono distanze: "1'40", '45"', "@1:30" vanno tolti prima di
// cercare le misure, o un recupero passa per una vasca.
const senzaTempi = (t) => t
  .replace(/@+\s*\d{1,2}\s*[:.']\s*\d{2}/g, ' ')
  .replace(/@+\s*\d{1,3}\s*["']?/g, ' ')
  .replace(/\d{1,2}\s*'\s*\d{2}/g, ' ')
  .replace(/\d{1,3}\s*"/g, ' ');

// Ripetizioni e distanza: "12x75", "6x100", "4x", "300", "2x50",
// "2x(4x25 + 1x100)", e anche "PS 12x25 progr 1-4" — cioè la misura
// scritta DOPO il lavoro, che è come scrive il coach nel foglio.
function trovaMisure(riga) {
  const t = riga.replace(/[×*]/g, 'x');

  // 1. Somme e gruppi in testa alla riga: "3x25 + 1x75 Remate DO",
  // "(3x25) + (1x75)", "4x(150 + 4x25) 150SL". Vale solo se i pezzi sono
  // più d'uno o se ci sono parentesi — se no ci pensano le regole sotto,
  // che tengono ripetizioni e distanza separate.
  const somma = sommaInTesta(t);
  if (somma.totale > 0 && (somma.quanti > 1 || somma.gruppo)) {
    return { ripetizioni: 1, distanza: somma.totale, gruppo: somma.gruppo, somma: somma.quanti > 1 };
  }

  // 1b. La stessa somma, ma cercata a partire da destra: è dove il coach
  // mette il set quando a sinistra ha scritto com'è fatto il lavoro.
  const coda = sommaInCoda(t);
  if (coda.totale > 0) {
    return { ripetizioni: 1, distanza: coda.totale, gruppo: coda.gruppo, somma: coda.quanti > 1 };
  }

  // 2. La misura in testa alla riga: il caso sicuro.
  let m = t.match(/^\s*(\d{1,3})\s*x\s*(\d{2,4})\b/i);
  if (m) return { ripetizioni: +m[1], distanza: +m[2] };

  // 2. "4x", "6x (gio 4 volte)", "4 volte:", e anche "4x A2" — la zona
  // scritta sull'apertura vale per tutto il blocco.
  m = t.match(/^\s*(\d{1,3})\s*x\s*(?:volte?\s*)?(?:\(.*\))?\s*(A1|A2|B1|B2\+?|C1|C2|C3|D)?\s*:?\s*$/i);
  if (m && !/\(\s*\d/.test(t)) {
    return { moltiplicatore: +m[1], zonaBlocco: m[2] ? m[2].toUpperCase().replace('+', '') : null };
  }

  // 3. Un gruppo fra parentesi, con o senza il moltiplicatore davanti:
  // "2x(4x25 + 1x100)" = 400, "(2x50+4x25)" da solo = 200 (il 3x della
  // riga sopra ci si moltiplica dopo).
  m = t.match(/^\s*(\d{2,4})\b/);                  // "300 stile"
  if (m) return { ripetizioni: 1, distanza: +m[1] };

  // 4. Ultima spiaggia: NxD in mezzo alla riga. È il modo in cui scrivi
  // tu — prima il lavoro, poi la misura — quindi va letto, ma resta
  // giallo in revisione perché qui è più facile prendere un abbaglio.
  // Se ce n'è più d'uno si prende l'ULTIMO: nel foglio la descrizione sta
  // a sinistra e il set a destra, quindi la misura vera è quella in fondo.
  // "(?!\s*x)" evita di leggere "1x 10" dentro "1x 10x100": la misura
  // vera è quella in fondo, non la prima metà di un numero spezzato.
  const trovati = [...senzaTempi(t).matchAll(/(?<![\d,.])(\d{1,3})\s*x\s*(\d{2,4})(?![\d])(?!\s*[x×])/gi)];
  if (trovati.length) {
    const ultimo = trovati[trovati.length - 1];
    return { ripetizioni: +ultimo[1], distanza: +ultimo[2], dedotta: true };
  }

  return null;
}

// --------------------------------------------------------- il cuore
export function analizzaTesto(testo) {
  const righe = String(testo || '').split('\n');
  const sezioni = [];
  let sezione = null;
  let gruppo = null;          // blocco aperto da "4x"
  let moltiplicatoreAttivo = 1;
  let zonaCorrente = '';        // dichiarata da una riga di sola zona
  const avvisi = [];

  const nuovaSezione = (titolo, destinatari = ['*']) => {
    sezione = { titolo, destinatari, serie: [] };
    sezioni.push(sezione);
    return sezione;
  };

  const chiudiGruppo = () => {
    if (!gruppo) return;
    // I sotto-elementi che sommano esattamente la distanza del padre ne
    // sono la composizione: non aggiungono metri, la descrivono.
    if (gruppo.padre) {
      const somma = gruppo.figli.reduce((t, f) => t + f.metri, 0);
      const attesa = gruppo.padre.distanza;
      if (somma === attesa) {
        gruppo.padre.serie.descrizione = gruppo.figli.map((f) => f.testo).join(' · ');
        gruppo.figli.forEach((f) => { f.serie.metri = 0; f.serie.composizione = true; });
        gruppo.padre.serie.fiducia = 'verde';
      }
    }
    gruppo = null;
  };

  for (const grezza of righe) {
    let riga = pulisci(grezza);

    if (!riga) { chiudiGruppo(); moltiplicatoreAttivo = 1; continue; }

    // "C3" da solo: da qui in avanti il lavoro è C3, finché non cambia.
    const soloZona = riga.match(SOLA_ZONA);
    if (soloZona) {
      // Vale come zona per quello che segue e, siccome tu la usi per
      // separare i blocchi, apre anche una sezione con quel nome.
      chiudiGruppo();
      zonaCorrente = soloZona[1].toUpperCase().replace('+', '');
      moltiplicatoreAttivo = 1;
      nuovaSezione(zonaCorrente);
      continue;
    }

    // "Velocisti", "Mezzofondo", "Salvamento": da qui il lavoro è loro.
    const chi = destinatariDaTitolo(riga);
    if (chi) {
      chiudiGruppo();
      moltiplicatoreAttivo = 1;
      const s = nuovaSezione(riga.replace(':', '').trim(), chi);
      if (zonaCorrente) s.zonaEreditata = zonaCorrente;
      continue;
    }

    // Intestazioni di sezione o di gruppo
    if (/^\[main\]$/i.test(riga)) { chiudiGruppo(); nuovaSezione('Parte centrale'); continue; }
    // "Riscaldamento 1x400" è due cose insieme: apre la sezione E vale
    // 400 metri. Prima il titolo si mangiava il set e restava zero.
    if (/^(riscaldamento|warm ?up|wu)\b/i.test(riga)) {
      chiudiGruppo();
      nuovaSezione('Riscaldamento');
      const resto = riga.replace(/^(riscaldamento|warm ?up|wu)\b[\s:\-]*/i, '').trim();
      if (!resto || !trovaMisure(resto)) continue;
      riga = resto;
    } else
    if (/^(sciolto|defaticamento|cool ?down)\b/i.test(riga) && !/\d/.test(riga)) {
      chiudiGruppo(); nuovaSezione('Sciolto'); continue;
    }
    if (/^(lc|lavoro centrale|parte centrale|centrale|pregara)\b/i.test(riga)) {
      chiudiGruppo();
      moltiplicatoreAttivo = 1;
      const { titolo, zona } = zonaDelTitolo(riga.replace(':', ''));
      const s = nuovaSezione(titolo);
      if (zona) { zonaCorrente = zona; s.zonaEreditata = zona; }
      continue;
    }
    // "Garetto:", "Edo/teo", "Salvamento:" → destinatari particolari
    if (/^[A-ZÀ-Ù][\wÀ-ù/ ]{1,24}:?$/.test(riga) && !trovaMisure(riga) && !SOLA_ZONA.test(riga)) {
      chiudiGruppo();
      moltiplicatoreAttivo = 1;
      const { titolo, zona } = zonaDelTitolo(riga.replace(':', ''));
      const s = nuovaSezione(titolo);
      if (zona) { zonaCorrente = zona; s.zonaEreditata = zona; }
      s.particolare = true;
      continue;
    }
    // Data o giorno: è l'intestazione della seduta, non una serie
    if (/^(lun|mar|mer|gio|ven|sab|dom)\w*\b/i.test(riga) && !/x\s*\d/.test(riga)) {
      chiudiGruppo();
      avvisi.push({ tipo: 'giorno', riga });
      continue;
    }

    if (!sezione) nuovaSezione('Riscaldamento');

    // Righe senza metri: partenze, virate, esercizi a secco
    // Il lavoro a secco resta a zero sempre. Partenze e virate no: se
    // c'è una misura scritta l'atleta in acqua ci va, e con la regola
    // della vasca "Virate partendo dai 10m 8x25" fa 200, non zero.
    if (A_SECCO.test(riga) || (NON_METRI.test(riga) && !trovaMisure(riga))) {
      sezione.serie.push({
        notazione: riga, metri: 0, zona: '', recupero: trovaRecupero(riga),
        senzaMetri: true, fiducia: 'gialla',
      });
      continue;
    }

    const misure = trovaMisure(riga);

    if (misure?.moltiplicatore) {
      chiudiGruppo();
      moltiplicatoreAttivo = misure.moltiplicatore;
      // "4x A2": la zona scritta qui vale per tutte le righe del blocco.
      const zonaBlocco = trovaZona(riga);
      if (zonaBlocco.zona) zonaCorrente = zonaBlocco.zona;
      if (misure.zonaBlocco) zonaCorrente = misure.zonaBlocco;
      gruppo = { moltiplicatore: misure.moltiplicatore, figli: [], padre: null };
      sezione.serie.push({
        notazione: riga, metri: 0, zona: misure.zonaBlocco || '', senzaMetri: true,
        apreBlocco: misure.moltiplicatore, fiducia: 'verde',
      });
      continue;
    }

    if (!misure) {
      // Nessun numero: è una descrizione della riga precedente
      const ultima = sezione.serie[sezione.serie.length - 1];
      if (ultima) {
        ultima.note = [ultima.note, riga].filter(Boolean).join(' · ');
      } else {
        sezione.serie.push({ notazione: riga, metri: 0, zona: '', fiducia: 'rossa' });
      }
      continue;
    }

    // Somma di tutti i tratti scritti sulla riga: "25 x 25 y 25 z 25 w" = 100.
    const tratti = [...riga.replace(/\([^)]*\)/g, ' ').matchAll(/\b(\d{2,4})/g)]   // "25gb" conta come 25
      .map((x) => +x[1])
      .filter((n) => n >= 25 && n <= 1500 && n % 25 === 0);
    const sommaTratti = tratti.reduce((a, b) => a + b, 0);

    const { ripetizioni, distanza } = misure;
    const metriRiga = ripetizioni * almenoUnaVasca(distanza);
    let { zona, sicura } = trovaZona(riga);
    if (!zona && zonaCorrente) { zona = zonaCorrente; sicura = true; }
    const serie = {
      notazione: riga,
      metri: metriRiga,
      zona,
      recupero: ripartenzaDaBase(riga, distanza) || trovaRecupero(riga),
      passoBase: /@@/.test(riga) || undefined,
      stile: trovaStile(riga),
      attrezzi: trovaAttrezzi(riga),
      modalita: trovaModalita(riga),
      perStile: PER_STILE.test(riga) || undefined,
      fiducia: zona ? (sicura ? 'verde' : 'gialla') : 'gialla',
    };
    if (misure.gruppo || misure.somma) {
      serie.note = [serie.note, `somma letta: ${misure.distanza} m a giro`].filter(Boolean).join(' · ');
    }
    if (misure.dedotta) {
      serie.fiducia = 'gialla';
      serie.note = [serie.note, 'misura letta in mezzo alla riga: controlla'].filter(Boolean).join(' · ');
    }
    if (serie.perStile) {
      serie.note = [serie.note, 'una serie per stile'].filter(Boolean).join(' · ');
    }
    serie.metri = metriRiga * moltiplicatoreAttivo;
    if (moltiplicatoreAttivo > 1) serie.moltiplicato = moltiplicatoreAttivo;
    sezione.serie.push(serie);

    if (gruppo) {
      // Per la composizione vale la somma dei tratti, non il primo numero.
      const perComposizione = ripetizioni === 1 ? sommaTratti : metriRiga;
      gruppo.figli.push({ metri: perComposizione, testo: riga, serie });
    }

    // Un "NxD" apre a sua volta un possibile blocco di composizione
    if (ripetizioni > 1) {
      chiudiGruppo();
      gruppo = { moltiplicatore: 1, figli: [], padre: { distanza, serie }, inizio: sezione.serie.length };
    }
  }
  chiudiGruppo();

  const metri = sezioni.reduce((t, s) => t + s.serie.reduce((x, r) => x + (r.metri || 0), 0), 0);

  return {
    sezioni,
    metri,
    avvisi,
    daRivedere: sezioni.flatMap((s) => s.serie.filter((r) => r.fiducia !== 'verde')).length,
  };
}

export default analizzaTesto;
