// =====================================================================
// LA SPIA DELLA LINEA
//
// È la parte che decide se ti fidi. Se non vedi che quello che hai
// segnato è partito, a bordo vasca continui a tenere il foglio in mano
// e l'app tanto valeva non farla. Quindi: quando tutto è a posto non
// compare niente, e appena qualcosa resta indietro lo dice e lo conta.
// Toccandola riprova subito, senza aspettare che torni la linea da sé.
// =====================================================================
import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import * as api from '../lib/dati';

export default function StatoLinea() {
  const [stato, setStato] = useState({ senzaLinea: false, daInviare: 0 });
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    const stacca = api.osservaLinea(setStato);

    // Tre modi di riprovare: quando il sistema dice che è tornata la
    // linea, quando torni sull'app dopo averla lasciata, e comunque
    // ogni mezzo minuto finché c'è roba ferma in coda.
    const riprova = () => api.sincronizza().catch(() => {});
    const alRitorno = () => { if (!document.hidden) riprova(); };

    window.addEventListener('online', riprova);
    document.addEventListener('visibilitychange', alRitorno);
    const battito = setInterval(() => { if (api.coda().length) riprova(); }, 30000);
    riprova();

    return () => {
      stacca();
      window.removeEventListener('online', riprova);
      document.removeEventListener('visibilitychange', alRitorno);
      clearInterval(battito);
    };
  }, []);

  async function ora() {
    setInCorso(true);
    try { await api.sincronizza(); } catch { /* resta in coda */ }
    finally { setInCorso(false); }
  }

  if (!stato.daInviare && !stato.senzaLinea) return null;

  const fermi = stato.daInviare > 0;
  return (
    <button
      className="mini"
      onClick={ora}
      disabled={inCorso}
      style={{ color: fermi ? 'var(--ambra)' : 'var(--testo-3)' }}
      title={fermi
        ? `${stato.daInviare} da inviare. Sono al sicuro sul telefono: tocca per riprovare adesso.`
        : 'Senza linea. Quello che segni resta sul telefono e parte da solo appena torna.'}
    >
      {inCorso
        ? <RefreshCw size={14} className="gira" style={{ verticalAlign: -2 }} />
        : <CloudOff size={14} style={{ verticalAlign: -2 }} />}
      {fermi ? ` ${stato.daInviare} da inviare` : ' senza linea'}
    </button>
  );
}
