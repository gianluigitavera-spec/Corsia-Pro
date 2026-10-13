// Prove di "Controlla le sedute" (metriDaRicontrollare in dominio.js).
// Gira prima di ogni build.
//
// Si parte dal TESTO e dai GESTI, come nelle altre prove: una seduta
// importata oggi, o scritta oggi coi tasti, non deve dare niente da
// ricontrollare. Le sedute "vecchie" si ottengono da quelle di oggi
// togliendo o ritoccando i campi che un rilascio vecchio non scriveva,
// e il ritocco è dichiarato caso per caso: è il solo modo di avere oggi
// una riga letta da un lettore che non c'è più.
import { analizzaTesto } from './src/lib/analizzatore.js';
import { sedutaDaLettura } from './src/lib/importaTesto.js';
import {
  metriDaRicontrollare, applicaRicontrollo, applicaRicontrolloInBlocco,
  ricalcolaBlocchi, annotaLettura, metriDaNotazione, serieVuota,
  metriPerSpecializzazione, apertureNude,
} from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

const importa = (testo, correzioni) =>
  ({ origine: 'testo', sezioni: sedutaDaLettura(analizzaTesto(testo).sezioni, correzioni) });
const controlla = (seduta, opzioni) => metriDaRicontrollare(seduta, opzioni);
const casi = (seduta, opzioni) => controlla(seduta, opzioni).righe
  .map((r) => `${r.sezN}-${r.serM} ${r.caso} ${r.metri}→${r.proposta}${r.tutteInsieme ? ' [tutte]' : ''}${r.perche ? ` (${r.perche})` : ''}`);
const volume = (seduta) => metriPerSpecializzazione(seduta.sezioni, 'Generale');
const copia = (x) => JSON.parse(JSON.stringify(x));

// Prima della 0.56.10: niente metriLetti, e l'import marcava metriManuali
// su tutte le righe. `editor: true` toglie anche quello, come una seduta
// scritta coi tasti.
const vecchia = (seduta, { editor = false } = {}) => {
  for (const sez of seduta.sezioni) {
    for (const r of sez.serie) {
      delete r.metriLetti;
      delete r.composizione;
      if (!editor && !r.apreBlocco) r.metriManuali = true;
    }
  }
  return seduta;
};

const TESTO = `Riscaldamento
400/300/200 A1
CP 2x10
4x100 A2
50 sl
50 do

Parte centrale
3x
8x50 B1 @45"
200 A2 @3'
2x (4x50 SL @45" + 100 B1) @3'

Palestra
4x12 trazioni

Sciolto
200`;

// =====================================================================
// L'INVARIANTE: quello che si scrive oggi non va ricontrollato
// =====================================================================
{
  const s = importa(TESTO);
  dice('seduta importata oggi: niente da ricontrollare', controlla(s), { righe: [], saltate: [] });

  // Corretta nel revisore: metri ≠ metriLetti è una scelta, non un errore.
  const c = importa(TESTO, { '0:0': { metri: 1000 } });
  dice('corretta nel revisore: niente da ricontrollare', casi(c), []);

  // Le stesse righe scritte coi tasti dell'editor.
  const sez = { titolo: 'Parte centrale', destinatari: ['*'], serie: [] };
  const scrivi = (t) => {
    sez.serie.push(serieVuota());
    const r = sez.serie[sez.serie.length - 1];
    r.notazione = t;
    const m = metriDaNotazione(t);
    if (m !== null) { r.metri = m; delete r.moltiplicato; }
    ricalcolaBlocchi(sez);
    annotaLettura(sez, r);
  };
  sez.serie.push({ notazione: '3x', metri: 0, zona: '', recupero: '', note: '', senzaMetri: true, apreBlocco: 3 });
  ricalcolaBlocchi(sez);
  for (const t of ['8x50 B1', '200 A2', '400/300/200']) scrivi(t);
  sez.serie[1].metri = 1000; sez.serie[1].metriManuali = true;      // cambiaMetri
  dice('seduta scritta coi gesti: niente da ricontrollare', casi({ sezioni: [sez] }), []);

  // Controllare non è un gesto: non cambia un byte.
  const prima = JSON.stringify(s);
  controlla(s); controlla(vecchia(importa(TESTO)));
  dice('il controllo non scrive niente', JSON.stringify(s), prima);
}

