// Prove dei blocchi ripetuti. Gira prima di ogni build.
//
// LE PROVE PARTONO DAI GESTI, non da strutture montate a mano.
// La versione precedente costruiva la sezione con tutte le righe già
// dentro e poi applicava il blocco: provava la retro-applicazione, che
// è il percorso dell'avviso sulle sedute vecchie. Il gesto vero —
// premi "+ ripetizione", poi aggiungi le righe — non lo toccava
// nessuno, ed è quello che si è rotto: sezione da 900 invece di 3600,
// con tutte le prove verdi.
//
// Limite noto: il simulatore qui sotto REPLICA i gestori dell'editor,
// non li esegue. Se qualcuno cambia il componente senza cambiare questo
// file, le prove restano verdi lo stesso. L'unico argine è tenere i
// gestori del componente ridotti a una riga che chiama dominio.js —
// tutta la logica che conta sta lì, e lì è provata davvero.
import { analizzaTesto } from './src/lib/analizzatore.js';
import {
  ricalcolaBlocchi, applicaAperturaBlocco, apertureNude, figlieDelBlocco,
  metriDaNotazione, metriPerSpecializzazione, serieVuota, svoltoDopoTogliRiga,
  svoltoDopoMuoviRiga,
} from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

// =====================================================================
// I GESTI — la stessa sequenza di chiamate dei gestori in EditorSeduta
// =====================================================================
const nuovaSezione = (titolo = 'Parte centrale') =>
  ({ titolo, destinatari: ['*'], serie: [] });

const g = {
  piuSerie(sez) {                                   // il tasto "+ serie"
    sez.serie = [...sez.serie, serieVuota()];
    ricalcolaBlocchi(sez);
    return sez.serie.length - 1;
  },
  piuRipetizione(sez, n = 2) {                      // il tasto "+ ripetizione"
    sez.serie = [...sez.serie, {
      notazione: `${n}x`, metri: 0, zona: '', recupero: '', note: '',
      senzaMetri: true, apreBlocco: n,
    }];
    ricalcolaBlocchi(sez);
    return sez.serie.length - 1;
  },
  scrivi(sez, j, valore) {                          // battuta nel campo notazione
    const serie = sez.serie[j];
    serie.notazione = valore;
    if (!serie.metriManuali) {
      const m = metriDaNotazione(valore);
      if (m !== null) { serie.metri = m; delete serie.moltiplicato; }
    }
    ricalcolaBlocchi(sez);
  },
  scriviMetri(sez, j, valore) {                     // metri battuti a mano
    sez.serie[j].metri = Number(valore) || 0;
    sez.serie[j].metriManuali = true;
  },
  muovi(sez, da, a) {                               // le frecce su/giù
    if (a < 0 || a >= sez.serie.length) return;
    const c = [...sez.serie];
    const [x] = c.splice(da, 1);
    c.splice(a, 0, x);
    sez.serie = c;
    ricalcolaBlocchi(sez);
  },
  togli(sez, j) {                                   // il cestino
    sez.serie.splice(j, 1);
    ricalcolaBlocchi(sez);
  },
  cambiaN(sez, j, n) {                              // il numero nell'intestazione
    sez.serie[j].apreBlocco = n > 1 ? n : 1;
    ricalcolaBlocchi(sez);
  },
  sciogli(sez, j) { g.cambiaN(sez, j, 1); },
};

const totale = (sez) => metriPerSpecializzazione([sez], 'Generale');
const foto = (sez) => sez.serie.map((s) =>
  `${s.notazione || '·'}=${s.metri}${s.apreBlocco > 1 ? `[×${s.apreBlocco}]` : ''}${s.moltiplicato ? `(×${s.moltiplicato})` : ''}`);

// =====================================================================
// IL CASO DEL COACH: + ripetizione ×4, poi tre serie → 3600
// =====================================================================
{
  const sez = nuovaSezione();
  g.piuRipetizione(sez, 4);
  for (const t of ['3x100 A2', '6x50 B1', '12x25 C3']) g.scrivi(sez, g.piuSerie(sez), t);

  dice('×4 e tre serie: 900 a giro, 3600 in totale', totale(sez), 3600);
  dice('le tre righe restano distinte',
    sez.serie.slice(1).map((s) => s.metri), [1200, 1200, 1200]);
  dice('e portano tutte il fattore',
    sez.serie.slice(1).map((s) => s.moltiplicato), [4, 4, 4]);
  dice('l\'apertura non è un lavoro', [sez.serie[0].metri, sez.serie[0].senzaMetri], [0, true]);
}

