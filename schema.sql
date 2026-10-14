-- schema.sql: struttura dello schema squadra, senza dati.

-- Generato dal pannello SQL di Supabase il 2026-10-14.

set check_function_bodies = false;

create schema if not exists squadra;

-- ===== Enum

create type squadra.famiglia_zona as enum ('aerobico', 'vo2', 'lattacido', 'alattacido', 'altro');
create type squadra.fase_periodo as enum ('generale', 'speciale', 'specifica', 'tapering');
create type squadra.origine_seduta as enum ('manuale', 'swimcoach', 'importata', 'copiata');
create type squadra.ruolo as enum ('coach', 'collega', 'lettore');
create type squadra.sesso as enum ('M', 'F');
create type squadra.specializzazione as enum ('Velocità', 'Mezzofondo', 'Fondo', 'Salvamento', 'Generale');
create type squadra.stato_presenza as enum ('P', 'R', 'A', 'G');
create type squadra.stato_richiesta as enum ('in_attesa', 'approvata', 'rifiutata');
create type squadra.tipo_gara as enum ('trofeo', 'prove_tempi', 'camp_regionali', 'camp_italiani', 'camp_reg_salvamento', 'camp_ita_salvamento');

-- ===== Funzioni

CREATE OR REPLACE FUNCTION squadra.categoria_di(p_anno integer, p_sesso squadra.sesso, p_stagione text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select cs.categoria
  from squadra.categorie_stagione cs
  join squadra.categorie c on c.codice = cs.categoria
  where cs.stagione = p_stagione
    and cs.sesso    = p_sesso
    and p_anno between cs.anno_nascita_da and cs.anno_nascita_a
  order by c.ordine
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION squadra.chiave_atleta(cognome text, nome text, anno integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(
    translate(
      lower(coalesce(cognome, '') || coalesce(nome, '') || coalesce(anno::text, '')),
      'àáâäãèéêëìíîïòóôöõùúûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]', '', 'g'
  );
$function$
;

CREATE OR REPLACE FUNCTION squadra.crea_societa(p_nome text, p_citta text DEFAULT NULL::text)
 RETURNS squadra.societa
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
declare
  v_societa squadra.societa;
begin
  if auth.uid() is null then
    raise exception 'Sessione scaduta: esci e rientra';
  end if;

  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Il nome della squadra è obbligatorio';
  end if;

  -- Un allenatore già dentro una squadra non ne crea un'altra per sbaglio:
  -- è così che nascono i doppioni con lo stesso nome.
  if exists (select 1 from squadra.membri where user_id = auth.uid()) then
    raise exception 'Fai già parte di una squadra. Per entrare in un''altra serve il codice di invito.';
  end if;

  insert into squadra.societa (nome, citta, creata_da)
  values (trim(p_nome), nullif(trim(coalesce(p_citta, '')), ''), auth.uid())
  returning * into v_societa;

  return v_societa;
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.decidi_richiesta(p_richiesta uuid, p_approva boolean, p_ruolo squadra.ruolo DEFAULT 'collega'::squadra.ruolo)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
declare
  v_r      squadra.richieste;
  v_stato  squadra.stato_richiesta;
begin
  select * into v_r from squadra.richieste where id = p_richiesta;
  if not found then
    return jsonb_build_object('esito', 'inesistente');
  end if;

  if not squadra.e_coach(v_r.societa_id) then
    return jsonb_build_object('esito', 'non_autorizzato');
  end if;

  if v_r.stato <> 'in_attesa' then
    return jsonb_build_object('esito', 'gia_decisa', 'stato', v_r.stato);
  end if;

  -- Qui stava il difetto: il valore va tipizzato come enum.
  v_stato := (case when p_approva then 'approvata' else 'rifiutata' end)::squadra.stato_richiesta;

  if p_approva then
    insert into squadra.membri (societa_id, user_id, ruolo)
    values (v_r.societa_id, v_r.user_id, p_ruolo)
    on conflict (societa_id, user_id) do update set ruolo = excluded.ruolo;
  end if;

  update squadra.richieste
     set stato     = v_stato,
         decisa_da = auth.uid(),
         decisa_il = now()
   where id = p_richiesta;

  return jsonb_build_object('esito', v_stato::text);
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.e_coach(p_societa uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
  select exists (
    select 1 from squadra.membri
    where societa_id = p_societa
      and user_id = auth.uid()
      and ruolo = 'coach'
  );
$function$
;

CREATE OR REPLACE FUNCTION squadra.elenco_membri(p_societa uuid)
 RETURNS TABLE(user_id uuid, email text, ruolo squadra.ruolo, dal timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
begin
  if not exists (
    select 1
    from squadra.membri mm
    where mm.societa_id = p_societa
      and mm.user_id = auth.uid()
  ) then
    raise exception 'Non sei membro di questa squadra';
  end if;

  return query
    select m.user_id, u.email::text, m.ruolo, m.created_at
    from squadra.membri m
    join auth.users u on u.id = m.user_id
    where m.societa_id = p_societa
    order by m.ruolo, u.email;
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.genera_codice()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  -- Alfabeto senza caratteri confondibili (niente 0/O, 1/I/L).
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codice text := '';
  i int;
begin
  for i in 1..8 loop
    if i = 5 then
      codice := codice || '-';
    end if;
    codice := codice || substr(alfabeto, 1 + floor(random() * 32)::int, 1);
  end loop;
  return codice;
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.imposta_ruolo(p_societa uuid, p_utente uuid, p_ruolo squadra.ruolo)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
begin
  if not squadra.e_coach(p_societa) then
    raise exception 'Solo il capo allenatore può cambiare i ruoli';
  end if;

  if p_utente = auth.uid() then
    raise exception 'Non puoi cambiare il tuo stesso ruolo';
  end if;

  update squadra.membri set ruolo = p_ruolo
   where societa_id = p_societa and user_id = p_utente;
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.membro_iniziale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
begin
  insert into squadra.membri (societa_id, user_id, ruolo)
  values (new.id, coalesce(new.creata_da, auth.uid()), 'coach')
  on conflict do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.metri_per_specializzazione(p_sezioni jsonb, p_spec text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(sum(coalesce((serie->>'metri')::int, 0)), 0)
  from jsonb_array_elements(coalesce(p_sezioni, '[]'::jsonb)) as sez
  cross join lateral jsonb_array_elements(coalesce(sez->'serie', '[]'::jsonb)) as serie
  where coalesce(sez->'destinatari', '["*"]'::jsonb) @> '["*"]'::jsonb
     or coalesce(sez->'destinatari', '["*"]'::jsonb) @> to_jsonb(p_spec);
$function$
;

CREATE OR REPLACE FUNCTION squadra.metri_svolti(sezioni jsonb, svolto jsonb)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION squadra.mie_societa()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
  select societa_id from squadra.membri where user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION squadra.puo_scrivere(p_societa uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
  select exists (
    select 1 from squadra.membri
    where societa_id = p_societa
      and user_id = auth.uid()
      and ruolo in ('coach', 'collega')
  );
$function$
;

CREATE OR REPLACE FUNCTION squadra.richiedi_accesso(p_codice text, p_messaggio text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
declare
  v_societa squadra.societa%rowtype;
  v_email   text;
begin
  if auth.uid() is null then
    return jsonb_build_object('esito', 'non_autenticato');
  end if;

  select * into v_societa
  from squadra.societa
  where upper(replace(codice_invito, '-', '')) = upper(replace(trim(p_codice), '-', ''));

  if not found then
    return jsonb_build_object('esito', 'codice_sconosciuto');
  end if;

  if exists (select 1 from squadra.membri
             where societa_id = v_societa.id and user_id = auth.uid()) then
    return jsonb_build_object('esito', 'gia_membro', 'societa', v_societa.nome);
  end if;

  if exists (select 1 from squadra.richieste
             where societa_id = v_societa.id and user_id = auth.uid() and stato = 'in_attesa') then
    return jsonb_build_object('esito', 'gia_richiesta', 'societa', v_societa.nome);
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into squadra.richieste (societa_id, user_id, email, messaggio)
  values (v_societa.id, auth.uid(), v_email, nullif(trim(p_messaggio), ''));

  return jsonb_build_object('esito', 'inviata', 'societa', v_societa.nome);
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.rigenera_codice(p_societa uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
declare
  v_nuovo text;
begin
  if not squadra.e_coach(p_societa) then
    raise exception 'Solo il capo allenatore può rigenerare il codice';
  end if;

  loop
    v_nuovo := squadra.genera_codice();
    exit when not exists (select 1 from squadra.societa where codice_invito = v_nuovo);
  end loop;

  update squadra.societa set codice_invito = v_nuovo where id = p_societa;
  return v_nuovo;
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.rimuovi_membro(p_societa uuid, p_utente uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'squadra', 'public'
AS $function$
begin
  if not squadra.e_coach(p_societa) then
    raise exception 'Solo il capo allenatore può rimuovere un allenatore';
  end if;

  if p_utente = auth.uid() then
    raise exception 'Non puoi rimuovere te stesso';
  end if;

  delete from squadra.membri where societa_id = p_societa and user_id = p_utente;
end;
$function$
;

CREATE OR REPLACE FUNCTION squadra.tocca_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

-- ===== Sequenze

-- ===== Tabelle

create table squadra.atleti (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  nome text not null,
  cognome text not null,
  sesso squadra.sesso not null,
  anno_nascita integer not null,
  specializzazione squadra.specializzazione default 'Generale'::squadra.specializzazione not null,
  categoria_override text,
  user_id uuid,
  attivo boolean default true not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  chiave text generated always as (squadra.chiave_atleta(cognome, nome, anno_nascita)) stored
);

create table squadra.benessere (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  atleta_id uuid not null,
  data date default CURRENT_DATE not null,
  sonno smallint,
  fatica smallint,
  dolori smallint,
  umore smallint,
  note text,
  registrato_da uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null
);

create table squadra.categorie (
  codice text not null,
  nome text not null,
  ordine integer not null,
  colore text not null
);

create table squadra.categorie_stagione (
  stagione text not null,
  categoria text not null,
  sesso squadra.sesso not null,
  anno_nascita_da integer not null,
  anno_nascita_a integer not null
);

create table squadra.esercizi (
  id uuid default gen_random_uuid() not null,
  societa_id uuid,
  codice text not null,
  nome text not null,
  descrizione text,
  stile text,
  attrezzi text[] default '{}'::text[] not null,
  video_url text,
  link_ok boolean,
  link_visto_il timestamp with time zone,
  attivo boolean default true not null,
  creato_da uuid default auth.uid(),
  created_at timestamp with time zone default now() not null
);

create table squadra.esercizi_settimana (
  societa_id uuid not null,
  settimana date not null,
  esercizio_id uuid not null,
  ordine integer default 0 not null,
  note text,
  aggiunto_da uuid default auth.uid()
);

create table squadra.gare (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  data date not null,
  data_fine date,
  nome text not null,
  tipo squadra.tipo_gara not null,
  luogo text,
  vasca text,
  note text,
  creata_da uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  categorie text[] default '{}'::text[] not null
);

create table squadra.impostazioni_stagione (
  societa_id uuid not null,
  stagione text not null,
  inizio date not null,
  fine date,
  note text,
  updated_at timestamp with time zone default now() not null
);

create table squadra.membri (
  societa_id uuid not null,
  user_id uuid not null,
  ruolo squadra.ruolo default 'collega'::squadra.ruolo not null,
  created_at timestamp with time zone default now() not null
);

create table squadra.obiettivi_fase (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  categorie text[] default '{}'::text[] not null,
  fase squadra.fase_periodo not null,
  ripartizione jsonb default '{}'::jsonb not null,
  km_settimana numeric(6,1),
  note text,
  aggiornato_da uuid default auth.uid(),
  updated_at timestamp with time zone default now() not null
);

create table squadra.periodizzazione (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  categorie text[] default '{}'::text[] not null,
  fase squadra.fase_periodo not null,
  dal date not null,
  al date not null,
  gara_id uuid,
  note text,
  creata_da uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null
);

create table squadra.presenze (
  seduta_id uuid not null,
  atleta_id uuid not null,
  societa_id uuid not null,
  stato squadra.stato_presenza not null,
  note text,
  registrata_da uuid default auth.uid() not null,
  registrata_il timestamp with time zone default now() not null
);

create table squadra.richieste (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  user_id uuid not null,
  email text,
  messaggio text,
  stato squadra.stato_richiesta default 'in_attesa'::squadra.stato_richiesta not null,
  decisa_da uuid,
  decisa_il timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table squadra.sedute (
  id uuid default gen_random_uuid() not null,
  societa_id uuid not null,
  data date not null,
  origine squadra.origine_seduta default 'manuale'::squadra.origine_seduta not null,
  riferimento_esterno text,
  titolo text,
  fase text,
  mesociclo text,
  microciclo integer,
  sezioni jsonb default '[]'::jsonb not null,
  note text,
  creata_da uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  categorie text[] default '{}'::text[] not null,
  svolto jsonb,
  atleti uuid[]
);

create table squadra.societa (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  citta text,
  creata_da uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  codice_invito text default squadra.genera_codice(),
  indirizzo text,
  cap text,
  provincia text,
  piva text,
  codice_fiscale text,
  codice_fin text,
  email text,
  telefono text,
  sito text,
  note text
);

create table squadra.zone (
  codice text not null,
  nome text not null,
  famiglia squadra.famiglia_zona not null,
  ordine integer not null,
  colore text
);

-- ===== Vincoli

alter table squadra.atleti add constraint atleti_pkey PRIMARY KEY (id);
alter table squadra.benessere add constraint benessere_pkey PRIMARY KEY (id);
alter table squadra.categorie add constraint categorie_pkey PRIMARY KEY (codice);
alter table squadra.categorie_stagione add constraint categorie_stagione_pkey PRIMARY KEY (stagione, categoria, sesso);
alter table squadra.esercizi add constraint esercizi_pkey PRIMARY KEY (id);
alter table squadra.esercizi_settimana add constraint esercizi_settimana_pkey PRIMARY KEY (societa_id, settimana, esercizio_id);
alter table squadra.gare add constraint gare_pkey PRIMARY KEY (id);
alter table squadra.impostazioni_stagione add constraint impostazioni_stagione_pkey PRIMARY KEY (societa_id, stagione);
alter table squadra.membri add constraint membri_pkey PRIMARY KEY (societa_id, user_id);
alter table squadra.obiettivi_fase add constraint obiettivi_fase_pkey PRIMARY KEY (id);
alter table squadra.periodizzazione add constraint periodizzazione_pkey PRIMARY KEY (id);
alter table squadra.presenze add constraint presenze_pkey PRIMARY KEY (seduta_id, atleta_id);
alter table squadra.richieste add constraint richieste_pkey PRIMARY KEY (id);
alter table squadra.sedute add constraint sedute_pkey PRIMARY KEY (id);
alter table squadra.societa add constraint societa_pkey PRIMARY KEY (id);
alter table squadra.zone add constraint zone_pkey PRIMARY KEY (codice);
alter table squadra.atleti add constraint atleti_id_societa_id_key UNIQUE (id, societa_id);
alter table squadra.benessere add constraint benessere_atleta_id_data_key UNIQUE (atleta_id, data);
alter table squadra.obiettivi_fase add constraint obiettivi_fase_societa_id_categorie_fase_key UNIQUE (societa_id, categorie, fase);
alter table squadra.sedute add constraint sedute_id_societa_id_key UNIQUE (id, societa_id);
alter table squadra.atleti add constraint atleti_anno_nascita_check CHECK (((anno_nascita >= 1920) AND (anno_nascita <= 2100)));
alter table squadra.benessere add constraint benessere_dolori_check CHECK (((dolori >= 1) AND (dolori <= 5)));
alter table squadra.benessere add constraint benessere_fatica_check CHECK (((fatica >= 1) AND (fatica <= 5)));
alter table squadra.benessere add constraint benessere_sonno_check CHECK (((sonno >= 1) AND (sonno <= 5)));
alter table squadra.benessere add constraint benessere_umore_check CHECK (((umore >= 1) AND (umore <= 5)));
alter table squadra.categorie_stagione add constraint categorie_stagione_check CHECK ((anno_nascita_da <= anno_nascita_a));
alter table squadra.gare add constraint gare_check CHECK (((data_fine IS NULL) OR (data_fine >= data)));
alter table squadra.impostazioni_stagione add constraint impostazioni_stagione_check CHECK (((fine IS NULL) OR (fine > inizio)));
alter table squadra.periodizzazione add constraint periodizzazione_categorie_check CHECK ((cardinality(categorie) > 0));
alter table squadra.periodizzazione add constraint periodizzazione_check CHECK ((al >= dal));
alter table squadra.sedute add constraint sedute_categorie_presenti CHECK ((cardinality(categorie) > 0)) NOT VALID;
alter table squadra.sedute add constraint sedute_sezioni_check CHECK ((jsonb_typeof(sezioni) = 'array'::text));
alter table squadra.atleti add constraint atleti_categoria_override_fkey FOREIGN KEY (categoria_override) REFERENCES squadra.categorie(codice);
alter table squadra.atleti add constraint atleti_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.atleti add constraint atleti_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table squadra.benessere add constraint benessere_atleta_id_societa_id_fkey FOREIGN KEY (atleta_id, societa_id) REFERENCES squadra.atleti(id, societa_id) ON DELETE CASCADE;
alter table squadra.benessere add constraint benessere_registrato_da_fkey FOREIGN KEY (registrato_da) REFERENCES auth.users(id);
alter table squadra.benessere add constraint benessere_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.categorie_stagione add constraint categorie_stagione_categoria_fkey FOREIGN KEY (categoria) REFERENCES squadra.categorie(codice) ON DELETE CASCADE;
alter table squadra.esercizi add constraint esercizi_creato_da_fkey FOREIGN KEY (creato_da) REFERENCES auth.users(id);
alter table squadra.esercizi add constraint esercizi_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.esercizi_settimana add constraint esercizi_settimana_aggiunto_da_fkey FOREIGN KEY (aggiunto_da) REFERENCES auth.users(id);
alter table squadra.esercizi_settimana add constraint esercizi_settimana_esercizio_id_fkey FOREIGN KEY (esercizio_id) REFERENCES squadra.esercizi(id) ON DELETE CASCADE;
alter table squadra.esercizi_settimana add constraint esercizi_settimana_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.gare add constraint gare_creata_da_fkey FOREIGN KEY (creata_da) REFERENCES auth.users(id);
alter table squadra.gare add constraint gare_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.impostazioni_stagione add constraint impostazioni_stagione_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.membri add constraint membri_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.membri add constraint membri_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table squadra.obiettivi_fase add constraint obiettivi_fase_aggiornato_da_fkey FOREIGN KEY (aggiornato_da) REFERENCES auth.users(id);
alter table squadra.obiettivi_fase add constraint obiettivi_fase_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.periodizzazione add constraint periodizzazione_creata_da_fkey FOREIGN KEY (creata_da) REFERENCES auth.users(id);
alter table squadra.periodizzazione add constraint periodizzazione_gara_id_fkey FOREIGN KEY (gara_id) REFERENCES squadra.gare(id) ON DELETE SET NULL;
alter table squadra.periodizzazione add constraint periodizzazione_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.presenze add constraint presenze_atleta_id_societa_id_fkey FOREIGN KEY (atleta_id, societa_id) REFERENCES squadra.atleti(id, societa_id) ON DELETE CASCADE;
alter table squadra.presenze add constraint presenze_registrata_da_fkey FOREIGN KEY (registrata_da) REFERENCES auth.users(id);
alter table squadra.presenze add constraint presenze_seduta_id_societa_id_fkey FOREIGN KEY (seduta_id, societa_id) REFERENCES squadra.sedute(id, societa_id) ON DELETE CASCADE;
alter table squadra.presenze add constraint presenze_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.richieste add constraint richieste_decisa_da_fkey FOREIGN KEY (decisa_da) REFERENCES auth.users(id);
alter table squadra.richieste add constraint richieste_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.richieste add constraint richieste_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table squadra.sedute add constraint sedute_creata_da_fkey FOREIGN KEY (creata_da) REFERENCES auth.users(id);
alter table squadra.sedute add constraint sedute_societa_id_fkey FOREIGN KEY (societa_id) REFERENCES squadra.societa(id) ON DELETE CASCADE;
alter table squadra.societa add constraint societa_creata_da_fkey FOREIGN KEY (creata_da) REFERENCES auth.users(id);

-- ===== Indici

CREATE UNIQUE INDEX atleti_chiave_unica ON squadra.atleti USING btree (societa_id, chiave);
CREATE INDEX idx_atleti_societa ON squadra.atleti USING btree (societa_id);
CREATE INDEX idx_benessere_societa_data ON squadra.benessere USING btree (societa_id, data DESC);
CREATE INDEX idx_es_settimana ON squadra.esercizi_settimana USING btree (societa_id, settimana);
CREATE UNIQUE INDEX idx_esercizi_codice ON squadra.esercizi USING btree (COALESCE(societa_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(codice));
CREATE INDEX idx_esercizi_societa ON squadra.esercizi USING btree (societa_id);
CREATE INDEX idx_gare_categorie ON squadra.gare USING gin (categorie);
CREATE INDEX idx_gare_societa_data ON squadra.gare USING btree (societa_id, data);
CREATE INDEX idx_membri_user ON squadra.membri USING btree (user_id);
CREATE INDEX idx_obiettivi_cat ON squadra.obiettivi_fase USING gin (categorie);
CREATE INDEX idx_obiettivi_societa ON squadra.obiettivi_fase USING btree (societa_id);
CREATE INDEX idx_periodizzazione_cat ON squadra.periodizzazione USING gin (categorie);
CREATE INDEX idx_periodizzazione_societa ON squadra.periodizzazione USING btree (societa_id, dal);
CREATE INDEX idx_presenze_atleta ON squadra.presenze USING btree (atleta_id);
CREATE UNIQUE INDEX idx_richiesta_aperta ON squadra.richieste USING btree (societa_id, user_id) WHERE (stato = 'in_attesa'::squadra.stato_richiesta);
CREATE INDEX idx_richieste_societa ON squadra.richieste USING btree (societa_id, stato);
CREATE INDEX idx_sedute_categorie ON squadra.sedute USING gin (categorie);
CREATE INDEX idx_sedute_sezioni ON squadra.sedute USING gin (sezioni);
CREATE INDEX idx_sedute_societa_data ON squadra.sedute USING btree (societa_id, data DESC);
CREATE UNIQUE INDEX idx_societa_codice ON squadra.societa USING btree (codice_invito);

-- ===== Viste (in ordine di dipendenza)

create or replace view squadra.v_atleti_doppioni as
 SELECT societa_id,
    chiave,
    count(*) AS quanti,
    array_agg((((cognome || ' '::text) || nome) || ' '::text) || anno_nascita ORDER BY attivo DESC, id) AS nomi,
    array_agg(id ORDER BY attivo DESC, id) AS ids
   FROM squadra.atleti
  GROUP BY societa_id, chiave
 HAVING count(*) > 1;

create or replace view squadra.v_benessere as
 SELECT b.id,
    b.societa_id,
    b.atleta_id,
    b.data,
    a.nome,
    a.cognome,
    a.specializzazione,
    b.sonno,
    b.fatica,
    b.dolori,
    b.umore,
    b.note,
    round((COALESCE(b.sonno::integer, 3) + (6 - COALESCE(b.fatica::integer, 3)) + (6 - COALESCE(b.dolori::integer, 3)) + COALESCE(b.umore::integer, 3))::numeric / 4::numeric, 2) AS prontezza
   FROM squadra.benessere b
     JOIN squadra.atleti a ON a.id = b.atleta_id;

create or replace view squadra.v_carico_atleta as
 SELECT a.id AS atleta_id,
    a.societa_id,
    a.nome,
    a.cognome,
    a.specializzazione,
    s.id AS seduta_id,
    s.data,
    s.categorie,
    p.stato,
    squadra.metri_per_specializzazione(s.sezioni, a.specializzazione::text) AS metri_previsti,
        CASE
            WHEN p.stato::text = ANY (ARRAY['P'::text, 'R'::text]) THEN squadra.metri_per_specializzazione(s.sezioni, a.specializzazione::text)
            ELSE 0
        END AS metri_nuotati
   FROM squadra.presenze p
     JOIN squadra.atleti a ON a.id = p.atleta_id
     JOIN squadra.sedute s ON s.id = p.seduta_id;

create or replace view squadra.v_frequenza as
 SELECT a.id AS atleta_id,
    a.societa_id,
    a.cognome,
    a.nome,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6)) AS rilevate_sett,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'G'::text]))) AS presenti_sett,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 6) AND p.stato::text = 'R'::text) AS ritardi_sett,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29)) AS rilevate_mese,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29) AND (p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'G'::text]))) AS presenti_mese,
    count(p.seduta_id) FILTER (WHERE s.data >= (CURRENT_DATE - 29) AND p.stato::text = 'R'::text) AS ritardi_mese,
    count(p.seduta_id) AS rilevate_tot,
    count(p.seduta_id) FILTER (WHERE p.stato::text = ANY (ARRAY['P'::text, 'R'::text, 'G'::text])) AS presenti_tot,
    count(p.seduta_id) FILTER (WHERE p.stato::text = 'R'::text) AS ritardi_tot
   FROM squadra.atleti a
     LEFT JOIN squadra.presenze p ON p.atleta_id = a.id
     LEFT JOIN squadra.sedute s ON s.id = p.seduta_id
  WHERE a.attivo
  GROUP BY a.id, a.societa_id, a.cognome, a.nome;

