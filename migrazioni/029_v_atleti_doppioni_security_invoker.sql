-- 029 — v_atleti_doppioni torna sotto le RLS
--
-- La vista era nata senza security_invoker: girava coi permessi del suo
-- proprietario, che le RLS non le subisce, e restituiva gli atleti di
-- TUTTE le società a qualunque utente registrato. Nomi, cognomi e anni
-- di nascita di minori, fuori dalla propria squadra.
--
-- Con security_invoker la vista legge con i permessi di chi la
-- interroga, e le policy di squadra.atleti tornano a valere.
--
-- Eseguita a mano dal pannello Supabase il 14/10/2026; questo file
-- esiste perché la catena resti ripetibile su un ambiente pulito.

alter view squadra.v_atleti_doppioni set (security_invoker = true);

-- Controllo: nessuna vista di squadra deve restare scoperta.
-- La query deve restituire zero righe.
-- select c.relname, c.reloptions
--   from pg_class c
--  where c.relnamespace = 'squadra'::regnamespace
--    and c.relkind = 'v'
--    and not coalesce(c.reloptions @> array['security_invoker=true'], false);
