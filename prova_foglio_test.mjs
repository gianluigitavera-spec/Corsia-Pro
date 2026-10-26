// Prove del foglio da bordo vasca dei test (src/lib/pdfTest.js). Girano
// prima di ogni build, in Node, con jsPDF e il carattere veri.
//
// Il foglio si stampa prima del test e si riempie a mano: una riga per
// atleta (o un blocco, se le ripetute non stanno in una riga), con le
// caselle vuote per ogni ripetuta, per i passaggi se il tipo li prevede
// e per le bracciate. Si prova quello che a bordo vasca costa caro: che
// le caselle siano tante quante servono, che si possano scrivere a mano
// (non più strette di 12 mm), che i nomi siano nell'ordine
// dell'inserimento, e che in fondo restino le righe vuote.
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import { copiaModello } from './src/lib/test.js';
import {
  grigliaFoglio, impaginaFoglioTest, creaPdfFoglioTest, nomeFileFoglioTest, RIGHE_VUOTE,
} from './src/lib/pdfTest.js';

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
// Una misura finta per l'impaginazione: le prove guardano le caselle, non
// la larghezza esatta dei nomi.
const misura = (testo, _peso, corpo) => String(testo).length * corpo * 0.18;

const conta = (g, tipo) => g.celle.filter((c) => c.tipo === tipo).length;

// =====================================================================
// LE CASELLE DI OGNI MODELLO, PER ATLETA
// =====================================================================
{
  const g = grigliaFoglio(copiaModello('T-1000'));
  dice('T-1000: 9 passaggi, il tempo, le bracciate', [conta(g, 'passaggio'), conta(g, 'tempo'), conta(g, 'bracciate')], [9, 1, 1]);
  dice('T-1000: 11 caselle, una riga, verticale', [g.caselle, g.linee.length, g.orientamento], [11, 1, 'portrait']);
  dice('T-1000: i passaggi ai 100, poi il tempo, poi le bracciate',
    g.celle.map((c) => c.etichetta), ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'tempo', 'br']);
}
{
  const g = grigliaFoglio(copiaModello('T-2000'));
  dice('T-2000: passaggi ai 200', g.celle.filter((c) => c.tipo === 'passaggio').map((c) => c.etichetta),
    ['200', '400', '600', '800', '1000', '1200', '1400', '1600', '1800']);
  dice('T-2000: 11 caselle, una riga, verticale', [g.caselle, g.linee.length, g.orientamento], [11, 1, 'portrait']);
}
{
  const g = grigliaFoglio(copiaModello('15x100'));
  dice('15x100: 15 tempi e 15 bracciate, niente passaggi',
    [conta(g, 'tempo'), conta(g, 'bracciate'), conta(g, 'passaggio')], [15, 15, 0]);
  // Su una riga sarebbero 30 caselle da 8 mm: troppo strette per un tempo
  // scritto a mano. Una serie per riga.
  dice('15x100: 30 caselle, una serie per riga, verticale',
    [g.caselle, g.linee.length, g.linee.map((l) => l.length), g.orientamento], [30, 3, [10, 10, 10], 'portrait']);
  dice('15x100: la seconda riga comincia dalla sesta ripetuta', g.celle[g.linee[1][0]].ripetuta, 6);
}
{
  const g = grigliaFoglio(copiaModello('6x50'));
  dice('6x50: 6 tempi e 6 bracciate', [conta(g, 'tempo'), conta(g, 'bracciate')], [6, 6]);
  dice('6x50: 12 caselle, una riga, verticale', [g.caselle, g.linee.length, g.orientamento], [12, 1, 'portrait']);
}
{
  const g = grigliaFoglio(copiaModello('5x300'));
  dice('5x300: 5 tempi e 5 bracciate', [conta(g, 'tempo'), conta(g, 'bracciate')], [5, 5]);
  dice('5x300: 10 caselle, una riga, verticale', [g.caselle, g.linee.length, g.orientamento], [10, 1, 'portrait']);
}

