(function (root) {
'use strict';
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;
const wrapPi = a => mod(a + Math.PI, TAU) - Math.PI;
const E = { id: 'b4', DEG, TAU, mod, wrapPi };

E.bore = 83;  E.stroke = 83;  E.r = 41.5;  E.rodLen = 143.5;  E.compH = 32.5;
E.pitch = 108;
E.pinX = [-81, -27, 27, 81];
E.mainX = [-108, -54, 0, 54, 108];
E.mainD = 60;  E.mainW = 19;  E.pinD = 52;  E.pinW = 21;  E.webT = 7;
E.rodW = 20;  E.rodBig = 55;
E.pistonR = 41.3;  E.pistonH = 50;  E.pinOD = 23;  E.pinID = 14;
E.deck = 218;  E.gasket = 1.2;  E.fireFace = E.deck + E.gasket;

E.blockX = [-136, 132];
E.oilPumpX = [-150, -136];
E.flywheelX = 160;
E.headX = { R: [-149, 118], L: [-149, 158] };
E.camJournals = { R: [-130, -27, 78], L: [-120, 27, 135] };
E.camEnd = { R: 104, L: 150 };

E.nCyl = 4;
E.cyl = [];
for (let c = 0; c < 4; c++) {
  const right = c % 2 === 0;
  E.cyl.push({ n: c + 1, k: c, bank: right ? 'R' : 'L', beta: (right ? -90 : 90) * DEG, x: E.pinX[c], sgn: right ? 1 : -1 });
}
E.axisOf = c => ({ y: Math.cos(E.cyl[c].beta), z: Math.sin(E.cyl[c].beta) });
E.vSideOf = c => { const b = E.cyl[c].beta, s = E.cyl[c].sgn; return { y: -Math.sin(b) * s, z: Math.cos(b) * s }; };
E.bankPoint = function (c, x, a, s) {
  const A = E.axisOf(c), N = E.vSideOf(c);
  return [x, a * A.y + s * N.y, a * A.z + s * N.z];
};
E.pinAngle = [-90, 90, 90, -90].map(d => d * DEG);

E.kin = function (c, theta) {
  const C = E.cyl[c], alpha = E.pinAngle[c] + theta, psi = alpha - C.beta;
  const sp = Math.sin(psi), cp = Math.cos(psi);
  const d = E.r * cp + Math.sqrt(E.rodLen * E.rodLen - E.r * E.r * sp * sp);
  return {
    psi, alpha, d,
    pinY: E.r * Math.cos(alpha), pinZ: E.r * Math.sin(alpha),
    crown: d + E.compH,
    travel: E.r + E.rodLen - d,
    rodRot: C.beta + Math.atan2(-E.r * sp, d - E.r * cp),
  };
};

E.firing = [1, 3, 2, 4];
E.cycleOff = [0, 0, 0, 0];
E.firing.forEach((n, k) => { E.cycleOff[n - 1] = mod(360 - 180 * k, 720); });
E.phaseOf = (c, thetaDeg) => mod(thetaDeg + E.cycleOff[c], 720);

E.ridgeH = 13.5;  E.ridgeA = E.fireFace + E.ridgeH;
E.camA = 316;  E.camS = 0;
E.kappa = 0.5;
E.camBase = 18;  E.camJournalR = 13.5;  E.lobeW = 12;
E.camBeta = 76 * DEG;
E.peak = { in: 108, ex: 612 };
E.spark = 350;
E.vt = {
  in: { sg: 1, angle: 22 * DEG, seatS: 17, dx: 18, headR: 16.5, len: 116, shaft: { a: 347, s: 22.5 }, gamma: -8 * DEG,
        phiMax: 13.4 * DEG, lobeX: 27 },
  ex: { sg: -1, angle: 17 * DEG, seatS: -16, dx: 18, headR: 14, len: 116, shaft: { a: 347, s: -22.5 }, gamma: -4 * DEG,
        phiMax: 16.9 * DEG, lobeX: 10 },
};
E.stemR = 3;  E.screwR = 4;  E.rockerShaftR = 8;
E.springSeatT = 62;  E.springTopT = 106;
E.pocketDepth = 2.6;
E.plugTip = [E.ridgeA - 2.2, 0];  E.plugAngle = 24 * DEG;

const rot2 = (v, f) => [v[0] * Math.cos(f) - v[1] * Math.sin(f), v[0] * Math.sin(f) + v[1] * Math.cos(f)];
['in', 'ex'].forEach(side => {
  const V = E.vt[side];
  V.u = [Math.cos(V.angle), V.sg * Math.sin(V.angle)];
  V.seat = [E.ridgeA - Math.abs(V.seatS) * Math.tan(V.angle), V.seatS];
  V.tip = [V.seat[0] + V.len * V.u[0], V.seat[1] + V.len * V.u[1]];
  V.ball = [V.tip[0] + E.screwR * V.u[0], V.tip[1] + E.screwR * V.u[1]];
  V.n0 = [Math.cos(V.gamma), Math.sin(V.gamma)];
  V.C0 = [E.camA + E.camBase * V.n0[0], E.camS + E.camBase * V.n0[1]];
});
E.rockerLaw = function (side, rel) {
  const u = wrapPi(rel) / E.camBeta;
  if (Math.abs(u) >= 1) return 0;
  const w = 1 - u * u;
  return E.vt[side].phiMax * w * w;
};
E.rockerLawD = function (side, rel) {
  const u = wrapPi(rel) / E.camBeta;
  if (Math.abs(u) >= 1) return 0;
  return -4 * E.vt[side].phiMax * u * (1 - u * u) / E.camBeta;
};
E.padLine = function (side, phi) {
  const V = E.vt[side], P = [V.shaft.a, V.shaft.s], f = V.sg * phi;
  const n = rot2(V.n0, f), C = rot2([V.C0[0] - P[0], V.C0[1] - P[1]], f);
  const Cx = P[0] + C[0], Cy = P[1] + C[1];
  return { n, C: [Cx, Cy], h: n[0] * (Cx - E.camA) + n[1] * (Cy - E.camS) };
};
E.ballAt = function (side, phi) {
  const V = E.vt[side], P = [V.shaft.a, V.shaft.s], b = rot2([V.ball[0] - P[0], V.ball[1] - P[1]], V.sg * phi);
  return [P[0] + b[0], P[1] + b[1]];
};
E.liftOfPhi = function (side, phi) {
  const V = E.vt[side], B = E.ballAt(side, phi);
  return -((B[0] - V.ball[0]) * V.u[0] + (B[1] - V.ball[1]) * V.u[1]);
};
E.lobeProfile = function (side, n) {
  n = n || 360;
  const V = E.vt[side], pts = [];
  for (let k = 0; k < n; k++) {
    const T = -Math.PI + TAU * k / n, phi = E.rockerLaw(side, T), dphi = E.rockerLawD(side, T);
    const psi = V.gamma + V.sg * phi - T, dpsi = V.sg * dphi - 1;
    const h = E.padLine(side, phi).h, eps = 1e-6;
    const dhdphi = (E.padLine(side, phi + eps).h - E.padLine(side, phi - eps).h) / (2 * eps);
    const hp = dhdphi * dphi / dpsi;
    pts.push([h * Math.cos(psi) - hp * Math.sin(psi), h * Math.sin(psi) + hp * Math.cos(psi)]);
  }
  return pts;
};
E.thetaPeak = (c, side) => mod(E.peak[side] - E.cycleOff[c], 720) * DEG;
E.camRel = (c, side, theta) => E.kappa * (theta - E.thetaPeak(c, side));
E.phiAt = (c, side, theta) => E.rockerLaw(side, E.camRel(c, side, theta));
const LIFT_N = 600, liftTab = { in: [], ex: [] };
['in', 'ex'].forEach(side => { for (let k = 0; k <= LIFT_N; k++) liftTab[side].push(E.liftOfPhi(side, E.vt[side].phiMax * k / LIFT_N)); });
E.valveLiftOfPhi = function (side, phi) {
  const x = Math.max(0, Math.min(1, phi / E.vt[side].phiMax)) * LIFT_N, k = Math.min(LIFT_N - 1, Math.floor(x)), f = x - k;
  return liftTab[side][k] + (liftTab[side][k + 1] - liftTab[side][k]) * f;
};
E.valveLiftMax = { in: liftTab.in[LIFT_N], ex: liftTab.ex[LIFT_N] };
E.valveLiftAt = (c, side, theta) => E.valveLiftOfPhi(side, E.phiAt(c, side, theta));
E.valveLiftAtPhase = (side, phaseDeg) => E.valveLiftOfPhi(side, E.rockerLaw(side, (phaseDeg - E.peak[side]) * DEG * E.kappa));
E.valveLocalX = (side, j) => (j ? 1 : -1) * E.vt[side].dx;
E.lobeLocalX = (side, j) => (j ? 1 : -1) * E.vt[side].lobeX;

E.beltX = -165;  E.beltW = 24;  E.beltPitch = 9.525;
E.beltBack = 2.0;  E.beltIn = 0.8;  E.toothH = 3.6;
E.z = { crank: 22, cam: 44, pump: 24 };
E.pd = z => z * E.beltPitch / Math.PI;
E.idlerR = 34.5;  E.tensR = 38.5;
E.tensioner = { pivot: { u: 40.3, v: 39.8 }, arm: 53.6, prefer: 132 * DEG };
E.pulleys = function (gamma) {
  const t = E.tensioner, Rc = E.pd(E.z.crank) / 2, Rk = E.pd(E.z.cam) / 2;
  return [
    { key: 'camR', u: 0, v: -E.camA, R: Rk, side: 1 },
    { key: 'idler1', u: -25.4, v: -78.5, R: E.idlerR, side: -1 },
    { key: 'crank', u: 0, v: 0, R: Rc, side: 1 },
    { key: 'tens', u: t.pivot.u + t.arm * Math.cos(gamma), v: t.pivot.v + t.arm * Math.sin(gamma), R: E.tensR, side: -1 },
    { key: 'camL', u: 0, v: E.camA, R: Rk, side: 1 },
    { key: 'idler3', u: -58.8, v: 162.0, R: E.idlerR, side: -1 },
    { key: 'pump', u: -91.8, v: 94.1, R: E.pd(E.z.pump) / 2, side: 1 },
    { key: 'idler2', u: -112.7, v: -89.9, R: E.idlerR, side: -1 },
  ];
};
E.beltPath = function (P) {
  const n = P.length, tan = [];
  for (let k = 0; k < n; k++) {
    const a = P[k], b = P[(k + 1) % n];
    const r1 = a.side * a.R, r2 = b.side * b.R;
    const du = b.u - a.u, dv = b.v - a.v, dist = Math.hypot(du, dv), c = (r1 - r2) / dist;
    if (Math.abs(c) >= 1) return null;
    const al = Math.atan2(dv, du) - Math.acos(c), nu = Math.cos(al), nv = Math.sin(al);
    const p1 = { u: a.u + r1 * nu, v: a.v + r1 * nv }, p2 = { u: b.u + r2 * nu, v: b.v + r2 * nv };
    const len = Math.hypot(p2.u - p1.u, p2.v - p1.v);
    tan.push({ p1, p2, len, du: (p2.u - p1.u) / len, dv: (p2.v - p1.v) / len,
      a1: Math.atan2(a.side * nv, a.side * nu), a2: Math.atan2(b.side * nv, b.side * nu) });
  }
  const pieces = []; let total = 0;
  for (let k = 0; k < n; k++) {
    const p = P[k], tin = tan[(k - 1 + n) % n], tout = tan[k];
    const wrap = p.side > 0 ? mod(tout.a1 - tin.a2, TAU) : mod(tin.a2 - tout.a1, TAU);
    if (p.side < 0 && wrap > Math.PI * 0.75) return null;
    if (p.side > 0 && wrap < 2 * DEG) return null;
    pieces.push({ type: 'arc', k, pulley: p, a0: tin.a2, dir: p.side, wrap, len: p.R * wrap, s0: total });
    total += p.R * wrap;
    pieces.push({ type: 'seg', k, p1: tout.p1, du: tout.du, dv: tout.dv, len: tout.len, s0: total });
    total += tout.len;
  }
  return { pieces, length: total };
};
E.beltSample = function (path, s) {
  s = mod(s, path.length);
  let lo = 0, hi = path.pieces.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (path.pieces[m].s0 <= s) lo = m; else hi = m - 1; }
  const pc = path.pieces[lo], ls = s - pc.s0;
  let u, v, tu, tv;
  if (pc.type === 'seg') { u = pc.p1.u + pc.du * ls; v = pc.p1.v + pc.dv * ls; tu = pc.du; tv = pc.dv; }
  else { const p = pc.pulley, a = pc.a0 + pc.dir * ls / p.R; u = p.u + p.R * Math.cos(a); v = p.v + p.R * Math.sin(a); tu = -Math.sin(a) * pc.dir; tv = Math.cos(a) * pc.dir; }
  return { u, v, tu, tv, nu: -tv, nv: tu, piece: pc };
};
E.solveBelt = function () {
  const p = E.beltPitch, t = E.tensioner;
  const lenAt = g => { const path = E.beltPath(E.pulleys(g)); return path ? path.length : NaN; };
  const N = Math.round(lenAt(t.prefer) / p), want = N * p;
  let prev = null, best = null;
  for (let gd = 60; gd <= 220; gd += 0.25) {
    const g = gd * DEG, L = lenAt(g);
    if (prev && isFinite(L) && isFinite(prev.L) && (prev.L - want) * (L - want) <= 0) {
      let ga = prev.g, gb = g, La = prev.L;
      for (let it = 0; it < 60; it++) {
        const gm = (ga + gb) / 2, Lm = lenAt(gm);
        if ((La - want) * (Lm - want) <= 0) gb = gm; else { ga = gm; La = Lm; }
      }
      const gamma = (ga + gb) / 2, miss = Math.abs(wrapPi(gamma - t.prefer));
      if (!best || miss < best.miss) best = { gamma, miss };
    }
    prev = { g, L };
  }
  if (!best) throw new Error('belt: no tensioner angle gives a whole number of teeth');
  const pulleys = E.pulleys(best.gamma);
  return { gamma: best.gamma, N, path: E.beltPath(pulleys), pulleys };
};

const Bm = E.bore / 1000, Sm = E.stroke / 1000, Lm = E.rodLen / 1000, rm = Sm / 2;
E.CR = 10;
E.Ap = Math.PI * Bm * Bm / 4;
E.Vd = E.Ap * Sm;
E.Vc = E.Vd / (E.CR - 1);
E.Vbdc = E.Vc + E.Vd;
E.displacementCC = E.Vd * 4 * 1e6;
E.gas = { n: 1.30, Pin: 94000, Tin: 320, Pex: 106000, T3: 2300 };
const g = E.gas;
const T2 = g.Tin * Math.pow(E.CR, g.n - 1), P2 = g.Pin * Math.pow(E.CR, g.n), P3 = P2 * (g.T3 / T2);
const T4 = g.T3 * Math.pow(1 / E.CR, g.n - 1);
E.P3 = P3;
E.volumeAt = psiDeg => {
  const psi = psiDeg * DEG;
  const x = rm * (1 - Math.cos(psi)) + (Lm - Math.sqrt(Lm * Lm - rm * rm * Math.sin(psi) ** 2));
  return E.Vc + E.Ap * x;
};
E.thermo = function (phaseDeg) {
  const phase = mod(phaseDeg, 720), psi = phase % 360, V = E.volumeAt(psi);
  let P, T, stroke;
  if (phase < 180) { stroke = 'intake'; P = g.Pin; T = g.Tin; }
  else if (phase < 360) { stroke = 'compression'; const k = E.Vbdc / V; P = g.Pin * Math.pow(k, g.n); T = g.Tin * Math.pow(k, g.n - 1); }
  else if (phase < 540) { stroke = 'power'; const k = E.Vc / V; P = P3 * Math.pow(k, g.n); T = g.T3 * Math.pow(k, g.n - 1); }
  else { stroke = 'exhaust'; const f = (phase - 540) / 180; P = g.Pex; T = T4 * (1 - f) + g.Tin * f; }
  return { phase, psi, V, P, T, stroke };
};
E.cycle = [];
for (let ph = 0; ph <= 720; ph += 2) E.cycle.push(E.thermo(ph));
let W = 0;
for (let k = 0; k < E.cycle.length - 1; k++) W += 0.5 * (E.cycle[k].P + E.cycle[k + 1].P) * (E.cycle[k + 1].V - E.cycle[k].V);
E.workPerCycle = Math.abs(W);
E.imep = E.workPerCycle / E.Vd;
E.power = rpm => E.workPerCycle * 4 * rpm / 120;
E.torque = rpm => rpm > 0 ? E.power(rpm) / (2 * Math.PI * rpm / 60) : 0;
E.strokeName = { intake: 'Впуск', compression: 'Сжатие', power: 'Рабочий ход', exhaust: 'Выпуск' };

if (typeof module !== 'undefined' && module.exports) module.exports = E;
root.ENG_B4 = E;
})(typeof window !== 'undefined' ? window : globalThis);
