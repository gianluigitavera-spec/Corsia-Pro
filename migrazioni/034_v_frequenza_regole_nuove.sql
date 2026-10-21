-- 034 — v_frequenza conta con le regole del 19/10/2026
--
-- ESEGUITA a mano dal pannello Supabase il 22/10/2026, un passo alla
-- volta, dopo il deploy della 0.58.0, e verificata: 16 colonne con le
-- tre pct_* in coda; confronto con le presenze ricontate vuoto; nessun
-- pct_tot con zero rilevate; fotografia di atleti e ritardi identica
-- prima e dopo (541 · 2 · 5 · 11); nessuna vista senza security_invoker
-- e nessuna tabella senza RLS. Questo file esiste perché la catena resti
-- ripetibile su un ambiente pulito.
--
-- Andava eseguita il giorno del rilascio, insieme alla versione dell'app
-- che la legge: la vista la usava anche l'app già pubblicata (Appello,
-- colonne Sett., Mese, Tot.), e cambiarla prima avrebbe cambiato i
-- numeri a chi aveva ancora la versione vecchia.
--
-- Le regole, le stesse di frequenzaAppello in dominio.js:
--   - percentuale = (P + R) / (P + R + A), solo sulle sedute dove
--     l'atleta è stato segnato;
--   - R è una presenza: in acqua c'era;
--   - G non entra nel conto, né sopra né sotto. Prima stava fra i
--     presenti E nel denominatore: un giustificato valeva come presenza;
--   - denominatore zero: nessuna percentuale (null), non 0%.
--
-- Cosa cambia nelle colonne, che restano tutte e nello stesso ordine e
-- tipo (create or replace view non permette altro):
--   rilevate_*   P + R + A        prima P + R + G + A
--   presenti_*   P + R            prima P + R + G
--   ritardi_*    R                invariato
-- e in CODA tre colonne nuove, pct_sett, pct_mese, pct_tot: la
-- percentuale già calcolata, null quando il denominatore è zero.
--
-- Le FINESTRE non cambiano: _sett sono ancora gli ultimi 7 giorni e
-- _mese gli ultimi 30. Dal rilascio l'Appello non le legge più — Sett. e
-- Mese li calcola l'app sulla settimana da lunedì e sul mese di
-- calendario — e qui si cambia solo il conto, non il periodo. Tot. è
-- l'unica colonna che l'app nuova prende da questa vista.
--
-- Nessuna vista dipende da v_frequenza (schema.sql del 18/10/2026).
--
-- Si esegue UN PASSO ALLA VOLTA, nell'ordine. Il passo 2 è l'unico che
-- scrive, ed è un'istruzione sola: niente begin/commit (vedi la 032).
-- Dopo il passo che scrive c'è un controllo che legge: è quello, non il
-- "Success" del pannello, a dire che il passo è entrato.


-- =====================================================================
-- PASSO 0 — guardare prima di scrivere (sola lettura)
-- =====================================================================
-- La vista dev'essere quella da cui parte il passo 2 (schema.sql del
-- 18/10/2026): stessi conteggi, ultimi 7 e 30 giorni, G fra i presenti.
-- Se è diversa, fermarsi.
select pg_get_viewdef('squadra.v_frequenza', true);

-- Nessuna vista deve dipendere da lei: zero righe.
select distinct dipendente.relname
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class dipendente on dipendente.oid = r.ev_class
 where d.refobjid = 'squadra.v_frequenza'::regclass
   and dipendente.oid <> 'squadra.v_frequenza'::regclass;

-- Quanti atleti cambieranno: quelli con almeno un giustificato. Solo
-- per sapere, prima, quanto si muove.
select count(distinct p.atleta_id) as atleti_con_giustificati,
       count(*) as giustificati
  from squadra.presenze p
  join squadra.atleti a on a.id = p.atleta_id
 where a.attivo and p.stato = 'G';


