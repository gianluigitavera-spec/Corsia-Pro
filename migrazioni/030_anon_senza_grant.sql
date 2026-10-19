-- 030 — anon non legge più le tabelle con i dati della squadra
--
-- anon è il ruolo di chi non ha fatto l'accesso. Aveva SELECT su
-- atleti, sedute, presenze, societa e membri. Oggi le RLS lo fermano
-- comunque (tutte le policy di quelle tabelle sono "to authenticated"),
-- ma il grant restava una porta aperta: bastava una policy scritta "to
-- public", o una vista senza security_invoker come v_atleti_doppioni
-- prima della 029, per esporre dati di minori a chiunque avesse la
-- chiave anon, che sta nel frontend ed è pubblica per costruzione.
--
-- L'app prima dell'accesso non legge niente dello schema squadra: la
-- schermata Accesso chiama solo l'autenticazione, e il codice invito
-- (richiedi_accesso) si usa da SenzaSquadra, quindi da utente
-- registrato.
--
-- SwimCoach AI, che sta nello stesso progetto, nemmeno (verificato nel
-- sorgente, swimcoach-web/src/App.jsx, il 18/10/2026). Tocca squadra in
-- tre punti, tutti con l'utente loggato e mai con la sola chiave anon:
--   - cpMieSocieta     legge membri (con societa) — le società del coach
--   - cpFaseCorrente   legge periodizzazione — la fase del giorno
--   - cpInviaSeduta    inserisce in sedute, con origine = 'swimcoach'
-- Senza sessione SwimCoach mostra solo la schermata di accesso, e tutti e
-- tre partono da profile.role === "coach", che esiste solo a sessione
-- aperta: Postgres vede authenticated. La chiave scritta nel suo codice è
-- la anon (role: anon nel JWT), non la service_role. La sua Edge Function
-- (assistente-allenamento) non tocca squadra.
--
-- ESEGUITA a mano dal pannello Supabase il 18/10/2026 e verificata: anon
-- ha ora solo SELECT su categorie, categorie_stagione e zone. Privilegi
-- di default dello schema squadra: solo authenticated=arwd/postgres,
-- nessun anon — una tabella nuova non gli viene concessa da sola. Questo
-- file esiste perché la catena resti ripetibile su un ambiente pulito.
--
-- Restano a anon, perché non chiesto: categorie, categorie_stagione,
-- zone. Sono tabelle di riferimento, senza dati di persone.

revoke all on table
  squadra.atleti,
  squadra.sedute,
  squadra.presenze,
  squadra.societa,
  squadra.membri
from anon;

-- Controllo 1: nessun grant ad anon su quelle cinque tabelle.
-- La query deve restituire zero righe.
-- select table_name, privilege_type
--   from information_schema.role_table_grants
--  where grantee = 'anon' and table_schema = 'squadra'
--    and table_name in ('atleti', 'sedute', 'presenze', 'societa', 'membri');

-- Controllo 2: privilegi di default dello schema. Se qui compare anon,
-- ogni tabella nuova in squadra gli verrà concessa da sola, e questa
-- migrazione andrà ripetuta a mano a ogni tabella.
-- select pg_get_userbyid(defaclrole) as chi_crea, defaclobjtype, defaclacl
--   from pg_default_acl
--  where defaclnamespace = 'squadra'::regnamespace;
