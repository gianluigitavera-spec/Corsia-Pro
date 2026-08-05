-- =====================================================================
-- CorsiaPro — 023  LA FASE GUARDA LA VASCA, NON IL PROGRAMMA
--
-- v_fase_reale si appoggia a v_carico_zona, che legge solo sedute.sezioni:
-- non sa niente della colonna svolto (migrazione 022). Risultato: gli
-- obiettivi di fase venivano confrontati con quello che AVEVI SCRITTO,
-- non con quello che il gruppo ha nuotato. Ed è proprio lì che si vede la
-- differenza: quando salti il finale, quello che cade è la parte tosta.
--
-- Qui si aggiunge una vista nuova che rifà lo stesso conto tenendo conto
-- degli scostamenti, e si ripunta v_fase_reale su quella.
-- v_carico_zona resta dov'è e non si tocca: chi la legge continua a
-- vedere il programma.
--
-- ESEGUIRE IN DUE TEMPI: prima la PARTE A, si controlla con la query in
-- mezzo, poi la PARTE B.
-- =====================================================================


-- =====================================================================
-- PARTE A — il carico per zona sui metri veri
--
-- Gemella di zonePerSpecializzazione() in src/lib/dominio.js. Le regole
-- sono quelle di sempre: una sezione vale per te se è di tutti ("*")
-- oppure se porta la tua specializzazione. Il volume di una seduta con
-- lo split NON è la somma delle sezioni.
-- =====================================================================
create or replace view squadra.v_carico_zona_reale
with (security_invoker = true) as
with righe as (
  select
    sd.societa_id,
    sd.data,
    sd.categorie,
    coalesce(sez.sezione -> 'destinatari', '["*"]'::jsonb) as destinatari,
    coalesce(nullif(ser.serie ->> 'zona', ''), '')         as zona,
    coalesce(
      -- lo scostamento vince sul programma; la chiave è "sezione-serie"
      (sd.svolto -> 'righe' ->> ((sez.n - 1)::text || '-' || (ser.m - 1)::text))::int,
      (ser.serie ->> 'metri')::int,
      0
    ) as metri
  from squadra.sedute sd
  cross join lateral jsonb_array_elements(coalesce(sd.sezioni, '[]'::jsonb))
       with ordinality as sez(sezione, n)
  cross join lateral jsonb_array_elements(coalesce(sez.sezione -> 'serie', '[]'::jsonb))
       with ordinality as ser(serie, m)
)
select
  r.societa_id,
  r.data,
  r.categorie,
  sp.spec                              as specializzazione,
  r.zona,
  coalesce(z.famiglia, 'nonclass')     as famiglia,
  sum(r.metri)::int                    as metri
from righe r
cross join (values ('Generale'), ('Velocità'), ('Mezzofondo'), ('Salvamento')) as sp(spec)
left join squadra.zone z on z.codice = r.zona
where r.metri > 0
  and (r.destinatari @> '["*"]'::jsonb
       or r.destinatari @> to_jsonb(array[sp.spec]))
group by r.societa_id, r.data, r.categorie, sp.spec, r.zona, z.famiglia;

grant select on squadra.v_carico_zona_reale to authenticated;


-- ---------------------------------------------------------------------
-- CONTROLLO, prima di andare avanti.
--
-- 1) Le sedute senza correzioni devono dare gli stessi identici numeri
--    della vista vecchia. Se questa query torna righe, qualcosa non
--    torna e la PARTE B non va eseguita.
-- ---------------------------------------------------------------------
-- select v.data, v.specializzazione, v.zona,
--        v.metri as vecchia, n.metri as nuova
-- from squadra.v_carico_zona v
-- join squadra.v_carico_zona_reale n
--   on n.societa_id = v.societa_id and n.data = v.data
--  and n.specializzazione = v.specializzazione and n.zona = v.zona
-- join squadra.sedute s on s.societa_id = v.societa_id and s.data = v.data
-- where s.svolto is null and v.metri is distinct from n.metri;
--
-- 2) E dove le correzioni ci sono, si deve vedere la differenza:
-- ---------------------------------------------------------------------
-- select n.data, n.zona, v.metri as programmati, n.metri as fatti
-- from squadra.v_carico_zona_reale n
-- join squadra.v_carico_zona v
--   on v.societa_id = n.societa_id and v.data = n.data
--  and v.specializzazione = n.specializzazione and v.zona = n.zona
-- where n.specializzazione = 'Generale' and v.metri is distinct from n.metri
-- order by n.data desc;


-- =====================================================================
-- PARTE B — v_fase_reale cambia sorgente
--
-- Stesse colonne, stesso ordine, stessi tipi: v_fase_confronto (018) le
-- sta sopra e non deve accorgersi di niente.
-- =====================================================================
-- create or replace view squadra.v_fase_reale
-- with (security_invoker = true) as
-- select
--   p.id           as fase_id,
--   p.societa_id,
--   p.fase,
--   p.dal,
--   p.al,
--   p.categorie,
--   z.specializzazione,
--   z.zona,
--   z.famiglia,
--   sum(z.metri)   as metri
-- from squadra.periodizzazione p
-- join squadra.v_carico_zona_reale z
--   on z.societa_id = p.societa_id
--  and z.data between p.dal and p.al
--  and z.categorie && p.categorie
-- group by p.id, p.societa_id, p.fase, p.dal, p.al, p.categorie,
--          z.specializzazione, z.zona, z.famiglia;
--
-- grant select on squadra.v_fase_reale to authenticated;

-- Se la PARTE B si lamenta di un cambio di tipo su una colonna, vuol
-- dire che v_fase_confronto ci sta appoggiata sopra: in quel caso serve
-- anche la 018 per rifarle nell'ordine giusto. Mandamela e la scrivo.
