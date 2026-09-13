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
//   composizione            i sotto-tratti che sommano la distanza sopra
//                           valgono 0 apposta, e quello lo dice già
//                           `metri`. Il perché è roba del lettore.
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
const SCARTA_RIGA = ['fiducia', 'stile', 'attrezzi', 'modalita', 'composizione', 'descrizione'];

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

export function sedutaDaLettura(sezioniLette, correzioni = {}) {
  return (sezioniLette || []).map((sez, i) => ({
    ...senza(sez, [...SCARTA_SEZIONE, 'serie']),
    // Il lettore scrive già ['*'], che è TUTTI. Questo resta per la
    // sezione che arrivasse senza destinatari: [] non filtra nessuno e
    // farebbe sparire la sezione dai volumi di chiunque.
    destinatari: sez.destinatari?.length ? sez.destinatari : [TUTTI],
    serie: (sez.serie || []).map((s, j) => ({
      ...senza(s, SCARTA_RIGA),
      metri: Number(corretto(correzioni, i, j, 'metri', s.metri)) || 0,
      zona: corretto(correzioni, i, j, 'zona', s.zona) || '',
      recupero: s.recupero || '',
      note: [s.note, (s.modalita || []).join(', '), (s.attrezzi || []).join(', ')]
        .filter(Boolean).join(' · '),
      // I metri vengono dal testo, dove la regola della vasca è già stata
      // applicata ("2x10" fa 50, non 20) e le figlie di un blocco sono
      // già moltiplicate. Ricalcolarli dalla notazione li rovinerebbe.
      //
      // NON è questo campo a impedire che un blocco importato venga
      // moltiplicato una seconda volta: a quello pensa `moltiplicato`,
      // che ora passa. Finché si perdeva, il raddoppio restava tappato
      // da qui per combinazione — prova_import.mjs lo verifica proprio
      // con le righe spogliate di `metriManuali`.
      metriManuali: true,
    })).filter((s) => s.notazione),
  })).filter((sez) => sez.serie.length > 0);
}
