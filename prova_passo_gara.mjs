// Prove della D come andatura di allenamento: il passo gara (deciso il
// 23/10/2026). Girano prima di ogni build.
//
// Le regole, dall'allenatore:
//   - si scrive sempre con la distanza di gara. D200, D200SL e «passo 200»
//     si riconoscono ovunque; «D 200» con lo spazio solo nella posizione
//     della zona (in fondo alla riga, da solo su una riga, nel titolo),
//     altrove la riga va in revisione;
//   - le distanze di gara sono 50, 100, 200, 400, 800, 1500: un'altra
//     distanza non si inventa, la riga va in revisione;
//   - la D non si confonde MAI con DO (dorso) o DE;
//   - la distanza di gara si salva accanto alla zona (garaDistanza,
//     garaStile); cambiando zona si toglie;
//   - stampa e PDF scrivono D200.
//
// E una regola che non è dell'allenatore ma della vasca: la D non sposta
// i metri. «8x50 D200» vale quanto «8x50». Il 200 della D è la gara a cui
// si pensa, non un tratto da nuotare.
import { analizzaTesto } from './src/lib/analizzatore.js';
import { sedutaDaLettura } from './src/lib/importaTesto.js';
import * as D from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

// La prima riga di lavoro letta dal testo, e i campi che contano qui.
const righeDi = (testo) => analizzaTesto(testo).sezioni.flatMap((s) => s.serie);
const lettura = (r) => ({
  zona: r.zona, distanza: r.garaDistanza ?? null, stile: r.garaStile ?? null,
  metri: r.metri, revisione: r.fiducia !== 'verde',
});
const primaRiga = (testo) => lettura(righeDi(testo).find((r) => !r.apreBlocco && !r.chiudeBlocco));

// =====================================================================
// LE FORME CHE SI RICONOSCONO SEMPRE
// =====================================================================
dice('D200 in fondo alla riga', primaRiga('8x50 @1:00 D200'),
  { zona: 'D', distanza: 200, stile: null, metri: 400, revisione: false });
dice('D200SL: lo stile attaccato', primaRiga('8x50 @1:00 D200SL'),
  { zona: 'D', distanza: 200, stile: 'SL', metri: 400, revisione: false });
dice('D100DO: passo 100 dorso', primaRiga('6x50 @1:00 D100DO'),
  { zona: 'D', distanza: 100, stile: 'DO', metri: 300, revisione: false });
dice('D200 in mezzo alla riga', primaRiga('8x50 D200 @1:00'),
  { zona: 'D', distanza: 200, stile: null, metri: 400, revisione: false });
dice('d200 minuscola: la d seguita da cifre non è altro', primaRiga('8x50 @1:00 d200'),
  { zona: 'D', distanza: 200, stile: null, metri: 400, revisione: false });
dice('passo 200', primaRiga('6x50 passo 200 @1:00'),
  { zona: 'D', distanza: 200, stile: null, metri: 300, revisione: false });
dice('passo gara 400', primaRiga('4x100 @1:40 passo gara 400'),
  { zona: 'D', distanza: 400, stile: null, metri: 400, revisione: false });
dice('passo 1500', primaRiga('3x400 @6:00 passo 1500'),
  { zona: 'D', distanza: 1500, stile: null, metri: 1200, revisione: false });
dice('D50', primaRiga('8x25 @1:00 D50'),
  { zona: 'D', distanza: 50, stile: null, metri: 200, revisione: false });

// «D 200» con lo spazio: nella posizione della zona sì.
dice('D 200 in fondo alla riga', primaRiga('4x100 @2:00 D 200'),
  { zona: 'D', distanza: 200, stile: null, metri: 400, revisione: false });

// Da sola su una riga vale per quello che segue, come «C3». E vale zero
// metri: non è un 200 da nuotare.
{
  for (const intestazione of ['D200', 'D 200', 'passo 200', 'Passo 200:']) {
    const r = righeDi(`${intestazione}\n8x50 @1:00\n4x100 @1:40`);
    dice(`«${intestazione}» da sola: le righe sotto la ereditano`,
      r.map((x) => [x.notazione, x.zona, x.garaDistanza ?? null, x.metri]),
      [['8x50 @1:00', 'D', 200, 400], ['4x100 @1:40', 'D', 200, 400]]);
  }
}

