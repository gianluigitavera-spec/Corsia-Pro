// =====================================================================
// IL PDF DELLA SEDUTA, GENERATO DALL'APP
//
// Sull'app installata in iPhone (iOS 27) la stampa del browser non fa
// niente, mentre il foglio di condivisione accetta un file (prova del
// 23/10/2026). Quindi il PDF lo scrive l'app, con jsPDF, e lo passa al
// foglio di condivisione già col suo nome.
//
// Il CONTENUTO è foglioSeduta() in dominio.js, lo stesso del foglio di
// stampa: qui si decide solo dove va ogni cosa. Tre pezzi, tutti senza
// DOM, così le prove girano in Node (prova_pdf.mjs):
//
//   testoPerPdf     (pdfComune.js) ogni testo passa di qui: i caratteri
//                   che Public Sans non ha diventano un equivalente
//                   scritto, o «?»;
//   impaginaSeduta  dove va ogni cosa, in millimetri, pagina per pagina;
//   creaPdfSeduta   registra i caratteri, impagina e disegna.
//
// Le misure ricalcano il foglio di stampa (styles.css, @media print):
// A4 verticale, margini di 14 mm, titolo 19 pt, righe 11 pt, colonne di
// 24, 14 e 20 mm per recupero, zona e metri.
//
// UNA PAGINA SOLA QUANDO SI PUÒ (decisione del 23/10/2026): il corpo
// scende da 11 pt a mezzo punto per volta, con le spaziature in
// proporzione, finché la seduta sta in un A4 — fino a 9 pt. Sotto il
// minimo si va su più pagine: una sezione che non sta dove resta passa
// alla pagina dopo, una più lunga di una pagina si spezza fra due righe
// e riprende col titolo e «(segue)». Il numero di pagina («1/2») c'è
// solo quando le pagine sono più di una.
// =====================================================================
import {
  testoPerPdf, altezzaRiga, baseDa, aCapo, testiDiRighe, nuovoDocumento, disegnaPagine,
} from './pdfComune.js';

// Le prove li cercano qui, dove sono nati.
export { testoPerPdf, carattereCoperto } from './pdfComune.js';

// ---------------------------------------------------------------------
// Misure, in millimetri
// ---------------------------------------------------------------------
const A4 = { larghezza: 210, altezza: 297 };
const MARGINE = 14;
const SINISTRA = MARGINE;
const DESTRA = A4.larghezza - MARGINE;
const ALTO = MARGINE;
const BASSO = A4.altezza - MARGINE;
const PIEDE = 6;                // lo spazio del numero di pagina
const COL_METRI = 20;
const COL_ZONA = 14;
const COL_REC = 24;
const X_METRI = DESTRA;                                   // allineati a destra
const X_ZONA = DESTRA - COL_METRI - COL_ZONA / 2;         // al centro
const X_REC = DESTRA - COL_METRI - COL_ZONA - COL_REC;    // a sinistra

export const CORPI = [11, 10.5, 10, 9.5, 9];
export const CORPO_MINIMO = 9;

const GRIGIO_SOTTO = '#333333';
const GRIGIO_TAG = '#555555';
const GRIGIO_FILETTO = '#999999';
const GRIGIO_PUNTINI = '#cccccc';

