// =====================================================================
// IL PDF DEL REPORT PRESENZE, GENERATO DALL'APP
//
// Come la seduta (pdfSeduta.js): stesso jsPDF, stesso carattere, stesso
// modo di disegnare (pdfComune.js). Il contenuto è il report che
// dominio.js calcola e lo schermo mostra — reportGiornaliero,
// reportMensile, reportStagione —, con le parole di etichetteReport.js.
// Qui si decide solo dove va ogni cosa.
//
// Il giorno e la stagione stanno in un A4 verticale, il mese in uno
// orizzontale: 31 giorni, ognuno con una colonna sua. Le misure sono
// quelle della stampa del browser (styles.css, .foglio-report): tabelle
// a 9 pt, griglie a 7,5 pt. Con 31 giorni la colonna di un giorno è
// larga intorno ai 7 mm: due stati nello stesso giorno («PA») ne
// prendono 3,5. Il nome dell'atleta prende quello che gli serve, fino a
// 55 mm, poi va a capo.
//
// Più atleti di quanti ne stanno in una pagina: la tabella continua
// sulla pagina dopo, con di nuovo la riga dei titoli, e il numero di
// pagina («1/2») compare solo in quel caso. Il report non rimpicciolisce
// il carattere: a 7,5 pt è già al minimo che si legge.
// =====================================================================
import {
  testoPerPdf, altezzaRiga, baseDa, aCapo, nuovoDocumento, disegnaPagine,
} from './pdfComune.js';
import {
  giornoBreve, meseBreve, percentuale, statoPerEsteso, riepilogoGiorno, NOTA_REPORT,
} from './etichetteReport.js';

const FORMATI = {
  portrait: { larghezza: 210, altezza: 297, margine: 14 },
  landscape: { larghezza: 297, altezza: 210, margine: 10 },
};
export const orientamentoDi = (forma) => (forma === 'mese' ? 'landscape' : 'portrait');

const NERO = '#000000';
const GRIGIO_SOTTO = '#333333';
const GRIGIO_PICCOLO = '#555555';
const GRIGIO_BORDO = '#999999';
const SFONDO_FUTURO = '#eeeeee';
const PIEDE = 6;

// Il nome come a schermo: il cognome in grassetto, e «archiviato» piccolo
// e grigio accanto a chi non è più in squadra.
const nomeAtleta = (x, corpo) => [
  { testo: testoPerPdf(x.cognome), peso: 'bold', corpo },
  { testo: ` ${testoPerPdf(x.nome)}`, peso: 'normal', corpo },
  ...(x.archiviato ? [{ testo: ' archiviato', peso: 'normal', corpo: corpo * 0.85, colore: GRIGIO_PICCOLO }] : []),
];
const cella = (testo, corpo, extra = {}) => ({
  segmenti: [{ testo: testoPerPdf(testo), peso: extra.peso || 'normal', corpo }],
  allinea: extra.allinea || 'left',
  sfondo: extra.sfondo || null,
});

// ---------------------------------------------------------------------
// Le tre forme come tabelle: colonne (larghezze in mm), la riga dei
// titoli e le righe. Ogni cella: { segmenti, allinea, sfondo }.
// ---------------------------------------------------------------------
function tabellaGiorno(r, larghezza) {
  const corpo = 9;
  return {
    corpo, padV: 1, padO: 1.2,
    colonne: [larghezza - 45, 45],
    titoli: [cella('Atleta', corpo, { peso: 'bold' }), cella('Stato', corpo, { peso: 'bold' })],
    righe: r.righe.map((x) => [
      { segmenti: nomeAtleta(x, corpo), allinea: 'left' },
      cella(statoPerEsteso(x.stato), corpo),
    ]),
  };
}

function tabellaMese(r, larghezza, misura) {
  const corpo = 7.5;
  const padO = 0.6;
  const larghezzaNome = (x) => nomeAtleta(x, corpo)
    .reduce((t, s) => t + misura(s.testo, s.peso, s.corpo), 0) + 2 * padO;
  const colNome = Math.min(55, Math.max(30, ...r.righe.map(larghezzaNome)));
  const colPct = 11;
  const colGiorno = (larghezza - colNome - colPct) / r.giorni.length;
  const futuro = (si) => (si ? SFONDO_FUTURO : null);
  return {
    corpo, padV: 0.8, padO,
    colonne: [colNome, ...r.giorni.map(() => colGiorno), colPct],
    titoli: [
      cella('Atleta', corpo, { peso: 'bold' }),
      ...r.giorni.map((g) => ({
        segmenti: [{ testo: `${giornoBreve(g.data)}\n${g.numero}`, peso: 'bold', corpo }],
        allinea: 'center', sfondo: futuro(g.futuro),
      })),
      cella('%', corpo, { peso: 'bold', allinea: 'center' }),
    ],
    righe: r.righe.map((x) => [
      { segmenti: nomeAtleta(x, corpo), allinea: 'left' },
      ...x.caselle.map((c) => cella((c || []).join(''), corpo, { allinea: 'center', sfondo: futuro(c === null) })),
      cella(percentuale(x.frequenza.pct), corpo, { allinea: 'right' }),
    ]),
  };
}

