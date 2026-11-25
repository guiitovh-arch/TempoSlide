// Cliente Supabase configurado en tiempo de ejecución (/api/config), así la misma imagen sirve con o sin cuentas.
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

let pending;
export const supabase = () =>
  (pending ??= fetch('/api/config')
    .then((r) => r.json())
    .then((c) => (c.supabaseUrl && c.supabaseAnonKey ? createClient(c.supabaseUrl, c.supabaseAnonKey) : null))
    .catch(() => null));

export const currentUser = async () => {
  const sb = await supabase();
  return sb ? (await sb.auth.getSession()).data.session?.user ?? null : null;
};

// { ready, enabled, user }
export function useAuth() {
  const [s, setS] = useState({ ready: false, enabled: false, user: null });
  useEffect(() => {
    let sub;
    supabase().then(async (sb) => {
      if (!sb) return setS({ ready: true, enabled: false, user: null });
      const { data } = await sb.auth.getSession();
      setS({ ready: true, enabled: true, user: data.session?.user ?? null });
      sub = sb.auth.onAuthStateChange((_e, session) => setS({ ready: true, enabled: true, user: session?.user ?? null })).data.subscription;
    });
    return () => sub?.unsubscribe();
  }, []);
  return s;
}
