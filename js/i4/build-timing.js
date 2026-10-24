(function () {
'use strict';
window.BUILD_I4 = window.BUILD_I4 || {};
const V3 = THREE.Vector3;

BUILD_I4.beltPhases = function (E, sol) {
  const path = sol.path, p = E.beltPitch;
  const arcOf = key => path.pieces.find(pc => pc.type === 'arc' && pc.pulley.key === key);
  const crankArc = arcOf('crank');
  const sTooth0 = crankArc.s0 + crankArc.len / 2;
  const phase = {};
  const at = (pc, s) => { const q = E.beltSample(path, s); return Math.atan2(q.v - pc.pulley.v, q.u - pc.pulley.u); };
  phase.crank = at(crankArc, sTooth0);
  for (const key of ['camIn', 'camEx', 'pump']) {
    const pc = arcOf(key);
    const mid = pc.s0 + pc.len / 2;
    const j = Math.round((mid - sTooth0) / p);
    phase[key] = at(pc, sTooth0 + j * p);
  }
  return { sTooth0, phase };
};

BUILD_I4.timing = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat, sol = ctx.belt.sol, path = sol.path;
  const out = {};
  const L = path.length, X0 = E.beltX - E.beltW / 2, X1 = E.beltX + E.beltW / 2;

  const nS = Math.round(L / 2);
  const pos = [], nor = [], idx = [];
  const ring = [];
  for (let k = 0; k < nS; k++) {
    const q = E.beltSample(path, k / nS * L);
    const inner = [q.u + q.nu * E.beltIn, q.v + q.nv * E.beltIn];
    const outer = [q.u - q.nu * E.beltBack, q.v - q.nv * E.beltBack];
    ring.push({ inner, outer, nu: q.nu, nv: q.nv });
  }
  const faces = [
    s => [[X0, ...s.outer], [X1, ...s.outer], [0, -s.nu, -s.nv]],
    s => [[X1, ...s.inner], [X0, ...s.inner], [0, s.nu, s.nv]],
    s => [[X0, ...s.inner], [X0, ...s.outer], [-1, 0, 0]],
    s => [[X1, ...s.outer], [X1, ...s.inner], [1, 0, 0]],
  ];
  faces.forEach((f, fi) => {
    const base = pos.length / 3;
    ring.forEach(s => {
      const [a, b, n] = f(s);
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      nor.push(...n, ...n);
    });
    for (let k = 0; k < nS; k++) {
      const a = base + k * 2, b = base + ((k + 1) % nS) * 2;
      idx.push(a, b + 1, a + 1, a, b, b + 1);
    }
  });
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  band.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  band.setIndex(idx);
  const bandMat = M.belt.clone(); bandMat.side = THREE.DoubleSide; bandMat.userData.key = 'belt';
  M.beltBand = bandMat;
  const bandMesh = new THREE.Mesh(band, bandMat);
  ctx.tag(bandMesh, 'belt', 'timing');
  bandMesh.castShadow = bandMesh.receiveShadow = true;

  const ts = new THREE.Shape();
  ts.moveTo(-2.6, -0.2); ts.lineTo(2.6, -0.2); ts.lineTo(1.85, E.toothH - 0.9);
  ts.quadraticCurveTo(1.5, E.toothH, 0, E.toothH); ts.quadraticCurveTo(-1.5, E.toothH, -1.85, E.toothH - 0.9);
  ts.closePath();
  const tg = new THREE.ExtrudeGeometry(ts, { depth: E.beltW, bevelEnabled: false, curveSegments: 4 });
  tg.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, -E.beltW / 2, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
  const teeth = new THREE.InstancedMesh(tg, M.beltTooth, sol.N);
  teeth.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ctx.tag(teeth, 'belt', 'timing');
  teeth.castShadow = teeth.receiveShadow = true;

  const tp = sol.pulleys.find(p => p.key === 'tens'), T = E.tensioner;
  const tens = new THREE.Group();
  tens.position.set(E.beltX, tp.u, tp.v);
  const roller = G.lathe([[8.5, -13], [T.R - 1.2, -13], [T.R, -11.8], [T.R, 11.8], [T.R - 1.2, 13], [8.5, 13], [8.5, -13]],
    64, 0, undefined, true);
  G.toX(roller);
  const rivets = Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2; const g = G.cylX(2.2, -13.7, -12.6, 12);
    g.translate(0, 18 * Math.cos(a), 18 * Math.sin(a)); return g; });
  const rollerMesh = new THREE.Mesh(G.merge([roller, ...rivets]), M.tensRoller);
  ctx.tag(rollerMesh, 'tensioner', 'timing');
  const spin = new THREE.Group();
  spin.add(rollerMesh);
  tens.add(spin);
  const hub = new THREE.Mesh(G.merge([
    G.tubeX(5, 8.5, -13, 13, 32),
    G.tubeX(5, 12, -15.5, -13, 32),
    (() => { const g = G.hexPrism(13, 7); G.toX(g); g.translate(-22.5, 0, 0); return g; })(),
  ]), M.tensArm);
  ctx.tag(hub, 'tensioner', 'timing');
  tens.add(hub);
  const du = tp.u - T.pivot.u, dv = tp.v - T.pivot.v, len = Math.hypot(du, dv), ang = Math.atan2(dv, du);
  const arm = new THREE.Shape();
  arm.absarc(0, 0, 13, Math.PI / 2, Math.PI * 1.5, false);
  arm.lineTo(len, -11); arm.absarc(len, 0, 11, -Math.PI / 2, Math.PI / 2, false); arm.lineTo(0, 13);
  arm.holes.push(G.circlePath(0, 0, 5, true));
  const armGeo = new THREE.ExtrudeGeometry(arm, { depth: 6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1, curveSegments: 16 });
  armGeo.rotateZ(ang); armGeo.translate(T.pivot.u, T.pivot.v, X1 + 2.2);
  G.shapeToYZ(armGeo);
  const pivotBolt = G.merge([
    (() => { const g = G.hexPrism(14, 7); G.toX(g); g.translate(-211, 0, 0); g.translate(0, T.pivot.u, T.pivot.v); return g; })(),
    (() => { const g = G.cylX(5, -204, -182, 16); g.translate(0, T.pivot.u, T.pivot.v); return g; })(),
  ]);
  const armMesh = new THREE.Mesh(G.merge([armGeo, pivotBolt]), M.tensArm);
  ctx.tag(armMesh, 'tensioner', 'timing');
  [rollerMesh, hub, armMesh].forEach(m => { m.castShadow = m.receiveShadow = true; });

  const pp = sol.pulleys.find(p => p.key === 'pump');
  const pump = new THREE.Group();
  pump.position.set(0, pp.u, pp.v);
  const Rp = E.pd(E.z.pump) / 2;
  const pumpPulley = new THREE.Mesh(G.merge([
    G.extrudeX(G.timingPulleyShape(E.z.pump, Rp, { phase: ctx.belt.phase.pump, holes: [G.circlePath(0, 0, 8, true)] }), X0 - 0.5, X1 + 0.5, { curveSegments: 16 }),
    G.tubeX(8, Rp + 3.6, X0 - 2, X0 - 0.5, 40), G.tubeX(8, Rp + 3.6, X1 + 0.5, X1 + 2, 40),
    (() => { const g = G.hexPrism(10, 5); G.toX(g); g.translate(X0 - 7, 0, 0); return g; })(),
  ]), M.pumpPulley);
  ctx.tag(pumpPulley, 'coolantPump', 'timing');
  pumpPulley.castShadow = pumpPulley.receiveShadow = true;
  const pumpSpin = new THREE.Group(); pumpSpin.add(pumpPulley); pump.add(pumpSpin);
  const volute = G.merge([
    G.tubeX(0, 50, -203, -184, 64),
    G.tubeX(0, 30, -207, -203, 48),
    (() => { const g = G.cylBetween(13, new V3(-193, 0, 40), new V3(-193, -38, 74), 24); return g; })(),
  ]);
  const pumpBody = new THREE.Mesh(volute, M.pumpBody);
  ctx.tag(pumpBody, 'coolantPump', 'aux');
  pumpBody.castShadow = pumpBody.receiveShadow = true;
  pump.add(pumpBody);

  const hullPts = [];
  sol.pulleys.forEach(p => { for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; hullPts.push([p.u + (p.R + 14) * Math.cos(a), p.v + (p.R + 14) * Math.sin(a)]); } });
  const hull = convexHull(hullPts);
  const coverShape = G.shapeFromPts(hull);
  const coverGeo = G.extrudeX(coverShape, E.beltX - 26, E.beltX + 18, { curveSegments: 1 });
  const cover = new THREE.Mesh(coverGeo, MM.ghost.tcover);
  cover.renderOrder = 2;
  ctx.tag(cover, 'tcover', 'housing');
  const coverEdges = new THREE.LineSegments(new THREE.EdgesGeometry(coverGeo, 25), MM.ghostEdges.tcover);
  ctx.tag(coverEdges, 'tcover', 'housing');
  out.cover = [cover, coverEdges];

  out.objects = [bandMesh, teeth, tens, armMesh, pump];

  const m4 = new THREE.Matrix4(), bx = new V3(1, 0, 0), by = new V3(), bz = new V3(), p0 = new V3();
  const Rc = E.pd(E.z.crank) / 2;
  out.update = function (theta) {
    const shift = theta * Rc;
    for (let j = 0; j < sol.N; j++) {
      const q = E.beltSample(path, ctx.belt.sTooth0 + j * E.beltPitch + shift);
      by.set(0, q.nu, q.nv); bz.set(0, -q.nv, q.nu);
      m4.makeBasis(bx, by, bz);
      p0.set(E.beltX, q.u + q.nu * E.beltIn, q.v + q.nv * E.beltIn);
      m4.setPosition(p0);
      teeth.setMatrixAt(j, m4);
    }
    teeth.instanceMatrix.needsUpdate = true;
    spin.rotation.x = -theta * Rc / T.R;
    pumpSpin.rotation.x = theta * Rc / Rp;
  };
  return out;
};

function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let k = p.length - 1; k >= 0; k--) { const q = p[k]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
})();