function tabellaStagione(r, larghezza) {
  const corpo = 7.5;
  const colMese = 10;
  const colTot = 11;
  const futuro = (si) => (si ? SFONDO_FUTURO : null);
  return {
    corpo, padV: 0.8, padO: 0.6,
    colonne: [larghezza - r.mesi.length * colMese - colTot, ...r.mesi.map(() => colMese), colTot],
    titoli: [
      cella('Atleta', corpo, { peso: 'bold' }),
      ...r.mesi.map((m) => cella(meseBreve(m.mese), corpo, { peso: 'bold', allinea: 'center', sfondo: futuro(m.futuro) })),
      cella('Tot.', corpo, { peso: 'bold', allinea: 'center' }),
    ],
    righe: r.righe.map((x) => [
      { segmenti: nomeAtleta(x, corpo), allinea: 'left' },
      ...x.mesi.map((f) => cella(f === null ? '' : percentuale(f.pct), corpo, { allinea: 'right', sfondo: futuro(f === null) })),
      cella(percentuale(x.totale.pct), corpo, { allinea: 'right' }),
    ]),
  };
}

// ---------------------------------------------------------------------
// Una riga della tabella: altezza e disegno. Il testo di una cella va a
// capo dentro la sua colonna; "\n" va a capo comunque (giorno e numero
// nella testata del mese).
// ---------------------------------------------------------------------
function rigaTabella(celle, t, x0, misura) {
  const { corpo, padV, padO, colonne } = t;
  const composte = celle.map((c, i) => {
    const larghezza = colonne[i] - 2 * padO;
    const paragrafi = [];
    let corrente = [];
    for (const s of c.segmenti) {
      const parti = String(s.testo).split('\n');
      parti.forEach((p, k) => {
        if (k > 0) { paragrafi.push(corrente); corrente = []; }
        if (p) corrente.push({ ...s, testo: p });
      });
    }
    paragrafi.push(corrente);
    const righe = paragrafi.flatMap((segmenti) => aCapo(segmenti, larghezza, misura));
    return { ...c, righe };
  });
  const linee = Math.max(1, ...composte.map((c) => c.righe.length));
  const altezza = 2 * padV + linee * altezzaRiga(corpo);
  const disegna = (y) => {
    const out = [];
    let x = x0;
    composte.forEach((c, i) => {
      const w = colonne[i];
      if (c.sfondo) out.push({ tipo: 'rettangolo', x, y, larghezza: w, altezza, riempi: c.sfondo });
      c.righe.forEach((riga, n) => {
        const ultimo = riga[riga.length - 1];
        const largaRiga = ultimo ? ultimo.x + misura(ultimo.testo, ultimo.peso, ultimo.corpo) : 0;
        const scarto = c.allinea === 'right' ? w - 2 * padO - largaRiga
          : c.allinea === 'center' ? (w - 2 * padO - largaRiga) / 2 : 0;
        const yb = y + padV + baseDa(corpo) + n * altezzaRiga(corpo);
        for (const p of riga) {
          if (p.testo === ' ') continue;
          out.push({ tipo: 'testo', x: x + padO + scarto + p.x, y: yb, testo: p.testo, peso: p.peso, corpo: p.corpo, colore: p.colore || NERO });
        }
      });
      x += w;
    });
    // i bordi: sopra, sotto e fra le colonne
    const fine = x0 + colonne.reduce((a, b) => a + b, 0);
    const bordo = (x1, y1, x2, y2) => ({ tipo: 'linea', x1, y1, x2, y2, spessore: 0.2, colore: GRIGIO_BORDO });
    out.push(bordo(x0, y, fine, y), bordo(x0, y + altezza, fine, y + altezza));
    let xv = x0;
    for (const w of [0, ...colonne]) { xv += w; out.push(bordo(xv, y, xv, y + altezza)); }
    return out;
  };
  return { altezza, disegna };
}

/**
 * Dove va ogni cosa.
 * @param report   quello di reportGiornaliero / reportMensile / reportStagione
 * @param forma    'giorno' | 'mese' | 'stagione'
 * @param testata  { titolo, sotto, societa }: come a schermo
 * @param misura   (testo, peso, corpo) → larghezza in mm
 * Torna { orientamento, pagine, colonne }: colonne sono le larghezze
 * della tabella, per le prove.
 */