// L'orientamento segue le colonne: oltre 12 per riga il foglio si gira,
// oltre 20 le ripetute vanno a capo dentro il blocco dell'atleta.
{
  const dieci = { ...copiaModello('6x50'), nome: '10x100', distanza: 100, ripetute: 10 };
  const g = grigliaFoglio(dieci);
  dice('10x100: 20 caselle in una riga, orizzontale', [g.caselle, g.linee.length, g.orientamento], [20, 1, 'landscape']);
  const venti = { ...copiaModello('6x50'), nome: '20x50', ripetute: 20 };
  const g2 = grigliaFoglio(venti);
  dice('20x50: 40 caselle, due righe da 20, orizzontale',
    [g2.caselle, g2.linee.map((l) => l.length), g2.orientamento], [40, [20, 20], 'landscape']);
  const senzaBracciate = { ...copiaModello('6x50'), misure: ['tempo'] };
  dice('un tipo che non misura le bracciate: solo i tempi', grigliaFoglio(senzaBracciate).caselle, 6);
  const lungo = { ...copiaModello('T-1000'), nome: 'T-1500', distanza: 1500, parziali_ogni: 50 };
  const g3 = grigliaFoglio(lungo);
  dice('1500 con passaggi ogni 50: 29 + tempo + br, a capo ogni 20',
    [g3.caselle, g3.linee.map((l) => l.length), g3.orientamento], [31, [20, 11], 'landscape']);
}

// =====================================================================
// L'IMPAGINAZIONE: i nomi in ordine, le righe vuote, le caselle scrivibili
// =====================================================================
const ATLETI = [
  { cognome: 'Rossi', nome: 'Mario' },
  { cognome: 'Bianchi', nome: 'Anna' },
  { cognome: 'Zanetti', nome: 'Luca' },
];
const foglio = (codice, extra = {}) => ({
  tipo: copiaModello(codice), data: '2026-10-26', vasca: 25, gruppi: ['Esordienti A'],
  societa: 'Nuoto Prova', atleti: ATLETI, ...extra,
});

for (const codice of ['T-1000', 'T-2000', '15x100', '6x50', '5x300']) {
  const imp = impaginaFoglioTest(foglio(codice), misura);
  const g = grigliaFoglio(copiaModello(codice));
  dice(`${codice}: i nomi nell'ordine dell'inserimento, poi ${RIGHE_VUOTE} righe vuote`,
    imp.righe, ['Rossi Mario', 'Bianchi Anna', 'Zanetti Luca', ...Array(RIGHE_VUOTE).fill('')]);
  dice(`${codice}: caselle disegnate = caselle per atleta × righe`, imp.caselleDisegnate, g.caselle * (ATLETI.length + RIGHE_VUOTE));
  vero(`${codice}: caselle larghe almeno 12 mm`, imp.larghezzaCasella >= 12);
  dice(`${codice}: una pagina`, imp.pagine.length, 1);
}
dice('cinque righe vuote in fondo, al massimo', RIGHE_VUOTE, 5);

// Le righe vuote riempiono solo la pagina in corso: nessuna pagina in più
// per una riga vuota (decisione del 26/10/2026). Il 15x100 con quattro
// atleti faceva nove blocchi da 27 mm, e l'ultima riga vuota finiva da
// sola su una seconda pagina.
{
  const quattro = [...ATLETI, { cognome: 'Verdi', nome: 'Sara' }];
  const imp = impaginaFoglioTest(foglio('15x100', { atleti: quattro }), misura);
  dice('15x100 con 4 atleti: una pagina', imp.pagine.length, 1);
  dice('15x100 con 4 atleti: i quattro nomi, poi le righe vuote che ci stanno',
    imp.righe, ['Rossi Mario', 'Bianchi Anna', 'Zanetti Luca', 'Verdi Sara', '', '', '', '']);
  const { doc } = creaPdfFoglioTest(jsPDF, foglio('15x100', { atleti: quattro }), CARATTERI);
  dice('15x100 con 4 atleti, il PDF vero: una pagina', doc.getNumberOfPages(), 1);
}
{
  // Gli atleti stessi vanno sulla pagina dopo quando serve: le righe
  // vuote no, e la pagina dopo ne ha fino a cinque.
  const nove = Array.from({ length: 9 }, (_, i) => ({ cognome: `Atleta${i + 1}`, nome: 'Prova' }));
  const imp = impaginaFoglioTest(foglio('15x100', { atleti: nove }), misura);
  dice('15x100 con 9 atleti: nessun atleta perso', imp.righe.filter(Boolean).length, 9);
  dice('15x100 con 9 atleti: sulla seconda pagina il nono e le righe vuote, al massimo cinque',
    imp.righe.slice(9).length <= RIGHE_VUOTE && imp.righe.slice(9).every((r) => r === ''), true);
  dice('15x100 con 9 atleti: due pagine', imp.pagine.length, 2);
}
{
  // Una pagina piena di atleti fino all'ultima riga: nessuna riga vuota,
  // e nessuna pagina in più.
  const otto = Array.from({ length: 8 }, (_, i) => ({ cognome: `Atleta${i + 1}`, nome: 'Prova' }));
  const imp = impaginaFoglioTest(foglio('15x100', { atleti: otto }), misura);
  dice('15x100 con la pagina piena di atleti: niente pagina per le righe vuote', imp.pagine.length, 1);
}
{
  const imp = impaginaFoglioTest(foglio('T-1000'), misura);
  // Il testo va a capo per parole: si guarda la testata unita.
  const testi = imp.pagine[0].filter((d) => d.tipo === 'testo').map((d) => d.testo);
  const unito = testi.join(' ');
  vero('in alto il test, la data, la vasca e il gruppo',
    ['T-1000', '26.10.2026', 'vasca da 25', 'Esordienti A'].every((x) => unito.includes(x)));
  vero('la società in alto a destra', testi.includes('Nuoto Prova'));
}
{
  const molti = Array.from({ length: 40 }, (_, i) => ({ cognome: `Atleta${String(i + 1).padStart(2, '0')}`, nome: 'Prova' }));
  const imp = impaginaFoglioTest(foglio('15x100', { atleti: molti }), misura);
  vero('15x100 con 40 atleti: più pagine', imp.pagine.length > 1);
  const intestazioni = imp.pagine.map((p) => p.filter((d) => d.tipo === 'testo' && d.testo === 'br').length);
  vero('la riga dei titoli torna su ogni pagina', intestazioni.every((n) => n > 0));
  const numeri = imp.pagine.map((p) => p.filter((d) => d.tipo === 'testo' && /^\d+\/\d+$/.test(d.testo)).map((d) => d.testo)).flat();
  dice('il numero di pagina su ognuna', numeri, imp.pagine.map((_, i) => `${i + 1}/${imp.pagine.length}`));
  dice('nessun atleta perso fra le pagine', imp.righe.filter(Boolean).length, 40);
}