create or replace view squadra.v_serie as
 SELECT s.id AS seduta_id,
    s.societa_id,
    s.data,
    s.categorie,
    s.origine,
    COALESCE(sez.value -> 'destinatari'::text, '["*"]'::jsonb) AS destinatari,
    sez.value ->> 'titolo'::text AS sezione,
    serie.value ->> 'notazione'::text AS notazione,
    NULLIF(serie.value ->> 'zona'::text, ''::text) AS zona,
    COALESCE((serie.value ->> 'metri'::text)::integer, 0) AS metri,
    (sez.n - 1)::integer AS sez_n,
    (serie.m - 1)::integer AS ser_m
   FROM squadra.sedute s
     CROSS JOIN LATERAL jsonb_array_elements(s.sezioni) WITH ORDINALITY sez(value, n)
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sez.value -> 'serie'::text, '[]'::jsonb)) WITH ORDINALITY serie(value, m)
  WHERE COALESCE((sez.value ->> 'aSecco'::text)::boolean, false) = false;

create or replace view squadra.v_stagioni as
 SELECT DISTINCT stagione
   FROM squadra.categorie_stagione
  ORDER BY stagione DESC;

create or replace view squadra.v_benessere_tendenza as
 SELECT societa_id,
    atleta_id,
    nome,
    cognome,
    count(*) AS rilevazioni,
    round(avg(prontezza), 2) AS prontezza_media,
    min(data) AS dal,
    max(data) AS al
   FROM squadra.v_benessere
  WHERE data >= (CURRENT_DATE - 7)
  GROUP BY societa_id, atleta_id, nome, cognome;

