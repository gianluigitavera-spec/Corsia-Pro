-- =====================================================================
-- CHI SI È ISCRITTO — query da incollare nel SQL Editor di Supabase
--
-- Attenzione: qui dentro le RLS non valgono. L'editor gira come
-- amministratore e vede tutto, anche quello che dall'app non vedresti.
-- Sono query di manutenzione, non di curiosità.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Il quadro in due righe. Da guardare per prima.
-- ---------------------------------------------------------------------
select
  (select count(*) from auth.users)                                          as registrati,
  (select count(*) from auth.users where created_at > now() - interval '7 days')     as nuovi_7gg,
  (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days') as tornati_7gg,
  (select count(*) from squadra.membri)                                      as dentro_una_squadra,
  (select count(*) from squadra.societa)                                     as societa,
  (select count(*) from squadra.atleti where attivo)                         as atleti_attivi,
  (select count(*) from squadra.sedute)                                      as sedute_scritte;


-- ---------------------------------------------------------------------
-- 2. Tutti gli iscritti, con il nome, dal più recente.
--
-- Il nome sta nei metadati dell'utente, dove lo scrive la registrazione
-- dalla 0.26.0 in poi. Per chi si era iscritto PRIMA non c'è: in quel
-- caso la colonna prova a ricavarlo dall'indirizzo — "mario.rossi@..."
-- diventa "Mario Rossi" — e lo marca come indovinato, perché indovinato
-- è. Quelli lì li sistemi solo chiedendoglielo.
-- ---------------------------------------------------------------------
select
  u.created_at::date                      as iscritto_il,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'nome_completo'), ''),
    initcap(replace(replace(split_part(u.email, '@', 1), '.', ' '), '_', ' '))
  )                                       as nome,
  (u.raw_user_meta_data ->> 'nome_completo') is null as nome_indovinato,
  u.email,
  u.last_sign_in_at::date                 as ultimo_accesso,
  coalesce(s.nome, '— senza squadra —')   as squadra,
  m.ruolo
from auth.users u
left join squadra.membri m on m.user_id = u.id
left join squadra.societa s on s.id = m.societa_id
order by u.created_at desc;


-- ---------------------------------------------------------------------
-- 3. Chi si è registrato e si è fermato lì.
--
-- È la query che vale più delle altre: sono quelli che hanno fatto
-- l'account e non sono mai entrati in una squadra. O non hanno il codice
-- invito, o si sono persi nell'onboarding. Se questa lista cresce, il
-- problema non è l'app, è il primo minuto dell'app.
-- ---------------------------------------------------------------------
select
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'nome_completo'), ''),
    initcap(replace(replace(split_part(u.email, '@', 1), '.', ' '), '_', ' '))
  )                           as nome,
  u.email,
  u.created_at::date          as iscritto_il,
  u.last_sign_in_at::date     as ultimo_accesso,
  (u.last_sign_in_at is null) as mai_rientrato
from auth.users u
left join squadra.membri m on m.user_id = u.id
where m.user_id is null
order by u.created_at desc;


-- ---------------------------------------------------------------------
-- 4. Richieste di adesione ancora in attesa.
--
-- Le colonne della tabella richieste possono differire: se qualcosa non
-- torna, guarda prima com'è fatta con la query 7.
-- ---------------------------------------------------------------------
select r.*, s.nome as squadra
from squadra.richieste r
left join squadra.societa s on s.id = r.societa_id
order by r.created_at desc;


-- ---------------------------------------------------------------------
-- 5. Le società, e quanto sono vive davvero.
--
-- Serve anche a ritrovare i doppioni: se compaiono due righe con lo
-- stesso nome e una ha zero atleti e zero sedute, quella è la copia
-- rimasta indietro.
-- ---------------------------------------------------------------------
select
  s.nome,
  s.citta,
  s.created_at::date                                          as creata_il,
  count(distinct m.user_id)                                   as allenatori,
  count(distinct a.id) filter (where a.attivo)                as atleti,
  count(distinct se.id)                                       as sedute,
  max(se.data)                                                as ultima_seduta
from squadra.societa s
left join squadra.membri m  on m.societa_id  = s.id
left join squadra.atleti a  on a.societa_id  = s.id
left join squadra.sedute se on se.societa_id = s.id
group by s.id, s.nome, s.citta, s.created_at
order by atleti desc, s.nome;


-- ---------------------------------------------------------------------
-- 6. La versione senza nomi, per le statistiche.
--
-- Quella da usare quando ti serve solo sapere come va, non chi è chi.
-- ---------------------------------------------------------------------
select
  date_trunc('week', u.created_at)::date as settimana,
  count(*)                                as iscritti,
  count(m.user_id)                        as poi_entrati_in_squadra
from auth.users u
left join squadra.membri m on m.user_id = u.id
group by 1
order by 1 desc;


-- ---------------------------------------------------------------------
-- 6b. Chi non ha ancora il nome registrato.
--
-- La lista da smaltire: sono gli iscritti prima della 0.26.0. Il nome
-- glielo puoi scrivere tu a mano, uno alla volta, quando lo sai:
--
--   update auth.users
--   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--       || jsonb_build_object('nome_completo', 'Nome Cognome')
--   where email = 'indirizzo@esempio.it';
-- ---------------------------------------------------------------------
select u.email, u.created_at::date as iscritto_il
from auth.users u
where nullif(trim(u.raw_user_meta_data ->> 'nome_completo'), '') is null
order by u.created_at;


-- ---------------------------------------------------------------------
-- 7. Se una colonna non esiste: com'è fatta davvero una tabella.
-- ---------------------------------------------------------------------
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'squadra' and table_name = 'richieste'
-- order by ordinal_position;
