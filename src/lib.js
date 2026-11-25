// Lógica pura de tiempos (sin React) — probada en test/smoke.js.

export const api = async (url, opts = {}) => {
  const r = await fetch('/api' + url, {
    ...opts,
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
  });
  if (r.status === 204) return null;
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Error');
  return j;
};

export const fmt = (ms, signed = false) => {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const t = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (neg ? '−' : signed ? '+' : '') + t;
};

export const words = (t = '') => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Estimación por diapositiva (segundos): tiempo de lectura de las notas + un mínimo para respirar/transicionar.
// ponytail: heurística lineal (wpm + base); un modelo con tipo de diapositiva (gráficos, separadores) sería la mejora.
export const estimateSlides = (notes, count, wpm = 130, base = 8) =>
  Array.from({ length: count }, (_, i) => Math.max(base + (words(notes[i]) / wpm) * 60, 15));

// Presupuesto por diapositiva escalado al tiempo objetivo total.
export const budgets = (deck, count, wpm) => {
  if (deck.slideTargets?.length === count) return deck.slideTargets;
  const est = estimateSlides(deck.notes || [], count, wpm);
  const sum = est.reduce((a, b) => a + b, 0);
  const target = deck.targetMinutes * 60;
  return est.map((s) => Math.round((s / sum) * target));
};

// Banda del pre-análisis: estimado vs. objetivo.
export const band = (estSec, targetSec) => {
  const r = estSec / targetSec;
  if (r < 0.75) return { key: 'short', label: 'Se queda corta', color: 'var(--blue)' };
  if (r <= 0.95) return { key: 'ok', label: 'Cómoda', color: 'var(--green)' };
  if (r <= 1.05) return { key: 'tight', label: 'Justa', color: 'var(--yellow)' };
  return { key: 'over', label: 'Te vas a pasar', color: 'var(--red)' };
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
