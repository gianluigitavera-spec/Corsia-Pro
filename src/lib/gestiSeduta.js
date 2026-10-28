// =====================================================================
// I GESTI DELL'EDITOR DELLA SEDUTA, IN UN POSTO SOLO
//
// Ogni gesto che cambia una seduta nell'editor: scrivere, aggiungere,
// spostare, togliere. Lavorano sulla COPIA che EditorSeduta prepara in
// aggiorna() (structuredClone) e la cambiano sul posto, come
// sciogliBlocco e inserisciFineBlocco in dominio.js.
//
// Fino al 28/10/2026 stavano dentro EditorSeduta: alcuni come funzioni
// del componente, quattro scritti direttamente nei onClick. La vista per
// il telefono deve fare gli stessi gesti, e due copie del codice che
// ricalcola i blocchi e rimappa svolto sono il guasto del 900 invece di
// 3600 (la riga aggiunta sotto un'apertura che non prendeva il fattore).
// Le regole sono quelle di CLAUDE.md, «Dominio»:
//   - dopo ogni gesto strutturale ricalcolaBlocchi, MAI in lettura;
//   - le chiavi di svolto seguono le righe, nello stesso gesto;
//   - nell'editor la notazione non crea blocchi: solo «+ ripetizione».
// Prove in prova_gesti.mjs, che controlla anche che i componenti non
// scrivano più la seduta da soli.
//
// Le conferme («questa riga ha N metri nuotati, procedo?») restano nel
// componente: sono domande all'allenatore, non regole.
// =====================================================================
import {
  TUTTI, serieVuota, sezioneSeccaVuota, eSecco, metriDaNotazione, normalizzaRecupero,
  ripartenzaDaBase, ricalcolaBlocchi, annotaLettura, annotaPassoGara,
  svoltoDopoTogliRiga, svoltoDopoTogliSezione, svoltoDopoMuoviRiga, svoltoDopoMuoviSezione,
  svoltoDopoInserisciRiga, svoltoDopoInserisciSezione,
  sciogliBlocco, inserisciFineBlocco, applicaAperturaBlocco,
} from './dominio.js';

const muovi = (arr, da, a) => {
  if (a < 0 || a >= arr.length) return arr;
  const copia = [...arr];
  const [x] = copia.splice(da, 1);
  copia.splice(a, 0, x);
  return copia;
};

// ---------------------------------------------------------------------
// Scrivere in una riga
// ---------------------------------------------------------------------

/** La notazione comanda i metri, finché non li scrivi a mano. */
export function cambiaNotazione(s, i, j, valore) {
  const serie = s.sezioni[i].serie[j];
  serie.notazione = valore;
  // A secco la notazione resta una descrizione: "4x12 trazioni" non
  // vale 100 metri. Se lasciassimo leggere i metri qui, finirebbero
  // salvati nel JSON e da lì in avanti li conterebbe anche il
  // database, che i metri li prende dal dato e non dal titolo.
  if (eSecco(s.sezioni[i])) {
    serie.metri = 0;
    serie.zona = '';
    annotaLettura(s.sezioni[i], serie);
    return;
  }
  // Nell'editor la notazione NON crea blocchi: le ripetizioni si
  // fanno solo col tasto "+ ripetizione". Il riconoscimento scattava
  // a ogni tasto, e scrivendo "2x200" si passava per "2x", che è
  // un'apertura valida: per un attimo la riga apriva un blocco, si
  // prendeva le righe sotto, e al tasto dopo le lasciava staccate da
  // quello vero coi metri divisi. Nel testo il riconoscimento resta.
  // La riga di composizione vale zero apposta: ritoccarne la
  // descrizione non la fa diventare un lavoro suo.
  if (!serie.metriManuali && !serie.composizione) {
    // Si scrive la lettura A GIRO: il fattore lo applica il ricalcolo,
    // che è l'unico posto che sa in quale blocco sta questa riga.
    const m = metriDaNotazione(valore);
    if (m !== null) { serie.metri = m; delete serie.moltiplicato; }
  }
  ricalcolaBlocchi(s.sezioni[i]);
  // Il numero del lettore accanto ai metri, anche quando i metri sono
  // scritti a mano: è lo scarto fra i due che dice chi ha deciso.
  annotaLettura(s.sezioni[i], serie);
  // La D nella notazione (D, D200, passo 200): la riga senza zona
  // prende la D. Una zona scelta a mano non si tocca.
  annotaPassoGara(serie);
  // Se la partenza nasce da un passo base, cambiando la distanza si rifà.
  if (serie.base) {
    try {
      const r = ripartenzaDaBase('@@' + serie.base, valore);
      if (r) serie.recupero = r.recupero;
    } catch { /* la partenza resta com'è */ }
  }
}

