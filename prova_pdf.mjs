// Prove del PDF della seduta generato dall'app (src/lib/pdfSeduta.js).
// Girano prima di ogni build, in Node, con jsPDF e il carattere veri:
// lo stesso codice che nel browser scrive il file da condividere.
//
// Si prova quello che a bordo vasca non si vede finché non è tardi: che
// il file sia un PDF, che gli accenti e i simboli ci siano davvero (un
// glifo che Public Sans non ha, jsPDF lo fa sparire senza dire niente),
// che una seduta normale stia in una pagina e una lunghissima vada su
// due, col «(segue)» e il numero di pagina.
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import { foglioSeduta } from './src/lib/dominio.js';
import { analizzaTesto } from './src/lib/analizzatore.js';
import { sedutaDaLettura } from './src/lib/importaTesto.js';
import {
  testoPerPdf, carattereCoperto, creaPdfSeduta, CORPI, CORPO_MINIMO,
} from './src/lib/pdfSeduta.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};
const vero = (cosa, avuto) => dice(cosa, !!avuto, true);

const CARATTERI = Object.fromEntries(['normal', 'semibold', 'bold'].map((peso) => {
  const nome = { normal: 'Regular', semibold: 'SemiBold', bold: 'Bold' }[peso];
  return [peso, readFileSync(`./src/assets/font/PublicSans-${nome}-pdf.ttf`).toString('base64')];
}));
const SOCIETA = { nome: 'Nuoto Prova' };
const CATEGORIE = [{ codice: 'ES_A', nome: 'Esordienti A' }];
const dalTesto = (testo) => sedutaDaLettura(analizzaTesto(testo).sezioni);
const pdfDi = (seduta) => creaPdfSeduta(
  jsPDF, foglioSeduta(seduta, { societa: SOCIETA, categorie: CATEGORIE }), CARATTERI, { compress: false });
const testiDi = (pagina) => pagina.filter((d) => d.tipo === 'testo').map((d) => d.testo);

// =====================================================================
// I CARATTERI
// =====================================================================
{
  dice('pdf: gli accenti restano', testoPerPdf('Velocità è più già così'), 'Velocità è più già così');
  dice('pdf: i simboli del foglio restano', testoPerPdf('×3 · — – … ’ “ ” €'), '×3 · — – … ’ “ ” €');
  // Public Sans non ha la freccia, il pedice, primo e secondo: diventano
  // un equivalente scritto, non un buco.
  dice('pdf: freccia, pedice, primi e secondi', testoPerPdf('A2 → B1 VO₂ 1′30″'), 'A2 -> B1 VO2 1\'30"');
  // Tutto il resto (un'emoji, un ideogramma) si vede che c'era.
  dice('pdf: quello che non c\'è diventa ?', testoPerPdf('forte 💪 水'), 'forte ? ?');
  dice('pdf: la e con l\'accento scritto a parte diventa una lettera sola', testoPerPdf('Velocità'), 'Velocità');
  dice('pdf: il vuoto resta vuoto', [testoPerPdf(''), testoPerPdf(null), testoPerPdf(undefined)], ['', '', '']);
  const ogni = testoPerPdf('àèéìòù ÀÈÉÌÒÙ çñ ·—–×→₂′″✓✕⋮ «» °± @%&');
  vero('pdf: dopo testoPerPdf ogni carattere sta nel carattere', Array.from(ogni).every(carattereCoperto));
}

// =====================================================================
// UN PDF VERO, CON ACCENTI E SIMBOLI
// =====================================================================
const CORTA = {
  titolo: 'Velocità e soglia → test', data: '2026-10-19', categorie: ['ES_A'], note: 'Pinne e tavoletta.\nCronometrare i 50.',
  sezioni: dalTesto([
    'Riscaldamento', '400 stile @7:00', '4x50 gambe pinne @1:00', '',
    'Parte centrale', '3x', '8x50 @45" A2', '', '200 sciolto', '',
    'Velocità', '6x25 sprint @1:00 C3', '',
    'Mezzofondo', '4x200 @3:00 B1', '',
    'Palestra', '3x10 piegamenti',
  ].join('\n')),
};
{
  const { doc, impaginazione } = pdfDi(CORTA);
  const testo = doc.output();
  vero('pdf: comincia come un PDF', testo.startsWith('%PDF-'));
  vero('pdf: finisce come un PDF', testo.trimEnd().endsWith('%%EOF'));
  dice('pdf: una pagina', doc.getNumberOfPages(), 1);
  vero('pdf: il carattere è incorporato', testo.includes('/FontFile2'));
  // I caratteri arrivano nel file: la mappa ToUnicode dice quali glifi
  // ci sono e cosa vogliono dire. à, ×, ·, — e la freccia diventata «->».
  for (const [ch, cp] of [['à', '00e0'], ['×', '00d7'], ['·', '00b7'], ['—', '2014'], ['>', '003e']]) {
    vero(`pdf: nel file c'è ${ch}`, new RegExp(`<[0-9a-f]+><${cp}>`, 'i').test(testo));
  }
  dice('pdf: la freccia non c\'è come glifo', /<[0-9a-f]+><2192>/i.test(testo), false);

  // ---- la seduta corta sta in una pagina, al corpo pieno
  dice('pdf corta: corpo pieno', impaginazione.corpo, 11);
  const testi = testiDi(impaginazione.pagine[0]);
  vero('pdf corta: il titolo, con la freccia scritta', testi.includes('Velocità') && testi.includes('->'));
  vero('pdf corta: le sezioni in maiuscolo', ['RISCALDAMENTO', 'CENTRALE', 'PALESTRA'].every((t) => testi.includes(t)));
  vero('pdf corta: il blocco e la palestra', testi.includes('×3') && testi.includes("a secco · 20'"));
  vero('pdf corta: i totali', ['2000 m', '2150 m', '2800 m'].every((t) => testi.includes(t)));
  vero('pdf corta: niente numero di pagina', !testi.some((t) => /^\d+\/\d+$/.test(t)));
  vero('pdf corta: niente (segue)', !testi.includes('(segue)'));
}

