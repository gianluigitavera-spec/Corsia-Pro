-- 021 — chiave anti-doppione sugli atleti
--
-- Finora importare due volte lo stesso foglio creava due volte gli stessi
-- atleti. La chiave normalizza cognome+nome+anno — minuscole, accenti
-- appiattiti, via spazi e apostrofi — così "D'Amico Luca 2012" e
-- "d' amico  luca 2012" sono la stessa persona.
--
-- La stessa regola vive in chiaveAtleta() dentro src/lib/dominio.js.
-- I due posti devono restare allineati: se cambi la normalizzazione qui,
-- cambiala anche là, o l'app conta i doppioni in un modo e il database
-- li rifiuta in un altro.
--
-- ESEGUIRE IN DUE TEMPI: prima la parte A, poi si guarda la vista, e solo
-- quando non torna più niente si esegue la parte B. Se in squadra ci sono
-- già doppioni, la parte B fallisce — ed è quello che deve fare.

-- =====================================================================
-- PARTE A — la chiave e la vista di controllo
-- =====================================================================

create or replace function squadra.chiave_atleta(cognome text, nome text, anno int)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(coalesce(cognome, '') || coalesce(nome, '') || coalesce(anno::text, '')),
      'àáâäãèéêëìíîïòóôöõùúûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]', '', 'g'
  );
$$;

alter table squadra.atleti
  add column if not exists chiave text
  generated always as (squadra.chiave_atleta(cognome, nome, anno_nascita)) stored;

-- Chi è in doppio, adesso, prima di mettere il lucchetto.
create or replace view squadra.v_atleti_doppioni as
select societa_id,
       chiave,
       count(*)                                    as quanti,
       array_agg(cognome || ' ' || nome || ' ' || anno_nascita
                 order by attivo desc, id)         as nomi,
       array_agg(id order by attivo desc, id)      as ids
from squadra.atleti
group by societa_id, chiave
having count(*) > 1;

-- Guarda qui prima di andare avanti:
-- select * from squadra.v_atleti_doppioni;
--
-- Per ognuno: tieni quello che ha già presenze e cancella gli altri, oppure
-- fallo dall'app (scheda Atleti → selezione multipla → Cancella, che i
-- doppioni con storico non li tocca).

-- =====================================================================
-- PARTE B — il lucchetto. Solo quando la vista non torna più righe.
-- =====================================================================

create unique index if not exists atleti_chiave_unica
  on squadra.atleti (societa_id, chiave);

-- Da qui in poi lo stesso atleta non può più entrare due volte nella
-- stessa società, nemmeno se qualcuno ricarica il CSV per sbaglio.
-- Nota: vale anche per gli archiviati, di proposito — reimportare uno
-- archiviato deve ritrovare lui, non crearne un gemello senza storico.
--
-- Omonimi veri (stesso cognome, nome e anno, due persone diverse) qui si
-- scontrano: distinguili a mano, per esempio con il secondo nome.
