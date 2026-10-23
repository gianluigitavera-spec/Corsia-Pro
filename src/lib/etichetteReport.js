// =====================================================================
// LE PAROLE DEL REPORT PRESENZE
//
// Le dicono due fogli: lo schermo (ReportPresenze.jsx) e il PDF generato
// dall'app (pdfReport.js). Stanno qui perché li dicano uguali: il report
// stampato non deve chiamare le cose in un altro modo da quello a
// schermo.
// =====================================================================

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
export const GIORNI_BREVI = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
export const NOMI_STATO = { P: 'Presente', R: 'Ritardo', G: 'Giustificato', A: 'Assente' };

export const nomeMese = (m) => `${MESI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const meseBreve = (m) => MESI_BREVI[Number(m.slice(5, 7)) - 1];
export const giornoBreve = (data) => GIORNI_BREVI[new Date(`${data}T12:00`).getDay()];
export const percentuale = (pct) => (pct == null ? '—' : `${pct}%`);
export const statoPerEsteso = (stato) => (stato ? NOMI_STATO[stato] : 'non rilevato');

export const NOTA_REPORT = 'Percentuale: presenti e ritardi su presenti, ritardi e assenti. Il giustificato non entra '
  + 'nel conto; «—» vuol dire nessun appello da contare. I giorni e i mesi che devono ancora '
  + 'venire restano vuoti.';

/** La riga in testa al report del giorno. */
export const riepilogoGiorno = (r) =>
  `${r.presenti} presenti · ${r.conti.a} assenti · ${r.conti.g} giustificati`
  + `${r.conti.nonRilevati ? ` · ${r.conti.nonRilevati} non rilevati` : ''} · ${percentuale(r.conti.pct)}`;
