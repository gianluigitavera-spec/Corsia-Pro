// =====================================================================
// IL TUTORIAL — quando si apre da solo, e dove si torna chiudendolo
//
// Fino alla 0.57.0 il tutorial si segnava "visto" solo con la casella
// «Non mostrare più» spuntata. Chi chiudeva con la X, con «Comincia», con
// Esc o toccando fuori se lo ritrovava a ogni avvio — ed era il tutorial
// aperto da solo a nascondere il pannello delle novità. In più, passo
// dopo passo, portava in giro per le schede e lasciava l'allenatore
// sull'ultima che aveva toccato.
//
// Ora:
//   - si apre da solo una volta, alla prima apertura dell'app;
//   - la prima chiusura, in qualunque modo, vale "visto";
//   - il «?» in testata lo riapre quando vuoi;
//   - chiudendolo si torna alla scheda da cui era partito;
//   - con localStorage che non risponde non si apre da solo: senza poter
//     segnare "visto" tornerebbe a ogni avvio. È la stessa regola delle
//     novità: nel dubbio, silenzio. Chi lo vuole lo apre col «?».
//
// Come novita.js: niente localStorage e niente React qui dentro, così la
// sequenza sta sotto prova (prova_novita.mjs) invece di scoprirsi sul
// campo.
// =====================================================================

export const TUTORIAL_VISTO = 'visto';

/**
 * All'avvio: il tutorial si apre da solo?
 * @param lettura  { ok: true, valore } se localStorage ha risposto
 *                 (valore null se la chiave non c'è), { ok: false } se no
 */
export function tutorialSiApreDaSolo(lettura) {
  if (!lettura?.ok) return false;
  return lettura.valore !== TUTORIAL_VISTO;
}

// Lo stato di un tutorial aperto: si ricorda la scheda da cui è partito,
// che sia l'avvio o il «?».
export const tutorialAperto = (schedaDiPartenza) =>
  ({ aperto: true, daScheda: schedaDiPartenza ?? null });

// La chiusura, in qualunque modo avvenga: si segna "visto" e si torna
// alla scheda di partenza.
export const tutorialChiuso = (stato) =>
  ({ segna: TUTORIAL_VISTO, tornaA: stato?.daScheda ?? null });