create or replace view squadra.v_carico_zona as
 SELECT v.seduta_id,
    v.societa_id,
    v.data,
    v.categorie,
    sp.specializzazione,
    v.zona,
    z.famiglia,
    sum(v.metri) AS metri
   FROM squadra.v_serie v
     CROSS JOIN ( SELECT unnest(enum_range(NULL::squadra.specializzazione)) AS specializzazione) sp
     LEFT JOIN squadra.zone z ON z.codice = v.zona
  WHERE v.destinatari @> '["*"]'::jsonb OR v.destinatari @> to_jsonb(sp.specializzazione::text)
  GROUP BY v.seduta_id, v.societa_id, v.data, v.categorie, sp.specializzazione, v.zona, z.famiglia;

create or replace view squadra.v_carico_zona_reale as
 SELECT v.seduta_id,
    v.societa_id,
    v.data,
    v.categorie,
    sp.specializzazione,
    v.zona,
    z.famiglia,
    sum(COALESCE(((sd.svolto -> 'righe'::text) ->> ((v.sez_n::text || '-'::text) || v.ser_m::text))::integer, v.metri)) AS metri
   FROM squadra.v_serie v
     JOIN squadra.sedute sd ON sd.id = v.seduta_id
     CROSS JOIN ( SELECT unnest(enum_range(NULL::squadra.specializzazione)) AS specializzazione) sp
     LEFT JOIN squadra.zone z ON z.codice = v.zona
  WHERE v.destinatari @> '["*"]'::jsonb OR v.destinatari @> to_jsonb(sp.specializzazione::text)
  GROUP BY v.seduta_id, v.societa_id, v.data, v.categorie, sp.specializzazione, v.zona, z.famiglia;

