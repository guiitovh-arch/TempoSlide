// Presentaciones grupales: compartir, miembros, presentadores y reparto de diapositivas.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Share2, Link2, Copy, X, UserMinus, LogOut, Plus, Trash2, Users } from 'lucide-react';
import { Modal } from './Org.jsx';
import { useAuth } from './supabase.js';
import { fmt, requiredPpm } from './lib.js';
import { createInvite, listInvites, revokeInvite, acceptInvite, memberEmails, removeMember, addPresenter, updatePresenter, deletePresenter } from './store.js';

const COLORS = ['#7c3ec3', '#ff795f', '#397449', '#d08a17', '#175bcc', '#c43c32', '#0f8b8d', '#b5487b'];
export const presenterColor = (deck, id) => COLORS[Math.max(0, deck.presenters.findIndex((p) => p.id === id)) % COLORS.length];
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
export const presenterName = (deck, id) => deck.presenters.find((p) => p.id === id)?.name;

// Quién puede editar notas y plan de una diapositiva (la base de datos lo impone; esto solo adapta la interfaz).
export const canEditSlide = (deck, i, me) => {
  if (deck.isOwner) return true;
  const pid = deck.presenterOf?.[i];
  return !pid || deck.presenters.find((p) => p.id === pid)?.user_id === me;
};
export const memberName = (deck, userId) => deck.members.find((m) => m.user_id === userId)?.name || 'Alguien';
export const ago = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  return s < 60 ? 'hace un momento' : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : `el ${new Date(iso).toLocaleDateString('es')}`;
};

export function Chip({ deck, id, size = 22 }) {
  const name = presenterName(deck, id);
  if (!name) return null;
  return <span className="pchip" style={{ '--pc': presenterColor(deck, id), height: size }} title={name}><i>{initials(name)}</i>{name}</span>;
}