// Nel titolo della sezione.
{
  const r = righeDi('Centrale D200\n8x50 @1:00');
  dice('Centrale D200: la sezione è a passo 200', r.map(lettura),
    [{ zona: 'D', distanza: 200, stile: null, metri: 400, revisione: false }]);
}

// Più andature sulla stessa riga: si spezza, e il pezzo D tiene la sua.
{
  const r = righeDi('4x(2x50 D200 + 100 A1)').filter((x) => x.metri > 0);
  dice('4x(2x50 D200 + 100 A1): due andature', r.map((x) => [x.zona, x.garaDistanza ?? null, x.metri]),
    [['D', 200, 400], ['A1', null, 400]]);
}

// Il blocco con la D scritta sull'apertura.
{
  const r = righeDi('4x D200\n2x50 @1:00\n100 @2:00');
  dice('4x D200: le righe del blocco a passo 200',
    r.filter((x) => !x.apreBlocco && !x.chiudeBlocco).map((x) => [x.zona, x.garaDistanza ?? null, x.metri]),
    [['D', 200, 400], ['D', 200, 400]]);
}

// Lo stile della riga e la D insieme.
dice('2x100 DO D200: dorso, a passo 200', primaRiga('2x100 DO @2:00 D200'),
  { zona: 'D', distanza: 200, stile: null, metri: 200, revisione: false });

// =====================================================================
// IN REVISIONE
// =====================================================================
dice('D 200 fuori dalla posizione della zona', primaRiga('D 200 8x50 @1:00').revisione, true);
dice('D senza distanza: zona D proposta, da rivedere', primaRiga('8x50 @1:00 D'),
  { zona: 'D', distanza: null, stile: null, metri: 400, revisione: true });
dice('D150 non è una distanza di gara', primaRiga('8x50 @1:00 D150'),
  { zona: 'D', distanza: null, stile: null, metri: 400, revisione: true });
dice('D200XX: lo stile non si capisce', primaRiga('8x50 @1:00 D200XX'),
  { zona: 'D', distanza: null, stile: null, metri: 400, revisione: true });
dice('passo 150 non è una distanza di gara', primaRiga('6x50 passo 150').revisione, true);
// Dall'archivio vero (il CSV dei blocchi di SwimCoach): due passi gara
// sulla stessa riga, uno per le 50 e uno per le 25. La D c'è, ma quale
// distanza va a quale parte lo sa solo chi l'ha scritta: revisione. E il
// «/100» non deve diventare una scala: i metri restano 300.
dice('Passo 200/100: due distanze, in revisione',
  primaRiga('Passo 200/100 CP + arrivo in virata 4x50 4x25'),
  { zona: 'D', distanza: null, stile: null, metri: 300, revisione: true });
dice('D200/100: lo stesso', primaRiga('4x50 4x25 D200/100').revisione, true);
dice('passo 100 dall\'archivio', primaRiga('4x25 Passo 100 CP + arrivi in virata'),
  { zona: 'D', distanza: 100, stile: null, metri: 100, revisione: false });
{
  const n = righeDi('8x50 @1:00 D150')[0].note || '';
  dice('la riga in revisione dice perché', /150/.test(n) && /gara/.test(n), true);
}

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
  dice(`«${riga}» non è passo gara`, [r.zona === 'D', r.garaDistanza ?? null], [false, null]);
  if (zona) dice(`«${riga}» tiene la sua zona`, r.zona, zona);
}

// =====================================================================
// LA D NON SPOSTA I METRI
// =====================================================================
// Ogni riga con la D vale quanto la stessa riga senza. È la prova che
// conta di più: il 200 della D non è un tratto, e nella regola del
// «+ tratto» un numero in coda ferma la somma.
for (const [conD, senza] of [
  ['8x50 @1:00 D200', '8x50 @1:00'],
  ['6x100 + 100 D200', '6x100 + 100'],
  ['6x100 + 100 passo 200', '6x100 + 100'],
  ['4x(2x50 D200 + 100 A1)', '4x(2x50 + 100 A1)'],
  ['400 D400', '400'],
  ['4x100 @2:00 D 200', '4x100 @2:00'],
  ['3x200 passo gara 800', '3x200'],
  ['8x50 @1:00 D150', '8x50 @1:00'],
  ['D200', ''],
]) {
  const metri = (t) => analizzaTesto(t).metri;
  dice(`metri invariati: «${conD}»`, metri(conD), metri(senza));
  dice(`metri invariati anche nell'editor: «${conD}»`, D.metriDaNotazione(conD), senza ? D.metriDaNotazione(senza) : null);
}