// =====================================================================
// CON metriLetti: si guarda solo se il lettore è cambiato
// =====================================================================
{
  // Un lettore vecchio leggeva "400/300/200" come 400 (la scaletta).
  const s = importa(TESTO);
  Object.assign(s.sezioni[0].serie[0], { metri: 400, metriLetti: 400 });
  dice('letta da un lettore vecchio e mai toccata: si propone la lettura di oggi',
    casi(s), ['0-0 lettore-cambiato 400→900 [tutte]']);

  // Lo stesso, ma l'allenatore l'aveva corretta: si segnala, non si propone.
  const c = importa(TESTO);
  Object.assign(c.sezioni[0].serie[0], { metri: 500, metriLetti: 400, metriManuali: true });
  dice('corretta a mano e lettore cambiato: segnalata, senza proposta',
    casi(c), ['0-0 corretta-a-mano 500→null (corretta-a-mano)']);
  dice('…e senza tasto', controlla(c).righe[0].applicabile, false);

  // Metri battuti a mano uguali alla lettura: decisi dall'allenatore, quindi
  // riga per riga e non "tutte".
  const u = importa(TESTO);
  Object.assign(u.sezioni[0].serie[0], { metri: 400, metriLetti: 400, metriManuali: true });
  dice('metriManuali anche se uguali: mai fra le "tutte"',
    casi(u), ['0-0 lettore-cambiato 400→900']);

  // Il lettore di oggi non capisce quello che prima capiva: zero sarebbe
  // inventato.
  const n = importa('Sciolto\n200');
  Object.assign(n.sezioni[0].serie[0], { notazione: 'sciolto a piacere', metriLetti: 200 });
  dice('il lettore di oggi non capisce: niente proposta',
    casi(n), ['0-0 lettore-cambiato 200→null (non-capita)']);

  // La riga rossa dell'import (letta null, arrivata a zero) che oggi si legge.
  const r = importa('Sciolto\n200');
  Object.assign(r.sezioni[0].serie[0], { metri: 0, metriLetti: null });
  dice('rossa all\'import, oggi si legge: si propone',
    casi(r), ['0-0 lettore-cambiato 0→200 [tutte]']);

  // Null e zero dicono la stessa cosa: nessun metro letto.
  const z = importa('Sciolto\n200');
  Object.assign(z.sezioni[0].serie[0], { notazione: 'sciolto a piacere', metri: 0, metriLetti: 0 });
  dice('letto zero, oggi non capito: non è un cambio di lettore', casi(z), []);
}

