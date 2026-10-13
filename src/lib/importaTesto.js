// =====================================================================
// DAL TESTO ALL'EDITOR — il ponte fra quello che il lettore ha capito e
// la seduta che finisce in archivio.
//
// PERCHÉ QUESTO FILE ESISTE, e perché è scritto al contrario di come
// verrebbe naturale.
//
// Prima questa conversione stava dentro `conferma()` in RevisioneTesto e
// costruiva la riga elencando i campi da tenere: notazione, metri, zona,
// recupero, note. Sembra la forma prudente — si scrive solo quello che
// serve — ed è invece quella che perde. Ogni campo aggiunto al modello
// dopo, e non aggiunto anche a quell'elenco, cadeva qui in silenzio:
//
//   `aSecco` e `durataMin` (0.52.0)   una sezione "Palestra" scritta nel
//     testo arrivava nell'editor come sezione d'acqua: niente striscia
//     gialla, e le colonne ZONA e METRI dove metri non ce ne sono.
//   `apreBlocco`, `moltiplicato`, `senzaMetri` (0.54.0)   un blocco "3x"
//     arrivava piatto: i metri giusti, la struttura no, e la notazione
//     che non torna coi metri ("2x50" accanto a 300).
//
// Tre rilasci, cinque campi, sempre lo stesso difetto. Quindi qui si fa
// il contrario: si parte da quello che il lettore ha prodotto e si
// SCARTA per nome quello che non deve passare. L'elenco di scarto è la
// parte ferma del modello — i campi del lettore cambiano di rado, quelli
// del dominio crescono — e un campo nuovo aggiunto domani passa da sé
// invece di sparire.
//
// Sta in un file suo, e non dentro il componente, perché così si prova
// senza montare React: prova_import.mjs.
// =====================================================================
import { TUTTI } from './dominio.js';

// Campi che il lettore mette per sé e che in archivio non ci vanno.
//
//   fiducia                 il semaforo del revisore: verde/gialla/rossa.
//                           Vale finché l'allenatore guarda la revisione,
//                           dopo la conferma non significa più niente.
//   stile, attrezzi,        il modello della riga non li ha come campi:
//   modalita                confluiscono in `note` qui sotto.
//   descrizione             il riassunto della composizione che il lettore
//                           appende alla riga padre. Oggi nessuno la
//                           mostra nell'editor: passarla vorrebbe dire
//                           scriverla in archivio perché non la legga
//                           nessuno. Resta persa, ed è annotato in coda
//                           in CLAUDE.md — si recupera quando l'editor
//                           saprà cosa farsene.
//
// Quello che NON è qui dentro passa, ed è voluto: `senzaMetri`,
// `apreBlocco` e `moltiplicato` sono dominio, non lettura.
//
// Anche `composizione`, dalla 0.56.10. Prima si scartava: "i sotto-tratti
// valgono 0 e quello lo dice già `metri`". Lo diceva finché nessuno
// toccava la riga — `metriManuali` su tutte le righe importate teneva
// fermi i metri per combinazione. Tolto quel tappo, ritoccare "50 sl" in
// "50 sl forte" la rileggeva come lavoro suo e gonfiava la seduta di 50.
// Lo zero di una composizione non è un'assenza di metri: è una scelta, e
// la scelta va scritta.
const SCARTA_RIGA = ['fiducia', 'stile', 'attrezzi', 'modalita', 'descrizione'];

// Come sopra, per la sezione.
//
//   zonaEreditata           la zona che il lettore si porta dietro da una
//                           riga di sola zona, per assegnarla alle serie
//                           che seguono. Finito quel giro, è scritta
//                           sulle righe: sulla sezione è un residuo.
//   particolare             "questa intestazione erano destinatari
//                           particolari": serve al lettore per non
//                           confonderla con una sezione vera.
const SCARTA_SEZIONE = ['zonaEreditata', 'particolare'];

// Il numero del lettore, PRIMA delle correzioni del revisore: è lui che
// permette di dire, dopo, se `metri` l'ha scelto l'allenatore. Stesse
// regole di annotaLettura in dominio.js — assente su aperture e lavoro a
// secco, null sulla riga che il lettore non ha capito (la rossa, che
// arriva a zero perché un numero non l'ha trovato, non perché valga zero).
// Qui però il numero è quello dell'analizzatore e non si rilegge dalla
// notazione: le composizioni a zero e i blocchi già moltiplicati sono
// lettura anche loro.
const lettura = (sez, s) => {
  if (sez.aSecco === true || s.apreBlocco > 1) return {};
  if (s.fiducia === 'rossa') return { metriLetti: null };
  return { metriLetti: Number(s.metri) || 0 };
};

const senza = (oggetto, nomi) => {
  const copia = { ...oggetto };
  for (const n of nomi) delete copia[n];
  return copia;
};

// Le correzioni sono la mappa "sezione:riga" -> { zona, metri, confermata }
// che l'allenatore ha compilato nel revisore.
const corretto = (correzioni, i, j, campo, difetto) => {
  const c = correzioni?.[`${i}:${j}`];
  return c && c[campo] !== undefined ? c[campo] : difetto;
};

// `metriManuali` solo sulle righe coi metri corretti nel revisore: sono
// le uniche dove il numero l'ha deciso l'allenatore, ed è lo stesso
// significato che il campo ha nell'editor ("da qui in poi decidi tu").
//
// Fino alla 0.56.10 stava su TUTTE le righe importate, perché il vecchio
// metriDaNotazione leggeva la notazione diversamente dal lettore del
// testo e, ritoccando una riga, l'avrebbe riscritta male. Dalla 0.56.6
// il lettore è uno, e quel tappo faceva solo danni: una riga importata
// ritoccata nell'editor teneva i metri vecchi, e un blocco importato non
// si riscalava cambiando le volte.
//
// Una correzione uguale al numero letto non è una correzione: l'input
// del revisore resta in `correzioni` anche quando lo si riporta al
// valore di partenza, e marcarla bloccherebbe la riga senza motivo.
const metriCorretti = (correzioni, i, j, s) => {
  const c = correzioni?.[`${i}:${j}`];
  if (!c || c.metri === undefined) return false;
  return (Number(c.metri) || 0) !== (Number(s.metri) || 0);
};

export function sedutaDaLettura(sezioniLette, correzioni = {}) {
  return (sezioniLette || []).map((sez, i) => ({
    ...senza(sez, [...SCARTA_SEZIONE, 'serie']),
    // Il lettore scrive già ['*'], che è TUTTI. Questo resta per la
    // sezione che arrivasse senza destinatari: [] non filtra nessuno e
    // farebbe sparire la sezione dai volumi di chiunque.
    destinatari: sez.destinatari?.length ? sez.destinatari : [TUTTI],
    serie: (sez.serie || []).map((s, j) => {
      const riga = {
        ...senza(s, SCARTA_RIGA),
        ...lettura(sez, s),
        metri: Number(corretto(correzioni, i, j, 'metri', s.metri)) || 0,
        zona: corretto(correzioni, i, j, 'zona', s.zona) || '',
        recupero: s.recupero || '',
        note: [s.note, (s.modalita || []).join(', '), (s.attrezzi || []).join(', ')]
          .filter(Boolean).join(' · '),
      };
      // Metri scritti a mano nel revisore: la riga smette di essere
      // composizione, come quando li si batte nell'editor (cambiaMetri).
      if (metriCorretti(correzioni, i, j, s)) {
        riga.metriManuali = true;
        delete riga.composizione;
      }
      return riga;
    }).filter((s) => s.notazione),
  })).filter((sez) => sez.serie.length > 0);
}
