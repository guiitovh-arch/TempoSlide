// Herramientas para organizar: Eventos, Ponentes y Pósteres (Organizador en Organizer.jsx).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Plus, Pencil, Trash2, Users, LayoutGrid, CalendarRange, Copy, FileDown, Search, AlertTriangle, Mail, Printer } from 'lucide-react';
import { AppNav } from './Dashboard.jsx';
import { useAuth } from './supabase.js';
import { fmt, toCsv } from './lib.js';
import { listEvents, saveEvent, deleteEvent, eventCounts, loadEvent, useActiveEvent, Speakers, Panels, Posters, deckForecasts, dayLabel } from './events.js';

// ─── Comunes ─────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>, document.body);
}

// Estas pantallas guardan en la cuenta: sin sesión, invitan a entrar.
export function OrgPage({ title, eyebrow, actions, children }) {
  const auth = useAuth();
  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head"><div><span className="eyebrow">{eyebrow || 'Organizar'}</span><h1>{title}</h1></div>{auth.user && actions}</header>
        {!auth.ready ? <p className="muted">Cargando…</p> : !auth.user ? (
          <div className="card empty"><p>Para organizar eventos necesitas una cuenta: el programa, los ponentes y los pósteres se guardan en ella para que no pierdas nada al cambiar de dispositivo.</p>{auth.enabled ? <Link to="/login" className="btn primary">Entrar o crear cuenta</Link> : <p className="muted">Las cuentas aún no están activadas en este servidor.</p>}</div>
        ) : children}
      </main>
    </div>
  );
}

export function EventPicker({ ctx, need }) {
  const { events, active, setId } = ctx;
  if (!events) return null;
  if (!events.length) return null;
  return (
    <div className="event-picker">
      <CalendarDays size={16} />
      <select value={active?.id || ''} onChange={(e) => setId(e.target.value)} aria-label="Evento">
        {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {need && active && !active[need] && <span className="muted small">Este evento no tiene sesión de pósteres.</span>}
    </div>
  );
}

export const NoEvents = ({ what }) => (
  <div className="card empty"><p>{what} pertenece a un evento. Crea tu primer evento (un congreso, unas jornadas, un seminario) y vuelve aquí.</p><Link to="/app/eventos?nuevo=1" className="btn primary"><Plus size={16} /> Crear evento</Link></div>
);

const dateRange = (e) => (e.starts_on === e.ends_on ? dayLabel(e.starts_on) : `${dayLabel(e.starts_on)} – ${dayLabel(e.ends_on)}`);

// ─── Eventos ─────────────────────────────────────────────────────────────────
function EventForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', starts_on: '', ends_on: '', venue: '', has_posters: false });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (f.ends_on < f.starts_on) return setErr('La fecha de fin no puede ser anterior a la de inicio.');
    try { onSaved(await saveEvent({ ...(f.id && { id: f.id }), name: f.name.trim(), starts_on: f.starts_on, ends_on: f.ends_on, venue: f.venue?.trim() || null, has_posters: f.has_posters })); onClose(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={f.id ? 'Editar evento' : 'Nuevo evento'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label>Nombre<input className="text-input" required maxLength={120} value={f.name} onChange={set('name')} placeholder="Jornadas de innovación 2027" autoFocus /></label>
        <div className="two">
          <label>Empieza<input className="text-input" type="date" required value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value, ends_on: f.ends_on || e.target.value })} /></label>
          <label>Termina<input className="text-input" type="date" required value={f.ends_on} min={f.starts_on} onChange={set('ends_on')} /></label>
        </div>
        <label>Lugar<input className="text-input" maxLength={120} value={f.venue || ''} onChange={set('venue')} placeholder="Campus Norte, Madrid" /></label>
        <label className="check"><input type="checkbox" checked={f.has_posters} onChange={set('has_posters')} /> Este evento tiene sesión de pósteres</label>
        {err && <p className="err small">{err}</p>}
        <div className="row"><button className="btn primary">{f.id ? 'Guardar' : 'Crear evento'}</button><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}

