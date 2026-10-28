// Prove dei gesti dell'editor della seduta (src/lib/gestiSeduta.js).
// Girano prima di ogni build.
//
// UN POSTO SOLO PER I GESTI. Fino al 28/10/2026 i gesti stavano dentro
// EditorSeduta: alcuni come funzioni del componente, quattro scritti
// direttamente nei onClick («+ serie», «+ ripetizione», «+ sezione»,
// «+ sezione a secco»). La vista per il telefono li deve chiamare
// uguali: due copie di codice che deve ricalcolare i blocchi e rimappare
// svolto sono il guasto del 900 invece di 3600. Qui si provano partendo
// dai gesti, e in fondo si controlla che i componenti non scrivano più
// la seduta da soli.
import { readFileSync, readdirSync } from 'node:fs';
import * as G from './src/lib/gestiSeduta.js';
import { TUTTI } from './src/lib/dominio.js';

let male = 0;
// Ordinato per chiave, come in prova_svolto.mjs: conta quale riga tiene
// quali metri, non in che ordine l'oggetto è stato costruito.
const ordinato = (x) => {
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) return x.map(ordinato);
  return Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordinato(x[k])]));
};
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(ordinato(avuto));
  const b = JSON.stringify(ordinato(atteso));
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

const nuova = () => ({ sezioni: [{ titolo: 'Centrale', destinatari: [TUTTI], serie: [] }], svolto: null });
const righe = (s, i = 0) => s.sezioni[i].serie.map((r) => (r.apreBlocco ? `×${r.apreBlocco}` : r.chiudeBlocco ? 'fine' : `${r.notazione}=${r.metri}`));

// =====================================================================
// AGGIUNGERE: serie, ripetizione, fine, sezione, sezione a secco
// =====================================================================
{
  const s = nuova();
  G.aggiungiRipetizione(s, 0);
  dice('+ ripetizione: nasce un blocco ×2 a zero metri',
    s.sezioni[0].serie[0], { notazione: '2x', metri: 0, zona: '', recupero: '', note: '', senzaMetri: true, apreBlocco: 2 });
  G.ripetiBlocco(s, 0, 0, 3);
  G.aggiungiSerie(s, 0);
  G.cambiaNotazione(s, 0, 1, '4x50');
  dice('una serie aggiunta sotto il ×3 prende il fattore', righe(s), ['×3', '4x50=600']);
  dice('e porta il fattore scritto', s.sezioni[0].serie[1].moltiplicato, 3);
  G.aggiungiSerie(s, 0);
  G.cambiaNotazione(s, 0, 2, '100');
  dice('anche la seconda: il blocco arriva in fondo', righe(s), ['×3', '4x50=600', '100=300']);
  G.fineInCoda(s, 0);
  G.aggiungiSerie(s, 0);
  G.cambiaNotazione(s, 0, 4, '200');
  dice('dopo la fine della ripetizione la riga non si moltiplica', righe(s), ['×3', '4x50=600', '100=300', 'fine', '200=200']);
  G.ripetiBlocco(s, 0, 0, 1);
  dice('ripeti 1 non fa niente: per sciogliere c\'è il tasto', righe(s), ['×3', '4x50=600', '100=300', 'fine', '200=200']);
  G.ripetiBlocco(s, 0, 0, 2);
  dice('ripeti 2: le figlie si riscalano', righe(s), ['×2', '4x50=400', '100=200', 'fine', '200=200']);
  G.sciogli(s, 0, 0);
  dice('sciogli: via apertura e fine, i metri a un giro', righe(s), ['4x50=200', '100=100', '200=200']);
}
{
  const s = nuova();
  G.aggiungiSezioneSecca(s);
  G.aggiungiSerie(s, 0);
  dice('+ esercizio a secco: senza zona', s.sezioni[0].serie[0].zona, '');
  G.cambiaNotazione(s, 0, 0, '4x12 trazioni');
  dice('a secco la notazione non fa metri', s.sezioni[0].serie[0].metri, 0);
  dice('in acqua invece + serie parte da A1', (() => { G.aggiungiSerie(s, 1); return s.sezioni[1].serie[0].zona; })(), 'A1');
}
{
  // + sezione a secco entra IN CIMA: tutte le chiavi di svolto scalano.
  const s = nuova();
  G.aggiungiSerie(s, 0);
  G.cambiaNotazione(s, 0, 0, '300');
  s.svolto = { righe: { '0-0': 250 } };
  G.aggiungiSezioneSecca(s);
  dice('+ sezione a secco: in cima', [s.sezioni[0].aSecco, s.sezioni[1].titolo], [true, 'Centrale']);
  dice('+ sezione a secco: i metri nuotati seguono la loro riga', s.svolto, { righe: { '1-0': 250 } });
  G.aggiungiSezione(s);
  dice('+ sezione: in fondo, per tutti', [s.sezioni.length, s.sezioni[2].destinatari], [3, [TUTTI]]);
  dice('+ sezione in fondo non sposta niente', s.svolto, { righe: { '1-0': 250 } });
}

