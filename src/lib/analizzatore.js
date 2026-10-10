// L'estensione serve: prova_analizzatore.mjs esegue questo file con node
// diretto, e node non risolve gli import senza. Vite se ne infischia.
// Il lettore di una riga vive in dominio.js, insieme a metriDaNotazione:
// l'arco di import va solo in questo verso, e di cicli non ce n'è.
import {
  leggiRiga, pezziDiPrimoLivello, gruppoInTesta, valoreDelPezzo, apiciDritti,
} from './dominio.js';

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
// per tutti; "Velocisti", "Mezzofondo", "Fondo", "Salvamento" restringono
// la sezione a quel gruppo, dentro le categorie scelte per la seduta.
//
// "fondo" stava fra le scritture del Mezzofondo finché il Fondo non era
// una specializzazione a sé (026). Ora sono due gruppi diversi e due
// regole diverse: mandare quei metri all'uno invece che all'altro darebbe
// un totale plausibile e falso. La trappola è che "mezzofondo" contiene
// "fondo" — quello che le tiene separate è l'ancoraggio ^...$, non
// l'ordine in cui stanno qui sotto.
export const DESTINATARI_TITOLO = [
  [/^\s*(velocist\w*|velocit[aà])\s*:?\s*$/i, ['Velocità']],
  [/^\s*(mezzofondist\w*|mezzofondo)\s*:?\s*$/i, ['Mezzofondo']],
  [/^\s*(fondist\w*|fondo)\s*:?\s*$/i, ['Fondo']],
  [/^\s*(salvament\w*|salvamentist\w*)\s*:?\s*$/i, ['Salvamento']],
  [/^\s*(velocist\w*\s*[e+/]\s*mezzofond\w*)\s*:?\s*$/i, ['Velocità', 'Mezzofondo']],
];

export function destinatariDaTitolo(riga) {
  for (const [re, chi] of DESTINATARI_TITOLO) if (re.test(riga)) return chi;
  return null;
}

// Zona proposta dal titolo della sezione: riempie solo le righe che sotto
// non hanno detto niente di loro (né zona scritta, né zona ereditata da
// una riga "sola zona" sopra). Resta un'ipotesi, non una lettura: chi la
// usa deve tenerla in fiducia gialla, mai verde.
//
// "Aerobico" da solo propone A2: indica lavoro aerobico medio.
//
// "velocit[aà]" non chiude con \b: in JavaScript \b si appoggia a \w, che
// non include le lettere accentate, quindi una parola che finisce sulla
// "à" non ha mai un confine di parola dopo — /\bvelocit[aà]\b/ su
// "Velocità" non scattava mai, in silenzio. Il lookahead sotto fa lo
// stesso lavoro di \b senza appoggiarsi a \w.
const ZONA_DA_TITOLO = [
  [/\b(riscaldamento|warm ?up|riscaldo)\b/i, 'A1'],
  [/\b(defaticamento|sciolto|ripristino)\b/i, 'A1'],
  [/\b(aerobico|medio)\b/i, 'A2'],
  [/\bsoglia\b/i, 'B1'],
  [/\b(vo2\w*|massimo consumo)\b/i, 'B2'],
  [/\btolleranza\b/i, 'C1'],
  [/\bpotenza\b/i, 'C2'],
  [/\b(velocit[aà]|sprint)(?![a-zà-öø-ÿ])/i, 'C3'],
];

export function zonaDaTitolo(titolo) {
  for (const [re, zona] of ZONA_DA_TITOLO) if (re.test(titolo || '')) return zona;
  return null;
}

// Lavoro a terra: sta nella seduta ma non fa metri.
export const A_SECCO = /\b(secco|palestra|plank|salti|elastic\w+|core|addominali|circuito a terra)\b/i;

