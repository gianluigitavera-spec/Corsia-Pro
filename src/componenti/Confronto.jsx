import { useEffect, useState } from 'react';
import { Target, TrendingUp } from 'lucide-react';
import * as api from '../lib/dati';
import { FASI, faseDi, dataIt, percentualiPerFamiglia } from '../lib/dominio';
import { TINTA_FAMIGLIA } from '../lib/colori';

const FAMIGLIE = [
  { chiave: 'aerobico', nome: 'Aerobico' },
  { chiave: 'vo2', nome: 'VO₂max' },
  { chiave: 'lattacido', nome: 'Lattacido' },
  { chiave: 'alattacido', nome: 'Alattacido' },
];

const oggi = () => new Date().toISOString().slice(0, 10);

// Programmato contro nuotato: la parte che rende utile la periodizzazione.
export default function Confronto({ societa, specializzazione = 'Generale', gruppi = [], codiciGruppi }) {
  const [righe, setRighe] = useState([]);
  const [errore, setErrore] = useState(null);

  // Gli obiettivi di fase si decidono per una categoria alla volta:
  // con più gruppi spuntati in testata non c'è un confronto da fare.
  const codici = gruppi.length === 1 ? codiciGruppi : null;

  useEffect(() => {
    if (!codici) { setRighe([]); return; }
    api.confrontoFasi(societa.id, codici)
      .then(setRighe)
      .catch((e) => setErrore(e.message));
  }, [societa.id, codici?.join()]);

  // Raggruppa per fase, sommando i metri della specializzazione scelta
  const fasi = Object.values(
    righe
      .filter((r) => !r.specializzazione || r.specializzazione === specializzazione)
      .reduce((acc, r) => {
        acc[r.fase_id] ??= {
          fase: r.fase, dal: r.dal, al: r.al,
          ripartizione: r.ripartizione || {}, km: r.km_settimana,
          metri: {},
        };
        if (r.famiglia && r.metri) {
          acc[r.fase_id].metri[r.famiglia] = (acc[r.fase_id].metri[r.famiglia] || 0) + Number(r.metri);
        }
        return acc;
      }, {})
  ).sort((a, b) => a.dal.localeCompare(b.dal));

  if (errore) return <div className="avviso errore">{errore}</div>;

  return (
    <div className="scheda sezione">
      <div className="intestazione">
        <Target size={16} style={{ color: 'var(--ambra)' }} />
        <h3>Programmato contro nuotato</h3>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 12 }}>
          {gruppi.length === 1 ? gruppi[0] : 'scegli una categoria sola in alto'}
        </span>
      </div>

      <div className="corpo">
        {fasi.length === 0 ? (
          <div className="vuoto">
            <TrendingUp size={28} style={{ color: 'var(--testo-3)' }} />
            <h3 style={{ marginTop: 10 }}>Niente da confrontare</h3>
            <p>
              Serve una periodizzazione per questa categoria (dal calendario) e gli obiettivi di fase.
              Poi qui vedrai, fase per fase, la distanza fra quello che avevi in testa e quello che è
              stato nuotato.
            </p>
          </div>
        ) : (
          fasi.map((f, i) => {
            // Il volume della fase è tutto; il reale di ogni famiglia è sui
            // soli metri con la zona, come gli obiettivi, che fra le quattro
            // famiglie fanno 100. La vista chiama 'altro' la famiglia
            // mancante: resta fuori, e si dice quanta è.
            const famiglie = percentualiPerFamiglia(f.metri);
            const totale = famiglie.totale;
            const conclusa = f.al < oggi();
            const inCorso = f.dal <= oggi() && f.al >= oggi();
            const info = faseDi(f.fase);
            const haObiettivi = Object.keys(f.ripartizione || {}).length > 0;

            return (
              <div className="confronto-fase" key={i} style={{ '--tinta': info?.colore }}>
                <div className="testa-confronto">
                  <span className="punto" style={{ background: info?.colore }} />
                  <b>{info?.nome}</b>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--testo-3)' }}>
                    {dataIt(f.dal)} → {dataIt(f.al)}
                  </span>
                  {inCorso && <span className="in-corso">in corso</span>}
                  <div style={{ flex: 1 }} />
                  <span className="mono" style={{ color: 'var(--testo-2)' }}>
                    {(totale / 1000).toFixed(1)} km
                  </span>
                </div>

                {!haObiettivi ? (
                  <p className="nota-obiettivo">
                    Nessun obiettivo impostato per questa fase: mettili dal calendario, nel pannello
                    della periodizzazione, e il confronto compare qui.
                  </p>
                ) : totale === 0 ? (
                  <p className="nota-obiettivo">
                    {conclusa ? 'Nessuna seduta registrata in questa fase.' : 'Fase non ancora cominciata.'}
                  </p>
                ) : famiglie.classificati === 0 ? (
                  <p className="nota-obiettivo">
                    Nessuna serie con la zona in questa fase: senza zone non c'è niente da confrontare.
                  </p>
                ) : (
                  FAMIGLIE.map((fam) => {
                    const reale = Math.round(famiglie.pct[fam.chiave] || 0);
                    const atteso = f.ripartizione[fam.chiave];
                    const scarto = atteso != null ? reale - atteso : null;
                    return (
                      <div className="riga-confronto" key={fam.chiave} style={{ '--c': TINTA_FAMIGLIA[fam.chiave] }}>
                        <span className="nome-conf">{fam.nome}</span>
                        <span className="piste">
                          <span className="pista-conf atteso">
                            {atteso != null && <i style={{ width: `${Math.min(100, atteso)}%` }} />}
                          </span>
                          <span className="pista-conf reale">
                            <i style={{ width: `${Math.min(100, reale)}%` }} />
                          </span>
                        </span>
                        <span className="mono valori-conf">
                          <span style={{ color: 'var(--testo-3)' }}>{atteso != null ? `${atteso}%` : '—'}</span>
                          <span>{reale}%</span>
                        </span>
                        <span className="mono scarto" data-verso={scarto == null ? '' : scarto > 4 ? 'su' : scarto < -4 ? 'giu' : 'ok'}>
                          {scarto == null ? '' : `${scarto > 0 ? '+' : ''}${scarto}`}
                        </span>
                      </div>
                    );
                  })
                )}
                {haObiettivi && famiglie.fuori > 0 && famiglie.classificati > 0 && (
                  <p className="nota-obiettivo">
                    {famiglie.fuori.toLocaleString('it-IT')} m senza zona su{' '}
                    {totale.toLocaleString('it-IT')}: contano nei km, restano fuori dalle percentuali.
                  </p>
                )}
              </div>
            );
          })
        )}

        <p style={{ fontSize: 12, color: 'var(--testo-3)', marginTop: 12 }}>
          La barra chiara è quello che ti aspettavi, quella piena quello che è stato nuotato.
          Le percentuali sono sui soli metri con la zona, come gli obiettivi: le serie senza zona
          contano nei km ma non in nessuna famiglia.
        </p>
      </div>
    </div>
  );
}
