/* spec.js — the engine as drawn on КП.2011.00.00.00.СБ (рядный 4-цилиндровый, DOHC 16V),
   in millimetres, plus every piece of kinematics the 3D model and the charts share:
   crank–slider, firing order, the true cam-lobe profile and the valve lift it produces,
   the timing-belt layout (exact tangents, tensioner solved for an integer tooth count),
   and a simplified Otto-cycle thermodynamics.
   Pure math: no THREE, no DOM — the same numbers drive the geometry, the animation and the
   charts, which is what keeps every part synchronized.

   World axes (mm): X along the crankshaft, timing end (front) at −X, flywheel at +X;
   Y up, crank axis at Y=0; Z across the engine, exhaust side +Z, intake side −Z.
   Rotation is about +X; seen from the front the crank turns clockwise.
   2-D work in the belt / web planes uses (u, v) = (Y, Z), so CCW in (u, v) is a positive
   rotation about +X. */
(function (root) {
'use strict';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;
const wrapPi = a => mod(a + Math.PI, TAU) - Math.PI;

const E = { DEG, TAU, mod, wrapPi };

/* ------------------------------------------------------------------ block & crank ---- */
E.bore = 72;                 // Ø72* on the longitudinal section
E.stroke = 69;               // TDC/BDC crown positions of pistons 1 vs 2 on the section
E.r = E.stroke / 2;
E.rodLen = 122;              // pin-to-pin, both sections agree within 2 mm
E.pitch = 86;                // cylinder spacing
E.cylX = [-1.5, -0.5, 0.5, 1.5].map(k => k * E.pitch);
E.mainX = [-2, -1, 0, 1, 2].map(k => k * E.pitch);
E.compH = 33;                // gudgeon-pin centre to crown
E.deckY = 190;               // block deck above the crank axis
E.gasket = 1.2;
E.headY = E.deckY + E.gasket;
E.pistonR = 35.9;
E.pistonH = 52;
E.pinD = 18;
E.mainD = 48;  E.mainW = 20;
E.rodJD = 42;  E.rodJW = 24;
E.webT = 16;                 // web thickness along X
E.webIn = E.rodJW / 2;       // web inner face, from the cylinder centre
E.cwR = 62;                  // counterweight outer radius (drawing: ≈62–63 below the axis)
E.cwHalf = 64 * DEG;         // half-angle of the counterweight sector
E.pinBossR = 28;             // web boss around the rod journal
E.rodBigBore = 45;           // big-end bore incl. shells
E.blockFront = -182; E.blockRear = 182;

// crank throws: 1 & 4 up, 2 & 3 down (flat-plane 4-cylinder crank)
E.throwAngle = [0, Math.PI, Math.PI, 0];

// firing order 1-3-4-2. Cycle phase (deg, 0…720): 0 = TDC at the start of intake,
// 180 BDC, 360 TDC firing, 540 BDC. phase_i(θ) = θ + cycleOff[i]   (θ = crank angle, deg)
E.firing = [1, 3, 4, 2];
E.cycleOff = [0, 0, 0, 0];
E.firing.forEach((cyl, k) => { E.cycleOff[cyl - 1] = mod(360 - 180 * k, 720); });

E.phaseOf = (i, thetaDeg) => mod(thetaDeg + E.cycleOff[i], 720);

/* crank–slider, for one cylinder at crank angle θ (radians, continuous) */
E.kin = function (i, theta) {
  const psi = theta + E.throwAngle[i];
  const py = E.r * Math.cos(psi), pz = E.r * Math.sin(psi);      // rod-journal centre
  const pinY = py + Math.sqrt(E.rodLen * E.rodLen - pz * pz);     // gudgeon-pin centre (z=0)
  return {
    psi, py, pz, pinY,
    crownY: pinY + E.compH,
    travel: (E.r + E.rodLen) - pinY,                                // mm below TDC
    rodAngle: Math.atan2(-pz, pinY - py),                           // rotation.x of the rod
  };
};

/* ------------------------------------------------------------------ valvetrain ---- */
E.valveAngle = 28 * DEG;     // each valve row tilted 28° off the cylinder axis (front view)
E.seatY = E.headY + 12.2;    // valve face centre, closed
E.seatZ = 20;                // valve face centre, off the cylinder axis
E.valveDX = 18.5;            // the two valves of a pair sit ±18.5 along X (lobe spacing)
E.camDist = 121;             // seat → camshaft axis, along the valve axis
E.camBase = 17.5;            // base-circle radius
E.camLift = 8.0;             // max lift
E.camBeta = 75 * DEG;        // half-duration in CAM degrees (≈241° crank at 1 mm lift)
E.lobeW = 15;
E.camY = E.seatY + E.camDist * Math.cos(E.valveAngle);
E.camZ = E.seatZ + E.camDist * Math.sin(E.valveAngle);   // exhaust +camZ, intake −camZ
E.valveHeadR = { in: 13.5, ex: 11.5 };
E.stemR = 2.75;
E.tappetR = 15;  E.tappetH = 22;
E.tappetTop = E.camDist - E.camBase;      // along the axis from the seat
E.valveLen = E.tappetTop - 4;             // tip sits under the bucket crown (zero lash)
E.springSeat = 50;  E.springTop = 92;     // along the axis from the seat, valve closed
E.intakePeak = 105;  E.exhaustPeak = 615; // cycle phase of maximum lift (crank deg)

// valve axis (pointing from the seat up to the cam) for side s (−1 intake, +1 exhaust)
E.valveAxis = s => ({ y: Math.cos(E.valveAngle), z: s * Math.sin(E.valveAngle) });
// direction from cam centre down to the valve, as an angle in the (u,v)=(Y,Z) plane
E.followerAngle = s => Math.atan2(-s * Math.sin(E.valveAngle), -Math.cos(E.valveAngle));

// lift law y(θ) = h(1−u²)², u = θ/β — continuous lift & velocity, convex profile:
// nose radius ρ = Rb + h − 4h/β² ≈ 6.8 mm > 0.
E.liftLaw = function (rel) {
  const u = wrapPi(rel) / E.camBeta;
  if (Math.abs(u) >= 1) return 0;
  const w = 1 - u * u;
  return E.camLift * w * w;
};
E.liftLawD = function (rel) {               // dy/dθ
  const u = wrapPi(rel) / E.camBeta;
  if (Math.abs(u) >= 1) return 0;
  return -4 * E.camLift * u * (1 - u * u) / E.camBeta;
};
// Cam profile = envelope of the flat follower face over all relative angles:
//   p(θ) = (Rb + y)·n̂(θ) + y′·t̂(θ). Its support function in direction θ is exactly Rb+y(θ),
// so the lift read off the drawn lobe and the lift used for the valve are the same number.
E.lobeProfile = function (n) {
  n = n || 220;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const th = -Math.PI + TAU * k / n;
    const y = E.liftLaw(th), dy = E.liftLawD(th), R = E.camBase + y;
    pts.push([R * Math.cos(th) - dy * Math.sin(th), R * Math.sin(th) + dy * Math.cos(th)]);
  }
  return pts;
};
// nose angle (cam frame) of the lobe for cylinder i, side s
E.lobeAngle = function (i, s) {
  const peak = s < 0 ? E.intakePeak : E.exhaustPeak;
  const thetaPeak = mod(peak - E.cycleOff[i], 720) * DEG;
  return E.followerAngle(s) - thetaPeak / 2;
};
// valve lift (mm) at crank angle θ (radians, continuous); cams turn at θ/2
E.valveLift = (i, s, theta) => E.liftLaw(E.lobeAngle(i, s) + theta / 2 - E.followerAngle(s));
// the same lift expressed against the cylinder's cycle phase (deg) — for the chart
E.liftAtPhase = (s, phaseDeg) => {
  const peak = s < 0 ? E.intakePeak : E.exhaustPeak;
  return E.liftLaw((phaseDeg - peak) * DEG / 2);       // liftLaw wraps in the cam domain
};

/* ------------------------------------------------------------------ timing belt ---- */
E.beltX = -218;  E.beltW = 25;  E.beltPitch = 8;
E.beltBack = 1.8;        // backing above the pitch line
E.beltIn = 0.7;          // backing below the pitch line
E.toothH = 3.4;
E.z = { crank: 23, cam: 46, pump: 19 };                 // 2:1 cam drive
E.pd = z => z * E.beltPitch / Math.PI;                  // pitch diameter
E.pumpPos = { u: 134, v: 74 };            // coolant pump (поз. 25), exhaust side of the block
// поз. 21, on the slack run, up under the intake cam pulley as on the drawing (≈Y 230)
E.tensioner = { pivot: { u: 172, v: -60 }, arm: 74, R: 28, prefer: -60 * DEG };

// pulleys in CCW travel order: crank → tensioner → intake cam → exhaust cam → pump → crank.
// The crank pulls the belt in from the pump side (tight run) and pushes it out toward the
// tensioner (slack run) — which is why the roller sits there.
E.pulleys = function (gamma, pumpOffset) {
  const t = E.tensioner, o = pumpOffset || 0;
  return [
    { key: 'crank', u: 0, v: 0, R: E.pd(E.z.crank) / 2, side: 1 },
    { key: 'tens', u: t.pivot.u + t.arm * Math.cos(gamma), v: t.pivot.v + t.arm * Math.sin(gamma), R: t.R, side: -1 },
    { key: 'camIn', u: E.camY, v: -E.camZ, R: E.pd(E.z.cam) / 2, side: 1 },
    { key: 'camEx', u: E.camY, v: E.camZ, R: E.pd(E.z.cam) / 2, side: 1 },
    { key: 'pump', u: E.pumpPos.u, v: E.pumpPos.v + o, R: E.pd(E.z.pump) / 2, side: 1 },
  ];
};

// Exact belt path for pulleys listed in CCW travel order. Inside pulleys (side +1) carry
// the toothed face, the tensioner (side −1) rides on the belt's back. Returns pieces
// (arc, segment, arc, segment, …) starting with the arc on pulley 0, or null if the layout
// is not a valid wrap.
E.beltPath = function (P) {
  const n = P.length, tan = [];
  for (let k = 0; k < n; k++) {
    const a = P[k], b = P[(k + 1) % n];
    const r1 = a.side * a.R, r2 = b.side * b.R;
    const du = b.u - a.u, dv = b.v - a.v, dist = Math.hypot(du, dv);
    const c = (r1 - r2) / dist;
    if (Math.abs(c) >= 1) return null;
    const al = Math.atan2(dv, du) - Math.acos(c);
    const nu = Math.cos(al), nv = Math.sin(al);
    const p1 = { u: a.u + r1 * nu, v: a.v + r1 * nv }, p2 = { u: b.u + r2 * nu, v: b.v + r2 * nv };
    const len = Math.hypot(p2.u - p1.u, p2.v - p1.v);
    tan.push({ p1, p2, len, du: (p2.u - p1.u) / len, dv: (p2.v - p1.v) / len,
      a1: Math.atan2(a.side * nv, a.side * nu), a2: Math.atan2(b.side * nv, b.side * nu) });
  }
  const pieces = [];
  let total = 0;
  for (let k = 0; k < n; k++) {
    const p = P[k], tin = tan[(k - 1 + n) % n], tout = tan[k];
    const aIn = tin.a2, aOut = tout.a1;
    const wrap = p.side > 0 ? mod(aOut - aIn, TAU) : mod(aIn - aOut, TAU);
    if (p.side < 0 && wrap > Math.PI * 0.75) return null;   // roller not actually deflecting
    if (p.side > 0 && wrap < 2 * DEG) return null;          // pulley not engaged
    const arcLen = p.R * wrap;
    pieces.push({ type: 'arc', k, pulley: p, a0: aIn, dir: p.side, wrap, len: arcLen, s0: total });
    total += arcLen;
    pieces.push({ type: 'seg', k, p1: tout.p1, du: tout.du, dv: tout.dv, len: tout.len, s0: total });
    total += tout.len;
  }
  return { pieces, length: total };
};

// point, unit tangent and inward normal (toward the loop interior = where the teeth point)
E.beltSample = function (path, s) {
  s = mod(s, path.length);
  let lo = 0, hi = path.pieces.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (path.pieces[mid].s0 <= s) lo = mid; else hi = mid - 1; }
  const pc = path.pieces[lo], ls = s - pc.s0;
  let u, v, tu, tv;
  if (pc.type === 'seg') {
    u = pc.p1.u + pc.du * ls; v = pc.p1.v + pc.dv * ls; tu = pc.du; tv = pc.dv;
  } else {
    const p = pc.pulley, a = pc.a0 + pc.dir * ls / p.R;
    u = p.u + p.R * Math.cos(a); v = p.v + p.R * Math.sin(a);
    tu = -Math.sin(a) * pc.dir; tv = Math.cos(a) * pc.dir;
  }
  return { u, v, tu, tv, nu: -tv, nv: tu, piece: pc };
};

