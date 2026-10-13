// Prove del passaggio testo → editor. Gira prima di ogni build.
//
// Questo passaggio ha perso campi tre volte (aSecco e durataMin con la
// 0.52.0, apreBlocco/moltiplicato/senzaMetri con la 0.54.0), sempre
// perché la conversione elencava i campi da TENERE. Ora elenca quelli da
// scartare, e queste prove stanno qui a dire se l'elenco è ancora giusto.
//
// Le prove partono dal TESTO, non da strutture montate a mano: si scrive
// quello che scriverebbe l'allenatore, si legge con l'analizzatore vero e
// si guarda cosa arriva in archivio. Una prova che costruisse la lettura
// a mano proverebbe solo che so copiare i campi che ho appena scritto.
import { analizzaTesto } from './src/lib/analizzatore.js';
import { sedutaDaLettura } from './src/lib/importaTesto.js';
import { eSecco, apertureNude, ricalcolaBlocchi, validaSeduta } from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};
const vero = (cosa, avuto) => dice(cosa, !!avuto, true);

// Il percorso completo: quello che fa "Usa questa seduta".
const importa = (testo, correzioni) =>
  sedutaDaLettura(analizzaTesto(testo).sezioni, correzioni);

// =====================================================================
// LAVORO A SECCO — la sezione "Palestra" resta a secco
// Il difetto: arrivava nell'editor come sezione d'acqua, con le colonne
// ZONA e METRI e senza striscia gialla, perché aSecco non passava.
// =====================================================================
{
  const sezioni = importa('Palestra\n3x10 piegamenti\n4x12 addominali\n\nRiscaldamento\n400 stile');

  dice('due sezioni', sezioni.length, 2);
  vero('la prima è a secco per eSecco()', eSecco(sezioni[0]));
  dice('e si porta la durata scritta a mano', sezioni[0].durataMin, 20);
  dice('niente metri sul lavoro a terra',
    sezioni[0].serie.map((s) => s.metri), [0, 0]);
  dice('e niente zona', sezioni[0].serie.map((s) => s.zona), ['', '']);
  vero('le righe restano marcate senza metri', sezioni[0].serie.every((s) => s.senzaMetri));

  // "4x12 addominali" con la regola della vasca farebbe 4×25 = 100 metri
  // nuotati che nessuno ha nuotato. È il motivo per cui aSecco esiste.
  vero('la sezione d\'acqua invece conta', sezioni[1].serie[0].metri === 400);
  vero('e non è a secco', !eSecco(sezioni[1]));
}

// =====================================================================
// A SECCO: comanda il campo, non il titolo
// Rinominare la sezione nell'editor non deve far rientrare i metri.
// =====================================================================
{
  const sezioni = importa('Palestra\n3x10 piegamenti');
  sezioni[0].titolo = 'Attivazione del giovedì';
  vero('rinominata resta a secco', eSecco(sezioni[0]));
  dice('e ricalcolare non le inventa metri',
    ricalcolaBlocchi(sezioni[0]).serie.map((s) => s.metri), [0]);
}

// =====================================================================
// BLOCCHI RIPETUTI — la struttura arriva intera
// =====================================================================
{
  const sezioni = importa('3x\n2x50 pull @0:50\n4x25 gambe @0:35');
  const serie = sezioni[0].serie;

  dice('l\'apertura porta il suo fattore', serie[0].apreBlocco, 3);
  dice('e non è un lavoro', serie[0].metri, 0);
  vero('l\'apertura è marcata senza metri', serie[0].senzaMetri);
  dice('le figlie sanno a quale blocco appartengono',
    serie.map((s) => s.moltiplicato ?? null), [null, 3, 3]);
  // 2x50 = 100 per giro, 3 giri = 300. Già moltiplicati in archivio:
  // chi legge somma e basta.
  dice('e i metri sono già il totale', serie.map((s) => s.metri), [0, 300, 300]);
}