function DeleteEvent({ event, onClose, onDeleted }) {
  const [c, setC] = useState(null);
  useEffect(() => { eventCounts(event.id).then(setC); }, []);
  return (
    <Modal title={`¿Borrar «${event.name}»?`} onClose={onClose}>
      {!c ? <p className="muted">Comprobando qué contiene…</p> : (
        <p>Se borrarán con él: <b>{c.sessions}</b> sesiones, <b>{c.talks}</b> charlas y pausas, <b>{c.speakers}</b> ponentes{event.has_posters && <>, <b>{c.panels}</b> paneles y <b>{c.posters}</b> pósteres</>}. Tus presentaciones no se borran. No se puede deshacer.</p>
      )}
      <div className="row"><button className="btn danger-btn" disabled={!c} onClick={async () => { await deleteEvent(event.id); onDeleted(); onClose(); }}>Borrar evento</button><button className="btn ghost" onClick={onClose}>Cancelar</button></div>
    </Modal>
  );
}

export function Events() {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(new URLSearchParams(location.search).get('nuevo') ? {} : null);
  const [del, setDel] = useState(null);
  const auth = useAuth();
  const load = () => listEvents().then(setEvents).catch((e) => { setErr(e.message); setEvents([]); });
  useEffect(() => { if (auth.user) load(); }, [auth.user?.id]);
  return (
    <OrgPage title="Eventos" actions={<button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Nuevo evento</button>}>
      {err && <p className="notice">No pudimos cargar los eventos: {err}</p>}
      {events === null && <p className="muted">Cargando…</p>}
      {events?.length === 0 && !err && <div className="card empty"><p>Un evento agrupa su programa, sus ponentes y, si quieres, su sala de pósteres. Crea el primero para empezar a organizar.</p><button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Crear evento</button></div>}
      <div className="event-list">
        {events?.map((e) => (
          <article key={e.id} className="card event-card">
            <Link to={`/app/eventos/${e.id}`} className="deck-link"><h3>{e.name}</h3></Link>
            <p className="muted small"><CalendarDays size={14} /> {dateRange(e)}{e.venue && <> · <MapPin size={14} /> {e.venue}</>}</p>
            <div className="row">
              <Link to={`/app/organizador?evento=${e.id}`} className="btn ghost small"><CalendarRange size={14} /> Programa</Link>
              <Link to={`/app/ponentes?evento=${e.id}`} className="btn ghost small"><Users size={14} /> Ponentes</Link>
              {e.has_posters && <Link to={`/app/posters?evento=${e.id}`} className="btn ghost small"><LayoutGrid size={14} /> Pósteres</Link>}
              <span className="grow" />
              <button className="icon-btn" title="Editar" aria-label="Editar evento" onClick={() => setForm(e)}><Pencil size={14} /></button>
              <button className="icon-btn" title="Borrar" aria-label="Borrar evento" onClick={() => setDel(e)}><Trash2 size={14} /></button>
            </div>
          </article>
        ))}
      </div>
      {form && <EventForm initial={form.id ? form : null} onClose={() => setForm(null)} onSaved={load} />}
      {del && <DeleteEvent event={del} onClose={() => setDel(null)} onDeleted={load} />}
    </OrgPage>
  );
}

