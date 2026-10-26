// =====================================================================
// IL FOGLIO DA BORDO VASCA DEI TEST, GENERATO DALL'APP
//
// Si stampa prima del test e si riempie a mano: in alto test, data, vasca
// e gruppo; poi una riga per atleta, coi nomi già scritti nello stesso
// ordine di «Registra», e le caselle vuote per ogni ripetuta, per i
// passaggi se il tipo li prevede e per le bracciate; in fondo le righe
// vuote, fino a cinque, solo quante ne stanno nella pagina in corso: mai
// una pagina in più per una riga vuota. Niente tempi di gara, nemmeno
// nel 5x300: si conoscono prima e si scrivono in «Registra». La versione
// senza nomi, dal tipo, è una pagina intera di righe vuote, con data,
// vasca e gruppo da scrivere.
//
// Stesso sistema della seduta e del report (pdfComune.js): l'impaginazione
// produce istruzioni in millimetri e le prove le guardano senza aprire il
// PDF (prova_foglio_test.mjs). Niente DOM.
//
// LE CASELLE SI SCRIVONO A MANO: mai più strette di 12 mm. Per questo
// una riga ne tiene al massimo 12 in verticale e 20 in orizzontale, e
// l'orientamento lo decide la riga più larga. Il 15x100 su una riga
// sola farebbe 30 caselle da 8 mm: va una serie per riga. Oltre 20 le
// ripetute vanno a capo dentro il blocco dell'atleta.
// =====================================================================
import {
  testoPerPdf, altezzaRiga, baseDa, aCapo, nuovoDocumento, disegnaPagine,
} from './pdfComune.js';
import { passaggiAttesi } from './test.js';

const FORMATI = {
  portrait: { larghezza: 210, altezza: 297, margine: 12, perRiga: 12 },
  landscape: { larghezza: 297, altezza: 210, margine: 8, perRiga: 20 },
};
const COLONNA_NOME = 40;
const ALTEZZA_CASELLA = 9;
const ALTEZZA_TITOLI = 6;
const PIEDE = 6;
const NERO = '#000000';
const GRIGIO = '#555555';
const BORDO = '#777777';

/** Le righe vuote in fondo al foglio coi nomi, al massimo. */
export const RIGHE_VUOTE = 5;

// ---------------------------------------------------------------------
// Le caselle di un atleta
// ---------------------------------------------------------------------

/**
 * Le caselle di un atleta per il tipo, e come vanno in righe.
 * { celle: [{ tipo, etichetta, ripetuta }], linee: [[indici]], caselle,
 *   orientamento }. Per ogni ripetuta: i passaggi, il tempo, le bracciate.
 */
export function grigliaFoglio(tipo) {
  const n = tipo?.ripetute || 1;
  const p = passaggiAttesi(tipo);
  const br = (tipo?.misure || []).includes('bracciate');
  const perRipetuta = p + 1 + (br ? 1 : 0);

  const celle = [];
  for (let r = 1; r <= n; r++) {
    for (let k = 1; k <= p; k++) celle.push({ tipo: 'passaggio', etichetta: String(k * tipo.parziali_ogni), ripetuta: r });
    celle.push({ tipo: 'tempo', etichetta: 'tempo', ripetuta: r });
    if (br) celle.push({ tipo: 'bracciate', etichetta: 'br', ripetuta: r });
  }

  // Le serie (15x100: tre da cinque) cominciano ognuna su una riga.
  const serie = tipo?.serie > 1 && n % tipo.serie === 0 ? tipo.serie : 1;
  const perSerie = n / serie;
  const orientamento = perRipetuta * perSerie <= FORMATI.portrait.perRiga ? 'portrait' : 'landscape';
  const massimo = FORMATI[orientamento].perRiga;

  const linee = [];
  for (let s = 0; s < serie; s++) {
    const daCella = s * perSerie * perRipetuta;
    const indici = Array.from({ length: perSerie * perRipetuta }, (_, i) => daCella + i);
    // Le ripetute intere quando ci stanno; se una sola è più larga della
    // riga, le sue caselle vanno a capo.
    const passo = perRipetuta <= massimo ? Math.floor(massimo / perRipetuta) * perRipetuta : massimo;
    for (let i = 0; i < indici.length; i += passo) linee.push(indici.slice(i, i + passo));
  }
  return { celle, linee, caselle: celle.length, orientamento };
}

// ---------------------------------------------------------------------
// Il nome del file
// ---------------------------------------------------------------------
const pulito = (t) => String(t ?? '')
  .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]+/g, '-')
  .replace(/\s+/g, ' ')
  .replace(/^[\s-]+/, '')
  .replace(/[\s.-]+$/, '');