// Ogni pezzo del foglio diventa un BLOCCO: un'altezza e un disegno che
// sa mettersi a una data altezza. L'impaginazione sposta blocchi, non
// testi.
function blocchiDelFoglio(foglio, corpo, misura) {
  const k = corpo / 11;
  const larghezza = DESTRA - SINISTRA;

  // ---- testata: titolo e riga sotto a sinistra, società a destra
  const corpoTitolo = 19 * k;
  const corpoSotto = 10 * k;
  const larghezzaSocieta = foglio.societa ? misura(foglio.societa, 'normal', corpoSotto) : 0;
  const spazioTitolo = larghezza - (larghezzaSocieta ? larghezzaSocieta + 6 : 0);
  const righeTitolo = aCapo([{ testo: foglio.titolo, peso: 'bold', corpo: corpoTitolo }], spazioTitolo, misura);
  const righeSotto = foglio.sottotitolo
    ? aCapo([{ testo: foglio.sottotitolo, peso: 'normal', corpo: corpoSotto, colore: GRIGIO_SOTTO }], spazioTitolo, misura)
    : [];
  const hTitolo = righeTitolo.length * altezzaRiga(corpoTitolo);
  const hSotto = righeSotto.length ? 2 * k + righeSotto.length * altezzaRiga(corpoSotto) : 0;
  const hTestata = hTitolo + hSotto + 6 * k;
  const testata = {
    altezza: hTestata + 6 * k,
    disegna: (y) => [
      ...testiDiRighe(righeTitolo, SINISTRA, y, corpoTitolo),
      ...testiDiRighe(righeSotto, SINISTRA, y + hTitolo + 2 * k, corpoSotto),
      ...(foglio.societa ? [{
        tipo: 'testo', x: DESTRA, y: y + baseDa(corpoSotto), testo: foglio.societa,
        peso: 'normal', corpo: corpoSotto, colore: GRIGIO_SOTTO, allinea: 'right',
      }] : []),
      { tipo: 'linea', x1: SINISTRA, y1: y + hTestata, x2: DESTRA, y2: y + hTestata, spessore: 0.53, colore: '#000000' },
    ],
  };

  // ---- sezioni: una testa e le righe, che l'impaginazione può separare
  const corpoRiga = 11 * k;
  const corpoColonna = 10 * k;
  const corpoTag = 9.5 * k;
  const pad = 1.4 * k;

  const testaDi = (sez, segue) => {
    const larghezzaMetri = misura(sez.metri, 'normal', corpoRiga);
    const segmenti = [{ testo: sez.titolo + (segue ? ' (segue)' : ''), peso: 'bold', corpo: corpoRiga }];
    if (sez.destinatari) segmenti.push({ testo: ` — ${sez.destinatari}`, peso: 'normal', corpo: corpoRiga });
    const righe = aCapo(segmenti, larghezza - larghezzaMetri - 4, misura);
    const hTesto = righe.length * altezzaRiga(corpoRiga);
    const hFiletto = hTesto + 1.5 * k;
    return {
      altezza: hFiletto + 2 * k,
      disegna: (y) => [
        ...testiDiRighe(righe, SINISTRA, y, corpoRiga),
        { tipo: 'testo', x: DESTRA, y: y + baseDa(corpoRiga), testo: sez.metri, peso: 'normal', corpo: corpoRiga, colore: '#000000', allinea: 'right' },
        { tipo: 'linea', x1: SINISTRA, y1: y + hFiletto, x2: DESTRA, y2: y + hFiletto, spessore: 0.26, colore: GRIGIO_FILETTO },
      ],
    };
  };

  const rigaDi = (r) => {
    if (r.tipo === 'blocco') {
      const h = pad + altezzaRiga(corpoRiga) + 0.4 * k;
      return {
        altezza: h,
        disegna: (y) => [{ tipo: 'testo', x: SINISTRA, y: y + pad + baseDa(corpoRiga), testo: r.testo, peso: 'bold', corpo: corpoRiga, colore: '#000000' }],
      };
    }
    const x = SINISTRA + (r.inBlocco ? 5 * k : 0);
    const segmenti = [{ testo: r.notazione, peso: 'semibold', corpo: corpoRiga }];
    if (r.tag) segmenti.push({ testo: ` · ${r.tag}`, peso: 'normal', corpo: corpoTag, colore: GRIGIO_TAG });
    const righe = aCapo(segmenti, X_REC - 2 - x, misura);
    const h = 2 * pad + Math.max(1, righe.length) * altezzaRiga(corpoRiga);
    // Le colonne stanno sulla prima riga, sulla stessa linea di base.
    const base = (y) => y + pad + baseDa(corpoRiga);
    return {
      altezza: h,
      disegna: (y) => [
        ...testiDiRighe(righe, x, y + pad, corpoRiga),
        ...(r.recupero ? [{ tipo: 'testo', x: X_REC, y: base(y), testo: r.recupero, peso: 'normal', corpo: corpoColonna, colore: '#000000' }] : []),
        ...(r.zona ? [{ tipo: 'testo', x: X_ZONA, y: base(y), testo: r.zona, peso: 'normal', corpo: corpoColonna, colore: '#000000', allinea: 'center' }] : []),
        ...(r.metri ? [{ tipo: 'testo', x: X_METRI, y: base(y), testo: r.metri, peso: 'normal', corpo: corpoColonna, colore: '#000000', allinea: 'right' }] : []),
        { tipo: 'linea', x1: SINISTRA, y1: y + h, x2: DESTRA, y2: y + h, spessore: 0.2, colore: GRIGIO_PUNTINI, puntini: true },
      ],
    };
  };

  const sezioni = foglio.sezioni.map((sez) => ({
    testa: testaDi(sez, false),
    testaSegue: testaDi(sez, true),
    righe: sez.righe.map(rigaDi),
    dopo: 6 * k,
  }));

  // ---- totali e note
  const totali = foglio.totali.length ? {
    altezza: foglio.totali.length * (2 * pad + altezzaRiga(corpoRiga)),
    disegna: (y) => [
      { tipo: 'linea', x1: SINISTRA, y1: y, x2: DESTRA, y2: y, spessore: 0.53, colore: '#000000' },
      ...foglio.totali.flatMap((t, n) => {
        const yb = y + n * (2 * pad + altezzaRiga(corpoRiga)) + pad + baseDa(corpoRiga);
        return [
          { tipo: 'testo', x: SINISTRA, y: yb, testo: t.nome, peso: 'normal', corpo: corpoRiga, colore: '#000000' },
          { tipo: 'testo', x: DESTRA, y: yb, testo: t.testo, peso: 'bold', corpo: corpoRiga, colore: '#000000', allinea: 'right' },
        ];
      }),
    ],
  } : null;

  const corpoNote = 10 * k;
  const righeNote = foglio.note
    ? foglio.note.split('\n').flatMap((paragrafo) =>
      aCapo([{ testo: paragrafo, peso: 'normal', corpo: corpoNote }], larghezza, misura))
    : [];
  const note = righeNote.length ? {
    altezza: 4 * k + righeNote.length * altezzaRiga(corpoNote),
    disegna: (y) => testiDiRighe(righeNote, SINISTRA, y + 4 * k, corpoNote),
  } : null;

  return { testata, sezioni, totali, note };
}

