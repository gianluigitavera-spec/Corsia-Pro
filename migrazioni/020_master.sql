-- 020 — categoria Master
--
-- Master è una categoria sola, non le fasce quinquennali FIN: è così che
-- il gruppo si tratta in vasca.
--
-- ATTENZIONE, e non è una svista: NON si aggiunge nessuna riga in
-- squadra.categorie_stagione. Master non è un'età, è un tipo di
-- tesseramento — un agonista di 28 anni è Senior, un Master di 28 è
-- Master. Se le mettessimo una fascia d'anni, ogni adulto agonista
-- finirebbe dentro da solo. L'assegnazione passa da atleti.categoria_override.

insert into squadra.categorie (codice, nome, ordine, colore)
values ('MAS', 'Master', 200, 'violet')
on conflict (codice) do update
  set nome = excluded.nome,
      ordine = excluded.ordine,
      colore = excluded.colore;

-- Controllo: la 20ª categoria dev'essere in fondo alla lista.
-- select codice, nome, ordine from squadra.categorie order by ordine;
