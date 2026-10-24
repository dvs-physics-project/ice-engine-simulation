/* v8/spec.js — V-образный 8-цилиндровый дизель по чертежу «ДВС КР 09.00.00.00 СБ»
   (развал 90°, компоновка семейства КамАЗ-740), в миллиметрах. Pure math, no THREE/DOM.
   One source of truth for geometry, animation and charts: crank–slider for both banks,
   firing order, flat-tappet cam law, the exact rocker-arm solution (valve lift = f(cam lift)),
   rear gear train with tooth phasing, front V-belt, injection-pump timing, dual diesel cycle.

   World axes (mm): X along the crankshaft, front (fan) at −X, flywheel at +X; Y up, crank axis
   at Y=0; Z across. Right bank (cyl 1–4) leans to −Z, left bank (cyl 5–8) to +Z.
   Positive rotation about +X turns +Y toward +Z — clockwise seen from the fan end.
   Bank frame for cylinder c: a = along its axis (0 at the crank), s = sideways toward the vee. */
(function (root) {
'use strict';
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;
const wrapPi = a => mod(a + Math.PI, TAU) - Math.PI;
const E = { id: 'v8', DEG, TAU, mod, wrapPi };

/* ------------------------------------------------------------ cranktrain ---- */
E.bore = 125;  E.stroke = 130;  E.r = 65;  E.rodLen = 250;  E.compH = 99;
E.pitch = 170;
E.mainX = [-2, -1, 0, 1, 2].map(k => k * E.pitch);
E.pinX = [-1.5, -0.5, 0.5, 1.5].map(k => k * E.pitch);
E.bankOff = 18.5;                      // each rod's big end sits ±18.5 mm from the pin centre
E.mainD = 95;  E.mainW = 40;  E.pinD = 80;  E.pinLen = 74;  E.webT = 28;
E.rodW = 36;   E.rodBig = 85;            // big-end bore incl. shells
E.pistonR = 62.3;  E.pistonH = 140;  E.pinOD = 50;  E.pinID = 28;
E.deck = 413.5;  E.gasket = 1.5;  E.fireFace = E.deck + E.gasket;
E.headTop = 520;

E.nCyl = 8;
E.cyl = [];
for (let c = 0; c < 8; c++) {
  const right = c < 4, k = c % 4;
  E.cyl.push({ n: c + 1, k, bank: right ? 'R' : 'L', beta: (right ? -45 : 45) * DEG,
    x: E.pinX[k] + (right ? -E.bankOff : E.bankOff), sgn: right ? 1 : -1 });
}
E.axisOf = c => ({ y: Math.cos(E.cyl[c].beta), z: Math.sin(E.cyl[c].beta) });
E.vSideOf = c => { const b = E.cyl[c].beta, s = E.cyl[c].sgn; return { y: -Math.sin(b) * s, z: Math.cos(b) * s }; };
E.bankPoint = function (c, x, a, s) {
  const A = E.axisOf(c), N = E.vSideOf(c);
  return [x, a * A.y + s * N.y, a * A.z + s * N.z];
};
// pins 1&4 and 2&3 opposite, the two pairs 90° apart (cross-plane crank)
E.pinAngle = [-45, 45, -135, 135].map(d => d * DEG);

E.kin = function (c, theta) {
  const C = E.cyl[c], alpha = E.pinAngle[C.k] + theta, psi = alpha - C.beta;
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

/* firing order 1-5-4-2-6-3-7-8, one firing every 90°. Cycle phase 0 = TDC at the start of
   intake, 360 = TDC firing. phase_c(θ) = θ + cycleOff[c]. */
E.firing = [1, 5, 4, 2, 6, 3, 7, 8];
E.cycleOff = [0, 0, 0, 0, 0, 0, 0, 0];
E.firing.forEach((n, k) => { E.cycleOff[n - 1] = mod(360 - 90 * k, 720); });
E.phaseOf = (c, thetaDeg) => mod(thetaDeg + E.cycleOff[c], 720);

/* ------------------------------------------------------------ valvetrain ---- */
E.camY = 168;                          // camshaft in the vee, above the crank
E.camA = E.camY * Math.SQRT1_2;        // its position in either bank's frame (a = s)
E.camS = E.camA;
E.kappa = 0.5;                         // cam turns with the crank (via an idler), half speed
E.camBase = 22;  E.camH = 8.5;  E.lobeW = 16;  E.camJournalR = 27;
E.camBeta = { in: 65.6 * DEG, ex: 69.4 * DEG };   // half-duration, cam degrees
E.peak = { in: 108, ex: 602 };                    // cycle phase of peak lift
// впуск: открытие 13° до ВМТ, закрытие 49° после НМТ; выпуск: 66° до НМТ … 10° после ВМТ
E.timingText = { in: [-13, 229], ex: [474, 730] };
E.valveDX = 30;  E.valveS = 20;
E.valveHeadR = { in: 23, ex: 20 };
E.valveLen = 159;  E.valveSeatA = E.fireFace + 1;  E.valveTipA = E.valveSeatA + E.valveLen;
E.springLo = E.headTop;  E.springHi = E.valveTipA - 13;
E.tappetLen = 62;  E.tappetFaceR = 16;  E.tappetStemR = 10.5;
E.pushTop0 = 566;
E.pushBot0 = E.camA + E.camBase + E.tappetLen;
E.pushLen = E.pushTop0 - E.pushBot0;
E.rockerP = { a: 578, s: E.valveS + (E.camS - E.valveS) * 0.6 };   // 1.5 : 1 lever, pivot level with the valve pad
E.rockerT0 = { a: E.pushTop0, s: E.camS };
E.padR = 9;                            // rocker pad: arc of R9 whose centre is V0, rolling on the stem tip
E.rockerV0 = { a: E.valveTipA + E.padR, s: E.valveS };
E.pocketDepth = 4;

// intake on the front side of a right-bank cylinder; the left bank uses the same head turned
// round, so its intake is at the rear. Each valve's lobe, tappet, pushrod and rocker share its X.
E.valveX = function (c, side) {
  const C = E.cyl[c], front = (side === 'in') === (C.bank === 'R');
  return C.x + (front ? -E.valveDX : E.valveDX);
};
E.liftLaw = function (rel, beta) {
  const u = wrapPi(rel) / beta;
  if (Math.abs(u) >= 1) return 0;
  const w = 1 - u * u;
  return E.camH * w * w;
};
E.liftLawD = function (rel, beta) {
  const u = wrapPi(rel) / beta;
  if (Math.abs(u) >= 1) return 0;
  return -4 * E.camH * u * (1 - u * u) / beta;
};
// flat-follower envelope: support function in direction t is exactly base + lift(t)
E.lobeProfile = function (beta, n) {
  n = n || 240;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = -Math.PI + TAU * k / n, y = E.liftLaw(t, beta), dy = E.liftLawD(t, beta), R = E.camBase + y;
    pts.push([R * Math.cos(t) - dy * Math.sin(t), R * Math.sin(t) + dy * Math.cos(t)]);
  }
  return pts;
};
E.lobeAngle = function (c, side) {
  const thetaPk = mod(E.peak[side] - E.cycleOff[c], 720) * DEG;
  return E.cyl[c].beta - E.kappa * thetaPk;
};
E.camLiftAt = (c, side, theta) => E.liftLaw(E.lobeAngle(c, side) + E.kappa * theta - E.cyl[c].beta, E.camBeta[side]);
E.camLiftAtPhase = (side, phaseDeg) => E.liftLaw((phaseDeg - E.peak[side]) * DEG * E.kappa, E.camBeta[side]);

/* exact rocker: the pushrod is a rigid link between the tappet socket (moving along the bank
   axis) and the adjusting-screw ball on the rocker's short arm. Solve the rocker angle φ for a
   given cam lift h, then read the valve displacement off the long arm. */
const rot = (v, f) => ({ s: v.s * Math.cos(f) - v.a * Math.sin(f), a: v.s * Math.sin(f) + v.a * Math.cos(f) });
E.rockerAt = function (h) {
  const P = E.rockerP, T0 = { s: E.rockerT0.s - P.s, a: E.rockerT0.a - P.a };
  const B = { s: E.camS, a: E.pushBot0 + h };
  const f = phi => { const t = rot(T0, phi); return Math.hypot(P.s + t.s - B.s, P.a + t.a - B.a) - E.pushLen; };
  let lo = -0.05, hi = 0.6;
  for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
  const phi = (lo + hi) / 2;
  const V0 = { s: E.rockerV0.s - P.s, a: E.rockerV0.a - P.a }, v = rot(V0, phi), t = rot(T0, phi);
  return { phi, valve: E.rockerV0.a - (P.a + v.a), T: { s: P.s + t.s, a: P.a + t.a }, B };
};
const RT_N = 400, rockerTable = [];
for (let k = 0; k <= RT_N; k++) rockerTable.push(E.rockerAt(E.camH * k / RT_N));
E.rocker = function (h) {
  const x = Math.max(0, Math.min(1, h / E.camH)) * RT_N, k = Math.min(RT_N - 1, Math.floor(x)), f = x - k;
  const A = rockerTable[k], B = rockerTable[k + 1];
  return { phi: A.phi + (B.phi - A.phi) * f, valve: A.valve + (B.valve - A.valve) * f };
};
E.valveLiftMax = E.rocker(E.camH).valve;
E.valveLiftAt = (c, side, theta) => E.rocker(E.camLiftAt(c, side, theta)).valve;
E.valveLiftAtPhase = (side, phaseDeg) => E.rocker(E.camLiftAtPhase(side, phaseDeg)).valve;

/* ------------------------------------------------------------ rear gear train ---- */
E.gearX = 375;  E.gearW = 24;  E.module = 4;
E.gears = {
  crank: { z: 24, y: 0, zc: 0 },
  idler: { z: 30, y: 0, zc: 0 },
  cam:   { z: 48, y: E.camY, zc: 0 },
  pump:  { z: 48, y: 0, zc: 0 },
};
(() => {
  const g = E.gears, m = E.module, R = k => m * g[k].z / 2;
  const d1 = R('crank') + R('idler'), d2 = R('idler') + R('cam');
  const y = (d1 * d1 - d2 * d2 + E.camY * E.camY) / (2 * E.camY);
  g.idler.y = y; g.idler.zc = -Math.sqrt(d1 * d1 - y * y);           // idler on the right-bank side
  g.pump.y = E.camY + R('cam') + R('pump');
})();
E.pumpY = E.gears.pump.y;
E.gearRatio = { crank: 1, idler: -E.gears.crank.z / E.gears.idler.z, cam: E.kappa, pump: -E.kappa };
// phase each gear so a tooth of one faces a gap of the other at every mesh
E.meshPhase = function (p1, z1, c1, c2, z2) {
  const ang12 = Math.atan2(c2.zc - c1.zc, c2.y - c1.y), ang21 = ang12 + Math.PI;
  const tau1 = mod((ang12 - p1) / (TAU / z1), 1);
  return ang21 - (0.5 - tau1) * TAU / z2;
};
(() => {
  const g = E.gears;
  g.crank.phase = Math.atan2(g.idler.zc, g.idler.y);
  g.idler.phase = E.meshPhase(g.crank.phase, g.crank.z, g.crank, g.idler, g.idler.z);
  g.cam.phase = E.meshPhase(g.idler.phase, g.idler.z, g.idler, g.cam, g.cam.z);
  g.pump.phase = E.meshPhase(g.cam.phase, g.cam.z, g.cam, g.pump, g.pump.z);
})();
E.front = { gearX: -377, gearZ: 46, oilPumpY: -184 };   // crank → oil-pump drive gears (1 : 1)

/* ------------------------------------------------------------ injection pump ---- */
E.pump = { x0: -110, x1: 190, rowAngle: 37.5 * DEG, base: 22, lift: 8, beta: 70 * DEG, peak: 372,
  plungerX: [-55, -15, 25, 65].map(x => x + 10), lobeW: 14, plungerR: 6, tappetR: 13 };
E.pumpPlunger = function (c) {          // plunger of cylinder c: its X and direction (pump frame)
  const C = E.cyl[c];
  return { x: E.pump.plungerX[C.k] + (C.bank === 'R' ? -12 : 12), dir: C.bank === 'R' ? -E.pump.rowAngle : E.pump.rowAngle };
};
E.pumpLobeAngle = function (c) {        // pump shaft turns at −κθ (meshes with the cam gear)
  const thetaPk = mod(E.pump.peak - E.cycleOff[c], 720) * DEG;
  return E.pumpPlunger(c).dir + E.kappa * thetaPk;
};
E.pumpLaw = function (rel) {
  const u = wrapPi(rel) / E.pump.beta;
  if (Math.abs(u) >= 1) return 0;
  const w = 1 - u * u;
  return E.pump.lift * w * w;
};
E.pumpLawD = function (rel) {
  const u = wrapPi(rel) / E.pump.beta;
  if (Math.abs(u) >= 1) return 0;
  return -4 * E.pump.lift * u * (1 - u * u) / E.pump.beta;
};
E.pumpLobeProfile = function (n) {      // same flat-follower envelope as the camshaft lobes
  n = n || 200;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = -Math.PI + TAU * k / n, R = E.pump.base + E.pumpLaw(t), dy = E.pumpLawD(t);
    pts.push([R * Math.cos(t) - dy * Math.sin(t), R * Math.sin(t) + dy * Math.cos(t)]);
  }
  return pts;
};
E.plungerLift = (c, theta) => E.pumpLaw(E.pumpLobeAngle(c) - E.kappa * theta - E.pumpPlunger(c).dir);
E.inject = { start: 344, end: 368 };    // впрыск: ≈16° до ВМТ … 8° после
E.injectAt = phaseDeg => phaseDeg >= E.inject.start && phaseDeg <= E.inject.end;

/* ------------------------------------------------------------ front V-belt ---- */
E.beltX = -470;
E.vbelt = [                              // CCW travel order (verified numerically)
  { key: 'alt', u: 150, v: -232, R: 40, side: 1 },
  { key: 'fan', u: 262, v: 0, R: 95, side: 1 },
  { key: 'crank', u: 0, v: 0, R: 95, side: 1 },
];
E.fanY = 262;  E.fanSlip = 0.97;
E.beltPath = function (P) {             // exact external tangents, same method as the I4 belt
  const n = P.length, tan = [];
  for (let k = 0; k < n; k++) {
    const a = P[k], b = P[(k + 1) % n], r1 = a.side * a.R, r2 = b.side * b.R;
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
    const wrap = mod(tout.a1 - tin.a2, TAU);
    if (wrap < 2 * DEG) return null;
    pieces.push({ type: 'arc', pulley: p, a0: tin.a2, dir: 1, wrap, len: p.R * wrap, s0: total });
    total += p.R * wrap;
    pieces.push({ type: 'seg', p1: tout.p1, du: tout.du, dv: tout.dv, len: tout.len, s0: total });
    total += tout.len;
  }
  return { pieces, length: total };
};
E.beltSample = function (path, s) {
  s = mod(s, path.length);
  let lo = 0, hi = path.pieces.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (path.pieces[m].s0 <= s) lo = m; else hi = m - 1; }
  const pc = path.pieces[lo], ls = s - pc.s0;
  if (pc.type === 'seg') return { u: pc.p1.u + pc.du * ls, v: pc.p1.v + pc.dv * ls, tu: pc.du, tv: pc.dv };
  const p = pc.pulley, a = pc.a0 + ls / p.R;
  return { u: p.u + p.R * Math.cos(a), v: p.v + p.R * Math.sin(a), tu: -Math.sin(a), tv: Math.cos(a) };
};

