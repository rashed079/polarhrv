// ─────────────────────────────────────────────────────────────
// hrv.js — HRV metric computation
// Input: array of R-R intervals in milliseconds
// All functions are pure (no side effects)
// ─────────────────────────────────────────────────────────────

const HRV = (() => {

  // ── Mean R-R ─────────────────────────────────────────────
  function meanRR(rr) {
    if (rr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < rr.length; i++) sum += rr[i];
    return sum / rr.length;
  }

  // ── Mean Heart Rate (bpm) from R-R intervals ─────────────
  function meanHR(rr) {
    const mean = meanRR(rr);
    return mean > 0 ? Math.round(60000 / mean) : 0;
  }

  // ── RMSSD ─────────────────────────────────────────────────
  // Root mean square of successive differences
  // Primary time-domain HRV metric (parasympathetic tone)
  function rmssd(rr) {
    if (rr.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < rr.length; i++) {
      const diff = rr[i] - rr[i - 1];
      sum += diff * diff;
    }
    return Math.round(Math.sqrt(sum / (rr.length - 1)) * 10) / 10;
  }

  // ── SDNN ──────────────────────────────────────────────────
  // Standard deviation of all R-R intervals
  // Reflects overall HRV (both sympathetic + parasympathetic)
  function sdnn(rr) {
    if (rr.length < 2) return 0;
    const mean = meanRR(rr);
    let sum = 0;
    for (let i = 0; i < rr.length; i++) {
      const diff = rr[i] - mean;
      sum += diff * diff;
    }
    return Math.round(Math.sqrt(sum / rr.length) * 10) / 10;
  }

  // ── pNN50 ─────────────────────────────────────────────────
  // Percentage of successive RR differences > 50ms
  function pnn50(rr) {
    if (rr.length < 2) return 0;
    let count = 0;
    for (let i = 1; i < rr.length; i++) {
      if (Math.abs(rr[i] - rr[i - 1]) > 50) count++;
    }
    return Math.round((count / (rr.length - 1)) * 1000) / 10; // one decimal %
  }

  // ── Poincaré SD1 & SD2 ───────────────────────────────────
  // SD1: short-term variability (≈ RMSSD / √2)
  // SD2: long-term variability
  function poincare(rr) {
    if (rr.length < 2) return { sd1: 0, sd2: 0, points: [] };

    const points = [];
    let sd1sum = 0;
    let sd2sum = 0;

    for (let i = 0; i < rr.length - 1; i++) {
      points.push({ x: rr[i], y: rr[i + 1] });
    }

    const sd1 = Math.round((rmssd(rr) / Math.sqrt(2)) * 10) / 10;
    const sd2 = Math.round(
      Math.sqrt(2 * sdnn(rr) ** 2 - 0.5 * rmssd(rr) ** 2) * 10
    ) / 10;

    return { sd1, sd2, points };
  }

  // ── HRV Score (0–100 composite) ──────────────────────────
  // Simplified normative scoring; for display only
  function hrvScore(rr) {
    const r = rmssd(rr);
    // Normative range approx 20–80ms; clamp and scale
    const clamped = Math.max(0, Math.min(r, 100));
    return Math.round(clamped);
  }

  // ── Orthostatic response assessment ──────────────────────
  // Compares supine vs standing metrics
  function orthostaticScore(supineRR, standingRR) {
    const hrDelta    = meanHR(standingRR) - meanHR(supineRR);
    const rmssdDelta = rmssd(standingRR)  - rmssd(supineRR);

    const flags = [];
    if (hrDelta > 30)           flags.push('HR increase > 30 bpm — possible POTS');
    if (hrDelta < 5)            flags.push('Minimal HR response — check sensor');
    if (rmssd(standingRR) < 10) flags.push('Very low standing RMSSD');

    return {
      hr_supine:    meanHR(supineRR),
      hr_standing:  meanHR(standingRR),
      hr_delta:     hrDelta,
      rmssd_supine:   rmssd(supineRR),
      rmssd_standing: rmssd(standingRR),
      rmssd_delta:  rmssdDelta,
      result:       flags.length === 0 ? 'Normal' : 'FLAGGED',
      flags,
    };
  }

  // ── Windowed computation (rolling window) ─────────────────
  // Returns array of {t, rmssd, sdnn} for chart rendering
  function rollingMetrics(rr, windowSize = 30) {
    const out = [];
    for (let i = windowSize; i <= rr.length; i++) {
      const window = rr.slice(i - windowSize, i);
      out.push({ t: i, rmssd: rmssd(window), sdnn: sdnn(window) });
    }
    return out;
  }

  // ── Public API ────────────────────────────────────────────
  return { meanRR, meanHR, rmssd, sdnn, pnn50, poincare, hrvScore, orthostaticScore, rollingMetrics };

})();
