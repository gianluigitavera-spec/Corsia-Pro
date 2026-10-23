// =====================================================================
// I PEZZI COMUNI DEI PDF GENERATI DALL'APP
//
// Il PDF della seduta (pdfSeduta.js) e quello del report presenze
// (pdfReport.js) usano lo stesso jsPDF, lo stesso carattere e lo stesso
// modo di disegnare: l'impaginazione produce, pagina per pagina, un
// elenco di istruzioni in millimetri ({ tipo: 'testo' | 'linea' |
// 'rettangolo', ... }), e disegnaPagine le passa a jsPDF. Così le prove
// guardano le istruzioni, senza aprire il PDF.
//
// Niente DOM: gira anche in Node, nelle prove.
// =====================================================================

// I caratteri che il Public Sans ridotto (src/assets/font) contiene: li
// ha elencati fontTools dal file stesso. Se si rifà il carattere con un
// insieme diverso, si rifà anche questo elenco.
const COPERTI = [
  [0x0020, 0x007E], [0x00A0, 0x0131], [0x0134, 0x0148], [0x014A, 0x017E], [0x018F, 0x018F],
  [0x0192, 0x0192], [0x01A0, 0x01A1], [0x01AF, 0x01B0], [0x01D4, 0x01D4], [0x01EA, 0x01EB],
  [0x01FA, 0x021B], [0x0237, 0x0237], [0x2013, 0x2014], [0x2018, 0x201A], [0x201C, 0x201E],
  [0x2020, 0x2022], [0x2026, 0x2026], [0x2030, 0x2030], [0x2039, 0x203A], [0x2044, 0x2044],
  [0x20AC, 0x20AC], [0x2113, 0x2113], [0x2116, 0x2117], [0x2120, 0x2120], [0x2122, 0x2122],
  [0x2126, 0x2126], [0x2202, 0x2202], [0x2205, 0x2206], [0x220F, 0x220F], [0x2211, 0x2212],
  [0x2215, 0x2215], [0x2219, 0x221A], [0x221E, 0x221E], [0x222B, 0x222B], [0x2248, 0x2248],
  [0x2260, 0x2260], [0x2264, 0x2265],
];

export const carattereCoperto = (ch) => {
  const c = ch.codePointAt(0);
  return COPERTI.some(([da, a]) => c >= da && c <= a);
};

// Quelli che nell'app compaiono e Public Sans non ha. Un equivalente
// scritto si legge; il glifo mancante, jsPDF lo farebbe sparire senza
// dire niente.
const SOSTITUTI = {
  '→': '->', '←': '<-', '↑': '^', '↓': 'v',
  '₂': '2', '′': "'", '″': '"', '✓': 'v', '✕': 'x', '⋮': ':',
  '\t': ' ',
};

/** Il testo come può stamparlo il PDF. Quello che resta fuori diventa «?». */
export function testoPerPdf(testo) {
  return Array.from(String(testo ?? '').normalize('NFC').replace(/\r/g, ''))
    .map((ch) => (ch === '\n' ? ch : SOSTITUTI[ch] ?? (carattereCoperto(ch) ? ch : '?')))
    .join('');
}

// ---------------------------------------------------------------------
// Righe di testo
// ---------------------------------------------------------------------
export const PT = 0.352778;            // un punto tipografico in mm
const INTERLINEA = 1.25;

// L'altezza di una riga di testo, e la distanza dal suo alto alla linea
// di base (dove jsPDF appoggia il testo).
export const altezzaRiga = (corpo) => corpo * PT * INTERLINEA;
export const baseDa = (corpo) => corpo * PT * 0.95;