create or replace view squadra.v_settimana_atleta as
 SELECT atleta_id,
    societa_id,
    nome,
    cognome,
    date_trunc('week'::text, data::timestamp with time zone)::date AS settimana,
    count(*) AS sedute_programmate,
    count(*) FILTER (WHERE stato::text = 'P'::text) AS sedute_presenti,
    count(*) FILTER (WHERE stato::text = 'R'::text) AS sedute_ritardo,
    count(*) FILTER (WHERE stato::text = 'G'::text) AS sedute_giustificate,
    count(*) FILTER (WHERE stato::text = 'A'::text) AS sedute_assenti,
    round(100.0 * count(*) FILTER (WHERE stato::text = ANY (ARRAY['P'::text, 'R'::text, 'G'::text]))::numeric / NULLIF(count(*), 0)::numeric, 1) AS frequenza_pct,
    sum(metri_nuotati) AS metri_nuotati
   FROM squadra.v_carico_atleta
  GROUP BY atleta_id, societa_id, nome, cognome, (date_trunc('week'::text, data::timestamp with time zone));

create or replace view squadra.v_fase_reale as
 SELECT p.id AS fase_id,
    p.societa_id,
    p.fase,
    p.dal,
    p.al,
    p.categorie,
    z.specializzazione,
    z.zona,
    z.famiglia,
    sum(z.metri) AS metri
   FROM squadra.periodizzazione p
     JOIN squadra.v_carico_zona_reale z ON z.societa_id = p.societa_id AND z.data >= p.dal AND z.data <= p.al AND z.categorie && p.categorie
  GROUP BY p.id, p.societa_id, p.fase, p.dal, p.al, p.categorie, z.specializzazione, z.zona, z.famiglia;