// =====================================================================
// SENZA metriLetti: il confronto con la lettura di oggi
// =====================================================================
{
  // Sedute dell'editor: le letture vecchie note.
  const s = vecchia(importa(TESTO), { editor: true });
  s.sezioni[0].serie[0].metri = 400;                    // la scaletta letta 400
  s.sezioni[1].serie[3].metri = 42362;                  // i tempi contati come metri (×3 nel blocco)
  dice('letture vecchie: proposte, anche tutte insieme', casi(s), [
    '0-0 lettura-vecchia 400→900 [tutte]',
    '1-3 lettura-vecchia 42362→1800 [tutte]',
  ]);

  // La regola della vasca la applica già il lettore.
  const v = vecchia(importa('Riscaldamento\nCP 2x10'), { editor: true });
  dice('"CP 2x10" salvato a 50 non è divergente', casi(v), []);
  v.sezioni[0].serie[0].metri = 20;
  dice('"CP 2x10" salvato a 20 sì', casi(v), ['0-0 lettura-vecchia 20→50 [tutte]']);

  // Importate prima della 0.56.10: metriManuali su tutte, mai "tutte".
  const i = vecchia(importa(TESTO));
  i.sezioni[0].serie[0].metri = 400;
  dice('con metriManuali: riga per riga', casi(i), ['0-0 metri-fissi 400→900']);
  dice('…ma col suo tasto', controlla(i).righe[0].applicabile, true);

  // "Una serie per stile": la correzione ×4 nel revisore non si riconosce.
  const p = vecchia(importa('Parte centrale\n4x100 1 serie x stile'), { editor: true });
  p.sezioni[0].serie[0].metri = 1600;
  dice('perStile: riga per riga', casi(p), ['0-0 metri-fissi 1600→400']);

  // La lettura che il lettore dichiara dubbia (il limite noto): si
  // segnala senza numero. Salvata come la legge oggi, non compare.
  const d = vecchia(importa('Parte centrale\n1x400 palette SL 400 + 2x200 + 4x100 + 8x50'), { editor: true });
  d.sezioni[0].serie[0].metri = 1600;
  dice('lettura dubbia: segnalata, senza proposta', casi(d), ['0-0 lettura-vecchia 1600→null (lettura-dubbia)']);
  dice('…e senza tasto', controlla(d).righe[0].applicabile, false);
  d.sezioni[0].serie[0].metri = 400;
  dice('…salvata come si legge oggi: niente', casi(d), []);
  // Le righe che la coda ferma descrivendo una parte restano proposte.
  const p2 = vecchia(importa("Parte centrale\n8x50 @1'45 MX 25GB lat + 25MX 2x"), { editor: true });
  p2.sezioni[0].serie[0].metri = 425;
  dice('la coda che descrive: proposta normale', casi(p2), ['0-0 lettura-vecchia 425→400 [tutte]']);

  // Zero in archivio, oggi si legge un numero.
  const a = vecchia(importa('Sciolto\n200'), { editor: true });
  a.sezioni[0].serie[0].metri = 0;
  dice('a zero: riga per riga', casi(a), ['0-0 a-zero 0→200']);

  // Le composizioni senza flag si ricostruiscono.
  const k = vecchia(importa(TESTO), { editor: true });
  dice('"50 sl" e "50 do" sotto "4x100": composizione anche senza flag', casi(k), []);
  // Se non sommano la distanza della ripetuta non sono composizione:
  // tutte e due a zero, da guardare.
  k.sezioni[0].serie[4].notazione = '75 do';
  dice('…e se non sommano, a zero', casi(k), ['0-3 a-zero 0→50', '0-4 a-zero 0→75']);
}

// =====================================================================
// BLOCCO ×3: niente doppio conteggio, in nessuno dei due versi
// =====================================================================
{
  const s = vecchia(importa('Parte centrale\n3x\n8x50 B1'), { editor: true });
  dice('figlia salvata già moltiplicata: a posto', casi(s), []);

  s.sezioni[0].serie[1].metri = 400;                    // salvata a giro
  dice('figlia salvata a giro: si propone il ×3', casi(s), ['0-1 lettura-vecchia 400→1200 [tutte]']);

  // Il fattore viene dall'apertura sopra, non da `moltiplicato`. Senza
  // `moltiplicato` il blocco è "a metà": prima si sistema quello.
  const m = vecchia(importa('Parte centrale\n3x\n8x50 B1'), { editor: true });
  delete m.sezioni[0].serie[1].moltiplicato;
  m.sezioni[0].serie[1].metri = 400;
  dice('blocco a metà: la sezione la lascia all\'altro avviso',
    controlla(m), { righe: [], saltate: [{ sezN: 0, perche: 'blocchi' }] });

  // Un ×4 rimasto addosso sotto un ×3: apertureNude non lo vede (i metri
  // calerebbero), e proporre i metri lasciando il fattore sbagliato
  // peggiorerebbe la riga. Fuori, e contata.
  const f = vecchia(importa('Parte centrale\n3x\n8x50 B1\n200'), { editor: true });
  Object.assign(f.sezioni[0].serie[1], { moltiplicato: 4, metri: 1600 });
  dice('fattore rimasto indietro: la riga resta fuori',
    controlla(f), { righe: [], saltate: [{ sezN: 0, serM: 1, perche: 'fattore' }] });
  // Una riga uscita dal blocco col fattore addosso, idem.
  const fuori = vecchia(importa('Parte centrale\n8x50 B1'), { editor: true });
  Object.assign(fuori.sezioni[0].serie[0], { moltiplicato: 3, metri: 1200 });
  dice('fuori dal blocco col fattore addosso: idem',
    controlla(fuori).saltate, [{ sezN: 0, serM: 0, perche: 'fattore' }]);

  // Apertura nuda con le righe a giro (scritte nell'editor prima della
  // 0.54): apertureNude la segnala e ha il suo tasto. Prima quello.
  const n = vecchia(importa('Parte centrale\n3x\n8x50 B1'), { editor: true });
  delete n.sezioni[0].serie[0].apreBlocco;
  delete n.sezioni[0].serie[1].moltiplicato;
  n.sezioni[0].serie[1].metri = 400;
  dice('apertura nuda segnalata: la sezione la lascia all\'altro avviso',
    controlla(n), { righe: [], saltate: [{ sezN: 0, perche: 'blocchi' }] });
}

