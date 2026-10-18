-- 031 — v_carico_zona_reale non cade più su un decimale in svolto
--
-- La vista leggeva i metri rilevati con ::integer. Un decimale scritto
-- in "Com'è andata" ("12.5") faceva fallire la conversione, e con lei
-- ogni lettura della vista: la Dashboard della società non si apriva.
-- L'app accetterà solo interi dal prossimo rilascio (la correzione sta
-- sul ramo sviluppo); fino ad allora in produzione un decimale si può
-- ancora scrivere, e questa vista è la sola difesa. E comunque i valori
-- già salvati restano: la vista non deve dipendere dal fatto che
-- arrivino puliti.
--
-- Cambia solo l'espressione dei metri. Si parte dalla definizione reale
-- (schema.sql del 14/10/2026, pg_get_viewdef): stesse colonne, stesso
-- ordine, stessi tipi — sum() di un integer resta bigint — e stesso
-- security_invoker. v_fase_reale, che sta sopra, non se ne accorge.
--
--   numero, anche decimale   → arrotondato all'intero (round di numeric:
--                              12.5 fa 13)
--   qualunque altra cosa     → i metri programmati, come quando la chiave
--                              manca. È quello che fa già dominio.js
--                              (metriSvolti): un valore che non è un
--                              numero non conta come rilevato.
--
-- Eseguita a mano dal pannello Supabase il 18/10/2026 e verificata (vista
-- leggibile, nessuna vista senza security_invoker); questo file esiste
-- perché la catena resti ripetibile su un ambiente pulito.
--
-- Prima di eseguire, confrontare con la definizione di oggi:
--   select pg_get_viewdef('squadra.v_carico_zona_reale', true);
-- Se è diversa da quella qui sotto (a parte l'espressione dei metri),
-- fermarsi: qualcuno l'ha cambiata dopo il 14/10.
--
-- Non tocca squadra.metri_svolti() (022), che ha la stessa conversione
-- ::int ma non la chiama nessuno: né le viste né l'app.

create or replace view squadra.v_carico_zona_reale
with (security_invoker = true) as
 SELECT v.seduta_id,
    v.societa_id,
    v.data,
    v.categorie,
    sp.specializzazione,
    v.zona,
    z.famiglia,
    sum(COALESCE(
      CASE
        WHEN ((sd.svolto -> 'righe'::text) ->> ((v.sez_n::text || '-'::text) || v.ser_m::text))
             ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
        THEN round(((sd.svolto -> 'righe'::text) ->> ((v.sez_n::text || '-'::text) || v.ser_m::text))::numeric)::integer
        ELSE NULL::integer
      END,
      v.metri)) AS metri
   FROM squadra.v_serie v
     JOIN squadra.sedute sd ON sd.id = v.seduta_id
     CROSS JOIN ( SELECT unnest(enum_range(NULL::squadra.specializzazione)) AS specializzazione) sp
     LEFT JOIN squadra.zone z ON z.codice = v.zona
  WHERE v.destinatari @> '["*"]'::jsonb OR v.destinatari @> to_jsonb(sp.specializzazione::text)
  GROUP BY v.seduta_id, v.societa_id, v.data, v.categorie, sp.specializzazione, v.zona, z.famiglia;

-- Controllo 1: la vista si legge tutta, senza errori.
-- select count(*), sum(metri) from squadra.v_carico_zona_reale;

-- Controllo 2: la colonna metri ha ancora il suo tipo (bigint).
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'squadra' and table_name = 'v_carico_zona_reale'
--  order by ordinal_position;

-- Controllo 3: nessuna vista di squadra senza security_invoker (zero righe).
-- select c.relname, c.reloptions
--   from pg_class c
--  where c.relnamespace = 'squadra'::regnamespace
--    and c.relkind = 'v'
--    and not coalesce(c.reloptions @> array['security_invoker=true'], false);
