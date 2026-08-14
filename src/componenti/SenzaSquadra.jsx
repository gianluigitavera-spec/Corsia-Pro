import { useEffect, useState } from 'react';
import { KeyRound, Building2, ArrowLeft } from 'lucide-react';
import * as api from '../lib/dati';
import { ETICHETTA, BUILD } from '../lib/versione';

const ESITI = {
  inviata: (s) => `Richiesta inviata a ${s}. Ti apre il capo allenatore.`,
  gia_richiesta: (s) => `Hai già una richiesta in attesa per ${s}.`,
  gia_membro: (s) => `Fai già parte di ${s}. Ricarica la pagina.`,
  codice_sconosciuto: () => 'Codice non riconosciuto. Controlla le otto lettere.',
  non_autenticato: () => 'Sessione scaduta: esci e rientra.',
};

export default function SenzaSquadra({ email, ricarica }) {
  const [scelta, setScelta] = useState(null);      // null | 'codice' | 'crea'
  const [codice, setCodice] = useState('');
  const [nome, setNome] = useState('');
  const [citta, setCitta] = useState('');
  const [esito, setEsito] = useState(null);
  const [attesa, setAttesa] = useState(false);
  const [richieste, setRichieste] = useState([]);

  useEffect(() => { api.mieRichieste().then(setRichieste).catch(() => {}); }, [esito]);

  async function chiedi() {
    setAttesa(true); setEsito(null);
    try {
      const r = await api.chiediAccesso(codice);
      setEsito({
        testo: (ESITI[r.esito] || (() => r.esito))(r.societa),
        errore: ['codice_sconosciuto', 'non_autenticato'].includes(r.esito),
      });
      if (r.esito === 'inviata') setCodice('');
      if (r.esito === 'gia_membro') ricarica?.();
    } catch (e) { setEsito({ testo: e.message, errore: true }); }
    finally { setAttesa(false); }
  }

  async function crea() {
    setAttesa(true); setEsito(null);
    try {
      await api.creaSocieta(nome, citta);
      ricarica?.();
    } catch (e) {
      const m = e.message || '';
      setEsito({
        errore: true,
        testo: /fai già parte/i.test(m)
          ? 'Il tuo account è già in una squadra: ricarica la pagina. Per entrare in un\u2019altra serve il codice.'
          : m,
      });
    }
    finally { setAttesa(false); }
  }

  const inAttesa = richieste.filter((r) => r.stato === 'in_attesa');

  return (
    <div className="accesso">
      <div className="riquadro">
        <div className="marchio">Corsia<span>Pro</span></div>
        <p className="sotto versione-accesso" title={`build ${BUILD}`}>{ETICHETTA} · </p>
        <p className="sotto">Non fai ancora parte di una squadra.</p>

        {inAttesa.length > 0 ? (
          <div className="avviso">
            Richiesta in attesa. Quando il capo allenatore la approva, ricarica la pagina ed entri.
          </div>
        ) : !scelta ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="azione" onClick={() => setScelta('crea')}>
              <Building2 size={16} style={{ verticalAlign: -3, marginRight: 7 }} />
              Crea la tua squadra
            </button>
            <button className="azione fantasma" onClick={() => setScelta('codice')}>
              <KeyRound size={16} style={{ verticalAlign: -3, marginRight: 7 }} />
              Entra con un codice
            </button>
            <p style={{ fontSize: 13, color: 'var(--testo-3)', textAlign: 'center', marginBottom: 0 }}>
              Crei la squadra se sei il capo allenatore. Usi il codice se la squadra esiste già
              e te l'ha passato lui.
            </p>
          </div>
        ) : scelta === 'crea' ? (
          <>
            <div className="campo">
              <label>Nome della squadra</label>
              <input autoFocus value={nome} placeholder="es. Aquamore Acqua 13"
                onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="campo">
              <label>Città</label>
              <input value={citta} onChange={(e) => setCitta(e.target.value)} />
            </div>
            <button className="azione" onClick={crea} disabled={attesa || !nome.trim()}>
              {attesa ? 'Creo…' : 'Crea squadra'}
            </button>
            <p style={{ fontSize: 13, color: 'var(--testo-3)', marginTop: 12, marginBottom: 0 }}>
              Diventi capo allenatore e ricevi il codice da passare ai colleghi.
              Il resto dei dati (indirizzo, P.IVA) lo compili dopo, dalla scheda Squadra.
            </p>
          </>
        ) : (
          <>
            <div className="campo">
              <label>Codice squadra</label>
              <input autoFocus className="mono" placeholder="AQ13-7K2M" value={codice}
                autoCapitalize="characters"
                onChange={(e) => setCodice(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && codice && chiedi()} />
            </div>
            <button className="azione" onClick={chiedi} disabled={attesa || codice.length < 4}>
              {attesa ? 'Invio…' : 'Chiedi di entrare'}
            </button>
          </>
        )}

        {scelta && inAttesa.length === 0 && (
          <button className="mini" style={{ marginTop: 14 }} onClick={() => { setScelta(null); setEsito(null); }}>
            <ArrowLeft size={13} style={{ verticalAlign: -2 }} /> Indietro
          </button>
        )}

        {esito && (
          <div className={`avviso ${esito.errore ? 'errore' : ''}`} style={{ marginTop: 14 }}>{esito.testo}</div>
        )}

        <hr style={{ border: 0, borderTop: 'var(--riga)', margin: '22px 0 14px' }} />
        <p style={{ fontSize: 13, color: 'var(--testo-3)' }}>
          CorsiaPro è lo strumento degli allenatori. Se sei un atleta, i tuoi allenamenti
          sono su SwimCoach AI — stesso account, non serve registrarsi di nuovo.
        </p>
        <button className="mini" onClick={() => api.esci()}>Esci{email ? ` (${email})` : ''}</button>
      </div>
    </div>
  );
}