create or replace view squadra.v_volume_seduta as
 SELECT seduta_id,
    societa_id,
    data,
    categorie,
    specializzazione,
    sum(metri) AS metri_totali,
    sum(metri) FILTER (WHERE famiglia = 'aerobico'::squadra.famiglia_zona) AS m_aerobico,
    sum(metri) FILTER (WHERE famiglia = 'vo2'::squadra.famiglia_zona) AS m_vo2,
    sum(metri) FILTER (WHERE famiglia = 'lattacido'::squadra.famiglia_zona) AS m_lattacido,
    sum(metri) FILTER (WHERE famiglia = 'alattacido'::squadra.famiglia_zona) AS m_alattacido,
    sum(metri) FILTER (WHERE famiglia IS NULL) AS m_non_classificati
   FROM squadra.v_carico_zona
  GROUP BY seduta_id, societa_id, data, categorie, specializzazione;

create or replace view squadra.v_fase_confronto as
 SELECT p.id AS fase_id,
    p.societa_id,
    p.fase,
    p.dal,
    p.al,
    p.categorie,
    f.specializzazione,
    COALESCE(f.famiglia, 'altro'::squadra.famiglia_zona) AS famiglia,
    sum(COALESCE(f.metri, 0::numeric)) AS metri,
    o.ripartizione,
    o.km_settimana
   FROM squadra.periodizzazione p
     LEFT JOIN squadra.v_fase_reale f ON f.fase_id = p.id
     LEFT JOIN squadra.obiettivi_fase o ON o.societa_id = p.societa_id AND o.fase = p.fase AND o.categorie = p.categorie
  GROUP BY p.id, p.societa_id, p.fase, p.dal, p.al, p.categorie, f.specializzazione, f.famiglia, o.ripartizione, o.km_settimana;

