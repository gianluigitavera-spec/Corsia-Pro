// Prove delle categorie: la colonna del CSV, l'etichetta in elenco e i
// sospetti che l'import mostra prima di salvare. Girano prima di ogni
// build.
//
// Questa parte non aveva NESSUNA prova prima della 0.56.0, e nel
// frattempo `categoriaDaCsv` aveva imparato a indovinare il Master
// sopra i 25 anni: una proposta che si comportava da scrittura e
// riscriveva le scelte fatte a mano, senza che niente lo dicesse.
import {
  categoriaDaCsv, etichettaCategoria, sospettiImport, CATEGORIE, RAGGRUPPAMENTI,
} from './src/lib/dominio.js';
// Namespace e non import per nome, per il filtro di testata: se una di
// quelle tre funzioni sparisse, un import per nome farebbe fallire il
// CARICAMENTO del file e nessuna prova girerebbe. Così invece la prova
// parte e dice quale manca — è come è nata, rossa, quando non ce n'era
// ancora nessuna.
import * as dominio from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

// Le fasce servono a ricavare la categoria per età. Quelle vere stanno
// in squadra.categorie_stagione; qui bastano le tre che usano le prove.
const FASCE = [
  { categoria: 'SEN_1', sesso: 'F', anno_nascita_da: 1900, anno_nascita_a: 2003 },
  { categoria: 'SEN_1', sesso: 'M', anno_nascita_da: 1900, anno_nascita_a: 2003 },
  { categoria: 'CAD_2', sesso: 'M', anno_nascita_da: 2006, anno_nascita_a: 2006 },
  { categoria: 'RAG_1', sesso: 'F', anno_nascita_da: 2013, anno_nascita_a: 2013 },
];

// =====================================================================
// LA COLONNA VUOTA VUOL DIRE "DALL'ANNO", A QUALSIASI ETÀ
//
// Fino alla 0.55.5 sopra i 25 anni tornava MAS. Non era un'etichetta di
// comodo: finiva in categoria_override come un codice scritto a mano, e
// al reimport successivo sovrascriveva la scelta dell'allenatore.
// =====================================================================
{
  for (const anno of [1970, 1988, 1999, 2001, 2006, 2013, 2020]) {
    dice(`colonna vuota, nato nel ${anno}: nessun override`,
      categoriaDaCsv('', anno).codice, null);
  }
  dice('vuota davvero vuota', categoriaDaCsv('').codice, null);
  dice('solo spazi', categoriaDaCsv('   ').codice, null);
  dice('non passata affatto', categoriaDaCsv().codice, null);
  dice('scritta che non esiste', categoriaDaCsv('boh').codice, null);

  // `indovinata` non deve tornare: era il campo su cui l'import decideva
  // chi elencare come "messo in Master dall'età".
  dice('niente campo indovinata', 'indovinata' in categoriaDaCsv('MAS'), false);
}

// =====================================================================
// TRIATHLON, NELLE DUE FORME
// =====================================================================
{
  dice('codice', categoriaDaCsv('TRI').codice, 'TRI');
  dice('nome per esteso', categoriaDaCsv('Triathlon').codice, 'TRI');
  dice('minuscolo', categoriaDaCsv('triathlon').codice, 'TRI');
  dice('con spazi attorno', categoriaDaCsv('  tri  ').codice, 'TRI');

  // Le altre due forme che l'allenatore usa davvero, per confronto.
  dice('Master come codice', categoriaDaCsv('MAS').codice, 'MAS');
  dice('Master per esteso', categoriaDaCsv('Master').codice, 'MAS');
  dice('Teen 2 con lo spazio', categoriaDaCsv('Teen 2').codice, 'TEEN_2');

  // TRI è in coda e non ha fasce d'età: è un percorso, non un'età.
  dice('TRI ultimo in CATEGORIE', CATEGORIE[CATEGORIE.length - 1].codice, 'TRI');
  dice('e ultimo fra i raggruppamenti',
    RAGGRUPPAMENTI[RAGGRUPPAMENTI.length - 1], { nome: 'Triathlon', codici: ['TRI'] });
}