// =====================================================================
// BLOCCHI IMPORTATI PRIMA DELLA 0.54: "3x" senza apreBlocco, figlie
// senza moltiplicato ma coi metri già moltiplicati e fissati.
// apertureNude non li vede, quindi non si saltano: il fattore viene dalla
// riga "3x", e le figlie si guardano una per una.
// =====================================================================
const prima054 = (testo) => {
  const s = importa(testo);
  for (const sez of s.sezioni) {
    for (const r of sez.serie) {
      delete r.apreBlocco; delete r.moltiplicato; delete r.senzaMetri;
      delete r.metriLetti; delete r.composizione;
      if (r.metri) r.metriManuali = true;
    }
  }
  return s;
};
{
  const s = prima054('Parte centrale\n3x\n2x50 pull\n100+75+50+25 DO');
  dice('pre-0.54 letto giusto: niente', controlla(s), { righe: [], saltate: [] });

  // Il lettore di allora leggeva 225 a giro: 675 in archivio.
  s.sezioni[0].serie[2].metri = 675;
  dice('apertureNude non la vede', apertureNude(s), []);
  dice('pre-0.54 col vecchio 225×3: proposta a 750, riga per riga',
    casi(s), ['0-2 metri-fissi 675→750']);
  dice('…col suo tasto', controlla(s).righe[0].applicabile, true);

  // Senza metriManuali le figlie sembrano a giro, apertureNude segnala il
  // blocco e la sezione resta a lui. Dalla 0.48.0 l'import li ha sempre
  // messi: un blocco così non viene dall'import che conosciamo.
  const m = prima054('Parte centrale\n3x\n2x50 pull\n100+75+50+25 DO');
  for (const r of m.sezioni[0].serie) delete r.metriManuali;
  m.sezioni[0].serie[2].metri = 675;
  dice('senza metriManuali vince apertureNude',
    controlla(m), { righe: [], saltate: [{ sezN: 0, perche: 'blocchi' }] });

  // Figlia che il fattore ce l'ha già ma l'apertura no, e metri non
  // fissati: apertureNude non la vede (×3 su ×3), e il confine resta una
  // ricostruzione. Riga per riga anche qui.
  const f = vecchia(importa('Parte centrale\n3x\n2x50 pull\n100+75+50+25 DO'), { editor: true });
  delete f.sezioni[0].serie[0].apreBlocco;
  f.sezioni[0].serie[2].metri = 675;
  dice('sotto un "3x" nudo mai fra le "tutte", nemmeno senza metriManuali',
    casi(f), ['0-2 metri-fissi 675→750']);

  // LA RIGA VUOTA: nel testo chiudeva il blocco, in archivio non c'è.
  // Il 200 salvato a un giro è fuori dal ×3, e non va proposto a 600.
  const v = prima054('Parte centrale\n3x\n8x50\n\n200');
  dice('"3x / 8x50 / (vuota) / 200": il 200 non compare', controlla(v), { righe: [], saltate: [] });
  // E da lì in giù il blocco resta chiuso: una riga sotto letta male si
  // propone a un giro, non ×3.
  const v2 = prima054('Parte centrale\n3x\n8x50\n\n200\n400/300/200');
  v2.sezioni[0].serie[3].metri = 400;
  dice('…e il blocco resta chiuso anche sotto', casi(v2), ['0-3 metri-fissi 400→900']);
  // Una figlia letta male PRIMA della riga a un giro resta dentro.
  v2.sezioni[0].serie[1].metri = 1500;
  dice('…mentre sopra il blocco c\'è ancora',
    casi(v2), ['0-1 metri-fissi 1500→1200', '0-3 metri-fissi 400→900']);

  // LA NOTA: sulle righe proposte dentro un blocco ricostruito, e solo lì.
  const nota = (s) => controlla(s).righe.map((r) => `${r.sezN}-${r.serM} ${r.bloccoRicostruito ?? '-'}`);
  dice('la nota sta sulle righe del blocco ricostruito, non su quelle chiuse fuori',
    nota(v2), ['0-1 3', '0-3 -']);

  // Accanto, una sezione con un blocco vero e una piatta: niente nota.
  const misto = prima054('Parte centrale\n3x\n2x50 pull\n100+75+50+25 DO');
  misto.sezioni[0].serie[2].metri = 675;
  const vere = vecchia(importa('Parte centrale\n3x\n8x50 B1\n\nSciolto\n400/300/200'), { editor: true });
  vere.sezioni[0].serie[1].metri = 400;          // figlia di un blocco vero, salvata a giro
  vere.sezioni[1].serie[0].metri = 400;          // lettura vecchia fuori da ogni blocco
  misto.sezioni.push(...vere.sezioni);
  dice('nota solo nel blocco ricostruito', nota(misto), ['0-2 3', '1-1 -', '2-0 -']);

  // Il blocco nudo finisce alla prossima apertura, e a fine sezione.
  const d = prima054('Parte centrale\n3x\n200\n2x\n100\n\nSciolto\n200');
  dice('il fattore cambia alla prossima apertura e si ferma a fine sezione', controlla(d),
    { righe: [], saltate: [] });

  const a = prima054('Parte centrale\n3x\n2x50 pull\n100+75+50+25 DO');
  a.sezioni[0].serie[2].metri = 675;
  applicaRicontrollo(a, 0, 2);
  dice('applicata: solo i metri, la struttura resta com\'era',
    a.sezioni[0].serie.map((r) => [r.notazione, r.metri, r.moltiplicato, r.apreBlocco]),
    [['3x', 0, undefined, undefined], ['2x50 pull', 300, undefined, undefined],
      ['100+75+50+25 DO', 750, undefined, undefined]]);
}

