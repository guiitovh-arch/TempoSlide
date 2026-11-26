import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase, useAuth } from './supabase.js';
import { Logo, ThemeToggle } from './Landing.jsx';

export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState(''); // '', 'sending', 'sent', error text
  const [googleOn, setGoogleOn] = useState(false);
  // Mostrar Google solo si está activado en el proyecto de Supabase.
  useEffect(() => {
    fetch('/api/config').then((r) => r.json())
      .then((c) => c.supabaseUrl && fetch(`${c.supabaseUrl}/auth/v1/settings`, { headers: { apikey: c.supabaseAnonKey } }).then((r) => r.json()))
      .then((st) => setGoogleOn(!!st?.external?.google)).catch(() => {});
  }, []);
  if (auth.user) return <Navigate to="/app" replace />;
  const redirectTo = `${location.origin}/app`;

  const magic = async (e) => {
    e.preventDefault();
    setState('sending');
    const { error } = await (await supabase()).auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setState(error ? error.message : 'sent');
  };
  const google = async () => {
    const { error } = await (await supabase()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setState(error.message);
  };

  return (
    <div className="login-page">
      <nav className="nav wrap"><Logo /><ThemeToggle /></nav>
      <main className="login card">
        <span className="eyebrow">Tu cuenta</span>
        <h1>Entra y ensaya donde quieras.</h1>
        <p className="muted">Guarda tus presentaciones y ensayos en la nube y retómalos desde cualquier dispositivo.</p>
        {!auth.ready ? <p className="muted">Cargando…</p> : !auth.enabled ? (
          <p className="notice">Las cuentas aún no están activadas en este servidor. Puedes usar TempoSlide en <b>modo invitado</b>: tus datos se guardan en este navegador.</p>
        ) : state === 'sent' ? (
          <p className="notice ok">📬 Te enviamos un enlace a <b>{email}</b>. Ábrelo desde este dispositivo para entrar.</p>
        ) : (
          <>
            {googleOn && (<>
              <button className="btn ghost big full" onClick={google}><span className="g">G</span> Continuar con Google</button>
              <div className="or"><span>o con tu correo</span></div>
            </>)}
            <form onSubmit={magic} className="login-form">
              <input type="email" required placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <button className="btn primary big" disabled={state === 'sending'}>{state === 'sending' ? 'Enviando…' : 'Enviarme un enlace'}</button>
            </form>
            {state && state !== 'sending' && <p className="err small">{state}</p>}
          </>
        )}
        <Link to="/app" className="muted small center-block">Seguir como invitado →</Link>
        <p className="muted small center">Al continuar aceptas los <Link to="/terminos">términos</Link> y la <Link to="/privacidad">política de privacidad</Link>.</p>
      </main>
    </div>
  );
}
