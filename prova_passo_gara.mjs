// Prove della D, il passo gara. Girano prima di ogni build.
//
// Decisione del 25/10/2026, che sostituisce quella del 23: la D è una
// zona come le altre, il passo gara, SENZA distanza obbligatoria.
//   - la D da sola è valida, niente revisione;
//   - D200, D 200, «passo 200» si riconoscono come D; la distanza non si
//     salva a parte, la tiene il testo;
//   - nella tendina solo «D»;
//   - la D non si confonde MAI con DO (dorso) o DE;
//   - la D non sposta i metri: «8x50 D200» vale quanto «8x50».
// Nei grafici la D è una famiglia a sé, passo_gara: percentuali sulle
// quattro famiglie, la D con la sua quota sul totale.
import { analizzaTesto } from './src/lib/analizzatore.js';
import { sedutaDaLettura } from './src/lib/importaTesto.js';
import * as D from './src/lib/dominio.js';
import * as C from './src/lib/colori.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

const righeDi = (testo) => analizzaTesto(testo).sezioni.flatMap((s) => s.serie);
const lettura = (r) => ({ zona: r.zona, metri: r.metri, revisione: r.fiducia !== 'verde' });
const primaRiga = (testo) => lettura(righeDi(testo).find((r) => !r.apreBlocco && !r.chiudeBlocco));

// =====================================================================
// LE FORME DELLA D: tutte zona D, nessuna in revisione
// =====================================================================
for (const [riga, metri] of [
  ['8x50 @1:00 D', 400],
  ['8x50 @1:00 D200', 400],
  ['8x50 @1:00 D200SL', 400],
  ['8x50 D200 @1:00', 400],
  ['8x50 @1:00 d200', 400],
  ['4x100 @2:00 D 200', 400],
  ['6x50 passo 200 @1:00', 300],
  ['4x100 @1:40 passo gara 400', 400],
  ['8x50 @1:00 D150', 400],
  ['2x100 DO @2:00 D200', 200],
]) {
  dice(`«${riga}» è D`, primaRiga(riga), { zona: 'D', metri, revisione: false });
}
// La distanza non si salva a parte: la tiene il testo.
{
  const r = righeDi('8x50 @1:00 D200SL')[0];
  dice('la distanza resta nel testo, non in un campo', [r.notazione, 'garaDistanza' in r, 'garaStile' in r],
    ['8x50 @1:00 D200SL', false, false]);
}

// Da sola su una riga vale per quello che segue, come «C3», e vale zero
// metri: non è un 200 da nuotare.
for (const intestazione of ['D', 'D200', 'D 200', 'passo 200', 'Passo 200:']) {
  const r = righeDi(`${intestazione}\n8x50 @1:00\n4x100 @1:40`);
  dice(`«${intestazione}» da sola: le righe sotto la ereditano`,
    r.map((x) => [x.notazione, x.zona, x.metri, x.fiducia]),
    [['8x50 @1:00', 'D', 400, 'verde'], ['4x100 @1:40', 'D', 400, 'verde']]);
}
dice('Centrale D200: la sezione è a passo gara', righeDi('Centrale D200\n8x50 @1:00').map(lettura),
  [{ zona: 'D', metri: 400, revisione: false }]);
dice('4x(2x50 D200 + 100 A1): due andature',
  righeDi('4x(2x50 D200 + 100 A1)').filter((x) => x.metri > 0).map((x) => [x.zona, x.metri]),
  [['D', 400], ['A1', 400]]);
dice('4x D200: le righe del blocco a passo gara',
  righeDi('4x D200\n2x50 @1:00\n100 @2:00').filter((x) => !x.apreBlocco && !x.chiudeBlocco).map((x) => [x.zona, x.metri]),
  [['D', 400], ['D', 400]]);
// Dall'archivio vero: due distanze insieme. È D, e i metri restano quelli
// che il lettore dava prima (il «200/100» letto come scala: 300).
dice('Passo 200/100 dall\'archivio', primaRiga('Passo 200/100 CP + arrivo in virata 4x50 4x25').zona, 'D');
dice('Passo 200/100: i metri di prima', analizzaTesto('Passo 200/100 CP + arrivo in virata 4x50 4x25').metri, 300);

