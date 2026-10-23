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
import {
  foglioSeduta, reportGiornaliero, reportMensile, reportStagione, codiciDelGruppo,
} from './src/lib/dominio.js';
import { creaPdfReport } from './src/lib/pdfReport.js';
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

// =====================================================================
// IL REPORT PRESENZE (pdfReport.js), sui report veri di dominio.js
// =====================================================================
{
  const COGNOMI = ['Bianchi', 'Rossi', 'Verdi', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno'];
  const atletiN = (n) => Array.from({ length: n }, (_, k) => ({
    id: 'a' + k, cognome: COGNOMI[k % 10] + (k >= 10 ? ' ' + Math.floor(k / 10) : ''), nome: 'Anna',
    categoria_override: 'ESO_A1',
  }));
  const codici = codiciDelGruppo(['Esordienti A']);
  // Ottobre 2026: 31 giorni. Sedute il lunedì, mercoledì e venerdì fino
  // a oggi (il 23); il 14 due sedute, così una casella porta due stati.
  const giorni = [2, 5, 7, 9, 12, 14, 16, 19, 21, 23];
  const sedute = giorni.map((g) => ({ id: 's' + g, data: '2026-10-' + String(g).padStart(2, '0'), created_at: '2026-10-' + String(g).padStart(2, '0') + 'T07:00:00+00:00' }));
  sedute.push({ id: 's14b', data: '2026-10-14', created_at: '2026-10-14T16:00:00+00:00' });
  const presenzeDi = (atleti) => atleti.flatMap((a, k) => sedute.map((s, i) => ({
    seduta_id: s.id, atleta_id: a.id, data: s.data, stato: ['P', 'P', 'R', 'A', 'G'][(i + k) % 5],
  })));
  const testata = { titolo: 'Presenze · Ottobre 2026', sotto: 'Esordienti A', societa: 'Nuoto Prova' };
  const pdfReport = (report, forma) => creaPdfReport(jsPDF, report, forma, testata, CARATTERI, { compress: false });

  // ---- il mese: A4 orizzontale, 31 colonne che si leggono
  const atleti = atletiN(12);
  const mese = reportMensile({ mese: '2026-10', oggi: '2026-10-23', atleti, codici, sedute, presenze: presenzeDi(atleti) });
  const { doc: docMese, impaginazione: im } = pdfReport(mese, 'mese');
  dice('report mese: orizzontale', [im.orientamento, Math.round(docMese.internal.pageSize.getWidth())], ['landscape', 297]);
  dice('report mese: una pagina con 12 atleti', im.pagine.length, 1);
  dice('report mese: 31 giorni più nome e percentuale', im.colonne.length, 33);
  const colGiorno = im.colonne[1];
  vero('report mese: la colonna di un giorno è larga almeno 6,5 mm', colGiorno >= 6.5);
  const testiMese = im.pagine[0].filter((d) => d.tipo === 'testo');
  vero('report mese: i numeri dei giorni ci sono tutti, dall\'1 al 31',
    Array.from({ length: 31 }, (_, i) => String(i + 1)).every((n) => testiMese.some((d) => d.testo === n && d.peso === 'bold')));
  // Due sedute lo stesso giorno: la casella porta tutti e due gli stati,
  // e sta dentro la sua colonna.
  const doppie = testiMese.filter((d) => /^[PRAG]{2}$/.test(d.testo));
  vero('report mese: c\'è una casella con due stati', doppie.length > 0);
  const larga = Math.max(...doppie.map((d) => docMese.setFont('PublicSans', d.peso).setFontSize(d.corpo).getTextWidth(d.testo)));
  vero('report mese: due stati stanno nella colonna', larga < colGiorno - 1.2);
  // I giorni futuri: grigi, e senza stati.
  vero('report mese: i giorni futuri hanno lo sfondo', im.pagine[0].some((d) => d.tipo === 'rettangolo'));
  const niente = im.pagine.flat().filter((d) => {
    const xs = d.tipo === 'linea' ? [d.x1, d.x2] : d.tipo === 'rettangolo' ? [d.x, d.x + d.larghezza] : [d.x];
    const ys = d.tipo === 'linea' ? [d.y1, d.y2] : d.tipo === 'rettangolo' ? [d.y, d.y + d.altezza] : [d.y];
    return xs.some((x) => x < 10 - 0.01 || x > 287 + 0.01) || ys.some((y) => y < 10 - 0.01 || y > 210 - 8);
  });
  dice('report mese: niente fuori dai margini', niente.map((d) => d.testo || d.tipo), []);
  vero('report mese: un PDF', docMese.output().startsWith('%PDF-'));

  // ---- tanti atleti: la tabella continua, coi titoli, e c'è 1/2
  const tanti = atletiN(45);
  const meseLungo = reportMensile({ mese: '2026-10', oggi: '2026-10-23', atleti: tanti, codici, sedute, presenze: presenzeDi(tanti) });
  const { impaginazione: il } = pdfReport(meseLungo, 'mese');
  dice('report lungo: due pagine', il.pagine.length, 2);
  const [q1, q2] = il.pagine.map(testiDi);
  vero('report lungo: la riga dei titoli su tutte e due', q1.includes('Atleta') && q2.includes('Atleta'));
  vero('report lungo: 1/2 e 2/2', q1.includes('1/2') && q2.includes('2/2'));
  dice('report lungo: ogni atleta una volta sola',
    il.pagine.flat().filter((d) => d.tipo === 'testo' && d.peso === 'bold' && /^(Bianchi|Rossi|Verdi|Esposito|Romano|Colombo|Ricci|Marino|Greco|Bruno)$/.test(d.testo)).length, 45);

  // ---- il giorno e la stagione: verticali
  const g = reportGiornaliero({ seduta: sedute[0], atleti, codici, presenze: presenzeDi(atleti) });
  const { doc: docGiorno, impaginazione: ig } = pdfReport(g, 'giorno');
  dice('report giorno: verticale', [ig.orientamento, Math.round(docGiorno.internal.pageSize.getWidth())], ['portrait', 210]);
  vero('report giorno: gli stati per esteso', testiDi(ig.pagine[0]).includes('Presente') && testiDi(ig.pagine[0]).includes('Assente'));
  const st = reportStagione({ stagione: '2026/27', oggi: '2026-10-23', atleti, codici, presenze: presenzeDi(atleti) });
  const { impaginazione: is } = pdfReport(st, 'stagione');
  dice('report stagione: verticale, 12 mesi più nome e totale', [is.orientamento, is.colonne.length], ['portrait', 14]);
  vero('report stagione: i mesi', ['Set', 'Ott', 'Ago', 'Tot.'].every((m) => testiDi(is.pagine[0]).includes(m)));

  // ---- l'archiviato: la scritta accanto al nome, come a schermo
  const conArchiviato = [...atleti, { id: 'z', cognome: 'Zeta', nome: 'Ugo', categoria_override: 'ESO_A1', attivo: false }];
  const pres = [...presenzeDi(atleti), { seduta_id: 's2', atleta_id: 'z', data: '2026-10-02', stato: 'P' }];
  const conZ = reportMensile({ mese: '2026-10', oggi: '2026-10-23', atleti: conArchiviato, codici, sedute, presenze: pres, mostraArchiviati: true });
  const testiZ = testiDi(pdfReport(conZ, 'mese').impaginazione.pagine[0]);
  vero('report: «archiviato» accanto al nome', testiZ.includes('Zeta') && testiZ.includes('archiviato'));
  const senzaZ = reportMensile({ mese: '2026-10', oggi: '2026-10-23', atleti: conArchiviato, codici, sedute, presenze: pres });
  const testiSenza = testiDi(pdfReport(senzaZ, 'mese').impaginazione.pagine[0]);
  vero('report: di default l\'archiviato non c\'è', !testiSenza.includes('Zeta') && !testiSenza.includes('archiviato'));

  // ---- nessun atleta: il PDF si fa lo stesso, e lo dice
  const vuoto = reportMensile({ mese: '2026-10', oggi: '2026-10-23', atleti: [], codici, sedute, presenze: [] });
  vero('report vuoto: lo dice', testiDi(pdfReport(vuoto, 'mese').impaginazione.pagine[0]).includes('Nessun'));
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ pdf della seduta e del report: tutte le prove passate');
