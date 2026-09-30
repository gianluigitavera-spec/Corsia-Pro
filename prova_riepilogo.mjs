// Prove del riepilogo seduta: la durata di un ramo e quella della
// seduta. Girano prima di ogni build.
//
// LA REGOLA È LA STESSA DEI VOLUMI, e i tempi la ignoravano: una seduta
// con lo split non dura la somma dei rami, perché nessun atleta fa sia
// il lavoro dei velocisti sia quello dei fondisti. Fino alla 0.56.1
// durataStimata sommava tutto e una seduta da 45' ne dichiarava 57.
import {
  durataStimata, durataPerSpecializzazione, inOreMinuti, SPECIALIZZAZIONI,
  specializzazioniDaSezioni, specializzazioniDiAtleti, specializzazioniConLavoroDedicato,
  metriPerSpecializzazione,
} from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

// La seduta mista del rapporto: un riscaldamento per tutti, due rami che
// si escludono a vicenda, e la palestra — che è comune e conta.
const MISTA = [
  { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
  { titolo: 'Velocità', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400, recupero: '@1:30' }] },
  { titolo: 'Mezzofondo', destinatari: ['Mezzofondo'], serie: [{ notazione: '6x200', metri: 1200, recupero: '@3:00' }] },
  { titolo: 'Palestra', destinatari: ['*'], aSecco: true, durataMin: 20, serie: [{ notazione: '3x10 piegamenti', metri: 0, senzaMetri: true }] },
];

// =====================================================================
// SEDUTA MISTA: comune + il ramo più lungo
// =====================================================================
{
  // comuni: 400 @7:00 = 420 s, palestra 20' = 1200 s → 1620
  // rami:   velocità 8×90 = 720 · mezzofondo 6×180 = 1080
  dice('il totale è comune + il ramo più lungo', durataStimata(MISTA).secondi, 2700);
  dice('che scritto si legge così', inOreMinuti(durataStimata(MISTA).secondi), '45\'');

  // Le due cose che il totale NON deve essere: la somma di tutto
  // (5940-1200 secco escluso = 3420, com'era prima) e il solo comune.
  dice('non è la somma dei rami', durataStimata(MISTA).secondi === 3420, false);
  dice('e non è il solo comune', durataStimata(MISTA).secondi === 1620, false);

  dice('il ramo lento vale comune + il suo',
    durataPerSpecializzazione(MISTA, 'Mezzofondo').secondi, 2700);
  dice('il ramo veloce pure',
    durataPerSpecializzazione(MISTA, 'Velocità').secondi, 2340);
  dice('chi non ha un ramo suo fa solo il comune',
    durataPerSpecializzazione(MISTA, 'Fondo').secondi, 1620);

  // "di cui Nm' comuni": è la stessa parte per tutti, e comprende la
  // palestra, che è lavoro che fanno insieme.
  for (const spec of SPECIALIZZAZIONI) {
    dice(`la parte comune è la stessa per ${spec}`,
      durataPerSpecializzazione(MISTA, spec).comuni, 1620);
  }
}

// =====================================================================
// IL LAVORO A SECCO RESTA NEL TOTALE E NEL COMUNE
// Occupa tempo: sta nella seduta e l'allenatore ci è dentro. Esce solo
// dal conteggio delle righe senza partenza.
// =====================================================================
{
  const conSecco = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Palestra', aSecco: true, durataMin: 20, serie: [{ notazione: '3x10', metri: 0, senzaMetri: true }] },
  ];
  dice('la palestra conta nel totale', durataStimata(conSecco).secondi, 420 + 1200);
  dice('e nella parte comune', durataPerSpecializzazione(conSecco, 'Velocità').comuni, 420 + 1200);
  dice('ma le sue righe non sono "senza partenza"', durataStimata(conSecco).senzaPartenza, 0);
  dice('ed è contata come sezione secca', durataStimata(conSecco).sezioniSecche, 1);

  // Il caso già fissato in prova_analizzatore.mjs: una sezione a secco
  // senza il campo destinatari è comune, quindi entra in ogni ramo.
  dice('palestra sola, 30 minuti',
    durataStimata([{ titolo: 'Palestra', aSecco: true, durataMin: 30, serie: [] }]).secondi, 1800);
}

