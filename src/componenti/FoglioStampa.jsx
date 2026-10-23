import { foglioSeduta } from '../lib/dominio';

// Foglio da stampa: invisibile a schermo, è quello che finisce nel PDF.
// Bianco, essenziale, senza la veste grafica dell'app.
//
// Cosa c'è sul foglio lo decide foglioSeduta() in dominio.js — quali
// sezioni, quali righe, i blocchi, i totali per specializzazione, la
// durata. Qui si disegna e basta: il PDF generato dall'app legge la
// stessa funzione, così i due fogli non possono raccontare sedute
// diverse.
export default function FoglioStampa({ seduta, societa, categorie }) {
  const foglio = foglioSeduta(seduta, { societa, categorie });

  return (
    <div className="foglio" aria-hidden="true">
      <div className="foglio-testata">
        <div>
          <h1>{foglio.titolo}</h1>
          <p className="foglio-sotto">{foglio.sottotitolo}</p>
        </div>
        <div className="foglio-societa">{foglio.societa}</div>
      </div>

      {foglio.sezioni.map((sez) => (
        <div className="foglio-sezione" key={sez.indice}>
          <div className="foglio-sezione-testa">
            <b>{sez.titolo}</b>
            {sez.destinatari && <span> — {sez.destinatari}</span>}
            <span className="foglio-metri">{sez.metri}</span>
          </div>
          <table className="foglio-tabella">
            <tbody>
              {sez.righe.map((r) => (
                r.tipo === 'blocco' ? (
                  <tr key={r.indice} className="foglio-apre">
                    <td colSpan={4}>{r.testo}</td>
                  </tr>
                ) : (
                  <tr key={r.indice} className={r.inBlocco ? 'foglio-in-blocco' : undefined}>
                    {/* Il tag sta sulla riga del lavoro, grigio. */}
                    <td className="foglio-notaz">
                      {r.notazione}
                      {r.tag && <span className="foglio-tag"> · {r.tag}</span>}
                    </td>
                    <td className="foglio-rec">{r.recupero}</td>
                    <td className="foglio-zona">{r.zona}</td>
                    <td className="foglio-m">{r.metri}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <table className="foglio-volumi">
        <tbody>
          {foglio.totali.map((t) => (
            <tr key={t.nome}>
              <td>{t.nome}</td>
              <td className="foglio-m"><b>{t.testo}</b></td>
            </tr>
          ))}
        </tbody>
      </table>

      {foglio.note && <p className="foglio-note-finali">{foglio.note}</p>}
    </div>
  );
}
