// Mi cuenta: identidad, plan, estadísticas, preferencias, seguridad y datos.
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase, useAuth, userName, userAvatar, userProvider, userPrefs, PLAN } from './supabase.js';
import { listDecks, exportData, deleteAccount, audioUsage, AUDIO_QUOTA } from './store.js';
import { fmt, rehearsalStats } from './lib.js';
import { AppNav } from './Dashboard.jsx';
import { ThemeToggle } from './Landing.jsx';

export function Avatar({ user, size = 38 }) {
  const [broken, setBroken] = useState(false);
  const src = userAvatar(user);
  return src && !broken
    ? <img className="avatar" src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ width: size, height: size }} />
    : <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{(userName(user)[0] || '?').toUpperCase()}</span>;
}

const sb = () => supabase();
const updateUser = async (attrs) => { const { error } = await (await sb()).auth.updateUser(attrs); if (error) throw error; };

function Identity({ user }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userName(user));
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try { await updateUser({ data: { full_name: name.trim() } }); setEditing(false); setMsg(''); } catch (err) { setMsg(err.message); }
  };
  const since = new Date(user.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return (
    <section className="card acc-identity">
      <Avatar user={user} size={72} />
      <div className="grow">
        {editing ? (
          <form onSubmit={save} className="row">
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
            <button className="btn primary small">Guardar</button>
            <button type="button" className="btn ghost small" onClick={() => { setEditing(false); setName(userName(user)); }}>Cancelar</button>
          </form>
        ) : (
          <h2 className="acc-name">{userName(user)} <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar nombre" title="Editar nombre">✎</button></h2>
        )}
        {msg && <p className="err small">{msg}</p>}
        <p className="muted">{user.email}</p>
        <p className="small muted">{userProvider(user) === 'google' ? <><span className="g">G</span> Has entrado con Google</> : '✉️ Has entrado con tu correo'} · Ensayando desde {since}</p>
      </div>
    </section>
  );
}

function Plan({ stats }) {
  return (
    <section className="card">
      <div className="row between"><h3>Tu plan</h3><span className="plan-badge">{PLAN.badge}</span></div>
      <p className="muted">{PLAN.name}. Estamos en beta: todas las funciones están incluidas y gratis mientras activamos los pagos.</p>
      <div className="kpis">
        <div><span>Presentaciones</span><b>{stats.decks}</b><small>sin límite en la beta</small></div>
        <div><span>Ensayos guardados</span><b>{stats.sessions}</b><small>sin límite en la beta</small></div>
      </div>
      <AudioUsage />
      <div className="row"><Link to="/app/planes" className="btn ghost">Ver planes</Link></div>
    </section>
  );
}

function AudioUsage() {
  const [used, setUsed] = useState(null);
  useEffect(() => { audioUsage().then(setUsed).catch(() => setUsed(null)); }, []);
  if (used == null) return null;
  const mb = (b) => (b / 1024 / 1024).toLocaleString('es', { maximumFractionDigits: 1 });
  return (
    <div className="kpi-line">
      <span>Grabaciones: <b>{mb(used)} MB</b> de {mb(AUDIO_QUOTA)} MB</span>
      <span className="bar"><i style={{ width: `${Math.min(100, (used / AUDIO_QUOTA) * 100)}%`, background: used > AUDIO_QUOTA * 0.9 ? '#c43c32' : 'var(--plum)' }} /></span>
    </div>
  );
}

function Stats({ stats }) {
  return (
    <section className="card">
      <h3>Tus estadísticas de ensayo</h3>
      <div className="kpis four">
        <div><span>Presentaciones</span><b>{stats.decks}</b></div>
        <div><span>Ensayos</span><b>{stats.sessions}</b></div>
        <div><span>Tiempo ensayado</span><b>{fmt(stats.totalMs)}</b></div>
        <div><span>Racha</span><b>{stats.streak} {stats.streak === 1 ? 'día' : 'días'}</b></div>
      </div>
      <p className="muted small">{stats.best === null ? 'Haz tu primer ensayo para ver tu mejor ajuste al tiempo.' : `🎯 Mejor ajuste al tiempo: a ${Math.round(stats.best * 100)}% del objetivo.`}</p>
    </section>
  );
}

function Preferences({ user }) {
  const [min, setMin] = useState(userPrefs(user).defaultMinutes);
  const [saved, setSaved] = useState('');
  const save = async () => {
    await updateUser({ data: { prefs: { ...userPrefs(user), defaultMinutes: Math.max(1, +min || 10) } } });
    setSaved('Guardado ✓'); setTimeout(() => setSaved(''), 1500);
  };
  return (
    <section className="card">
      <h3>Preferencias</h3>
      <div className="pref-row">
        <div><b>Tiempo máximo por defecto</b><p className="muted small">El que se propone al subir una presentación nueva.</p></div>
        <label className="inline"><input type="number" min="1" max="240" value={min} onChange={(e) => setMin(e.target.value)} onBlur={save} /> min <span className="small">{saved}</span></label>
      </div>
      <div className="pref-row">
        <div><b>Tema</b><p className="muted small">Claro u oscuro. Se recuerda en este navegador.</p></div>
        <ThemeToggle />
      </div>
    </section>
  );
}

