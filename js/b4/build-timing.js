(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};
const V3 = THREE.Vector3;

BUILD_B4.beltPhases = function (E, sol) {
  const path = sol.path, p = E.beltPitch;
  const arcOf = key => path.pieces.find(pc => pc.type === 'arc' && pc.pulley.key === key);
  const crankArc = arcOf('crank');
  const sTooth0 = crankArc.s0 + crankArc.len / 2;
  const at = (pc, s) => { const q = E.beltSample(path, s); return Math.atan2(q.v - pc.pulley.v, q.u - pc.pulley.u); };
  const phase = { crank: at(crankArc, sTooth0) };
  for (const key of ['camR', 'camL', 'pump']) {
    const pc = arcOf(key), j = Math.round((pc.s0 + pc.len / 2 - sTooth0) / p);
    phase[key] = at(pc, sTooth0 + j * p);
  }
  return { sTooth0, phase };
};

BUILD_B4.timing = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat, sol = ctx.belt.sol, path = sol.path;
  const out = { objects: [], cover: [] };
  const L = path.length, bx = E.beltX, X0 = bx - E.beltW / 2, X1 = bx + E.beltW / 2;
  const solid = (geo, mat, part, layer) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, layer || 'timing'); m.castShadow = m.receiveShadow = true; return m; };

  const nS = Math.round(L / 2), ring = [];
  for (let k = 0; k < nS; k++) {
    const q = E.beltSample(path, k / nS * L);
    ring.push({ inner: [q.u + q.nu * E.beltIn, q.v + q.nv * E.beltIn], outer: [q.u - q.nu * E.beltBack, q.v - q.nv * E.beltBack], nu: q.nu, nv: q.nv });
  }
  const pos = [], nor = [], idx = [];
  [s => [[X0, ...s.outer], [X1, ...s.outer], [0, -s.nu, -s.nv]], s => [[X1, ...s.inner], [X0, ...s.inner], [0, s.nu, s.nv]],
   s => [[X0, ...s.inner], [X0, ...s.outer], [-1, 0, 0]], s => [[X1, ...s.outer], [X1, ...s.inner], [1, 0, 0]]].forEach(f => {
    const base = pos.length / 3;
    ring.forEach(s => { const [a, b, n] = f(s); pos.push(...a, ...b); nor.push(...n, ...n); });
    for (let k = 0; k < nS; k++) { const a = base + k * 2, b = base + ((k + 1) % nS) * 2; idx.push(a, b + 1, a + 1, a, b, b + 1); }
  });
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  band.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  band.setIndex(idx);
  const bandMat = M.belt.clone(); bandMat.side = THREE.DoubleSide; bandMat.userData.key = 'belt';
  M.beltBand = bandMat;
  out.objects.push(solid(band, bandMat, 'belt'));

  const ts = new THREE.Shape();
  ts.moveTo(-2.6, -0.2); ts.lineTo(2.6, -0.2); ts.lineTo(1.85, E.toothH - 0.9);
  ts.quadraticCurveTo(1.5, E.toothH, 0, E.toothH); ts.quadraticCurveTo(-1.5, E.toothH, -1.85, E.toothH - 0.9); ts.closePath();
  const tg = new THREE.ExtrudeGeometry(ts, { depth: E.beltW, bevelEnabled: false, curveSegments: 4 });
  tg.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, -E.beltW / 2, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
  const teeth = new THREE.InstancedMesh(tg, M.beltTooth, sol.N);
  teeth.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ctx.tag(teeth, 'belt', 'timing'); teeth.castShadow = teeth.receiveShadow = true;
  out.objects.push(teeth);

  const pul = key => sol.pulleys.find(p => p.key === key);
  const spins = [];
  const roller = (key, part, mat, x1Mount) => {
    const p = pul(key), Rr = p.R - E.beltBack;
    const g = new THREE.Group(); g.position.set(bx, p.u, p.v);
    const body = G.lathe([[10, -13], [Rr - 1.2, -13], [Rr, -11.8], [Rr, 11.8], [Rr - 1.2, 13], [10, 13], [10, -13]], 72, 0, undefined, true);
    G.toX(body);
    const web = G.tubeX(14, Rr - 5, -4, 4, 56);
    const spin = new THREE.Group(); spin.add(solid(G.merge([body, web]), mat, part)); g.add(spin);
    g.add(solid(G.merge([
      G.tubeX(6, 10, -13, 13, 32), G.tubeX(6, 14, -15, -13, 32),
      (() => { const h = G.hexPrism(14, 7); G.toX(h); h.translate(-22, 0, 0); return h; })(),
      G.tubeX(6, 13, 13, x1Mount - bx, 32),
    ]), M.tensArm, part));
    spins.push({ spin, R: p.R, side: p.side });
    out.objects.push(g);
    return p;
  };
  ['idler1', 'idler2', 'idler3'].forEach(k => roller(k, 'idler', M.idler, E.blockX[0]));
  const tp = roller('tens', 'tensioner', M.tensRoller, -150.5);

  const T = E.tensioner, tail = { u: tp.u - 12, v: tp.v + 48 };
  const circ = (c, r, n) => Array.from({ length: n }, (_, k) => [c.u + r * Math.cos(k / n * Math.PI * 2), c.v + r * Math.sin(k / n * Math.PI * 2)]);
  const bracket = G.shapeFromPts(BUILD_B4.hull(circ(T.pivot, 12, 32).concat(circ(tp, 15, 40), circ(tail, 8, 24))));
  bracket.holes.push(G.circlePath(T.pivot.u, T.pivot.v, 5.5, true));
  const pivotBolt = G.merge([(() => { const h = G.hexPrism(14, 1.6); G.toX(h); h.translate(-152.4, T.pivot.u, T.pivot.v); return h; })(),
    G.cylX(5.5, -150.8, -136, 16).translate(0, T.pivot.u, T.pivot.v)]);
  out.objects.push(solid(G.merge([G.extrudeX(bracket, -150.5, -145, { curveSegments: 16 }), pivotBolt]), M.tensArm, 'tensioner'));
  const rodEnd = new V3(-143, tail.u + 13, tail.v), top = new V3(-143, tail.u + 80, tail.v - 14);
  const dir = top.clone().sub(rodEnd).normalize();
  const bodyA = rodEnd.clone().addScaledVector(dir, 12), bodyB = top.clone().addScaledVector(dir, -8);
  out.objects.push(solid(G.merge([
    G.cylBetween(10.5, bodyA, bodyB, 28),
    G.cylBetween(12, bodyB.clone().addScaledVector(dir, -6), bodyB, 28),
    (() => { const e = new THREE.TorusGeometry(7, 3.2, 10, 24); e.rotateY(Math.PI / 2); e.translate(top.x, top.y, top.z); return e; })(),
  ]), M.tensBody, 'tensioner'));
  out.objects.push(solid(G.merge([G.cylBetween(4.2, rodEnd, bodyA.clone().addScaledVector(dir, 2), 16),
    (() => { const s = new THREE.SphereGeometry(5, 14, 10); s.translate(rodEnd.x, rodEnd.y, rodEnd.z); return s; })()]), M.tensArm, 'tensioner'));

  const pp = pul('pump'), Rp = E.pd(E.z.pump) / 2;
  const pump = new THREE.Group(); pump.position.set(0, pp.u, pp.v);
  const pumpSpin = new THREE.Group();
  pumpSpin.add(solid(G.merge([
    G.extrudeX(G.timingPulleyShape(E.z.pump, Rp, { phase: ctx.belt.phase.pump, holes: [G.circlePath(0, 0, 9, true)] }), X0 - 1, X1 + 1, { curveSegments: 16 }),
    G.tubeX(9, Rp + 4, X0 - 2.6, X0 - 1, 48), G.tubeX(9, Rp + 4, X1 + 1, X1 + 2.6, 48),
    G.tubeX(9, 17, X1 + 1, -144, 32),
    ...Array.from({ length: 4 }, (_, k) => { const a = (k + 0.5) / 4 * Math.PI * 2, h = G.hexPrism(8, 4); G.toX(h); h.translate(X0 - 6.6, 13 * Math.cos(a), 13 * Math.sin(a)); return h; }),
  ]), M.pumpPulley, 'pump'));
  pump.add(pumpSpin);
  pump.add(solid(G.merge([
    G.tubeX(8, 44, -144, -136, 64),
    G.cylX(30, -150, -144, 48),
    G.cylBetween(14, new V3(-142, -20, 30), new V3(-118, -60, 62), 24),
  ]), M.pumpBody, 'pump'));
  out.objects.push(pump);

  const Rk = E.pd(E.z.cam) / 2, markMat = BUILD_B4.markMat();
  for (const v of [-E.camA, E.camA]) {
    const s = new THREE.Shape(); s.moveTo(Rk + 16, -3.5); s.lineTo(Rk + 16, 3.5); s.lineTo(Rk + 8.5, 0); s.closePath();
    const g = G.extrudeX(s, X1 + 3, X1 + 4); g.translate(0, 0, v);
    const plate = G.extrudeX(G.roundRect(16, 22, 3), X1 + 4, X1 + 6); plate.translate(0, Rk + 13, v);
    out.objects.push(solid(G.merge([plate]), MM.hw.alu, 'camPulley'));
    const mk = new THREE.Mesh(g, markMat); ctx.tag(mk, 'camPulley', 'timing'); out.objects.push(mk);
  }

  const hullPts = [];
  sol.pulleys.forEach(p => { for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; hullPts.push([p.u + (p.R + 13) * Math.cos(a), p.v + (p.R + 13) * Math.sin(a)]); } });
  const coverGeo = G.extrudeX(G.shapeFromPts(BUILD_B4.hull(hullPts)), -212, -147, { curveSegments: 1 });
  const cover = new THREE.Mesh(coverGeo, MM.ghost.tcover); cover.renderOrder = 2; ctx.tag(cover, 'tcover', 'housing');
  const coverEdges = new THREE.LineSegments(new THREE.EdgesGeometry(coverGeo, 25), MM.ghostEdges.tcover);
  coverEdges.renderOrder = 3; coverEdges.userData.pickable = false; ctx.tag(coverEdges, 'tcover', 'housing');
  out.cover.push(cover, coverEdges);

  const m4 = new THREE.Matrix4(), ex = new V3(1, 0, 0), ey = new V3(), ez = new V3(), p0 = new V3();
  const Rc = E.pd(E.z.crank) / 2;
  out.update = function (theta) {
    const shift = theta * Rc;
    for (let j = 0; j < sol.N; j++) {
      const q = E.beltSample(path, ctx.belt.sTooth0 + j * E.beltPitch + shift);
      ey.set(0, q.nu, q.nv); ez.set(0, -q.nv, q.nu);
      m4.makeBasis(ex, ey, ez);
      p0.set(bx, q.u + q.nu * E.beltIn, q.v + q.nv * E.beltIn);
      m4.setPosition(p0);
      teeth.setMatrixAt(j, m4);
    }
    teeth.instanceMatrix.needsUpdate = true;
    spins.forEach(s => { s.spin.rotation.x = s.side * theta * Rc / s.R; });
    pumpSpin.rotation.x = theta * Rc / Rp;
  };
  return out;
};
})();
