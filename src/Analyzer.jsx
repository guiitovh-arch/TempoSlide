// Analizador: ¿cuánto durará de verdad? Simulación de 1.000 ensayos en el navegador (determinista).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Gauge, Play, ScrollText, Timer, CalendarPlus, EyeOff, Scissors } from 'lucide-react';
import { AppNav, Upload } from './Dashboard.jsx';
import { listDecks, getDeck, updateDeck } from './store.js';
import { useAuth, userPrefs } from './supabase.js';
import { usePdf } from './Slide.jsx';
import { Modal } from './Org.jsx';
import { listEvents, loadEvent, Talks, dayLabel } from './events.js';
import { hhmm, fmt, deckSlides, manualPlans, deckPpm, simulate, verdict, histogram, cutSuggestions, spareAllocation, CONTEXTS, SLIDE_TYPES } from './lib.js';

const VERDICTS = {
  short: { label: 'Corta', color: '#6d58a5', text: 'Ocupa menos del 70 % de tu tiempo: puedes añadir contenido, reservar tiempo para preguntas o pedir menos tiempo.' },
  ok: { label: 'Cómoda', color: '#397449', text: 'Entra con margen. Buen punto de partida para ensayar.' },
  tight: { label: 'Justa', color: '#b7791f', text: 'Está al límite: cualquier imprevisto te hace pasarte.' },
  over: { label: 'Te pasas', color: '#c43c32', text: 'Lo más probable es que te pases del tiempo. Mira qué recortar abajo.' },
};

function Histogram({ totals, maxSec }) {
  const bins = histogram(totals, maxSec);
  const top = Math.max(...bins.map((b) => b.count));
  const lo = bins[0].from, hi = bins.at(-1).to;
  const x = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <figure className="hist">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Distribución de 1.000 ensayos simulados">
        {bins.map((b, i) => (
          <rect key={i} x={x(b.from) + 0.3} width={Math.max(0.4, x(b.to) - x(b.from) - 0.6)} y={40 - (b.count / top) * 38} height={(b.count / top) * 38} rx="0.6" className={b.over ? 'over' : 'in'} />
        ))}
        {maxSec != null && maxSec > lo && maxSec < hi && <line x1={x(maxSec)} x2={x(maxSec)} y1="0" y2="40" className="limit" />}
      </svg>
      <figcaption className="row between small muted"><span>{fmt(lo * 1000)}</span>{maxSec != null && <span className="legend"><i className="in" /> dentro del tiempo <i className="over" /> excedido</span>}<span>{fmt(hi * 1000)}</span></figcaption>
    </figure>
  );
}

