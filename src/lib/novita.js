// =====================================================================
// LE NOVITÀ DA ANNUNCIARE
//
// Alla prima apertura dopo un aggiornamento l'app mostra cosa è cambiato,
// pescando dal registro che si compila comunque a ogni consegna. Niente
// finestre scritte a mano per la singola funzione: la voce del registro è
// già scritta per l'allenatore, quella si riusa.
//
// Cosa merita l'annuncio lo decide chi scrive la voce, con `annuncia:
// true`. Una regola automatica dovrebbe indovinare l'importanza, e
// indovinerebbe male: una correzione silenziosa e una funzione nuova sono
// entrambe una voce di registro, ma solo una vale una finestra in faccia
// a bordo vasca. Le altre restano consultabili dalla pillola in testata.
//
// Qui dentro non si tocca localStorage e non si sa niente di React: è una
// funzione e basta, così i casi limite stanno sotto prova invece che
// scoprirsi sul campo.
// =====================================================================

// Sul telefono più di così non si legge, e non si sta a leggere.
export const TETTO_NOVITA = 5;

/**
 * Le voci da mostrare all'apertura. Elenco vuoto = non aprire niente.
 *
 * @param versione     la versione che sta girando adesso
 * @param cambiamenti  il registro, dal più recente al più vecchio
 * @param vistaPrima   l'ultima versione già annunciata, o null se non c'è
 */
export function novitaDaMostrare(versione, cambiamenti, vistaPrima) {
  const registro = Array.isArray(cambiamenti) ? cambiamenti : [];

  // Prima apertura in assoluto: non si annuncia niente. Chi entra per la
  // prima volta trova il tutorial, non un elenco di novità che non ha mai
  // visto essere vecchie.
  if (!vistaPrima) return [];

  // Da dove si comincia a guardare: la voce della versione che gira. Se
  // il registro contenesse voci più recenti di quella (succede solo in
  // sviluppo, o tornando a una build precedente) non vanno annunciate:
  // sono novità che questo pacchetto non ha dentro.
  //
  // Senza la voce della versione corrente non sappiamo nemmeno dove ci
  // troviamo nel registro, quindi silenzio: chi chiama registra comunque
  // la versione. In un pacchetto consegnato non capita — la build si
  // ferma prima (sincronizza_versione.mjs) — ma in sviluppo sì, fra il
  // momento in cui alzi il numero e quello in cui scrivi la voce.
  const qui = registro.findIndex((c) => c.versione === versione);
  if (qui === -1) return [];
  const inizio = qui;

  // Fin dove: la voce già vista. Se non la troviamo — voce tolta dal
  // registro, o versione mai esistita — si ripiega sulla sola versione
  // corrente, che è il minimo che non mente.
  const vista = registro.findIndex((c) => c.versione === vistaPrima);
  const fine = vista === -1 ? inizio + 1 : vista;

  if (fine <= inizio) return [];

  return registro
    .slice(inizio, fine)
    .filter((c) => c.annuncia === true)
    .slice(0, TETTO_NOVITA);
}