// =====================================================================
// IL CORPO SCENDE PRIMA DI ANDARE SU DUE PAGINE
// =====================================================================
const righe = (n, passo = 0) => Array.from({ length: n }, (_, i) => `${4 + ((i + passo) % 5)}x100 @1:${30 + (i % 3) * 5} A2`);
{
  // Abbastanza righe da non stare a 11 pt, poche da stare a 9.
  let trovata = null;
  for (let n = 20; n <= 60 && !trovata; n++) {
    const { impaginazione } = pdfDi({ titolo: 'Media', data: '2026-10-19', sezioni: dalTesto(['Centrale', ...righe(n)].join('\n')) });
    if (impaginazione.pagine.length === 1 && impaginazione.corpo < 11) trovata = impaginazione;
  }
  vero('pdf media: c\'è una seduta che sta in una pagina solo rimpicciolendo', trovata);
  if (trovata) vero('pdf media: il corpo non scende sotto il minimo', trovata.corpo >= CORPO_MINIMO && CORPI.includes(trovata.corpo));
}

// =====================================================================
// LA LUNGHISSIMA: DUE PAGINE, (segue), 1/2
// =====================================================================
{
  const lunga = {
    titolo: 'Fondo lunghissimo', data: '2026-10-19',
    sezioni: dalTesto(['Riscaldamento', '800 stile @12:00', '', 'Centrale', ...righe(60)].join('\n')),
  };
  const { doc, impaginazione } = pdfDi(lunga);
  dice('pdf lunga: due pagine', [impaginazione.pagine.length, doc.getNumberOfPages()], [2, 2]);
  dice('pdf lunga: al corpo minimo', impaginazione.corpo, CORPO_MINIMO);
  const [p1, p2] = impaginazione.pagine.map(testiDi);
  vero('pdf lunga: 1/2 sulla prima', p1.includes('1/2'));
  vero('pdf lunga: 2/2 sulla seconda', p2.includes('2/2'));
  vero('pdf lunga: la sezione spezzata riprende col titolo e (segue)', p2.includes('CENTRALE') && p2.includes('(segue)'));
  vero('pdf lunga: il (segue) non sulla prima', !p1.includes('(segue)'));
  vero('pdf lunga: i totali in fondo, sulla seconda', p2.includes('Totale') && !p1.includes('Totale'));
  // Le righe sono tutte, una volta sola: 60 della centrale più quella
  // del riscaldamento. Contate dalle colonne dei metri a destra.
  const metriRiga = (p) => p.filter((d) => d.tipo === 'testo' && d.allinea === 'right' && /^\d+ m$/.test(d.testo) && d.corpo < 9).length;
  dice('pdf lunga: tutte le righe, una volta sola', impaginazione.pagine.map(metriRiga).reduce((a, b) => a + b, 0), 61);

  // Niente fuori dal foglio: dentro i margini, il numero di pagina nel
  // margine basso.
  const fuori = impaginazione.pagine.flat().filter((d) => {
    const ys = d.tipo === 'linea' ? [d.y1, d.y2] : [d.y];
    const xs = d.tipo === 'linea' ? [d.x1, d.x2] : [d.x];
    return ys.some((y) => y < 14 || y > 297 - 8) || xs.some((x) => x < 14 - 0.01 || x > 196 + 0.01);
  });
  dice('pdf lunga: niente fuori dai margini', fuori.map((d) => d.testo || 'linea'), []);
  // La testa di una sezione non resta mai sola in fondo a una pagina.
  for (const p of impaginazione.pagine) {
    const ultimi = testiDi(p).filter((t) => !/^\d+\/\d+$/.test(t)).slice(-3);
    vero('pdf lunga: nessuna testa sola in fondo', !ultimi.includes('CENTRALE') || ultimi.at(-1) !== 'CENTRALE');
  }
}

// =====================================================================
// QUANTO SERVE, NON DI PIÙ: una seduta da due pagine non ne prende tre
// =====================================================================
// Una sezione sola da 40 righe non sta in una pagina a 9 pt con la
// testata, ma ci sta da sola: spostarla intera alla pagina dopo lasciava
// la prima con la sola testata, e i totali finivano su una terza.
{
  const { impaginazione } = pdfDi({ titolo: 'Quaranta', data: '2026-10-19', sezioni: dalTesto(['Centrale', ...righe(40)].join('\n')) });
  dice('pdf 40 righe: due pagine, non tre', impaginazione.pagine.length, 2);
  const righeSullaPrima = impaginazione.pagine[0].filter((d) => d.tipo === 'testo' && d.allinea === 'right' && /^\d+ m$/.test(d.testo) && d.corpo < 9).length;
  vero('pdf 40 righe: la prima pagina non è vuota', righeSullaPrima >= 30);
}

// =====================================================================
// LA BOZZA VUOTA: il PDF si fa lo stesso
// =====================================================================
{
  const { doc, impaginazione } = pdfDi({ sezioni: [] });
  dice('pdf vuota: una pagina', doc.getNumberOfPages(), 1);
  vero('pdf vuota: col titolo di ripiego', testiDi(impaginazione.pagine[0]).includes('allenamento'));
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ pdf della seduta: tutte le prove passate');
