-- 028 — categoria Triathlon
--
-- Triathlon è un PERCORSO, non un'età: come Teen, Propaganda e Master.
--
-- ATTENZIONE, come per Master nella 020 e non è una svista: NON si
-- aggiunge nessuna riga in squadra.categorie_stagione. Se Triathlon
-- avesse una fascia d'anni, ogni atleta di quell'età ci finirebbe dentro
-- da solo, e il triathleta è tale per come si allena, non per quando è
-- nato. L'assegnazione passa da atleti.categoria_override — a mano dalla
-- scheda Atleti, oppure con la colonna categoria del CSV (TRI o
-- Triathlon, l'import accetta il codice e il nome per esteso).
--
-- Va in coda, dopo Master: ordine 210. CATEGORIE in src/lib/dominio.js
-- ripete lo stesso ordine.
--
-- Eseguita a mano dal pannello Supabase; questo file esiste perché la
-- catena resti ripetibile su un ambiente pulito.

insert into squadra.categorie (codice, nome, ordine, colore)
values ('TRI', 'Triathlon', 210, 'fuchsia')
on conflict (codice) do nothing;

-- Controllo: la 21ª categoria dev'essere in fondo alla lista.
-- select codice, nome, ordine, colore from squadra.categorie order by ordine;

-- Nessun atleta si sposta da solo: chi fa triathlon va segnato a mano.
