// =====================================================================
// Grafici in SVG puro: nessuna libreria, nessun peso aggiunto, e i
// colori sono quelli del tema. Due sole forme, che coprono tutto quello
// che serve qui: barre impilate nel tempo e barre orizzontali per atleta.
// =====================================================================

const km = (m) => (m / 1000).toFixed(1).replace('.0', '');

// ---------------------------------------------------------------------
// Barre impilate: una colonna per settimana, i segmenti sono le famiglie
// di zona. Si legge il volume e come è composto, in un colpo solo.
// ---------------------------------------------------------------------
export function BarreImpilate({ dati, serie, altezza = 190, unita = 'km' }) {
  if (!dati?.length) return <div className="vuoto-grafico">Nessun dato nel periodo</div>;

  const totali = dati.map((d) => serie.reduce((t, s) => t + (d.valori[s.chiave] || 0), 0));
  const massimo = Math.max(1, ...totali);
  const larghezza = 100 / dati.length;

  return (
    <div className="grafico">
      <svg viewBox={`0 0 100 ${altezza}`} preserveAspectRatio="none" className="tela" role="img">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2="100" y1={altezza - f * altezza} y2={altezza - f * altezza}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {dati.map((d, i) => {
          let y = altezza;
          const x = i * larghezza + larghezza * 0.18;
          const w = larghezza * 0.64;
          return (
            <g key={i}>
              {serie.map((s) => {
                const v = d.valori[s.chiave] || 0;
                if (!v) return null;
                const h = (v / massimo) * (altezza - 8);
                y -= h;
                return <rect key={s.chiave} x={x} y={y} width={w} height={h} fill={s.colore} opacity="0.92" />;
              })}
            </g>
          );
        })}
      </svg>

      <div className="etichette-grafico" style={{ gridTemplateColumns: `repeat(${dati.length}, 1fr)` }}>
        {dati.map((d, i) => (
          <span key={i} title={`${d.etichetta}: ${km(totali[i])} ${unita}`}>
            <b className="mono">{totali[i] ? km(totali[i]) : ''}</b>
            {d.etichetta}
          </span>
        ))}
      </div>

      <div className="legenda">
        {serie.map((s) => (
          <span key={s.chiave}><i className="punto" style={{ background: s.colore }} />{s.nome}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Barre orizzontali: una riga per atleta. La seconda barra, più sottile,
// serve al confronto (previsto contro nuotato, o frequenza).
// ---------------------------------------------------------------------
export function BarreOrizzontali({ dati, colore = 'var(--ciano)', formato = km, unita = 'km', massimo: max }) {
  if (!dati?.length) return <div className="vuoto-grafico">Nessun dato nel periodo</div>;
  const massimo = max || Math.max(1, ...dati.map((d) => d.valore));

  return (
    <div className="barre-orizzontali">
      {dati.map((d) => (
        <div className="riga-barra" key={d.etichetta}>
          <span className="nome-barra" title={d.etichetta}>{d.etichetta}</span>
          <span className="pista">
            <i style={{ width: `${(d.valore / massimo) * 100}%`, background: d.colore || colore }} />
            {d.riferimento != null && (
              <i className="riferimento" style={{ width: `${(d.riferimento / massimo) * 100}%` }} />
            )}
          </span>
          <span className="valore-barra mono">{formato(d.valore)}{unita ? ` ${unita}` : ''}</span>
        </div>
      ))}
    </div>
  );
}

export { km };
