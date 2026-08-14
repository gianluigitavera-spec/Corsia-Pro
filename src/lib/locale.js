// =====================================================================
// IL MAGAZZINO E LA CODA
//
// In piscina il wifi c'è, ma ogni tanto non c'è. È il caso peggiore: il
// telefono si crede online, la richiesta parte e resta appesa finché non
// scade da sola. Per questo qui non ci si fida di navigator.onLine da
// solo — ogni chiamata ha un tempo massimo, e chi lo supera vale come
// "senza linea".
//
// Due metà:
//   magazzino — l'ultima copia buona di quello che serve a bordo vasca
//               (atleti, sedute, presenze). Se la rete non risponde,
//               l'app apre lo stesso e mostra quella.
//   coda      — quello che hai segnato e non è ancora partito. Non si
//               perde e non si duplica: ogni voce ha una chiave, e la
//               stessa chiave si sovrascrive. Segni Marco assente, poi
//               ritardo, poi presente: in coda resta una riga sola.
//
// localStorage e non IndexedDB di proposito: la roba è piccola (250
// atleti stanno in una trentina di kB) ed è sincrono, quindi non esiste
// la scrittura lasciata a metà se chiudi l'app di colpo.
// =====================================================================

const MAGAZZINO = 'corsiapro:magazzino:';
const CODA = 'corsiapro:coda';
const ATTESA = 6000;   // oltre questo, la rete è come se non ci fosse

// ------------------------------------------------------------ magazzino
export function riponi(nome, dati) {
  try {
    localStorage.setItem(MAGAZZINO + nome, JSON.stringify({ quando: Date.now(), dati }));
  } catch {
    // Spazio finito: si svuota il magazzino e si riprova una volta sola.
    // Perdere la copia locale è fastidioso, bloccare l'app no.
    svuotaMagazzino();
    try { localStorage.setItem(MAGAZZINO + nome, JSON.stringify({ quando: Date.now(), dati })); } catch { /* pazienza */ }
  }
}

export function ripesca(nome) {
  try {
    const grezzo = localStorage.getItem(MAGAZZINO + nome);
    return grezzo ? JSON.parse(grezzo) : null;
  } catch { return null; }
}

export function svuotaMagazzino() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(MAGAZZINO))
    .forEach((k) => localStorage.removeItem(k));
}

// --------------------------------------------------------- stato linea
let senzaLinea = false;
const ascoltatori = new Set();

function avvisa() {
  const stato = { senzaLinea, daInviare: coda().length };
  ascoltatori.forEach((fn) => fn(stato));
}

export function osservaLinea(fn) {
  ascoltatori.add(fn);
  fn({ senzaLinea, daInviare: coda().length });
  return () => ascoltatori.delete(fn);
}

export function segnalaLinea(cè) {
  if (senzaLinea === !cè) return;
  senzaLinea = !cè;
  avvisa();
}

// ----------------------------------------------------------- con rete
// Prova la rete; se tarda o fallisce, tira fuori l'ultima copia buona.
// Se copia non ce n'è, l'errore passa: meglio dirlo che mostrare il vuoto
// facendolo sembrare un dato.
export async function conRete(nome, chiamata, { attesa = ATTESA } = {}) {
  const salvato = ripesca(nome);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    segnalaLinea(false);
    if (salvato) return salvato.dati;
  }

  try {
    const dati = await Promise.race([
      chiamata(),
      new Promise((_, no) => setTimeout(() => no(new Error('tempo scaduto')), attesa)),
    ]);
    riponi(nome, dati);
    segnalaLinea(true);
    return dati;
  } catch (e) {
    if (salvato) {
      segnalaLinea(false);
      return salvato.dati;
    }
    throw e;
  }
}

// --------------------------------------------------------------- coda
export function coda() {
  try {
    const grezzo = localStorage.getItem(CODA);
    return grezzo ? JSON.parse(grezzo) : [];
  } catch { return []; }
}

function scrivi(voci) {
  try { localStorage.setItem(CODA, JSON.stringify(voci)); } catch { /* piena */ }
  avvisa();
}

// La chiave è quello che rende la coda sicura: stessa chiave, una riga
// sola, l'ultima. Per l'appello è seduta+atleta, per il benessere
// atleta+data. Non è una sequenza da rigiocare in ordine: è l'ultimo
// valore che conta.
export function accoda(chiave, voce) {
  const voci = coda().filter((v) => v.chiave !== chiave);
  voci.push({ chiave, quando: Date.now(), tentativi: 0, ...voce });
  scrivi(voci);
}

export function togli(chiave) {
  scrivi(coda().filter((v) => v.chiave !== chiave));
}

export function segnaTentativo(chiave) {
  scrivi(coda().map((v) => (v.chiave === chiave ? { ...v, tentativi: (v.tentativi || 0) + 1 } : v)));
}

// ---------------------------------------------------------------- bozze
// La coda protegge l'appello, non l'editor: una seduta lunga scritta e
// non ancora salvata viveva solo nella memoria della pagina. Cade la
// linea, si ricarica per sbaglio, e mezz'ora di lavoro sparisce.
// Qui ne resta una copia sul telefono finché non è salvata davvero.
const BOZZA = 'corsiapro:bozza:';

export function salvaBozza(chiave, dati) {
  try { localStorage.setItem(BOZZA + chiave, JSON.stringify({ quando: Date.now(), dati })); }
  catch { /* spazio finito: pazienza, non è questo che deve bloccare */ }
}

export function leggiBozza(chiave) {
  try {
    const g = localStorage.getItem(BOZZA + chiave);
    return g ? JSON.parse(g) : null;
  } catch { return null; }
}

export function buttaBozza(chiave) {
  try { localStorage.removeItem(BOZZA + chiave); } catch { /* niente */ }
}