// =====================================================================
// CAMBIARE: notazione, metri, zona, recupero, destinatari
// =====================================================================
{
  const s = nuova();
  G.aggiungiSerie(s, 0);
  G.cambiaNotazione(s, 0, 0, '8x50 D200');
  dice('la D nella notazione dà zona D solo se la zona è vuota: A1 resta', s.sezioni[0].serie[0].zona, 'A1');
  G.cambiaZona(s, 0, 0, '');
  G.cambiaNotazione(s, 0, 0, '8x50 D200 ');
  dice('con la zona vuota la D la prende', s.sezioni[0].serie[0].zona, 'D');
  dice('e i metri non si spostano', s.sezioni[0].serie[0].metri, 400);
  G.cambiaMetri(s, 0, 0, '450');
  dice('metri scritti a mano: decide l\'allenatore', [s.sezioni[0].serie[0].metri, s.sezioni[0].serie[0].metriManuali], [450, true]);
  G.cambiaNotazione(s, 0, 0, '10x50');
  dice('dopo, la notazione non li riscrive', s.sezioni[0].serie[0].metri, 450);
  G.scriviRecupero(s, 0, 0, '@1:30');
  dice('il recupero mentre si scrive resta com\'è', s.sezioni[0].serie[0].recupero, '@1:30');
  G.sistemaRecupero(s, 0, 0, '@@1:20');
  dice('il passo base diventa la ripartenza della distanza: 1:20 ai 100 sui 50',
    [s.sezioni[0].serie[0].base, s.sezioni[0].serie[0].recupero], ['1:20/100', '@0:40']);
  G.cambiaNotazione(s, 0, 0, '10x100');
  dice('cambiando la distanza la ripartenza si rifà dal passo base', s.sezioni[0].serie[0].recupero, '@1:20');
}
{
  const s = nuova();
  G.commutaDestinatario(s, 0, 'Velocità');
  dice('scegliere Velocità toglie Tutti', s.sezioni[0].destinatari, ['Velocità']);
  G.commutaDestinatario(s, 0, 'Fondo');
  dice('se ne aggiunge un altro', s.sezioni[0].destinatari, ['Velocità', 'Fondo']);
  G.commutaDestinatario(s, 0, 'Velocità');
  G.commutaDestinatario(s, 0, 'Fondo');
  dice('togliendo l\'ultimo torna Tutti', s.sezioni[0].destinatari, [TUTTI]);
  G.commutaDestinatario(s, 0, 'Fondo');
  G.commutaDestinatario(s, 0, TUTTI);
  dice('Tutti azzera la scelta', s.sezioni[0].destinatari, [TUTTI]);
}

// =====================================================================
// SPOSTARE E TOGLIERE: le chiavi di svolto seguono le righe
// =====================================================================
{
  const s = nuova();
  for (const n of ['100', '200', '300']) { G.aggiungiSerie(s, 0); G.cambiaNotazione(s, 0, s.sezioni[0].serie.length - 1, n); }
  s.svolto = { righe: { '0-0': 90, '0-2': 280 } };
  G.muoviRiga(s, 0, 2, 0);
  dice('sposta la terza in cima: le righe', righe(s), ['300=300', '100=100', '200=200']);
  dice('sposta la terza in cima: i metri nuotati la seguono', s.svolto, { righe: { '0-0': 280, '0-1': 90 } });
  G.muoviRiga(s, 0, 0, -1);
  dice('fuori dai bordi non si muove niente, nemmeno svolto', [righe(s), s.svolto], [['300=300', '100=100', '200=200'], { righe: { '0-0': 280, '0-1': 90 } }]);
  G.togliRiga(s, 0, 0);
  dice('togliere una riga: le chiavi sotto salgono', [righe(s), s.svolto], [['100=100', '200=200'], { righe: { '0-0': 90 } }]);
}
{
  const s = nuova();
  G.aggiungiSezione(s);
  G.aggiungiSerie(s, 1);
  s.svolto = { righe: { '1-0': 500 } };
  G.muoviSezione(s, 1, 0);
  dice('sposta la sezione: svolto la segue', s.svolto, { righe: { '0-0': 500 } });
  G.muoviSezione(s, 0, 5);
  dice('sezione fuori dai bordi: niente', s.svolto, { righe: { '0-0': 500 } });
  G.togliSezione(s, 1);
  dice('togliere la sezione vuota non tocca le altre chiavi', s.svolto, { righe: { '0-0': 500 } });
}

// =====================================================================
// UN POSTO SOLO: i componenti non scrivono la seduta da soli
// =====================================================================
// Chi tocca sezioni, serie o svolto lo fa con un gesto di gestiSeduta.js.
// Nei componenti non devono più comparire inserimenti, spostamenti o
// rimappature scritti a mano: se ricompaiono, la vista per il telefono
// avrebbe di nuovo un gesto suo, e prima o poi uno dei due dimentica
// ricalcolaBlocchi o la rimappatura.
for (const nome of readdirSync('./src/componenti')) {
  const testo = readFileSync(`./src/componenti/${nome}`, 'utf8');
  const vietati = [
    [/sezioni(\[[^\]]+\])?\s*\.\s*(push|unshift|splice)\s*\(/, 'sezioni.push/unshift/splice'],
    [/\.serie\s*=\s*\[/, '.serie = [...]'],
    [/serie\s*\.\s*(splice|push|unshift)\s*\(/, 'serie.splice/push/unshift'],
    [/svoltoDopo\w+\s*\(/, 'svoltoDopo…()'],
    [/ricalcolaBlocchi\s*\(/, 'ricalcolaBlocchi()'],
  ];
  for (const [re, cosa] of vietati) {
    if (re.test(testo)) dice(`${nome} non scrive la seduta a mano (${cosa})`, true, false);
  }
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ gesti dell\'editor: tutte le prove passate');