export function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(false);
  const [del, setDel] = useState(false);
  const auth = useAuth();
  const load = () => loadEvent(id).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { if (auth.user) load(); }, [auth.user?.id, id]);
  const e = d?.event;
  return (
    <OrgPage title={e?.name || 'Evento'} eyebrow="Evento" actions={e && <div className="row"><button className="btn ghost" onClick={() => setForm(true)}><Pencil size={14} /> Editar</button><button className="btn ghost danger" onClick={() => setDel(true)}><Trash2 size={14} /> Borrar</button></div>}>
      {err && <p className="notice">{err}</p>}
      {d && !e && <div className="card empty"><p>Este evento no existe o no es tuyo.</p><Link to="/app/eventos" className="btn primary">Ver mis eventos</Link></div>}
      {e && (
        <>
          <p className="muted"><CalendarDays size={14} /> {dateRange(e)}{e.venue && <> · <MapPin size={14} /> {e.venue}</>}</p>
          <div className="access-grid">
            <Link to={`/app/organizador?evento=${e.id}`} className="card access"><CalendarRange size={26} /><b>Programa</b><span className="muted">{d.sessions.length} sesiones · {d.talks.filter((t) => t.kind === 'talk').length} charlas</span></Link>
            <Link to={`/app/ponentes?evento=${e.id}`} className="card access"><Users size={26} /><b>Ponentes</b><span className="muted">{d.speakers.length} ponentes · {d.speakers.filter((s) => s.status === 'confirmado' || s.status === 'ha_llegado').length} confirmados</span></Link>
            {e.has_posters && <Link to={`/app/posters?evento=${e.id}`} className="card access"><LayoutGrid size={26} /><b>Pósteres</b><span className="muted">{d.panels.length} paneles · {d.posters.filter((p) => p.panel_id).length}/{d.posters.length} asignados</span></Link>}
          </div>
        </>
      )}
      {form && <EventForm initial={e} onClose={() => setForm(false)} onSaved={load} />}
      {del && <DeleteEvent event={e} onClose={() => setDel(false)} onDeleted={() => nav('/app/eventos')} />}
    </OrgPage>
  );
}

// ─── Ponentes ────────────────────────────────────────────────────────────────
const STATUS = { sin_confirmar: 'Sin confirmar', confirmado: 'Confirmado', ha_llegado: 'Ha llegado' };
const FILTERS = [['all', 'Todos'], ['noemail', 'Sin correo'], ['over', 'Se pasa'], ['unconfirmed', 'Sin confirmar'], ['nodeck', 'Sin presentación']];