// La versione senza nomi, dal tipo: una pagina intera di righe vuote, e
// data, vasca e gruppo da scrivere a mano.
{
  const imp = impaginaFoglioTest({ tipo: copiaModello('T-1000'), societa: 'Nuoto Prova', atleti: null }, misura);
  dice('senza nomi: una pagina', imp.pagine.length, 1);
  vero('senza nomi: almeno 15 righe, tutte vuote', imp.righe.length >= 15 && imp.righe.every((r) => r === ''));
  const unito = imp.pagine[0].filter((d) => d.tipo === 'testo').map((d) => d.testo).join(' ');
  vero('senza nomi: data, vasca e gruppo da scrivere', ['Data', 'Vasca', 'Gruppo'].every((x) => unito.includes(x)));
  vero('senza nomi: nessuna data stampata', !/\d{2}\.\d{2}\.\d{4}/.test(unito));
  const imp15 = impaginaFoglioTest({ tipo: copiaModello('15x100'), atleti: null }, misura);
  vero('senza nomi, 15x100: una pagina con almeno 6 atleti', imp15.pagine.length === 1 && imp15.righe.length >= 6);
}

// =====================================================================
// IL NOME DEL FILE E UN PDF VERO
// =====================================================================
dice('nome del file con la data', nomeFileFoglioTest({ tipo: { nome: 'T-1000' }, data: '2026-10-26' }), 'CorsiaPro_Test_T-1000_26-10-26');
dice('nome del file senza data', nomeFileFoglioTest({ tipo: { nome: '15x100' } }), 'CorsiaPro_Test_15x100_foglio');
dice('nome del file senza caratteri vietati', nomeFileFoglioTest({ tipo: { nome: 'Test 1/2: soglia' }, data: '2026-10-26' }),
  'CorsiaPro_Test_Test 1-2- soglia_26-10-26');
{
  const { doc } = creaPdfFoglioTest(jsPDF, foglio('15x100', {
    atleti: [{ cognome: 'Nicolò', nome: 'Gioè' }, ...ATLETI.slice(0, 2)],
  }), CARATTERI, { compress: false });
  const testo = doc.output();
  vero('è un PDF', testo.startsWith('%PDF-'));
  dice('una pagina', doc.getNumberOfPages(), 1);
}
{
  const { doc } = creaPdfFoglioTest(jsPDF, foglio('6x50', { tipo: { ...copiaModello('6x50'), ripetute: 20, nome: '20x50' } }), CARATTERI);
  dice('un tipo largo: il PDF è orizzontale', doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight(), true);
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ foglio dei test: tutte le prove passate');
