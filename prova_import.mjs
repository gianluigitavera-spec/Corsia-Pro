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
import { eSecco, apertureNude, ricalcolaBlocchi } from './src/lib/dominio.js';

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

  for (const campo of ['fiducia', 'stile', 'attrezzi', 'modalita', 'composizione', 'descrizione']) {
    dice(`la riga non porta "${campo}"`, riga[campo], undefined);
  }
  for (const campo of ['zonaEreditata', 'particolare']) {
    dice(`la sezione non porta "${campo}"`, sezioni[0][campo], undefined);
  }

  // Attrezzi e modalità non spariscono: confluiscono nelle note.
  vero('gli attrezzi finiscono nelle note', /pinne/i.test(riga.note));
  vero('i metri vengono dal testo', riga.metriManuali === true);
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
// LE RIGHE E LE SEZIONI VUOTE NON PASSANO
// =====================================================================
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
