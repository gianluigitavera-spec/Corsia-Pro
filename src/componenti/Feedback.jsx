import { useState } from 'react';
import { MessageSquare, X, Bug, Lightbulb, MessageCircle, Send, Check } from 'lucide-react';
import * as api from '../lib/dati';
import { VERSIONE } from '../versione';

const TIPI = [
  { id: 'problema', nome: 'Non funziona', Icona: Bug, tinta: 'var(--rosso)' },
  { id: 'idea', nome: 'Un\u2019idea', Icona: Lightbulb, tinta: 'var(--ambra)' },
  { id: 'altro', nome: 'Altro', Icona: MessageCircle, tinta: 'var(--ciano)' },
];

export default function Feedback({ scheda, societa }) {
  const [aperto, setAperto] = useState(false);
  const [tipo, setTipo] = useState('problema');
  const [testo, setTesto] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [fatto, setFatto] = useState(false);
  const [errore, setErrore] = useState(null);

  async function invia() {
    setAttesa(true);
    setErrore(null);
    try {
      await api.inviaFeedback({
        tipo, testo, versione: VERSIONE, contesto: scheda, societa: societa?.nome,
      });
      setFatto(true);
      setTesto('');
      setTimeout(() => { setAperto(false); setFatto(false); }, 1800);
    } catch (e) {
      setErrore(e.message.includes('relation') || e.message.includes('does not exist')
        ? 'La tabella dei feedback non esiste ancora: lancia la migrazione 019.'
        : e.message);
    } finally { setAttesa(false); }
  }

  if (!aperto) {
    return (
      <button className="tasto-feedback" onClick={() => setAperto(true)} title="Segnala un problema o un'idea">
        <MessageSquare size={16} />
        <span>Scrivimi</span>
      </button>
    );
  }

  return (
    <div className="velo-feedback" onClick={(e) => e.target === e.currentTarget && setAperto(false)}>
      <div className="riquadro-feedback" role="dialog" aria-label="Segnalazione">
        <div className="intestazione">
          <MessageSquare size={16} style={{ color: 'var(--ciano)' }} />
          <h3>Scrivi allo sviluppatore</h3>
          <div style={{ flex: 1 }} />
          <button className="mini" onClick={() => setAperto(false)} aria-label="Chiudi"><X size={14} /></button>
        </div>

        <div className="corpo">
          {fatto ? (
            <div className="vuoto" style={{ padding: '30px 20px' }}>
              <Check size={30} style={{ color: 'var(--menta)' }} />
              <h3 style={{ marginTop: 10 }}>Arrivato</h3>
              <p>Grazie: le segnalazioni servono più di quanto sembri.</p>
            </div>
          ) : (
            <>
              <div className="destinatari" style={{ marginBottom: 12 }}>
                {TIPI.map(({ id, nome, Icona, tinta }) => (
                  <button
                    key={id}
                    className="pastiglia"
                    aria-pressed={tipo === id}
                    style={tipo === id ? { borderColor: tinta, color: tinta, background: `${tinta}1f` } : undefined}
                    onClick={() => setTipo(id)}
                  >
                    <Icona size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{nome}
                  </button>
                ))}
              </div>

              <textarea
                rows={6}
                autoFocus
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder={tipo === 'problema'
                  ? 'Cosa stavi facendo e cosa è successo? Anche poche parole vanno bene.'
                  : tipo === 'idea'
                  ? 'Cosa ti servirebbe? Scrivilo come lo diresti a voce.'
                  : 'Dimmi pure.'}
              />

              <p style={{ fontSize: 12, color: 'var(--testo-3)', margin: '8px 0 0' }}>
                Parte anche la versione dell'app ({VERSIONE}), la schermata in cui sei e il tipo di
                dispositivo: servono a capire il problema senza doverti chiedere altro.
              </p>

              {errore && <div className="avviso errore" style={{ marginTop: 12 }}>{errore}</div>}

              <button
                className="azione"
                style={{ width: '100%', marginTop: 14 }}
                onClick={invia}
                disabled={attesa || testo.trim().length < 5}
              >
                <Send size={15} style={{ verticalAlign: -3 }} /> {attesa ? 'Invio…' : 'Invia'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