// =====================================================================
// IN ARCHIVIO: garaDistanza e garaStile passano dal testo all'editor
// =====================================================================
{
  const [sez] = sedutaDaLettura(analizzaTesto('Centrale\n8x50 @1:00 D200SL\n4x100 @1:40 A2').sezioni);
  dice('import: la distanza e lo stile arrivano', sez.serie.map((r) => [r.zona, r.garaDistanza ?? null, r.garaStile ?? null]),
    [['D', 200, 'SL'], ['A2', null, null]]);
}

// =====================================================================
// L'EDITOR
// =====================================================================
{
  // Scrivendo la notazione con la D, la riga senza zona prende D e la
  // distanza; quella con una zona scelta a mano non si tocca.
  const vuota = D.annotaPassoGara({ notazione: '8x50 D200SL', zona: '' });
  dice('editor: riga senza zona → D200SL', [vuota.zona, vuota.garaDistanza, vuota.garaStile], ['D', 200, 'SL']);
  const scelta = D.annotaPassoGara({ notazione: '8x50 D200', zona: 'B1' });
  dice('editor: la zona scelta a mano resta', [scelta.zona, scelta.garaDistanza ?? null], ['B1', null]);
  const giaD = D.annotaPassoGara({ notazione: '8x50 D400', zona: 'D', garaDistanza: 200 });
  dice('editor: su una riga già D si aggiorna la distanza', giaD.garaDistanza, 400);
  const senzaStile = D.annotaPassoGara({ notazione: '8x50 D200', zona: 'D', garaDistanza: 200, garaStile: 'SL' });
  dice('editor: lo stile tolto dalla notazione se ne va', senzaStile.garaStile ?? null, null);
  // Una notazione senza D non toglie la distanza a una riga D: magari è
  // stata scelta dalla tendina.
  const tendina = D.annotaPassoGara({ notazione: '8x50', zona: 'D', garaDistanza: 100 });
  dice('editor: notazione senza D, la distanza scelta resta', tendina.garaDistanza, 100);

  // Cambiando zona la distanza si toglie.
  const r = { zona: 'D', garaDistanza: 200, garaStile: 'SL' };
  D.cambiaZona(r, 'B1');
  dice('editor: cambiando zona la distanza si toglie', r, { zona: 'B1' });
  const r2 = { zona: 'B1' };
  D.cambiaZona(r2, 'D');
  dice('editor: scegliendo D dalla tendina, distanza da scrivere', r2, { zona: 'D' });
  D.cambiaDistanzaGara(r2, 400);
  dice('editor: la distanza dalla tendina', r2.garaDistanza, 400);
  D.cambiaDistanzaGara(r2, '');
  dice('editor: tendina vuota, distanza tolta', 'garaDistanza' in r2, false);

  dice('le distanze di gara', D.DISTANZE_GARA, [50, 100, 200, 400, 800, 1500]);

  // La D senza distanza è un problema da segnalare, come la zona mancante.
  const seduta = (serie) => ({ data: '2026-10-24', categorie: ['ESO_A1'], sezioni: [{ titolo: 'C', destinatari: ['*'], serie }] });
  const msg = (serie) => D.validaSeduta(seduta(serie), ['A1', 'D']).map((p) => p.msg);
  dice('editor: D senza distanza va segnalata', msg([{ notazione: '8x50', metri: 400, zona: 'D' }]), ['Passo gara senza distanza di gara']);
  dice('editor: D con la distanza va bene', msg([{ notazione: '8x50', metri: 400, zona: 'D', garaDistanza: 200 }]), []);
}