// Va a capo per parole su segmenti di stile diverso (la notazione in
// semigrassetto, il tag in grigio più piccolo): torna le righe, ognuna
// coi suoi pezzi già posati in x a partire da zero. Una parola più lunga
// della riga si spezza per lettere: meglio spezzata che fuori dal foglio.
export function aCapo(segmenti, larghezza, misura) {
  const righe = [[]];
  let x = 0;
  const posa = (testo, s) => {
    const w = misura(testo, s.peso, s.corpo);
    righe[righe.length - 1].push({ ...s, testo, x });
    x += w;
  };
  const nuovaRiga = () => { righe.push([]); x = 0; };
  for (const s of segmenti) {
    const pezzi = String(s.testo).split(/(\s+)/).filter((p) => p !== '');
    for (const p of pezzi) {
      if (/^\s+$/.test(p)) {
        if (righe[righe.length - 1].length) posa(' ', s);
        continue;
      }
      const w = misura(p, s.peso, s.corpo);
      if (x + w <= larghezza + 0.01) { posa(p, s); continue; }
      if (righe[righe.length - 1].length) {
        // via lo spazio rimasto in coda
        const r = righe[righe.length - 1];
        if (r.length && r[r.length - 1].testo === ' ') { r.pop(); }
        nuovaRiga();
      }
      if (w <= larghezza + 0.01) { posa(p, s); continue; }
      let pezzo = '';
      for (const ch of Array.from(p)) {
        if (pezzo && x + misura(pezzo + ch, s.peso, s.corpo) > larghezza + 0.01) {
          posa(pezzo, s); nuovaRiga(); pezzo = '';
        }
        pezzo += ch;
      }
      if (pezzo) posa(pezzo, s);
    }
  }
  return righe.map((r) => (r.length && r[r.length - 1].testo === ' ' ? r.slice(0, -1) : r));
}

// Le righe a capo, come istruzioni di testo a partire da (x, alto).
export function testiDiRighe(righe, x, alto, corpo) {
  const out = [];
  righe.forEach((r, n) => {
    const y = alto + baseDa(corpo) + n * altezzaRiga(corpo);
    for (const p of r) {
      if (p.testo === ' ') continue;
      out.push({ tipo: 'testo', x: x + p.x, y, testo: p.testo, peso: p.peso, corpo: p.corpo, colore: p.colore || '#000000' });
    }
  });
  return out;
}

// ---------------------------------------------------------------------
// Il documento e il disegno, con jsPDF
// ---------------------------------------------------------------------
const FAMIGLIA = 'PublicSans';
const PESI = ['normal', 'semibold', 'bold'];

/**
 * Un documento A4 coi tre pesi di Public Sans, e la misura dei testi.
 * @param JsPDF      il costruttore di jsPDF (caricato a parte nel browser)
 * @param caratteri  { normal, semibold, bold }: i TTF in base64
 * @param opzioni    { orientamento: 'portrait' | 'landscape', compress }
 */
export function nuovoDocumento(JsPDF, caratteri, { orientamento = 'portrait', compress = true } = {}) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: orientamento, compress });
  for (const peso of PESI) {
    const file = `PublicSans-${peso}.ttf`;
    doc.addFileToVFS(file, caratteri[peso]);
    doc.addFont(file, FAMIGLIA, peso);
  }
  const misura = (testo, peso, corpo) => {
    doc.setFont(FAMIGLIA, peso);
    doc.setFontSize(corpo);
    return doc.getTextWidth(testo);
  };
  return { doc, misura };
}

/** Le istruzioni di ogni pagina, disegnate. La prima pagina c'è già. */
export function disegnaPagine(doc, pagine, orientamento = 'portrait') {
  pagine.forEach((istruzioni, i) => {
    if (i > 0) doc.addPage('a4', orientamento);
    for (const d of istruzioni) {
      if (d.tipo === 'rettangolo') {
        doc.setFillColor(d.riempi);
        doc.rect(d.x, d.y, d.larghezza, d.altezza, 'F');
      } else if (d.tipo === 'linea') {
        doc.setDrawColor(d.colore);
        doc.setLineWidth(d.spessore);
        doc.setLineDashPattern(d.puntini ? [0.3, 0.6] : [], 0);
        doc.line(d.x1, d.y1, d.x2, d.y2);
      } else {
        doc.setFont(FAMIGLIA, d.peso);
        doc.setFontSize(d.corpo);
        doc.setTextColor(d.colore);
        doc.text(d.testo, d.x, d.y, d.allinea ? { align: d.allinea } : undefined);
      }
    }
  });
  doc.setLineDashPattern([], 0);
}
