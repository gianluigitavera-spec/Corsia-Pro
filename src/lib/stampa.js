// =====================================================================
// LA STAMPA, CON IL NOME DEL FILE
//
// Il PDF è la stampa del browser, che come nome del file propone il
// titolo della pagina. Per la durata della stampa la pagina si chiama
// come il file, poi torna com'era. Si rimette a posto con afterprint; il
// focus è la rete di sicurezza per i browser dove afterprint non arriva,
// così il titolo non resta appeso.
//
// Un posto solo, per le sedute (nomeFileSeduta) e per il report presenze
// (nomeFileReport): il nome lo decide dominio.js, qui si stampa e basta.
// =====================================================================
// PROVA iOS (ramo prova-ios, non per sviluppo): sull'app installata il PDF
// esce come «CorsiaPro». Per capire se il titolo lo rimettiamo noi troppo
// presto (afterprint e focus possono arrivare subito su iOS) o se l'app
// installata usa il suo nome comunque, qui il titolo resta cambiato per
// 60 secondi, senza afterprint né focus.
export function stampaConNome(nome) {
  const prima = document.title;
  document.title = nome;
  setTimeout(() => { document.title = prima; }, 60000);
  window.print();
}
