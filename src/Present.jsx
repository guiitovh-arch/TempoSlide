import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MoreHorizontal, SlidersHorizontal, ChevronLeft, ChevronRight, Eye, EyeOff, RotateCcw, Mic, Download, Trash2, ScrollText, Square, Monitor, Maximize, HelpCircle, Play, Pause } from 'lucide-react';
import { fmt, deckSlides, pace, phase, newClock, goTo, pauseClock, resumeClock, resetSlide, undoReset, slideMs as clockSlideMs, totalMs as clockTotalMs } from './lib.js';
import { getDeck, addSession, saveRehearsalAudio } from './store.js';
import { useAuth } from './supabase.js';
import { openMic, closeMic, createRecorder, MAX_REC_MS } from './recorder.js';
import Slide, { usePdf } from './Slide.jsx';
import { PresenterFilter, matchesFilter, presenterName, Chip } from './Group.jsx';

const SHORTCUTS = [
  [['Enter', 'S'], 'Iniciar el temporizador'],
  [['→', 'Espacio', 'Av Pág'], 'Siguiente diapositiva'],
  [['←', 'Re Pág'], 'Diapositiva anterior'],
  [['P'], 'Pausar / reanudar'],
  [['R'], 'Reiniciar el tiempo de esta diapositiva'],
  [['O'], 'Ocultar / mostrar el tiempo (a ciegas)'],
  [['T'], 'Mostrar u ocultar el teleprompter'],
  [['B', '.'], 'Pantalla en negro'],
  [['F'], 'Pantalla completa'],
  [['?'], 'Ver estos atajos'],
];

