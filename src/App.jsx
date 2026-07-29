import { useEffect, useState } from 'react';
import { sb, configurato } from './lib/supabase';
import * as api from './lib/dati';
import { stagioneCorrente } from './lib/dominio';
import Accesso from './componenti/Accesso';
import Atleti from './componenti/Atleti';
import EditorSeduta from './componenti/EditorSeduta';
import Appello from './componenti/Appello';
import Volumi from './componenti/Volumi';
import Squadra from './componenti/Squadra';
import SenzaSquadra from './componenti/SenzaSquadra';

const SCHEDE = [
  { id: 'sedute', nome: 'Sedute' },
  { id: 'appello', nome: 'Appello' },
  { id: 'atleti', nome: 'Atleti' },
  { id: 'volumi', nome: 'Volumi' },
  { id: 'squadra', nome: 'Squadra' },
];

export default function App() {
  const [sessione, setSessione] = useState(undefined); // undefined = sto controllando
  const [societa, setSocieta] = useState(null);
  const [ruolo, setRuolo] = useState(null);
  const [scheda, setScheda] = useState('sedute');
  const [zone, setZone] = useState([]);
  const [fasce, setFasce] = useState([]);
  const [errore, setErrore] = useState(null);
  const [senzaSquadra, setSenzaSquadra] = useState(false);

  const stagione = stagioneCorrente();

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSessione(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessione) return;
    (async () => {
      try {
        const [membri, z, f] = await Promise.all([
          api.mieSocieta(),
          api.leggiZone(),
          api.leggiFasce(stagione),
        ]);
        setZone(z);
        setFasce(f);
        const primo = membri?.[0];
        if (!primo?.societa) {
          setSenzaSquadra(true);
          return;
        }
        setSenzaSquadra(false);
        setSocieta(primo.societa);
        setRuolo(primo.ruolo);
      } catch (e) {
        setErrore(e.message);
      }
    })();
  }, [sessione, stagione]);

  if (!configurato) {
    return (
      <div className="accesso">
        <div className="riquadro">
          <div className="marchio">Corsia<span>Pro</span></div>
          <p className="sotto">Manca la configurazione.</p>
          <div className="avviso">
            Copia <span className="mono">.env.example</span> in <span className="mono">.env</span> e riempi
            VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Supabase → Project Settings → API), poi riavvia
            <span className="mono"> npm run dev</span>.
          </div>
        </div>
      </div>
    );
  }

  if (sessione === undefined) return null;
  if (!sessione) return <Accesso />;
  if (senzaSquadra) return <SenzaSquadra email={sessione.user?.email} />;

  const puoScrivere = ruolo === 'coach' || ruolo === 'collega';

  return (
    <div className="guscio">
      <header className="testata">
        <div className="marchio">
          Corsia<span>Pro</span>
        </div>
        <div className="societa">
          {societa ? `${societa.nome} · stagione ${stagione}` : '…'}
        </div>
        <div className="spazio" />
        <button className="mini" onClick={() => api.esci()}>
          Esci
        </button>
      </header>

      <nav className="nav">
        {SCHEDE.map((s) => (
          <button
            key={s.id}
            aria-current={scheda === s.id}
            onClick={() => setScheda(s.id)}
          >
            {s.nome}
          </button>
        ))}
      </nav>

      {errore && (
        <div className="sezione avviso errore">{errore}</div>
      )}

      {societa && (
        <main className="sezione">
          {scheda === 'sedute' && (
            <EditorSeduta societa={societa} zone={zone} puoScrivere={puoScrivere} />
          )}
          {scheda === 'appello' && <Appello societa={societa} />}
          {scheda === 'atleti' && (
            <Atleti societa={societa} fasce={fasce} stagione={stagione} puoScrivere={puoScrivere} />
          )}
          {scheda === 'volumi' && <Volumi societa={societa} zone={zone} />}
          {scheda === 'squadra' && <Squadra societa={societa} ruolo={ruolo} />}
        </main>
      )}
    </div>
  );
}