// =====================================================================
// SEDUTA DI SOLE SEZIONI COMUNI
// Senza rami il massimo è il comune stesso: il conto non deve cambiare
// forma quando lo split non c'è, che è la maggioranza delle sedute.
// =====================================================================
{
  const comune = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Parte centrale', destinatari: ['*'], serie: [{ notazione: '10x100', metri: 1000, recupero: '@1:40' }] },
    // Senza il campo destinatari: destinatariDi la tratta come [TUTTI].
    { titolo: 'Sciolto', serie: [{ notazione: '200', metri: 200, recupero: '@4:00' }] },
  ];
  const atteso = 420 + 1000 + 240;
  dice('totale = tutto il comune', durataStimata(comune).secondi, atteso);
  dice('una sezione senza destinatari entra lo stesso',
    durataPerSpecializzazione(comune, 'Velocità').secondi, atteso);
  for (const spec of SPECIALIZZAZIONI) {
    dice(`ogni ramo vale il comune intero (${spec})`,
      durataPerSpecializzazione(comune, spec).secondi, atteso);
    dice(`ed è tutto comune (${spec})`,
      durataPerSpecializzazione(comune, spec).comuni, atteso);
  }
}

// =====================================================================
// ELENCO DI SPECIALIZZAZIONI VUOTO O NULLO
// Il riepilogo si disegna PRIMA che la lista degli atleti arrivi: senza
// questo ripiego il massimo resterebbe a zero e una seduta piena
// mostrerebbe durata zero, che è peggio di una durata approssimata.
// =====================================================================
{
  dice('elenco vuoto vale come tutte', durataStimata(MISTA, []).secondi, 2700);
  dice('elenco nullo pure', durataStimata(MISTA, null).secondi, 2700);
  dice('indefinito usa il valore per difetto', durataStimata(MISTA, undefined).secondi, 2700);

  // Ristretto per davvero: con un gruppo di soli "Generale" il ramo dei
  // velocisti non allunga una seduta che nessuno nuoterà.
  dice('solo Generale: niente rami', durataStimata(MISTA, ['Generale']).secondi, 1620);
  dice('solo Velocità', durataStimata(MISTA, ['Velocità']).secondi, 2340);
  dice('due rami, vince il più lungo',
    durataStimata(MISTA, ['Velocità', 'Mezzofondo']).secondi, 2700);
}

// =====================================================================
// I CONTATORI GUARDANO TUTTA LA SEDUTA, NON IL RAMO PIÙ LUNGO
// Sono righe da sistemare, non tempo: una riga senza ripartenza fra i
// velocisti va segnalata anche quando il ramo che vince è un altro.
// =====================================================================
{
  const conBuchi = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Velocità', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400 }] },
    { titolo: 'Mezzofondo', destinatari: ['Mezzofondo'], serie: [{ notazione: '6x200', metri: 1200, recupero: '@3:00' }] },
  ];
  const t = durataStimata(conBuchi);
  dice('vince il mezzofondo', t.secondi, 420 + 1080);
  dice('ma la riga scoperta dei velocisti si conta lo stesso', t.senzaPartenza, 1);
  dice('anche restringendo il gruppo al solo mezzofondo',
    durataStimata(conBuchi, ['Mezzofondo']).senzaPartenza, 1);

  // Nella card invece il buco è solo di chi ce l'ha: serve a marcare
  // QUELLA card come sottostimata.
  dice('la card dei velocisti sa di essere sottostimata',
    durataPerSpecializzazione(conBuchi, 'Velocità').senzaPartenza, 1);
  dice('quella dei mezzofondisti no',
    durataPerSpecializzazione(conBuchi, 'Mezzofondo').senzaPartenza, 0);
}

// =====================================================================
// QUALI CARD MOSTRARE
//
// Le card sono quelle degli atleti del gruppo, più il lavoro scritto che
// non deve sparire. Finché la lista degli atleti non arriva si ricavano
// dalle sezioni: mai partire dalle cinque del dominio per collassare a
// una appena arriva la rete.
// =====================================================================
{
  const soloVelocisti = [
    { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400, recupero: '@1:30' }] },
  ];
  const gruppoVeloce = [{ specializzazione: 'Velocità' }, { specializzazione: 'Velocità' }];

  dice('il gruppo dà una specializzazione sola',
    specializzazioniDiAtleti(gruppoVeloce), ['Velocità']);
  dice('e il lavoro dedicato la conferma',
    specializzazioniConLavoroDedicato(soloVelocisti), ['Velocità']);
  // Senza sezioni comuni Generale non entra nello stato iniziale: chi è
  // Generale non nuoterebbe niente, e la card sarebbe vuota davvero.
  dice('seduta tutta dedicata: niente Generale a vuoto',
    specializzazioniDaSezioni(soloVelocisti), ['Velocità']);

  // L'eccezione del lavoro dedicato non deve riportare dentro nessun altro.
  dice('un riscaldamento comune NON crea rami dedicati',
    specializzazioniConLavoroDedicato([
      { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400 }] },
    ]), []);
  // Un ramo appena creato, ancora a zero metri, non è "lavoro scritto"…
  dice('ramo a zero metri fuori dall\'eccezione',
    specializzazioniConLavoroDedicato([
      { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '', metri: 0 }] },
    ]), []);
  // …ma nello stato iniziale la sua card c'è: mentre scrivi devi vederla.
  dice('lo stato iniziale invece lo cita',
    specializzazioniDaSezioni([
      { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '', metri: 0 }] },
    ]), ['Velocità']);

  // Campo vuoto, nullo o sconosciuto: conta come Generale, nessuno si perde.
  dice('specializzazioni mancanti valgono Generale',
    specializzazioniDiAtleti([{ specializzazione: null }, { specializzazione: '' }, { specializzazione: 'Boh' }, {}]),
    ['Generale']);
  dice('nessun atleta, nessuna specializzazione', specializzazioniDiAtleti([]), []);
}