// =====================================================================
// DO E DE NON SONO MAI D
// =====================================================================
for (const [riga, zona] of [
  ['4x100 DO @1:40', ''],
  ['200 do', ''],
  ['8x50 DE su DO @1:00', ''],
  ['4x50 DE @1:00 B1', 'B1'],
  ['100 DE', ''],
  ['4x50 @1:00 DO200', ''],
  ['4x50 @1:00 DO 200', ''],
  ['4x50 d @1:00', ''],
  ['6x50 DE200', ''],
]) {
  const r = righeDi(riga)[0];
  dice(`«${riga}» non è D`, r.zona === 'D', false);
  if (zona) dice(`«${riga}» tiene la sua zona`, r.zona, zona);
}

// =====================================================================
// LA D NON SPOSTA I METRI
// =====================================================================
for (const [conD, senza] of [
  ['8x50 @1:00 D200', '8x50 @1:00'],
  ['8x50 @1:00 D', '8x50 @1:00'],
  ['6x100 + 100 D200', '6x100 + 100'],
  ['6x100 + 100 passo 200', '6x100 + 100'],
  ['4x(2x50 D200 + 100 A1)', '4x(2x50 + 100 A1)'],
  ['400 D400', '400'],
  ['4x100 @2:00 D 200', '4x100 @2:00'],
  ['3x200 passo gara 800', '3x200'],
  ['D200', ''],
]) {
  dice(`metri invariati: «${conD}»`, analizzaTesto(conD).metri, analizzaTesto(senza).metri);
  dice(`metri invariati nell'editor: «${conD}»`, D.metriDaNotazione(conD), senza ? D.metriDaNotazione(senza) : null);
}

// =====================================================================
// ARCHIVIO, EDITOR, TENDINA
// =====================================================================
{
  const [sez] = sedutaDaLettura(analizzaTesto('Centrale\n8x50 @1:00 D200SL\n4x100 @1:40 A2').sezioni);
  dice('import: la zona D, la distanza nel testo', sez.serie.map((r) => [r.zona, r.notazione, 'garaDistanza' in r]),
    [['D', '8x50 @1:00 D200SL', false], ['A2', '4x100 @1:40 A2', false]]);

  // Nell'editor: scrivendo la D nella notazione la riga senza zona prende
  // D; una zona scelta a mano non si tocca.
  dice('editor: riga senza zona → D', D.annotaPassoGara({ notazione: '8x50 D200', zona: '' }).zona, 'D');
  dice('editor: anche la D da sola', D.annotaPassoGara({ notazione: '8x50 D', zona: '' }).zona, 'D');
  dice('editor: la zona scelta a mano resta', D.annotaPassoGara({ notazione: '8x50 D200', zona: 'B1' }).zona, 'B1');
  dice('editor: DO non dà la D', D.annotaPassoGara({ notazione: '8x50 DO', zona: '' }).zona, '');

  // La D da sola è valida: nessun problema da segnalare.
  const seduta = { data: '2026-10-25', categorie: ['ESO_A1'], sezioni: [{ titolo: 'C', destinatari: ['*'],
    serie: [{ notazione: '8x50 D', metri: 400, zona: 'D' }] }] };
  dice('editor: la D è una zona valida', D.validaSeduta(seduta).map((p) => p.msg), []);

  // La tendina: la D c'è sempre, dal codice, e si legge «D». Mai D200.
  const DAL_DATABASE = [{ codice: 'A1', nome: 'Aerobico lento', famiglia: 'aerobico' }];
  const conD = D.zoneConLaD(DAL_DATABASE);
  dice('tendina: la D c\'è anche senza la 035', conD.map((z) => z.codice), ['A1', 'D']);
  dice('tendina: dopo la 035 una D sola',
    D.zoneConLaD([...DAL_DATABASE, { codice: 'D', famiglia: 'passo_gara' }]).filter((z) => z.codice === 'D').length, 1);
  const etichetta = (riga) => D.opzioniZona(conD, riga).find((o) => o.valore === (riga.zona || ''))?.etichetta;
  const letta = righeDi('Centrale\n8x50 @1:00 D200')[0];
  dice('tendina del revisore: «D»', etichetta(letta), 'D');
  dice('tendina dell\'editor: «D»', etichetta(sedutaDaLettura(analizzaTesto('Centrale\n8x50 @1:00 D200').sezioni)[0].serie[0]), 'D');
  dice('tendina: mai D200, nemmeno con un campo vecchio', etichetta({ zona: 'D', garaDistanza: 200 }), 'D');
  dice('tendina: una zona sconosciuta si vede', etichetta({ zona: 'PS' }), 'PS');

  // Stampa e PDF: la zona com'è, «D».
  const fo = D.foglioSeduta({ sezioni: [{ titolo: 'C', destinatari: ['*'],
    serie: [{ notazione: '8x50 D200', metri: 400, zona: 'D' }] }] }, {});
  dice('foglio: la zona D', fo.sezioni[0].righe[0].zona, 'D');
}