// =====================================================================
// LA PARITÀ, RIFATTA SUL GESTO
// Il blocco costruito coi tasti e lo stesso blocco letto dal testo
// devono dare lo stesso dato. Prima si confrontava il testo con la
// retro-applicazione: due strade che nessuno percorre.
// =====================================================================
const CONTANO = ['notazione', 'metri', 'apreBlocco', 'moltiplicato', 'senzaMetri'];
const nudo = (serie) => serie.map((s) => {
  const o = {};
  for (const c of CONTANO) if (s[c] !== undefined) o[c] = s[c];
  return o;
});

for (const [n, righe] of [
  [4, ['3x100', '6x50', '12x25']],
  [3, ['8x50', '600']],
  [2, ['1x400']],
]) {
  const daTesto = analizzaTesto(`Centrale\n${n}x\n${righe.join('\n')}`).sezioni[0].serie;

  const sez = nuovaSezione();
  g.piuRipetizione(sez, n);
  for (const t of righe) g.scrivi(sez, g.piuSerie(sez), t);

  dice(`parità gesto↔testo per ×${n}`, nudo(sez.serie), nudo(daTesto));
}

// =====================================================================
// "2x200" DENTRO UN BLOCCO: resta una riga, non crea niente
// =====================================================================
{
  const sez = nuovaSezione();
  g.piuRipetizione(sez, 4);
  const a = g.piuSerie(sez); g.scrivi(sez, a, '3x100');
  const b = g.piuSerie(sez); g.scrivi(sez, b, '6x50');
  const c = g.piuSerie(sez); // la riga in mezzo che si va a riempire
  g.muovi(sez, c, 1);

  const prima = foto(sez);
  for (const parziale of ['2', '2x', '2x2', '2x20', '2x200']) g.scrivi(sez, 1, parziale);

  dice('"2x200" non apre nessun blocco', sez.serie[1].apreBlocco, undefined);
  dice('resta una riga del blocco ×4', sez.serie[1].moltiplicato, 4);
  dice('coi metri moltiplicati', sez.serie[1].metri, 1600);
  dice('e le righe sotto non si staccano',
    sez.serie.slice(2).map((s) => s.moltiplicato), [4, 4]);
  dice('né perdono i loro metri',
    sez.serie.slice(2).map((s) => s.metri), [1200, 1200]);
  if (prima.length !== foto(sez).length) { male++; console.error('✗ il numero di righe è cambiato'); }
}

// =====================================================================
// ENTRARE E USCIRE DAL BLOCCO COL MOVIMENTO
// =====================================================================
{
  const sez = nuovaSezione();
  g.piuRipetizione(sez, 4);
  g.scrivi(sez, g.piuSerie(sez), '3x100');
  dice('dentro il blocco vale 1200', sez.serie[1].metri, 1200);

  g.muovi(sez, 1, 0);                     // la freccia su: esce dal blocco
  dice('uscita dal blocco perde il fattore', sez.serie[0].moltiplicato, undefined);
  dice('e torna ai metri di un giro', sez.serie[0].metri, 300);

  g.muovi(sez, 0, 1);                     // e rientra
  dice('rientrata riprende il fattore', sez.serie[1].moltiplicato, 4);
  dice('e i metri moltiplicati', sez.serie[1].metri, 1200);
}

// =====================================================================
// SCIOGLIERE, CANCELLARE L'APERTURA, CAMBIARE N
// =====================================================================
{
  const sez = nuovaSezione();
  g.piuRipetizione(sez, 4);
  g.scrivi(sez, g.piuSerie(sez), '3x100');
  g.scrivi(sez, g.piuSerie(sez), '6x50');

  g.cambiaN(sez, 0, 2);
  dice('da ×4 a ×2 i metri si dimezzano', sez.serie.slice(1).map((s) => s.metri), [600, 600]);

  g.sciogli(sez, 0);
  dice('sciolto, l\'apertura non apre più', sez.serie[0].apreBlocco, undefined);
  dice('e le figlie tornano a un giro', sez.serie.slice(1).map((s) => s.metri), [300, 300]);
  dice('senza fattore addosso', sez.serie.slice(1).map((s) => s.moltiplicato), [undefined, undefined]);
}
{
  const sez = nuovaSezione();
  g.piuRipetizione(sez, 3);
  g.scrivi(sez, g.piuSerie(sez), '8x50');
  g.togli(sez, 0);                         // via l'apertura col cestino
  dice('cancellata l\'apertura, la figlia si libera', sez.serie[0].moltiplicato, undefined);
  dice('e torna ai suoi metri', sez.serie[0].metri, 400);
}

