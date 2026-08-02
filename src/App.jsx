import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Waves, ClipboardCheck, HeartPulse, Users, BarChart3, Dumbbell, Settings2, LogOut, HelpCircle } from 'lucide-react';
import { sb, configurato } from './lib/supabase';
import * as api from './lib/dati';
import { stagioneCorrente, stagioniProposte, fasceRisolte } from './lib/dominio';
import { VERSIONE, CAMBIAMENTI } from './versione';
import { BUILD } from './lib/versione';
import Accesso from './componenti/Accesso';
import Atleti from './componenti/Atleti';
import EditorSeduta from './componenti/EditorSeduta';
import Appello from './componenti/Appello';
import Volumi from './componenti/Volumi';
import Dashboard from './componenti/Dashboard';
import Benessere from './componenti/Benessere';
import Squadra from './componenti/Squadra';
import Esercizi from './componenti/Esercizi';
import Feedback from './componenti/Feedback';
import SenzaSquadra from './componenti/SenzaSquadra';
import Tutorial from './componenti/Tutorial';

const SCHEDE = [
  { id: 'dashboard', nome: 'Dashboard', Icona: LayoutDashboard },
  { id: 'sedute', nome: 'Sedute', Icona: Waves },
  { id: 'appello', nome: 'Appello', Icona: ClipboardCheck },
  { id: 'benessere', nome: 'Benessere', Icona: HeartPulse },
  { id: 'atleti', nome: 'Atleti', Icona: Users },
  { id: 'volumi', nome: 'Carico atleti', Icona: BarChart3 },
  { id: 'esercizi', nome: 'Esercizi', Icona: Dumbbell },
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
  const [proiezione, setProiezione] = useState(null);
  const [stagioni, setStagioni] = useState([]);
  const [errore, setErrore] = useState(null);
  const [senzaSquadra, setSenzaSquadra] = useState(false);
  const [apertura, setApertura] = useState(null); // {id} oppure {data}
  const [registro, setRegistro] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [ricarica, setRicarica] = useState(0);

  const [stagione, setStagione] = useState(stagioneCorrente());

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSessione(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessione) return;
    (async () => {
      try {
        const [membri, z, c, f, st] = await Promise.all([
          api.mieSocieta(), api.leggiZone(), api.leggiCategorie(),
          api.leggiFasce(), api.leggiStagioni(),
        ]);
        setZone(z); setCategorie(c);
        const risolte = fasceRisolte(f, stagione);
        setFasce(risolte.fasce);
        setProiezione(risolte.proiettata ? risolte : null);
        setStagioni(stagioniProposte(st, stagioneCorrente()));
        const primo = membri?.[0];
        if (!primo?.societa) { setSenzaSquadra(true); return; }
        setSenzaSquadra(false);
        setSocieta(primo.societa);
        setRuolo(primo.ruolo);
      } catch (e) { setErrore(e.message); }
    })();
  }, [sessione, stagione, ricarica]);

  // Alla prima visita il tutorial parte da solo; poi solo se lo richiami.
  useEffect(() => {
    if (!societa) return;
    try {
      if (localStorage.getItem('corsiapro:tutorial') !== 'visto') setTutorial(true);
    } catch { /* navigazione privata: pazienza, non parte */ }
  }, [societa?.id]);

  const chiudiTutorial = useCallback((nonPiu) => {
    setTutorial(false);
    if (nonPiu) {
      try { localStorage.setItem('corsiapro:tutorial', 'visto'); } catch { /* niente */ }
    }
  }, []);

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
  if (senzaSquadra) return <SenzaSquadra email={sessione.user?.email} ricarica={() => setRicarica((n) => n + 1)} />;

  const puoScrivere = ruolo === 'coach' || ruolo === 'collega';

  return (
    <div className="guscio">
      <header className="testata">
        <div className="riga-testata">
          <div className="marchio">
            <img src="/marchio.svg" alt="" className="segno" />
            Corsia<span>Pro</span>
          </div>
          <button
            className="versione"
            onClick={() => setRegistro(true)}
            title={`Cosa è cambiato · build ${BUILD}`}
          >
            v{VERSIONE}
          </button>
          <div className="spazio" />
          <Feedback scheda={scheda} societa={societa} />
          <button className="mini" onClick={() => setTutorial(true)} title="Rivedi il tutorial" aria-label="Tutorial">
            <HelpCircle size={15} />
          </button>
          <button className="mini" onClick={() => api.esci()} title="Esci" aria-label="Esci">
            <LogOut size={14} />
          </button>
        </div>

        <div className="riga-testata secondaria">
          {societa && <div className="societa">{societa.nome}</div>}
          <div className="spazio" />
          <select
            value={stagione}
            onChange={(e) => setStagione(e.target.value)}
            aria-label="Stagione"
            className="scelta-stagione"
          >
            {stagioni.map((x) => <option key={x} value={x}>Stagione {x}</option>)}
          </select>
        </div>
      </header>

      <nav className="nav">
        {SCHEDE.map(({ id, nome, Icona }) => (
          <button key={id} aria-current={scheda === id} onClick={() => setScheda(id)}>
            <Icona size={15} style={{ verticalAlign: -3, marginRight: 7 }} />{nome}
          </button>
        ))}
      </nav>

      {errore && <div className="sezione avviso errore">{errore}</div>}

      {tutorial && societa && (
        <Tutorial vaiA={setScheda} chiudi={chiudiTutorial} />
      )}

      {registro && (
        <div className="registro" role="dialog" aria-label="Registro dei cambiamenti">
          <div className="registro-riquadro">
            <div className="intestazione">
              <h3>Cosa è cambiato</h3>
              <div style={{ flex: 1 }} />
              <button className="mini" onClick={() => setRegistro(false)}>Chiudi</button>
            </div>
            <div className="corpo">
              {CAMBIAMENTI.map((c) => (
                <div key={c.versione} className="voce-registro">
                  <div className="riga-versione">
                    <span className="mono numero-versione">v{c.versione}</span>
                    <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 12 }}>{c.data}</span>
                    {c.versione === VERSIONE && <span className="attuale">in uso</span>}
                  </div>
                  <ul>{c.voci.map((v, i) => <li key={i}>{v}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {societa && (
        <main className="sezione">
          {scheda === 'dashboard' && (
            <Dashboard societa={societa} zone={zone} categorie={categorie} stagione={stagione}
              puoScrivere={puoScrivere} apriSeduta={apriSeduta} />
          )}
          {scheda === 'sedute' && (
            <EditorSeduta
              societa={societa} zone={zone} categorie={categorie} puoScrivere={puoScrivere}
              apertura={apertura} consumaApertura={consumaApertura}
            />
          )}
          {scheda === 'appello' && <Appello societa={societa} fasce={fasce} puoScrivere={puoScrivere} />}
          {scheda === 'benessere' && <Benessere societa={societa} fasce={fasce} puoScrivere={puoScrivere} />}
          {scheda === 'atleti' && (
            <Atleti societa={societa} fasce={fasce} stagione={stagione}
              proiezione={proiezione} puoScrivere={puoScrivere} />
          )}
          {scheda === 'volumi' && <Volumi societa={societa} stagione={stagione} />}
          {scheda === 'esercizi' && <Esercizi societa={societa} puoScrivere={puoScrivere} />}
          {scheda === 'squadra' && (
            <Squadra societa={societa} ruolo={ruolo} ricaricaSocieta={() => setRicarica((n) => n + 1)} />
          )}
        </main>
      )}
    </div>
  );
}
