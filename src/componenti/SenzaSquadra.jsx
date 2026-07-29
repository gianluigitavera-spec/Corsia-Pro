import { useEffect, useState } from 'react';
import * as api from '../lib/dati';

const MESSAGGI = {
  inviata: (s) => `Richiesta inviata a ${s}. Ti apre il capo allenatore.`,
  gia_richiesta: (s) => `Hai già una richiesta in attesa per ${s}.`,
  gia_membro: (s) => `Fai già parte di ${s}. Ricarica la pagina.`,
  codice_sconosciuto: () => 'Codice non riconosciuto. Controlla le otto lettere.',
  non_autenticato: () => 'Sessione scaduta: esci e rientra.',
};

export default function SenzaSquadra({ email }) {
  const [codice, setCodice] = useState('');
  const [esito, setEsito] = useState(null);
  const [attesa, setAttesa] = useState(false);
  const [richieste, setRichieste] = useState([]);

  useEffect(() => {
    api.mieRichieste().then(setRichieste).catch(() => {});
  }, [esito]);

  async function invia() {
    setAttesa(true);
    setEsito(null);
    try {
      const r = await api.chiediAccesso(codice);
      setEsito({
        testo: (MESSAGGI[r.esito] || (() => r.esito))(r.societa),
        errore: r.esito === 'codice_sconosciuto' || r.esito === 'non_autenticato',
      });
      if (r.esito === 'inviata') setCodice('');
    } catch (e) {
      setEsito({ testo: e.message, errore: true });
    } finally {
      setAttesa(false);
    }
  }

  const inAttesa = richieste.filter((r) => r.stato === 'in_attesa');

  return (
    <div className="accesso">
      <div className="riquadro">
        <div className="marchio">Corsia<span>Pro</span></div>
        <p className="sotto">Non fai ancora parte di una squadra.</p>

        {inAttesa.length > 0 ? (
          <div className="avviso">
            Richiesta in attesa. Quando il capo allenatore la approva, ricarica la pagina ed entri.
          </div>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="cod">Codice squadra</label>
              <input
                id="cod"
                className="mono"
                placeholder="AQ13-7K2M"
                value={codice}
                autoCapitalize="characters"
                onChange={(e) => setCodice(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && codice && invia()}
              />
            </div>
            <p style={{ fontSize: 13, color: 'var(--inchiostro-2)', marginTop: 8 }}>
              Il codice te lo dà il capo allenatore della squadra.
            </p>
            <button className="azione" onClick={invia} disabled={attesa || codice.length < 4}>
              {attesa ? 'Invio…' : 'Chiedi di entrare'}
            </button>
          </>
        )}

        {esito && (
          <div className={`avviso ${esito.errore ? 'errore' : ''}`} style={{ marginTop: 14 }}>
            {esito.testo}
          </div>
        )}

        <hr style={{ border: 0, borderTop: 'var(--riga)', margin: '24px 0 16px' }} />

        <p style={{ fontSize: 13, color: 'var(--inchiostro-2)' }}>
          CorsiaPro è lo strumento degli allenatori: anagrafica, presenze e volumi della squadra.
          Se sei un atleta, i tuoi allenamenti sono su SwimCoach AI — stesso account, non serve
          registrarsi di nuovo.
        </p>

        <button className="mini" style={{ marginTop: 14 }} onClick={() => api.esci()}>
          Esci{email ? ` (${email})` : ''}
        </button>
      </div>
    </div>
  );
}