// =====================================================================
// IL BLOCCO IMPORTATO NON SI MOLTIPLICA DUE VOLTE
//
// E questa prova NON deve dipendere da `metriManuali`.
//
// Quel campo sta sulle righe importate per un altro motivo — i metri
// vengono dal testo e non si rileggono dalla notazione — ma finché
// `moltiplicato` si perdeva era lui, per combinazione, a impedire il
// raddoppio: apertureNude scarta le figlie coi metri fissi (dominio.js
// :569) e ricalcolaBlocchi le salta (:499). Una prova lasciata così
// passerebbe anche col difetto rimesso dentro, e resterebbe verde il
// giorno che qualcuno toglie metriManuali per un motivo qualunque.
//
// Quindi qui le righe vengono spogliate di metriManuali prima di
// guardarle: a reggere deve restare solo `moltiplicato`.
//
// Dalla 0.56.10 l'import il campo non lo mette più sulle righe non
// corrette, e la spoliazione è diventata la norma. Resta lo stesso: se
// un giorno qualcuno lo rimettesse "per prudenza", questa prova deve
// continuare a non appoggiarcisi.
// =====================================================================
{
  const sezioni = importa('3x\n2x50 pull @0:50\n4x25 gambe @0:35');
  const sez = sezioni[0];
  for (const s of sez.serie) delete s.metriManuali;

  vero('senza metriManuali le righe sono davvero scoperte',
    sez.serie.every((s) => s.metriManuali === undefined));

  // Nessun blocco da sistemare: le figlie hanno già il fattore giusto.
  const nude = apertureNude({ sezioni: [sez] });
  dice('non c\'è niente da sistemare', nude.length, 0);

  // E il ricalcolo non tocca metri che sono già il totale.
  ricalcolaBlocchi(sez);
  dice('i metri restano quelli', sez.serie.map((s) => s.metri), [0, 300, 300]);
  dice('per un totale di 600',
    sez.serie.reduce((t, s) => t + s.metri, 0), 600);
}

// =====================================================================
// I CAMPI DEL LETTORE NON FINISCONO IN ARCHIVIO
// =====================================================================
{
  const sezioni = importa('Velocisti C3\n8x50 pinne sprint @1:30');
  const riga = sezioni[0].serie[0];

  for (const campo of ['fiducia', 'stile', 'attrezzi', 'modalita', 'descrizione']) {
    dice(`la riga non porta "${campo}"`, riga[campo], undefined);
  }
  for (const campo of ['zonaEreditata', 'particolare']) {
    dice(`la sezione non porta "${campo}"`, sezioni[0][campo], undefined);
  }

  // Attrezzi e modalità non spariscono: confluiscono nelle note.
  vero('gli attrezzi finiscono nelle note', /pinne/i.test(riga.note));
  vero('riga non corretta: non è a metri fissi', riga.metriManuali === undefined);
  vero('la sezione tiene i suoi destinatari', sezioni[0].destinatari.length > 0);
}

// =====================================================================
// LE CORREZIONI FATTE NEL REVISORE ARRIVANO
// Sono il motivo per cui questa conversione esiste: la riga che il
// lettore non ha capito, sistemata a mano prima di confermare.
// =====================================================================
{
  const letto = analizzaTesto('8x50 sprint @1:30');
  const sezioni = sedutaDaLettura(letto.sezioni, { '0:0': { zona: 'C3', metri: 500 } });
  dice('la zona corretta a mano vince', sezioni[0].serie[0].zona, 'C3');
  dice('e i metri pure', sezioni[0].serie[0].metri, 500);
}

// =====================================================================
// IL NUMERO DEL LETTORE ARRIVA ACCANTO AI METRI (0.56.10)
//
// `metriLetti` è quello che ha letto l'analizzatore, PRIMA delle
// correzioni del revisore. Senza, il controllo delle sedute non saprebbe
// dire se un numero l'ha scelto l'allenatore sulle sedute salvate prima
// della 0.56.10, dove metriManuali sta su tutte le righe importate.
// =====================================================================
{
  const sezioni = importa('Riscaldamento\n400 stile\n8x50 sprint @1:00');
  dice('riga non corretta: lettura e metri coincidono',
    sezioni[0].serie.map((s) => [s.metri, s.metriLetti]), [[400, 400], [400, 400]]);
}
{
  const letto = analizzaTesto('8x50 sprint @1:30');
  const sezioni = sedutaDaLettura(letto.sezioni, { '0:0': { metri: 500 } });
  dice('corretta nel revisore: metri dell\'allenatore', sezioni[0].serie[0].metri, 500);
  dice('e accanto resta il numero del lettore', sezioni[0].serie[0].metriLetti, 400);
}