// =====================================================================
// LE ALTRE ESCLUSIONI
// =====================================================================
{
  const s = importa(TESTO);
  s.origine = 'swimcoach';
  s.sezioni[0].serie[0].metri = 400;
  dice('SwimCoach: fuori, e contata', controlla(s), { righe: [], saltate: [{ sezN: null, perche: 'swimcoach' }] });

  const p = vecchia(importa('Palestra\n4x12 trazioni'), { editor: true });
  dice('a secco: niente', casi(p), []);

  const k = vecchia(importa('Parte centrale\n10x25 partenze'), { editor: true });
  k.sezioni[0].serie[0].metri = 0;
  k.sezioni[0].serie[0].senzaMetri = true;
  dice('senzaMetri: niente', casi(k), []);

  const x = vecchia(importa('Sciolto\n200'), { editor: true });
  x.sezioni[0].serie[0].notazione = 'sciolto a piacere';
  dice('notazione che il lettore non capisce: niente', casi(x), []);
}

// =====================================================================
// SENZA TASTO: svolto e sola lettura
// =====================================================================
{
  const s = vecchia(importa(TESTO), { editor: true });
  s.sezioni[0].serie[0].metri = 400;
  s.sezioni[3].serie[0].metri = 100;
  s.svolto = { righe: { '0-0': 400 } };
  dice('con svolto la riga non ha tasto, le altre sì', casi(s), [
    '0-0 lettura-vecchia 400→900 (svolto)',
    '3-0 lettura-vecchia 100→200 [tutte]',
  ]);
  dice('sola lettura: nessun tasto', casi(s, { puoScrivere: false }), [
    '0-0 lettura-vecchia 400→900 (svolto)',
    '3-0 lettura-vecchia 100→200 (sola-lettura)',
  ]);
}

