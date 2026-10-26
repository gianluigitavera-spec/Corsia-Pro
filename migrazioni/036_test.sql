-- 036 — la sezione «Test», prima fase: tipi, sessioni, risultati e
-- percentuali di zona della società
--
-- SCRITTA il 26/10/2026, NON ANCORA ESEGUITA. Si esegue a mano dal
-- pannello Supabase, un passo alla volta, prima del rilascio che porta
-- la scheda «Test». Le regole dei calcoli stanno in src/lib/test.js,
-- prove in prova_test.mjs.
--
-- Deciso il 26/10/2026: il test serve a valutare l'allenamento, non a
-- prevedere la gara. Base di metodo: i test della FIN in «Totalmente
-- nuoto» (6x50 ogni 2', 15x100 ogni 1'30", 5x300 con 1') più T-1000 e
-- T-2000 dell'allenatore. I modelli pronti da copiare stanno nel codice
-- (MODELLI_TEST), non qui: «copia» crea una riga di test_tipi.
--
-- Cosa fa, quattro tabelle nuove, ognuna con RLS e policy nel suo passo:
--   1. squadra.test_tipi         i test della società;
--   2. squadra.test_sessioni     una volta in cui il test è stato fatto;
--   3. squadra.test_risultati    una riga per atleta e per sessione;
--   4. squadra.test_percentuali  le percentuali di zona della società.
--
-- RLS come per gare e benessere: legge chi è membro della società
-- (mie_societa), scrive chi può scrivere (puo_scrivere: allenatore e
-- collega; il lettore guarda). Ad anon niente: i privilegi di default
-- dello schema danno arwd solo ad authenticated (verificato il
-- 18/10/2026), e il passo 5 lo controlla.
--
-- Le unità: i tempi in CENTESIMI, numeri interi. Le bracciate sono
-- singole, una per braccio, per 25.
--
-- LATTATO E FREQUENZA CARDIACA hanno le loro colonne in test_risultati,
-- vuote: l'interfaccia non le legge e non le scrive. La forma la decide
-- il consulente, e sono dati sanitari di minorenni: prima di usarle
-- serve il consenso (in coda in CLAUDE.md, «privacy e consenso dei
-- genitori»).
--
-- Nessuna vista: storico e calcoli li fa l'app. Nessun dato esistente
-- viene toccato: non serve fotografia prima e dopo.
--
-- DOPO OGNI PASSO CHE SCRIVE C'È UN CONTROLLO CHE LEGGE: è quello, non
-- il "Success" del pannello, a dire che il passo è entrato (vedi la 032).


-- =====================================================================
-- PASSO 0 — guardare prima di scrivere (sola lettura)
-- =====================================================================

-- PostgreSQL 15 o più: serve per "on delete set null (seduta_id)" al
-- passo 2. Con una versione più vecchia, fermarsi e dirlo.
select version();

-- Le quattro tabelle NON devono esistere: quattro null.
select to_regclass('squadra.test_tipi')        as test_tipi,
       to_regclass('squadra.test_sessioni')    as test_sessioni,
       to_regclass('squadra.test_risultati')   as test_risultati,
       to_regclass('squadra.test_percentuali') as test_percentuali;

-- Le funzioni su cui si appoggiano le policy e i trigger: tre righe.
select proname from pg_proc
 where pronamespace = 'squadra'::regnamespace
   and proname in ('mie_societa', 'puo_scrivere', 'tocca_updated_at')
 order by proname;

-- I vincoli unici a cui si agganciano le chiavi composte: due righe.
select conname from pg_constraint
 where conname in ('atleti_id_societa_id_key', 'sedute_id_societa_id_key')
 order by conname;

-- Le zone a cui si riferiscono le percentuali: A1, A2, B2 (e B1).
select codice, famiglia from squadra.zone where codice in ('A1', 'A2', 'B1', 'B2') order by ordine;


-- =====================================================================
-- PASSO 1 — squadra.test_tipi
-- =====================================================================
-- regola_zone: 'b1' = la velocità del test, per fattore_b1, è B1
-- (T-2000 fattore 1, T-1000 fattore 0,97); 'serie' = le medie delle tre
-- serie sono A2, B1, B2 (15x100); vuota = niente zone (6x50, 5x300).
-- ripartenza_s è «ogni 1'30"», recupero_s è «con 1'»: due cose diverse.
-- parziali_ogni: ogni quanti metri si prende il passaggio (vuoto =
-- nessuno). Un tipo con risultati non si cancella: si archivia (attivo).
create table squadra.test_tipi (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  nome text not null,
  descrizione text,
  vasca smallint,
  distanza integer not null,
  ripetute integer default 1 not null,
  serie integer default 1 not null,
  ripartenza_s integer,
  recupero_s integer,
  parziali_ogni integer,
  misure text[] default array['tempo']::text[] not null,
  regola_zone text,
  fattore_b1 numeric(4,3),
  modello text,
  attivo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint test_tipi_pkey primary key (id),
  constraint test_tipi_id_societa_id_key unique (id, societa_id),
  constraint test_tipi_societa_id_fkey foreign key (societa_id)
    references squadra.societa(id) on delete cascade,
  constraint test_tipi_vasca_check check (vasca is null or vasca in (25, 50)),
  constraint test_tipi_distanza_check check (distanza > 0),
  constraint test_tipi_ripetute_check check (ripetute > 0 and serie > 0 and ripetute % serie = 0),
  constraint test_tipi_tempi_check check ((ripartenza_s is null or ripartenza_s > 0)
                                          and (recupero_s is null or recupero_s >= 0)),
  constraint test_tipi_parziali_check check (parziali_ogni is null
                                             or (parziali_ogni > 0 and distanza % parziali_ogni = 0)),
  constraint test_tipi_misure_check check (cardinality(misure) > 0 and misure <@ array[
    'tempo', 'parziali', 'bracciate', 'respiri', 'lattato', 'frequenza']::text[]),
  constraint test_tipi_regola_check check (regola_zone is null or regola_zone in ('b1', 'serie')),
  constraint test_tipi_fattore_check check (fattore_b1 is null or fattore_b1 between 0.5 and 1.5)
);

-- Lo stesso nome una volta sola per società, maiuscole o no.
create unique index test_tipi_nome_unico on squadra.test_tipi (societa_id, lower(nome));

create trigger trg_test_tipi_updated before update on squadra.test_tipi
  for each row execute function squadra.tocca_updated_at();

alter table squadra.test_tipi enable row level security;

create policy test_tipi_select on squadra.test_tipi as permissive for select to authenticated
  using (societa_id in (select squadra.mie_societa()));

create policy test_tipi_write on squadra.test_tipi as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

-- Controllo del passo 1 (legge): RLS attiva (true) e due policy.
select relname, relrowsecurity from pg_class where oid = 'squadra.test_tipi'::regclass;
select policyname, cmd from pg_policies
 where schemaname = 'squadra' and tablename = 'test_tipi' order by policyname;
-- Le colonne: diciotto.
select count(*) as colonne from information_schema.columns
 where table_schema = 'squadra' and table_name = 'test_tipi';


-- =====================================================================
-- PASSO 2 — squadra.test_sessioni
-- =====================================================================
-- La vasca è obbligatoria: un 1000 in vasca da 25 e uno in vasca da 50
-- non si confrontano. La seduta è facoltativa; se la si cancella, la
-- sessione resta e perde solo il collegamento (set null della sola
-- seduta_id: societa_id non si tocca, è not null). Il tipo con sessioni
-- non si cancella (restrict): si archivia.
create table squadra.test_sessioni (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  tipo_id uuid not null,
  data date default current_date not null,
  vasca smallint not null,
  seduta_id uuid,
  note text,
  registrato_da uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint test_sessioni_pkey primary key (id),
  constraint test_sessioni_id_societa_id_key unique (id, societa_id),
  constraint test_sessioni_societa_id_fkey foreign key (societa_id)
    references squadra.societa(id) on delete cascade,
  constraint test_sessioni_tipo_fkey foreign key (tipo_id, societa_id)
    references squadra.test_tipi(id, societa_id) on delete restrict,
  constraint test_sessioni_seduta_fkey foreign key (seduta_id, societa_id)
    references squadra.sedute(id, societa_id) on delete set null (seduta_id),
  constraint test_sessioni_registrato_da_fkey foreign key (registrato_da)
    references auth.users(id),
  constraint test_sessioni_vasca_check check (vasca in (25, 50))
);

create index test_sessioni_societa_data on squadra.test_sessioni (societa_id, data);
create index test_sessioni_tipo on squadra.test_sessioni (tipo_id);

create trigger trg_test_sessioni_updated before update on squadra.test_sessioni
  for each row execute function squadra.tocca_updated_at();

alter table squadra.test_sessioni enable row level security;

create policy test_sessioni_select on squadra.test_sessioni as permissive for select to authenticated
  using (societa_id in (select squadra.mie_societa()));

create policy test_sessioni_write on squadra.test_sessioni as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

-- Controllo del passo 2 (legge): RLS attiva, due policy, e le chiavi
-- composte con la loro regola di cancellazione (r = restrict, n = set
-- null, c = cascade).
select relname, relrowsecurity from pg_class where oid = 'squadra.test_sessioni'::regclass;
select policyname, cmd from pg_policies
 where schemaname = 'squadra' and tablename = 'test_sessioni' order by policyname;
select conname, confdeltype, pg_get_constraintdef(oid) as definizione
  from pg_constraint
 where conrelid = 'squadra.test_sessioni'::regclass and contype = 'f'
 order by conname;


-- =====================================================================
-- PASSO 3 — squadra.test_risultati
-- =====================================================================
-- ripetute: una lista, un elemento per ripetuta, in ordine:
--   { "t": 8050, "passaggi": [3900, null], "bracciate": 18, "respiri": 6 }
--   t e passaggi in centesimi (i passaggi progressivi, come sul
--   cronometro; quanti, lo dice parziali_ogni del tipo); bracciate
--   singole per 25. Tutto facoltativo tranne l'ordine.
-- gara_100 e gara_400: i tempi di gara dell'atleta, in centesimi,
-- facoltativi. Servono al controllo del 5x300 (ultimo 300 entro 3 s da
-- t400 − t100), che compare solo se ci sono tutti e due.
-- lattato e frequenza: previste, VUOTE. Le aspetta il consulente.
create table squadra.test_risultati (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  sessione_id uuid not null,
  atleta_id uuid not null,
  ripetute jsonb default '[]'::jsonb not null,
  gara_100 integer,
  gara_400 integer,
  lattato jsonb,
  frequenza jsonb,
  note text,
  registrato_da uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint test_risultati_pkey primary key (id),
  constraint test_risultati_sessione_atleta_key unique (sessione_id, atleta_id),
  constraint test_risultati_societa_id_fkey foreign key (societa_id)
    references squadra.societa(id) on delete cascade,
  constraint test_risultati_sessione_fkey foreign key (sessione_id, societa_id)
    references squadra.test_sessioni(id, societa_id) on delete cascade,
  constraint test_risultati_atleta_fkey foreign key (atleta_id, societa_id)
    references squadra.atleti(id, societa_id) on delete cascade,
  constraint test_risultati_registrato_da_fkey foreign key (registrato_da)
    references auth.users(id),
  constraint test_risultati_ripetute_check check (jsonb_typeof(ripetute) = 'array'),
  constraint test_risultati_gara_check check ((gara_100 is null or gara_100 > 0)
                                              and (gara_400 is null or gara_400 > 0))
);

create index test_risultati_atleta on squadra.test_risultati (atleta_id);

create trigger trg_test_risultati_updated before update on squadra.test_risultati
  for each row execute function squadra.tocca_updated_at();

alter table squadra.test_risultati enable row level security;

create policy test_risultati_select on squadra.test_risultati as permissive for select to authenticated
  using (societa_id in (select squadra.mie_societa()));

create policy test_risultati_write on squadra.test_risultati as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

-- Controllo del passo 3 (legge): RLS attiva, due policy, le chiavi
-- composte (sessione e atleta in cascata) e il vincolo unico.
select relname, relrowsecurity from pg_class where oid = 'squadra.test_risultati'::regclass;
select policyname, cmd from pg_policies
 where schemaname = 'squadra' and tablename = 'test_risultati' order by policyname;
select conname, contype, confdeltype, pg_get_constraintdef(oid) as definizione
  from pg_constraint
 where conrelid = 'squadra.test_risultati'::regclass and contype in ('f', 'u')
 order by conname;


-- =====================================================================
-- PASSO 4 — squadra.test_percentuali
-- =====================================================================
-- Le percentuali della VELOCITÀ di B1, per A1, A2 e B2. Nessuna riga =
-- quelle di partenza, che stanno nel codice (PERCENTUALI_DI_PARTENZA:
-- 93, 96, 103): non si inserisce niente. Una zona senza riga resta a
-- quella di partenza.
create table squadra.test_percentuali (
  societa_id uuid not null,
  zona text not null,
  percentuale numeric(5,2) not null,
  updated_at timestamp with time zone default now() not null,
  constraint test_percentuali_pkey primary key (societa_id, zona),
  constraint test_percentuali_societa_id_fkey foreign key (societa_id)
    references squadra.societa(id) on delete cascade,
  constraint test_percentuali_zona_fkey foreign key (zona)
    references squadra.zone(codice),
  constraint test_percentuali_zona_check check (zona in ('A1', 'A2', 'B2')),
  constraint test_percentuali_valore_check check (percentuale between 50 and 150)
);

create trigger trg_test_percentuali_updated before update on squadra.test_percentuali
  for each row execute function squadra.tocca_updated_at();

alter table squadra.test_percentuali enable row level security;

create policy test_percentuali_select on squadra.test_percentuali as permissive for select to authenticated
  using (societa_id in (select squadra.mie_societa()));

create policy test_percentuali_write on squadra.test_percentuali as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

-- Controllo del passo 4 (legge): RLS attiva, due policy, nessuna riga.
select relname, relrowsecurity from pg_class where oid = 'squadra.test_percentuali'::regclass;
select policyname, cmd from pg_policies
 where schemaname = 'squadra' and tablename = 'test_percentuali' order by policyname;
select count(*) as righe from squadra.test_percentuali;


-- =====================================================================
-- PASSO 5 — i controlli di ogni migrazione, più anon (sola lettura)
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

-- anon non tocca le quattro tabelle (tutto false); authenticated sì
-- (tutto true), e a filtrare le righe sono le policy.
select t as tabella,
       has_table_privilege('anon', t, 'select')          as anon_select,
       has_table_privilege('anon', t, 'insert')          as anon_insert,
       has_table_privilege('authenticated', t, 'select') as aut_select,
       has_table_privilege('authenticated', t, 'insert') as aut_insert
  from unnest(array['squadra.test_tipi', 'squadra.test_sessioni',
                    'squadra.test_risultati', 'squadra.test_percentuali']) as t;

-- Poi: rigenerare schema.sql con query_schema.sql e committarlo.