/** CorsiaPro_Test_T-1000_26-10-26, o CorsiaPro_Test_T-1000_foglio senza data. */
export function nomeFileFoglioTest({ tipo, data }) {
  const m = String(data ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return ['CorsiaPro', 'Test', pulito(tipo?.nome) || 'test', m ? `${m[3]}-${m[2]}-${m[1].slice(2)}` : 'foglio'].join('_');
}

// ---------------------------------------------------------------------
// L'impaginazione
// ---------------------------------------------------------------------
const dataIt = (iso) => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};
const minSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const schema = (t) => [
  t.ripetute > 1 ? `${t.ripetute}x${t.distanza}` : `${t.distanza} m`,
  t.ripartenza_s ? `ogni ${minSec(t.ripartenza_s)}` : null,
  t.recupero_s ? `con ${minSec(t.recupero_s)} di recupero` : null,
].filter(Boolean).join(' ');

/**
 * Dove va ogni cosa.
 * @param foglio  { tipo, data, vasca, gruppi, societa, atleti }: atleti
 *                null = la versione senza nomi
 * @param misura  (testo, peso, corpo) → larghezza in mm
 * Torna { orientamento, pagine, righe, caselleDisegnate, larghezzaCasella }:
 * righe sono i nomi blocco per blocco ('' per una riga vuota), per le prove.
 */
