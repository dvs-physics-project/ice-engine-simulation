/* charts.js — two canvas charts drawn straight from an engine's spec: the valve-timing diagram
   (intake/exhaust lift from the real cam → valve chain, piston travel, spark or injection mark)
   and the indicator P–V diagram. Each engine passes its own scales. Colours come from the
   page's CSS tokens, so both themes work. */
(function () {
'use strict';
const C = {};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const strokeCol = { intake: '--intake', compression: '--compression', power: '--power', exhaust: '--exhaust' };
const num = v => String(v).replace('.', ',');

function alpha(col, a) {                    // works for #rrggbb tokens
  if (col[0] !== '#') return col;
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* cfg: { E, lift(side 'in'|'ex', phaseDeg) → mm, yMax, yTicks, marker: { at, label } | { from, to, label } } */
C.drawLift = function (cv, phase, cfg) {
  const E = cfg.E, g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const L = 50, R = 18, T = 30, B = 52, pw = W - L - R, ph = H - T - B;
  const ink = css('--ink'), muted = css('--muted'), rule = css('--rule'), accent = css('--accent');
  const cIn = css('--intake'), cEx = css('--power'), inkA = a => alpha(ink.startsWith('#') ? ink : '#1d2c8a', a);
  g.clearRect(0, 0, W, H);
  g.font = '500 19px "Fira Sans Extra Condensed", sans-serif';
  const X = a => L + a / 720 * pw, Y = mm => T + ph - mm / cfg.yMax * ph;
  g.strokeStyle = rule; g.lineWidth = 1;
  cfg.yTicks.forEach(mm => { g.beginPath(); g.moveTo(L, Y(mm)); g.lineTo(L + pw, Y(mm)); g.stroke();
    g.fillStyle = muted; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(mm, L - 8, Y(mm)); });
  // stroke bands
  [['intake', 'впуск'], ['compression', 'сжатие'], ['power', 'рабочий ход'], ['exhaust', 'выпуск']].forEach(([k, name], i) => {
    const c = css(strokeCol[k]);
    g.fillStyle = alpha(c, 0.18); g.fillRect(X(i * 180), T + ph + 8, pw / 4, 16);
    g.fillStyle = c; g.fillRect(X(i * 180), T + ph + 8, pw / 4, 3);
    g.fillStyle = css('--text'); g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(name, X(i * 180 + 90), T + ph + 28);
  });
  // injection band (diesel): drawn under the curves
  const mk = cfg.marker;
  if (mk && mk.from !== undefined) {
    g.fillStyle = alpha(accent.startsWith('#') ? accent : '#cf4413', 0.16);
    g.fillRect(X(mk.from), T, X(mk.to) - X(mk.from), ph);
  }
  // TDC / BDC
  g.setLineDash([4, 4]); g.strokeStyle = inkA(0.35);
  [0, 180, 360, 540, 720].forEach((a, k) => {
    g.beginPath(); g.moveTo(X(a), T - 4); g.lineTo(X(a), T + ph); g.stroke();
    g.fillStyle = ink; g.textAlign = k === 0 ? 'left' : k === 4 ? 'right' : 'center'; g.textBaseline = 'bottom';
    g.fillText(k % 2 ? 'НМТ' : 'ВМТ', X(a), T - 6);
  });
  g.setLineDash([]);
  // piston travel (0 at TDC = top of the plot)
  g.strokeStyle = inkA(0.55); g.lineWidth = 1.6; g.beginPath();
  for (let a = 0; a <= 720; a += 4) {
    const psi = (a % 360) * Math.PI / 180;
    const pin = E.r * Math.cos(psi) + Math.sqrt(E.rodLen ** 2 - (E.r * Math.sin(psi)) ** 2);
    const y = T + (E.r + E.rodLen - pin) / E.stroke * ph;
    a ? g.lineTo(X(a), y) : g.moveTo(X(a), y);
  }
  g.stroke();
  // valve lifts
  for (const [s, col] of [['in', cIn], ['ex', cEx]]) {
    g.beginPath(); g.moveTo(X(0), Y(0));
    for (let a = 0; a <= 720; a += 2) g.lineTo(X(a), Y(cfg.lift(s, a)));
    g.lineTo(X(720), Y(0)); g.closePath();
    g.fillStyle = alpha(col, 0.2); g.fill();
    g.beginPath();
    for (let a = 0; a <= 720; a += 2) { const y = Y(cfg.lift(s, a)); a ? g.lineTo(X(a), y) : g.moveTo(X(a), y); }
    g.strokeStyle = col; g.lineWidth = 2.6; g.stroke();
  }
  // spark line / injection label
  if (mk) {
    g.fillStyle = accent; g.textAlign = 'center'; g.textBaseline = 'bottom';
    if (mk.at !== undefined) {
      g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); g.moveTo(X(mk.at), T + ph); g.lineTo(X(mk.at), Y(cfg.yMax * 0.36)); g.stroke();
      g.fillText(mk.label, X(mk.at), Y(cfg.yMax * 0.38));
    } else {
      g.fillText(mk.label, (X(mk.from) + X(mk.to)) / 2, Y(cfg.yMax * 0.38));
    }
  }
  // cursor
  const x = X(phase);
  g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); g.moveTo(x, T - 2); g.lineTo(x, T + ph + 4); g.stroke();
  for (const [s, col] of [['in', cIn], ['ex', cEx]]) {
    const l = cfg.lift(s, phase);
    if (l > 0.05) { g.fillStyle = col; g.beginPath(); g.arc(x, Y(l), 6, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = muted; g.save(); g.translate(14, T + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('подъём, мм', 0, 0); g.restore();
};

/* cfg: { E, vMax, vTicks, pLo, pHi, pTicks } — V in cm³, P in bar (log scale) */
C.drawPV = function (cv, state, cfg) {
  const E = cfg.E, g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const L = 64, R = 18, T = 20, B = 50, pw = W - L - R, ph = H - T - B;
  const ink = css('--ink'), muted = css('--muted'), rule = css('--rule'), accent = css('--accent');
  g.clearRect(0, 0, W, H);
  g.font = '500 19px "Fira Sans Extra Condensed", sans-serif';
  const lo = Math.log10(cfg.pLo), hi = Math.log10(cfg.pHi);
  const X = cc => L + cc / cfg.vMax * pw, Y = bar => T + ph - (Math.log10(Math.max(bar, cfg.pLo)) - lo) / (hi - lo) * ph;
  g.strokeStyle = rule; g.lineWidth = 1;
  cfg.pTicks.forEach(b => { g.beginPath(); g.moveTo(L, Y(b)); g.lineTo(L + pw, Y(b)); g.stroke();
    g.fillStyle = muted; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(num(b), L - 8, Y(b)); });
  cfg.vTicks.forEach(v => { g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), T + ph); g.stroke();
    g.fillStyle = muted; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(v, X(v), T + ph + 6); });
  g.fillStyle = muted; g.textAlign = 'center'; g.fillText('V, см³', L + pw / 2, T + ph + 26);
  g.save(); g.translate(16, T + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText('P, бар', 0, 0); g.restore();
  g.setLineDash([4, 4]); g.strokeStyle = alpha(ink.startsWith('#') ? ink : '#1d2c8a', 0.4);
  [[E.Vc * 1e6, 'ВМТ'], [E.Vbdc * 1e6, 'НМТ']].forEach(([v, t]) => { g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), T + ph); g.stroke();
    g.fillStyle = ink; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(t, X(v) + 4, T + 2); });
  g.setLineDash([]);
  const pts = E.cycle;
  g.lineWidth = 3;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    g.strokeStyle = css(strokeCol[a.stroke]);
    g.beginPath(); g.moveTo(X(a.V * 1e6), Y(a.P / 1e5)); g.lineTo(X(b.V * 1e6), Y(b.P / 1e5)); g.stroke();
  }
  if (state) {
    const x = X(state.V * 1e6), y = Y(state.P / 1e5);
    g.fillStyle = accent; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = css('--sheet') || '#fff'; g.lineWidth = 2.5; g.stroke();
  }
};

window.CHARTS = C;
})();