// L'altezza della seduta tutta di seguito, su una pagina infinita.
function altezzaTotale({ testata, sezioni, totali, note }) {
  return testata.altezza
    + sezioni.reduce((t, s) => t + s.testa.altezza + s.righe.reduce((a, r) => a + r.altezza, 0) + s.dopo, 0)
    + (totali?.altezza || 0) + (note?.altezza || 0);
}

/**
 * Dove va ogni cosa. `misura(testo, peso, corpo)` dà la larghezza in mm
 * (in Node e nel browser la dà jsPDF, col carattere vero).
 * Torna { corpo, pagine }: ogni pagina è un elenco di istruzioni di
 * disegno ({ tipo: 'testo' | 'linea', ... }) in millimetri.
 */
export function impaginaSeduta(foglio, misura) {
  const spazio = BASSO - ALTO;
  for (const corpo of CORPI) {
    const blocchi = blocchiDelFoglio(foglio, corpo, misura);
    if (altezzaTotale(blocchi) <= spazio + 0.01) {
      return { corpo, pagine: [disegnaDiSeguito(blocchi)] };
    }
  }
  return { corpo: CORPO_MINIMO, pagine: suPiuPagine(blocchiDelFoglio(foglio, CORPO_MINIMO, misura)) };
}

function disegnaDiSeguito({ testata, sezioni, totali, note }) {
  const out = [];
  let y = ALTO;
  out.push(...testata.disegna(y)); y += testata.altezza;
  for (const s of sezioni) {
    out.push(...s.testa.disegna(y)); y += s.testa.altezza;
    for (const r of s.righe) { out.push(...r.disegna(y)); y += r.altezza; }
    y += s.dopo;
  }
  if (totali) { out.push(...totali.disegna(y)); y += totali.altezza; }
  if (note) out.push(...note.disegna(y));
  return out;
}