// =====================================================================
// STAMPA E PDF: D200
// =====================================================================
{
  const fo = D.foglioSeduta({ sezioni: [{ titolo: 'C', destinatari: ['*'], serie: [
    { notazione: '8x50 D200SL', metri: 400, zona: 'D', garaDistanza: 200, garaStile: 'SL' },
    { notazione: '4x100', metri: 400, zona: 'D', garaDistanza: 400 },
    { notazione: '4x50', metri: 200, zona: 'D' },
    { notazione: '200', metri: 200, zona: 'A1', garaDistanza: 200 },
  ] }] }, {});
  dice('foglio: la zona con la gara', fo.sezioni[0].righe.map((r) => r.zona), ['D200SL', 'D400', 'D', 'A1']);
}

// =====================================================================
// LA TENDINA: la D c'è sempre, e si legge «D200»
// =====================================================================
// La tendina della zona prende le zone dal database, dove la D arriva con
// la 035. Prima di allora la riga D letta mostrava «—»: nel revisore e
// nell'editor non si poteva controllare niente, e tutto dipendeva
// dall'ordine dei passi al rilascio. La D la mette il codice.
{
  const DAL_DATABASE = [{ codice: 'A1', nome: 'Aerobico lento', famiglia: 'aerobico', ordine: 10 },
    { codice: 'B1', nome: 'Soglia', famiglia: 'aerobico', ordine: 30 }];
  const conD = D.zoneConLaD(DAL_DATABASE);
  dice('tendina: la D c\'è anche senza la 035', conD.map((z) => z.codice), ['A1', 'B1', 'D']);
  dice('tendina: con la sua famiglia', conD.find((z) => z.codice === 'D').famiglia, 'passo_gara');
  // Dopo la 035 la D arriva dal database: una sola, quella del database.
  const dopo035 = D.zoneConLaD([...DAL_DATABASE, { codice: 'D', nome: 'Passo gara', famiglia: 'passo_gara', ordine: 80 }]);
  dice('tendina: dopo la 035 una D sola', dopo035.filter((z) => z.codice === 'D').length, 1);
  dice('tendina: senza zone (senza linea, prima lettura)', D.zoneConLaD(null).map((z) => z.codice), ['D']);

  const scelta = (zone, riga) => D.opzioniZona(zone, riga).find((o) => o.valore === (riga.zona || ''))?.etichetta;

  // Una riga D200 importata: nel revisore (la riga letta) e nell'editor
  // (la riga in archivio) la tendina mostra D200, con le zone del
  // database di oggi, senza D.
  const lettura = analizzaTesto('Centrale\n8x50 @1:00 D200\n4x50 @1:00 D');
  const letta = lettura.sezioni[0].serie[0];
  dice('revisore: la riga D200 mostra D200', scelta(conD, letta), 'D200');
  const [sez] = sedutaDaLettura(lettura.sezioni);
  dice('editor: la riga D200 importata mostra D200', scelta(conD, sez.serie[0]), 'D200');
  dice('editor: la D senza distanza mostra D', scelta(conD, sez.serie[1]), 'D');
  dice('tendina: le altre zone col loro codice', scelta(conD, { zona: 'B1' }), 'B1');
  dice('tendina: la voce vuota', scelta(conD, { zona: '' }), '—');
  // Una zona che l'elenco non ha si mostra lo stesso, invece di «—».
  dice('tendina: una zona sconosciuta si vede', scelta(conD, { zona: 'PS' }), 'PS');
  dice('tendina: la D200SL', scelta(conD, { zona: 'D', garaDistanza: 200, garaStile: 'SL' }), 'D200SL');

  // Nel revisore, correggendo la zona da D a B1 la distanza di gara se ne
  // va, come nell'editor: accanto a un B1 sarebbe una distanza orfana.
  const [corretta] = sedutaDaLettura(analizzaTesto('Centrale\n8x50 @1:00 D200SL').sezioni, { '0:0': { zona: 'B1' } });
  dice('revisore: corretta in B1, la distanza si toglie',
    [corretta.serie[0].zona, corretta.serie[0].garaDistanza ?? null, corretta.serie[0].garaStile ?? null], ['B1', null, null]);
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ passo gara: tutte le prove passate');
