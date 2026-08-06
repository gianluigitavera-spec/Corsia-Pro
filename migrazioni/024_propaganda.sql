-- 024 — le fasce d'età dei Propaganda
--
-- La tabella FIN parte dagli Esordienti B: sotto non c'è niente, e 70
-- atleti restavano senza categoria. I Propaganda però sono solo bambini
-- più piccoli, quindi le fasce si continuano a ritroso.
--
-- Non ci sono anni scritti a mano: si parte dall'Esordiente B più
-- giovane già in tabella e si sale di un anno. Così la migrazione
-- funziona su qualsiasi stagione e resta giusta quando le fasce scalano.
--
-- ATTENZIONE — Teen NON è qui, e non è una dimenticanza. I Teen non
-- stanno sotto gli Esordienti B: sono ragazzi dell'età dei Ragazzi o dei
-- Juniores che nuotano fuori dal percorso agonistico. Non è un'età, è un
-- percorso, esattamente come i Master. Quelli si assegnano dalla colonna
-- categoria del CSV o a mano.

insert into squadra.categorie_stagione (stagione, categoria, sesso, anno_nascita_da, anno_nascita_a)
select
  b.stagione,
  p.categoria,
  b.sesso,
  -- PROP_2 = un anno più giovane dell'Esordiente B più giovane.
  -- PROP_01 = tutti gli altri, senza fondo: i più piccoli che arrivano.
  case p.categoria when 'PROP_2' then b.piu_giovane + 1 else b.piu_giovane + 2 end,
  case p.categoria when 'PROP_2' then b.piu_giovane + 1 else b.piu_giovane + 20 end
from (
  select stagione, sesso, max(anno_nascita_a) as piu_giovane
  from squadra.categorie_stagione
  where categoria like 'ESO_B%'
  group by stagione, sesso
) b
cross join (values ('PROP_2'), ('PROP_01')) as p(categoria)
on conflict do nothing;

-- Controllo: le fasce devono incastrarsi senza buchi né sovrapposizioni.
-- select categoria, sesso, anno_nascita_da, anno_nascita_a
-- from squadra.categorie_stagione
-- where stagione = '2025/26' and (categoria like 'PROP%' or categoria like 'ESO_B%')
-- order by sesso, anno_nascita_da;
