// Iniettati da vite al momento della build (vedi vite.config.js).
export const VERSIONE = typeof __VERSIONE__ !== 'undefined' ? __VERSIONE__ : '0.0.0';
export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : '';

// Serve per capire, guardando il sito, se il deploy è andato a buon fine.
export const ETICHETTA = `v${VERSIONE}`;

if (typeof console !== 'undefined') {
  console.info(`CorsiaPro ${ETICHETTA} — build ${BUILD}`);
}