// =====================================================================
// L'ETICHETTA IN ELENCO: "Master (SEN_1)"
// Il derivato accanto serve a sapere dove ricade l'atleta PRIMA di
// azzerargli l'override.
// =====================================================================
{
  const master = { anno_nascita: 1988, sesso: 'F', categoria_override: 'MAS' };
  dice('override e derivato insieme',
    etichettaCategoria(master, FASCE), { testo: 'MAS', derivato: 'SEN_1', conOverride: true });

  const senza = { anno_nascita: 2013, sesso: 'F', categoria_override: null };
  dice('senza override si mostra il derivato e basta',
    etichettaCategoria(senza, FASCE), { testo: 'RAG_1', derivato: null, conOverride: false });

  // Fuori da ogni fascia: l'override si vede lo stesso, il derivato no
  // — non c'è niente da mettere fra parentesi.
  const fuori = { anno_nascita: 2009, sesso: 'M', categoria_override: 'TRI' };
  dice('override senza derivato',
    etichettaCategoria(fuori, FASCE), { testo: 'TRI', derivato: null, conOverride: true });

  dice('né l\'uno né l\'altro',
    etichettaCategoria({ anno_nascita: 2009, sesso: 'M' }, FASCE),
    { testo: null, derivato: null, conOverride: false });
}

// =====================================================================
// I SOSPETTI, PRIMA DI SALVARE
// =====================================================================
const riga = (cognome, anno, sesso, categoria) =>
  ({ cognome, nome: 'X', anno_nascita: anno, sesso, categoria_override: categoria });

{
  // MAS fuori fascia: un 2006 che per età sarebbe CAD_2.
  const s = sospettiImport([riga('Neri', 2006, 'M', 'MAS')], [], FASCE);
  dice('un MAS fuori fascia si segnala', s.map((x) => x.tipo), ['mas_fuori_fascia']);
  dice('e porta il derivato, per far vedere dove cadrebbe', s[0].derivato, 'CAD_2');

  // MAS che deriva SEN_1: è la norma e NON si segnala, o l'avviso
  // scatterebbe sempre e smetterebbe di essere letto.
  dice('un MAS che deriva SEN_1 non si segnala',
    sospettiImport([riga('Verdi', 1988, 'F', 'MAS')], [], FASCE), []);
}

{
  // TRI: sempre elencato, anche quando non c'è niente di strano.
  const s = sospettiImport([riga('Conti', 2001, 'F', 'TRI')], [], FASCE);
  dice('i TRI si elencano sempre', s.map((x) => x.tipo), ['tri']);
}

{
  // Override esistente che il foglio cambia.
  const inSquadra = [{ cognome: 'Conti', nome: 'X', anno_nascita: 2001, categoria_override: 'MAS' }];
  const s = sospettiImport([riga('Conti', 2001, 'F', 'TEEN_2')], inSquadra, FASCE);
  dice('la sovrascrittura si segnala', s.map((x) => x.tipo), ['cambia_override']);
  dice('con il prima e il dopo', [s[0].perdeva, s[0].diventa], ['MAS', 'TEEN_2']);
}

{
  // LA COLONNA VUOTA NON SI SEGNALA: l'import non tocca l'override
  // quando il foglio non dice niente, quindi un avviso direbbe il falso.
  // Ed è la salvezza dei fogli vecchi, che la colonna categoria non
  // ce l'hanno proprio: reimportarne uno non azzera mezza squadra.
  const inSquadra = [{ cognome: 'Verdi', nome: 'X', anno_nascita: 1988, categoria_override: 'MAS' }];
  dice('foglio vuoto su un override esistente: nessun sospetto',
    sospettiImport([riga('Verdi', 1988, 'F', null)], inSquadra, FASCE), []);
}

{
  // PIÙ MOTIVI SULLA STESSA RIGA: chi è MAS in archivio e TRI nel foglio
  // deve comparire due volte. Se comparisse solo fra i TRI, il cambio di
  // percorso passerebbe inosservato proprio perché TRI è legittimo.
  const inSquadra = [{ cognome: 'Conti', nome: 'X', anno_nascita: 2001, categoria_override: 'MAS' }];
  const s = sospettiImport([riga('Conti', 2001, 'F', 'TRI')], inSquadra, FASCE);
  dice('due motivi, due voci', s.map((x) => x.tipo), ['tri', 'cambia_override']);
  dice('ed è sempre la stessa riga', new Set(s.map((x) => x.chiave)).size, 1);
}

{
  // La chiave serve al tasto "salta le righe segnalate": senza, il
  // componente non saprebbe quali righe togliere.
  const s = sospettiImport([riga('Neri', 2006, 'M', 'MAS')], [], FASCE);
  dice('il sospetto porta la chiave della riga', s[0].chiave, 'nerix2006');
}