// =====================================================================
// L'APPLICAZIONE: solo i metri di quella riga, e quello che ha promesso
// =====================================================================
{
  const s = vecchia(importa(TESTO), { editor: true });
  s.sezioni[0].serie[0].metri = 400;
  s.sezioni[3].serie[0].metri = 100;
  s.svolto = { righe: { '1-1': 1100 }, nota: 'stanchi' };
  const svoltoPrima = JSON.stringify(s.svolto);
  const prima = copia(s);
  const voce = controlla(s).righe[0];
  const volumePrima = volume(s);

  dice('il tasto scrive', applicaRicontrollo(s, 0, 0), true);
  const atteso = copia(prima);
  atteso.sezioni[0].serie[0].metri = 900;
  dice('cambia solo i metri di quella riga', s, atteso);
  dice('svolto identico', JSON.stringify(s.svolto), svoltoPrima);
  dice('il volume cambia di quanto promesso', volume(s) - volumePrima, voce.delta);
  dice('due volte non cambia niente', [applicaRicontrollo(s, 0, 0), JSON.stringify(s)], [false, JSON.stringify(atteso)]);
  dice('una riga in regola non ha tasto', applicaRicontrollo(s, 0, 1), false);

  // Sola lettura: il tasto non scrive nemmeno se lo si chiama.
  dice('sola lettura: niente', applicaRicontrollo(s, 3, 0, { puoScrivere: false }), false);
}

{
  // Con metriLetti, la lettura di oggi va anche lì accanto: se no la riga
  // tornerebbe nell'elenco al prossimo controllo.
  const s = importa(TESTO);
  Object.assign(s.sezioni[0].serie[0], { metri: 400, metriLetti: 400 });
  applicaRicontrollo(s, 0, 0);
  dice('lettore cambiato: metri e lettura vanno alla lettura di oggi',
    [s.sezioni[0].serie[0].metri, s.sezioni[0].serie[0].metriLetti], [900, 900]);
  dice('…e non torna più', casi(s), []);
}

{
  // "Aggiorna tutte" salta le righe dove qualcuno ha deciso a mano.
  const s = vecchia(importa(TESTO), { editor: true });
  s.sezioni[0].serie[0].metri = 400;                    // lettura vecchia
  s.sezioni[3].serie[0].metri = 100;                    // lettura vecchia
  Object.assign(s.sezioni[0].serie[2], { metri: 350, metriManuali: true });   // fissa
  s.sezioni[0].serie[1].metri = 0;                      // a zero
  const volumePrima = volume(s);
  const promesso = controlla(s).righe.filter((r) => r.tutteInsieme).reduce((t, r) => t + r.delta, 0);

  dice('aggiorna tutte: due righe', applicaRicontrolloInBlocco(s), 2);
  dice('restano quelle da decidere una per una', casi(s), [
    '0-1 a-zero 0→50',
    '0-2 metri-fissi 350→400',
  ]);
  dice('metriManuali resta dov\'era', s.sezioni[0].serie[2].metriManuali, true);
  dice('il volume cambia di quanto promesso', volume(s) - volumePrima, promesso);
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ controllo delle sedute: tutte le prove passate');
