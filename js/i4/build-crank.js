(function () {
'use strict';
window.BUILD_I4 = window.BUILD_I4 || {};

function webShape(E) {
  const r = E.r, Rb = E.pinBossR, Rcw = E.cwR, half = E.cwHalf;
  const pts = [];
  for (let a = -78; a <= 78; a += 6) {
    const t = a * Math.PI / 180;
    pts.push([r + Rb * Math.cos(t), Rb * Math.sin(t)]);
  }
  pts.push([16, 33.5]);
  pts.push([-6, 44]);
  for (let a = Math.PI - half; a <= Math.PI + half + 1e-6; a += (2 * half) / 22) {
    pts.push([Rcw * Math.cos(a), Rcw * Math.sin(a)]);
  }
  pts.push([-6, -44]);
  pts.push([16, -33.5]);
  return G.smoothShape(pts, 200);
}

BUILD_I4.crank = function (ctx) {
  const E = ctx.E, M = ctx.M.mat;
  const group = new THREE.Group();
  group.name = 'crankshaft';

  const forged = [], polished = [];
  const ws = webShape(E);
  for (let i = 0; i < 4; i++) {
    const x = E.cylX[i], th = E.throwAngle[i];
    for (const sgn of [-1, 1]) {
      const x0 = sgn < 0 ? x - E.webIn - E.webT : x + E.webIn;
      const geo = new THREE.ExtrudeGeometry(ws, { depth: E.webT - 2.4, bevelEnabled: true, bevelThickness: 1.2,
        bevelSize: 1.2, bevelSegments: 2, curveSegments: 6 });
      geo.rotateZ(th);
      geo.translate(0, 0, x0 + 1.2);
      G.shapeToYZ(geo);
      forged.push(geo);
    }
  }
  forged.push(G.cylX(20, -202, -182, 36));
  forged.push(G.cylX(17, -233, -202, 36));
  forged.push(G.cylX(15, -268, -233, 32));
  forged.push(G.cylX(38, 187, 193, 48));
  forged.push(G.cylX(42, 193, 197, 48));

  const mainSpan = [[-182, E.cylX[0] - E.webIn - E.webT]];
  for (let k = 1; k <= 3; k++) mainSpan.push([E.cylX[k - 1] + E.webIn + E.webT, E.cylX[k] - E.webIn - E.webT]);
  mainSpan.push([E.cylX[3] + E.webIn + E.webT, 187]);
  mainSpan.forEach(([a, b]) => polished.push(G.cylX(E.mainD / 2, a, b, 48)));
  for (let i = 0; i < 4; i++) {
    const g = G.cylX(E.rodJD / 2, E.cylX[i] - E.webIn, E.cylX[i] + E.webIn, 44);
    g.translate(0, E.r * Math.cos(E.throwAngle[i]), E.r * Math.sin(E.throwAngle[i]));
    polished.push(g);
  }
  const body = new THREE.Mesh(G.merge(forged), M.crankForged);
  const journals = new THREE.Mesh(G.merge(polished), M.crankJournal);
  [body, journals].forEach(m => { ctx.tag(m, 'crank', 'crank'); group.add(m); });

  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0c0e });
  const holes = [];
  E.mainX.forEach((x, k) => { const g = G.cylX(2.6, -0.4, 0.4, 12); g.rotateZ(Math.PI / 2); g.translate(x + (k === 0 ? -4 : 0), E.mainD / 2, 0); holes.push(g); });
  for (let i = 0; i < 4; i++) {
    const th = E.throwAngle[i] + Math.PI * 0.62;
    const g = G.cylX(2.4, -0.4, 0.4, 12); g.rotateZ(Math.PI / 2);
    g.translate(0, E.rodJD / 2, 0); g.rotateX(th);
    g.translate(E.cylX[i], E.r * Math.cos(E.throwAngle[i]), E.r * Math.sin(E.throwAngle[i]));
    holes.push(g);
  }
  const holeMesh = new THREE.Mesh(G.merge(holes), holeMat);
  ctx.tag(holeMesh, 'crank', 'crank');
  group.add(holeMesh);

  const R = E.pd(E.z.crank) / 2;
  const tp = G.timingPulleyShape(E.z.crank, R, { phase: ctx.belt.phase.crank, holes: [G.circlePath(0, 0, 17, true)] });
  const pulleyGeo = G.merge([
    G.extrudeX(tp, E.beltX - 13, E.beltX + 13, { curveSegments: 20 }),
    G.tubeX(17, R + 4.5, E.beltX - 14.6, E.beltX - 13, 56),
    G.tubeX(17, R + 4.5, E.beltX + 13, E.beltX + 14.6, 56),
  ]);
  const crankPulley = new THREE.Mesh(pulleyGeo, M.crankPulley);
  ctx.tag(crankPulley, 'crankPulley', 'timing');
  group.add(crankPulley);

  const pv = [];
  const ribs = 6, x0 = 3, x1 = 27, ribPitch = (x1 - x0) / ribs;
  pv.push([15, 0], [15, 31], [30, 31], [30, 27], [52, 25]);
  pv.push([52, x1 + 1.5], [63.5, x1 + 1.5]);
  for (let k = ribs; k >= 0; k--) {
    const xa = x0 + k * ribPitch;
    pv.push([65, xa]);
    if (k > 0) pv.push([62.4, xa - ribPitch / 2]);
  }
  pv.push([63.5, x0 - 1.5], [52, x0 - 1.5], [52, 6], [26, 4], [26, 0], [15, 0]);
  const accGeo = G.lathe(pv.map(p => [p[0], p[1]]), 72, 0, undefined, true);
  G.toX(accGeo); accGeo.translate(-264, 0, 0);
  const accPulley = new THREE.Mesh(accGeo, M.accPulley);
  ctx.tag(accPulley, 'accPulley', 'aux');
  group.add(accPulley);
  const bolt = G.merge([
    (() => { const g = G.hexPrism(22, 9); G.toX(g); g.translate(-277, 0, 0); return g; })(),
    G.tubeX(0, 17, -268, -264, 40),
  ]);
  const noseBolt = new THREE.Mesh(bolt, M.noseBolt);
  ctx.tag(noseBolt, 'crank', 'crank');
  group.add(noseBolt);

  const fwX = 197;
  const fw = G.lathe([[18, 4], [45, 4], [52, 10], [110, 10], [116, 0], [128.6, 0], [128.6, 27],
                      [120, 27], [120, 26], [75, 26], [70, 22], [45, 22], [45, 16], [18, 16], [18, 4]],
                      96, 0, undefined, true);
  G.toX(fw); fw.translate(fwX, 0, 0);
  const flywheel = new THREE.Mesh(fw, M.flywheel);
  ctx.tag(flywheel, 'flywheel', 'crank');
  group.add(flywheel);
  const face = G.lathe([[75.5, 25.9], [119.5, 25.9], [119.5, 26.5], [75.5, 26.5], [75.5, 25.9]], 96, 0, undefined, true);
  G.toX(face); face.translate(fwX, 0, 0);
  const fwFace = new THREE.Mesh(face, M.flywheelFace);
  ctx.tag(fwFace, 'flywheel', 'crank');
  group.add(fwFace);
  const ring = G.extrudeX(G.ringGearShape(104, 129.2, 133.5, 127.5), fwX + 2, fwX + 15, { curveSegments: 48 });
  const ringGear = new THREE.Mesh(ring, M.ringGear);
  ctx.tag(ringGear, 'flywheel', 'crank');
  group.add(ringGear);
  const fwBolts = [];
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2 + Math.PI / 6;
    const g = G.hexPrism(12, 6); G.toX(g); g.translate(fwX + 16, 30 * Math.cos(a), 30 * Math.sin(a));
    fwBolts.push(g);
  }
  const fwBoltMesh = new THREE.Mesh(G.merge(fwBolts), M.noseBolt);
  ctx.tag(fwBoltMesh, 'flywheel', 'crank');
  group.add(fwBoltMesh);

  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const fixed = new THREE.Group();
  const shells = [];
  E.mainX.forEach(x => {
    for (const upper of [true, false]) shells.push(halfShell(E.mainD / 2 + 0.05, E.mainD / 2 + 1.7, x - 9, x + 9, upper));
  });
  const mainShells = new THREE.Mesh(G.merge(shells), M.bearingMain);
  ctx.tag(mainShells, 'bearingMain', 'crank');
  fixed.add(mainShells);
  const thr = [halfShell(25, 36, 9.6, 12.1, true), halfShell(25, 36, -12.1, -9.6, true)];
  const thrust = new THREE.Mesh(G.merge(thr), M.thrust);
  ctx.tag(thrust, 'thrust', 'crank');
  fixed.add(thrust);
  fixed.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return {
    group, fixed,
    update(theta) { group.rotation.x = theta; },
  };
};

function halfShell(ri, ro, x0, x1, upper) {
  const gap = 0.025, len = Math.PI - 2 * gap;
  const geo = G.lathe([[ri, 0], [ro, 0], [ro, x1 - x0], [ri, x1 - x0], [ri, 0]], 40,
    upper ? Math.PI + gap : gap, len, true);
  G.toX(geo); geo.translate(x0, 0, 0);
  return geo;
}
BUILD_I4.halfShell = halfShell;
})();