export default function Analyzer() {
  const [q, setQ] = useSearchParams();
  const nav = useNavigate();
  const auth = useAuth();
  const [decks, setDecks] = useState(null);
  const [deck, setDeck] = useState(null);
  const [maxRaw, setMaxRaw] = useState('');
  const [ran, setRan] = useState(false);
  const deckId = q.get('deck');
  const doc = usePdf(deckId || null);

  useEffect(() => { listDecks().then(setDecks).catch(() => setDecks([])); }, [auth.user?.id]);
  useEffect(() => {
    setRan(false);
    if (!deckId) return setDeck(null);
    getDeck(deckId).then((d) => { setDeck(d || null); setMaxRaw(d ? String(d.targetMinutes) : ''); if (d) setRan(true); });
  }, [deckId]);

  const save = async (patch) => { setDeck((d) => ({ ...d, ...patch })); setDeck(await updateDeck(deckId, patch)); };
  const count = deck?.slideCount || doc?.numPages || 0;
  const slides = useMemo(() => (deck && count ? deckSlides(deck, count) : []), [deck, count]);
  const maxSec = maxRaw.trim() === '' ? null : Math.max(0.5, +maxRaw.replace(',', '.') || 0) * 60;
  const ctx = deck?.context || 'defensa';
  const sim = useMemo(() => (slides.length ? simulate({ seconds: slides.map((s) => s.plan), maxSec, ctx }) : null), [slides, maxSec, ctx]);

  const pct = sim && maxSec ? sim.p50 / maxSec : null;
  const V = pct != null ? VERDICTS[verdict(pct)] : null;
  const ppm = deckPpm(slides);
  const lastRun = deck?.sessions?.at(-1);
  const overSec = sim && maxSec ? sim.p50 - maxSec : 0;
  const cutList = overSec > 0 ? cutSuggestions(slides, overSec) : [];
  const spare = overSec < 0 ? spareAllocation(slides, Math.round(-overSec)) : null;
  const suggestMin = sim ? Math.ceil(sim.p90 / 60) : null;
  const maxBar = Math.max(1, ...slides.map((s) => s.plan + (spare?.extra[s.index] || 0)));
  const omit = (i) => { const s = Array.from({ length: count }, (_, j) => !!deck.skipped?.[j]); s[i] = true; save({ skipped: s }); };
  const applySpare = () => { const p = manualPlans(deck, count).map((m, i) => (slides[i].omitted ? m : slides[i].plan + spare.extra[i])); save({ plan: p, timesFromNotes: false }); };
  const setType = (i, t) => { const types = Array.from({ length: count }, (_, j) => deck.types?.[j] || slides[j].type); types[i] = t; save({ types }); };

  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head"><div><span className="eyebrow">Antes de ensayar</span><h1>Analizador</h1><p className="muted">¿Cuánto durará de verdad? Simulamos 1.000 ensayos con tu plan y la variación natural de ritmo.</p></div></header>
        <div className="an-grid">
          <aside className="card an-config">
            <h3>Configuración</h3>
            {decks === null ? <p className="muted">Cargando…</p> : (
              <label className="field">Presentación
                <select value={deckId || ''} onChange={(e) => setQ(e.target.value ? { deck: e.target.value } : {})}>
                  <option value="">Elige una presentación…</option>
                  {decks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </label>
            )}
            <details className="an-upload" open={decks?.length === 0}>
              <summary>o sube una nueva</summary>
              <Upload compact defaultMinutes={userPrefs(auth.user).defaultMinutes} onDone={(d) => { setDecks((x) => [d, ...(x || [])]); setQ({ deck: d.id }); }} />
            </details>
            {deck && (
              <>
                <label className="field">Contexto
                  <select value={ctx} onChange={(e) => save({ context: e.target.value })}>
                    {Object.entries(CONTEXTS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                  </select>
                </label>
                <label className="field">Tiempo máximo
                  <span className="row"><input className="text-input num" inputMode="decimal" placeholder="Sin límite" value={maxRaw} onChange={(e) => setMaxRaw(e.target.value.replace(/[^\d.,]/g, ''))} onBlur={() => maxSec && save({ targetMinutes: maxSec / 60 })} /> min</span>
                </label>
                <label className="field">Creo que dura
                  <span className="row"><input className="text-input num" inputMode="decimal" placeholder="?" value={deck.guessMinutes ?? ''} onChange={(e) => save({ guessMinutes: e.target.value === '' ? null : +e.target.value.replace(',', '.') || null })} /> min</span>
                </label>
                {ppm && <p className="small muted">Ritmo necesario para tu plan: <b>≈ {ppm} ppm</b>. Cambia el plan de cada diapositiva en la <Link to={`/app/deck/${deckId}`}>página de la presentación</Link>.</p>}
                <button className="btn primary" onClick={() => setRan(true)}><Gauge size={16} /> Analizar</button>
              </>
            )}
          </aside>

          <section className="an-result">
            {!deck && <div className="card empty"><p>Elige una presentación o sube una nueva para ver cuánto durará, si te vas a pasar y qué recortar.</p></div>}
            {deck && !count && <div className="card"><p className="muted">Leyendo la presentación…</p></div>}
            {deck && sim && ran && (
              <>
                <div className="card an-head">
                  {V ? <span className="chip" style={{ background: V.color }}>{V.label}</span> : <span className="chip">Sin tiempo máximo</span>}
                  <h2 className="an-mid">Dura unos {fmt(sim.p50 * 1000)}</h2>
                  <p className="muted">entre <b>{fmt(sim.p10 * 1000)}</b> y <b>{fmt(sim.p90 * 1000)}</b> (P10–P90) · contexto {CONTEXTS[ctx].label.toLowerCase()}</p>
                  {V && <>
                    <div className="usage"><i style={{ width: `${Math.min(100, (pct / 1.3) * 100)}%`, background: V.color }} /><span className="usage-limit" style={{ left: `${100 / 1.3}%` }} /></div>
                    <p>Ocupa el <b>{Math.round(pct * 100)} %</b> de tus {fmt(maxSec * 1000)}: {overSec > 0 ? <>te pasas unos <b>{fmt(overSec * 1000)}</b></> : <>te sobran <b>{fmt(-overSec * 1000)}</b></>}. <b>{sim.over} de 1000</b> simulaciones superan tu tiempo.</p>
                    <p className="muted small">{V.text}</p>
                  </>}
                  {deck.guessMinutes > 0 && <p className="small">Creías que duraba {deck.guessMinutes.toLocaleString('es')} min: {sim.p50 > deck.guessMinutes * 60 ? 'te quedabas corto' : 'te pasabas'} por {fmt(Math.abs(sim.p50 - deck.guessMinutes * 60) * 1000)}.</p>}
                  {lastRun && <p className="small">⏱ Tu último ensayo real duró <b>{fmt(lastRun.totalMs)}</b>{lastRun.blind && <span className="tag"><EyeOff size={12} /> a ciegas</span>} ({fmt(lastRun.totalMs - sim.p50 * 1000, true)} frente a la estimación).</p>}
                  {suggestMin && <p className="tip">Con <b>{suggestMin} min</b> te basta 9 de cada 10 veces. {(!maxSec || suggestMin !== maxSec / 60) && <button className="btn ghost small" onClick={() => { setMaxRaw(String(suggestMin)); save({ targetMinutes: suggestMin }); }}>Usar {suggestMin} min</button>}</p>}
                  <div className="row an-actions">
                    <Link className="btn ghost small" to={`/present/${deckId}?prompter=1`}><ScrollText size={14} /> Ensayar con teleprompter</Link>
                    <Link className="btn coral small" to={`/present/${deckId}`}><Play size={14} /> Presentar</Link>
                    <Link className="btn ghost small" to="/app/temporizador"><Timer size={14} /> Temporizador</Link>
                    <AddToProgram deck={deck} predicted={sim.p50} />
                  </div>
                </div>

                <div className="card">
                  <h3>Distribución de 1.000 ensayos</h3>
                  <Histogram totals={sim.totals} maxSec={maxSec} />
                </div>

                {cutList.length > 0 && (
                  <div className="card">
                    <h3><Scissors size={18} /> Qué recortar</h3>
                    <p className="muted small">Las diapositivas más largas (sin portada ni cierre) que cubren los {fmt(overSec * 1000)} de exceso.</p>
                    <ul className="cut-list">
                      {cutList.map((s) => <li key={s.index}><span>Diapositiva {s.index + 1} · {SLIDE_TYPES[s.type]} · {fmt(s.plan * 1000)}</span><button className="btn ghost small" onClick={() => omit(s.index)}>Omitir</button></li>)}
                    </ul>
                  </div>
                )}
                {spare && spare.extra.some(Boolean) && (
                  <div className="card">
                    <h3>Te sobra tiempo</h3>
                    <p className="muted small">Reservamos un 10 % de margen ({fmt(spare.margin * 1000)}) y repartimos el resto en proporción al plan de cada diapositiva (barra clara).</p>
                    <button className="btn ghost small" onClick={applySpare}>Aplicar este reparto al plan</button>
                  </div>
                )}

                <div className="card">
                  <h3>Diapositiva a diapositiva</h3>
                  <p className="muted small">El tipo se usa para estimar las diapositivas sin notas ni plan. Cámbialo si no acierta.</p>
                  <div className="an-slides">
                    {slides.map((s) => (
                      <div key={s.index} className={`an-row ${s.omitted ? 'omitted' : ''}`}>
                        <span className="num">{s.index + 1}</span>
                        <select value={s.type} onChange={(e) => setType(s.index, e.target.value)} aria-label={`Tipo de la diapositiva ${s.index + 1}`}>
                          {Object.entries(SLIDE_TYPES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                        </select>
                        <span className="an-bar">
                          <i className={`t-${s.type}`} style={{ width: `${(s.plan / maxBar) * 100}%` }} />
                          {spare && spare.extra[s.index] > 0 && <i className="extra" style={{ width: `${(spare.extra[s.index] / maxBar) * 100}%` }} />}
                        </span>
                        <small>{s.omitted ? 'omitida' : `${fmt(s.plan * 1000)}${spare?.extra[s.index] ? ` +${spare.extra[s.index]} s` : ''}${s.manualPlan != null ? ' · manual' : s.words ? ' · por notas' : ' · por tipo'}`}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// «Añadir al programa»: crea una charla vinculada a esta presentación en una sesión de un evento.
function AddToProgram({ deck, predicted }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [ev, setEv] = useState('');
  const [data, setData] = useState(null);
  const [ses, setSes] = useState('');
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(deck.targetMinutes || predicted / 60)));
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (open && !events) listEvents().then((e) => { setEvents(e); setEv(e[0]?.id || ''); }).catch((x) => setErr(x.message)); }, [open]);
  useEffect(() => { setData(null); setSes(''); if (ev) loadEvent(ev).then((d) => { setData(d); setSes(d.sessions[0]?.id || ''); }); }, [ev]);
  if (!auth.user) return null;
  const add = async () => {
    setErr('');
    try {
      const pos = Math.max(-1, ...data.talks.filter((t) => t.session_id === ses).map((t) => t.position)) + 1;
      await Talks.save({ session_id: ses, position: pos, kind: 'talk', title: deck.title, minutes: Math.min(600, Math.max(1, +minutes || 1)), deck_id: deck.id });
      setDone(ev);
    } catch (x) { setErr(x.message); }
  };
  return (
    <>
      <button className="btn ghost small" onClick={() => { setOpen(true); setDone(null); }}><CalendarPlus size={14} /> Añadir al programa</button>
      {open && (
        <Modal title="Añadir al programa" onClose={() => setOpen(false)}>
          {done ? (
            <><p>Añadida a la sesión con su duración prevista ({fmt(predicted * 1000)}).</p><div className="row"><Link className="btn primary" to={`/app/organizador?evento=${done}`}>Ver el programa</Link><button className="btn ghost" onClick={() => setOpen(false)}>Cerrar</button></div></>
          ) : events?.length === 0 ? (
            <><p className="muted">Aún no tienes eventos.</p><Link className="btn primary" to="/app/eventos?nuevo=1">Crear evento</Link></>
          ) : (
            <div className="form-grid">
              <label>Evento<select value={ev} onChange={(e) => setEv(e.target.value)}>{(events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
              <label>Sesión<select value={ses} onChange={(e) => setSes(e.target.value)} disabled={!data?.sessions.length}>
                {data?.sessions.length ? data.sessions.map((x) => <option key={x.id} value={x.id}>{dayLabel(x.day)} · {hhmm(x.start_min)} · {x.name}</option>) : <option>Este evento no tiene sesiones</option>}
              </select></label>
              {data && !data.sessions.length && <small className="muted">Crea una sesión en el <Link to={`/app/organizador?evento=${ev}`}>Organizador</Link>.</small>}
              <label>Minutos asignados<input className="text-input num" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} /></label>
              {err && <p className="err small">{err}</p>}
              <div className="row"><button className="btn primary" disabled={!ses} onClick={add}>Añadir charla</button><button className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button></div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