export function ShareModal({ deck, onClose, onChanged }) {
  const auth = useAuth();
  const nav = useNavigate();
  const [invites, setInvites] = useState(null);
  const [emails, setEmails] = useState({});
  const [copied, setCopied] = useState('');
  const [err, setErr] = useState('');
  const me = auth.user?.id;
  useEffect(() => {
    if (!deck.isOwner) return;
    listInvites(deck.id).then(setInvites).catch((e) => setErr(e.message));
    memberEmails(deck.id).then((r) => setEmails(Object.fromEntries(r.map((x) => [x.user_id, x.email])))).catch(() => {});
  }, [deck.id]);
  const url = (t) => `${location.origin}/unirse/${t}`;
  const copy = async (t) => { await navigator.clipboard.writeText(url(t)); setCopied(t); setTimeout(() => setCopied(''), 2000); };
  const run = async (fn) => { setErr(''); try { await fn(); } catch (e) { setErr(e.message); } };
  return (
    <Modal title={deck.isOwner ? 'Compartir presentación' : 'Grupo de la presentación'} onClose={onClose}>
      {deck.isOwner && (
        <div className="share-invites">
          <p className="muted small">Quien abra el enlace inicia sesión y se une al grupo: verá la presentación, podrá ensayar y editará las diapositivas que le asignes. El enlace caduca a los 7 días.</p>
          {invites?.map((i) => (
            <div key={i.token} className="invite">
              <Link2 size={14} /><code>{url(i.token).replace(/^https?:\/\//, '')}</code>
              <small className="muted">caduca el {new Date(i.expires_at).toLocaleDateString('es')}</small>
              <button className="btn ghost small" onClick={() => copy(i.token)}><Copy size={13} /> {copied === i.token ? 'Copiado' : 'Copiar'}</button>
              <button className="icon-btn" title="Revocar enlace" aria-label="Revocar enlace" onClick={() => run(async () => { await revokeInvite(i.token); setInvites(await listInvites(deck.id)); })}><X size={14} /></button>
            </div>
          ))}
          <button className="btn primary small" onClick={() => run(async () => { const i = await createInvite(deck.id); setInvites(await listInvites(deck.id)); copy(i.token); })}><Share2 size={14} /> Crear enlace de invitación</button>
        </div>
      )}
      <h4 className="mt">Miembros</h4>
      <ul className="members">
        {deck.members.map((m) => (
          <li key={m.user_id}>
            {m.avatar_url ? <img className="avatar" src={m.avatar_url} alt="" referrerPolicy="no-referrer" width={30} height={30} /> : <span className="avatar" style={{ width: 30, height: 30, fontSize: 13 }}>{initials(m.name)}</span>}
            <span className="grow"><b>{m.name || 'Sin nombre'}</b>{m.user_id === me && ' (tú)'}{deck.isOwner && emails[m.user_id] && <small className="muted"> · {emails[m.user_id]}</small>}</span>
            <span className="tag">{m.role === 'owner' ? 'Propietario' : 'Miembro'}</span>
            {deck.isOwner && m.role !== 'owner' && <button className="icon-btn" title="Expulsar" aria-label={`Expulsar a ${m.name}`} onClick={() => confirm(`¿Expulsar a ${m.name} del grupo?`) && run(async () => { await removeMember(deck.id, m.user_id); onChanged(); })}><UserMinus size={14} /></button>}
          </li>
        ))}
      </ul>
      {!deck.isOwner && <button className="btn ghost small danger" onClick={() => confirm('¿Salir del grupo? Dejarás de ver esta presentación.') && run(async () => { await removeMember(deck.id, me); nav('/app'); })}><LogOut size={14} /> Salir del grupo</button>}
      {err && <p className="err small">{err}</p>}
    </Modal>
  );
}

// Presentadores: con cuenta (miembros) o solo un nombre. Resumen por persona.
export function PresentersPanel({ deck, slides, onChanged }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const run = async (fn) => { setErr(''); try { await fn(); onChanged(); } catch (e) { setErr(e.message); } };
  const linkable = deck.members.filter((m) => !deck.presenters.some((p) => p.user_id === m.user_id));
  const rows = [...deck.presenters.map((p) => ({ ...p })), { id: null, name: 'Sin asignar' }].map((p) => {
    const ss = slides.filter((s) => (deck.presenterOf?.[s.index] ?? null) === p.id && !s.omitted);
    const sec = ss.reduce((a, s) => a + s.plan, 0);
    const words = ss.filter((s) => s.words && s.plan).reduce((a, s) => a + s.words, 0);
    return { ...p, count: ss.length, sec, ppm: requiredPpm(words, ss.filter((s) => s.words && s.plan).reduce((a, s) => a + s.plan, 0)) };
  });
  return (
    <div className="card presenters">
      <div className="row between"><span className="eyebrow">Reparto</span><span className="muted small">{deck.presenters.length ? 'Quién presenta cada diapositiva' : 'Añade presentadores para repartir las diapositivas'}</span></div>
      <ul className="p-summary">
        {rows.filter((r) => r.id || r.count).map((r) => (
          <li key={r.id || 'none'}>
            {r.id ? <Chip deck={deck} id={r.id} /> : <span className="pchip none"><i>–</i>Sin asignar</span>}
            <span className="muted small">{r.count} diapositiva{r.count === 1 ? '' : 's'} · {fmt(r.sec * 1000)}{r.ppm ? ` · ≈ ${r.ppm} ppm` : ''}</span>
            {r.id && (
              <span className="p-tools">
                {deck.isOwner && !r.user_id && linkable.length > 0 && (
                  <select value="" onChange={(e) => e.target.value && run(() => updatePresenter(deck.id, r.id, { user_id: e.target.value }))} aria-label={`Vincular ${r.name} a un miembro`}>
                    <option value="">Vincular a…</option>{linkable.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                  </select>
                )}
                {r.user_id && <span className="tag" title="Vinculado a una cuenta del grupo"><Users size={11} /> cuenta</span>}
                <button className="icon-btn" aria-label={`Quitar a ${r.name}`} onClick={() => confirm(`¿Quitar a ${r.name}? Sus diapositivas quedarán sin asignar.`) && run(() => deletePresenter(deck.id, r.id))}><Trash2 size={13} /></button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (n) run(async () => { await addPresenter(deck.id, n); setName(''); }); }}>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (p. ej. Laura)" maxLength={60} aria-label="Nuevo presentador" />
        <button className="btn ghost small"><Plus size={14} /> Añadir presentador</button>
        {linkable.filter((m) => m.name).map((m) => <button type="button" key={m.user_id} className="btn ghost small" onClick={() => run(() => addPresenter(deck.id, m.name, m.user_id))}><Plus size={13} /> {m.name}</button>)}
      </form>
      {err && <p className="err small">{err}</p>}
    </div>
  );
}

// Selector «Ver: Todos · Laura · Diego · Sin asignar».
export function PresenterFilter({ deck, value, onChange, dark }) {
  if (!deck.presenters?.length) return null;
  const opts = [['all', 'Todos'], ...deck.presenters.map((p) => [p.id, p.name]), ['none', 'Sin asignar']];
  return (
    <label className={`inline pfilter ${dark ? 'dark' : ''}`}>Ver
      <select value={value} onChange={(e) => onChange(e.target.value)}>{opts.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
    </label>
  );
}
export const matchesFilter = (deck, i, f) => f === 'all' || (f === 'none' ? !deck.presenterOf?.[i] : deck.presenterOf?.[i] === f);

// /unirse/:token
export function JoinPage() {
  const { token } = useParams();
  const auth = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!auth.ready) return;
    if (!auth.user) { try { sessionStorage.setItem('ts-next', location.pathname); } catch {} nav('/login', { replace: true }); return; }
    acceptInvite(token).then((deckId) => nav(`/app/deck/${deckId}`, { replace: true })).catch((e) => setErr(e.message));
  }, [auth.ready, auth.user?.id]);
  return (
    <div className="login-page"><main className="login card">
      <span className="eyebrow">Invitación</span>
      {err ? <><h1>No pudimos unirte</h1><p className="muted">{/caducada|revocada/i.test(err) ? 'Esta invitación ha caducado o ha sido revocada. Pide a quien te invitó un enlace nuevo.' : err}</p><Link to="/app" className="btn primary">Ir a mis presentaciones</Link></> : <h1>Uniéndote al grupo…</h1>}
    </main></div>
  );
}
