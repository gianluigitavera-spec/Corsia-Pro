-- 027 — il lavoro a secco esce dai metri, alla fonte
--
-- Palestra, elastici, core: sta nella seduta e occupa tempo, ma non fa
-- metri. Nell'app la sezione porta `aSecco: true` e i conti la saltano;
-- qui la stessa regola entra in v_serie, che è la radice da cui pescano
-- v_carico_zona, v_carico_zona_reale e tutto il resto. Chiudere qui vuol
-- dire non doversi ricordare di filtrare in ogni vista che verrà.
--
-- Perché non basta che i metri siano già a zero:
--   1. v_carico_zona_reale fa vincere il valore scritto in `svolto` sui
--      metri programmati (023, riga della sum). Una riga a secco con un
--      valore battuto per sbaglio in quella posizione diventerebbe metri
--      veri, nuotati mai.
--   2. le righe a secco hanno zona nulla e creerebbero un secchiello a
--      zona NULL in ogni raggruppamento per zona.
--
-- IL FILTRO STA NELLA WHERE, NON DENTRO LA FROM.
-- WITH ORDINALITY numera mentre srotola: se le sezioni a secco fossero
-- tolte prima (filtrando l'array in ingresso), le sezioni successive
-- scalerebbero di posto e sez_n non sarebbe più la posizione vera dentro
-- la seduta. Le chiavi di `svolto` sono "sez_n-ser_m": sfasarle vuol dire
-- attribuire i metri davvero nuotati alla riga sbagliata. Filtrando in
-- WHERE l'ordinalità è già assegnata e le posizioni restano quelle.
--
-- Per il resto la definizione è identica alla 023: stesse colonne, stessi
-- tipi, stesso security_invoker. Cambia una riga sola.

create or replace view squadra.v_serie
with (security_invoker = true) as
select s.id as seduta_id,
    s.societa_id,
    s.data,
    s.categorie,
    s.origine,
    coalesce(sez.value -> 'destinatari'::text, '["*"]'::jsonb) as destinatari,
    sez.value ->> 'titolo'::text as sezione,
    serie.value ->> 'notazione'::text as notazione,
    nullif(serie.value ->> 'zona'::text, ''::text) as zona,
    coalesce((serie.value ->> 'metri'::text)::integer, 0) as metri,
    (sez.n - 1)::int as sez_n,
    (serie.m - 1)::int as ser_m
   from squadra.sedute s
     cross join lateral jsonb_array_elements(s.sezioni) with ordinality sez(value, n)
     cross join lateral jsonb_array_elements(coalesce(sez.value -> 'serie'::text, '[]'::jsonb)) with ordinality serie(value, m)
  where coalesce((sez.value ->> 'aSecco'::text)::boolean, false) = false;

grant select on squadra.v_serie to authenticated;

-- Controllo 1: le posizioni non si sono sfasate. Su una seduta che ha una
-- sezione a secco in mezzo, sez_n deve saltare il numero della sezione
-- tolta (0, 2, 3...) e NON ricompattarsi in 0, 1, 2.
--
-- select seduta_id, sezione, sez_n, ser_m
-- from squadra.v_serie
-- where seduta_id = '<id di una seduta con sezione a secco>'
-- order by sez_n, ser_m;

-- Controllo 2: nessuna riga a secco è rimasta dentro.
--
-- select count(*) from squadra.v_serie v
--   join squadra.sedute s on s.id = v.seduta_id
--   cross join lateral jsonb_array_elements(s.sezioni) with ordinality sez(value, n)
--  where (sez.n - 1) = v.sez_n
--    and coalesce((sez.value ->> 'aSecco')::boolean, false);
-- Deve dare 0.


-- =====================================================================
-- LE SEDUTE GIÀ SALVATE
--
-- Quelle scritte prima di oggi non hanno il campo `aSecco`: una sezione
-- intitolata "Palestra" continua a portare i metri che l'analizzatore le
-- aveva dato (4x12 letto come 4×25 per la regola della vasca). Sono metri
-- fantasma, dentro v_serie e quindi dentro i grafici.
--
-- Questa NON le tocca: le conta soltanto, per decidere dopo se valga la
-- pena sistemarle.
-- =====================================================================

-- Quante sono, e quanti metri fantasma portano.
select s.id as seduta_id,
       s.data,
       sez.value ->> 'titolo' as sezione,
       (sez.n - 1)::int as sez_n,
       coalesce(sum((serie.value ->> 'metri')::int), 0) as metri_fantasma,
       jsonb_array_length(coalesce(sez.value -> 'serie', '[]'::jsonb)) as righe
  from squadra.sedute s
       cross join lateral jsonb_array_elements(s.sezioni) with ordinality sez(value, n)
       left join lateral jsonb_array_elements(coalesce(sez.value -> 'serie', '[]'::jsonb)) serie on true
 where coalesce((sez.value ->> 'aSecco')::boolean, false) = false
   and sez.value ->> 'titolo' ~* '^\s*(lavoro\s+a\s+secco|a\s+secco|secco|palestra|dry\s*-?\s*land|pre\s*-?\s*vasca)\s*:?\s*$'
 group by s.id, s.data, sez.value, sez.n
 order by s.data desc;

-- La stessa regex dell'analizzatore (TITOLO_A_SECCO in
-- src/lib/analizzatore.js). Vive in due posti solo per questo censimento,
-- che si esegue una volta: la regola vera resta il campo `aSecco`.
--
-- Se poi si decide di sistemarle, la correzione è un update che segna
-- `aSecco` e azzera i metri di quelle sezioni. Non è scritto qui apposta:
-- prima si guarda l'elenco.
