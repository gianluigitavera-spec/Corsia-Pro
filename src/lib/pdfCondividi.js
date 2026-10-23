// =====================================================================
// IL TASTO «PDF»: CONDIVIDERE IL FILE, O STAMPARE
//
// Dove il telefono condivide file, il PDF lo scrive l'app (pdfSeduta.js)
// e va al foglio di condivisione già col suo nome. Altrove — il computer,
// i browser che non condividono file — resta la stampa di sempre
// (stampa.js), che lì funziona e il nome lo propone già.
//
// jsPDF e Public Sans sono pezzi a parte (circa 130 KB compressi più
// tre caratteri da 30 KB): li scarica solo chi apre una seduta da un
// telefono, e li scarica PRIMA del tocco. Stanno in /assets/ con
// l'impronta nel nome, quindi il service worker li tiene per sempre.
// iOS vuole la condivisione attaccata al gesto: un'attesa lunga fra il
// tocco e navigator.share la fa rifiutare (NotAllowedError). Con tutto
// già in memoria, al tocco il file si scrive in pochi millisecondi.
// =====================================================================
import regular from '../assets/font/PublicSans-Regular-pdf.ttf?url';
import semibold from '../assets/font/PublicSans-SemiBold-pdf.ttf?url';
import bold from '../assets/font/PublicSans-Bold-pdf.ttf?url';
import { creaPdfSeduta } from './pdfSeduta';
import { stampaConNome } from './stampa';

// Il telefono: condivide file e si usa col dito. Sul computer Chrome e
// Edge sanno condividere file anche loro, ma lì si vuole la stampa.
export const condivideFile = () =>
  typeof navigator !== 'undefined'
  && typeof navigator.canShare === 'function'
  && typeof window.File === 'function'
  && window.matchMedia?.('(pointer: coarse)').matches === true;

const inBase64 = (buffer) => {
  const byte = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < byte.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, byte.subarray(i, i + 0x8000));
  }
  return window.btoa(s);
};

const scarica = (url) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`carattere non scaricato (${r.status})`);
  return r.arrayBuffer();
}).then(inBase64);

let pronto = null;      // { JsPDF, caratteri } quando c'è tutto
let inArrivo = null;    // la promessa del caricamento, una sola

/** Scarica jsPDF e i caratteri, una volta sola. Gli errori si riprovano. */
export function precaricaPdf() {
  if (pronto) return Promise.resolve(pronto);
  if (!inArrivo) {
    inArrivo = Promise.all([import('jspdf'), scarica(regular), scarica(semibold), scarica(bold)])
      .then(([modulo, normal, semi, grassetto]) => {
        pronto = { JsPDF: modulo.jsPDF, caratteri: { normal, semibold: semi, bold: grassetto } };
        return pronto;
      })
      .catch((e) => { inArrivo = null; throw e; });
  }
  return inArrivo;
}

const descrivi = (e) => `${e?.name || 'errore senza nome'} — ${e?.message || 'nessun messaggio'}`;

/**
 * Il tasto «PDF». Torna null quando non c'è niente da dire (condiviso,
 * annullato, stampa aperta), altrimenti { tipo, testo } da mostrare.
 * @param foglio  foglioSeduta(seduta, ...): lo stesso del foglio di stampa
 * @param nome    nomeFileSeduta(seduta), senza estensione
 */
export async function pdfSeduta(foglio, nome) {
  if (!condivideFile()) { stampaConNome(nome); return null; }

  // Di solito è già qui. Se no si aspetta: con la cache del service
  // worker è un attimo, ma iOS potrebbe non considerarlo più il tocco.
  const freddo = !pronto;
  let pdf;
  try {
    pdf = pronto || await precaricaPdf();
  } catch (e) {
    return { tipo: 'errore', testo: `PDF non preparato: ${descrivi(e)}. Riprova con la linea.` };
  }

  let file;
  try {
    const { doc } = creaPdfSeduta(pdf.JsPDF, foglio, pdf.caratteri, { titolo: nome });
    file = new window.File([doc.output('blob')], `${nome}.pdf`, { type: 'application/pdf' });
  } catch (e) {
    return { tipo: 'errore', testo: `PDF non creato: ${descrivi(e)}` };
  }
  if (!navigator.canShare({ files: [file] })) { stampaConNome(nome); return null; }

  try {
    await navigator.share({ files: [file], title: nome });
    return null;
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    if (e?.name === 'NotAllowedError' && freddo) {
      return { tipo: 'ok', testo: 'Il PDF è pronto: tocca di nuovo «PDF».' };
    }
    return { tipo: 'errore', testo: `PDF non condiviso: ${descrivi(e)}` };
  }
}
