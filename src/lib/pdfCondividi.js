// =====================================================================
// IL TASTO «PDF»: CONDIVIDERE IL FILE, O STAMPARE
//
// Per la seduta e per il report presenze. Dove il telefono condivide
// file, il PDF lo scrive l'app (pdfSeduta.js, pdfReport.js) e va al
// foglio di condivisione già col suo nome. Altrove — il computer,
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
import { creaPdfReport } from './pdfReport';
import { creaPdfFoglioTest } from './pdfTest';
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
 * @param crea  (JsPDF, caratteri) → il documento jsPDF
 * @param nome  il nome del file, senza estensione
 */
async function condividiPdf(crea, nome, altrove = () => { stampaConNome(nome); return null; }) {
  if (!condivideFile()) return altrove();

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
    const doc = crea(pdf.JsPDF, pdf.caratteri);
    file = new window.File([doc.output('blob')], `${nome}.pdf`, { type: 'application/pdf' });
  } catch (e) {
    return { tipo: 'errore', testo: `PDF non creato: ${descrivi(e)}` };
  }
  if (!navigator.canShare({ files: [file] })) return altrove();

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

/** La seduta: foglioSeduta(seduta, ...), e nomeFileSeduta(seduta). */
export const pdfSeduta = (foglio, nome) => condividiPdf(
  (JsPDF, caratteri) => creaPdfSeduta(JsPDF, foglio, caratteri, { titolo: nome }).doc, nome);

/**
 * Il report presenze: quello che dominio.js ha calcolato e lo schermo
 * mostra, la forma, la testata come a schermo, e nomeFileReport(...).
 */
export const pdfReport = (report, forma, testata, nome) => condividiPdf(
  (JsPDF, caratteri) => creaPdfReport(JsPDF, report, forma, testata, caratteri, { titolo: nome }).doc, nome);

/**
 * Sul computer, il PDF scritto dall'app in una scheda nuova, da cui si
 * stampa. Per il foglio dei test: la stampa del browser stamperebbe lo
 * schermo, cioè il modulo di «Registra», non la griglia. La scheda si
 * apre SUBITO, attaccata al tocco, o il browser la blocca; il PDF ci
 * arriva quando è pronto. Se è bloccata lo stesso, il file si scarica
 * col suo nome.
 */
async function apriSulComputer(crea, nome) {
  const scheda = window.open('', '_blank');
  try {
    const pdf = await precaricaPdf();
    const blob = crea(pdf.JsPDF, pdf.caratteri).output('blob');
    const url = URL.createObjectURL(blob);
    if (scheda) {
      scheda.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nome}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return null;
  } catch (e) {
    scheda?.close();
    return { tipo: 'errore', testo: `PDF non creato: ${descrivi(e)}` };
  }
}

/**
 * Il foglio da bordo vasca dei test: { tipo, data, vasca, gruppi,
 * societa, atleti } (atleti null = senza nomi), e nomeFileFoglioTest.
 * Sul telefono si condivide, sul computer si apre per stamparlo.
 */
export const pdfFoglioTest = (foglio, nome) => {
  const crea = (JsPDF, caratteri) => creaPdfFoglioTest(JsPDF, foglio, caratteri, { titolo: nome }).doc;
  return condividiPdf(crea, nome, () => apriSulComputer(crea, nome));
};
