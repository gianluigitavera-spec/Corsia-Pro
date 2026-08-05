-- 022 — quello che è stato fatto davvero
--
-- La seduta scritta è il programma e non si tocca mai. Questa colonna le
-- affianca gli SCOSTAMENTI: solo le righe andate diversamente, non una
-- seconda copia dell'allenamento.
--
-- Forma: { "righe": { "1-3": 1400 }, "nota": "acqua fredda, chiuso prima" }
-- dove "1-3" è la quarta serie della seconda sezione (si conta da zero).
-- Una seduta andata come previsto ha svolto = null e non occupa niente.
--
-- Il valore è del GRUPPO, non del singolo: se un atleta ha nuotato meno
-- degli altri quello si vede dall'appello, non da qui.

alter table squadra.sedute
  add column if not exists svolto jsonb;

comment on column squadra.sedute.svolto is
  'Scostamenti fra programma e vasca: { righe: { "sezione-serie": metri }, nota: text }. Null = andata come scritta.';


-- Metri davvero nuotati, tenendo conto degli scostamenti.
-- Gemella di metriSvolti() in src/lib/dominio.js: se cambi la regola qui,
-- cambiala anche là, o il database e lo schermo diranno numeri diversi.
create or replace function squadra.metri_svolti(sezioni jsonb, svolto jsonb)
returns int
language sql
immutable
as $$
  select coalesce(sum(
    coalesce(
      (svolto -> 'righe' ->> ((s.n - 1)::text || '-' || (r.m - 1)::text))::int,
      (r.serie ->> 'metri')::int,
      0
    )
  ), 0)::int
  from jsonb_array_elements(coalesce(sezioni, '[]'::jsonb))
       with ordinality as s(sezione, n)
  cross join lateral jsonb_array_elements(coalesce(s.sezione -> 'serie', '[]'::jsonb))
       with ordinality as r(serie, m);
$$;

-- Controllo, seduta per seduta:
-- select data, titolo,
--        squadra.metri_svolti(sezioni, null)   as programmati,
--        squadra.metri_svolti(sezioni, svolto) as fatti
-- from squadra.sedute
-- where svolto is not null
-- order by data desc;
