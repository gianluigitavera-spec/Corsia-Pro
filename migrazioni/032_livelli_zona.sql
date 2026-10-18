-- 032 — la scala interna delle zone: livelli_zona
--
-- Oggi le zone sono le sigle FIN scritte nelle sedute (A1 … C3), e la
-- famiglia arriva da squadra.zone. Domani altre squadre useranno altre
-- etichette (Z1–Z5 e simili). Questa migrazione mette sotto le sigle una
-- scala fissa, uguale per tutti: sette livelli, uno per zona FIN.
--
-- SOLO la scala. Non c'è ancora nessuna etichetta per società, e
-- l'analizzatore non cambia: quelle cose arrivano in fase 4, con le scale
-- straniere. Per questo il livello "aerobico alto", che le FIN non hanno,
-- qui non c'è: arriverà con loro.
--
-- L'ordine va di dieci in dieci (10, 20 … 70) per poter infilare un
-- livello fra due esistenti senza rinumerare. La chiave del livello è un
-- codice, non l'ordine: l'ordine cambia, il codice no.
--
-- FUORI SCALA, e restano con livello vuoto in squadra.zone:
--   D        è il passo gara: una modalità che dipende dalla gara, non
--            un'intensità. Non ha un posto nella scala, e non deve
--            averne uno per comodità.
--   PS, BN, TC, regr … la tecnica e le altre sigle: dicono come si nuota,
--            non quanto forte.
-- Livello vuoto vuol dire quello che vuol dire oggi: la riga conta nei
-- metri, e per famiglia vale quanto vale adesso.
--
-- I NUMERI NON SI MUOVONO, e non per fortuna:
--   - le due viste continuano a prendere la famiglia da squadra.zone,
--     come prima; il livello si aggiunge IN CODA, ed è l'unica colonna
--     nuova;
--   - una foreign key composta (livello, famiglia) obbliga ogni zona con
--     un livello ad avere la stessa famiglia del suo livello. Se in
--     squadra.zone una FIN avesse oggi una famiglia diversa da quella
--     scritta qui, il passo 3 si ferma invece di cambiare i conti;
--   - la fotografia del passo 1, rifatta al passo 5, deve dare la stessa
--     impronta, riga per riga.
--
-- Si esegue UN PASSO ALLA VOLTA, nell'ordine. I passi 2 e 3 stanno in
-- una transazione loro: se falliscono, non lasciano niente a metà.
-- I passi 0, 1, 5 e 6 sono di sola lettura. DOPO OGNI PASSO CHE SCRIVE
-- C'È UN CONTROLLO CHE LEGGE: è quello, non il "Success", a dire che il
-- passo è entrato.
--
-- ESEGUITA a mano dal pannello Supabase il 18/10/2026, un passo alla
-- volta, e verificata: impronte prima e dopo identiche (2684 righe;
-- 2637659 m in v_carico_zona, 2568284 m in v_carico_zona_reale),
-- livello presente in squadra.zone e nelle due viste, tutte le viste
-- con security_invoker. Questo file esiste perché la catena resti
-- ripetibile su un ambiente pulito.
--
-- ATTENZIONE, successo davvero: il passo 4 era scritto con le due viste
-- dentro un solo begin/commit, e il pannello SQL ha risposto "Success"
-- SENZA APPLICARE NIENTE. Eseguite una alla volta, senza begin/commit,
-- sono entrate. Per questo il passo 4 qui sotto è diviso in 4a e 4b,
-- senza transazione, ognuno col suo controllo. Un "Success" del pannello
-- non è una verifica.


-- =====================================================================
-- PASSO 0 — guardare prima di scrivere (sola lettura)
-- =====================================================================
-- Le due viste devono essere quelle da cui parte il passo 4. Se una è
-- diversa — a parte gli a capo — fermarsi.
--   v_carico_zona:       come in schema.sql del 14/10/2026
--   v_carico_zona_reale: come l'ha lasciata la 031
select pg_get_viewdef('squadra.v_carico_zona', true);
select pg_get_viewdef('squadra.v_carico_zona_reale', true);

-- Le zone di oggi: le sette FIN devono esserci, con queste famiglie
-- (A1 A2 B1 aerobico, B2 vo2, C1 C2 lattacido, C3 alattacido).
select codice, nome, famiglia, ordine from squadra.zone order by ordine;