-- =====================================================================
-- PASSO 1 — fotografia PRIMA (sola lettura)
-- =====================================================================
-- Un'impronta delle colonne che NON devono cambiare: chi c'è e i
-- ritardi. Annotare la riga del risultato: al passo 4 dev'essere
-- identica. (I conti di rilevate e presenti cambiano apposta: per quelli
-- c'è il confronto riga per riga del passo 3.)
--
-- Dal passo 1 al passo 4 nessuno deve segnare presenze: l'impronta
-- fotografa anche quelle. Farlo in un'ora morta, senza pause.
select count(*) as righe,
       sum(ritardi_tot) as ritardi,
       md5(string_agg(concat_ws('|', atleta_id, societa_id, cognome, nome,
                                ritardi_sett, ritardi_mese, ritardi_tot),
                      E'\n' order by atleta_id)) as impronta
  from squadra.v_frequenza;


-- =====================================================================
-- PASSO 2 — la vista con le regole nuove
-- =====================================================================
create or replace view squadra.v_frequenza
with (security_invoker = true) as
 SELECT a.id AS atleta_id,
    a.societa_id,
    a.cognome,
    a.nome,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'A'::text]))) AS rilevate_sett,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text]))) AS presenti_sett,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6) AND p.stato::text = 'R'::text) AS ritardi_sett,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'A'::text]))) AS rilevate_mese,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text]))) AS presenti_mese,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29) AND p.stato::text = 'R'::text) AS ritardi_mese,
    count(p.seduta_id) FILTER (WHERE p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'A'::text])) AS rilevate_tot,
    count(p.seduta_id) FILTER (WHERE p.stato::text = ANY (ARRAY['P'::text, 'R'::text])) AS presenti_tot,
    count(p.seduta_id) FILTER (WHERE p.stato::text = 'R'::text) AS ritardi_tot,
    round(100.0 * count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text])))
          / NULLIF(count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'A'::text]))), 0))::integer AS pct_sett,
    round(100.0 * count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text])))
          / NULLIF(count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'A'::text]))), 0))::integer AS pct_mese,
    round(100.0 * count(p.seduta_id) FILTER (WHERE p.stato::text = ANY (ARRAY['P'::text, 'R'::text]))
          / NULLIF(count(p.seduta_id) FILTER (WHERE p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'A'::text])), 0))::integer AS pct_tot
   FROM squadra.atleti a
     LEFT JOIN squadra.presenze p ON p.atleta_id = a.id
     LEFT JOIN squadra.sedute s ON s.id = p.seduta_id
  WHERE a.attivo
  GROUP BY a.id, a.societa_id, a.cognome, a.nome;


-- =====================================================================
-- PASSO 3 — controlli che leggono
-- =====================================================================
-- Le tre colonne nuove ci sono, in coda (posizioni 14, 15, 16).
select column_name, ordinal_position, data_type
  from information_schema.columns
 where table_schema = 'squadra' and table_name = 'v_frequenza'
   and column_name like 'pct_%'
 order by ordinal_position;

-- Riga per riga: la vista conta come le regole nuove, ricontate qui
-- direttamente dalle presenze. Deve restituire ZERO righe.
with atteso as (
  select a.id as atleta_id,
         count(*) filter (where p.stato in ('P', 'R', 'A')) as rilevate_tot,
         count(*) filter (where p.stato in ('P', 'R'))      as presenti_tot,
         count(*) filter (where p.stato = 'G')              as giustificati
    from squadra.atleti a
    left join squadra.presenze p on p.atleta_id = a.id
   where a.attivo
   group by a.id
)
select v.cognome, v.nome,
       v.rilevate_tot, e.rilevate_tot as atteso_rilevate,
       v.presenti_tot, e.presenti_tot as atteso_presenti,
       v.pct_tot
  from squadra.v_frequenza v
  join atteso e on e.atleta_id = v.atleta_id
 where v.rilevate_tot <> e.rilevate_tot
    or v.presenti_tot <> e.presenti_tot
    or (e.rilevate_tot = 0 and v.pct_tot is not null)
    or (e.rilevate_tot > 0 and v.pct_tot is distinct from round(100.0 * e.presenti_tot / e.rilevate_tot)::integer);

-- Chi ha solo giustificati non ha più una percentuale: queste righe
-- devono avere pct_tot vuoto (null), non 0. Per vederli.
select cognome, nome, rilevate_tot, presenti_tot, pct_tot
  from squadra.v_frequenza
 where rilevate_tot = 0
   and atleta_id in (select atleta_id from squadra.presenze where stato = 'G')
 order by cognome, nome;


-- =====================================================================
-- PASSO 4 — fotografia DOPO (sola lettura)
-- =====================================================================
-- La stessa query del passo 1: righe, ritardi e impronta IDENTICI a
-- quelli annotati. Se cambiano, si è mosso qualcosa che non doveva.
select count(*) as righe,
       sum(ritardi_tot) as ritardi,
       md5(string_agg(concat_ws('|', atleta_id, societa_id, cognome, nome,
                                ritardi_sett, ritardi_mese, ritardi_tot),
                      E'\n' order by atleta_id)) as impronta
  from squadra.v_frequenza;


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
