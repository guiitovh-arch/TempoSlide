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

export const userName = (u) => u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || '';
export const userAvatar = (u) => u?.user_metadata?.avatar_url || u?.user_metadata?.picture || null;
export const userProvider = (u) => u?.app_metadata?.provider || 'email'; // 'google' | 'email'
export const userPrefs = (u) => ({ defaultMinutes: 10, ...(u?.user_metadata?.prefs || {}) });

// ponytail: plan fijo mientras la beta es gratis. Con pagos, leer el plan de una tabla que solo escriba el servidor
// (webhook de Stripe), nunca de user_metadata, que el propio usuario puede modificar.
export const PLAN = { key: 'beta', badge: 'BETA', name: 'Beta · todo incluido' };
