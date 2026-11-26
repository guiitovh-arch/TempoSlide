// Lógica pura de tiempos (sin React) — probada en test/smoke.js.

export const fmt = (ms, signed = false) => {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const t = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (neg ? '−' : signed ? '+' : '') + t;
};

export const words = (t = '') => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Estimación por diapositiva (segundos): tiempo de lectura de las notas + un mínimo para respirar/transicionar.
// ponytail: heurística lineal (wpm + base); un modelo con tipo de diapositiva (gráficos, separadores) sería la mejora.
export const estimateSlides = (notes, count, wpm = 130, skipped = [], base = 8) =>
  Array.from({ length: count }, (_, i) => (skipped[i] ? 0 : Math.max(base + (words(notes[i]) / wpm) * 60, 15)));

// Presupuesto por diapositiva escalado al tiempo objetivo total.
export const budgets = (deck, count) => {
  if (deck.slideTargets?.length === count) return deck.slideTargets.map((t, i) => (deck.skipped?.[i] ? 0 : t));
  const est = estimateSlides(deck.notes || [], count, deck.wpm || 130, deck.skipped);
  const sum = est.reduce((a, b) => a + b, 0);
  const target = deck.targetMinutes * 60;
  return est.map((s) => (sum ? Math.round((s / sum) * target) : 0));
};

// Banda del pre-análisis: estimado vs. objetivo.
export const band = (estSec, targetSec) => {
  const r = estSec / targetSec;
  if (r < 0.7) return { key: 'short', label: 'Se queda corta', color: '#6d58a5' };
  if (r < 0.95) return { key: 'ok', label: 'Cómoda', color: '#397449' };
  if (r <= 1.05) return { key: 'tight', label: 'Justa', color: '#b7791f' };
  return { key: 'over', label: 'Te vas a pasar', color: '#c43c32' };
};

// Ritmo en vivo: positivo = vas adelantado (te sobra tiempo), negativo = vas tarde.
export const pace = (budgetsSec, index, slideElapsedMs, totalElapsedMs) => {
  const plannedBefore = budgetsSec.slice(0, index).reduce((a, b) => a + b, 0) * 1000;
  const plannedNow = plannedBefore + Math.min(slideElapsedMs, budgetsSec[index] * 1000);
  return plannedNow - totalElapsedMs;
};

// Fase del temporizador por % restante.
export const phase = (remainingMs, targetMs) =>
  remainingMs < 0 ? 'over' : remainingMs <= targetMs * 0.1 ? 'danger' : remainingMs <= targetMs * 0.25 ? 'warn' : 'ok';

// Suma tiempos por diapositiva (una diapositiva puede visitarse varias veces).
export const perSlide = (slides, count) => {
  const out = Array(count).fill(0);
  for (const s of slides) if (s.index < count) out[s.index] += s.ms;
  return out;
};

// Dónde recortar: diapositivas que más se pasan de su plan en un ensayo (ms reales vs. segundos de plan).
export const cuts = (planSec, realMs, n = 3) =>
  planSec
    .map((p, i) => ({ index: i, overMs: realMs[i] - p * 1000 }))
    .filter((x) => x.overMs > 2000)
    .sort((a, b) => b.overMs - a.overMs)
    .slice(0, n);

// Marcas de tiempo al inicio de las notas, p. ej. "(30 s)", "(1 min)", "(1,5 min)". null si no hay ninguna.
// Las diapositivas sin marca (anexos) quedan en 0 s: no cuentan para el plan.
export const markedTimes = (notes) => {
  const t = notes.map((n) => {
    const m = (n || '').match(/^\s*\((\d+(?:[.,]\d+)?)\s*(s|seg|segundos?|min|minutos?|m)\.?\)/i);
    return m ? Math.round(parseFloat(m[1].replace(',', '.')) * (/^m/i.test(m[2]) ? 60 : 1)) : 0;
  });
  return t.some(Boolean) ? t : null;
};

// Estadísticas de ensayo para el perfil.
export const rehearsalStats = (decks, today = new Date()) => {
  const sessions = decks.flatMap((d) => d.sessions || []);
  const totalMs = sessions.reduce((a, s) => a + s.totalMs, 0);
  const best = sessions.length ? Math.min(...sessions.map((s) => Math.abs(s.totalMs - s.targetMs) / s.targetMs)) : null;
  // Racha: días consecutivos con al menos un ensayo, terminando hoy o ayer.
  const day = (d) => new Date(d).toISOString().slice(0, 10);
  const days = new Set(sessions.map((s) => day(s.at)));
  let streak = 0;
  const cur = new Date(today);
  if (!days.has(day(cur))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (days.has(day(cur))) { streak++; cur.setUTCDate(cur.getUTCDate() - 1); }
  return { decks: decks.length, sessions: sessions.length, totalMs, best, streak };
};

// Contextos: multiplicador por interacción con el público (preguntas, pausas).
export const CONTEXTS = {
  defensa: { label: 'Defensa (TFM, TFG, tesis)', k: 1 },
  congreso: { label: 'Congreso o charla', k: 1 },
  pitch: { label: 'Pitch a inversores', k: 1.05 },
  clase: { label: 'Clase', k: 1.1 },
  reunion: { label: 'Reunión de equipo', k: 1.15 },
};

const erf = (x) => { // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};

// Pre-análisis: duración probable con rango por variación de ritmo, % del tiempo, veredicto y probabilidad de pasarse.
// ponytail: modelo normal con ritmo ±13–15 %; un Monte Carlo por diapositiva solo cambiaría decimales.
export const analyze = (estSec, targetSec, ctx = 'defensa') => {
  const mid = estSec * (CONTEXTS[ctx]?.k ?? 1);
  const lo = mid * 0.87, hi = mid * 1.15;
  const pct = mid / targetSec;
  const sd = (hi - lo) / 3.29; // el rango cubre ~90 %
  const pOver = sd ? 0.5 * (1 - erf((targetSec - mid) / (sd * Math.SQRT2))) : +(mid > targetSec);
  const verdict = pct < 0.7 ? 'short' : pct < 0.95 ? 'ok' : pct <= 1.05 ? 'tight' : 'over';
  return { mid, lo, hi, pct, pOver, verdict, suggestMin: Math.ceil(hi / 60) };
};

// Qué recortar antes de ensayar: reparte las palabras a quitar entre las diapositivas con más guion,
// sin pasar del 40 % de cada una (recortar, no vaciar). `rest` = palabras que no caben: toca omitir diapositivas.
export const trimPlan = (notes, excluded, overSec, wpm = 130, n = 5, maxShare = 0.4) => {
  const toCut = Math.ceil((overSec / 60) * wpm);
  const top = notes.map((t, i) => ({ index: i, words: excluded[i] ? 0 : words(t) })).filter((x) => x.words).sort((a, b) => b.words - a.words).slice(0, n);
  const sum = top.reduce((a, x) => a + x.words, 0);
  const slides = top.map((x) => ({ ...x, cut: Math.min(Math.floor(x.words * maxShare), Math.ceil((x.words / sum) * toCut)) })).filter((x) => x.cut > 0);
  return { toCut, slides, rest: Math.max(0, toCut - slides.reduce((a, x) => a + x.cut, 0)) };
};