-- ===== Trigger

CREATE TRIGGER trg_atleti_updated BEFORE UPDATE ON squadra.atleti FOR EACH ROW EXECUTE FUNCTION squadra.tocca_updated_at();
CREATE TRIGGER trg_sedute_updated BEFORE UPDATE ON squadra.sedute FOR EACH ROW EXECUTE FUNCTION squadra.tocca_updated_at();
CREATE TRIGGER trg_societa_membro_iniziale AFTER INSERT ON squadra.societa FOR EACH ROW EXECUTE FUNCTION squadra.membro_iniziale();
CREATE TRIGGER trg_societa_updated BEFORE UPDATE ON squadra.societa FOR EACH ROW EXECUTE FUNCTION squadra.tocca_updated_at();

-- ===== RLS

alter table squadra.atleti enable row level security;
alter table squadra.benessere enable row level security;
alter table squadra.categorie enable row level security;
alter table squadra.categorie_stagione enable row level security;
alter table squadra.esercizi enable row level security;
alter table squadra.esercizi_settimana enable row level security;
alter table squadra.gare enable row level security;
alter table squadra.impostazioni_stagione enable row level security;
alter table squadra.membri enable row level security;
alter table squadra.obiettivi_fase enable row level security;
alter table squadra.periodizzazione enable row level security;
alter table squadra.presenze enable row level security;
alter table squadra.richieste enable row level security;
alter table squadra.sedute enable row level security;
alter table squadra.societa enable row level security;
alter table squadra.zone enable row level security;

