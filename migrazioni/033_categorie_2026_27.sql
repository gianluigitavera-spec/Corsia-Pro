-- 033 — le fasce d'età della stagione 2026/27
--
-- La FIN ha pubblicato le categorie 2026/27: identiche alle 2025/26, con
-- gli anni di nascita spostati di +1. Si copiano le righe della 2025/26
-- in squadra.categorie_stagione, con anno_nascita_da e anno_nascita_a +1.
-- Nessun anno scritto a mano: la stagione nuova esce dalla vecchia, riga
-- per riga, così non c'è un numero da sbagliare.
--
-- Cosa cambia nell'app: niente nei numeri. Senza la 2026/27 in tabella
-- l'app la proiettava già dalla 2025/26 spostando gli anni di +1
-- (fasceRisolte in dominio.js), cioè esattamente queste righe; la fascia
-- gialla in Atleti diceva appunto «ricavate da quelle del 2025/26». Con la
-- stagione vera in tabella la proiezione non serve più e la fascia sparisce
-- da sola. In SQL invece squadra.categoria_di() non proietta niente: per la
-- 2026/27 finora rispondeva null, da qui in poi risponde.
--
-- Solo dati: la struttura non cambia, e schema.sql resta quello di prima.
--
-- ESEGUITA a mano dal pannello Supabase il 18/10/2026, un passo alla
-- volta, e verificata: 27 righe nella 2025/26 e 27 nella 2026/27,
-- confronto riga per riga vuoto, nessuna vista senza security_invoker e
-- nessuna tabella senza RLS. Questo file esiste perché la catena resti
-- ripetibile su un ambiente pulito.
--
-- Si esegue UN PASSO ALLA VOLTA, nell'ordine. Il passo 1 è l'unico che
-- scrive, ed è un'istruzione sola: niente begin/commit. È tutto o niente
-- da sé — la chiave primaria (stagione, categoria, sesso) fa fallire
-- l'intero insert se anche una sola riga 2026/27 esistesse già.
-- Dopo il passo che scrive c'è un controllo che legge: è quello, non il
-- "Success" del pannello, a dire che il passo è entrato.


-- =====================================================================
-- PASSO 0 — guardare prima di scrivere (sola lettura)
-- =====================================================================
-- Le righe per stagione: la 2025/26 ne ha N, la 2026/27 deve essere
-- assente (nessuna riga in risultato). Annotare N: al passo 2 la 2026/27
-- deve averne altrettante.
select stagione, count(*) as righe
  from squadra.categorie_stagione
 where stagione in ('2025/26', '2026/27')
 group by stagione
 order by stagione;

-- Cosa si sta per copiare, categoria per categoria. Le righe PROP_* ci
-- sono e si copiano come le altre (deciso il 18/10/2026): le ha messe la
-- 024, i Propaganda hanno fasce d'età, e la proiezione dell'app li
-- contiene già — escluderli cambierebbe le categorie dei più piccoli.
-- Teen, Master e Triathlon invece non devono comparire: sono percorsi.
select categoria, sesso, anno_nascita_da, anno_nascita_a
  from squadra.categorie_stagione
 where stagione = '2025/26'
 order by sesso, anno_nascita_da, categoria;


-- =====================================================================
-- PASSO 1 — la 2026/27, copiata dalla 2025/26 con gli anni +1
-- =====================================================================
insert into squadra.categorie_stagione (stagione, categoria, sesso, anno_nascita_da, anno_nascita_a)
select '2026/27', categoria, sesso, anno_nascita_da + 1, anno_nascita_a + 1
  from squadra.categorie_stagione
 where stagione = '2025/26';


-- =====================================================================
-- PASSO 2 — controllo che legge
-- =====================================================================
-- Stesso numero di righe nelle due stagioni: due righe in risultato, con
-- lo stesso conteggio (N del passo 0).
select stagione, count(*) as righe
  from squadra.categorie_stagione
 where stagione in ('2025/26', '2026/27')
 group by stagione
 order by stagione;

-- Riga per riga: ogni (categoria, sesso) della 2025/26 ha la sua gemella
-- nella 2026/27 con gli anni +1, e viceversa. Deve restituire ZERO righe;
-- ogni riga che esce dice cosa non torna.
select coalesce(v.categoria, n.categoria) as categoria,
       coalesce(v.sesso, n.sesso)         as sesso,
       v.anno_nascita_da as da_2025, v.anno_nascita_a as a_2025,
       n.anno_nascita_da as da_2026, n.anno_nascita_a as a_2026,
       case
         when n.categoria is null then 'manca nella 2026/27'
         when v.categoria is null then 'c''è solo nella 2026/27'
         else 'anni non spostati di +1'
       end as cosa
  from (select * from squadra.categorie_stagione where stagione = '2025/26') v
  full join (select * from squadra.categorie_stagione where stagione = '2026/27') n
    on n.categoria = v.categoria and n.sesso = v.sesso
 where n.categoria is null
    or v.categoria is null
    or n.anno_nascita_da <> v.anno_nascita_da + 1
    or n.anno_nascita_a  <> v.anno_nascita_a + 1;

-- La stagione compare fra quelle proposte dall'app (v_stagioni).
select stagione from squadra.v_stagioni;


-- =====================================================================
-- PASSO 3 — i controlli di ogni migrazione (sola lettura)
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
