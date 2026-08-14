-- =====================================================================
-- CorsiaPro — 023  LA FASE GUARDA LA VASCA, NON IL PROGRAMMA
--
-- v_fase_reale si appoggiava a v_carico_zona, che legge solo sedute.sezioni:
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
-- ---------------------------------------------------------------------
-- RISCRITTA il 10/08/2026, dopo l'esecuzione reale su Supabase.
--
-- La prima stesura non girava. Tre assunzioni sbagliate:
--   1. spacchettava sedute.sezioni a mano invece di partire da v_serie,
--      che quel lavoro lo fa già;
--   2. trattava specializzazione come testo — è l'enum
--      squadra.specializzazione, e la differenza di tipo avrebbe rotto
--      v_fase_confronto (018) al passaggio successivo;
--   3. usava coalesce(z.famiglia, 'nonclass') — anche famiglia è un enum
--      (squadra.famiglia_zona: aerobico, vo2, lattacido, alattacido,
--      altro) e 'nonclass' non ne fa parte.
--
-- Questa versione è la copia esatta di v_carico_zona, con una sola
-- differenza: lo scostamento vince sul programma. I tipi coincidono per
-- costruzione, non per fortuna.
-- =====================================================================


-- =====================================================================
-- PARTE A1 — v_serie impara a contare
--
-- Gli scostamenti in sedute.svolto sono indicizzati per posizione, con
-- chiave "sezione-serie" (base zero). v_serie usava jsonb_array_elements
-- senza with ordinality, quindi la posizione la perdeva: non c'era modo
-- di sapere che una riga era la sezione 2, serie 3.
--
-- Due colonne aggiunte in fondo, sez_n e ser_m. Chi legge v_serie oggi
-- non se ne accorge: colonne esistenti, ordine e tipi invariati.
-- =====================================================================
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
     cross join lateral jsonb_array_elements(coalesce(sez.value -> 'serie'::text, '[]'::jsonb)) with ordinality serie(value, m);

grant select on squadra.v_serie to authenticated;

-- Controllo: sez_n e ser_m devono partire da 0, e ser_m ripartire da 0
-- dentro ogni sezione.
--
-- select seduta_id, sezione, sez_n, ser_m, metri
-- from squadra.v_serie order by seduta_id, sez_n, ser_m limit 10;


-- =====================================================================
-- PARTE A2 — il carico per zona sui metri veri
--
-- Identica a v_carico_zona tranne la riga dei metri: se in svolto c'è un
-- valore per quella posizione, quello vince; altrimenti resta il
-- programma. Il volume di una seduta con lo split NON è la somma delle
-- sezioni, e questa regola la eredita da v_serie insieme al resto.
-- =====================================================================
create or replace view squadra.v_carico_zona_reale
with (security_invoker = true) as
select v.seduta_id,
    v.societa_id,
    v.data,
    v.categorie,
    sp.specializzazione,
    v.zona,
    z.famiglia,
    sum(coalesce((sd.svolto -> 'righe' ->> (v.sez_n::text || '-' || v.ser_m::text))::int, v.metri)) as metri
   from squadra.v_serie v
     join squadra.sedute sd on sd.id = v.seduta_id
     cross join ( select unnest(enum_range(null::squadra.specializzazione)) as specializzazione) sp
     left join squadra.zone z on z.codice = v.zona
  where v.destinatari @> '["*"]'::jsonb or v.destinatari @> to_jsonb(sp.specializzazione::text)
  group by v.seduta_id, v.societa_id, v.data, v.categorie, sp.specializzazione, v.zona, z.famiglia;

grant select on squadra.v_carico_zona_reale to authenticated;


-- ---------------------------------------------------------------------
-- CONTROLLO, prima di andare avanti.
--
-- Quante sedute hanno scostamenti registrati:
--
-- select count(*) from squadra.sedute where svolto is not null;
--
-- Dove programmato e reale divergono (nota: "is not distinct from" sulla
-- zona, non "=", perché la zona può essere null e con l'uguale quelle
-- righe sparirebbero dal confronto senza dirlo):
--
-- select n.data, n.zona, v.metri as programmato, n.metri as reale
-- from squadra.v_carico_zona_reale n
-- join squadra.v_carico_zona v
--   on v.seduta_id = n.seduta_id
--  and v.specializzazione = n.specializzazione
--  and v.zona is not distinct from n.zona
-- where n.specializzazione = 'Generale' and v.metri is distinct from n.metri
-- order by n.data desc;
--
-- Se la prima torna 0 la seconda torna vuota, ed è giusto così: non c'è
-- ancora niente da correggere. Se la prima torna un numero e la seconda
-- è vuota, fermarsi: la chiave dentro svolto non ha il formato atteso.
--
-- Esito al 10/08/2026: 5 sedute con scostamenti, 9 righe di differenza
-- fra il 29/09 e il 27/10. Il 20/10 l'A2 scende da 3300 a 1800.
-- ---------------------------------------------------------------------


-- =====================================================================
-- PARTE B — v_fase_reale cambia sorgente
--
-- Stesse colonne, stesso ordine, stessi tipi: v_fase_confronto (018) le
-- sta sopra e non deve accorgersi di niente.
-- =====================================================================
create or replace view squadra.v_fase_reale
with (security_invoker = true) as
select
  p.id           as fase_id,
  p.societa_id,
  p.fase,
  p.dal,
  p.al,
  p.categorie,
  z.specializzazione,
  z.zona,
  z.famiglia,
  sum(z.metri)   as metri
from squadra.periodizzazione p
join squadra.v_carico_zona_reale z
  on z.societa_id = p.societa_id
 and z.data between p.dal and p.al
 and z.categorie && p.categorie
group by p.id, p.societa_id, p.fase, p.dal, p.al, p.categorie,
         z.specializzazione, z.zona, z.famiglia;

grant select on squadra.v_fase_reale to authenticated;

-- Se la PARTE B si lamenta di un cambio di tipo su una colonna, vuol
-- dire che v_fase_confronto ci sta appoggiata sopra: in quel caso serve
-- anche la 018 per rifarle nell'ordine giusto. Non forzare con un drop,
-- che si porterebbe via anche la 018.
