// ─────────────────────────────────────────────────────────────
// dashboard.js — Chart rendering and UI update layer
// Depends on: Chart.js, ble.js, hrv.js
// ─────────────────────────────────────────────────────────────

const Dashboard = (() => {

  // ── State ────────────────────────────────────────────────
  const state = {
    phase:      'supine',       // supine | transition | standing
    sessionId:  null,
    rrBuffer:   [],             // raw RR intervals for current phase
    allRR:      { supine: [], transition: [], standing: [] },
    charts:     {},
    ecgData:    new Array(300).fill(0),
    ecgT:       0,
    intervals:  {},
  };

  // ── DOM helpers ──────────────────────────────────────────
  const el  = (id) => document.getElementById(id);
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };

  // ── Initialise ───────────────────────────────────────────
  function init() {
    initClock();
    initECG();
    initHRVChart();
    initPoincareChart();
    startSimulation(); // Remove this line when using real BLE
  }

  // ── Clock ────────────────────────────────────────────────
  function initClock() {
    function tick() {
      const now = new Date();
      set('clock', now.toLocaleTimeString('en-CA', { hour12: false }));
    }
    tick();
    state.intervals.clock = setInterval(tick, 1000);
  }

  // ── ECG canvas ───────────────────────────────────────────
  function initECG() {
    const canvas = el('ecg-canvas');
    if (!canvas) return;
    canvas.width  = canvas.offsetWidth || 900;
    canvas.height = 80;
    state.ecgCtx  = canvas.getContext('2d');
    state.intervals.ecg = setInterval(drawECG, 33);
  }

  function ecgWaveform(t) {
    const phase = t % 100;
    if (phase < 5)   return 0;
    if (phase < 7)   return -0.2;
    if (phase < 10)  return 0;
    if (phase < 11)  return 1;
    if (phase < 12)  return -0.5;
    if (phase < 13)  return 0.8;
    if (phase < 16)  return 0;
    if (phase < 22)  return 0.3 * Math.sin((phase - 16) / 6 * Math.PI);
    return 0;
  }

  function drawECG() {
    const ctx    = state.ecgCtx;
    const canvas = ctx.canvas;

    state.ecgData.shift();
    state.ecgData.push(ecgWaveform(state.ecgT++) + (Math.random() - 0.5) * 0.04);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(31,31,53,0.8)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Trace
    ctx.strokeStyle = '#e94057';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#e94057';
    ctx.shadowBlur = 4;
    ctx.beginPath();

    const mid   = canvas.height / 2;
    const scale = 28;
    for (let i = 0; i < state.ecgData.length; i++) {
      const x = (i / state.ecgData.length) * canvas.width;
      const y = mid - state.ecgData[i] * scale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── HRV + HR timeline chart ──────────────────────────────
  function initHRVChart() {
    const canvas = el('chart-hrv');
    if (!canvas) return;

    const labels = [];
    for (let i = 0; i < 60; i++) labels.push(i % 5 === 0 ? i + 's' : '');

    state.charts.hrv = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Heart Rate (bpm)', data: [], borderColor: '#e94057', borderWidth: 2, pointRadius: 0, tension: 0.4, yAxisID: 'y1' },
          { label: 'RMSSD (ms)',       data: [], borderColor: '#22d3a0', borderWidth: 2, pointRadius: 0, tension: 0.4, yAxisID: 'y2' },
        ]
      },
      options: {
        responsive: true, animation: false,
        plugins: {
          legend: { labels: { color: '#6b698a', font: { family: 'IBM Plex Mono', size: 10 }, boxWidth: 10 } }
        },
        scales: {
          x:  { ticks: { color: '#6b698a', font: { family: 'IBM Plex Mono', size: 8 }, maxTicksLimit: 12 }, grid: { color: 'rgba(31,31,53,0.8)' } },
          y1: { position: 'left',  ticks: { color: '#e94057', font: { size: 9, family: 'IBM Plex Mono' } }, grid: { color: 'rgba(31,31,53,0.8)' } },
          y2: { position: 'right', ticks: { color: '#22d3a0', font: { size: 9, family: 'IBM Plex Mono' } }, grid: { display: false } },
        }
      }
    });
  }

  // ── Poincaré chart ───────────────────────────────────────
  function initPoincareChart() {
    const canvas = el('chart-poincare');
    if (!canvas) return;

    state.charts.poincare = new Chart(canvas.getContext('2d'), {
      type: 'scatter',
      data: { datasets: [
        { label: 'Supine',   data: [], backgroundColor: 'rgba(79,142,247,0.5)',  pointRadius: 3 },
        { label: 'Standing', data: [], backgroundColor: 'rgba(233,64,87,0.5)',   pointRadius: 3 },
      ]},
      options: {
        responsive: true, animation: false,
        plugins: { legend: { labels: { color: '#6b698a', font: { family: 'IBM Plex Mono', size: 9 }, boxWidth: 8 } } },
        scales: {
          x: { title: { display: true, text: 'RR(n) ms', color: '#6b698a', font: { size: 9 } }, ticks: { color: '#6b698a', font: { size: 8 } }, grid: { color: 'rgba(31,31,53,0.8)' } },
          y: { title: { display: true, text: 'RR(n+1) ms', color: '#6b698a', font: { size: 9 } }, ticks: { color: '#6b698a', font: { size: 8 } }, grid: { color: 'rgba(31,31,53,0.8)' } },
        }
      }
    });
  }

  // ── Receive a real BLE reading ───────────────────────────
  function onBLEData({ hr, rrIntervals }) {
    set('hr',   hr);

    for (let i = 0; i < rrIntervals.length; i++) {
      state.rrBuffer.push(rrIntervals[i]);
      state.allRR[state.phase].push(rrIntervals[i]);
    }

    const rr = state.rrBuffer.slice(-60); // last 60 intervals
    set('rmssd', HRV.rmssd(rr));
    set('sdnn',  HRV.sdnn(rr));
    set('hrv',   HRV.hrvScore(rr));

    updateHRVChart(hr, HRV.rmssd(rr));
    updatePoincare(state.phase, rrIntervals);
  }

  // ── Update HRV chart with new point ──────────────────────
  function updateHRVChart(hr, rmssdVal) {
    const chart = state.charts.hrv;
    if (!chart) return;

    chart.data.datasets[0].data.push(hr);
    chart.data.datasets[1].data.push(rmssdVal);

    // Keep last 60 points
    for (let d = 0; d < chart.data.datasets.length; d++) {
      if (chart.data.datasets[d].data.length > 60) {
        chart.data.datasets[d].data.shift();
      }
    }
    chart.update('none');
  }

  // ── Update Poincaré plot ──────────────────────────────────
  function updatePoincare(phase, rr) {
    const chart = state.charts.poincare;
    if (!chart || rr.length < 2) return;

    const datasetIndex = phase === 'standing' ? 1 : 0;
    for (let i = 0; i < rr.length - 1; i++) {
      chart.data.datasets[datasetIndex].data.push({ x: rr[i], y: rr[i + 1] });
    }
    chart.update('none');
  }

  // ── Set protocol phase ────────────────────────────────────
  function setPhase(newPhase) {
    state.phase = newPhase;
    state.rrBuffer = [];
    console.log('Phase →', newPhase);
  }

  // ── Simulation (demo mode — no BLE device) ───────────────
  function startSimulation() {
    let simT = 0;
    state.intervals.sim = setInterval(() => {
      simT++;
      const isStanding = simT > 150;
      const baseHR  = isStanding ? 82 : 64;
      const baseRMSSD = isStanding ? 38 : 58;

      const hr    = baseHR    + Math.round((Math.random() - 0.5) * 6);
      const rmssdV = baseRMSSD + Math.round((Math.random() - 0.5) * 8);
      const rr    = Math.round(60000 / hr);

      set('hr',    hr);
      set('hrv',   Math.min(100, rmssdV));
      set('rmssd', rmssdV);
      set('sdnn',  Math.round(rmssdV * 1.3));
      set('resp',  Math.round(13 + Math.random() * 3));

      updateHRVChart(hr, rmssdV);
      updatePoincare(isStanding ? 'standing' : 'supine', [rr, rr + Math.round((Math.random()-0.5)*80)]);
    }, 1000);
  }

  // ── Public API ───────────────────────────────────────────
  return { init, onBLEData, setPhase };

})();

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => Dashboard.init());
