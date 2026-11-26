import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fmt, words, estimateSlides, budgets, perSlide, cuts, analyze, trimPlan, CONTEXTS } from './lib.js';
import { getDeck, updateDeck, putDeck } from './store.js';
import { Play, ScrollText } from 'lucide-react';
import DeckMenu from './DeckMenu.jsx';
import Slide, { usePdf } from './Slide.jsx';
import { AppNav } from './Dashboard.jsx';

const VERDICTS = {
  short: { label: 'Se queda corta', color: '#6d58a5' },
  ok: { label: 'Cómoda', color: '#397449' },
  tight: { label: 'Justa', color: '#b7791f' },
  over: { label: 'Te vas a pasar', color: '#c43c32' },
};

export default function Deck() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const nav = useNavigate();
  const doc = usePdf(id);
  const [deck, setDeck] = useState(null);
  const [sel, setSel] = useState(q.get('session'));
  const [saved, setSaved] = useState('');

  useEffect(() => { getDeck(id).then((d) => (d ? setDeck(d) : nav('/app'))); }, [id]);
  const count = doc?.numPages ?? 0;

  const save = async (patch) => {
    setDeck((d) => ({ ...d, ...patch }));
    setDeck(await updateDeck(id, patch));
    setSaved('Guardado ✓'); setTimeout(() => setSaved(''), 1500);
  };

  // Primera carga: guardar nº de páginas y alinear notas.
  useEffect(() => {
    if (deck && count && deck.slideCount !== count) save({ slideCount: count, notes: Array.from({ length: count }, (_, i) => deck.notes[i] || '') });
  }, [deck?.id, count]);

  const plan = useMemo(() => (deck && count ? budgets(deck, count) : []), [deck, count]);
  if (!deck) return <div className="app"><AppNav /><main className="wrap"><p className="muted">Cargando…</p></main></div>;

  const skipped = deck.skipped || [];
  const excluded = Array.from({ length: count }, (_, i) => !!skipped[i] || (!!deck.slideTargets && plan[i] === 0)); // omitidas o anexos
  const est = count ? estimateSlides(deck.notes, count, deck.wpm, excluded).reduce((a, b) => a + b, 0) : 0;
  const targetSec = deck.targetMinutes * 60;
  const A = analyze(est, targetSec, deck.context);
  const V = VERDICTS[A.verdict];
  const trim = A.mid > targetSec ? trimPlan(deck.notes, excluded, A.mid - targetSec, deck.wpm || 130) : null;
  const lastRun = deck.sessions.at(-1);
  const session = deck.sessions.find((s) => s.id === sel) || deck.sessions.at(-1);
  const real = session ? perSlide(session.slides, count) : [];
  const toCut = session && session.totalMs > session.targetMs ? cuts(plan, real) : [];
  const maxBar = Math.max(1, ...plan.map((x) => x * 1000), ...real);
  const hasNotes = deck.notes.some((n) => n?.trim());
  // ppm necesarias para decir el guion en el tiempo planificado (5 s por diapositiva para transiciones).
  const scriptWords = deck.notes.reduce((x, n, i) => x + (excluded[i] ? 0 : words(n)), 0);
  const speakSec = plan.reduce((x, y) => x + y, 0) - excluded.filter((e) => !e).length * 5;
  const requiredWpm = Math.round(scriptWords / (Math.max(speakSec, 30) / 60));
  const best = deck.sessions.length ? deck.sessions.reduce((a, s) => (Math.abs(s.totalMs - s.targetMs) < Math.abs(a.totalMs - a.targetMs) ? s : a)) : null;
  const setTarget = (i, v) => {
    const t = [...plan]; t[i] = Math.max(0, +v || 0);
    save({ slideTargets: t, timesFromNotes: false, targetMinutes: Math.round((t.reduce((a, x) => a + x, 0) / 60) * 10) / 10 });
  };
  const toggleSkip = (i) => {
    const s = Array.from({ length: count }, (_, j) => !!skipped[j]); s[i] = !s[i];
    save({ skipped: s, slideTargets: null });
  };

  return (
    <div className="app">
      <AppNav>
        <span className="muted small">{saved}</span>
        <Link className="btn ghost" to={`/present/${id}?prompter=1`}><ScrollText size={16} /> <span className="hide-sm">Ensayar con teleprompter</span></Link>
        <Link className="btn coral" to={`/present/${id}`}><Play size={16} /> Presentar</Link>
      </AppNav>
      <main className="wrap">
        <header className="deck-head">
          <div className="deck-title-row full">
            <input className="title-input" aria-label="Título" value={deck.title} onChange={(e) => setDeck({ ...deck, title: e.target.value })} onBlur={(e) => save({ title: e.target.value })} />
            <DeckMenu deck={deck} onDuplicated={(c) => nav(`/app/deck/${c.id}`)} onDeleted={() => nav('/app')} />
          </div>
          <div className="row">
            <label className="inline">Tiempo máximo
              <input type="number" min="1" step="0.5" value={deck.targetMinutes} onChange={(e) => save({ targetMinutes: +e.target.value || 1, slideTargets: null })} /> min
            </label>
            <label className="inline">Ritmo de habla
              <input type="number" min="60" max="220" value={deck.wpm || 130} onChange={(e) => save({ wpm: +e.target.value || 130, slideTargets: null })} /> ppm
            </label>
            <label className="inline">Contexto
              <select value={deck.context || 'defensa'} onChange={(e) => save({ context: e.target.value })}>
                {Object.entries(CONTEXTS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </label>
            {deck.timesFromNotes && deck.slideTargets && <span className="chip green">⏱ Tiempos importados de tus notas</span>}
            {deck.slideTargets && <button className="btn ghost small" onClick={() => save({ slideTargets: null })}>↺ Reparto automático</button>}
          </div>
        </header>

        <section className="grid2">
          <div className="card analysis">
            <div className="row between"><span className="eyebrow">Pre-análisis</span><span className="chip" style={{ background: V.color }}>{V.label}</span></div>
            <div className="big-num">{fmt(A.mid * 1000)}</div>
            <p className="muted">entre <b>{fmt(A.lo * 1000)}</b> y <b>{fmt(A.hi * 1000)}</b> según tu ritmo del día</p>
            <div className="usage" title={`${Math.round(A.pct * 100)} % del tiempo`}>
              <i style={{ width: `${Math.min(100, (A.pct / 1.3) * 100)}%`, background: V.color }} />
              <span className="usage-limit" style={{ left: `${100 / 1.3}%` }} />
            </div>
            <p>Ocupa el <b>{Math.round(A.pct * 100)} %</b> de tus {deck.targetMinutes.toLocaleString('es')} min: {A.mid > targetSec ? <>te pasas unos <b>{fmt((A.mid - targetSec) * 1000)}</b></> : <>te sobran <b>{fmt((targetSec - A.mid) * 1000)}</b></>}. Probabilidad de pasarte: <b>{Math.round(A.pOver * 100)} %</b>.</p>
            {A.verdict === 'short' && A.suggestMin < deck.targetMinutes && (
              <p className="tip">Te bastan <b>{A.suggestMin} min</b> incluso con un ritmo lento. <button className="btn ghost small" onClick={() => save({ targetMinutes: A.suggestMin, slideTargets: null })}>Usar {A.suggestMin} min</button></p>
            )}
            {trim && hasNotes && (
              <div className="tip">
                <b>✂️ Qué recortar:</b> unas <b>{trim.toCut} palabras</b> de guion (o hablar a {requiredWpm} ppm). Donde más se nota:
                <ul>{trim.slides.map((x) => <li key={x.index}>Diapositiva {x.index + 1}: −{x.cut} de {x.words} palabras</li>)}</ul>
                {trim.rest > 0 && <p className="small">Aun así faltarían ~{trim.rest} palabras: plantéate omitir alguna diapositiva o pedir más tiempo.</p>}
              </div>
            )}
            <label className="inline guess">Creo que dura
              <input type="number" min="0" step="0.5" placeholder="?" value={deck.guessMinutes ?? ''} onChange={(e) => save({ guessMinutes: e.target.value === '' ? null : +e.target.value })} /> min
            </label>
            {deck.guessMinutes > 0 && (
              <p className="small">Creías {deck.guessMinutes} min; la estimación es {fmt(A.mid * 1000)} ({A.mid > deck.guessMinutes * 60 ? 'te quedabas corto' : 'te pasabas'} por {fmt(Math.abs(A.mid - deck.guessMinutes * 60) * 1000)}).</p>
            )}
            {lastRun && <p className="small">⏱ Último ensayo real: <b>{fmt(lastRun.totalMs)}</b> · estimado {fmt(A.mid * 1000)} ({fmt(lastRun.totalMs - A.mid * 1000, true)}).</p>}
            {best && deck.sessions.length > 1 && <p className="small">🏆 Mejor ensayo: <b>{fmt(best.totalMs)}</b> de {deck.sessions.length}.</p>}
            <p className="muted small">
              {hasNotes ? `Basado en ${scriptWords} palabras de notas a ${deck.wpm || 130} ppm + transiciones, contexto «${CONTEXTS[deck.context || 'defensa'].label}»${skipped.some(Boolean) ? ` · ${skipped.filter(Boolean).length} diapositivas omitidas` : ''}.` : 'Sin notas del orador: añade tu guion abajo para una estimación precisa (y para el teleprompter).'}
            </p>
          </div>
          <div className="card">
            <span className="eyebrow">Ensayos</span>
            {deck.sessions.length === 0 ? (
              <p className="muted">Todavía no has ensayado. Pulsa <b>Presentar</b> y luego <b>Iniciar</b>.</p>
            ) : (
              <ul className="sessions">
                {[...deck.sessions].reverse().map((s, i) => {
                  const d = s.totalMs - s.targetMs;
                  return (
                    <li key={s.id} className={s.id === session?.id ? 'on' : ''} onClick={() => setSel(s.id)}>
                      <span>#{deck.sessions.length - i} · {new Date(s.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <b>{fmt(s.totalMs)}</b>
                      <span className={`chip ${d > 0 ? 'red' : 'green'}`}>{d > 0 ? `+${fmt(d)} pasado` : `${fmt(-d)} margen`}</span>
                      <button className="x" title="Borrar ensayo" onClick={async (e) => { e.stopPropagation(); setDeck(await putDeck({ ...deck, sessions: deck.sessions.filter((x) => x.id !== s.id) })); }}>×</button>
                    </li>
                  );
                })}
              </ul>
            )}
            {toCut.length > 0 && (
              <div className="cuts">
                <b>✂️ Dónde recortar</b> — te pasaste {fmt(session.totalMs - session.targetMs)}. Estas diapositivas se comen más tiempo del previsto:
                <ul>{toCut.map((c) => <li key={c.index}>Diapositiva {c.index + 1}: <b>+{fmt(c.overMs)}</b> sobre su plan</li>)}</ul>
              </div>
            )}
          </div>
        </section>

        <h2 className="left">Diapositiva a diapositiva</h2>
        <p className="muted">Edita el guion (alimenta el teleprompter), el tiempo de cada diapositiva u omítela. <span className="legend"><i className="plan" /> plan <i className="real" /> {session ? 'ensayo seleccionado' : 'ensayo'}</span></p>
        <div className="slides-list">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className={`slide-row card ${skipped[i] ? 'skipped' : ''}`}>
              <div className="slide-row-thumb"><span className="num">{i + 1}</span><Slide doc={doc} page={i} className="thumb" /></div>
              <textarea
                placeholder="Escribe aquí lo que vas a decir en esta diapositiva…"
                defaultValue={deck.notes[i] || ''}
                onBlur={(e) => { if (e.target.value !== (deck.notes[i] || '')) { const n = [...deck.notes]; n[i] = e.target.value; save({ notes: n }); } }}
              />
              <div className="slide-row-time">
                <label className="inline">Plan
                  <input type="number" min="0" value={plan[i] ?? 0} disabled={skipped[i]} onChange={(e) => setTarget(i, e.target.value)} /> s
                </label>
                <div className="bars">
                  <span className="bar plan"><i style={{ width: `${((plan[i] * 1000) / maxBar) * 100}%` }} /></span>
                  {session && <span className={`bar real ${real[i] > plan[i] * 1000 * 1.15 ? 'over' : ''}`}><i style={{ width: `${(real[i] / maxBar) * 100}%` }} /></span>}
                </div>
                <small className={session && real[i] > plan[i] * 1000 * 1.15 ? 'err' : 'muted'}>{session ? `Real ${fmt(real[i])} · ` : ''}{words(deck.notes[i])} palabras</small>
                <label className="inline small"><input type="checkbox" checked={!!skipped[i]} onChange={() => toggleSkip(i)} /> Omitir al presentar</label>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