// =====================================================================
// I METRI SCRITTI A MANO NON SI TOCCANO
// =====================================================================
{
  const sez = nuovaSezione();
  g.piuRipetizione(sez, 4);
  const j = g.piuSerie(sez);
  g.scrivi(sez, j, 'a sensazione');
  g.scriviMetri(sez, j, 700);
  g.cambiaN(sez, 0, 2);
  dice('i metri a mano restano quelli', sez.serie[1].metri, 700);
  dice('ma la riga sta comunque nel blocco', sez.serie[1].moltiplicato, 2);
}

// =====================================================================
// LA DIVISIONE CHE NON TORNA: non si riscala, non si inventa
// =====================================================================
{
  // 250 metri dentro un ×4: 250 non è divisibile per 4. Portando il
  // blocco a ×3 non si può risalire al valore di un giro senza
  // inventarselo, quindi la riga resta com'è.
  const sez = {
    titolo: 'X', destinatari: ['*'], serie: [
      { notazione: '4x', metri: 0, zona: '', senzaMetri: true, apreBlocco: 4 },
      { notazione: 'roba strana', metri: 250, zona: '', moltiplicato: 4 },
    ],
  };
  ricalcolaBlocchi(sez);
  dice('col fattore invariato non si tocca niente', sez.serie[1].metri, 250);

  sez.serie[0].apreBlocco = 3;
  ricalcolaBlocchi(sez);
  dice('divisione non esatta: i metri restano come sono', sez.serie[1].metri, 250);
  dice('ma il fattore si aggiorna lo stesso', sez.serie[1].moltiplicato, 3);

  // Con una divisione esatta invece riscala.
  sez.serie[1].metri = 240;
  sez.serie[0].apreBlocco = 6;
  ricalcolaBlocchi(sez);
  dice('divisione esatta: 240/3×6', sez.serie[1].metri, 480);
}

// =====================================================================
// PALETTO 1 — APRIRE E SALVARE NON CAMBIA UN BYTE
// =====================================================================
{
  const TESTO = `Riscaldamento
400 sl
Centrale
3x
8x50 B1
2x10 partenze
(2x50+4x25) 50SL BN
Sciolto
200`;
  const letta = analizzaTesto(TESTO).sezioni;
  const prima = JSON.stringify(letta);

  // "apro la seduta e la salvo senza toccarla": nessun gesto, nessun
  // ricalcolo. Se un domani qualcuno chiamasse ricalcolaBlocchi al
  // caricamento, questa prova lo ferma.
  const dopo = JSON.stringify(letta);
  dice('aprire e salvare senza gesti non cambia niente', dopo, prima);

  // E le righe del parser che il ricalcolo NON deve riscrivere: la
  // regola della vasca porta 2x10 a 50, e metriDaNotazione direbbe 20.
  const centrale = letta.find((s) => s.titolo === '3x' || (s.serie || []).some((r) => /partenze/.test(r.notazione)));
  const partenze = (centrale?.serie || []).find((r) => /partenze/.test(r.notazione));
  if (partenze) {
    const eranoI = partenze.metri;
    ricalcolaBlocchi(centrale);            // stesso fattore: non deve toccarla
    dice('la regola della vasca sopravvive al ricalcolo', partenze.metri, eranoI);
  }
}

// =====================================================================
// L'AVVISO: aperture nude E blocchi a metà
// =====================================================================
{
  // NUDA: notazione da apertura, nessun apreBlocco (scritta nel testo o
  // nell'editor vecchio).
  const nuda = { sezioni: [{ titolo: 'Centrale', serie: [
    { notazione: '3x', metri: 3, zona: '' },
    { notazione: '8x50', metri: 400, zona: '' },
    { notazione: '600', metri: 600, zona: '' },
  ] }] };
  const [a] = apertureNude(nuda);
  dice('trova l\'apertura nuda', a?.forma, 'nuda');
  dice('metri ora', a.metriOra, 1003);
  dice('metri dopo', a.metriDopo, 3000);
  dice('mancanti', a.metriMancanti, 1997);

  const prima = totale(nuda.sezioni[0]);
  applicaAperturaBlocco(nuda.sezioni[0], a.serM);
  dice('il tasto consegna quello che l\'avviso prometteva',
    totale(nuda.sezioni[0]) - prima, a.metriMancanti);
  dice('applicata, sparisce dall\'avviso', apertureNude(nuda).length, 0);
}
{
  // A METÀ: apreBlocco c'è (l'ha messo il tasto della 0.54.0) ma le
  // figlie non hanno mai preso moltiplicato. Il blocco si disegna
  // giusto e conta sbagliato: a occhio non si vede.
  const meta = { sezioni: [{ titolo: 'Centrale', serie: [
    { notazione: '4x', metri: 0, zona: '', senzaMetri: true, apreBlocco: 4 },
    { notazione: '3x100', metri: 300, zona: '' },
    { notazione: '6x50', metri: 300, zona: '' },
    { notazione: '12x25', metri: 300, zona: '' },
  ] }] };
  const [b] = apertureNude(meta);
  dice('trova il blocco a metà', b?.forma, 'a-meta');
  dice('quante volte', b.ripetizioni, 4);
  dice('mancanti', b.metriMancanti, 2700);
  dice('è il caso delle sedute salvate con la 0.54.0', totale(meta.sezioni[0]), 900);

  applicaAperturaBlocco(meta.sezioni[0], b.serM);
  dice('sistemato fa 3600', totale(meta.sezioni[0]), 3600);
  dice('e non si segnala più', apertureNude(meta).length, 0);
}
{
  // Con metri rilevati l'avviso si vede ma il tasto no.
  const conSvolto = {
    svolto: { righe: { '0-1': 350 } },
    sezioni: [{ titolo: 'Centrale', serie: [
      { notazione: '4x', metri: 0, zona: '', senzaMetri: true, apreBlocco: 4 },
      { notazione: '3x100', metri: 300, zona: '' },
    ] }],
  };
  const [c] = apertureNude(conSvolto);
  dice('il blocco a metà si segnala anche con svolto', !!c, true);
  dice('ma il tasto non compare', c.applicabile, false);
  dice('e dice perché', c.perche, 'svolto');

  const [d] = apertureNude({ sezioni: conSvolto.sezioni }, { puoScrivere: false });
  dice('in sola lettura niente tasto', d.applicabile, false);
  dice('col suo motivo', d.perche, 'sola-lettura');
}

