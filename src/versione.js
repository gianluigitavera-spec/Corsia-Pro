// =====================================================================
// Versione dell'app. UNICO posto dove si scrive: la mostra l'intestazione,
// la usa il service worker per la cache, e finisce nel nome dello zip.
// Ad ogni consegna: alza VERSIONE e aggiungi la voce in CAMBIAMENTI.
// =====================================================================
export const VERSIONE = '0.11.0';

export const CAMBIAMENTI = [
  {
    versione: '0.11.0',
    data: '2026-07-30',
    voci: [
      'Data di inizio stagione: la fase generale parte da lì invece che 21 settimane prima della gara',
      'Con obiettivo ad aprile e stagione da settembre, la generale copre tutti i mesi scoperti',
      'Flag delle categorie sulle competizioni: un trofeo può andare dagli Esordienti B agli Assoluti',
    ],
  },
  {
    versione: '0.10.0',
    data: '2026-07-30',
    voci: [
      'Periodizzazione per categoria: generale, speciale, specifica, tapering',
      'Le fasi si generano a ritroso dalla gara obiettivo e si aggiustano trascinando i confini',
      'Le fasce colorano i giorni del calendario, ma solo dentro una categoria: su Tutte restano gare e allenamenti',
      'Vista v_fase_reale: i metri per zona davvero nuotati dentro ogni fase',
    ],
  },
  {
    versione: '0.9.0',
    data: '2026-07-30',
    voci: [
      'Appello a elenco, filtrabile per categoria come le sedute',
      'Quattro stati: presente, ritardo, giustificato, assente',
      'Frequenza settimanale, mensile e totale accanto a ogni nome, più il conto dei ritardi',
      'Solo l\u2019assenza fa scendere la percentuale; ritardo e giustificato contano come presenza',
      'I metri di chi arriva in ritardo entrano nel carico: era in acqua',
    ],
  },
  {
    versione: '0.8.0',
    data: '2026-07-30',
    voci: [
      'La prontezza del benessere compare accanto a ogni nome nell\u2019appello',
      'Ponte SwimCoach AI → CorsiaPro: tasto di invio con scelta di data e categorie',
      'La pagina Squadra non resta più bianca se una chiamata fallisce: mostra il motivo',
      'Numero di versione visibile e registro dei cambiamenti',
    ],
  },
  {
    versione: '0.7.0',
    data: '2026-07-30',
    voci: [
      'Creazione della squadra spostata su una funzione del server (prima la policy RLS la rifiutava)',
      'Un allenatore già in una squadra non può crearne una seconda per sbaglio',
      'Le fasce d\u2019età si proiettano da sola stagione compilata: cambi stagione e tutti passano di categoria',
    ],
  },
  {
    versione: '0.6.0',
    data: '2026-07-30',
    voci: [
      'Scheda Benessere: sonno, fatica, dolori, umore e prontezza calcolata',
      'Lavagna a schermo pieno per il bordo vasca, con zoom',
      'Seduta stampabile in PDF su foglio A4 essenziale',
      'Invio della seduta come testo (condivisione del telefono o appunti)',
    ],
  },
  {
    versione: '0.5.0',
    data: '2026-07-29',
    voci: [
      'Una seduta si rivolge a più categorie, scelte a flag per raggruppamenti',
      'Gruppi di allenamento eliminati da tutta l\u2019app',
      'Selettore di stagione',
      'Calendario filtrabile per Propaganda, Teen, Eso B, Eso A, Ragazzi, J/C/S e Assoluti',
      'Anagrafica società completa: indirizzo, P.IVA, codice FIN, contatti',
      'Registrazione dell\u2019account dentro l\u2019app, con scelta fra creare la squadra o entrare col codice',
      'Installabile sul telefono (PWA) con icona propria',
    ],
  },
  {
    versione: '0.4.0',
    data: '2026-07-29',
    voci: [
      'I metri si calcolano dalla notazione: 4x(1x100 + 2x50), 12/10/8x100',
      'Zona A1 per difetto, recupero scritto @1\u201940',
      'Sezioni e serie si spostano su e giù',
      'Calendario del mese con sei tipi di competizione a colori',
      'Ricerca atleta e modifica dell\u2019anagrafica in riga',
      'Icone in tutta l\u2019interfaccia',
    ],
  },
  {
    versione: '0.3.0',
    data: '2026-07-29',
    voci: [
      'Codice di ingresso della squadra, rigenerabile',
      'Richieste di adesione con approvazione del capo allenatore',
      'Ruoli dello staff: capo allenatore, allenatore, solo lettura',
    ],
  },
  {
    versione: '0.2.0',
    data: '2026-07-29',
    voci: [
      'Tema notte vasca con accenti per zona energetica',
      'Dashboard volumi con ripartizione per zona e per famiglia',
    ],
  },
  {
    versione: '0.1.0',
    data: '2026-07-28',
    voci: [
      'Prima versione: sedute a corsie, appello senza stato per difetto, atleti con import CSV, carico reale per atleta',
    ],
  },
];