function Security({ user }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const nav = useNavigate();
  const google = userProvider(user) === 'google';
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg('La contraseña debe tener al menos 8 caracteres.');
    if (pw !== pw2) return setMsg('Las contraseñas no coinciden.');
    try { await updateUser({ password: pw }); setMsg('ok'); setOpen(false); setPw(''); setPw2(''); } catch (err) { setMsg(err.message); }
  };
  return (
    <section className="card">
      <h3>Seguridad</h3>
      <div className="pref-row">
        <div><b>Contraseña</b><p className="muted small">{google ? 'Añade una contraseña para entrar también sin Google.' : 'Crea o cambia tu contraseña para entrar sin esperar el enlace por correo.'}</p></div>
        {!open && <button className="btn ghost small" onClick={() => { setOpen(true); setMsg(''); }}>Crear o cambiar contraseña</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="pw-form">
          <label>Nueva contraseña<input className="text-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><small className="muted">Al menos 8 caracteres</small></label>
          <label>Repite la contraseña<input className="text-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          <div className="row"><button className="btn primary small">Guardar contraseña</button><button type="button" className="btn ghost small" onClick={() => { setOpen(false); setMsg(''); }}>Cancelar</button></div>
        </form>
      )}
      {msg === 'ok' ? <p className="notice ok">Contraseña guardada. Ya puedes entrar con tu correo y contraseña.</p> : msg && <p className="err small">{msg}</p>}
      <div className="pref-row">
        <div><b>Sesiones</b><p className="muted small">Cierra la sesión en todos tus dispositivos, incluido este.</p></div>
        <button className="btn ghost small" onClick={async () => { await (await sb()).auth.signOut({ scope: 'global' }); nav('/'); }}>Cerrar sesión en todos</button>
      </div>
    </section>
  );
}

function DataZone({ user }) {
  const [busy, setBusy] = useState('');
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const doExport = async () => {
    setBusy('export');
    try {
      const blob = await exportData(user);
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `temposlide-${new Date().toISOString().slice(0, 10)}.zip` });
      a.click(); URL.revokeObjectURL(a.href);
    } finally { setBusy(''); }
  };
  const doDelete = async () => {
    setBusy('delete'); setErr('');
    try { await deleteAccount(); nav('/', { replace: true }); }
    catch (e) { setErr(e.message); setBusy(''); }
  };
  return (
    <>
      <section className="card">
        <h3>Tus datos</h3>
        <div className="pref-row">
          <div><b>Exportar mis datos</b><p className="muted small">Un ZIP con tus presentaciones (PDF), notas, planes, ensayos, grabaciones y eventos (programa, ponentes y pósteres).</p></div>
          <button className="btn ghost small" onClick={doExport} disabled={!!busy}>{busy === 'export' ? 'Preparando…' : '⬇ Descargar ZIP'}</button>
        </div>
      </section>
      <section className="card danger-zone">
        <h3>⚠️ Zona peligrosa</h3>
        <div className="pref-row">
          <div><b>Borrar mi cuenta</b><p className="muted small">Borra para siempre tu cuenta, tus presentaciones, sus PDF y todos tus ensayos. No se puede deshacer.</p></div>
          <button className="btn danger-btn small" onClick={() => { setModal(true); setConfirm(''); setErr(''); }}>Borrar cuenta</button>
        </div>
      </section>
      {modal && (
        <div className="modal-bg" onClick={() => busy || setModal(false)}>
          <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="del-title">¿Borrar tu cuenta para siempre?</h3>
            <p>Se eliminarán tu cuenta (<b>{user.email}</b>), todas tus presentaciones con sus PDF y todos tus ensayos. Si quieres conservarlos, exporta tus datos antes.</p>
            <label>Escribe <b>BORRAR</b> para confirmar<input className="text-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus /></label>
            {err && <p className="err small">{err.includes('delete_account') ? 'Falta activar el borrado de cuentas en el servidor. Inténtalo más tarde o escríbenos.' : err}</p>}
            <div className="row">
              <button className="btn danger-btn" disabled={confirm !== 'BORRAR' || !!busy} onClick={doDelete}>{busy === 'delete' ? 'Borrando…' : 'Borrar mi cuenta'}</button>
              <button className="btn ghost" disabled={!!busy} onClick={() => setModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Account() {
  const auth = useAuth();
  const [decks, setDecks] = useState(null);
  useEffect(() => { if (auth.user) listDecks().then(setDecks).catch(() => setDecks([])); }, [auth.user?.id]);
  if (auth.ready && !auth.user) return <Navigate to="/login" replace />;
  if (!auth.user) return <div className="app"><AppNav /><main className="wrap"><p className="muted">Cargando…</p></main></div>;
  const stats = rehearsalStats(decks || []);
  return (
    <div className="app">
      <AppNav />
      <main className="wrap acc">
        <span className="eyebrow">Mi cuenta</span>
        <Identity user={auth.user} />
        <Plan stats={stats} />
        <Stats stats={stats} />
        <Preferences user={auth.user} />
        <Security user={auth.user} />
        <DataZone user={auth.user} />
      </main>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="app">
      <AppNav />
      <main className="wrap notfound">
        <span className="big-404">404</span>
        <h1>Esta diapositiva no existe.</h1>
        <p className="muted">Puede que el enlace esté mal o que la presentación se haya borrado.</p>
        <div className="row"><Link to="/app" className="btn primary">Ir a mis presentaciones</Link><Link to="/" className="btn ghost">Inicio</Link></div>
      </main>
    </div>
  );
}
