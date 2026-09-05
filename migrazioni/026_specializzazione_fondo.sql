-- 026 — "Fondo" fra le specializzazioni
--
-- Il Fondo era finito dentro il Mezzofondo per mancanza di un'etichetta
-- propria, in banca dati e nell'analizzatore. Sono due lavori diversi e
-- vanno letti separati: chi fa fondo prende una parte centrale sua, e
-- sommargliela addosso a quella del mezzofondo dà un carico che sembra
-- giusto e non lo è.
--
-- Eseguita a mano dal pannello Supabase; questo file esiste perché la
-- catena resti ripetibile su un ambiente pulito.
--
-- Il posto nell'enum non è un dettaglio: le viste che ciclano sulle
-- specializzazioni lo fanno con unnest(enum_range(...)) — vedi
-- 023_fase_reale_svolta.sql — quindi l'ordine dell'enum è l'ordine delle
-- righe che escono. Fondo sta dopo Mezzofondo, e SPECIALIZZAZIONI in
-- src/lib/dominio.js ripete lo stesso ordine.
--
-- enum_range si valuta all'esecuzione, non alla creazione della vista:
-- le viste esistenti hanno iniziato a comprendere Fondo da sole, senza
-- essere ricreate. Qui non c'è niente da ricostruire.
--
-- Nota: ALTER TYPE ... ADD VALUE non gira dentro una transazione. Va
-- lanciata da sola, non dentro un blocco begin/commit.

alter type squadra.specializzazione
  add value if not exists 'Fondo' after 'Mezzofondo';

-- Verifica: deve dare Velocità, Mezzofondo, Fondo, Salvamento, Generale.
--   select unnest(enum_range(null::squadra.specializzazione));

-- Gli atleti non si spostano da soli: chi va nel Fondo va riclassificato
-- a mano dalla scheda Atleti. Attenzione, cambiare la specializzazione di
-- un atleta gli sposta anche i volumi già registrati — sezionePer()
-- confronta stringhe esatte, quindi le sezioni storiche intestate
-- 'Mezzofondo' smettono di valere per lui.