function SpeakerForm({ initial, eventId, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', email: '', affiliation: '', country: '', note: '', status: 'sin_confirmar' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const clean = (v) => (v?.trim() ? v.trim() : null);
    try { await Speakers.save({ ...(f.id && { id: f.id }), event_id: eventId, name: f.name.trim(), email: clean(f.email), affiliation: clean(f.affiliation), country: clean(f.country), note: clean(f.note), status: f.status }); onSaved(); onClose(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={f.id ? 'Editar ponente' : 'Nuevo ponente'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label>Nombre<input className="text-input" required maxLength={120} value={f.name} onChange={set('name')} autoFocus /></label>
        <label>Correo<input className="text-input" type="email" value={f.email || ''} onChange={set('email')} /></label>
        <div className="two">
          <label>Institución<input className="text-input" value={f.affiliation || ''} onChange={set('affiliation')} /></label>
          <label>País<input className="text-input" value={f.country || ''} onChange={set('country')} /></label>
        </div>
        <label>Estado<select value={f.status} onChange={set('status')}>{Object.entries(STATUS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label>Nota<textarea className="text-input" rows={2} value={f.note || ''} onChange={set('note')} /></label>
        {err && <p className="err small">{err}</p>}
        <div className="row"><button className="btn primary">Guardar</button><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}

export function SpeakersPage() {
  const ctx = useActiveEvent();
  const auth = useAuth();
  const [d, setD] = useState(null);
  const [fc, setFc] = useState({});
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [copied, setCopied] = useState('');
  const eventId = ctx.active?.id;
  const load = () => eventId && loadEvent(eventId).then(setD);
  useEffect(() => { setD(null); load(); }, [eventId]);
  useEffect(() => { if (auth.user) deckForecasts().then(setFc).catch(() => {}); }, [auth.user?.id]);

  const rows = useMemo(() => (d?.speakers || []).map((s) => {
    const talks = d.talks.filter((t) => t.kind === 'talk' && t.speakers.includes(s.id)).map((t) => ({ ...t, predicted: t.deck_id ? fc[t.deck_id]?.p50 : null }));
    const flags = { noemail: !s.email, over: talks.some((t) => t.predicted > t.minutes * 60), unconfirmed: s.status === 'sin_confirmar', nodeck: talks.some((t) => !t.deck_id) };
    return { ...s, talks, flags, attention: Object.values(flags).some(Boolean) };
  }), [d, fc]);
  const shown = rows.filter((s) => (filter === 'all' || s.flags[filter]) && (!q || `${s.name} ${s.affiliation || ''}`.toLowerCase().includes(q.toLowerCase())));
  const copyEmails = async () => { const m = shown.map((s) => s.email).filter(Boolean); await navigator.clipboard.writeText(m.join(', ')); setCopied(`${m.length} correos copiados`); setTimeout(() => setCopied(''), 2500); };
  const exportCsv = () => {
    const csv = toCsv([['Nombre', 'Correo', 'Institución', 'País', 'Estado', 'Charlas', 'Nota'], ...shown.map((s) => [s.name, s.email, s.affiliation, s.country, STATUS[s.status], s.talks.map((t) => t.title).join(' | '), s.note])]);
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), download: `ponentes-${ctx.active.name}.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <OrgPage title="Ponentes" actions={eventId && <button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Añadir ponente</button>}>
      <EventPicker ctx={ctx} />
      {ctx.err && <p className="notice">{ctx.err}</p>}
      {ctx.events?.length === 0 && <NoEvents what="Cada ponente" />}
      {eventId && !d && <p className="muted">Cargando…</p>}
      {d && (
        <>
          <div className="stats org-stats">
            <div className="stat plum"><b>{rows.length}</b><span>ponentes</span></div>
            <div className="stat coral"><b>{new Set(rows.flatMap((s) => s.talks.map((t) => t.id))).size}</b><span>charlas</span></div>
            <div className="stat mint"><b>{rows.filter((s) => s.attention).length}</b><span>requieren atención</span></div>
          </div>
          {rows.length === 0 ? (
            <div className="card empty"><p>Aún no hay ponentes en este evento. Añádelos para asignarles charlas en el Organizador y ver quién se va a pasar de tiempo.</p><button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Añadir ponente</button></div>
          ) : (
            <>
              <div className="lib-tools">
                <label className="search"><Search size={16} /><input className="text-input" placeholder="Buscar por nombre o institución…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ponentes" /></label>
                <div className="seg">{FILTERS.map(([k, t]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{t}</button>)}</div>
                <button className="btn ghost small" onClick={copyEmails}><Copy size={14} /> {copied || 'Copiar correos'}</button>
                <button className="btn ghost small" onClick={exportCsv}><FileDown size={14} /> Exportar CSV</button>
              </div>
              {shown.length === 0 && <p className="muted">Nadie coincide con este filtro.</p>}
              <div className="speaker-list">
                {shown.map((s) => (
                  <article key={s.id} className="card speaker">
                    <div className="row between">
                      <div><h3>{s.name}</h3><p className="muted small">{[s.affiliation, s.country].filter(Boolean).join(' · ') || '—'}{s.email && <> · <Mail size={12} /> {s.email}</>}</p></div>
                      <div className="row">
                        <select value={s.status} onChange={async (e) => { await Speakers.update(s.id, { status: e.target.value }); load(); }} aria-label="Estado">{Object.entries(STATUS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                        <button className="icon-btn" aria-label="Editar ponente" onClick={() => setForm(s)}><Pencil size={14} /></button>
                        <button className="icon-btn" aria-label="Borrar ponente" onClick={async () => { if (confirm(`¿Borrar a ${s.name}? Se quitará de sus charlas.`)) { await Speakers.remove(s.id); load(); } }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {s.attention && (
                      <div className="row alerts">
                        {s.flags.noemail && <span className="alert"><AlertTriangle size={12} /> Sin correo</span>}
                        {s.flags.over && <span className="alert bad"><AlertTriangle size={12} /> Se pasará de tiempo</span>}
                        {s.flags.unconfirmed && <span className="alert"><AlertTriangle size={12} /> Sin confirmar</span>}
                        {s.flags.nodeck && <span className="alert"><AlertTriangle size={12} /> Charla sin presentación</span>}
                      </div>
                    )}
                    {s.talks.length > 0 && (
                      <ul className="talk-mini">
                        {s.talks.map((t) => <li key={t.id}><span>{t.title}</span><span className="mono">{t.minutes} min{t.predicted ? ` · prevista ${fmt(t.predicted * 1000)}` : ''}</span>{t.predicted > t.minutes * 60 && <span className="chip red">+{Math.ceil(t.predicted / 60 - t.minutes)} min</span>}</li>)}
                      </ul>
                    )}
                    {s.note && <p className="small muted">{s.note}</p>}
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {form && <SpeakerForm initial={form.id ? form : null} eventId={eventId} onClose={() => setForm(null)} onSaved={load} />}
    </OrgPage>
  );
}

// ─── Pósteres ────────────────────────────────────────────────────────────────
export function PostersPage() {
  const ctx = useActiveEvent();
  const [d, setD] = useState(null);
  const [batch, setBatch] = useState({ prefix: 'A', from: 1, to: 10, size: 'A0', orientation: 'vertical' });
  const [poster, setPoster] = useState({ title: '', speaker_id: '' });
  const [err, setErr] = useState('');
  const ev = ctx.active;
  const load = () => ev && loadEvent(ev.id).then(setD);
  useEffect(() => { setD(null); load(); }, [ev?.id]);
  const run = async (fn) => { setErr(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } };

  const speakerName = (id) => d?.speakers.find((s) => s.id === id)?.name || '—';
  const free = d ? d.posters.filter((p) => !p.panel_id) : [];
  const assigned = d ? d.posters.filter((p) => p.panel_id).length : 0;
  const addPanels = () => run(async () => {
    const from = Math.max(1, +batch.from || 1), to = Math.min(from + 199, Math.max(from, +batch.to || from));
    const existing = new Set(d.panels.map((p) => p.label));
    const rows = [];
    for (let i = from; i <= to; i++) { const label = `${batch.prefix}${i}`; if (!existing.has(label)) rows.push({ event_id: ev.id, label, size: batch.size, orientation: batch.orientation }); }
    if (rows.length) await Panels.insertMany(rows);
  });
  const panelSort = (a, b) => a.label.localeCompare(b.label, 'es', { numeric: true });

  return (
    <OrgPage title="Pósteres" actions={d?.panels.length > 0 && <button className="btn ghost" onClick={() => window.print()}><Printer size={16} /> Hoja imprimible</button>}>
      <EventPicker ctx={ctx} />
      {ctx.events?.length === 0 && <NoEvents what="La sala de pósteres" />}
      {ev && !ev.has_posters && (
        <div className="card empty"><p>Este evento no tiene sesión de pósteres.</p><button className="btn primary" onClick={() => run(async () => { await saveEvent({ ...ev, has_posters: true }); await ctx.reload(); })}>Activar pósteres en este evento</button></div>
      )}
      {err && <p className="notice">{err}</p>}
      {ev?.has_posters && !d && <p className="muted">Cargando…</p>}
      {ev?.has_posters && d && (
        <div className="poster-grid-page no-print">
          <div className="poster-side">
            <div className="card form-grid">
              <h3>Paneles</h3>
              <p className="muted small">Crea varios de una vez, por ejemplo de A1 a A28.</p>
              <div className="two">
                <label>Prefijo<input className="text-input" value={batch.prefix} maxLength={6} onChange={(e) => setBatch({ ...batch, prefix: e.target.value })} /></label>
                <label>Del<input className="text-input" inputMode="numeric" value={batch.from} onChange={(e) => setBatch({ ...batch, from: e.target.value.replace(/\D/g, '') })} /></label>
                <label>Al<input className="text-input" inputMode="numeric" value={batch.to} onChange={(e) => setBatch({ ...batch, to: e.target.value.replace(/\D/g, '') })} /></label>
              </div>
              <div className="two">
                <label>Tamaño<select value={batch.size} onChange={(e) => setBatch({ ...batch, size: e.target.value })}><option>A0</option><option>A1</option><option>A2</option></select></label>
                <label>Orientación<select value={batch.orientation} onChange={(e) => setBatch({ ...batch, orientation: e.target.value })}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
              </div>
              <button className="btn primary" onClick={addPanels}><Plus size={16} /> Crear paneles {batch.prefix}{batch.from}–{batch.prefix}{batch.to}</button>
            </div>
            <form className="card form-grid" onSubmit={(e) => { e.preventDefault(); run(async () => { await Posters.save({ event_id: ev.id, title: poster.title.trim(), speaker_id: poster.speaker_id || null }); setPoster({ title: '', speaker_id: '' }); }); }}>
              <h3>Pósteres</h3>
              <label>Título<input className="text-input" required value={poster.title} onChange={(e) => setPoster({ ...poster, title: e.target.value })} /></label>
              <label>Autor<select value={poster.speaker_id} onChange={(e) => setPoster({ ...poster, speaker_id: e.target.value })}><option value="">—</option>{d.speakers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              {d.speakers.length === 0 && <small className="muted">Los autores salen de <Link to={`/app/ponentes?evento=${ev.id}`}>Ponentes</Link>.</small>}
              <button className="btn primary"><Plus size={16} /> Añadir póster</button>
              {d.posters.length > 0 && (
                <ul className="poster-list">
                  {d.posters.map((p) => <li key={p.id}><span><b>{p.title}</b><small className="muted"> · {speakerName(p.speaker_id)}{p.panel_id ? ` · ${d.panels.find((x) => x.id === p.panel_id)?.label}` : ' · sin panel'}</small></span><button type="button" className="icon-btn" aria-label="Borrar póster" onClick={() => run(() => Posters.remove(p.id))}><Trash2 size={13} /></button></li>)}
                </ul>
              )}
            </form>
          </div>
          <div className="card">
            <div className="row between"><h3>Asignar</h3><span className="chip">{assigned}/{d.panels.length} asignados</span></div>
            {d.panels.length === 0 ? <p className="muted">Crea paneles para empezar a asignar pósteres.</p> : (
              <div className="panel-grid">
                {[...d.panels].sort(panelSort).map((pn) => {
                  const p = d.posters.find((x) => x.panel_id === pn.id);
                  return (
                    <div key={pn.id} className={`panel-slot ${p ? 'taken' : ''} ${pn.orientation}`}>
                      <div className="row between"><b>{pn.label}</b><small className="muted">{pn.size} · {pn.orientation === 'vertical' ? 'vert.' : 'horiz.'}</small></div>
                      {p ? (
                        <div className="slot-poster"><span>{p.title}</span><small className="muted">{speakerName(p.speaker_id)}</small><button className="link-btn small" onClick={() => run(() => Posters.update(p.id, { panel_id: null }))}>Quitar</button></div>
                      ) : (
                        <select value="" onChange={(e) => e.target.value && run(() => Posters.update(e.target.value, { panel_id: pn.id }))} aria-label={`Póster para ${pn.label}`} disabled={!free.length}>
                          <option value="">{free.length ? 'Asignar póster…' : 'Sin pósteres libres'}</option>
                          {free.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                        </select>
                      )}
                      <button className="icon-btn panel-del" aria-label={`Borrar panel ${pn.label}`} onClick={() => run(() => Panels.remove(pn.id))}><Trash2 size={12} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {ev?.has_posters && d && (
        <section className="print-only">
          <h1>{ev.name} · Sala de pósteres</h1>
          <table className="print-table"><thead><tr><th>Panel</th><th>Título</th><th>Autor</th></tr></thead>
            <tbody>{[...d.panels].sort(panelSort).map((pn) => { const p = d.posters.find((x) => x.panel_id === pn.id); return <tr key={pn.id}><td>{pn.label}</td><td>{p?.title || '—'}</td><td>{p ? speakerName(p.speaker_id) : ''}</td></tr>; })}</tbody>
          </table>
        </section>
      )}
    </OrgPage>
  );
}