function suPiuPagine({ testata, sezioni, totali, note }) {
  const fine = BASSO - PIEDE;
  const pagine = [[]];
  let y = ALTO;
  const pagina = () => pagine[pagine.length - 1];
  const nuovaPagina = () => { pagine.push([]); y = ALTO; };
  const resta = () => fine - y;
  const metti = (b) => { pagina().push(...b.disegna(y)); y += b.altezza; };

  metti(testata);
  for (const s of sezioni) {
    const hSezione = s.testa.altezza + s.righe.reduce((a, r) => a + r.altezza, 0);
    // Intera dove resta, se ci sta. Se no comincia qui solo se con la
    // testa ci stanno almeno tre righe (o tutte, se sono meno), e si
    // spezza: spostarla intera alla pagina dopo lasciava pagine quasi
    // vuote, e una seduta da due pagine ne prendeva tre.
    const attacco = s.testa.altezza + s.righe.slice(0, 3).reduce((a, r) => a + r.altezza, 0);
    if (hSezione > resta() && attacco > resta()) nuovaPagina();
    metti(s.testa);
    for (const r of s.righe) {
      if (r.altezza > resta()) {
        nuovaPagina();
        metti(s.testaSegue);
      }
      metti(r);
    }
    y += s.dopo;
  }
  for (const b of [totali, note]) {
    if (!b) continue;
    if (b.altezza > resta()) nuovaPagina();
    metti(b);
  }

  const n = pagine.length;
  if (n > 1) {
    pagine.forEach((p, i) => p.push({
      tipo: 'testo', x: DESTRA, y: A4.altezza - MARGINE + 1, testo: `${i + 1}/${n}`,
      peso: 'normal', corpo: 9, colore: GRIGIO_TAG, allinea: 'right',
    }));
  }
  return pagine;
}

// ---------------------------------------------------------------------
// Il disegno con jsPDF
// ---------------------------------------------------------------------
/** Ogni testo del foglio, passato da testoPerPdf. */
export function foglioPerPdf(foglio) {
  const t = testoPerPdf;
  return {
    ...foglio,
    titolo: t(foglio.titolo),
    sottotitolo: t(foglio.sottotitolo),
    societa: t(foglio.societa),
    note: foglio.note ? t(foglio.note) : null,
    sezioni: foglio.sezioni.map((s) => ({
      ...s,
      titolo: t(s.titolo),
      destinatari: s.destinatari ? t(s.destinatari) : null,
      metri: t(s.metri),
      righe: s.righe.map((r) => (r.tipo === 'blocco'
        ? { ...r, testo: t(r.testo) }
        : { ...r, notazione: t(r.notazione), tag: t(r.tag), recupero: t(r.recupero), zona: t(r.zona), metri: t(r.metri) })),
    })),
    totali: foglio.totali.map((x) => ({ ...x, nome: t(x.nome), testo: t(x.testo) })),
  };
}

/**
 * Il PDF della seduta.
 * @param JsPDF      il costruttore di jsPDF (caricato a parte nel browser)
 * @param foglio     foglioSeduta(seduta, ...)
 * @param caratteri  { normal, semibold, bold }: i TTF di Public Sans in base64
 * @param opzioni    { titolo, compress }
 * Torna { doc, impaginazione }.
 */
export function creaPdfSeduta(JsPDF, foglio, caratteri, { titolo = '', compress = true } = {}) {
  const { doc, misura } = nuovoDocumento(JsPDF, caratteri, { orientamento: 'portrait', compress });
  const impaginazione = impaginaSeduta(foglioPerPdf(foglio), misura);
  disegnaPagine(doc, impaginazione.pagine, 'portrait');
  doc.setProperties({ title: titolo || foglio.titolo, creator: 'CorsiaPro' });
  return { doc, impaginazione };
}
