// =====================================================================
// LA STAMPA, CON IL NOME DEL FILE
//
// Il PDF è la stampa del browser, che come nome del file propone il
// titolo della pagina. Per la durata della stampa la pagina si chiama
// come il file, poi torna com'era dopo 60 secondi.
//
// Fino alla 0.58.0 tornava con afterprint, o al primo focus. Sull'app
// installata in iPhone il PDF usciva come «CorsiaPro»: quegli eventi
// possono arrivare prima che la stampa legga il titolo. Con un tempo
// fisso il nome resta lì mentre il foglio di stampa è aperto; il prezzo è
// che per un minuto la scheda del browser si chiama come il file.
//
// Un posto solo, per le sedute (nomeFileSeduta) e per il report presenze
// (nomeFileReport): il nome lo decide dominio.js, qui si stampa e basta.
// =====================================================================
export function stampaConNome(nome) {
  const prima = document.title;
  document.title = nome;
  setTimeout(() => { document.title = prima; }, 60000);
  window.print();
}