export function impaginaFoglioTest(foglio, misura) {
  const { tipo } = foglio;
  const g = grigliaFoglio(tipo);
  const F = FORMATI[g.orientamento];
  const sinistra = F.margine;
  const destra = F.larghezza - F.margine;
  const larghezza = destra - sinistra;
  const alto = F.margine;
  const fine = F.altezza - F.margine - PIEDE;
  const perRiga = Math.max(...g.linee.map((l) => l.length));
  const casella = (larghezza - COLONNA_NOME) / perRiga;
  const x0 = sinistra + COLONNA_NOME;
  const altezzaBlocco = g.linee.length * ALTEZZA_CASELLA;
  const conNomi = Array.isArray(foglio.atleti);

  const pagine = [[]];
  let y = alto;
  const pagina = () => pagine[pagine.length - 1];
  const linea = (x1, y1, x2, y2, spessore = 0.25, colore = BORDO) => ({ tipo: 'linea', x1, y1, x2, y2, spessore, colore });
  const scritta = (testo, corpo, extra = {}) => {
    const righe = aCapo([{ testo: testoPerPdf(testo), peso: extra.peso || 'normal', corpo, colore: extra.colore }], extra.larghezza ?? larghezza, misura);
    return {
      altezza: righe.length * altezzaRiga(corpo),
      disegna: (yy, xx = sinistra) => righe.flatMap((r, k) => r.filter((pz) => pz.testo !== ' ').map((pz) => ({
        tipo: 'testo', x: xx + pz.x, y: yy + baseDa(corpo) + k * altezzaRiga(corpo),
        testo: pz.testo, peso: pz.peso, corpo: pz.corpo, colore: pz.colore || NERO,
      }))),
    };
  };

  // ---- testata: test e data, poi vasca, gruppo e schema; la società a destra
  const societa = testoPerPdf(foglio.societa || '');
  const spazio = larghezza - (societa ? misura(societa, 'normal', 10) + 6 : 0);
  const titolo = scritta(`${tipo.nome}${conNomi && foglio.data ? ` · ${dataIt(foglio.data)}` : ''}`, 14, { peso: 'bold', larghezza: spazio });
  const sotto = conNomi
    ? scritta([foglio.vasca ? `vasca da ${foglio.vasca}` : null, (foglio.gruppi || []).join(', ') || 'tutte le categorie', schema(tipo)]
      .filter(Boolean).join(' · '), 10, { colore: '#333333', larghezza: spazio })
    : scritta(`Data ____________   Vasca ______   Gruppo ______________________   ·   ${schema(tipo)}`, 10, { colore: '#333333', larghezza: spazio });
  const p = passaggiAttesi(tipo);
  const legenda = scritta([
    'Tempi come sul cronometro.',
    p ? `Passaggi progressivi, ai metri scritti in testa.` : null,
    g.celle.some((c) => c.tipo === 'bracciate') ? 'br = bracciate singole per 25.' : null,
    tipo.ripetute > 1 ? 'Il numero piccolo è la ripetuta.' : null,
  ].filter(Boolean).join(' '), 8, { colore: GRIGIO });
  const hTestata = titolo.altezza + 1.5 + sotto.altezza + 1.5 + legenda.altezza + 3;
  pagina().push(
    ...titolo.disegna(y),
    ...sotto.disegna(y + titolo.altezza + 1.5),
    ...legenda.disegna(y + titolo.altezza + 1.5 + sotto.altezza + 1.5),
    ...(societa ? [{ tipo: 'testo', x: destra, y: y + baseDa(10), testo: societa, peso: 'normal', corpo: 10, colore: '#333333', allinea: 'right' }] : []),
    linea(sinistra, y + hTestata, destra, y + hTestata, 0.53, NERO),
  );
  y += hTestata + 3;

  // ---- la riga dei titoli: quella della riga più larga
  const modello = g.linee.find((l) => l.length === perRiga);
  const titoli = () => {
    pagina().push(
      { tipo: 'testo', x: sinistra + 1, y: y + baseDa(7.5) + 0.8, testo: 'Atleta', peso: 'bold', corpo: 7.5, colore: NERO },
      ...modello.map((idx, j) => ({
        tipo: 'testo', x: x0 + j * casella + casella / 2, y: y + baseDa(7.5) + 0.8,
        testo: g.celle[idx].etichetta, peso: 'bold', corpo: 7.5, colore: NERO, allinea: 'center',
      })),
    );
    y += ALTEZZA_TITOLI;
  };
  titoli();

  // ---- i blocchi: uno per atleta, tante righe di caselle quante linee
  let caselleDisegnate = 0;
  const righe = [];
  const blocco = (atleta) => {
    const out = [];
    const nome = atleta ? `${atleta.cognome} ${atleta.nome}` : '';
    if (atleta) {
      const r = aCapo([
        { testo: testoPerPdf(atleta.cognome), peso: 'bold', corpo: 9 },
        { testo: ` ${testoPerPdf(atleta.nome)}`, peso: 'normal', corpo: 9 },
      ], COLONNA_NOME - 2.4, misura);
      r.slice(0, Math.max(1, Math.floor((altezzaBlocco - 1) / altezzaRiga(9)))).forEach((riga, k) => {
        for (const pz of riga) {
          if (pz.testo === ' ') continue;
          out.push({ tipo: 'testo', x: sinistra + 1.2 + pz.x, y: y + 1.6 + baseDa(9) + k * altezzaRiga(9), testo: pz.testo, peso: pz.peso, corpo: 9, colore: NERO });
        }
      });
    }
    // il riquadro del nome
    out.push(
      linea(sinistra, y, x0, y), linea(sinistra, y + altezzaBlocco, x0, y + altezzaBlocco),
      linea(sinistra, y, sinistra, y + altezzaBlocco),
    );
    g.linee.forEach((l, li) => {
      const yl = y + li * ALTEZZA_CASELLA;
      l.forEach((idx, j) => {
        const x = x0 + j * casella;
        const c = g.celle[idx];
        out.push(
          linea(x, yl, x + casella, yl), linea(x, yl + ALTEZZA_CASELLA, x + casella, yl + ALTEZZA_CASELLA),
          linea(x, yl, x, yl + ALTEZZA_CASELLA), linea(x + casella, yl, x + casella, yl + ALTEZZA_CASELLA),
        );
        if (c.tipo === 'tempo' && tipo.ripetute > 1) {
          out.push({ tipo: 'testo', x: x + 0.8, y: yl + baseDa(5.5) + 0.4, testo: String(c.ripetuta), peso: 'normal', corpo: 5.5, colore: GRIGIO });
        }
        caselleDisegnate++;
      });
    });
    // fra un atleta e l'altro, una linea più marcata
    out.push(linea(sinistra, y + altezzaBlocco, sinistra + COLONNA_NOME + perRiga * casella, y + altezzaBlocco, 0.45, NERO));
    righe.push(nome);
    return out;
  };

  const metti = (atleta) => {
    if (y + altezzaBlocco > fine) { pagine.push([]); y = alto; titoli(); }
    pagina().push(...blocco(atleta));
    y += altezzaBlocco;
  };

  if (conNomi) {
    for (const a of foglio.atleti) metti(a);
    // Le righe vuote riempiono solo la pagina in corso, fino a cinque:
    // nessuna pagina in più per una riga vuota (decisione del 26/10/2026).
    for (let i = 0; i < RIGHE_VUOTE && y + altezzaBlocco <= fine; i++) metti(null);
  } else {
    // Senza nomi: la pagina intera.
    const quante = Math.max(1, Math.floor((fine - y) / altezzaBlocco));
    for (let i = 0; i < quante; i++) metti(null);
  }

  const n = pagine.length;
  if (n > 1) {
    pagine.forEach((pg, i) => pg.push({
      tipo: 'testo', x: destra, y: F.altezza - F.margine + 1, testo: `${i + 1}/${n}`,
      peso: 'normal', corpo: 9, colore: GRIGIO, allinea: 'right',
    }));
  }
  return { orientamento: g.orientamento, pagine, righe, caselleDisegnate, larghezzaCasella: casella };
}

/**
 * Il PDF del foglio da bordo vasca.
 * @param JsPDF      il costruttore di jsPDF
 * @param foglio     { tipo, data, vasca, gruppi, societa, atleti }
 * @param caratteri  { normal, semibold, bold }: i TTF in base64
 * @param opzioni    { titolo (del documento), compress }
 * Torna { doc, impaginazione }.
 */
export function creaPdfFoglioTest(JsPDF, foglio, caratteri, { titolo = '', compress = true } = {}) {
  const { orientamento } = grigliaFoglio(foglio.tipo);
  const { doc, misura } = nuovoDocumento(JsPDF, caratteri, { orientamento, compress });
  const impaginazione = impaginaFoglioTest(foglio, misura);
  disegnaPagine(doc, impaginazione.pagine, orientamento);
  doc.setProperties({ title: titolo || nomeFileFoglioTest(foglio), creator: 'CorsiaPro' });
  return { doc, impaginazione };
}