{
  dice('foglio pulito, nessun sospetto',
    sospettiImport([riga('Rossi', 2013, 'F', null), riga('Verdi', 1988, 'F', 'MAS')], [], FASCE), []);
  dice('foglio vuoto, nessun sospetto', sospettiImport([], [], FASCE), []);
  dice('niente righe affatto', sospettiImport(null, null, FASCE), []);
}

// =====================================================================
// IL FILTRO DI TESTATA: CHI STA NEL GRUPPO SCELTO
//
// Dal campo: con "Esordienti A" scelto in alto, la Lista Sedute mostra
// anche le sedute ESO_B1/ESO_B2 e Carico atleti mostra anche gli atleti
// Esordienti B.
//
// La mappa nome -> codici era già giusta (RAGGRUPPAMENTI, provata sopra):
// mancava un posto solo che rispondesse alla domanda "questo sta nel
// gruppo scelto?". La risposta era riscritta a mano in sei schermate,
// ognuna un po' diversa, e due sbagliavano — la Lista Sedute non
// filtrava affatto, Carico atleti filtrava le righe per data.
//
// Tre funzioni, tre domande:
//   codiciDelGruppo(['Esordienti A'])      -> i codici dietro la scelta
//   sedutaNelGruppo(seduta, codici)        -> questa seduta si vede?
//   atletaNelGruppo(atleta, codici, fasce) -> questo atleta si vede?
// =====================================================================
{
  const FASCE_ESO = [
    { categoria: 'ESO_A1', sesso: 'F', anno_nascita_da: 2015, anno_nascita_a: 2015 },
    { categoria: 'ESO_A2', sesso: 'M', anno_nascita_da: 2015, anno_nascita_a: 2015 },
    { categoria: 'ESO_B1', sesso: 'F', anno_nascita_da: 2017, anno_nascita_a: 2017 },
    { categoria: 'ESO_B2', sesso: 'M', anno_nascita_da: 2017, anno_nascita_a: 2017 },
  ];
  const atleta = (codice) => ({ id: codice, cognome: codice, nome: 'X', categoria_override: codice });
  const seduta = (...codici) => ({ id: codici.join('-'), data: '2026-10-05', categorie: codici });

  const manca = (nome) => {
    male++;
    console.error(`✗ dominio.${nome} non esiste: il filtro di testata è ancora riscritto a mano in ogni schermata`);
  };

  // --- i codici dietro la scelta -------------------------------------
  if (typeof dominio.codiciDelGruppo !== 'function') manca('codiciDelGruppo');
  else {
    dice('Esordienti A sono ESO_A1 e ESO_A2',
      dominio.codiciDelGruppo(['Esordienti A']), ['ESO_A1', 'ESO_A2']);
    dice('due gruppi insieme sommano i codici, senza doppioni',
      dominio.codiciDelGruppo(['Esordienti A', 'Esordienti B']),
      ['ESO_A1', 'ESO_A2', 'ESO_B1', 'ESO_B2']);
    dice('nessun gruppo scelto: nessun filtro', dominio.codiciDelGruppo([]), null);
    dice('un nome che non esiste non porta codici', dominio.codiciDelGruppo(['Pinco']), null);
  }

  // --- le sedute: il caso del campo ----------------------------------
  if (typeof dominio.sedutaNelGruppo !== 'function') manca('sedutaNelGruppo');
  else {
    const eso_a = ['ESO_A1', 'ESO_A2'];
    dice('dentro: seduta ESO_A1', dominio.sedutaNelGruppo(seduta('ESO_A1'), eso_a), true);
    dice('dentro: seduta ESO_A2', dominio.sedutaNelGruppo(seduta('ESO_A2'), eso_a), true);
    dice('FUORI: seduta ESO_B1', dominio.sedutaNelGruppo(seduta('ESO_B1'), eso_a), false);
    dice('FUORI: seduta ESO_B2', dominio.sedutaNelGruppo(seduta('ESO_B2'), eso_a), false);
    dice('FUORI: seduta dei Ragazzi', dominio.sedutaNelGruppo(seduta('RAG_1'), eso_a), false);
    // Una seduta per due categorie basta che ne abbia una del gruppo.
    dice('dentro: seduta per ESO_A2 e ESO_B1',
      dominio.sedutaNelGruppo(seduta('ESO_A2', 'ESO_B1'), eso_a), true);
    dice('senza filtro si vede tutto', dominio.sedutaNelGruppo(seduta('ESO_B1'), null), true);
    // Questa è la divergenza da decidere, non un dettaglio: rientraNelMacro
    // tiene VISIBILE una seduta senza categorie, le sei copie a mano la
    // scartano. Oggi la stessa seduta si vede nel Calendario e non in
    // Appello. Qui si fissa la regola di rientraNelMacro, che è quella
    // scritta e commentata in dominio.js.
    dice('una seduta senza categorie resta visibile',
      dominio.sedutaNelGruppo(seduta(), eso_a), true);
  }

  // --- la decisione su Carico atleti ---------------------------------
  // Le righe di carico si filtrano SOLO sull'atleta: un atleta del gruppo
  // si vede con TUTTO il suo carico, anche quello fatto in una seduta di
  // un altro gruppo; e un atleta di un altro gruppo resta fuori anche se
  // quel giorno ha nuotato con te. Prima il filtro era sulla data della
  // seduta, e in un giorno con due sedute passavano tutti.
  //
  // La riga qui sotto è la stessa di Volumi.jsx, replicata come fa il
  // simulatore in prova_blocchi.mjs: se qualcuno rimette una condizione
  // sulla seduta, lo dicono le due prove dopo.
  if (typeof dominio.atletaNelGruppo === 'function') {
    const eso_a = ['ESO_A1', 'ESO_A2'];
    const righeDelGruppo = (righe, squadra, codici) => {
      if (!codici) return righe;
      const dentro = new Set(squadra
        .filter((x) => dominio.atletaNelGruppo(x, codici, FASCE_ESO))
        .map((x) => x.id));
      return righe.filter((r) => dentro.has(r.atleta_id));
    };

    const squadra = [atleta('ESO_A1'), atleta('ESO_B1')];
    const righe = [
      { atleta_id: 'ESO_A1', data: '2026-10-05', seduta: 'ESO_B1', metri_nuotati: 1500 },
      { atleta_id: 'ESO_B1', data: '2026-10-05', seduta: 'ESO_A1', metri_nuotati: 1200 },
    ];
    const viste = righeDelGruppo(righe, squadra, eso_a);

    dice('un atleta ESO_A tiene il carico fatto in una seduta ESO_B',
      viste.map((r) => r.atleta_id), ['ESO_A1']);
    dice('e un atleta ESO_B resta fuori anche se ha nuotato in una seduta ESO_A',
      viste.some((r) => r.atleta_id === 'ESO_B1'), false);
  }

  // --- gli atleti: l'altro caso del campo ----------------------------
  if (typeof dominio.atletaNelGruppo !== 'function') manca('atletaNelGruppo');
  else {
    const eso_a = ['ESO_A1', 'ESO_A2'];
    dice('dentro: atleta ESO_A1', dominio.atletaNelGruppo(atleta('ESO_A1'), eso_a, FASCE_ESO), true);
    dice('dentro: atleta ESO_A2', dominio.atletaNelGruppo(atleta('ESO_A2'), eso_a, FASCE_ESO), true);
    dice('FUORI: atleta ESO_B1', dominio.atletaNelGruppo(atleta('ESO_B1'), eso_a, FASCE_ESO), false);
    dice('FUORI: atleta ESO_B2', dominio.atletaNelGruppo(atleta('ESO_B2'), eso_a, FASCE_ESO), false);
    dice('senza filtro si vedono tutti',
      dominio.atletaNelGruppo(atleta('ESO_B1'), null, FASCE_ESO), true);
    // Senza override la categoria viene dall'anno: è il caso normale, e
    // le schermate che si scordano le fasce lo sbagliano in silenzio.
    const dallAnno = { id: 'a1', cognome: 'Rossi', nome: 'Ada', anno_nascita: 2015, sesso: 'F' };
    const dallAnnoB = { id: 'b1', cognome: 'Bianchi', nome: 'Bea', anno_nascita: 2017, sesso: 'F' };
    dice('dentro: nata nel 2015, categoria dall\'anno',
      dominio.atletaNelGruppo(dallAnno, eso_a, FASCE_ESO), true);
    dice('FUORI: nata nel 2017, categoria dall\'anno',
      dominio.atletaNelGruppo(dallAnnoB, eso_a, FASCE_ESO), false);
  }
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ categorie: tutte le prove passate');