// =====================================================================
// GRUPPO TUTTO GENERALE, SEDUTA DI SOLE SEZIONI COMUNI
// Il caso più frequente: nessuno split, nessuna specializzazione. Una card
// sola, e il suo tempo deve coincidere col totale in intestazione.
// =====================================================================
{
  const comune = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Parte centrale', destinatari: ['*'], serie: [{ notazione: '10x100', metri: 1000, recupero: '@1:40' }] },
    { titolo: 'Palestra', destinatari: ['*'], aSecco: true, durataMin: 15, serie: [] },
  ];
  const gruppo = [{ specializzazione: 'Generale' }, { specializzazione: null }, {}];
  const atteso = 420 + 1000 + 900;

  dice('una card sola', specializzazioniDiAtleti(gruppo), ['Generale']);
  dice('nessun lavoro dedicato', specializzazioniConLavoroDedicato(comune), []);
  dice('e lo stato iniziale dice la stessa cosa',
    specializzazioniDaSezioni(comune), ['Generale']);

  const card = durataPerSpecializzazione(comune, 'Generale');
  dice('tutto il tempo è comune', card.comuni, card.secondi);
  dice('e vale quanto ci si aspetta', card.secondi, atteso);
  // Il numero nella card e quello in intestazione devono coincidere: sono
  // la stessa seduta guardata da due punti.
  dice('card e intestazione dicono lo stesso numero',
    card.secondi, durataStimata(comune, ['Generale']).secondi);
  dice('anche senza restringere il gruppo',
    card.secondi, durataStimata(comune).secondi);
}

// =====================================================================
// UNA CARD A ZERO METRI PUÒ AVERE MINUTI VERI
//
// QUESTA PROVA BLOCCA UN'IDEA SBAGLIATA: "togliamo le card a zero metri".
// Palestra comune più un ramo dedicato ai velocisti, gruppo tutto Generale.
// La card Generale ha zero metri — non nuota niente — ma venti minuti di
// palestra, che sono tempo vero in cui l'allenatore è con loro. Filtrare
// sui metri la cancellerebbe insieme al suo tempo.
//
// Se un filtro servirà mai, il test è "metri 0 E secondi 0".
// =====================================================================
{
  const palestraPiuRamo = [
    { titolo: 'Palestra', destinatari: ['*'], aSecco: true, durataMin: 20, serie: [{ notazione: '3x10 piegamenti', metri: 0, senzaMetri: true }] },
    { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400, recupero: '@1:30' }] },
  ];

  dice('Generale non nuota un metro',
    metriPerSpecializzazione(palestraPiuRamo, 'Generale'), 0);
  const g = durataPerSpecializzazione(palestraPiuRamo, 'Generale');
  dice('ma ha i venti minuti di palestra', g.secondi, 1200);
  dice('e sono tutti comuni', g.comuni, 1200);

  dice('il velocista nuota i suoi metri',
    metriPerSpecializzazione(palestraPiuRamo, 'Velocità'), 400);
  const v = durataPerSpecializzazione(palestraPiuRamo, 'Velocità');
  dice('e sta in acqua più a lungo', v.secondi, 1920);
  dice('con la stessa parte comune', v.comuni, 1200);

  // La card Generale va mostrata: il test di un eventuale filtro futuro
  // dev'essere metri 0 E secondi 0, e qui i secondi non sono zero.
  dice('zero metri ma non zero secondi', [
    metriPerSpecializzazione(palestraPiuRamo, 'Generale') === 0,
    g.secondi === 0,
  ], [true, false]);
}

// =====================================================================
// CASI VUOTI
// =====================================================================
{
  dice('nessuna sezione', durataStimata([]).secondi, 0);
  dice('sezioni nulle', durataStimata(null).secondi, 0);
  dice('ramo su seduta vuota', durataPerSpecializzazione([], 'Velocità'),
    { secondi: 0, comuni: 0, conPartenza: 0, senzaPartenza: 0, sezioniSecche: 0 });
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ riepilogo seduta: tutte le prove passate');
