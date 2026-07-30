import { TUTTI, SPECIALIZZAZIONI, metriPerSpecializzazione } from '../lib/dominio';

// Foglio da stampa: invisibile a schermo, è quello che finisce nel PDF.
// Bianco, essenziale, senza la veste grafica dell'app.
export default function FoglioStampa({ seduta, societa, categorie }) {
  const nomeCategoria = (c) => categorie?.find((x) => x.codice === c)?.nome || c;
  const dataIt = seduta.data
    ? new Date(seduta.data + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="foglio" aria-hidden="true">
      <div className="foglio-testata">
        <div>
          <h1>{seduta.titolo || 'Seduta di allenamento'}</h1>
          <p className="foglio-sotto">
            {dataIt}
            {seduta.categorie?.length ? ` · ${seduta.categorie.map(nomeCategoria).join(', ')}` : ''}
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
              <span className="foglio-metri">{metri} m</span>
            </div>
            <table className="foglio-tabella">
              <tbody>
                {(sez.serie || []).map((s, j) => (
                  <tr key={j}>
                    <td className="foglio-notaz">{s.notazione}</td>
                    <td className="foglio-rec">{s.recupero || ''}</td>
                    <td className="foglio-zona">{s.zona || ''}</td>
                    <td className="foglio-m">{s.metri ? `${s.metri} m` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(sez.serie || []).some((s) => s.note) && (
              <ul className="foglio-note">
                {(sez.serie || []).filter((s) => s.note).map((s, j) => (
                  <li key={j}>{s.notazione}: {s.note}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <table className="foglio-volumi">
        <tbody>
          {SPECIALIZZAZIONI.map((spec) => {
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