/** I metri scritti a mano: da qui in poi decide l'allenatore. */
export function cambiaMetri(s, i, j, valore) {
  const serie = s.sezioni[i].serie[j];
  serie.metri = Number(valore) || 0;
  serie.metriManuali = true;   // da qui in poi decidi tu
  delete serie.composizione;   // e non è più la descrizione di un'altra riga
}

export function cambiaZona(s, i, j, zona) {
  s.sezioni[i].serie[j].zona = zona;
}

/** Il recupero mentre si scrive: com'è, senza interpretarlo. */
export function scriviRecupero(s, i, j, valore) {
  s.sezioni[i].serie[j].recupero = valore;
}

/**
 * Il recupero quando si lascia il campo: «@@1:20» è un passo base e
 * diventa la ripartenza della distanza; il resto si normalizza. Un
 * valore che non si capisce resta com'è scritto.
 */
export function sistemaRecupero(s, i, j, valore) {
  const serie = s.sezioni[i]?.serie[j];
  if (!serie) return;
  let recupero = valore;
  let base = null;
  try {
    const dalBase = ripartenzaDaBase(valore, serie.notazione);
    if (dalBase) { recupero = dalBase.recupero; base = dalBase.base; }
    else recupero = normalizzaRecupero(valore);
  } catch (e) {
    console.error('Recupero non interpretato:', e);
    recupero = String(valore || '');
  }
  serie.recupero = recupero;
  if (base) serie.base = base; else delete serie.base;
}

// ---------------------------------------------------------------------
// La sezione
// ---------------------------------------------------------------------

export function cambiaTitoloSezione(s, i, titolo) {
  s.sezioni[i].titolo = titolo;
}

/** La durata a secco, in minuti: vuota resta vuota, mai negativa. */
export function cambiaDurataSecco(s, i, valore) {
  s.sezioni[i].durataMin = valore === '' ? '' : Math.max(0, Number(valore) || 0);
}

/**
 * Tutti o le specializzazioni: Tutti azzera la scelta; una
 * specializzazione si accende o si spegne, e togliendo l'ultima torna
 * Tutti.
 */
export function commutaDestinatario(s, i, spec) {
  const sez = s.sezioni[i];
  const attuali = sez.destinatari?.length ? sez.destinatari : [TUTTI];
  if (spec === TUTTI) { sez.destinatari = [TUTTI]; return; }
  const senza = attuali.filter((d) => d !== TUTTI);
  sez.destinatari = senza.includes(spec) ? senza.filter((d) => d !== spec) : [...senza, spec];
  if (sez.destinatari.length === 0) sez.destinatari = [TUTTI];
}

// ---------------------------------------------------------------------
// Aggiungere
// ---------------------------------------------------------------------

/** «+ serie» (o «+ esercizio» a secco), in coda alla sezione. */
export function aggiungiSerie(s, i) {
  const nuova = eSecco(s.sezioni[i]) ? { ...serieVuota(), zona: '' } : serieVuota();
  const quante = (s.sezioni[i].serie || []).length;
  s.sezioni[i].serie = [...(s.sezioni[i].serie || []), nuova];
  // La riga nuova può cadere dentro un blocco aperto sopra: senza
  // questo non prendeva mai il fattore, ed era il guasto per cui la
  // sezione faceva 900 invece di 3600.
  ricalcolaBlocchi(s.sezioni[i]);
  // In coda non muove nessuna chiave, ma il richiamo c'è lo stesso: il
  // giorno che si potrà inserire in mezzo, il punto giusto è già qui.
  s.svolto = svoltoDopoInserisciRiga(s.svolto, i, quante);
}