// =====================================================================
// I GRAFICI: la D è passo_gara
// =====================================================================
{
  const f = D.percentualiPerFamiglia({
    aerobico: 600, vo2: 200, lattacido: 100, alattacido: 100, passo_gara: 500, nonClassificati: 500,
  });
  dice('famiglie: le percentuali sulle quattro', [f.totale, f.classificati, f.pct.aerobico], [2000, 1000, 60]);
  dice('famiglie: la D col suo totale e la sua quota', [f.passoGara, f.pctPassoGara], [500, 25]);
  dice('famiglie: i senza zona a parte', f.senzaZona, 500);
  const g = D.percentualiPerFamiglia({ aerobico: 300, altro: 100, passo_gara: 100 });
  dice('famiglie: «altro» è senza zona, la D no', [g.senzaZona, g.passoGara], [100, 100]);
  dice('famiglie: vuoto, zero', D.percentualiPerFamiglia({}).pctPassoGara, 0);

  dice('riga della vista: D senza famiglia è passo gara', D.famigliaDiRiga({ zona: 'D', famiglia: null }), 'passo_gara');
  dice('riga della vista: la famiglia del database vince', D.famigliaDiRiga({ zona: 'B1', famiglia: 'aerobico' }), 'aerobico');

  const sezioni = [{ titolo: 'C', destinatari: ['*'], serie: [
    { notazione: '12x50 D200', metri: 600, zona: 'D' },
    { notazione: '400', metri: 400, zona: 'A1' },
    { notazione: '200', metri: 200, zona: '' },
  ] }];
  dice('editor: la D nel riepilogo per famiglia', D.caricoPerFamiglia(sezioni, 'Generale', D.zoneConLaD([{ codice: 'A1', famiglia: 'aerobico' }])),
    { aerobico: 400, vo2: 0, lattacido: 0, alattacido: 0, passo_gara: 600, nonClassificati: 200 });

  // IL DIFETTO DEL 25/10: in Dashboard la card «Passo gara» diceva 0 m e
  // la riga D della ripartizione 600. Le righe della Dashboard le fa
  // zonePerSpecializzazione, che dava la famiglia con l'elenco ZONE del
  // codice — e lì la D non c'era: la sua riga usciva «nonclass», cioè
  // senza zona. La card e la riga ora vengono dallo stesso conto.
  const righe = D.zonePerSpecializzazione(sezioni, 'Generale');
  dice('dashboard: la riga D ha la famiglia passo gara', righe.find((r) => r.zona === 'D')?.famiglia, 'passo_gara');
  const r = D.riepilogoCarico(righe);
  dice('dashboard: la card e la riga D dicono lo stesso numero', [r.famiglie.passoGara, r.perZona.D], [600, 600]);
  dice('dashboard: i senza zona sono solo i senza zona', r.famiglie.senzaZona, 200);
  dice('dashboard: il totale', r.famiglie.totale, 1200);

  dice('colore: la D ne ha uno suo',
    ['aerobico', 'vo2', 'lattacido', 'alattacido', 'altro'].some((k) => C.TINTA_FAMIGLIA[k] === C.TINTA_FAMIGLIA.passo_gara), false);
  dice('grafici: le serie', C.SERIE_FAMIGLIE.map((s) => s.chiave),
    ['aerobico', 'vo2', 'lattacido', 'alattacido', 'passo_gara', 'nonclass']);
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ passo gara: tutte le prove passate');