/* ------------------------------------------------------------ dual (mixed) diesel cycle ---- */
const Bm = E.bore / 1000, Sm = E.stroke / 1000, Lm = E.rodLen / 1000, rm = Sm / 2;
E.CR = 17;
E.Ap = Math.PI * Bm * Bm / 4;
E.Vd = E.Ap * Sm;
E.Vc = E.Vd / (E.CR - 1);
E.Vbdc = E.Vc + E.Vd;
E.displacementCC = E.Vd * 8 * 1e6;
E.gas = { n1: 1.36, n2: 1.27, Pin: 1.55e5, Tin: 345, Pex: 1.35e5, lam: 1.45, rho: 1.45 };
const g = E.gas;
const Pc = g.Pin * Math.pow(E.CR, g.n1), Tc = g.Tin * Math.pow(E.CR, g.n1 - 1);
const Pz = Pc * g.lam, Tz1 = Tc * g.lam, Tz = Tz1 * g.rho, Vz = E.Vc * g.rho;
E.Pz = Pz; E.Tz = Tz;
E.volumeAt = psiDeg => {
  const psi = psiDeg * DEG;
  const x = rm * (1 - Math.cos(psi)) + (Lm - Math.sqrt(Lm * Lm - rm * rm * Math.sin(psi) ** 2));
  return E.Vc + E.Ap * x;
};
const Tb = Tz * Math.pow(Vz / E.Vbdc, g.n2 - 1);
E.thermo = function (phaseDeg) {
  const phase = mod(phaseDeg, 720), psi = phase % 360, V = E.volumeAt(psi);
  let P, T, stroke;
  if (phase < 180) { stroke = 'intake'; P = g.Pin; T = g.Tin; }
  else if (phase < 360) { stroke = 'compression'; const k = E.Vbdc / V; P = g.Pin * Math.pow(k, g.n1); T = g.Tin * Math.pow(k, g.n1 - 1); }
  else if (phase < 540) {
    stroke = 'power';
    if (V <= Vz) { P = Pz; T = Tz1 * V / E.Vc; }
    else { P = Pz * Math.pow(Vz / V, g.n2); T = Tz * Math.pow(Vz / V, g.n2 - 1); }
  } else { stroke = 'exhaust'; const f = (phase - 540) / 180; P = g.Pex; T = Tb * (1 - f) + g.Tin * f; }
  return { phase, psi, V, P, T, stroke };
};
E.cycle = [];
for (let ph = 0; ph <= 720; ph += 1) E.cycle.push(E.thermo(ph));
let W = 0;
for (let k = 0; k < E.cycle.length - 1; k++) W += 0.5 * (E.cycle[k].P + E.cycle[k + 1].P) * (E.cycle[k + 1].V - E.cycle[k].V);
E.workPerCycle = Math.abs(W);
E.imep = E.workPerCycle / E.Vd;
E.power = rpm => E.workPerCycle * 8 * rpm / 120;
E.torque = rpm => rpm > 0 ? E.power(rpm) / (2 * Math.PI * rpm / 60) : 0;
E.strokeName = { intake: 'Впуск', compression: 'Сжатие', power: 'Рабочий ход', exhaust: 'Выпуск' };

if (typeof module !== 'undefined' && module.exports) module.exports = E;
root.ENG_V8 = E;
})(typeof window !== 'undefined' ? window : globalThis);