-- =====================================================================
-- PASSO 1 — fotografia PRIMA (sola lettura)
-- =====================================================================
-- Un'impronta (md5) di tutte le righe delle due viste, nelle colonne di
-- oggi: se una riga cambia anche di un metro, cambia l'impronta. Accanto,
-- righe e metri, per leggerla a occhio. Annotare le due righe del
-- risultato: al passo 5 devono tornare identiche.
--
-- Dal passo 1 al passo 5 nessuno deve salvare sedute o "Com'è andata":
-- l'impronta fotografa anche quello, e un salvataggio a metà la cambia
-- senza che la migrazione c'entri. Farlo in un'ora morta, senza pause
-- fra un passo e l'altro.
select 'v_carico_zona' as vista,
       count(*) as righe,
       sum(metri) as metri,
       md5(string_agg(concat_ws('|', seduta_id, societa_id, data, categorie::text,
                                specializzazione, coalesce(zona, '∅'),
                                coalesce(famiglia::text, '∅'), metri),
                      E'\n' order by seduta_id, specializzazione, zona nulls first, famiglia nulls first)) as impronta
  from squadra.v_carico_zona
union all
select 'v_carico_zona_reale',
       count(*),
       sum(metri),
       md5(string_agg(concat_ws('|', seduta_id, societa_id, data, categorie::text,
                                specializzazione, coalesce(zona, '∅'),
                                coalesce(famiglia::text, '∅'), metri),
                      E'\n' order by seduta_id, specializzazione, zona nulls first, famiglia nulls first))
  from squadra.v_carico_zona_reale;


-- =====================================================================
-- PASSO 2 — la scala
-- =====================================================================
begin;

create table squadra.livelli_zona (
  codice   text primary key,
  nome     text not null,
  famiglia squadra.famiglia_zona not null,
  ordine   integer not null unique,
  -- serve alla foreign key composta di squadra.zone (passo 3)
  unique (codice, famiglia)
);

comment on table squadra.livelli_zona is
  'Scala interna delle zone, uguale per tutte le società. Le sigle (FIN oggi, altre in fase 4) puntano a un livello; la famiglia la decide il livello. Ordine di dieci in dieci per poter inserire livelli nuovi.';

insert into squadra.livelli_zona (codice, nome, famiglia, ordine) values
  ('ripristino',           'Aerobico lento / ripristino',   'aerobico',   10),
  ('aerobico_medio',       'Aerobico medio',                'aerobico',   20),
  ('soglia',               'Soglia anaerobica',             'aerobico',   30),
  ('vo2max',               'Massimo consumo di ossigeno',   'vo2',        40),
  ('tolleranza_lattacida', 'Tolleranza lattacida',          'lattacido',  50),
  ('potenza_lattacida',    'Potenza lattacida',             'lattacido',  60),
  ('velocita_alattacida',  'Velocità alattacida',           'alattacido', 70);

-- Come squadra.zone: la leggono tutti quelli che hanno fatto l'accesso,
-- non la scrive nessuno dall'app. Niente grant ad anon.
alter table squadra.livelli_zona enable row level security;
create policy livelli_zona_select on squadra.livelli_zona
  as permissive for select to authenticated
  using (true);
revoke all on table squadra.livelli_zona from anon, authenticated;
grant select on table squadra.livelli_zona to authenticated;

commit;

-- Controllo del passo 2 (legge): sette righe, ordine da 10 a 70.
select codice, nome, famiglia, ordine from squadra.livelli_zona order by ordine;


-- =====================================================================
-- PASSO 3 — ogni sigla FIN al suo livello
-- =====================================================================
begin;

alter table squadra.zone add column livello text;

-- Livello e famiglia insieme: una zona con un livello deve avere la
-- famiglia di quel livello. Con livello vuoto (D, tecnica) il vincolo
-- non scatta, e la zona resta com'è.
alter table squadra.zone
  add constraint zone_livello_famiglia_fkey
  foreign key (livello, famiglia) references squadra.livelli_zona (codice, famiglia);

update squadra.zone z
   set livello = m.livello
  from (values
    ('A1', 'ripristino'),
    ('A2', 'aerobico_medio'),
    ('B1', 'soglia'),
    ('B2', 'vo2max'),
    ('C1', 'tolleranza_lattacida'),
    ('C2', 'potenza_lattacida'),
    ('C3', 'velocita_alattacida')
  ) as m(codice, livello)
 where z.codice = m.codice;

-- Devono essere sette. Se sono meno, una FIN manca da squadra.zone (o
-- è scritta diversa): l'errore annulla tutto il passo, colonna e vincolo
-- compresi, e il commit sotto non scrive niente.
do $$
declare quante int;
begin
  select count(*) into quante from squadra.zone where livello is not null;
  if quante <> 7 then
    raise exception 'FIN con livello: % invece di 7 — controllare squadra.zone (passo 0)', quante;
  end if;
end $$;

commit;

-- Controllo del passo 3 (legge): le sette FIN col loro livello, il
-- resto (D, tecnica) vuoto.
select codice, famiglia, livello from squadra.zone order by ordine;