// =====================================================================
// metriManuali SOLO SULLE RIGHE CORRETTE NEL REVISORE (0.56.10)
//
// Prima stava su tutte: serviva a non far riscrivere i metri dal vecchio
// metriDaNotazione, che leggeva diversamente dal lettore del testo. Dalla
// 0.56.6 il lettore è uno, e il tappo teneva fermi i metri di qualunque
// riga importata ritoccata nell'editor. Il seguito — notazione ritoccata
// dopo l'import — sta in prova_blocchi.mjs, dove ci sono i gesti.
// =====================================================================
{
  const letto = analizzaTesto('Riscaldamento\n400 stile\n8x50 sprint @1:00\n6x100 @1:40');
  const sezioni = sedutaDaLettura(letto.sezioni, {
    '0:0': { zona: 'A1' },              // corretta la zona, non i metri
    '0:1': { metri: 500 },              // corretti i metri
    '0:2': { metri: '600' },            // riportati al numero letto (l'input è testo)
  });
  const serie = sezioni[0].serie;
  dice('a metri fissi solo la riga coi metri cambiati',
    serie.map((s) => s.metriManuali === true), [false, true, false]);
  dice('la non corretta: metri e lettura coincidono', [serie[0].metri, serie[0].metriLetti], [400, 400]);
  dice('la corretta: lo scarto si vede', [serie[1].metri, serie[1].metriLetti], [500, 400]);
  dice('riportata al numero letto: nessuno scarto', [serie[2].metri, serie[2].metriLetti], [600, 600]);
}
{
  // Il blocco: la lettura è nella stessa unità dei metri, già moltiplicata.
  const serie = importa('3x\n2x50 pull @0:50\n4x25 gambe @0:35')[0].serie;
  vero('l\'apertura non porta lettura', !('metriLetti' in serie[0]));
  dice('le figlie sì, già moltiplicate come i metri',
    serie.slice(1).map((s) => s.metriLetti), [300, 300]);
}
{
  // La composizione vale zero apposta: anche quello è lettura, non
  // una correzione — se no il controllo la scambierebbe per una scelta.
  const serie = importa('4x100 @1:40\n50 sl\n50 do')[0].serie;
  dice('composizione: metri e lettura coincidono anche a zero',
    serie.map((s) => s.metri === s.metriLetti), [true, true, true]);
}

// =====================================================================
// LA COMPOSIZIONE ARRIVA IN ARCHIVIO (0.56.10)
// Prima `composizione` si scartava: lo zero restava, ma senza il perché,
// e ritoccando la riga nell'editor diventava lavoro. Il seguito col
// ritocco sta in prova_blocchi.mjs.
// =====================================================================
{
  const serie = importa('4x100 @1:40\n50 sl\n50 do')[0].serie;
  dice('le sotto-righe sono marcate composizione, la ripetuta no',
    serie.map((s) => s.composizione === true), [false, true, true]);
  dice('e valgono zero', serie.map((s) => s.metri), [400, 0, 0]);
}
{
  // Lo zero di una composizione non è un "Metri a zero" da segnalare.
  const sezioni = importa('4x100 @1:40\n50 sl\n50 do');
  const avvisi = validaSeduta({ data: '2026-10-13', categorie: ['X'], sezioni });
  dice('composizione: nessun avviso sui metri',
    avvisi.filter((p) => p.msg === 'Metri a zero'), []);
}
{
  // Metri scritti a mano nel revisore: non è più la descrizione di
  // un'altra riga, è un lavoro deciso dall'allenatore.
  const letto = analizzaTesto('4x100 @1:40\n50 sl\n50 do');
  const serie = sedutaDaLettura(letto.sezioni, { '0:1': { metri: 50 } })[0].serie;
  dice('corretta nel revisore: smette di essere composizione',
    [serie[1].composizione, serie[1].metriManuali, serie[1].metri], [undefined, true, 50]);
  vero('l\'altra resta composizione', serie[2].composizione === true);
}
{
  const sezioni = importa('Palestra\n3x10 piegamenti\n4x12 addominali');
  vero('a secco nessuna lettura', sezioni[0].serie.every((s) => !('metriLetti' in s)));
}
{
  // La riga che il lettore non ha capito arriva a zero, ma zero non è
  // quello che ha letto: null, e la correzione si vede come tale.
  const letto = analizzaTesto('Riscaldamento\nnuotata libera');
  const rossa = letto.sezioni[0]?.serie[0];
  vero('(premessa) l\'analizzatore la segna rossa', rossa?.fiducia === 'rossa');
  const sezioni = sedutaDaLettura(letto.sezioni, { '0:0': { metri: 300 } });
  dice('non capita: lettura null, metri dell\'allenatore',
    [sezioni[0].serie[0].metriLetti, sezioni[0].serie[0].metri], [null, 300]);
}