export default function Present() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const nav = useNavigate();
  const auth = useAuth();
  const doc = usePdf(id);
  const [deck, setDeck] = useState(null);
  const [page, setPage] = useState(0);
  const [state, setState] = useState('ready'); // ready | running | paused | done
  const [, tick] = useState(0);
  const [black, setBlack] = useState(false);
  const [prompter, setPrompter] = useState(q.get('prompter') === '1');
  const [pBig, setPBig] = useState(false);
  const [pAuto, setPAuto] = useState(true);
  const [pSpeed, setPSpeed] = useState(30);
  const [pSize, setPSize] = useState(() => (window.innerWidth < 760 ? 26 : 34));
  const [pMirror, setPMirror] = useState(false);
  const [help, setHelp] = useState(false);
  const [pSettings, setPSettings] = useState(false); // ajustes del teleprompter (plegados en el móvil)
  const touch = useRef(null);
  const [blind, setBlind] = useState(false);
  const blindOk = useRef(true); // pasa a false si se vio el tiempo durante el ensayo
  const [recOn, setRecOn] = useState(false);
  const [recErr, setRecErr] = useState('');
  const [toast, setToast] = useState(null); // { text, undo? }
  const [result, setResult] = useState(null);
  const [who, setWho] = useState(q.get('presenter') || 'all'); // filtro por presentador

  const clock = useRef(null);
  const undoRef = useRef(null);
  const rec = useRef({ stream: null, r: null, stopped: null, acc: 0, since: null, marks: [] });
  const prompterEl = useRef(null);
  const chan = useRef(null);
  const now = () => performance.now();

  useEffect(() => { getDeck(id).then(setDeck); }, [id]);
  const count = doc?.numPages ?? 0;
  const plan = deck && count ? deckSlides(deck, count).map((s) => s.plan) : [];
  // Con un presentador elegido: solo sus diapositivas y su tiempo objetivo es la suma de sus planes.
  const hidden = (i) => !!deck?.skipped?.[i] || (who !== 'all' && deck && !matchesFilter(deck, i, who));
  const mine = plan.map((_, i) => i).filter((i) => !hidden(i));
  const targetMs = who === 'all' ? (deck?.targetMinutes ?? 10) * 60_000 : mine.reduce((a, i) => a + plan[i], 0) * 1000;
  if (count && !clock.current) clock.current = newClock(count);

  // Segunda pantalla (mismo navegador) vía BroadcastChannel.
  const pageRef = useRef(0), blackRef = useRef(false);
  useEffect(() => {
    const c = new BroadcastChannel(`ts-${id}`);
    chan.current = c;
    c.onmessage = (e) => e.data === 'hello' && c.postMessage({ page: pageRef.current, black: blackRef.current });
    return () => c.close();
  }, [id]);
  useEffect(() => { pageRef.current = page; blackRef.current = black; chan.current?.postMessage({ page, black }); }, [page, black]);

  useEffect(() => {
    if (state !== 'running') return;
    const i = setInterval(() => {
      tick((x) => x + 1);
      const R = rec.current;
      if (R.r?.state === 'recording' && recNow() >= MAX_REC_MS) { R.r.stop(); flash('Grabación detenida: el máximo es 60 min. El ensayo sigue.'); }
    }, 100);
    return () => clearInterval(i);
  }, [state]);

  // Liberar el micrófono al salir.
  useEffect(() => () => { const R = rec.current; if (R.r?.state !== 'inactive') R.r?.stop(); closeMic(R.stream); }, []);

  useEffect(() => { if (deck && count && hidden(page)) { const f = plan.findIndex((_, i) => !hidden(i)); if (f >= 0) { setPage(f); clock.current = clock.current && { ...clock.current, cur: f }; } } }, [deck, who, count]);
  const nextPage = (() => { let n = page + 1; while (n < count && hidden(n)) n++; return n; })();

  const flash = (text, undo) => {
    clearTimeout(flash.t);
    setToast({ text, undo });
    flash.t = setTimeout(() => setToast(null), 5000);
  };

  // Reloj del audio (independiente del total: reiniciar una diapositiva no corta la grabación).
  const recNow = () => { const R = rec.current; return R.acc + (R.since == null ? 0 : now() - R.since); };
  const mark = (m) => { const R = rec.current; if (R.r?.state === 'recording' || R.r?.state === 'paused') R.marks.push({ ...m, t: recNow() / 1000 }); };

  const toggleRec = async () => {
    setRecErr('');
    if (recOn) { closeMic(rec.current.stream); rec.current.stream = null; setRecOn(false); return; }
    try { rec.current.stream = await openMic(); setRecOn(true); } catch (e) { setRecErr(e.message); }
  };

  const start = () => {
    clock.current = resumeClock(clock.current || newClock(count, page), now());
    blindOk.current = blind;
    const R = rec.current;
    if (recOn && R.stream) {
      const { rec: r, stopped } = createRecorder(R.stream);
      Object.assign(R, { r, stopped, acc: 0, since: now(), marks: [{ type: 'slide', index: page, t: 0 }] });
      r.start(1000);
    }
    setState('running');
  };
  const togglePause = () => {
    const R = rec.current;
    if (state === 'running') {
      clock.current = pauseClock(clock.current, now());
      if (R.r?.state === 'recording') { R.r.pause(); R.acc = recNow(); R.since = null; }
      setState('paused');
    } else if (state === 'paused') {
      clock.current = resumeClock(clock.current, now());
      if (R.r?.state === 'paused') { R.r.resume(); R.since = now(); }
      setState('running');
    }
  };
  const toggleBlind = () => {
    if (state !== 'ready') blindOk.current = false; // cambiarlo a mitad quita la marca «a ciegas»
    setBlind(!blind);
  };

  const doReset = () => {
    if (state !== 'running' && state !== 'paused') return;
    const at = now(), before = clock.current;
    clock.current = resetSlide(before, at);
    undoRef.current = { before, at };
    mark({ type: 'reset', index: before.cur });
    flash(`Tiempo de la diapositiva ${before.cur + 1} reiniciado`, () => {
      const u = undoRef.current;
      if (!u) return;
      clock.current = undoReset(u.before, clock.current, u.at);
      undoRef.current = null;
      setToast(null);
    });
    tick((x) => x + 1);
  };

  // Salta las diapositivas omitidas en la dirección del movimiento.
  const go = (n) => {
    if (!count || state === 'done') return;
    const dir = n >= page ? 1 : -1;
    let to = Math.max(0, Math.min(count - 1, n));
    while (hidden(to) && to + dir >= 0 && to + dir < count) to += dir;
    if (hidden(to) || to === page) return;
    clock.current = goTo(clock.current, to, now());
    mark({ type: 'slide', index: to });
    setPage(to);
    if (prompterEl.current) prompterEl.current.scrollTop = 0;
  };

  const finish = async () => {
    if (state === 'ready') return nav(`/app/deck/${id}`);
    const c = pauseClock(clock.current, now());
    clock.current = c;
    const R = rec.current;
    let blob = null;
    if (R.r) {
      if (R.r.state !== 'inactive') R.r.stop();
      blob = await R.stopped;
      if (R.since != null) { R.acc = recNow(); R.since = null; }
    }
    closeMic(R.stream); R.stream = null;
    const totalMs = Math.round(c.done.reduce((a, b) => a + b, 0));
    const slides = c.done.map((ms, index) => ({ index, ms: Math.round(ms) })).filter((x) => x.ms > 0);
    const resets = c.resets.some(Boolean) ? c.resets : undefined;
    const session = await addSession(id, { totalMs, targetMs, slides, resets, blind: blindOk.current && blind, mode: prompter ? 'teleprompter' : 'ensayo', ...(who !== 'all' && { presenterId: who === 'none' ? null : who, presenterName: who === 'none' ? 'Sin asignar' : presenterName(deck, who) }) });
    setResult({ session, blob, url: blob && URL.createObjectURL(blob), marks: R.marks, seconds: Math.round(R.acc / 1000), save: true, status: '' });
    setState('done');
  };

  // Al salir de la pantalla de resultado: subir la grabación si se pidió.
  const leave = async (to) => {
    const r = result;
    if (r?.blob && r.save && auth.user && !r.saved) {
      setResult({ ...r, status: 'Guardando la grabación…' });
      try {
        await saveRehearsalAudio(id, r.session.id, r.blob, { seconds: r.seconds, mime: r.blob.type, marks: r.marks });
      } catch (e) {
        setResult({ ...r, status: e.message, save: e.quota ? false : r.save, saved: !!e.pending });
        if (!e.pending) return; // cupo lleno u otro error: el usuario decide
      }
    }
    if (r?.url) URL.revokeObjectURL(r.url);
    to === 'again' ? window.location.reload() : nav(`/app/deck/${id}?session=${r.session.id}`);
  };

  const openAudience = () => window.open(`/audience/${id}`, `ts-audience-${id}`, 'popup,width=1280,height=720');
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || state === 'done') return;
      const k = e.key;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); state === 'ready' && k === 'Enter' ? start() : go(page + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(page - 1); }
      else if (k === 's' || k === 'S') state === 'ready' && start();
      else if (k === 'p' || k === 'P') togglePause();
      else if (k === 'r' || k === 'R') doReset();
      else if (k === 'o' || k === 'O') toggleBlind();
      else if (k === 't' || k === 'T') setPrompter((x) => !x);
      else if (k === 'b' || k === 'B' || k === '.') setBlack((x) => !x);
      else if (k === 'f' || k === 'F') fullscreen();
      else if (k === '?') setHelp((x) => !x);
      else if (k === 'Escape') setHelp(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (state !== 'running' && state !== 'paused') return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  // Teleprompter: auto-ritmo = el texto termina justo cuando se acaba el plan de la diapositiva.
  const c = clock.current;
  const t = now();
  const total = c ? clockTotalMs(c, t) : 0;
  const sMs = c ? clockSlideMs(c, t) : 0;
  const budgetMs = (plan[page] || 0) * 1000;
  const lastTick = useRef(performance.now());
  useEffect(() => {
    const el = prompterEl.current;
    const n = performance.now(), dt = (n - lastTick.current) / 1000;
    lastTick.current = n;
    if (!el || state !== 'running') return;
    const max = el.scrollHeight - el.clientHeight;
    if (pAuto) el.scrollTop = Math.min(1, sMs / (budgetMs || 30_000)) * max;
    else el.scrollTop += pSpeed * dt;
  });

  if (!deck || !doc) return <div className="present loading">Cargando presentación…</div>;
  if (state === 'done' && result) return <Result deck={deck} plan={plan.map((b, i) => (hidden(i) ? 0 : b))} result={result} setResult={setResult} leave={leave} canSave={!!auth.user} accounts={auth.enabled} />;

  const remaining = targetMs - total;
  const ph = blind ? 'ok' : phase(remaining, targetMs);
  const p = state === 'ready' ? 0 : pace(plan, page, sMs, total);
  const slidePct = budgetMs ? Math.min(100, (sMs / budgetMs) * 100) : 0;
  const note = deck.notes?.[page] || '';
  const recording = state !== 'ready' && rec.current.r && rec.current.r.state !== 'inactive';

  return (
    <div className={`present phase-${ph}`}>
      <header className="p-top">
        <button className="btn glass small" onClick={finish}>{state === 'ready' ? <><ChevronLeft size={15} /> Salir</> : <><Square size={14} /> Terminar</>}</button>
        <b className="p-title">{deck.title}</b>
        {/* Móvil: cuenta atrás compacta + teleprompter + menú ⋯ */}
        <div className="p-tools-mob">
          {recording && <span className="rec-dot" role="status" aria-label="Grabando"><i /></span>}
          {blind ? <span className="m-clock blind"><EyeOff size={14} /></span> : <span className={`m-clock ${ph}`}>{fmt(remaining)}</span>}
          <button className={`btn glass icon ${prompter ? 'on' : ''}`} onClick={() => setPrompter(!prompter)} aria-label="Teleprompter"><ScrollText size={17} /></button>
          <details className="p-more">
            <summary className="btn glass icon" aria-label="Más opciones"><MoreHorizontal size={18} /></summary>
            <div className="p-more-menu" onClick={(e) => e.target.closest('button') && e.currentTarget.parentElement.removeAttribute('open')}>
              <button onClick={toggleBlind}>{blind ? <Eye size={16} /> : <EyeOff size={16} />} {blind ? 'Mostrar tiempo' : 'Ocultar tiempo'}</button>
              {state !== 'ready' && <button onClick={doReset}><RotateCcw size={16} /> Reiniciar diapositiva</button>}
              <button onClick={() => setBlack(!black)}>⬛ {black ? 'Quitar negro' : 'Pantalla en negro'}</button>
              <button onClick={openAudience}><Monitor size={16} /> Pantalla de público</button>
              <button onClick={fullscreen}><Maximize size={16} /> Pantalla completa</button>
              <button onClick={() => setHelp(true)}><HelpCircle size={16} /> Atajos</button>
            </div>
          </details>
        </div>
        <div className="row p-tools-desk">
          {recording && <span className="rec-dot" role="status"><i /> {rec.current.r.state === 'paused' ? 'Grabación en pausa' : 'Grabando'}</span>}
          <button className={`btn glass small ${blind ? 'on' : ''}`} onClick={toggleBlind} title="Ocultar tiempo (O)">{blind ? <EyeOff size={15} /> : <Eye size={15} />} <span className="hide-sm">{blind ? 'Tiempo oculto' : 'Ocultar tiempo'}</span></button>
          <button className={`btn glass small ${prompter ? 'on' : ''}`} onClick={() => setPrompter(!prompter)} title="Teleprompter (T)"><ScrollText size={15} /> <span className="hide-sm">Teleprompter</span></button>
          <button className={`btn glass small ${black ? 'on' : ''}`} onClick={() => setBlack(!black)} title="Pantalla en negro (B)">⬛ <span className="hide-sm">Negro</span></button>
          <button className="btn glass small" onClick={openAudience} title="Pantalla de público"><Monitor size={15} /></button>
          <button className="btn glass small" onClick={fullscreen} title="Pantalla completa (F)"><Maximize size={15} /></button>
          <button className="btn glass small" onClick={() => setHelp(!help)} title="Atajos de teclado (?)" aria-label="Atajos de teclado"><HelpCircle size={15} /></button>
        </div>
      </header>

      {help && (
        <div className="modal-bg" onClick={() => setHelp(false)}>
          <div className="modal card shortcuts" role="dialog" aria-modal="true" aria-label="Atajos de teclado" onClick={(e) => e.stopPropagation()}>
            <h3>Atajos de teclado</h3>
            <dl>{SHORTCUTS.map(([k, d]) => <div key={d}><dt>{k.map((x) => <kbd key={x}>{x}</kbd>)}</dt><dd>{d}</dd></div>)}</dl>
            <p className="muted small">Los mandos de presentación (clickers) funcionan: envían Re Pág / Av Pág.</p>
            <button className="btn primary" onClick={() => setHelp(false)}>Entendido</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.undo && <button className="link-btn" onClick={toast.undo}>Deshacer</button>}
        </div>
      )}

      <div className={`p-main ${prompter ? 'with-prompter' : ''} ${prompter && pBig ? 'prompter-big' : ''}`}>
        <section className="p-stage">
          <div className="p-slide-box"
            onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (state !== 'ready' && Math.abs(dx) > 50) go(page + (dx < 0 ? 1 : -1)); touch.current = null; }}>
            <Slide doc={doc} page={page} black={black} />
            {state === 'ready' && (
              <div className="p-start">
                <button className="btn primary huge p-start-btn" onClick={start}><Play size={22} /> Iniciar</button>
                <p>El temporizador de <b>{deck.targetMinutes.toLocaleString('es')} min</b> arranca al pulsar. <kbd>→</kbd> avanza, <kbd>P</kbd> pausa, <kbd>R</kbd> reinicia la diapositiva.</p>
                <div className="p-options">
                  {deck.presenters?.length > 0 && <PresenterFilter deck={deck} value={who} onChange={(v) => { setWho(v); }} dark />}
                  <label className="switch"><input type="checkbox" checked={blind} onChange={() => setBlind(!blind)} /> <EyeOff size={16} /> Ensayo a ciegas <small>No verás el tiempo hasta terminar</small></label>
                  <label className="switch"><input type="checkbox" checked={recOn} onChange={toggleRec} /> <Mic size={16} /> Grabar audio <small>Grábate, escúchate y te darás cuenta de tus errores inconscientes.</small></label>
                  {recErr && <p className="p-err">{recErr}</p>}
                </div>
              </div>
            )}
          </div>
          {prompter && (
            <div className="prompter">
              <button className={`btn glass icon prompter-gear ${pSettings ? 'on' : ''}`} onClick={() => setPSettings(!pSettings)} aria-label="Ajustes del teleprompter" aria-expanded={pSettings}><SlidersHorizontal size={16} /></button>
              <div className={`prompter-bar ${pSettings ? 'open' : ''}`}>
                <label className="inline"><input type="checkbox" checked={pAuto} onChange={(e) => setPAuto(e.target.checked)} /> Auto-ritmo</label>
                {!pAuto && <label className="inline">Velocidad<input type="range" min="5" max="120" value={pSpeed} onChange={(e) => setPSpeed(+e.target.value)} /></label>}
                <label className="inline">Tamaño<input type="range" min="18" max="72" value={pSize} onChange={(e) => setPSize(+e.target.value)} /></label>
                <label className="inline"><input type="checkbox" checked={pMirror} onChange={(e) => setPMirror(e.target.checked)} /> Espejo</label>
                <button className="btn glass small" onClick={() => setPBig(!pBig)}>{pBig ? '↙ Reducir' : '↗ Ampliar'}</button>
              </div>
              <div ref={prompterEl} className="prompter-text" style={{ fontSize: pSize, transform: pMirror ? 'scaleX(-1)' : undefined }}>
                <div className="prompter-pad" />
                {note ? note.split('\n').map((l, i) => <p key={i}>{l}</p>) : <p className="muted">Sin notas para esta diapositiva. Añádelas desde el panel de la presentación.</p>}
                <div className="prompter-pad" />
              </div>
            </div>
          )}
        </section>

        <aside className="p-side">
          {blind ? (
            <div className="card-dark blind-card"><EyeOff size={20} /> <div><b>Tiempo oculto</b><small>Se sigue midiendo. Lo verás al terminar.</small></div></div>
          ) : (
            <div className={`p-timer card-dark ${ph}`}>
              <small>{remaining < 0 ? 'Tiempo extra' : 'Tiempo restante'}</small>
              <div className="p-countdown">{fmt(remaining)}</div>
              <div className="p-progress"><i style={{ width: `${Math.min(100, (total / targetMs) * 100)}%` }} /></div>
              <div className="row between small">
                <span>Transcurrido {fmt(total)}</span>
                {state !== 'ready' && <span className={`chip ${p >= 0 ? 'green' : 'red'}`}>{p >= 0 ? `${fmt(p, true)} adelantado` : `${fmt(p)} tarde`}</span>}
              </div>
            </div>
          )}
          {state !== 'ready' && <button className="btn glass small" onClick={togglePause}>{state === 'paused' ? <><Play size={14} /> Reanudar</> : <><Pause size={14} /> Pausar</>}</button>}

          <div className="card-dark">
            <div className="row between">
              <small>{who === 'all' ? `Diapositiva ${page + 1} / ${count}` : `Diapositiva ${mine.indexOf(page) + 1} de ${mine.length} de ${who === 'none' ? 'sin asignar' : presenterName(deck, who)} (${page + 1} de ${count} del total)`}</small>
              {!blind && <small>{budgetMs ? `plan ${fmt(budgetMs)}` : 'fuera del plan (anexo)'}</small>}
            </div>
            <div className="row between">
              {blind ? <div className="p-lap muted">—</div> : <div className={`p-lap ${budgetMs && sMs > budgetMs ? 'over' : ''}`}>{fmt(sMs)}</div>}
              <button className="btn glass small" onClick={doReset} disabled={state === 'ready'} title="Reiniciar el tiempo de esta diapositiva (R)"><RotateCcw size={14} /> Reiniciar</button>
            </div>
            {!blind && <div className="p-progress thin"><i style={{ width: `${slidePct}%` }} className={budgetMs && sMs > budgetMs ? 'over' : ''} /></div>}
          </div>

          {who === 'all' && deck.presenters?.length > 0 && (
            <div className="card-dark p-who">
              <div className="row between"><small>Presenta ahora</small>{deck.presenterOf?.[page] ? <Chip deck={deck} id={deck.presenterOf[page]} /> : <small>Sin asignar</small>}</div>
              {!blind && c && (
                <ul>{deck.presenters.map((pp) => {
                  const ms = plan.reduce((a, _, i) => a + (deck.presenterOf?.[i] === pp.id ? (i === c.cur ? sMs : c.done[i]) : 0), 0);
                  const pl = plan.reduce((a, b, i) => a + (deck.presenterOf?.[i] === pp.id && !deck.skipped?.[i] ? b : 0), 0) * 1000;
                  return <li key={pp.id}><span>{pp.name}</span><b className={ms > pl ? 'over' : ''}>{fmt(ms)}</b><small>/ {fmt(pl)}</small></li>;
                })}</ul>
              )}
            </div>
          )}

          <div className="card-dark p-next">
            <small>Siguiente</small>
            {nextPage < count ? <Slide doc={doc} page={nextPage} className="thumb" /> : <div className="slide-empty small">Última diapositiva</div>}
            <div className="row">
              <button className="btn glass" onClick={() => go(page - 1)} disabled={page === 0}>←</button>
              <button className="btn glass grow" onClick={() => go(page + 1)} disabled={nextPage >= count}>Siguiente →</button>
            </div>
          </div>

          <div className="card-dark p-laps">
            <small>Cronómetro por diapositiva</small>
            <ol>
              {plan.map((b, i) => {
                if (hidden(i)) return null;
                const ms = c ? (i === c.cur ? sMs : c.done[i]) : 0;
                return (
                  <li key={i} className={`${i === page ? 'now' : ''} ${!blind && b && ms > b * 1000 ? 'over' : ''}`} onClick={() => go(i)}>
                    <span>{i + 1}</span><span className="muted">{blind ? '' : b ? fmt(b * 1000) : 'anexo'}</span><b>{blind ? '·' : ms ? fmt(ms) : '—'}</b>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>

      {/* Móvil: controles siempre a mano */}
      {/* Móvil sin teleprompter: ritmo, progreso y la siguiente diapositiva en el espacio libre */}
      {!prompter && state !== 'ready' && (
        <section className="m-panel">
          {!blind && (
            <div className="row between">
              <span className="small">Transcurrido {fmt(total)}</span>
              <span className={`chip ${p >= 0 ? 'green' : 'red'}`}>{p >= 0 ? `${fmt(p, true)} adelantado` : `${fmt(p)} tarde`}</span>
            </div>
          )}
          {!blind && <div className="p-progress"><i style={{ width: `${Math.min(100, (total / targetMs) * 100)}%` }} /></div>}
          <div className="m-next-prev">
            <small>Siguiente</small>
            {nextPage < count ? <Slide doc={doc} page={nextPage} className="thumb" /> : <div className="slide-empty small">Última diapositiva</div>}
          </div>
        </section>
      )}

      <nav className="m-bar" aria-label="Controles">
        {state !== 'ready' && !blind && budgetMs > 0 && <span className="m-progress"><i style={{ width: `${slidePct}%` }} className={sMs > budgetMs ? 'over' : ''} /></span>}
        {state === 'ready' ? (
          <button className="btn primary m-start" onClick={start}><Play size={18} /> Iniciar</button>
        ) : (
          <>
            <button className="btn glass m-nav" onClick={() => go(page - 1)} disabled={page === 0} aria-label="Diapositiva anterior"><ChevronLeft size={22} /></button>
            <button className="btn glass m-nav" onClick={togglePause} aria-label={state === 'paused' ? 'Reanudar' : 'Pausar'}>{state === 'paused' ? <Play size={18} /> : <Pause size={18} />}</button>
            <div className="m-info">
              <small>{who === 'all' ? `${page + 1} / ${count}` : `${mine.indexOf(page) + 1} / ${mine.length} · ${who === 'none' ? 'sin asignar' : presenterName(deck, who)}`}{who === 'all' && deck.presenterOf?.[page] && ` · ${presenterName(deck, deck.presenterOf[page])}`}</small>
              {blind ? <b>—</b> : <b className={budgetMs && sMs > budgetMs ? 'over' : ''}>{fmt(sMs)}{budgetMs ? <small> / {fmt(budgetMs)}</small> : null}</b>}
            </div>
            <button className="btn coral m-next" onClick={() => go(page + 1)} disabled={nextPage >= count}>Siguiente <ChevronRight size={18} /></button>
          </>
        )}
      </nav>
    </div>
  );
}

// Pantalla al terminar: total frente al plan, barras por diapositiva, las 3 que más se desviaron y la grabación.
function Result({ deck, plan, result, setResult, leave, canSave, accounts }) {
  const audioEl = useRef(null);
  const s = result.session;
  const planMs = plan.reduce((a, b) => a + b, 0) * 1000;
  const real = plan.map((_, i) => s.slides.filter((x) => x.index === i).reduce((a, x) => a + x.ms, 0));
  const rows = plan.map((b, i) => ({ i, plan: b * 1000, real: real[i], resets: s.resets?.[i] || 0 })).filter((r) => r.plan || r.real);
  const worst = [...rows].sort((a, b) => Math.abs(b.real - b.plan) - Math.abs(a.real - a.plan)).slice(0, 3).filter((r) => Math.abs(r.real - r.plan) > 1000);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.plan, r.real)));
  const diff = s.totalMs - planMs;
  const seek = (t) => { if (audioEl.current) { audioEl.current.currentTime = t; audioEl.current.play(); } };
  return (
    <div className="present result-page">
      <main className="result wrap">
        <span className="eyebrow">{s.blind ? 'Ensayo a ciegas' : 'Ensayo terminado'}</span>
        <h1>{fmt(s.totalMs)} <small className="muted">· plan {fmt(planMs)}</small></h1>
        <p className={diff > 0 ? 'err' : 'ok-text'}>{diff > 0 ? `Te pasaste ${fmt(diff)} de tu plan.` : `Terminaste ${fmt(-diff)} antes de lo planeado.`} Tiempo máximo: {fmt(s.targetMs)}.</p>
        {worst.length > 0 && (
          <div className="card-dark">
            <b>Las que más se desviaron</b>
            <ul className="worst">{worst.map((r) => <li key={r.i}>Diapositiva {r.i + 1}: {fmt(r.real)} frente a {fmt(r.plan)} <span className={r.real > r.plan ? 'err' : 'ok-text'}>({fmt(r.real - r.plan, true)})</span></li>)}</ul>
          </div>
        )}
        <div className="card-dark result-bars">
          {rows.map((r) => (
            <div key={r.i} className="rb">
              <span>{r.i + 1}</span>
              <div className="bars">
                <span className="bar plan"><i style={{ width: `${(r.plan / max) * 100}%` }} /></span>
                <span className={`bar real ${r.real > r.plan * 1.15 ? 'over' : ''}`}><i style={{ width: `${(r.real / max) * 100}%` }} /></span>
              </div>
              <small>{fmt(r.real)}{r.resets ? ` · reiniciada ${r.resets} ${r.resets === 1 ? 'vez' : 'veces'}` : ''}</small>
            </div>
          ))}
        </div>

        {result.blob && (
          <div className="card-dark rec-box">
            <b><Mic size={16} /> Tu grabación · {fmt(result.seconds * 1000)}</b>
            <audio ref={audioEl} controls src={result.url} />
            <div className="marks">
              {result.marks.map((m, i) => (
                <button key={i} className={`btn glass small ${m.type === 'reset' ? 'reset' : ''}`} onClick={() => seek(m.t)}>
                  {m.type === 'reset' ? `↺ Reinicio diap. ${m.index + 1}` : `Diap. ${m.index + 1}`} · {fmt(m.t * 1000)}
                </button>
              ))}
            </div>
            <div className="row">
              <a className="btn glass small" href={result.url} download={`ensayo-${deck.title}.${result.blob.type.includes('mp4') ? 'm4a' : 'webm'}`}><Download size={14} /> Descargar</a>
              <button className="btn glass small" onClick={() => { URL.revokeObjectURL(result.url); setResult({ ...result, blob: null, url: null }); }}><Trash2 size={14} /> Borrar</button>
              {canSave
                ? <label className="inline"><input type="checkbox" checked={result.save} onChange={(e) => setResult({ ...result, save: e.target.checked })} /> Guardar la grabación en mi cuenta</label>
                : <small className="muted">{accounts ? <><Link to="/login">Inicia sesión</Link> para guardar grabaciones; si no, se borra al cerrar la página.</> : 'La grabación se queda solo en este dispositivo hasta cerrar la página.'}</small>}
            </div>
            {!result.save && canSave && <small className="muted">Sin guardar, la grabación se borra al cerrar esta página.</small>}
          </div>
        )}
        {result.status && <p className="notice">{result.status}</p>}
        <div className="row">
          <button className="btn primary" onClick={() => leave('report')}>Ver informe completo</button>
          <button className="btn glass" onClick={() => leave('again')}><RotateCcw size={14} /> Ensayar otra vez</button>
        </div>
      </main>
    </div>
  );
}
