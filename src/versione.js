// =====================================================================
// Registro delle novità. Il NUMERO di versione non si scrive più qui:
// la fonte unica è "version" in package.json, da cui vite lo inietta
// (vedi src/lib/versione.js) e da cui sincronizza_versione.mjs riscrive
// la cache del service worker prima di ogni build.
// Ad ogni consegna: alza "version" in package.json e aggiungi qui la voce
// corrispondente in CAMBIAMENTI — senza, la build si ferma.
// =====================================================================
export { VERSIONE } from './lib/versione';

export const CAMBIAMENTI = [
  {
    versione: '0.33.0',
    data: '2026-08-05',
    voci: [
      'Tasto Salva in "Com\u2019\u00e8 andata": prima salvava di nascosto e non si capiva se era andato',
      'Finch\u00e9 c\u2019\u00e8 qualcosa in sospeso il tasto resta acceso e lo dice; a cose fatte diventa "Salvato"',
      'Se cambi seduta con delle modifiche aperte, quelle partono lo stesso',
    ],
  },
  {
    versione: '0.32.0',
    data: '2026-08-05',
    voci: [
      'Carico atleti conta i metri DAVVERO nuotati, non pi\u00f9 quelli programmati',
      'Anche la ripartizione per zona del grafico settimanale segue le correzioni di "Com\u2019\u00e8 andata"',
      'Il conto non passa pi\u00f9 dalle viste SQL: lo fa l\u2019app, quindi funziona anche senza linea',
      'La regola dello split regge: se il gruppo mezzofondo chiude prima, il velocista non ne risente',
    ],
  },
  {
    versione: '0.31.0',
    data: '2026-08-05',
    voci: [
      'Nuovo riquadro "Com\u2019\u00e8 andata" sotto l\u2019appello: correggi riga per riga quello che il gruppo ha davvero nuotato',
      'Si toccano solo le righe andate diversamente; il programma scritto non viene mai riscritto',
      'Dice anche in quale zona \u00e8 caduto lo scarto, non solo quanti metri mancano',
      'Funziona senza linea come l\u2019appello: finisce in coda e parte da solo',
    ],
  },
  {
    versione: '0.31.0',
    data: '2026-08-04',
    voci: [
      'Nuovo pannello "Com\u2019\u00e8 andata" in fondo all\u2019Appello: correggi riga per riga i metri davvero nuotati',
      'Vale per tutto il gruppo, non per il singolo atleta',
      'Dice dove cade la differenza per famiglia di zona: se tagli il finale, quasi sempre perdi la parte tosta',
      'Si salvano solo gli scostamenti: una seduta andata come previsto non occupa niente e il programma non si riscrive mai',
      'Richiede la migrazione 022',
    ],
  },
  {
    versione: '0.30.0',
    data: '2026-08-04',
    voci: [
      'Regola della vasca: qualsiasi tratto sotto i 25 vale 25 \u2014 "2x10" di partenze fa 50 metri, non 20',
      'Virate e partenze con una misura scritta ora contano: "Virate partendo dai 10m 8x25" fa 200',
      'Restano a zero solo quelle senza misura e tutto il lavoro a secco',
      'Letture giuste sul foglio Esordienti A: dal 90% al 92%',
    ],
  },
  {
    versione: '0.29.0',
    data: '2026-08-04',
    voci: [
      'Legge il set anche quando sta in fondo alla riga dopo la descrizione: "100GB 50 (...) 4x(100 + 2x50)" fa 800',
      'Un titolo che porta con s\u00e9 il lavoro non se lo mangia pi\u00f9: "Riscaldamento 1x400" vale 400',
      'Corretta la lettura di "1x 10x100", che valeva 10 metri',
      'Verificato su 307 righe del foglio Esordienti A: dal 71% al 90% di letture giuste',
    ],
  },
  {
    versione: '0.28.0',
    data: '2026-08-04',
    voci: [
      '"1 serie per stile" e "MX 1x" non moltiplicano pi\u00f9 i metri per quattro: sono descrittori, i metri restano quelli scritti',
      'La riga 4x(150 + 4x25) 150SL 25 1serie X torna a valere 1000 m invece di 4000',
      'Chi la scrive resta segnalato in revisione, ma senza il punto interrogativo giallo di prima',
    ],
  },
  {
    versione: '0.27.0',
    data: '2026-08-04',
    voci: [
      'Corretta la X maiuscola: 8X25 faceva zero metri, adesso ne fa 200',
      'Somma le misure sulla stessa riga: "3x25 + 1x75 Remate DO" fa 150, non 75',
      'Somma anche pi\u00f9 gruppi fra parentesi: "(3x25) + (1x75)" fa 150',
      'Sul telefono la tabella scorre dentro la sua scheda invece di trascinare tutta la pagina',
      'Testata che va a capo e colonne pi\u00f9 strette: il marchio non finisce pi\u00f9 fuori schermo',
      'Sotto i 560px la tabella atleti nasconde sesso e anno e sta nello schermo senza scorrere',
    ],
  },
  {
    versione: '0.26.0',
    data: '2026-08-04',
    voci: [
      'La registrazione chiede nome e cognome: finora l\u2019app conosceva solo l\u2019email',
      'Il nome viaggia nei metadati dell\u2019utente, quindi nessuna tabella nuova e nessuna migrazione',
      'Query degli iscritti aggiornata: mostra il nome, e per i vecchi iscritti lo indovina dall\u2019email dichiarandolo',
    ],
  },
  {
    versione: '0.25.0',
    data: '2026-08-04',
    voci: [
      'La stagione cambia a luglio, non a settembre: l\u2019app apre gi\u00e0 sulla 2026/27',
      'La 2025/26 resta nel selettore e le sedute vecchie non si spostano',
      'Le fasce d\u2019et\u00e0 della 2026/27 si proiettano da sole: tutta la squadra sale di categoria',
      'Prove automatiche sul cambio stagione e sulla proiezione delle fasce',
    ],
  },
  {
    versione: '0.24.0',
    data: '2026-08-04',
    voci: [
      'Legge i gruppi fra parentesi: 3x(2x50+4x25) fa 600 m, non zero',
      'Legge la misura anche quando la scrivi DOPO il lavoro: "PS 12x25 progr 1-4"',
      'Le parentesi di sola descrizione restano note e non diventano metri',
      'Le ripartenze non vengono pi\u00f9 scambiate per vasche',
      'L\u2019andatura scritta sul titolo scende su tutta la sezione: "Centrale A2" e non la ripeti pi\u00f9 riga per riga',
      '21 prove sull\u2019analizzatore, prese dagli allenamenti veri, girano prima di ogni consegna',
    ],
  },
  {
    versione: '0.23.0',
    data: '2026-08-04',
    voci: [
      'Quando il wifi della piscina molla, l\u2019app continua a funzionare: seduta, lavagna, atleti e appello restano leggibili',
      'Ogni chiamata ha un tempo massimo di 6 secondi: la linea che c\u2019\u00e8 ma non risponde vale come linea assente',
      'Quello che segni senza linea resta sul telefono e parte da solo appena torna',
      'Spia in testata con il conto di quello che deve ancora partire \u2014 toccala per riprovare subito',
      'Se rimarchi lo stesso atleta pi\u00f9 volte, in coda resta solo l\u2019ultimo stato',
    ],
  },
  {
    versione: '0.22.0',
    data: '2026-08-04',
    voci: [
      'Librerie e nostro codice in file separati: un aggiornamento scarica 46 kB invece di 161',
      'React e Supabase restano in cache fra una versione e l\u2019altra, non si riscaricano ogni volta',
      'A bordo vasca con poca linea l\u2019app riparte molto pi\u00f9 in fretta dopo una release',
    ],
  },
  {
    versione: '0.21.0',
    data: '2026-08-02',
    voci: [
      'Nuova categoria Master, una sola: si assegna a mano, perché Master \u00e8 un tesseramento e non un\u2019et\u00e0',
      'Atleti: caselle di selezione e azioni di massa \u2014 categoria, specializzazione, archivia, cancella',
      '"Seleziona tutti" prende quelli che stai vedendo, quindi funziona anche con la ricerca attiva',
      'Cancellazione vera solo per chi non ha ancora presenze o benessere: gli altri vanno archiviati, cos\u00ec lo storico regge',
      'L\u2019import non ricrea pi\u00f9 i doppioni: alla fine dice quanti erano e chi, archiviati compresi',
      'Riconosce come stessa persona anche chi \u00e8 scritto con accenti, apostrofi o spazi diversi',
    ],
  },
  {
    versione: '0.20.1',
    data: '2026-08-01',
    voci: [
      'CORRETTO: la cache del telefono era ferma alla 0.5.0 — le versioni vecchie non venivano mai buttate via, e l\u2019app installata restava indietro',
      'Il numero di versione ora si scrive in un posto solo (package.json): gli altri due si allineano da soli prima della build',
      'La consegna si ferma se il registro delle novità non ha la voce della versione che stai costruendo',
    ],
  },
  {
    versione: '0.20.0',
    data: '2026-08-01',
    voci: [
      'Testata rifatta: marchio e tasti sulla prima riga, squadra e stagione sulla seconda',
      'Sul telefono la testata non finisce più sotto la tacca e occupa la metà dello spazio',
      'Il numero di versione compariva due volte: ora è uno solo, e il tooltip mostra la build',
      'Stagioni limitate: dalla 2025/26 in poi, tre alla volta',
    ],
  },
  {
    versione: '0.19.2',
    data: '2026-07-31',
    voci: [
      'CORRETTO: aprendo le Sedute compariva "dataIt is not defined" — mancavano quattro funzioni fra gli import dell\u2019editor',
      'Controllo automatico degli import prima di ogni consegna, così questo tipo di errore non arriva più a schermo',
    ],
  },
  {
    versione: '0.19.1',
    data: '2026-07-31',
    voci: [
      'Tasto "Modello" in Atleti: scarica il CSV vuoto già intestato, con due righe di esempio da cancellare',
    ],
  },
  {
    versione: '0.19.0',
    data: '2026-07-31',
    voci: [
      'Tasto "Scrivimi" in alto: problema, idea o altro, con versione e schermata allegate in automatico',
      'Le segnalazioni finiscono nella stessa tabella di SwimCoach AI, distinte dal campo app',
    ],
  },
  {
    versione: '0.18.0',
    data: '2026-07-31',
    voci: [
      'Obiettivi di fase decisi dall\u2019allenatore, categoria per categoria: nessun numero standard',
      'Programmato contro nuotato in Carico atleti: barra chiara l\u2019atteso, barra piena il reale, con lo scarto',
      'Gli obiettivi si impostano dal calendario, sotto la periodizzazione della categoria',
    ],
  },
  {
    versione: '0.17.0',
    data: '2026-07-31',
    voci: [
      'Nel testo libero "Velocisti", "Mezzofondo" e "Salvamento" restringono la sezione a quel gruppo; "Centrale" resta per tutti',
      'Nuova scheda Esercizi su tre livelli: della settimana, della squadra, comuni',
      'Codice permanente per ogni esercizio (DO-01), proposto in automatico secondo lo stile',
      'Link ai video con anteprima; i link YouTube rotti diventano rossi al controllo, gli altri si segnalano a mano',
      'In Carico atleti "Nuotati dagli atleti" sostituito dal numero di sedute del periodo',
    ],
  },
  {
    versione: '0.16.0',
    data: '2026-07-31',
    voci: [
      'Date in formato gg.mm.aaaa in tutta l\u2019app',
      '"@3\u2019" ora vuol dire tre minuti, non tre secondi',
      'Durata stimata della seduta, calcolata da ripetizioni × ripartenza',
      'La zona scelta sulla riga "4x" scende su tutte le serie del blocco',
      'Senza titolo, la seduta prende il nome delle categorie a cui è rivolta',
      'Il tutorial spiega come installare l\u2019app sul telefono',
    ],
  },
  {
    versione: '0.15.1',
    data: '2026-07-31',
    voci: [
      'CORRETTO: uno 0 comparso in coda alle notazioni senza attrezzi né modalità',
      'Una riga con la sola zona (C3, B1, A2) apre la sezione E assegna la zona a tutto il blocco',
      'Il passo base @@1:30 funziona anche nel testo libero: su un 150 diventa @2:15',
    ],
  },
  {
    versione: '0.15.0',
    data: '2026-07-31',
    voci: [
      'Secondo modo di scrivere una seduta: "Scrivi o incolla" in un riquadro unico',
      'Analizzatore della notazione: metri, ripartenze, stili, attrezzi, modalità e zona quando è deducibile',
      'Blocchi "4x" e righe di composizione riconosciuti: i sotto-tratti che sommano la distanza sopra non aggiungono metri',
      'Schermata di revisione con semafori: verde letta, gialla da confermare, rossa non capita',
      'Partenze, virate e lavoro a secco entrano nella seduta con zero metri',
      'Confermando, la seduta finisce nell\u2019editor a corsie come tutte le altre',
    ],
  },
  {
    versione: '0.14.1',
    data: '2026-07-31',
    voci: [
      'CORRETTO: scrivendo il recupero l\u2019app poteva restare a schermo vuoto',
      'Il calcolo della ripartenza esce dalla fase di disegno: un errore lì dentro faceva crollare tutta la pagina',
      'Rete di sicurezza generale: al posto dello schermo nero compare il messaggio d\u2019errore e il tasto per ricaricare',
    ],
  },
  {
    versione: '0.14.0',
    data: '2026-07-31',
    voci: [
      'Lavagna sistemata sul telefono: non finisce più sotto la tacca e il contenuto sta al centro',
      'Ripartenza dal passo base: scrivi @@2:00 su un 250 e diventa @5:00, arrotondata ai 5 secondi',
      'La base resta legata alla serie: se cambi la distanza, la partenza si ricalcola',
      'Recupero con i due punti: @1:30. Le vecchie forme con l\u2019apice si convertono da sole',
    ],
  },
  {
    versione: '0.13.0',
    data: '2026-07-30',
    voci: [
      'Tutorial guidato al primo accesso: nove passi che cambiano scheda mentre spiegano',
      'Un passo dedicato a come invitare un altro allenatore con il codice',
      'Flag "Non mostrare più" e ✕ in alto per uscire quando vuoi',
      'Il punto interrogativo accanto a Esci lo riapre in qualsiasi momento',
    ],
  },
  {
    versione: '0.12.1',
    data: '2026-07-30',
    voci: [
      'Il filtro per categoria della Dashboard comanda tutta la scheda: riquadri, zone e andamento settimanale, non solo il calendario',
    ],
  },
  {
    versione: '0.12.0',
    data: '2026-07-30',
    voci: [
      'Filtri per categoria anche nel Benessere',
      'Carico atleti: scelta fra settimana, mese, periodo libero e stagione',
      'Km delle sedute (il volume del programma) separati dai km nuotati dagli atleti',
      'Frequenza e ritardi dentro la tabella degli atleti; tabella Settimane eliminata',
      'Due grafici: volume settimanale per famiglia di zona e km per atleta contro il previsto',
      'Marchio senza scritta: corsie e T di fondo vasca',
    ],
  },
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