-- ===== Policy

create policy atleti_select on squadra.atleti as permissive for select to authenticated
  using (((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)) OR (user_id = auth.uid())));

create policy atleti_write on squadra.atleti as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy benessere_select on squadra.benessere as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy benessere_write on squadra.benessere as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy categorie_select on squadra.categorie as permissive for select to authenticated
  using (true);

create policy categorie_stagione_select on squadra.categorie_stagione as permissive for select to authenticated
  using (true);

create policy esercizi_select on squadra.esercizi as permissive for select to authenticated
  using (((societa_id IS NULL) OR (societa_id IN ( SELECT squadra.mie_societa() AS mie_societa))));

create policy esercizi_write on squadra.esercizi as permissive for all to authenticated
  using (((societa_id IS NOT NULL) AND squadra.puo_scrivere(societa_id)))
  with check (((societa_id IS NOT NULL) AND squadra.puo_scrivere(societa_id)));

create policy es_settimana_select on squadra.esercizi_settimana as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy es_settimana_write on squadra.esercizi_settimana as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy gare_select on squadra.gare as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy gare_write on squadra.gare as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy impostazioni_stagione_select on squadra.impostazioni_stagione as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy impostazioni_stagione_write on squadra.impostazioni_stagione as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy membri_select on squadra.membri as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy membri_write on squadra.membri as permissive for all to authenticated
  using (squadra.e_coach(societa_id))
  with check (squadra.e_coach(societa_id));