export function impaginaReport(report, forma, testata, misura) {
  const orientamento = orientamentoDi(forma);
  const F = FORMATI[orientamento];
  const sinistra = F.margine;
  const destra = F.larghezza - F.margine;
  const larghezza = destra - sinistra;
  const alto = F.margine;
  const fine = F.altezza - F.margine - PIEDE;

  const pagine = [[]];
  let y = alto;
  const pagina = () => pagine[pagine.length - 1];
  const nuovaPagina = () => { pagine.push([]); y = alto; };
  const metti = (b) => { pagina().push(...b.disegna(y)); y += b.altezza; };
  const testo = (t, corpo, extra = {}) => {
    const righe = aCapo([{ testo: testoPerPdf(t), peso: extra.peso || 'normal', corpo, colore: extra.colore }], extra.larghezza ?? larghezza, misura);
    return {
      altezza: righe.length * altezzaRiga(corpo) + (extra.dopo || 0),
      disegna: (yy) => righe.flatMap((r, n) => r.filter((p) => p.testo !== ' ').map((p) => ({
        tipo: 'testo', x: sinistra + p.x, y: yy + baseDa(corpo) + n * altezzaRiga(corpo),
        testo: p.testo, peso: p.peso, corpo: p.corpo, colore: p.colore || NERO,
      }))),
    };
  };

  // ---- testata: il periodo e il gruppo a sinistra, la società a destra
  const societa = testoPerPdf(testata.societa || '');
  const spazio = larghezza - (societa ? misura(societa, 'normal', 10) + 6 : 0);
  const titolo = testo(testata.titolo, 14, { peso: 'bold', larghezza: spazio, dopo: 1.5 });
  const sotto = testo(testata.sotto, 10, { colore: GRIGIO_SOTTO, larghezza: spazio });
  const hTestata = titolo.altezza + sotto.altezza + 4;
  metti({
    altezza: hTestata + 4,
    disegna: (yy) => [
      ...titolo.disegna(yy),
      ...sotto.disegna(yy + titolo.altezza),
      ...(societa ? [{ tipo: 'testo', x: destra, y: yy + baseDa(10), testo: societa, peso: 'normal', corpo: 10, colore: GRIGIO_SOTTO, allinea: 'right' }] : []),
      { tipo: 'linea', x1: sinistra, y1: yy + hTestata, x2: destra, y2: yy + hTestata, spessore: 0.53, colore: NERO },
    ],
  });

  let colonne = [];
  if (!report.righe.length) {
    metti(testo('Nessun atleta in questo gruppo.', 9, { dopo: 3 }));
  } else {
    if (forma === 'giorno') metti(testo(riepilogoGiorno(report), 10, { dopo: 3 }));
    const t = forma === 'giorno' ? tabellaGiorno(report, larghezza)
      : forma === 'mese' ? tabellaMese(report, larghezza, misura)
        : tabellaStagione(report, larghezza);
    colonne = t.colonne;
    const titoli = rigaTabella(t.titoli, t, sinistra, misura);
    metti(titoli);
    for (const celle of t.righe) {
      const riga = rigaTabella(celle, t, sinistra, misura);
      if (y + riga.altezza > fine) { nuovaPagina(); metti(titoli); }
      metti(riga);
    }
    y += 3;
  }

  const nota = testo(NOTA_REPORT, 8, { colore: GRIGIO_SOTTO });
  if (y + nota.altezza > fine) nuovaPagina();
  metti(nota);

  const n = pagine.length;
  if (n > 1) {
    pagine.forEach((p, i) => p.push({
      tipo: 'testo', x: destra, y: F.altezza - F.margine + 1, testo: `${i + 1}/${n}`,
      peso: 'normal', corpo: 9, colore: GRIGIO_PICCOLO, allinea: 'right',
    }));
  }
  return { orientamento, pagine, colonne };
}

/**
 * Il PDF del report presenze.
 * @param JsPDF      il costruttore di jsPDF
 * @param report     il report calcolato da dominio.js
 * @param forma      'giorno' | 'mese' | 'stagione'
 * @param testata    { titolo, sotto, societa }
 * @param caratteri  { normal, semibold, bold }: i TTF in base64
 * @param opzioni    { titolo (del documento), compress }
 * Torna { doc, impaginazione }.
 */
export function creaPdfReport(JsPDF, report, forma, testata, caratteri, { titolo = '', compress = true } = {}) {
  const orientamento = orientamentoDi(forma);
  const { doc, misura } = nuovoDocumento(JsPDF, caratteri, { orientamento, compress });
  const impaginazione = impaginaReport(report, forma, testata, misura);
  disegnaPagine(doc, impaginazione.pagine, orientamento);
  doc.setProperties({ title: titolo || testata.titolo, creator: 'CorsiaPro' });
  return { doc, impaginazione };
}
