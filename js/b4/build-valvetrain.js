/* b4/build-valvetrain.js — SOHC, one camshaft per head on the cylinder axis line: camshafts with
   8 lobes each (every lobe is the envelope of its rocker's pad line, spec.js), cam pulleys (44
   teeth, timing marks), 16 rockers with adjusting screws on two shafts per head, the shaft
   holders that double as cam bearing caps, 16 valves, springs, retainers, guides and seats; the
   heads' ports as ghost tubes that are also the gas-flow paths.
   Kinematics: cam angle κθ → rocker angle φ = law(cam angle from the lobe's peak) → valve lift
   from the rocker lever. The lobe is cut so the pad touches it at exactly that φ, every degree.
   Rocker frame: origin on the rocker shaft axis at the valve's x, (y, z) = (a − shaft.a,
   s − shaft.s); a rocker turns by sg·φ about x. Rockers stay clear of both lobes they pass
   (pad web clipped to its own pad line, hubs outside the lobes' reach), checked in tests. */
(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};
const V3 = THREE.Vector3;

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let k = p.length - 1; k >= 0; k--) { const q = p[k]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
BUILD_B4.hull = hull;
const circle = (c, r, n) => Array.from({ length: n }, (_, k) => [c[0] + r * Math.cos(k / n * Math.PI * 2), c[1] + r * Math.sin(k / n * Math.PI * 2)]);

// range of the contact point along the pad, measured from the pad's reference point C(φ)
BUILD_B4.padContactRange = function (E, side) {
  const V = E.vt[side]; let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 720; k++) {
    const T = -Math.PI + 2 * Math.PI * k / 720, phi = E.rockerLaw(side, T), dphi = E.rockerLawD(side, T), eps = 1e-6;
    const dh = (E.padLine(side, phi + eps).h - E.padLine(side, phi - eps).h) / (2 * eps), hp = dh * dphi / (V.sg * dphi - 1);
    const L = E.padLine(side, phi), t = [-L.n[1], L.n[0]];
    const off = hp - ((L.C[0] - E.camA) * t[0] + (L.C[1] - E.camS) * t[1]);
    lo = Math.min(lo, off); hi = Math.max(hi, off);
  }
  return [lo, hi];
};

const HUB_R = 11.5, BORE_R = 8.2, PAD_DEPTH = 5.5;
// rocker cross-sections in its own (y, z) plane, relative to the shaft axis
BUILD_B4.rockerSections = function (E, side) {
  const V = E.vt[side], P = [V.shaft.a, V.shaft.s];
  const [lo, hi] = BUILD_B4.padContactRange(E, side), tA = lo - 1.6, tB = hi + 1.6;
  const t0 = [-V.n0[1], V.n0[0]];
  const pt = (t, d) => [V.C0[0] + t * t0[0] + d * V.n0[0] - P[0], V.C0[1] + t * t0[1] + d * V.n0[1] - P[1]];
  const C0r = pt(0, 0), dist = q => (q[0] - C0r[0]) * V.n0[0] + (q[1] - C0r[1]) * V.n0[1];
  const clip = poly => { const res = [];
    for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length], da = dist(a), db = dist(b);
      if (da >= 0) res.push(a); if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
    return res; };
  const pad = [pt(tA, 0), pt(tB, 0), pt(tB, PAD_DEPTH), pt(tA, PAD_DEPTH)];
  const padWeb = clip(hull(pad.concat(circle([0, 0], HUB_R, 48))));
  const ball = [V.ball[0] - P[0], V.ball[1] - P[1]], u = V.u, w = [-u[1], u[0]];
  const bossAt = d => [ball[0] + d * u[0], ball[1] + d * u[1]];
  const boss = [];
  for (const d of [3, 15]) for (const s of [-6.5, 6.5]) { const b = bossAt(d); boss.push([b[0] + s * w[0], b[1] + s * w[1]]); }
  const arm = hull(boss.concat(circle([0, 0], 10.5, 48)));
  return { padWeb, pad, arm, ball, u, tA, tB };
};

