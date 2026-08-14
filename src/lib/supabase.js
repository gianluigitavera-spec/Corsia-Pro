import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chiave = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Se manca la configurazione l'app non deve morire di schermata bianca:
// App.jsx mostra le istruzioni.
export const configurato = Boolean(url && chiave);

// Lo schema non è "public": va dichiarato qui e va esposto nel dashboard
// (Project Settings → Data API → Exposed schemas).
export const sb = createClient(url || 'https://non-configurato.supabase.co', chiave || 'chiave-mancante', {
  db: { schema: 'squadra' },
  auth: { persistSession: true, autoRefreshToken: true },
});

// Per leggere le tabelle di SwimCoach AI, che stanno in public.
export const sbPublic = () => sb.schema('public');
