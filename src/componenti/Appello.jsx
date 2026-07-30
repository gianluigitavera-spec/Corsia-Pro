import { useEffect, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import * as api from '../lib/dati';

// Un tocco cicla: non rilevato → P → A → G → non rilevato.
const CICLO = { undefined: 'P', null: 'P', P: 'A', A: 'G', G: null };
const NOME_STATO = { P: 'Presente', A: 'Assente', G: 'Giustificato' };

export default function Appello({ societa }) {
  const [sedute, setSedute] = useState([]);
  const [sedutaId, setSedutaId] = useState('');
  const [atleti, setAtleti] = useState([]);
  const [stati, setStati] = useState({});
  const [prontezza, setProntezza] = useState({});
  const [messaggio, setMessaggio] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([api.leggiSedute(societa.id), api.leggiAtleti(societa.id)]);
        setSedute(s);
        setAtleti(a);
        if (s.length) setSedutaId(s[0].id);
      } catch (e) {
        setMessaggio(e.message);
      }
    })();
  }, [societa.id]);

  useEffect(() => {
    if (!sedutaId) return;
    api
      .leggiPresenze(sedutaId)
      .then((righe) => setStati(Object.fromEntries(righe.map((r) => [r.atleta_id, r.stato]))))
      .catch((e) => setMessaggio(e.message));

    // Il benessere del giorno della seduta: serve qui, mentre decidi chi
    // manda cosa in acqua, non in una schermata a parte.
    const seduta = sedute.find((s) => s.id === sedutaId);
    if (!seduta) return;
    api
      .leggiBenessere(societa.id, seduta.data)
      .then((righe) => setProntezza(Object.fromEntries(righe.map((r) => [r.atleta_id, Number(r.prontezza)]))))
      .catch(() => setProntezza({}));
  }, [sedutaId, sedute, societa.id]);

  async function tocca(atletaId) {
    const prossimo = CICLO[stati[atletaId] ?? 'undefined'];
    setStati((s) => ({ ...s, [atletaId]: prossimo })); // ottimistico: il dito non aspetta la rete
    try {
      await api.segnaPresenza({ sedutaId, atletaId, societaId: societa.id, stato: prossimo });
      setMessaggio(null);
    } catch (e) {
      setMessaggio(`Non salvato: ${e.message}`);
    }
  }

  const rilevati = atleti.filter((a) => stati[a.id]).length;
  const presenti = atleti.filter((a) => stati[a.id] === 'P').length;

  if (sedute.length === 0) {
    return (
      <div className="scheda">
        <div className="vuoto">
          <h3>Nessuna seduta da appellare</h3>
          <p>L'appello si fa su una seduta. Creane una nella scheda Sedute.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="barra">
        <h1>Appello</h1>
        <div style={{ flex: 1 }} />
        <select value={sedutaId} onChange={(e) => setSedutaId(e.target.value)} style={{ maxWidth: 280 }}>
          {sedute.map((s) => (
            <option key={s.id} value={s.id}>
              {s.data} · {s.titolo || 'senza titolo'}
            </option>
          ))}
        </select>
      </div>

      <div className="barra" style={{ color: 'var(--testo-2)', fontSize: 14 }}>
        <span className="mono">{rilevati}/{atleti.length}</span> rilevati · <span className="mono">{presenti}</span> presenti
        {rilevati < atleti.length && <span>· i non toccati restano “non rilevato”, non presenti</span>}
        {Object.keys(prontezza).length > 0 && (
          <span>· il numero a destra è la prontezza del giorno</span>
        )}
      </div>

      {messaggio && <div className="avviso errore" style={{ marginBottom: 12 }}>{messaggio}</div>}

      <div className="appello">
        {atleti.map((a) => {
          const stato = stati[a.id] || null;
          const p = prontezza[a.id];
          const tintaP = p == null ? null
            : p >= 4 ? 'var(--menta)'
            : p >= 3 ? 'var(--ciano)'
            : p >= 2.25 ? 'var(--ambra)'
            : 'var(--rosso)';
          return (
            <button
              key={a.id}
              className="atleta-riga"
              data-stato={stato || ''}
              onClick={() => tocca(a.id)}
              aria-label={`${a.cognome} ${a.nome}: ${stato ? NOME_STATO[stato] : 'non rilevato'}`}
            >
              <span className="stato">{stato || '·'}</span>
              <span>
                <b>{a.cognome}</b> {a.nome}
                <br />
                <span className="spec">{a.specializzazione}</span>
              </span>
              <span style={{ flex: 1 }} />
              {p != null && (
                <span
                  className="mono segno-prontezza"
                  style={{ color: tintaP, borderColor: tintaP }}
                  title={`Prontezza ${p.toFixed(1)} su 5`}
                >
                  <HeartPulse size={12} /> {p.toFixed(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