BUILD_B4.valvetrain = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { cams: [], instanced: [], static: [], ports: { in: [], ex: [] }, portMesh: null };
  const bankCyl = { R: [0, 2], L: [1, 3] }, headPart = b => b === 'R' ? 'headR' : 'headL';
  const toYZ = (b, a, s) => [s, b === 'R' ? -a : a];            // bank (a, s) → world (Y, Z) offsets

  /* ---------------- camshafts + pulleys (one group per bank, turning κθ about X) ---------------- */
  const Rk = E.pd(E.z.cam) / 2, bx = E.beltX;
  const profiles = { in: E.lobeProfile('in', 240), ex: E.lobeProfile('ex', 240) };
  for (const b of ['R', 'L']) {
    const grp = new THREE.Group();
    grp.position.set(0, E.camS, (b === 'R' ? -1 : 1) * E.camA);
    const core = [G.cylX(15, bx - 13, E.headX[b][0] + 6, 36), G.cylX(11.5, E.headX[b][0] + 6, E.camEnd[b], 32)];
    const polish = [];
    const J = E.camJournals[b];
    J.forEach(x => polish.push(G.cylX(E.camJournalR, x - 9, x + 9, 44)));
    core.push(G.cylX(19, J[0] - 12.5, J[0] - 9.5, 40));            // thrust flange behind the front journal
    core.push(G.cylX(13, E.camEnd[b] - 2, E.camEnd[b] + 3, 32));
    for (const c of bankCyl[b]) for (const side of ['in', 'ex']) for (let j = 0; j < 2; j++) {
      const C = E.cyl[c], lx = E.lobeLocalX(side, j), x = C.x + (C.sgn > 0 ? lx : -lx);
      const shape = G.shapeFromPts(profiles[side].map(([a, s]) => toYZ(b, a, s)));
      // no bevel: a bevel would make the lobe taller than its own law
      const geo = G.extrudeX(shape, x - E.lobeW / 2, x + E.lobeW / 2, { curveSegments: 1 });
      geo.rotateX(-E.kappa * E.thetaPeak(c, side));
      polish.push(geo);
    }
    const shaft = new THREE.Mesh(G.merge(core), M.camshaft), lobes = new THREE.Mesh(G.merge(polish), M.camLobe);
    [shaft, lobes].forEach(m => { ctx.tag(m, 'camshaft', 'valvetrain'); m.castShadow = m.receiveShadow = true; grp.add(m); });
    // cam pulley: 44 grooves phased to the belt, six lightening holes, flanges, bolt, mark at 12 o'clock
    const holes = [G.circlePath(0, 0, 15, true)];
    for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6 * Math.PI * 2; holes.push(G.circlePath(40 * Math.cos(a), 40 * Math.sin(a), 10.5, true)); }
    const pulley = new THREE.Mesh(G.merge([
      G.extrudeX(G.timingPulleyShape(E.z.cam, Rk, { phase: ctx.belt.phase[b === 'R' ? 'camR' : 'camL'], holes }), bx - 13, bx + 13, { curveSegments: 24 }),
      G.tubeX(56, Rk + 4.5, bx - 14.6, bx - 13, 96), G.tubeX(56, Rk + 4.5, bx + 13, bx + 14.6, 96),
      G.tubeX(15, 24, bx - 13, bx + 20, 40),
    ]), M.camPulley);
    ctx.tag(pulley, 'camPulley', 'timing'); pulley.castShadow = pulley.receiveShadow = true; grp.add(pulley);
    const bolt = new THREE.Mesh(G.merge([G.tubeX(0, 17, bx - 16.5, bx - 13, 36), (() => { const g = G.hexPrism(19, 8); G.toX(g); g.translate(bx - 24.5, 0, 0); return g; })()]), M.noseBolt);
    ctx.tag(bolt, 'camPulley', 'timing'); grp.add(bolt);
    const mk = new THREE.Mesh((() => { const s = new THREE.Shape(); s.moveTo(Rk + 4.2, -3); s.lineTo(Rk + 4.2, 3); s.lineTo(Rk - 3, 0); s.closePath();
      return G.extrudeX(s, bx - 15.2, bx - 14.5); })(), BUILD_B4.markMat());
    ctx.tag(mk, 'camPulley', 'timing'); grp.add(mk);
    grp.userData.bank = b;
    out.cams.push(grp);
  }

  /* ---------------- valves, springs, retainers (instanced, local frames: +Y along the valve) ---------------- */
  const valveGeo = side => {
    const V = E.vt[side], R = V.headR, Lv = V.len, st = E.stemR;
    const pts = [[0, 0], [R - 0.5, 0], [R, 0.6], [R, 1.7], [R - 2.8, 4.5]];
    for (let k = 1; k <= 9; k++) { const t = k / 9, r = (R - 2.8) + (st - (R - 2.8)) * (1 - Math.pow(1 - t, 2.4)); pts.push([r, 4.5 + 17 * t]); }
    pts.push([st, Lv - 9], [st - 0.6, Lv - 8.4], [st - 0.6, Lv - 6.6], [st, Lv - 6], [st, Lv - 0.5], [st - 0.5, Lv], [0, Lv]);
    return G.lathe(pts, 36);
  };
  const H0 = E.springTopT - E.springSeatT - 1.5;
  const springGeo = G.coilSpring(12.2, 1.9, 5.2, H0, 1, 6, 18);
  const retainerGeo = G.lathe([[3.6, -7], [6.2, -7], [7.6, -1.6], [15.6, -0.2], [15.6, 1.6], [12, 2.4], [7.4, 4.6], [3.6, 4.6], [3.6, -7]], 36, 0, undefined, true);
  const keeperGeo = G.lathe([[3.05, -7], [4.6, -7], [5.6, 4], [3.05, 4], [3.05, -7]], 20, 0, undefined, true);
  const mkInst = (geo, mat, part, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ctx.tag(m, part, 'valvetrain'); m.castShadow = m.receiveShadow = true;
    out.instanced.push(m); return m;
  };
  const valves = { in: mkInst(valveGeo('in'), M.valveIn, 'valveIn', 8), ex: mkInst(valveGeo('ex'), M.valveEx, 'valveEx', 8) };
  const springs = mkInst(springGeo, M.spring, 'springs', 16);
  const retainers = mkInst(retainerGeo, M.retainer, 'springs', 16);
  const keepers = mkInst(keeperGeo, M.adjScrew, 'springs', 16);

  /* ---------------- rockers: body per (side, j), screws per side ---------------- */
  const rockers = { in: [], ex: [] }, screws = {};
  for (const side of ['in', 'ex']) {
    const sec = BUILD_B4.rockerSections(E, side), d = E.lobeLocalX(side, 1) - E.valveLocalX(side, 1);
    const withBore = pts => { const s = G.shapeFromPts(pts); s.holes.push(G.circlePath(0, 0, BORE_R, true)); return s; };
    const padShape = withBore(sec.padWeb), armShape = withBore(sec.arm);
    const ang = Math.atan2(sec.u[1], sec.u[0]);
    for (let j = 0; j < 2; j++) {
      const xs = j ? 1 : -1, rng = (a, b) => xs > 0 ? [a, b] : [-b, -a];
      // x slabs (rocker frame, j = 1; mirrored for j = 0): the intake pad keeps 1 mm off the exhaust
      // rocker's hub, which shares its x range near the valve
      const [p0, p1] = d > 0 ? rng(d - 3.5, d + 5.5) : rng(d - 5, d + 5);
      const [h0, h1] = d > 0 ? rng(-5, d - 3.5) : rng(d + 5, 4.5), [v0, v1] = d > 0 ? rng(-5, 5) : rng(-5, 4.5);
      const parts = [
        G.extrudeX(padShape, p0, p1, { curveSegments: 12 }),
        G.tubeX(BORE_R, HUB_R, h0, h1, 40),
        G.extrudeX(armShape, v0, v1, { curveSegments: 12, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1 }),
        (() => { const g = new THREE.CylinderGeometry(6.8, 6.8, 12, 24); g.translate(0, 9, 0); g.rotateX(ang);
          g.translate(0, sec.ball[0], sec.ball[1]); return g; })(),
      ];
      rockers[side].push(mkInst(G.merge(parts), M.rocker, 'rocker', 4));
    }
    // adjusting screw with ball end and lock nut, on the valve's x
    const sc = [new THREE.SphereGeometry(4.2, 16, 10), (() => { const g = new THREE.CylinderGeometry(4, 4, 24, 16); g.translate(0, 12, 0); return g; })(),
      (() => { const g = G.hexPrism(11, 5); g.translate(0, 15.4, 0); return g; })()];
    const screw = G.merge(sc); screw.rotateX(ang); screw.translate(0, sec.ball[0], sec.ball[1]);
    screws[side] = mkInst(screw, M.adjScrew, 'rocker', 8);
  }

  /* ---------------- static: rocker shafts, shaft holders / cam caps, guides, seats, seals ---------------- */
  const sv = E.vt.in.shaft, se = E.vt.ex.shaft;
  const holder = (() => {                 // bank (a, s) profile: round the cam journal and both shafts
    const pts = hull(circle([E.camA, E.camS], 21, 40).concat(circle([sv.a, sv.s], 13, 32), circle([se.a, se.s], 13, 32), [[296, -30], [296, 30]]));
    return pts;
  })();
  const shaftG = { R: [], L: [] }, holdG = { R: [], L: [] }, boltG = { R: [], L: [] };
  for (const b of ['R', 'L']) {
    const [x0, x1] = E.headX[b];
    for (const sh of [sv, se]) { const g = G.cylX(E.rockerShaftR, x0 + 10, x1 - 10, 28); const [y, z] = toYZ(b, sh.a, sh.s); g.translate(0, y, z); shaftG[b].push(g); }
    const shape = G.shapeFromPts(holder.map(([a, s]) => toYZ(b, a, s)));
    for (const [a, s, r] of [[E.camA, E.camS, E.camJournalR + 0.15], [sv.a, sv.s, E.rockerShaftR + 0.05], [se.a, se.s, E.rockerShaftR + 0.05]]) {
      const [y, z] = toYZ(b, a, s); shape.holes.push(G.circlePath(y, z, r, true));
    }
    E.camJournals[b].forEach(x => {
      holdG[b].push(G.extrudeX(shape, x - 8, x + 8, { curveSegments: 14 }));
      for (const s of [-9, 9]) { const g = G.hexPrism(12, 6); g.rotateX(b === 'R' ? -Math.PI / 2 : Math.PI / 2);
        const [y, z] = toYZ(b, sv.a + 13, s); g.translate(x, y, z); boltG[b].push(g); }
    });
  }
  const addStatic = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'valvetrain'); m.castShadow = m.receiveShadow = true; out.static.push(m); return m; };
  for (const b of ['R', 'L']) {
    addStatic(G.merge(shaftG[b]), M.rockerShaft, 'rockerShaft');
    addStatic(G.merge(holdG[b]), MM.hw.alu, 'rockerShaft');
    addStatic(G.merge(boltG[b]), MM.hw.steel, 'rockerShaft');
  }
  const rubber = new THREE.MeshStandardMaterial({ color: MM.srgb('#16181b'), roughness: 0.65, metalness: 0 });
  const guideG = { R: [], L: [] }, seatG = [], sealG = { R: [], L: [] };
  const qValve = { in: [], ex: [] }, bankQ = [];
  for (let c = 0; c < 4; c++) {
    const b = E.cyl[c].bank;
    bankQ.push(BUILD_B4.bankQuat(E, c));
    for (const side of ['in', 'ex']) {
      const V = E.vt[side], q = BUILD_B4.bankQuat(E, c, V.sg * V.angle);
      qValve[side].push(q);
      for (let j = 0; j < 2; j++) {
        const xv = E.valveLocalX(side, j);
        const place = (geo, t) => { G.applyQ(geo, q); const p = BUILD_B4.local(E, c, xv, V.seat[0] + t * V.u[0], V.seat[1] + t * V.u[1]); geo.translate(p.x, p.y, p.z); return geo; };
        guideG[b].push(place(G.lathe([[3.05, 0], [6.2, 0], [6.2, 40], [5.4, 41], [3.05, 41]], 20, 0, undefined, true), 32));
        seatG.push(place(G.lathe([[6.4, 0], [14.2, 0], [14.2, 1.5], [6.4, 1.5], [6.4, 0]], 32, 0, undefined, true), E.springSeatT));
        sealG[b].push(place(G.lathe([[3.1, 0], [7, 0], [7, 5], [5, 7.5], [3.1, 7.5], [3.1, 0]], 20, 0, undefined, true), 73));
      }
    }
  }
  for (const b of ['R', 'L']) { addStatic(G.merge(guideG[b]), MM.hw.steel, headPart(b)); addStatic(G.merge(sealG[b]), rubber, headPart(b)); }
  addStatic(G.merge(seatG), M.retainer, 'springs');

  /* ---------------- ports: ghost tubes + per-valve flow curves (bank-local control points) ---------------- */
  const portGeos = { R: [], L: [] };
  const curveOf = (c, pts) => new THREE.CatmullRomCurve3(pts.map(([lx, a, s]) => BUILD_B4.local(E, c, lx, a, s)), false, 'centripetal');
  const I = E.vt.in, X = E.vt.ex;
  for (let c = 0; c < 4; c++) {
    const b = E.cyl[c].bank;
    out.ports.in.push([]); out.ports.ex.push([]);
    for (let j = 0; j < 2; j++) {
      const lx = E.valveLocalX('in', j), ex = E.valveLocalX('ex', j);
      const inPts = [[0, 287, 86], [0, 285, 70], [lx * 0.45, 276, 53], [lx * 0.85, 259, 36], [lx, 243, 25], [lx, I.seat[0] + 4 * I.u[0], I.seat[1] + 4 * I.u[1]]];
      const exPts = [[ex, X.seat[0] + 4 * X.u[0], X.seat[1] + 4 * X.u[1]], [ex, 243, -25], [ex * 0.85, 256, -41], [ex * 0.4, 264, -62], [0, 266, -82], [0, 266, -96]];
      const ci = curveOf(c, inPts), ce = curveOf(c, exPts);
      out.ports.in[c].push(ci); out.ports.ex[c].push(ce);
      portGeos[b].push(new THREE.TubeGeometry(curveOf(c, inPts.slice(1)), 28, j ? 12 : 12.2, 12, false));
      portGeos[b].push(new THREE.TubeGeometry(curveOf(c, exPts.slice(0, 5)), 28, 10.5, 12, false));
    }
    // siamesed entry of the intake port, and the exhaust exit
    portGeos[b].push(new THREE.TubeGeometry(curveOf(c, [[0, 287, 88], [0, 286, 74], [0, 280, 60]]), 8, 17, 16, false));
    portGeos[b].push(new THREE.TubeGeometry(curveOf(c, [[0, 265, -70], [0, 266, -84], [0, 266, -97]]), 8, 15, 16, false));
  }
  out.portMeshes = ['R', 'L'].map(b => {
    const m = new THREE.Mesh(G.merge(portGeos[b]), MM.ghost.ports); m.renderOrder = 2; ctx.tag(m, headPart(b), 'housing'); return m;
  });

  out.rockerMeshes = rockers; out.valveMeshes = valves;

  /* ---------------- update ---------------- */
  const m4 = new THREE.Matrix4(), pos = new V3(), one = new V3(1, 1, 1), scl = new V3(1, 1, 1);
  const qx = new THREE.Quaternion(), qq = new THREE.Quaternion(), AX = new V3(1, 0, 0);
  out.lifts = new Float32Array(16);           // [0..7] intake, [8..15] exhaust; index c·2 + j
  out.phi = new Float32Array(16);
  out.update = function (theta) {
    out.cams.forEach(g => { g.rotation.x = E.kappa * theta; });
    for (const side of ['in', 'ex']) {
      const V = E.vt[side], base = side === 'in' ? 0 : 8;
      for (let c = 0; c < 4; c++) {
        const phi = E.phiAt(c, side, theta), lift = E.valveLiftOfPhi(side, phi), qv = qValve[side][c];
        qx.setFromAxisAngle(AX, V.sg * phi); qq.copy(bankQ[c]).multiply(qx);
        for (let j = 0; j < 2; j++) {
          const k = c * 2 + j, xv = E.valveLocalX(side, j);
          out.lifts[base + k] = lift; out.phi[base + k] = phi;
          BUILD_B4.local(E, c, xv, V.seat[0] - lift * V.u[0], V.seat[1] - lift * V.u[1], pos);
          m4.compose(pos, qv, one); valves[side].setMatrixAt(k, m4);
          let t = E.springSeatT + 1.5;
          BUILD_B4.local(E, c, xv, V.seat[0] + t * V.u[0], V.seat[1] + t * V.u[1], pos);
          scl.set(1, (H0 - lift) / H0, 1); m4.compose(pos, qv, scl); springs.setMatrixAt(base + k, m4);
          t = E.springTopT - lift;
          BUILD_B4.local(E, c, xv, V.seat[0] + t * V.u[0], V.seat[1] + t * V.u[1], pos);
          m4.compose(pos, qv, one); retainers.setMatrixAt(base + k, m4); keepers.setMatrixAt(base + k, m4);
          BUILD_B4.local(E, c, xv, V.shaft.a, V.shaft.s, pos);
          m4.compose(pos, qq, one); rockers[side][j].setMatrixAt(c, m4); screws[side].setMatrixAt(k, m4);
        }
      }
    }
    out.instanced.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  };
  return out;
};
})();
