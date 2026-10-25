-- 035 — la D, il passo gara: una famiglia sua e la sua riga in squadra.zone
--
-- SCRITTA il 24/10/2026. ESEGUITA A MANO il 25/10/2026 dal pannello
-- Supabase, un passo alla volta, dopo il deploy della 0.60.0:
--   - passo 1: passo_gara nell'enum famiglia_zona;
--   - passo 2: la D in squadra.zone con ordine 90, colore 'indigo' (non
--     null: le altre zone hanno tutte un colore) e livello vuoto;
--   - passi 0 e 4: fotografia di v_carico_zona identica prima e dopo,
--     3114 righe, 3073149 m;
--   - passo 5: nessuna vista senza security_invoker, nessuna tabella
--     senza RLS.
-- Il file qui sotto è quello eseguito, col colore 'indigo'.
--
-- Deciso il 23/10/2026: la D è un'andatura di allenamento, il passo di
-- una gara (D200 = al passo dei 200). Nei grafici di carico è una
-- categoria a sé: né aerobico né lattacido. Dal 25/10/2026 è una zona
-- come le altre, senza distanza obbligatoria: la distanza della gara, se
-- c'è, la tiene il testo della riga.
--
-- Cosa fa:
--   1. aggiunge 'passo_gara' all'enum squadra.famiglia_zona;
--   2. INSERISCE la D in squadra.zone, famiglia passo_gara, livello
--      vuoto. Oggi la D in squadra.zone non c'è (verificato il
--      23/10/2026), e nessuna riga ha zona D: non si aggiorna niente.
--
-- Il livello resta vuoto, come ha deciso la 032: la D è una modalità che
-- dipende dalla gara, non un'intensità, e nella scala non ha un posto.
-- Il vincolo (livello, famiglia) → livelli_zona scatta solo con un
-- livello, quindi la riga entra senza toccare livelli_zona.
--
-- I NUMERI NON SI MUOVONO: nessuna riga ha zona D, quindi le viste di
-- carico restano identiche. La fotografia del passo 0, rifatta al passo
-- 4, lo deve dire. Le viste non si ricreano: prendono la famiglia da
-- squadra.zone, e la D comincerà a contare come passo_gara da sola,
-- appena una seduta la userà.
--
-- Da sapere prima di eseguire:
--   - un valore aggiunto a un enum non si toglie facilmente (bisogna
--     ricreare il tipo): è una decisione presa una volta;
--   - il passo 1 va eseguito DA SOLO. Un valore nuovo di un enum non si
--     può usare nella stessa transazione in cui nasce, e il pannello SQL
--     mette in una transazione sola tutto quello che si esegue insieme;
--   - v_volume_seduta ha colonne fisse per le quattro famiglie e conta
--     fra i non classificati solo le righe SENZA famiglia: i metri della
--     D non finiranno in nessuna delle sue colonne. L'app oggi non la
--     legge (nessun riferimento in src/); se un giorno servirà, una
--     colonna m_passo_gara in coda, in una migrazione sua.
--
-- DOPO OGNI PASSO CHE SCRIVE C'È UN CONTROLLO CHE LEGGE: è quello, non
-- il "Success" del pannello, a dire che il passo è entrato (vedi la 032).


-- =====================================================================
-- PASSO 0 — guardare prima di scrivere, e fotografare (sola lettura)
-- =====================================================================

-- I valori dell'enum oggi: aerobico, vo2, lattacido, alattacido, altro.
-- Se c'è già passo_gara, saltare il passo 1.
select unnest(enum_range(null::squadra.famiglia_zona));

-- Le zone oggi, con l'ordine: serve a vedere dove va la D (in fondo) e
-- che forma hanno i colori. La D NON deve esserci.
select codice, nome, famiglia, ordine, colore, livello from squadra.zone order by ordine;

-- Nessuna riga con zona D: zero.
select count(*) as righe_d from squadra.v_serie where zona = 'D';

-- La fotografia: annotare la riga del risultato, al passo 4 dev'essere
-- identica. Fra il passo 0 e il passo 4 nessuno salvi sedute.
select count(*) as righe,
       sum(metri) as metri,
       md5(string_agg(concat_ws('|', seduta_id, specializzazione, zona, famiglia, metri, livello),
                      E'\n' order by seduta_id, specializzazione, zona)) as impronta
  from squadra.v_carico_zona;


-- =====================================================================
-- PASSO 1 — il valore nuovo dell'enum (DA SOLO)
-- =====================================================================
alter type squadra.famiglia_zona add value if not exists 'passo_gara';

-- Controllo del passo 1 (legge): sei valori, passo_gara in fondo.
select unnest(enum_range(null::squadra.famiglia_zona));


-- =====================================================================
-- PASSO 2 — la D in squadra.zone
-- =====================================================================
-- In fondo all'ordine, dieci dopo l'ultima (è venuto 90). Colore
-- 'indigo': le altre zone hanno tutte un colore, e 'indigo' è in TINTE
-- (src/lib/colori.js) con lo stesso #818CF8 della famiglia passo_gara
-- in TINTA_FAMIGLIA. Chi legge la colonna (la Dashboard, con tinta())
-- e chi colora per famiglia danno lo stesso colore.
insert into squadra.zone (codice, nome, famiglia, ordine, colore, livello)
select 'D', 'Passo gara', 'passo_gara', coalesce(max(ordine), 0) + 10, 'indigo', null
  from squadra.zone
on conflict (codice) do nothing;

-- Controllo del passo 2 (legge): una riga, famiglia passo_gara, livello
-- vuoto.
select codice, nome, famiglia, ordine, colore, livello from squadra.zone where codice = 'D';


-- =====================================================================
-- PASSO 3 — chi legge squadra.zone la vede (sola lettura)
-- =====================================================================
-- anon ha SELECT su squadra.zone dalla 030 (l'elenco delle zone serve
-- prima dell'accesso): la D deve esserci anche lì. Qui da utente del
-- pannello si vede comunque; basta che la riga sopra ci sia.
select codice, famiglia from squadra.zone where famiglia = 'passo_gara';


-- =====================================================================
-- PASSO 4 — fotografia DOPO (sola lettura)
-- =====================================================================
-- La stessa query del passo 0: righe, metri e impronta IDENTICI.
select count(*) as righe,
       sum(metri) as metri,
       md5(string_agg(concat_ws('|', seduta_id, specializzazione, zona, famiglia, metri, livello),
                      E'\n' order by seduta_id, specializzazione, zona)) as impronta
  from squadra.v_carico_zona;


-- =====================================================================
-- PASSO 5 — i controlli di ogni migrazione (sola lettura)
-- =====================================================================
-- Nessuna vista senza security_invoker: zero righe.
select c.relname, c.reloptions
  from pg_class c
 where c.relnamespace = 'squadra'::regnamespace
   and c.relkind = 'v'
   and not coalesce(c.reloptions @> array['security_invoker=true'], false);

-- Nessuna tabella senza RLS: zero righe.
select c.relname
  from pg_class c
 where c.relnamespace = 'squadra'::regnamespace
   and c.relkind in ('r', 'p')
   and not c.relrowsecurity;

-- Poi: rigenerare schema.sql con query_schema.sql e committarlo.
