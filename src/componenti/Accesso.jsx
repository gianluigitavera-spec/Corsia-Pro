import { useState } from 'react';
import { LogIn, UserPlus, Mail } from 'lucide-react';
import * as api from '../lib/dati';
import { ETICHETTA, BUILD } from '../lib/versione';

export default function Accesso() {
  const [modo, setModo] = useState('entra');   // entra | registra
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [messaggio, setMessaggio] = useState(null);
  const [attesa, setAttesa] = useState(false);

  const registrazione = modo === 'registra';

  async function invia() {
    setMessaggio(null);
    setAttesa(true);
    try {
      if (registrazione) {
        const r = await api.registrati(email.trim(), password);
        if (r?.session) return;              // accesso immediato: ci pensa App
        setMessaggio({
          testo: 'Account creato. Controlla la posta e conferma l\u2019indirizzo, poi entra.',
        });
        setModo('entra');
      } else {
        await api.entra(email.trim(), password);
      }
    } catch (e) {
      const m = e.message || '';
      setMessaggio({
        errore: true,
        testo: /invalid login/i.test(m) ? 'Email o password non corrispondono.'
          : /already registered|already been/i.test(m) ? 'Questa email ha gi\u00e0 un account: entra invece di registrarti.'
          : /password/i.test(m) && /6/.test(m) ? 'La password deve avere almeno 6 caratteri.'
          : m,
      });
    } finally { setAttesa(false); }
  }

  return (
    <div className="accesso">
      <div className="riquadro">
        <div className="marchio">Corsia<span>Pro</span></div>
        <p className="sotto versione-accesso" title={`build ${BUILD}`}>{ETICHETTA} · </p>
        <p className="sotto">Il registro della squadra, a bordo vasca.</p>

        <div className="nav" style={{ marginBottom: 20 }}>
          <button style={{ flex: 1 }} aria-current={!registrazione} onClick={() => setModo('entra')}>
            <LogIn size={15} style={{ verticalAlign: -3, marginRight: 6 }} />Entra
          </button>
          <button style={{ flex: 1 }} aria-current={registrazione} onClick={() => setModo('registra')}>
            <UserPlus size={15} style={{ verticalAlign: -3, marginRight: 6 }} />Registrati
          </button>
        </div>

        <div className="campo">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invia()} />
        </div>
        <div className="campo">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password}
            autoComplete={registrazione ? 'new-password' : 'current-password'}
            placeholder={registrazione ? 'almeno 6 caratteri' : ''}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invia()} />
        </div>

        {messaggio && (
          <div className={`avviso ${messaggio.errore ? 'errore' : ''}`} style={{ marginTop: 14 }}>
            {!messaggio.errore && <Mail size={15} style={{ verticalAlign: -3, marginRight: 6 }} />}
            {messaggio.testo}
          </div>
        )}

        <button className="azione" onClick={invia} disabled={attesa || !email || !password}>
          {attesa ? 'Un attimo…' : registrazione ? 'Crea account' : 'Entra'}
        </button>

        <p className="sotto" style={{ marginTop: 18, marginBottom: 0, fontSize: 13 }}>
          L'account è lo stesso di SwimCoach AI: se ne hai già uno, entra con quello.
        </p>
      </div>
    </div>
  );
}