// =====================================================================
// LE RIGHE E LE SEZIONI VUOTE NON PASSANO
// =====================================================================
// =====================================================================
// LA RIGA VUOTA CHIUDE IL BLOCCO, anche in archivio
// Il difetto, in produzione dalla 0.56.10: nel testo "3x / 8x50 / (riga
// vuota) / 200" il blocco finiva alla riga vuota, ma in archivio la riga
// vuota non c'era. Il confine restava solo come ASSENZA di moltiplicato
// sul 200, e al primo gesto nella sezione il ricalcolo estendeva il ×3
// fino in fondo: 200 diventava 600, +400 m senza un avviso.
// =====================================================================
const struttura = (sez) => sez.serie.map((r) =>
  [r.notazione, r.metri, r.apreBlocco || 0, r.chiudeBlocco ? 'fine' : '']);
const ritocca = (sez, j, valore) => {          // cambiaNotazione, ridotto ai metri
  const r = sez.serie[j];
  r.notazione = valore;
  ricalcolaBlocchi(sez);
  return sez;
};
const prova = (cosa, fn) => {
  try { fn(); } catch (e) { male++; console.error(`✗ ${cosa}: ${e.message}`); }
};
prova('riga vuota', () => {
  const [sez] = importa('Parte centrale\n3x\n8x50\n\n200');
  dice('la riga vuota dentro un blocco diventa la sua fine', struttura(sez), [
    ['3x', 0, 3, ''], ['8x50', 1200, 0, ''], ['', 0, 0, 'fine'], ['200', 200, 0, ''],
  ]);
  ritocca(sez, 1, '8x50 B1');
  const duecento = sez.serie.find((r) => r.notazione === '200');
  dice('dopo un gesto nella sezione il 200 resta 200', duecento.metri, 200);
  dice('…e fuori dal blocco', duecento.moltiplicato, undefined);
  dice('la fine non porta lettura', sez.serie.filter((r) => r.chiudeBlocco).some((r) => 'metriLetti' in r), false);
  dice('e la fine non è una riga senza notazione',
    validaSeduta({ categorie: ['X'], sezioni: [sez] }).filter((p) => p.msg === 'Manca la notazione'), []);
});
prova('la riga con più andature chiude anche lei', () => {
  // Il suo blocco finisce con la parentesi: il 200 dopo è fuori.
  const [a] = importa('Parte centrale\n4x(8x50 B1 + 4x50 B2)\n200');
  ritocca(a, 1, '8x50 B1 forte');
  dice('"4x(8x50 B1 + 4x50 B2)" e poi 200: dopo un gesto il 200 resta 200',
    a.serie.find((r) => r.notazione === '200').metri, 200);
  // E chiude quello sopra: le sue righe valgono un giro.
  const [b] = importa('Parte centrale\n3x\n8x50\n2x50 A2 + 4x25 C1\n200');
  ritocca(b, 1, '8x50 B1');
  dice('"3x / 8x50 / 2x50 A2 + 4x25 C1": dopo un gesto le righe sotto restano a un giro',
    b.serie.filter((r) => !r.apreBlocco && !r.chiudeBlocco).map((r) => r.metri), [1200, 100, 100, 200]);
});
prova('dove la fine non serve', () => {
  dice('un titolo chiude da sé, senza riga di fine',
    importa('Parte centrale\n3x\n8x50\nSciolto\n200').flatMap((z) => z.serie).some((r) => r.chiudeBlocco), false);
  dice('nemmeno la riga vuota prima del titolo',
    importa('Parte centrale\n3x\n8x50\n\nSciolto\n200').flatMap((z) => z.serie).some((r) => r.chiudeBlocco), false);
  dice('una riga vuota senza blocco non produce niente',
    struttura(importa('Parte centrale\n400\n\n200')[0]), [['400', 400, 0, ''], ['200', 200, 0, '']]);
  dice('fra due blocchi basta l\'apertura del secondo',
    struttura(importa('Parte centrale\n3x\n8x50\n\n2x\n100')[0]),
    [['3x', 0, 3, ''], ['8x50', 1200, 0, ''], ['2x', 0, 2, ''], ['100', 200, 0, '']]);
});

{
  dice('testo vuoto, nessuna sezione', importa('').length, 0);
  dice('solo un giorno in testa, nessuna sezione', importa('Lunedì 8 settembre').length, 0);
  dice('niente sezioni da una lettura assente', sedutaDaLettura(null).length, 0);
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ import dal testo: tutte le prove passate');
