import {
  TUTTI, metriPerSpecializzazione, dataItLunga, durataStimata, inOreMinuti, eSecco,
  specializzazioniDaSezioni, notaLeggibile,
} from '../lib/dominio';

// Foglio da stampa: invisibile a schermo, è quello che finisce nel PDF.
// Bianco, essenziale, senza la veste grafica dell'app.
export default function FoglioStampa({ seduta, societa, categorie }) {
  const nomeCategoria = (c) => categorie?.find((x) => x.codice === c)?.nome || c;
  const quando = dataItLunga(seduta.data);
  // Le specializzazioni che la seduta nomina davvero: una seduta per
  // Esordienti non ne ha nessuna, e stampare cinque totali identici a piè
  // di pagina non aiuta chi legge il foglio sul bordo. Lo stesso elenco
  // serve alla durata in testata e ai totali in fondo, o i due numeri
  // racconterebbero sedute diverse.
  const specializzazioni = specializzazioniDaSezioni(seduta.sezioni);
  const durata = durataStimata(seduta.sezioni, specializzazioni);

  return (
    <div className="foglio" aria-hidden="true">
      <div className="foglio-testata">
        <div>
          <h1>{seduta.titolo || 'Seduta di allenamento'}</h1>
          <p className="foglio-sotto">
            {quando}
            {seduta.categorie?.length ? ` · ${seduta.categorie.map(nomeCategoria).join(', ')}` : ''}
            {durata.secondi ? ` · ~${inOreMinuti(durata.secondi)}` : ''}
          </p>
        </div>
        <div className="foglio-societa">{societa?.nome}</div>
      </div>

      {(seduta.sezioni || []).map((sez, i) => {
        const dest = sez.destinatari?.length ? sez.destinatari : [TUTTI];
        const metri = (sez.serie || []).reduce((t, s) => t + (Number(s.metri) || 0), 0);
        if (!(sez.serie || []).length) return null;
        return (
          <div className="foglio-sezione" key={i}>
            <div className="foglio-sezione-testa">
              <b>{(sez.titolo || `Sezione ${i + 1}`).toUpperCase()}</b>
              {!dest.includes(TUTTI) && <span> — {dest.join(', ')}</span>}
              <span className="foglio-metri">
                {eSecco(sez)
                  ? `a secco${sez.durataMin ? ` · ${sez.durataMin}'` : ''}`
                  : `${metri} m`}
              </span>
            </div>
            <table className="foglio-tabella">
              <tbody>
                {(sez.serie || []).map((s, j) => (
                  // L'apertura di blocco prende la riga per sé: "×3" e le
                  // righe che seguono rientrate sotto.
                  s.apreBlocco > 1 ? (
                    <tr key={j} className="foglio-apre">
                      <td colSpan={4}>×{s.apreBlocco}</td>
                    </tr>
                  ) : (
                    <tr key={j} className={s.moltiplicato ? 'foglio-in-blocco' : undefined}>
                      {/* Il tag sta sulla riga del lavoro. Prima c'era un
                          elenco a fondo sezione che ripeteva la notazione
                          per intero e ci appendeva i promemoria di lettura
                          dell'analizzatore: due righe per dire una cosa. */}
                      <td className="foglio-notaz">
                        {s.notazione}
                        {notaLeggibile(s.note) && (
                          <span className="foglio-tag"> · {notaLeggibile(s.note)}</span>
                        )}
                      </td>
                      <td className="foglio-rec">{s.recupero || ''}</td>
                      <td className="foglio-zona">{s.zona || ''}</td>
                      <td className="foglio-m">{s.metri ? `${s.metri} m` : ''}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <table className="foglio-volumi">
        <tbody>
          {/* Una specializzazione sola — il caso di ogni gruppo che non le
              usa — non ha bisogno di una tabella: è tutta la seduta. Si
              chiama "Totale" quando è Generale, col suo nome quando è un
              ramo, o il foglio perderebbe l'informazione di chi sono quei
              metri.

              Il conto NON si fa confrontando i totali fra loro: due rami
              possono valere gli stessi metri e restare due lavori diversi,
              da stampare separati. */}
          {specializzazioni.length === 1 ? (() => {
            const spec = specializzazioni[0];
            const m = metriPerSpecializzazione(seduta.sezioni, spec);
            if (!m) return null;
            return (
              <tr>
                <td>{spec === 'Generale' ? 'Totale' : spec}</td>
                <td className="foglio-m"><b>{m.toLocaleString('it-IT')} m</b></td>
              </tr>
            );
          })() : specializzazioni.map((spec) => {
            const m = metriPerSpecializzazione(seduta.sezioni, spec);
            if (!m) return null;
            return (
              <tr key={spec}>
                <td>{spec}</td>
                <td className="foglio-m"><b>{m.toLocaleString('it-IT')} m</b></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {seduta.note && <p className="foglio-note-finali">{seduta.note}</p>}
    </div>
  );
}
