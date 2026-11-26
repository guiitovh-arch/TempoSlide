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
  if (r < 0.75) return { key: 'short', label: 'Se queda corta', color: '#6d58a5' };
  if (r <= 0.95) return { key: 'ok', label: 'Cómoda', color: '#397449' };
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
