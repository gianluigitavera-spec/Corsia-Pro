import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Waves, ClipboardCheck, Users, BarChart3, Settings2, LogOut } from 'lucide-react';
import { sb, configurato } from './lib/supabase';
import * as api from './lib/dati';
import { stagioneCorrente } from './lib/dominio';
import Accesso from './componenti/Accesso';
import Atleti from './componenti/Atleti';
import EditorSeduta from './componenti/EditorSeduta';
import Appello from './componenti/Appello';
import Volumi from './componenti/Volumi';
import Dashboard from './componenti/Dashboard';
import Squadra from './componenti/Squadra';
import SenzaSquadra from './componenti/SenzaSquadra';

const SCHEDE = [
  { id: 'dashboard', nome: 'Dashboard', Icona: LayoutDashboard },
  { id: 'sedute', nome: 'Sedute', Icona: Waves },
  { id: 'appello', nome: 'Appello', Icona: ClipboardCheck },
  { id: 'atleti', nome: 'Atleti', Icona: Users },
  { id: 'volumi', nome: 'Carico atleti', Icona: BarChart3 },
  { id: 'squadra', nome: 'Squadra', Icona: Settings2 },
];

export default function App() {
  const [sessione, setSessione] = useState(undefined);
  const [societa, setSocieta] = useState(null);
  const [ruolo, setRuolo] = useState(null);
  const [scheda, setScheda] = useState('dashboard');
  const [zone, setZone] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [fasce, setFasce] = useState([]);
  const [gruppi, setGruppi] = useState([]);
  const [errore, setErrore] = useState(null);
  const [senzaSquadra, setSenzaSquadra] = useState(false);
  const [apertura, setApertura] = useState(null); // {id} oppure {data}

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
        const [membri, z, c, f] = await Promise.all([
          api.mieSocieta(), api.leggiZone(), api.leggiCategorie(), api.leggiFasce(stagione),
        ]);
        setZone(z); setCategorie(c); setFasce(f);
        const primo = membri?.[0];
        if (!primo?.societa) { setSenzaSquadra(true); return; }
        setSenzaSquadra(false);
        setSocieta(primo.societa);
        setRuolo(primo.ruolo);
        setGruppi(await api.leggiGruppi(primo.societa.id));
      } catch (e) { setErrore(e.message); }
    })();
  }, [sessione, stagione]);

  // Dal calendario all'editor, con la data del giorno cliccato.
  const apriSeduta = useCallback((id, data) => {
    setApertura(id ? { id } : { data });
    setScheda('sedute');
  }, []);
  const consumaApertura = useCallback(() => setApertura(null), []);

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
        <div className="marchio">Corsia<span>Pro</span></div>
        {societa && <div className="societa">{societa.nome} · {stagione}</div>}
        <div className="spazio" />
        <button className="mini" onClick={() => api.esci()}>
          <LogOut size={14} style={{ verticalAlign: -2 }} /> Esci
        </button>
      </header>

      <nav className="nav">
        {SCHEDE.map(({ id, nome, Icona }) => (
          <button key={id} aria-current={scheda === id} onClick={() => setScheda(id)}>
            <Icona size={15} style={{ verticalAlign: -3, marginRight: 7 }} />{nome}
          </button>
        ))}
      </nav>

      {errore && <div className="sezione avviso errore">{errore}</div>}

      {societa && (
        <main className="sezione">
          {scheda === 'dashboard' && (
            <Dashboard societa={societa} zone={zone} puoScrivere={puoScrivere} apriSeduta={apriSeduta} />
          )}
          {scheda === 'sedute' && (
            <EditorSeduta
              societa={societa} zone={zone} categorie={categorie} puoScrivere={puoScrivere}
              apertura={apertura} consumaApertura={consumaApertura}
            />
          )}
          {scheda === 'appello' && <Appello societa={societa} />}
          {scheda === 'atleti' && (
            <Atleti societa={societa} fasce={fasce} stagione={stagione} puoScrivere={puoScrivere} gruppi={gruppi} />
          )}
          {scheda === 'volumi' && <Volumi societa={societa} zone={zone} />}
          {scheda === 'squadra' && (
            <Squadra societa={societa} ruolo={ruolo} gruppi={gruppi} ricaricaGruppi={async () => setGruppi(await api.leggiGruppi(societa.id))} />
          )}
        </main>
      )}
    </div>
  );
}
