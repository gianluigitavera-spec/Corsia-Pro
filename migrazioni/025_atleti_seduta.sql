-- 025 — elenco atleti esplicito sulla seduta
--
-- Serve alle sedute rivolte a pochi atleti (le "doppie"): oggi la seduta
-- ha solo `categorie`, e l'appello deduce i convocati dal filtro categoria
-- scelto in testata. Chi fa il doppio trascina dentro tutta la categoria,
-- e mettere assenti gli altri falsa le percentuali di frequenza.
--
-- La colonna è opzionale: NULL o vuota non cambia niente di quello che
-- c'è oggi. Valorizzata, diventa la lista dei convocati per quella seduta
-- al posto del filtro per categoria — l'appello mostra e rileva solo
-- questi atleti, senza toccare le presenze degli altri.
--
-- Non tocca v_frequenza: quella vista conta dal registro presenze, non
-- dalle categorie né da questa colonna.

alter table squadra.sedute
  add column if not exists atleti uuid[] default null;

comment on column squadra.sedute.atleti is
  'Elenco atleti espliciti per sedute rivolte solo ad alcuni (es. doppie). NULL o vuoto = vale il comportamento normale per categoria. Quando valorizzato, l''appello mostra e rileva solo questi atleti, senza toccare le presenze degli altri.';