// Solve the layout so the loop is exactly N pitches long — then the belt's teeth mesh with
// every pulley for all time, not just at t = 0. A real tensioner only ever lengthens the
// path a little, so: (1) nudge the pump outward until the free loop is ~1.2 mm short of a
// whole number of pitches, (2) swing the tensioner arm until it takes up exactly that,
// keeping the roller outside the loop with a sane deflection of the slack run.
E.solveBelt = function () {
  const p = E.beltPitch, t = E.tensioner, take = 1.2;
  const freeP = o => E.pulleys(0, o).filter(q => q.key !== 'tens');
  const freeLen = o => { const fp = E.beltPath(freeP(o)); return fp ? fp.length : NaN; };
  const L0 = freeLen(0);
  const N = Math.ceil((L0 + take) / p);
  const want = N * p;
  let o = 0;
  if (want - take > L0) {
    let a = 0, b = 40;
    if (!(freeLen(b) > want - take)) throw new Error('pump cannot take up the free length');
    for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (freeLen(m) < want - take) a = m; else b = m; }
    o = (a + b) / 2;
  }
  const free = E.beltPath(freeP(o));
  const span = free.pieces[1];                       // crank → intake cam: the slack run
  const rn = { u: span.dv, v: -span.du };            // outward normal of that run
  const deflection = g => {
    const cu = t.pivot.u + t.arm * Math.cos(g), cv = t.pivot.v + t.arm * Math.sin(g);
    return t.R - ((cu - span.p1.u) * rn.u + (cv - span.p1.v) * rn.v);
  };
  const lenAt = g => {
    const d = deflection(g);
    if (!(d > 0.2 && d < 25)) return NaN;
    const path = E.beltPath(E.pulleys(g, o));
    return path ? path.length : NaN;
  };
  let prev = null, best = null;
  for (let gd = -179; gd <= 180; gd += 0.25) {
    const g = gd * DEG, L = lenAt(g);
    if (prev && isFinite(L) && isFinite(prev.L) && (prev.L - want) * (L - want) <= 0) {
      let ga = prev.g, gb = g, La = prev.L;
      for (let it = 0; it < 60; it++) {
        const gm = (ga + gb) / 2, Lm = lenAt(gm);
        if (!isFinite(Lm)) break;
        if ((La - want) * (Lm - want) <= 0) gb = gm; else { ga = gm; La = Lm; }
      }
      const gamma = (ga + gb) / 2, miss = Math.abs(wrapPi(gamma - (t.prefer || 0)));
      if (!best || miss < best.miss) best = { gamma, miss };
    }
    prev = { g, L };
  }
  if (!best) throw new Error('could not reach an integer tooth count');
  const pulleys = E.pulleys(best.gamma, o);
  return { gamma: best.gamma, N, pumpOffset: o, path: E.beltPath(pulleys), pulleys,
    freeLength: free.length, deflection: deflection(best.gamma) };
};

