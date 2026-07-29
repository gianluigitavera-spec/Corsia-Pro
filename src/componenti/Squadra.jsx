import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Check, X, Plus, Trash2, Users, KeyRound, UserPlus } from 'lucide-react';
import * as api from '../lib/dati';

const NOME_RUOLO = {
  coach: 'Capo allenatore',
  collega: 'Allenatore',
  lettore: 'Solo lettura',
};

export default function Squadra({ societa, ruolo, gruppi, ricaricaGruppi }) {
  const [dati, setDati] = useState(null);
  const [richieste, setRichieste] = useState([]);
  const [membri, setMembri] = useState([]);
  const [messaggio, setMessaggio] = useState(null);
  const [copiato, setCopiato] = useState(false);
  const [nuovoGruppo, setNuovoGruppo] = useState('');

  const capo = ruolo === 'coach';

  useEffect(() => { ricarica(); }, [societa.id]);

  async function ricarica() {
    try {
      const [s, m] = await Promise.all([api.leggiSocieta(societa.id), api.elencoMembri(societa.id)]);
      setDati(s);
      setMembri(m);
      if (capo) setRichieste(await api.richiesteDaDecidere(societa.id));
    } catch (e) {
      setMessaggio({ testo: e.message, errore: true });
    }
  }

  async function decidi(id, approva) {
    try {
      await api.decidiRichiesta(id, approva);
      setMessaggio({ testo: approva ? 'Allenatore aggiunto alla squadra.' : 'Richiesta rifiutata.' });
      ricarica();
    } catch (e) {
      setMessaggio({ testo: e.message, errore: true });
    }
  }

  async function copiaCodice() {
    try {
      await navigator.clipboard.writeText(dati.codice_invito);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      setMessaggio({ testo: 'Copia non riuscita: seleziona il codice a mano.', errore: true });
    }
  }

  if (!dati) return null;

  return (
    <>
      <div className="barra">
        <h1>Squadra</h1>
      </div>

      {messaggio && (
        <div className={`avviso ${messaggio.errore ? 'errore' : ''}`} style={{ marginBottom: 12 }}>
          {messaggio.testo}
        </div>
      )}

      {capo && (
        <div className="scheda">
          <div className="intestazione">
            <KeyRound size={16} style={{ color: 'var(--ciano)' }} />
            <h3>Codice di ingresso</h3>
          </div>
          <div className="corpo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 30, letterSpacing: '0.08em' }}>
                {dati.codice_invito}
              </span>
              <button className="mini" onClick={copiaCodice}>
                {copiato ? <Check size={14} /> : <Copy size={14} />} {copiato ? 'Copiato' : 'Copia'}
              </button>
              <button
                className="mini"
                onClick={async () => {
                  if (!confirm('Il codice vecchio smette di funzionare. Procedo?')) return;
                  try {
                    await api.rigeneraCodice(societa.id);
                    ricarica();
                  } catch (e) {
                    setMessaggio({ testo: e.message, errore: true });
                  }
                }}
              >
                <RefreshCw size={13} style={{ verticalAlign: -2 }} /> Rigenera
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--testo-2)', marginBottom: 0 }}>
              Passalo ai tuoi allenatori: si registrano, lo incollano e ti arriva la richiesta qui sotto.
              Chi non ha il codice non trova la squadra.
            </p>
          </div>
        </div>
      )}

      {capo && (
        <div className="scheda" style={{ marginTop: 12 }}>
          <div className="intestazione">
            <UserPlus size={16} style={{ color: 'var(--menta)' }} />
            <h3>Richieste in attesa</h3>
            {richieste.length > 0 && <span className="mono">{richieste.length}</span>}
          </div>
          {richieste.length === 0 ? (
            <div className="corpo" style={{ color: 'var(--testo-2)', fontSize: 14 }}>
              Nessuna richiesta da valutare.
            </div>
          ) : (
            <table>
              <tbody>
                {richieste.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.email}</b>
                      {r.messaggio && (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: 'var(--testo-2)' }}>{r.messaggio}</span>
                        </>
                      )}
                    </td>
                    <td className="mono" style={{ color: 'var(--testo-2)' }}>
                      {String(r.created_at).slice(0, 10)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="mini" onClick={() => decidi(r.id, false)}>Rifiuta</button>{' '}
                      <button className="azione" style={{ padding: '7px 13px', minHeight: 34 }} onClick={() => decidi(r.id, true)}>
                        Approva
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="scheda" style={{ marginTop: 12 }}>
        <div className="intestazione">
          <h3>Gruppi di allenamento</h3>
          <span className="mono" style={{ color: 'var(--testo-3)' }}>{(gruppi || []).length}</span>
        </div>
        <div className="corpo">
          <p style={{ fontSize: 13, color: 'var(--testo-3)', marginTop: 0 }}>
            Chi nuota insieme. Ogni seduta va assegnata a un gruppo: senza gruppi non si salva niente.
          </p>
          {(gruppi || []).length > 0 && (
            <div className="destinatari" style={{ marginBottom: 12 }}>
              {gruppi.map((g) => (
                <span key={g.id} className="pastiglia" style={{ cursor: 'default' }}>
                  {g.nome}
                  {capo && (
                    <button
                      className="togli"
                      style={{ minHeight: 'auto', padding: '0 0 0 7px', fontSize: 13 }}
                      aria-label={`Elimina ${g.nome}`}
                      onClick={async () => {
                        if (!confirm(`Eliminare il gruppo "${g.nome}"? Le sedute già salvate restano.`)) return;
                        try { await api.eliminaGruppo(g.id); ricaricaGruppi(); }
                        catch (e) { setMessaggio({ testo: e.message, errore: true }); }
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {capo && (
            <div className="barra" style={{ marginBottom: 0 }}>
              <input
                placeholder="es. Esordienti A"
                value={nuovoGruppo}
                onChange={(e) => setNuovoGruppo(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter' || !nuovoGruppo.trim()) return;
                  try { await api.creaGruppo(societa.id, nuovoGruppo.trim()); setNuovoGruppo(''); ricaricaGruppi(); }
                  catch (err) { setMessaggio({ testo: err.message, errore: true }); }
                }}
              />
              <button
                className="azione fantasma"
                disabled={!nuovoGruppo.trim()}
                onClick={async () => {
                  try { await api.creaGruppo(societa.id, nuovoGruppo.trim()); setNuovoGruppo(''); ricaricaGruppi(); }
                  catch (err) { setMessaggio({ testo: err.message, errore: true }); }
                }}
              >
                <Plus size={15} style={{ verticalAlign: -3 }} /> Crea gruppo
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="scheda" style={{ marginTop: 12 }}>
        <div className="intestazione">
          <Users size={16} style={{ color: 'var(--testo-2)' }} />
          <h3>Staff</h3>
          <span className="mono" style={{ color: 'var(--testo-2)' }}>{membri.length}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Allenatore</th>
              <th>Ruolo</th>
              {capo && <th />}
            </tr>
          </thead>
          <tbody>
            {membri.map((m) => (
              <tr key={m.user_id}>
                <td>{m.email}</td>
                <td>
                  {capo ? (
                    <select
                      value={m.ruolo}
                      onChange={async (e) => {
                        try {
                          await api.impostaRuolo(societa.id, m.user_id, e.target.value);
                          ricarica();
                        } catch (err) {
                          setMessaggio({ testo: err.message, errore: true });
                        }
                      }}
                      style={{ minHeight: 34, padding: '4px 8px' }}
                    >
                      {Object.entries(NOME_RUOLO).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    NOME_RUOLO[m.ruolo]
                  )}
                </td>
                {capo && (
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="mini"
                      onClick={async () => {
                        if (!confirm(`Rimuovere ${m.email} dalla squadra?`)) return;
                        try {
                          await api.rimuoviMembro(societa.id, m.user_id);
                          ricarica();
                        } catch (err) {
                          setMessaggio({ testo: err.message, errore: true });
                        }
                      }}
                    >
                      Rimuovi
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