create policy obiettivi_select on squadra.obiettivi_fase as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy obiettivi_write on squadra.obiettivi_fase as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy periodizzazione_select on squadra.periodizzazione as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy periodizzazione_write on squadra.periodizzazione as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy presenze_select on squadra.presenze as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy presenze_write on squadra.presenze as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy richieste_select on squadra.richieste as permissive for select to authenticated
  using (((user_id = auth.uid()) OR squadra.e_coach(societa_id)));

create policy sedute_select on squadra.sedute as permissive for select to authenticated
  using ((societa_id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy sedute_write on squadra.sedute as permissive for all to authenticated
  using (squadra.puo_scrivere(societa_id))
  with check (squadra.puo_scrivere(societa_id));

create policy societa_delete on squadra.societa as permissive for delete to authenticated
  using (squadra.e_coach(id));

create policy societa_insert on squadra.societa as permissive for insert to authenticated
  with check ((creata_da = auth.uid()));

create policy societa_select on squadra.societa as permissive for select to authenticated
  using ((id IN ( SELECT squadra.mie_societa() AS mie_societa)));

create policy societa_update on squadra.societa as permissive for update to authenticated
  using (squadra.e_coach(id))
  with check (squadra.e_coach(id));

create policy zone_select on squadra.zone as permissive for select to authenticated
  using (true);

-- ===== Grant ad anon e authenticated

grant SELECT on table squadra.atleti to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.atleti to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.benessere to authenticated;
grant SELECT on table squadra.categorie to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.categorie to authenticated;
grant SELECT on table squadra.categorie_stagione to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.categorie_stagione to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.esercizi to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.esercizi_settimana to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.gare to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.impostazioni_stagione to authenticated;
grant SELECT on table squadra.membri to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.membri to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.obiettivi_fase to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.periodizzazione to authenticated;
grant SELECT on table squadra.presenze to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.presenze to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.richieste to authenticated;
grant SELECT on table squadra.sedute to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.sedute to authenticated;
grant SELECT on table squadra.societa to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.societa to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_atleti_doppioni to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_benessere to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_benessere_tendenza to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_carico_atleta to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_carico_zona to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_carico_zona_reale to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_fase_confronto to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_fase_reale to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_frequenza to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_serie to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_settimana_atleta to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_stagioni to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.v_volume_seduta to authenticated;
grant SELECT on table squadra.zone to anon;
grant DELETE, INSERT, SELECT, UPDATE on table squadra.zone to authenticated;
grant EXECUTE on function squadra.categoria_di(integer,squadra.sesso,text) to authenticated;
grant EXECUTE on function squadra.crea_societa(text,text) to authenticated;
grant EXECUTE on function squadra.decidi_richiesta(uuid,boolean,squadra.ruolo) to authenticated;
grant EXECUTE on function squadra.e_coach(uuid) to authenticated;
grant EXECUTE on function squadra.elenco_membri(uuid) to authenticated;
grant EXECUTE on function squadra.genera_codice() to authenticated;
grant EXECUTE on function squadra.imposta_ruolo(uuid,uuid,squadra.ruolo) to authenticated;
grant EXECUTE on function squadra.membro_iniziale() to authenticated;
grant EXECUTE on function squadra.metri_per_specializzazione(jsonb,text) to authenticated;
grant EXECUTE on function squadra.mie_societa() to authenticated;
grant EXECUTE on function squadra.puo_scrivere(uuid) to authenticated;
grant EXECUTE on function squadra.richiedi_accesso(text,text) to authenticated;
grant EXECUTE on function squadra.rigenera_codice(uuid) to authenticated;
grant EXECUTE on function squadra.rimuovi_membro(uuid,uuid) to authenticated;
grant EXECUTE on function squadra.tocca_updated_at() to authenticated;
