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

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ categorie: tutte le prove passate');
