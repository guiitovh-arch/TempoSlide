// Organizador: programa por días y sesiones; horas calculadas, previsión y avisos.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Coffee, AlertTriangle, Printer, Users, Presentation } from 'lucide-react';
import { OrgPage, EventPicker, NoEvents, Modal } from './Org.jsx';
import { useAuth } from './supabase.js';
import { fmt, timeline, forecast, conflicts, hhmm } from './lib.js';
import { loadEvent, useActiveEvent, Sessions, Talks, setTalkSpeakers, moveTalk, deckForecasts, eventDays, dayLabel } from './events.js';

const toMin = (v) => { const [h, m] = (v || '09:00').split(':').map(Number); return h * 60 + (m || 0); };

function SessionForm({ initial, eventId, day, onClose, onSaved }) {
  const [f, setF] = useState(initial ? { ...initial, time: hhmm(initial.start_min) } : { name: '', room: '', chair: '', time: '09:00' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { await Sessions.save({ ...(f.id && { id: f.id }), event_id: eventId, day: f.day || day, name: f.name.trim(), room: f.room.trim() || null, chair: f.chair?.trim() || null, start_min: toMin(f.time) }); onSaved(); onClose(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={f.id ? 'Editar sesión' : 'Nueva sesión'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label>Nombre<input className="text-input" required value={f.name} onChange={set('name')} placeholder="Sesión 1 · Innovación educativa" autoFocus /></label>
        <div className="two">
          <label>Sala<input className="text-input" value={f.room || ''} onChange={set('room')} placeholder="Aula 2.1" /></label>
          <label>Hora de inicio<input className="text-input" type="time" required value={f.time} onChange={set('time')} /></label>
        </div>
        <label>Moderador<input className="text-input" value={f.chair || ''} onChange={set('chair')} /></label>
        {err && <p className="err small">{err}</p>}
        <div className="row"><button className="btn primary">Guardar</button><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}

function SpeakerPick({ talk, speakers, onChange }) {
  const [sel, setSel] = useState(talk.speakers); // respuesta inmediata; se guarda en segundo plano
  useEffect(() => setSel(talk.speakers), [talk.speakers.join()]);
  const toggle = (id, on) => { const next = on ? [...sel, id] : sel.filter((x) => x !== id); setSel(next); onChange(next); };
  const names = sel.map((id) => speakers.find((s) => s.id === id)?.name).filter(Boolean);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current?.open && (e.key === 'Escape' || (e.type === 'mousedown' && !ref.current.contains(e.target)))) ref.current.open = false; };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, []);
  return (
    <details className="speaker-pick" ref={ref}>
      <summary title="Ponentes"><Users size={13} /> {names.length ? names.join(', ') : 'Ponentes'}</summary>
      <div className="menu-pop card">
        {speakers.length === 0 && <small className="muted">Añade ponentes al evento primero.</small>}
        {speakers.map((s) => (
          <label key={s.id} className="check"><input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} /> {s.name}</label>
        ))}
      </div>
    </details>
  );
}

export default function Organizer() {
  const ctx = useActiveEvent();
  const auth = useAuth();
  const [d, setD] = useState(null);
  const [fc, setFc] = useState({});
  const [day, setDay] = useState(null);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const ev = ctx.active;
  const load = () => ev && loadEvent(ev.id).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [ev?.id]);
  useEffect(() => { if (auth.user) deckForecasts().then(setFc).catch(() => {}); }, [auth.user?.id]);
  const days = ev ? eventDays(ev) : [];
  const curDay = days.includes(day) ? day : days[0];
  const run = async (fn) => { setErr(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } };

  // Modelo para timeline/forecast/conflicts
  const model = useMemo(() => (d ? d.sessions.map((s) => ({
    ...s, start: s.start_min,
    talks: d.talks.filter((t) => t.session_id === s.id).sort((a, b) => a.position - b.position).map((t) => ({ ...t, predicted: t.kind === 'talk' && t.deck_id ? fc[t.deck_id]?.p50 ?? null : null })),
  })) : []), [d, fc]);
  const issues = useMemo(() => conflicts(model), [model]);
  const allTalks = model.flatMap(timeline);
  const talkById = Object.fromEntries(allTalks.map((t) => [t.id, t]));
  const issueText = (c) => {
    const a = talkById[c.ids[0]], b = talkById[c.ids[1]];
    if (c.type === 'se-pasa') return `«${a.title}» se pasa ${Math.ceil(a.predicted / 60 - a.minutes)} min (prevista ${fmt(a.predicted * 1000)}, asignados ${a.minutes} min).`;
    if (c.type === 'sala') return `Sala ${a.room} ocupada dos veces: «${a.title}» (${hhmm(a.start)}) y «${b.title}» (${hhmm(b.start)}).`;
    const who = a.speakers.filter((p) => b.speakers.includes(p)).map((id) => d.speakers.find((s) => s.id === id)?.name).join(', ');
    return `${who} está en dos sitios a la vez: «${a.title}» y «${b.title}» (${hhmm(Math.max(a.start, b.start))}).`;
  };
  const dayIssues = issues.filter((c) => talkById[c.ids[0]]?.day === curDay);
  const daySessions = model.filter((s) => s.day === curDay).sort((a, b) => a.start - b.start);
  const parallel = (s) => daySessions.some((o) => o.id !== s.id && o.room !== s.room && o.start < forecast(s) && s.start < forecast(o));
  const decks = Object.entries(fc).sort((a, b) => a[1].title.localeCompare(b[1].title, 'es'));

  const addTalk = (s, kind) => run(() => Talks.save({ session_id: s.id, position: (s.talks.at(-1)?.position ?? -1) + 1, kind, title: kind === 'break' ? 'Pausa' : 'Nueva charla', minutes: 15 }));

  return (
    <OrgPage title="Organizador" actions={d && <button className="btn ghost" onClick={() => window.print()}><Printer size={16} /> Vista imprimible</button>}>
      <EventPicker ctx={ctx} />
      {ctx.err && <p className="notice">{ctx.err}</p>}
      {ctx.events?.length === 0 && <NoEvents what="El programa" />}
      {err && <p className="notice">{err}</p>}
      {ev && !d && !err && <p className="muted">Cargando…</p>}
      {ev && d && (
        <div className="no-print">
          <div className="seg day-tabs" role="tablist">
            {days.map((x) => <button key={x} role="tab" aria-selected={x === curDay} className={x === curDay ? 'on' : ''} onClick={() => setDay(x)}>{dayLabel(x)}</button>)}
          </div>
          {dayIssues.length > 0 && (
            <div className="card issues" role="alert">
              <b><AlertTriangle size={16} /> {dayIssues.length} aviso{dayIssues.length > 1 ? 's' : ''}</b>
              <ul>{dayIssues.map((c, i) => <li key={i} className={c.type}>{issueText(c)}</li>)}</ul>
            </div>
          )}
          {daySessions.length === 0 && (
            <div className="card empty"><p>No hay sesiones el {dayLabel(curDay)}. Una sesión agrupa charlas y pausas seguidas en una sala; las horas se calculan solas.</p><button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Añadir sesión</button></div>
          )}
          <div className="session-list">
            {daySessions.map((s) => {
              const tl = timeline(s);
              const end = s.start + s.talks.reduce((a, t) => a + t.minutes, 0);
              const fcEnd = forecast(s);
              return (
                <section key={s.id} className="card session">
                  <header className="row between">
                    <div>
                      <h3>{hhmm(s.start)} · {s.name}</h3>
                      <p className="muted small">{[s.room && `Sala ${s.room}`, s.chair && `Modera ${s.chair}`].filter(Boolean).join(' · ') || 'Sin sala asignada'}{parallel(s) && <span className="tag">En paralelo</span>}</p>
                    </div>
                    <div className="row">
                      <span className={`chip ${fcEnd > end ? 'red' : 'green'}`}>Programada hasta {hhmm(end)} · prevista {hhmm(fcEnd)}</span>
                      <button className="icon-btn" aria-label="Editar sesión" onClick={() => setForm(s)}><Pencil size={14} /></button>
                      <button className="icon-btn" aria-label="Borrar sesión" onClick={() => confirm(`¿Borrar la sesión «${s.name}» y sus ${s.talks.length} charlas y pausas?`) && run(() => Sessions.remove(s.id))}><Trash2 size={14} /></button>
                    </div>
                  </header>
                  {tl.length === 0 && <p className="muted small">Sin charlas todavía.</p>}
                  <ol className="talks">
                    {tl.map((t, i) => {
                      const over = t.predicted > t.minutes * 60;
                      return (
                        <li key={t.id} className={`talk ${t.kind}`}>
                          <span className="mono talk-time">{hhmm(t.start)}–{hhmm(t.end)}</span>
                          {t.kind === 'break' && <Coffee size={14} className="muted" />}
                          <input className="text-input talk-title" defaultValue={t.title} aria-label="Título" onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && run(() => Talks.update(t.id, { title: e.target.value.trim() }))} />
                          {t.kind === 'talk' && <SpeakerPick talk={t} speakers={d.speakers} onChange={(ids) => run(() => setTalkSpeakers(t.id, ids))} />}
                          <label className="inline talk-min"><input className="text-input" inputMode="numeric" defaultValue={t.minutes} aria-label="Minutos" onBlur={(e) => { const v = Math.min(600, Math.max(1, parseInt(e.target.value, 10) || t.minutes)); e.target.value = v; v !== t.minutes && run(() => Talks.update(t.id, { minutes: v })); }} /> min</label>
                          {t.kind === 'talk' && (
                            <span className="talk-deck">
                              <Presentation size={13} />
                              <select value={t.deck_id || ''} onChange={(e) => run(() => Talks.update(t.id, { deck_id: e.target.value || null }))} aria-label="Presentación vinculada">
                                <option value="">Vincular presentación…</option>
                                {decks.map(([id, x]) => <option key={id} value={id}>{x.title}</option>)}
                              </select>
                              {t.predicted != null && <span className={`chip ${over ? 'red' : 'green'}`}>{over ? `+${Math.ceil(t.predicted / 60 - t.minutes)} min` : `prevista ${fmt(t.predicted * 1000)}`}</span>}
                            </span>
                          )}
                          <span className="talk-tools">
                            <button className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => run(() => moveTalk(s.talks, i, -1))}><ArrowUp size={13} /></button>
                            <button className="icon-btn" aria-label="Bajar" disabled={i === tl.length - 1} onClick={() => run(() => moveTalk(s.talks, i, 1))}><ArrowDown size={13} /></button>
                            <button className="icon-btn" aria-label="Borrar" onClick={() => run(() => Talks.remove(t.id))}><Trash2 size={13} /></button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="row"><button className="btn ghost small" onClick={() => addTalk(s, 'talk')}><Plus size={14} /> Charla</button><button className="btn ghost small" onClick={() => addTalk(s, 'break')}><Coffee size={14} /> Pausa</button></div>
                </section>
              );
            })}
          </div>
          {daySessions.length > 0 && <button className="btn ghost" onClick={() => setForm({})}><Plus size={16} /> Añadir sesión</button>}
          {decks.length === 0 && <p className="muted small">Consejo: sube presentaciones en <Link to="/app">Inicio</Link> para vincularlas a las charlas y prever si se pasarán.</p>}
        </div>
      )}
      {ev && d && (
        <section className="print-only">
          <h1>{ev.name}</h1>
          {days.map((x) => {
            const ss = model.filter((s) => s.day === x).sort((a, b) => a.start - b.start);
            if (!ss.length) return null;
            return (
              <div key={x} className="print-day">
                <h2>{dayLabel(x)}</h2>
                {ss.map((s) => (
                  <div key={s.id} className="print-session">
                    <h3>{hhmm(s.start)} · {s.name}{s.room ? ` · Sala ${s.room}` : ''}{s.chair ? ` · Modera ${s.chair}` : ''}</h3>
                    <table className="print-table"><tbody>
                      {timeline(s).map((t) => <tr key={t.id}><td className="mono">{hhmm(t.start)}–{hhmm(t.end)}</td><td>{t.title}</td><td>{t.speakers.map((id) => d.speakers.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}</td></tr>)}
                    </tbody></table>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}
      {form && <SessionForm initial={form.id ? form : null} eventId={ev.id} day={curDay} onClose={() => setForm(null)} onSaved={load} />}
    </OrgPage>
  );
}
