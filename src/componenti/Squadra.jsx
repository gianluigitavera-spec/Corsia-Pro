import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Check, Users, KeyRound, UserPlus, Save, Building2 } from 'lucide-react';
import * as api from '../lib/dati';
import { dataIt } from '../lib/dominio';

const NOME_RUOLO = { coach: 'Capo allenatore', collega: 'Allenatore', lettore: 'Solo lettura' };

const CAMPI = [
  ['nome', 'Nome squadra', 'text'],
  ['codice_fin', 'Codice FIN', 'text'],
  ['indirizzo', 'Indirizzo', 'text'],
  ['cap', 'CAP', 'text'],
  ['citta', 'Città', 'text'],
  ['provincia', 'Provincia', 'text'],
  ['piva', 'Partita IVA', 'text'],
  ['codice_fiscale', 'Codice fiscale', 'text'],
  ['email', 'Email', 'email'],
  ['telefono', 'Telefono', 'tel'],
  ['sito', 'Sito', 'text'],
];

export default function Squadra({ societa, ruolo, ricaricaSocieta }) {
  const [dati, setDati] = useState(null);
  const [bozza, setBozza] = useState(null);
  const [richieste, setRichieste] = useState([]);
  const [membri, setMembri] = useState([]);
  const [messaggio, setMessaggio] = useState(null);
  const [copiato, setCopiato] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const capo = ruolo === 'coach';

  useEffect(() => { ricarica(); }, [societa.id]);

  async function ricarica() {
    // Ogni chiamata per conto suo: se lo staff non si carica, l'anagrafica
    // deve comparire comunque invece di lasciare la pagina bianca.
    try {
      const s = await api.leggiSocieta(societa.id);
      setDati(s); setBozza(s);
    } catch (e) {
      setMessaggio({ testo: `Dati squadra: ${e.message}`, errore: true });
    }
    try {
      setMembri(await api.elencoMembri(societa.id));
    } catch (e) {
      setMembri([]);
      setMessaggio({ testo: `Elenco staff non disponibile: ${e.message}`, errore: true });
    }
    if (capo) {
      try { setRichieste(await api.richiesteDaDecidere(societa.id)); }
      catch { setRichieste([]); }
    }
  }

  async function salva() {
    setSalvo(true);
    try {
      const campi = {};
      CAMPI.forEach(([k]) => { campi[k] = bozza[k]?.trim?.() || bozza[k] || null; });
      campi.note = bozza.note || null;
      await api.aggiornaSocieta(societa.id, campi);
      setMessaggio({ testo: 'Dati della squadra salvati.' });
      await ricarica();
      ricaricaSocieta?.();
    } catch (e) { setMessaggio({ testo: e.message, errore: true }); }
    finally { setSalvo(false); }
  }

  async function copiaCodice() {
    try {
      await navigator.clipboard.writeText(dati.codice_invito);
      setCopiato(true); setTimeout(() => setCopiato(false), 2000);
    } catch { setMessaggio({ testo: 'Copia non riuscita: seleziona il codice a mano.', errore: true }); }
  }

  async function decidi(id, approva) {
    try {
      await api.decidiRichiesta(id, approva);
      setMessaggio({ testo: approva ? 'Allenatore aggiunto alla squadra.' : 'Richiesta rifiutata.' });
      ricarica();
    } catch (e) { setMessaggio({ testo: e.message, errore: true }); }
  }

  if (!dati) {
    return (
      <>
        <div className="barra"><h1>Squadra</h1></div>
        <div className={`avviso ${messaggio?.errore ? 'errore' : ''}`}>
          {messaggio?.testo || 'Sto caricando i dati della squadra…'}
        </div>
      </>
    );
  }

  const modificato = CAMPI.some(([k]) => (bozza?.[k] || '') !== (dati?.[k] || '')) || (bozza?.note || '') !== (dati?.note || '');

  return (
    <>
      <div className="barra"><h1>Squadra</h1></div>

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
              <span className="mono" style={{ fontSize: 30, letterSpacing: '0.08em', color: 'var(--ciano)' }}>
                {dati.codice_invito}
              </span>
              <button className="mini" onClick={copiaCodice}>
                {copiato ? <Check size={14} /> : <Copy size={14} />} {copiato ? 'Copiato' : 'Copia'}
              </button>
              <button className="mini" onClick={async () => {
                if (!confirm('Il codice vecchio smette di funzionare. Procedo?')) return;
                try { await api.rigeneraCodice(societa.id); ricarica(); }
                catch (e) { setMessaggio({ testo: e.message, errore: true }); }
              }}>
                <RefreshCw size={13} style={{ verticalAlign: -2 }} /> Rigenera
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--testo-3)', marginBottom: 0 }}>
              Chi ha il codice può chiedere di entrare; chi non l'ha non trova la squadra.
              Rigeneralo quando ha girato troppo.
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
            <div className="corpo" style={{ color: 'var(--testo-3)', fontSize: 14 }}>Nessuna richiesta da valutare.</div>
          ) : (
            <table><tbody>
              {richieste.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.email}</b></td>
                  <td className="mono" style={{ color: 'var(--testo-3)' }}>{dataIt(String(r.created_at).slice(0, 10))}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="mini" onClick={() => decidi(r.id, false)}>Rifiuta</button>{' '}
                    <button className="azione" style={{ padding: '7px 13px', minHeight: 34 }} onClick={() => decidi(r.id, true)}>Approva</button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}

      {/* ------------------------------------------- anagrafica società */}
      <div className="scheda" style={{ marginTop: 12 }}>
        <div className="intestazione">
          <Building2 size={16} style={{ color: 'var(--testo-2)' }} />
          <h3>Dati della squadra</h3>
          <div style={{ flex: 1 }} />
          {capo && (
            <button className="azione" onClick={salva} disabled={!modificato || salvo}>
              <Save size={15} style={{ verticalAlign: -3 }} /> {salvo ? 'Salvo…' : 'Salva'}
            </button>
          )}
        </div>
        <div className="corpo" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {CAMPI.map(([chiave, etichetta, tipo]) => (
            <div className="campo" key={chiave}>
              <label>{etichetta}</label>
              <input
                type={tipo}
                value={bozza?.[chiave] || ''}
                disabled={!capo}
                onChange={(e) => setBozza({ ...bozza, [chiave]: e.target.value })}
              />
            </div>
          ))}
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label>Note</label>
            <textarea
              rows={3}
              value={bozza?.note || ''}
              disabled={!capo}
              onChange={(e) => setBozza({ ...bozza, note: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="scheda" style={{ marginTop: 12 }}>
        <div className="intestazione">
          <Users size={16} style={{ color: 'var(--testo-2)' }} />
          <h3>Staff</h3>
          <span className="mono" style={{ color: 'var(--testo-3)' }}>{membri.length}</span>
        </div>
        <table>
          <thead><tr><th>Allenatore</th><th>Ruolo</th>{capo && <th />}</tr></thead>
          <tbody>
            {membri.map((m) => (
              <tr key={m.user_id}>
                <td>{m.email}</td>
                <td>
                  {capo ? (
                    <select value={m.ruolo} style={{ minHeight: 34, padding: '4px 8px' }}
                      onChange={async (e) => {
                        try { await api.impostaRuolo(societa.id, m.user_id, e.target.value); ricarica(); }
                        catch (err) { setMessaggio({ testo: err.message, errore: true }); }
                      }}>
                      {Object.entries(NOME_RUOLO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : NOME_RUOLO[m.ruolo]}
                </td>
                {capo && (
                  <td style={{ textAlign: 'right' }}>
                    <button className="mini" onClick={async () => {
                      if (!confirm(`Rimuovere ${m.email} dalla squadra?`)) return;
                      try { await api.rimuoviMembro(societa.id, m.user_id); ricarica(); }
                      catch (err) { setMessaggio({ testo: err.message, errore: true }); }
                    }}>Rimuovi</button>
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