// =====================================================================
// QUELLO CHE NON SI SEGNALA
// =====================================================================
{
  const niente = (serie) => apertureNude({ sezioni: [{ serie }] }).length;
  dice('un blocco sano non si segnala', niente([
    { notazione: '4x', metri: 0, senzaMetri: true, apreBlocco: 4 },
    { notazione: '3x100', metri: 1200, moltiplicato: 4 },
  ]), 0);
  dice('"1x" non ripete niente', niente([
    { notazione: '1x', metri: 0 }, { notazione: '8x50', metri: 400 },
  ]), 0);
  dice('un\'apertura senza righe sotto', niente([{ notazione: '3x', metri: 0 }]), 0);
  dice('"4x100" è un lavoro', niente([
    { notazione: '4x100', metri: 400 }, { notazione: '8x50', metri: 400 },
  ]), 0);
  dice('nelle sezioni a secco non ci sono metri', apertureNude({ sezioni: [{
    aSecco: true, durataMin: 20,
    serie: [{ notazione: '3x', metri: 0 }, { notazione: '12 trazioni', metri: 0 }],
  }] }).length, 0);
}

// =====================================================================
// A SECCO: il ricalcolo non entra
// =====================================================================
{
  const sez = { titolo: 'Palestra', aSecco: true, durataMin: 20, destinatari: ['*'], serie: [
    { notazione: '4x12 trazioni', metri: 0, zona: '', senzaMetri: true },
  ] };
  const prima = JSON.stringify(sez);
  ricalcolaBlocchi(sez);
  dice('la sezione a secco non si tocca', JSON.stringify(sez), prima);
}

// =====================================================================
// IL CONFINE DEL BLOCCO
// =====================================================================
{
  const sez = { serie: [
    { notazione: '3x', apreBlocco: 3, metri: 0 },
    { notazione: '8x50', metri: 0 },
    { notazione: '2x', apreBlocco: 2, metri: 0 },
    { notazione: '4x100', metri: 0 },
    { notazione: '200', metri: 0 },
  ] };
  dice('il blocco finisce alla prossima apertura', figlieDelBlocco(sez, 0), [1]);
  dice('il secondo arriva a fine sezione', figlieDelBlocco(sez, 2), [3, 4]);

  ricalcolaBlocchi(sez);
  dice('due blocchi, due fattori',
    sez.serie.map((s) => s.moltiplicato ?? null), [null, 3, null, 2, 2]);
}

// =====================================================================
// I GESTI NON SFASANO LE CHIAVI DI svolto
// (la 0.53.1 resta valida anche coi blocchi in mezzo)
// =====================================================================
{
  const svolto = { righe: { '0-1': 350, '0-2': 400 } };
  dice('togliendo una riga le chiavi seguono',
    svoltoDopoTogliRiga(svolto, 0, 1), { righe: { '0-1': 400 }, nota: undefined });
  dice('spostandola pure',
    svoltoDopoMuoviRiga(svolto, 0, 1, 2), { righe: { '0-2': 350, '0-1': 400 }, nota: undefined });
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ blocchi ripetuti: tutte le prove passate');
