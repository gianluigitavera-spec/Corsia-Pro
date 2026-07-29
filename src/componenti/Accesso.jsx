import { useState } from 'react';
import * as api from '../lib/dati';

export default function Accesso() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState(null);
  const [attesa, setAttesa] = useState(false);

  async function invia() {
    setErrore(null);
    setAttesa(true);
    try {
      await api.entra(email.trim(), password);
    } catch (e) {
      setErrore(
        e.message.includes('Invalid login')
          ? 'Email o password non corrispondono.'
          : e.message
      );
    } finally {
      setAttesa(false);
    }
  }

  return (
    <div className="accesso">
      <div className="riquadro">
        <div className="marchio">
          Corsia<span>Pro</span>
        </div>
        <p className="sotto">Il registro della squadra, a bordo vasca.</p>

        <div className="campo">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invia()}
          />
        </div>
        <div className="campo">
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invia()}
          />
        </div>

        {errore && <div className="avviso errore" style={{ marginTop: 14 }}>{errore}</div>}

        <button className="azione" onClick={invia} disabled={attesa || !email || !password}>
          {attesa ? 'Entro…' : 'Entra'}
        </button>
      </div>
    </div>
  );
}
