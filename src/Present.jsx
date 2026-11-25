import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fmt, budgets, pace, phase } from './lib.js';
import { getDeck, addSession } from './store.js';
import Slide, { usePdf } from './Slide.jsx';

export default function Present() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const nav = useNavigate();
  const doc = usePdf(id);
  const [deck, setDeck] = useState(null);
  const [page, setPage] = useState(0);
  const [state, setState] = useState('ready'); // ready | running | paused
  const [, tick] = useState(0);
  const [black, setBlack] = useState(false);
  const [prompter, setPrompter] = useState(q.get('prompter') === '1');
  const [pBig, setPBig] = useState(false);
  const [pAuto, setPAuto] = useState(true);
  const [pSpeed, setPSpeed] = useState(30);
  const [pSize, setPSize] = useState(34);
  const [pMirror, setPMirror] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reloj: acumulado + tramo actual (las pausas no cuentan).
  const clock = useRef({ acc: 0, seg: 0, lapStart: 0, laps: [] });
  const elapsed = () => clock.current.acc + (state === 'running' ? performance.now() - clock.current.seg : 0);
  const prompterEl = useRef(null);
  const chan = useRef(null);

  useEffect(() => { getDeck(id).then(setDeck); }, [id]);
  const count = doc?.numPages ?? 0;
  const plan = deck && count ? budgets(deck, count) : [];
  const targetMs = (deck?.targetMinutes ?? 10) * 60_000;

  // Segunda pantalla (mismo navegador) vía BroadcastChannel.
  useEffect(() => {
    const c = new BroadcastChannel(`ts-${id}`);
    chan.current = c;
    c.onmessage = (e) => e.data === 'hello' && c.postMessage({ page: pageRef.current, black: blackRef.current });
    return () => c.close();
  }, [id]);
  const pageRef = useRef(0), blackRef = useRef(false);
  useEffect(() => { pageRef.current = page; blackRef.current = black; chan.current?.postMessage({ page, black }); }, [page, black]);

  useEffect(() => {
    if (state !== 'running') return;
    const i = setInterval(() => tick((x) => x + 1), 100);
    return () => clearInterval(i);
  }, [state]);

  useEffect(() => { if (deck?.skipped?.[0]) { const f = deck.skipped.findIndex((x) => !x); if (f > 0) setPage(f); } }, [deck]);
  const nextPage = (() => { let n = page + 1; while (deck?.skipped?.[n]) n++; return n; })();

  const start = () => {
    clock.current = { acc: 0, seg: performance.now(), lapStart: 0, laps: [] };
    setState('running');
  };
  const togglePause = () => {
    if (state === 'running') { clock.current.acc = elapsed(); setState('paused'); }
    else if (state === 'paused') { clock.current.seg = performance.now(); setState('running'); }
  };

  // Salta las diapositivas omitidas en la dirección del movimiento.
  const go = useCallback((n) => {
    if (!count) return;
    const dir = n >= page ? 1 : -1;
    let to = Math.max(0, Math.min(count - 1, n));
    while (deck?.skipped?.[to] && to + dir >= 0 && to + dir < count) to += dir;
    if (deck?.skipped?.[to]) return;
    if (to === page) return;
    if (state !== 'ready') {
      const now = elapsed();
      clock.current.laps.push({ index: page, ms: Math.round(now - clock.current.lapStart) });
      clock.current.lapStart = now;
    }
    setPage(to);
    if (prompterEl.current) prompterEl.current.scrollTop = 0;
  }, [count, page, state, deck]);

  const finish = async () => {
    if (state === 'ready') return nav(`/app/deck/${id}`);
    const now = elapsed();
    const slides = [...clock.current.laps, { index: page, ms: Math.round(now - clock.current.lapStart) }];
    setSaving(true);
    const s = await addSession(id, { totalMs: Math.round(now), targetMs, slides, mode: prompter ? 'teleprompter' : 'ensayo' });
    nav(`/app/deck/${id}?session=${s.id}`);
  };

  const openAudience = () => window.open(`/audience/${id}`, `ts-audience-${id}`, 'popup,width=1280,height=720');
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); state === 'ready' && k === 'Enter' ? start() : go(page + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(page - 1); }
      else if (k === 's' || k === 'S') state === 'ready' && start();
      else if (k === 'p' || k === 'P') togglePause();
      else if (k === 't' || k === 'T') setPrompter((x) => !x);
      else if (k === 'b' || k === 'B' || k === '.') setBlack((x) => !x);
      else if (k === 'f' || k === 'F') fullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (state === 'ready') return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  // Teleprompter: auto-ritmo = el texto termina justo cuando se acaba el presupuesto de la diapositiva.
  const total = elapsed();
  const slideMs = state === 'ready' ? 0 : total - clock.current.lapStart;
  const budgetMs = (plan[page] || 0) * 1000;
  const lastTick = useRef(performance.now());
  useEffect(() => {
    const el = prompterEl.current;
    const now = performance.now();
    const dt = (now - lastTick.current) / 1000;
    lastTick.current = now;
    if (!el || state !== 'running') return;
    const max = el.scrollHeight - el.clientHeight;
    if (pAuto) el.scrollTop = Math.min(1, slideMs / (budgetMs || 30_000)) * max;
    else el.scrollTop += pSpeed * dt;
  });

  if (!deck || !doc) return <div className="present loading">Cargando presentación…</div>;

  const remaining = targetMs - total;
  const ph = phase(remaining, targetMs);
  const p = state === 'ready' ? 0 : pace(plan, page, slideMs, total);
  const slidePct = budgetMs ? Math.min(100, (slideMs / budgetMs) * 100) : 0;
  const laps = state === 'ready' ? [] : clock.current.laps;
  const note = deck.notes?.[page] || '';

  return (
    <div className={`present phase-${ph}`}>
      <header className="p-top">
        <button className="btn glass small" onClick={finish} disabled={saving}>{state === 'ready' ? '← Salir' : saving ? 'Guardando…' : '■ Terminar y ver informe'}</button>
        <b className="p-title">{deck.title}</b>
        <div className="row">
          <button className={`btn glass small ${prompter ? 'on' : ''}`} onClick={() => setPrompter(!prompter)} title="T">📜 Teleprompter</button>
          <button className={`btn glass small ${black ? 'on' : ''}`} onClick={() => setBlack(!black)} title="B">⬛ Negro</button>
          <button className="btn glass small" onClick={openAudience}>🖥️ Pantalla público</button>
          <button className="btn glass small" onClick={fullscreen} title="F">⛶</button>
        </div>
      </header>

      <div className={`p-main ${prompter ? 'with-prompter' : ''} ${prompter && pBig ? 'prompter-big' : ''}`}>
        <section className="p-stage">
          <div className="p-slide-box">
            <Slide doc={doc} page={page} black={black} />
            {state === 'ready' && (
              <div className="p-start">
                <button className="btn primary huge" onClick={start}>▶ Iniciar</button>
                <p>El temporizador de <b>{deck.targetMinutes} min</b> arranca al pulsar. <kbd>→</kbd> avanza, <kbd>P</kbd> pausa, <kbd>T</kbd> teleprompter.</p>
              </div>
            )}
          </div>
          {prompter && (
            <div className="prompter">
              <div className="prompter-bar">
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
          <div className={`p-timer card-dark ${ph}`}>
            <small>{remaining < 0 ? 'Tiempo extra' : 'Tiempo restante'}</small>
            <div className="p-countdown">{fmt(remaining)}</div>
            <div className="p-progress"><i style={{ width: `${Math.min(100, (total / targetMs) * 100)}%` }} /></div>
            <div className="row between small">
              <span>Transcurrido {fmt(total)}</span>
              {state !== 'ready' && <span className={`chip ${p >= 0 ? 'green' : 'red'}`}>{p >= 0 ? `${fmt(p, true)} adelantado` : `${fmt(p)} tarde`}</span>}
            </div>
            {state !== 'ready' && <button className="btn glass small" onClick={togglePause}>{state === 'paused' ? '▶ Reanudar' : '❚❚ Pausar'}</button>}
          </div>

          <div className="card-dark">
            <div className="row between"><small>Diapositiva {page + 1} / {count}</small><small>{budgetMs ? `plan ${fmt(budgetMs)}` : 'fuera del plan (anexo)'}</small></div>
            <div className={`p-lap ${budgetMs && slideMs > budgetMs ? 'over' : ''}`}>{fmt(slideMs)}</div>
            <div className="p-progress thin"><i style={{ width: `${slidePct}%` }} className={budgetMs && slideMs > budgetMs ? 'over' : ''} /></div>
          </div>

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
                if (deck.skipped?.[i]) return null;
                const ms = laps.filter((l) => l.index === i).reduce((a, l) => a + l.ms, 0) + (i === page ? slideMs : 0);
                return (
                  <li key={i} className={`${i === page ? 'now' : ''} ${b && ms > b * 1000 ? 'over' : ''}`} onClick={() => go(i)}>
                    <span>{i + 1}</span><span className="muted">{b ? fmt(b * 1000) : 'anexo'}</span><b>{ms ? fmt(ms) : '—'}</b>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