/* ------------------------------------------------------------------ thermodynamics ---- */
const B = E.bore / 1000, S = E.stroke / 1000, Lr = E.rodLen / 1000, rr = S / 2;
E.CR = 10.5;
E.Ap = Math.PI * B * B / 4;
E.Vd = E.Ap * S;                         // m³ per cylinder
E.Vc = E.Vd / (E.CR - 1);
E.Vbdc = E.Vc + E.Vd;
E.displacementCC = E.Vd * 4 * 1e6;
E.gas = { n: 1.30, Pin: 92000, Tin: 320, Pex: 105000, T3: 2250 };
const g = E.gas;
const T2 = g.Tin * Math.pow(E.CR, g.n - 1);
const P2 = g.Pin * Math.pow(E.CR, g.n);
const P3 = P2 * (g.T3 / T2);
const T4 = g.T3 * Math.pow(1 / E.CR, g.n - 1);
E.P3 = P3;
E.volumeAt = psiDeg => {
  const psi = psiDeg * DEG;
  const x = rr * (1 - Math.cos(psi)) + (Lr - Math.sqrt(Lr * Lr - rr * rr * Math.sin(psi) ** 2));
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
E.workPerCycle = Math.abs(W);                                   // J per cylinder per 720°
E.power = rpm => E.workPerCycle * 4 * rpm / 120;                // W (indicated)
E.torque = rpm => rpm > 0 ? E.power(rpm) / (2 * Math.PI * rpm / 60) : 0;
E.strokeName = { intake: 'Впуск', compression: 'Сжатие', power: 'Рабочий ход', exhaust: 'Выпуск' };

if (typeof module !== 'undefined' && module.exports) module.exports = E;
root.ENG_I4 = E;
})(typeof window !== 'undefined' ? window : globalThis);
