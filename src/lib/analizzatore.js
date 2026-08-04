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

// "1 serie x stile", "MX 1x", "1 serie x": la serie si ripete per ogni
// stile. Quattro di norma, ma se gli stili sono tre il conto cambia:
// resta gialla, la confermi in revisione.
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
    let m = p.match(/^(\d{1,3})\s*x\s*(\d{2,4})$/);
    if (m) { somma += +m[1] * +m[2]; continue; }
    m = p.match(/^(\d{2,4})$/);
    if (m) somma += +m[1];
  }
  return somma;
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

  // 1. La misura in testa alla riga: il caso sicuro.
  let m = t.match(/^\s*(\d{1,3})\s*x\s*(\d{2,4})\b/);
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
  m = t.match(/(?:(\d{1,3})\s*x\s*)?\(([^)]+)\)/);
  if (m) {
    const somma = sommaGruppo(m[2]);
    if (somma > 0) {
      return { ripetizioni: m[1] ? +m[1] : 1, distanza: somma, gruppo: true, dedotta: !m[1] ? false : false };
    }
  }

  m = t.match(/^\s*(\d{2,4})\b/);                  // "300 stile"
  if (m) return { ripetizioni: 1, distanza: +m[1] };

  // 4. Ultima spiaggia: NxD in mezzo alla riga. È il modo in cui scrivi
  // tu — prima il lavoro, poi la misura — quindi va letto, ma resta
  // giallo in revisione perché qui è più facile prendere un abbaglio.
  // Se ce n'è più d'uno si prende l'ULTIMO: nel foglio la descrizione sta
  // a sinistra e il set a destra, quindi la misura vera è quella in fondo.
  const trovati = [...senzaTempi(t).matchAll(/(?<![\d,.])(\d{1,3})\s*x\s*(\d{2,4})(?![\d])/g)];
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
    const riga = pulisci(grezza);

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
    if (/^(riscaldamento|warm ?up|wu)\b/i.test(riga)) { chiudiGruppo(); nuovaSezione('Riscaldamento'); continue; }
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
    if (NON_METRI.test(riga) || A_SECCO.test(riga)) {
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
    const metriRiga = ripetizioni * distanza;
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
      perStile: PER_STILE.test(riga) ? 4 : null,
      fiducia: zona ? (sicura ? 'verde' : 'gialla') : 'gialla',
    };
    if (misure.gruppo) {
      serie.note = [serie.note, `gruppo fra parentesi: ${misure.distanza} m a giro`].filter(Boolean).join(' · ');
    }
    if (misure.dedotta) {
      serie.fiducia = 'gialla';
      serie.note = [serie.note, 'misura letta in mezzo alla riga: controlla'].filter(Boolean).join(' · ');
    }
    if (serie.perStile) {
      serie.fiducia = 'gialla';
      serie.note = [serie.note, 'una serie per stile: metri × 4, controlla quanti stili'].filter(Boolean).join(' · ');
    }
    serie.metri = metriRiga * moltiplicatoreAttivo * (serie.perStile || 1);
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
