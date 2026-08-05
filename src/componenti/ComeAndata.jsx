// =====================================================================
// COM'È ANDATA
//
// Il programma è quello che hai scritto e non si tocca. Qui si segna
// solo dove la vasca è andata diversamente: la serie chiusa all'ottavo
// cento invece che al decimo, il finale saltato perché l'acqua era
// fredda. Chi non tocchi resta com'era.
//
// Vale per il gruppo, non per il singolo: chi ha nuotato meno degli
// altri si legge dall'appello.
//
// Sta sotto l'appello di proposito — è la schermata che hai già aperto a
// fine allenamento, con la seduta e i nomi davanti.
// =====================================================================
import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import * as api from '../lib/dati';
import { chiaveRiga, metriSvolti, scartoPerZona } from '../lib/dominio';

export default function ComeAndata({ seduta, puoScrivere, suSalvato }) {
  const [righe, setRighe] = useState({});
  const [nota, setNota] = useState('');
  const [salvato, setSalvato] = useState(true);

  useEffect(() => {
    setRighe(seduta?.svolto?.righe || {});
    setNota(seduta?.svolto?.nota || '');
    setSalvato(true);
  }, [seduta?.id]);

  if (!seduta) return null;

  const sezioni = seduta.sezioni || [];
  const previsti = metriSvolti(sezioni, null);
  const fatti = metriSvolti(sezioni, { righe });
  const scarto = fatti - previsti;
  const perZona = scartoPerZona(sezioni, { righe });

  async function salva(nuoveRighe, nuovaNota) {
    setSalvato(false);
    // Una seduta andata come scritta non salva niente: svolto resta
    // vuoto invece di riempirsi di righe uguali al programma.
    const pulite = Object.fromEntries(
      Object.entries(nuoveRighe).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const corpo = Object.keys(pulite).length || nuovaNota
      ? { righe: pulite, nota: nuovaNota || undefined }
      : null;
    try {
      await api.salvaSvolto(seduta.id, corpo);
      setSalvato(true);
      suSalvato?.(corpo);
    } catch { /* resta in coda, la spia in testata lo dice */ }
  }

  function cambia(chiave, valore) {
    const nuove = { ...righe };
    if (valore === '') delete nuove[chiave];
    else nuove[chiave] = Math.max(0, +valore);
    setRighe(nuove);
    salva(nuove, nota);
  }

  return (
    <div className="scheda" style={{ marginTop: 14 }}>
      <div className="intestazione">
        <b>Com'è andata</b>
        <span style={{ color: 'var(--testo-3)', fontSize: 13 }}>
          tocca solo le righe andate diversamente
        </span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ color: scarto ? 'var(--ambra)' : 'var(--menta)' }}>
          {fatti} m {scarto ? `(${scarto > 0 ? '+' : ''}${scarto})` : '· come scritta'}
        </span>
      </div>

      <div className="corpo">
        {sezioni.map((sezione, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="mono" style={{ color: 'var(--ciano)', fontSize: 12, marginBottom: 6 }}>
              {sezione.titolo || 'Sezione'}
            </div>

            {(sezione.serie || []).map((serie, j) => {
              const k = chiaveRiga(i, j);
              const previsto = +serie.metri || 0;
              const corretto = righe[k];
              const diverso = corretto !== undefined && +corretto !== previsto;
              return (
                <div key={k} className="riga-andata">
                  <span className="testo-riga">{serie.notazione}</span>
                  {serie.zona && <span className="mono zona-riga">{serie.zona}</span>}
                  <span className="mono previsto">{previsto} m</span>
                  <input
                    className="mono"
                    type="number"
                    inputMode="numeric"
                    disabled={!puoScrivere}
                    placeholder={String(previsto)}
                    value={corretto ?? ''}
                    onChange={(e) => cambia(k, e.target.value)}
                    style={{ width: 84, borderColor: diverso ? 'var(--ambra)' : undefined }}
                  />
                  {diverso ? (
                    <button className="mini" title="Rimetti come programmato"
                      onClick={() => cambia(k, '')}>
                      <RotateCcw size={13} />
                    </button>
                  ) : <span style={{ width: 28 }} />}
                </div>
              );
            })}
          </div>
        ))}

        {Object.keys(perZona).length > 0 && (
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--testo-2)' }}>
            Dove è cambiato:{' '}
            {Object.entries(perZona).map(([zona, m]) => (
              <span key={zona} className="mono" style={{ marginRight: 10 }}>
                {zona} {m > 0 ? '+' : ''}{m}
              </span>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Una riga sul perché, se serve"
          value={nota}
          disabled={!puoScrivere}
          onChange={(e) => { setNota(e.target.value); setSalvato(false); }}
          onBlur={() => salva(righe, nota)}
          style={{ width: '100%' }}
        />
        {!salvato && (
          <div style={{ color: 'var(--testo-3)', fontSize: 12, marginTop: 6 }}>
            non ancora salvato
          </div>
        )}
      </div>
    </div>
  );
}