-- =====================================================================
-- PASSO 4 — il livello in coda alle due viste
-- =====================================================================
-- Stesse colonne, stesso ordine, stessi tipi di prima; z.livello in
-- fondo, e nel GROUP BY accanto a z.famiglia. Raggruppare anche per lui
-- non cambia i gruppi: z arriva per chiave primaria (codice = zona), e a
-- una zona corrisponde un livello solo, come una famiglia sola.
--
-- Una vista alla volta, SENZA begin/commit: con le due viste nella
-- stessa transazione il pannello ha detto "Success" e non ha applicato
-- niente. Ogni create or replace è atomico da sé; se la 4b fallisce, la
-- 4a resta applicata ed è innocua (una colonna in più, in coda).

-- PASSO 4a — v_carico_zona
create or replace view squadra.v_carico_zona
with (security_invoker = true) as
 SELECT v.seduta_id,
    v.societa_id,
    v.data,
    v.categorie,
    sp.specializzazione,
    v.zona,
    z.famiglia,
    sum(v.metri) AS metri,
    z.livello
   FROM squadra.v_serie v
     CROSS JOIN ( SELECT unnest(enum_range(NULL::squadra.specializzazione)) AS specializzazione) sp
     LEFT JOIN squadra.zone z ON z.codice = v.zona
  WHERE v.destinatari @> '["*"]'::jsonb OR v.destinatari @> to_jsonb(sp.specializzazione::text)
  GROUP BY v.seduta_id, v.societa_id, v.data, v.categorie, sp.specializzazione, v.zona, z.famiglia, z.livello;

-- Controllo del passo 4a (legge): una riga, livello in fondo (posizione 9).
select column_name, ordinal_position, data_type
  from information_schema.columns
 where table_schema = 'squadra' and table_name = 'v_carico_zona' and column_name = 'livello';

-- PASSO 4b — v_carico_zona_reale
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
      v.metri)) AS metri,
    z.livello
   FROM squadra.v_serie v
     JOIN squadra.sedute sd ON sd.id = v.seduta_id
     CROSS JOIN ( SELECT unnest(enum_range(NULL::squadra.specializzazione)) AS specializzazione) sp
     LEFT JOIN squadra.zone z ON z.codice = v.zona
  WHERE v.destinatari @> '["*"]'::jsonb OR v.destinatari @> to_jsonb(sp.specializzazione::text)
  GROUP BY v.seduta_id, v.societa_id, v.data, v.categorie, sp.specializzazione, v.zona, z.famiglia, z.livello;

-- Controllo del passo 4b (legge): una riga, livello in fondo (posizione 9).
select column_name, ordinal_position, data_type
  from information_schema.columns
 where table_schema = 'squadra' and table_name = 'v_carico_zona_reale' and column_name = 'livello';


-- =====================================================================
-- PASSO 5 — fotografia DOPO (sola lettura)
-- =====================================================================
-- La stessa query del passo 1, sulle stesse colonne (livello escluso).
-- Le due righe devono essere IDENTICHE a quelle annotate: righe, metri
-- e impronta. Se un'impronta è diversa, qualcosa si è mosso: fermarsi.
select 'v_carico_zona' as vista,
       count(*) as righe,
       sum(metri) as metri,
       md5(string_agg(concat_ws('|', seduta_id, societa_id, data, categorie::text,
                                specializzazione, coalesce(zona, '∅'),
                                coalesce(famiglia::text, '∅'), metri),
                      E'\n' order by seduta_id, specializzazione, zona nulls first, famiglia nulls first)) as impronta
  from squadra.v_carico_zona
union all
select 'v_carico_zona_reale',
       count(*),
       sum(metri),
       md5(string_agg(concat_ws('|', seduta_id, societa_id, data, categorie::text,
                                specializzazione, coalesce(zona, '∅'),
                                coalesce(famiglia::text, '∅'), metri),
                      E'\n' order by seduta_id, specializzazione, zona nulls first, famiglia nulls first))
  from squadra.v_carico_zona_reale;

-- E il livello è arrivato: le FIN col loro, tutto il resto vuoto.
select zona, livello, famiglia, count(*) as righe, sum(metri) as metri
  from squadra.v_carico_zona
 group by zona, livello, famiglia
 order by livello nulls last, zona;


-- =====================================================================
-- PASSO 6 — controlli finali (sola lettura)
-- =====================================================================
-- Nessuna vista di squadra senza security_invoker: zero righe.
select c.relname, c.reloptions
  from pg_class c
 where c.relnamespace = 'squadra'::regnamespace
   and c.relkind = 'v'
   and not coalesce(c.reloptions @> array['security_invoker=true'], false);

-- Poi: rigenerare schema.sql con query_schema.sql e committarlo.