/**
 * «+ ripetizione»: il blocco ripetuto senza sapere la notazione. La riga
 * nasce come "2x" e il numero si cambia nell'intestazione. A secco non
 * ha senso, non ci sono metri da moltiplicare: il tasto lì non c'è.
 */
export function aggiungiRipetizione(s, i) {
  const quante = (s.sezioni[i].serie || []).length;
  s.sezioni[i].serie = [
    ...(s.sezioni[i].serie || []),
    { notazione: '2x', metri: 0, zona: '', recupero: '', note: '', senzaMetri: true, apreBlocco: 2 },
  ];
  s.svolto = svoltoDopoInserisciRiga(s.svolto, i, quante);
  ricalcolaBlocchi(s.sezioni[i]);
}

/** «fine ripetizione»: in coda, sotto l'ultima riga del blocco aperto. */
export function fineInCoda(s, i) {
  inserisciFineBlocco(s, i, (s.sezioni[i].serie || []).length);
}

/** Il tasto dell'avviso: chiude il blocco prima di questa riga. */
export function chiudiQui(s, i, j) {
  inserisciFineBlocco(s, i, j);
}

/** Il tasto dell'avviso: applica una singola apertura nuda. */
export function applicaNuda(s, i, j) {
  applicaAperturaBlocco(s.sezioni[i], j);
}

/** «+ sezione»: in fondo, per tutti. */
export function aggiungiSezione(s) {
  s.sezioni.push({ titolo: '', destinatari: [TUTTI], serie: [] });
  s.svolto = svoltoDopoInserisciSezione(s.svolto, s.sezioni.length - 1);
}

/**
 * «+ sezione a secco»: il lavoro a terra viene quasi sempre prima
 * dell'acqua, quindi nasce IN CIMA. Fa scalare di uno il sez_n di ogni
 * sezione della seduta: tutte le chiavi di svolto si spostano.
 */
export function aggiungiSezioneSecca(s) {
  s.sezioni.unshift(sezioneSeccaVuota());
  s.svolto = svoltoDopoInserisciSezione(s.svolto, 0);
}

// ---------------------------------------------------------------------
// Blocchi
// ---------------------------------------------------------------------

/**
 * Quante volte si ripete il blocco. Sotto il 2 non fa niente: per
 * sciogliere c'è il tasto. Prima "1" scioglieva, e battendo "12" si
 * passava per "1": il blocco spariva al primo tasto.
 */
export function ripetiBlocco(s, i, j, n) {
  if (!(n > 1)) return;
  s.sezioni[i].serie[j].apreBlocco = n;
  ricalcolaBlocchi(s.sezioni[i]);
}

/** «Sciogli»: via l'apertura, e la sua fine se c'è, con svolto rimappato. */
export function sciogli(s, i, j) {
  sciogliBlocco(s, i, j);
}

// ---------------------------------------------------------------------
// Spostare e togliere: le chiavi di svolto viaggiano con le righe,
// nello stesso gesto. In due tempi esisterebbe un istante in cui un
// salvataggio parte con le chiavi sfasate. La guardia sui bordi ripete
// quella di muovi() a bella posta: se lo spostamento non avviene, la
// rimappatura non deve avvenire.
// ---------------------------------------------------------------------

export function muoviRiga(s, i, da, a) {
  const serie = s.sezioni[i].serie || [];
  if (a < 0 || a >= serie.length) return;
  s.sezioni[i].serie = muovi(serie, da, a);
  s.svolto = svoltoDopoMuoviRiga(s.svolto, i, da, a);
  ricalcolaBlocchi(s.sezioni[i]);      // la riga può essere uscita o entrata in un blocco
}

export function muoviSezione(s, da, a) {
  if (a < 0 || a >= (s.sezioni || []).length) return;
  s.sezioni = muovi(s.sezioni, da, a);
  s.svolto = svoltoDopoMuoviSezione(s.svolto, da, a);
}

export function togliRiga(s, i, j) {
  s.sezioni[i].serie.splice(j, 1);
  s.svolto = svoltoDopoTogliRiga(s.svolto, i, j);
  ricalcolaBlocchi(s.sezioni[i]);    // se era l'apertura, le figlie si liberano
}

export function togliSezione(s, i) {
  s.sezioni.splice(i, 1);
  s.svolto = svoltoDopoTogliSezione(s.svolto, i);
}