// Lo stesso lavoro a terra, ma scritto come TITOLO di sezione: da lì in
// giù è tutto a secco, riga per riga, senza metri e senza zona. Prima
// A_SECCO si testava solo sulla singola riga, quindi "Palestra" apriva
// una sezione qualunque e "4x12 ripetizioni" sotto faceva 100 metri —
// 4×12 con la regola della vasca che porta il 12 a 25. Lavoro a terra
// contato come nuotato: il tipo di numero che sembra giusto e non lo è.
//
// Il titolo decide una volta sola, in lettura. Poi il campo `aSecco`
// sulla sezione se lo porta dietro salvato: rinominare la sezione non
// deve far rientrare i metri di soppiatto.
export const TITOLO_A_SECCO =
  /^\s*(lavoro\s+a\s+secco|a\s+secco|secco|palestra|dry\s*-?\s*land|pre\s*-?\s*vasca)\s*:?\s*$/i;


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
  const m = apiciDritti(riga).match(/@@\s*(\d{1,2})[:.'](\d{2})/);
  if (!m || !distanza) return null;
  const base = +m[1] * 60 + +m[2];
  const totale = Math.max(5, Math.round((base * distanza / 100) / 5) * 5);
  return `@${Math.floor(totale / 60)}:${String(totale % 60).padStart(2, '0')}`;
}

function trovaRecupero(testo) {
  // @1:30 · @0:50 · @1.40 · @1'40" · @3' (tre minuti) · rec 3' · rec 5 min
  const riga = apiciDritti(testo);
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




// ---------------------------------------------------- più andature
// UNA RIGA, UNA ANDATURA.
//
// "8x50 B1 + 4x50 B2" è un pezzo solo per come si scrive, ma sono due
// lavori diversi: una riga sola dovrebbe portare due zone insieme, e non
// può — vince la prima e i metri della seconda si perdono in silenzio.
// Quindi la riga si apre in due righe, una per andatura.
//
// Col moltiplicatore davanti si tiene il blocco, esattamente come lo
// scriveresti a mano:
//     4x(8x50 B1 + 4x50 B2)   ->   4x
//                                  8x50 B1
//                                  4x50 B2
//
// Si spezza SOLO quando le andature scritte sono almeno due e diverse.
// "2x(4x50 SL + 100 B1)" ha una zona sola e resta una riga: lì il "+" è
// la composizione della ripetuta, non due lavori.
const ZONA_DEL_PEZZO = /\b(A1|A2|B1|B2\+?|C1|C2|C3|D)\b/i;

function righeConAndature(riga) {
  const t = riga.replace(/[×*]/g, 'x').trim();

  // Il blocco fra parentesi vale per intero: "4x(...)" e nient'altro
  // dietro, se non il recupero. Se dopo la chiusa c'è altro testo la riga
  // sta descrivendo qualcosa e non la si tocca.
  let moltiplicatore = 1;
  let dentro = t;
  const g = gruppoInTesta(t);
  if (g) {
    const dopo = apiciDritti(g.resto).replace(/@+\s*\d{1,2}\s*[:.']\s*\d{2}"?/g, ' ')
      .replace(/@+\s*\d{1,3}\s*["']?/g, ' ')
      .trim();
    if (dopo) return null;
    moltiplicatore = g.moltiplicatore;
    dentro = g.dentro;
  }

  const pezzi = pezziDiPrimoLivello(dentro)
    .map((p) => p.trim())
    .filter(Boolean);
  if (pezzi.length < 2) return null;

  const lette = [];
  const zone = new Set();
  for (const pezzo of pezzi) {
    const metri = valoreDelPezzo(pezzo);
    if (!metri) return null;                 // un pezzo non letto: meglio non spezzare
    const z = pezzo.match(ZONA_DEL_PEZZO);
    const zona = z ? z[1].toUpperCase().replace('+', '') : '';
    if (zona) zone.add(zona);
    lette.push({ testo: pezzo, metri, zona });
  }

  // Una zona sola (o nessuna): la riga resta com'è.
  if (zone.size < 2) return null;
  // E almeno due pezzi devono averla scritta davvero.
  if (lette.filter((p) => p.zona).length < 2) return null;

  return { moltiplicatore, pezzi: lette };
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

  // UNA SEZIONE NUOVA COMINCIA SENZA MOLTIPLICATORE.
  //
  // L'azzeramento sta qui, e non nei rami che aprono le sezioni, perché
  // di rami ce ne sono otto e la riga era stata scritta solo in cinque:
  // "Riscaldamento", "Sciolto"/"defaticamento" e "[main]" non la
  // avevano, e un "3x" scritto sopra continuava a moltiplicare il lavoro
  // della sezione dopo. Scrivendo
  //
  //     3x / 8x50 B1 / Sciolto / 200
  //
  // senza riga vuota prima del titolo, i 200 dello sciolto diventavano
  // 600. La riga vuota azzerava (vedi sotto), il titolo no: due strade
  // per la stessa cosa, e una sola funzionava.
  //
  // Qui ci passano tutti e otto, compreso il ramo che apre la sezione
  // implicita a inizio testo. Un ramo aggiunto domani non può
  // dimenticarsene.
  const nuovaSezione = (titolo, destinatari = ['*'], aSecco = false) => {
    moltiplicatoreAttivo = 1;
    sezione = { titolo, destinatari, serie: [] };
    if (aSecco) { sezione.aSecco = true; sezione.durataMin = 20; }
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
      nuovaSezione(zonaCorrente);
      continue;
    }

    // "Palestra", "Dryland", "Pre-vasca": da qui in giù si lavora a terra.
    // Prima delle altre intestazioni, altrimenti "Palestra" finisce fra i
    // destinatari particolari e le sue righe tornano a fare metri.
    if (TITOLO_A_SECCO.test(riga)) {
      chiudiGruppo();
      nuovaSezione(riga.replace(':', '').trim(), ['*'], true);
      continue;
    }

    // "Velocisti", "Mezzofondo", "Salvamento": da qui il lavoro è loro.
    const chi = destinatariDaTitolo(riga);
    if (chi) {
      chiudiGruppo();
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
      if (!resto || !leggiRiga(resto)) continue;
      riga = resto;
    } else
    if (/^(sciolto|defaticamento|cool ?down)\b/i.test(riga) && !/\d/.test(riga)) {
      chiudiGruppo(); nuovaSezione('Sciolto'); continue;
    }
    if (/^(lc|lavoro centrale|parte centrale|centrale|pregara)\b/i.test(riga)) {
      chiudiGruppo();
      const { titolo, zona } = zonaDelTitolo(riga.replace(':', ''));
      const s = nuovaSezione(titolo);
      if (zona) { zonaCorrente = zona; s.zonaEreditata = zona; }
      continue;
    }
    // "Garetto:", "Edo/teo", "Salvamento:" → destinatari particolari
    if (/^[A-ZÀ-Ù][\wÀ-ù/ ]{1,24}:?$/.test(riga) && !leggiRiga(riga) && !SOLA_ZONA.test(riga)) {
      chiudiGruppo();
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

    // Dentro una sezione a secco non si contano metri, punto: qualunque
    // riga vale come lavoro a terra, anche se è scritta con le x e i
    // numeri di una serie in acqua ("4x12 ripetizioni").
    if (sezione.aSecco) {
      sezione.serie.push({
        notazione: riga, metri: 0, zona: '', recupero: trovaRecupero(riga),
        senzaMetri: true, fiducia: 'gialla',
      });
      continue;
    }

    // Righe senza metri: partenze, virate, esercizi a secco
    // Il lavoro a secco resta a zero sempre. Partenze e virate no: se
    // c'è una misura scritta l'atleta in acqua ci va, e con la regola
    // della vasca "Virate partendo dai 10m 8x25" fa 200, non zero.
    if (A_SECCO.test(riga) || (NON_METRI.test(riga) && !leggiRiga(riga))) {
      sezione.serie.push({
        notazione: riga, metri: 0, zona: '', recupero: trovaRecupero(riga),
        senzaMetri: true, fiducia: 'gialla',
      });
      continue;
    }

    // Due andature sulla stessa riga: si apre in due righe (più il
    // "4x" davanti, se il blocco ce l'ha). I metri restano gli stessi.
    const spezzata = righeConAndature(riga);
    if (spezzata) {
      chiudiGruppo();
      moltiplicatoreAttivo = 1;      // la parentesi chiude il blocco qui
      const molt = spezzata.moltiplicatore;
      if (molt > 1) {
        sezione.serie.push({
          notazione: `${molt}x`,
          metri: 0,
          zona: '',
          senzaMetri: true,
          apreBlocco: molt,
          fiducia: 'verde',
          note: 'blocco aperto dalla riga scritta con più andature',
        });
      }
      for (const p of spezzata.pezzi) {
        const suoi = leggiRiga(p.testo);
        // Stessa scala di certezza del ciclo principale: solo la zona
        // scritta sul pezzo è "sicura". Quella ereditata o proposta dal
        // titolo resta un'ipotesi — la riga finisce comunque gialla.
        const sicura = !!p.zona;
        let zona = p.zona || zonaCorrente || '';
        if (!zona) zona = zonaDaTitolo(sezione.titolo) || '';
        sezione.serie.push({
          notazione: p.testo,
          metri: p.metri * molt,
          zona,
          recupero: ripartenzaDaBase(p.testo, suoi?.distanza) || trovaRecupero(p.testo),
          passoBase: /@@/.test(p.testo) || undefined,
          stile: trovaStile(p.testo),
          attrezzi: trovaAttrezzi(p.testo),
          modalita: trovaModalita(p.testo),
          moltiplicato: molt > 1 ? molt : undefined,
          fiducia: sicura ? 'verde' : 'gialla',
        });
      }
      continue;
    }

    const misure = leggiRiga(riga);

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

    // ripetizioni serve ancora qui sotto: alla composizione (un 1xD
    // conta la somma dei tratti) e al blocco che un NxD apre.
    const { ripetizioni, distanza } = misure;
    const metriRiga = misure.metri;
    let { zona, sicura } = trovaZona(riga);
    if (!zona && zonaCorrente) { zona = zonaCorrente; sicura = true; }
    // Ultima spiaggia: il titolo della sezione. Non è una lettura sicura
    // quanto le due sopra, quindi "sicura" resta com'è — la riga finisce
    // comunque in fiducia gialla, mai verde.
    if (!zona) zona = zonaDaTitolo(sezione.titolo) || '';
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
    if (misure.scartati) {
      serie.note = [serie.note,
        `tratto non contato: ${misure.scartati} m dopo una ripetuta sola`]
        .filter(Boolean).join(' \u00b7 ');
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
