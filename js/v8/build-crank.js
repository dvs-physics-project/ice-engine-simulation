(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};
const DEG = Math.PI / 180;

function webShape(E) {
  const r = E.r, Rb = 52, Rcw = 128, half = 62 * DEG, pts = [];
  for (let a = -80; a <= 80; a += 5) { const t = a * DEG; pts.push([r + Rb * Math.cos(t), Rb * Math.sin(t)]); }
  pts.push([30, 64]); pts.push([-10, 84]);
  for (let a = Math.PI - half; a <= Math.PI + half + 1e-6; a += (2 * half) / 26) pts.push([Rcw * Math.cos(a), Rcw * Math.sin(a)]);
  pts.push([-10, -84]); pts.push([30, -64]);
  return G.smoothShape(pts, 220);
}

function halfShell(ri, ro, x0, x1, upper) {
  const gap = 0.02, len = Math.PI - 2 * gap;
  const geo = G.lathe([[ri, 0], [ro, 0], [ro, x1 - x0], [ri, x1 - x0], [ri, 0]], 44, upper ? Math.PI + gap : gap, len, true);
  G.toX(geo); geo.translate(x0, 0, 0);
  return geo;
}
BUILD_V8.halfShell = halfShell;

BUILD_V8.gearGeo = function (z, m, phase, x0, x1, opts) {
  const o = Object.assign({ bore: 14, hub: 0, holes: 0, holeR: 0, holeAt: 0, web: 0 }, opts || {});
  const R = m * z / 2;
  const holes = [G.circlePath(0, 0, o.bore, true)];
  for (let k = 0; k < o.holes; k++) { const a = k / o.holes * Math.PI * 2 + 0.3; holes.push(G.circlePath(o.holeAt * Math.cos(a), o.holeAt * Math.sin(a), o.holeR, true)); }
  const parts = [G.extrudeX(G.involuteGearShape(z, m, { phase, holes }), x0, x1, { curveSegments: 24 })];
  if (o.hub) parts.push(G.tubeX(o.bore, o.hub, x0 - 6, x1 + 6, 48));
  return G.merge(parts);
};

BUILD_V8.crank = function (ctx) {
  const E = ctx.E, M = ctx.M.mat;
  const group = new THREE.Group();
  const forged = [], polished = [];

  const ws = webShape(E);
  for (let k = 0; k < 4; k++) {
    const xp = E.pinX[k], th = E.pinAngle[k];
    for (const [x0, x1] of [[xp - E.pinLen / 2 - E.webT, xp - E.pinLen / 2], [xp + E.pinLen / 2, xp + E.pinLen / 2 + E.webT]]) {
      const geo = new THREE.ExtrudeGeometry(ws, { depth: E.webT - 3, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 6 });
      geo.rotateZ(th);
      geo.translate(0, 0, x0 + 1.5);
      G.shapeToYZ(geo);
      forged.push(geo);
    }
  }
  E.mainX.forEach(x => polished.push(G.cylX(E.mainD / 2, x - E.mainW / 2, x + E.mainW / 2, 56)));
  for (let k = 0; k < 4; k++) {
    const g = G.cylX(E.pinD / 2, E.pinX[k] - E.pinLen / 2, E.pinX[k] + E.pinLen / 2, 52);
    g.translate(0, E.r * Math.cos(E.pinAngle[k]), E.r * Math.sin(E.pinAngle[k]));
    polished.push(g);
  }
  const xf = E.mainX[0] - E.mainW / 2, xr = E.mainX[4] + E.mainW / 2;
  forged.push(G.cylX(40, xf - 30, xf, 48));
  forged.push(G.cylX(36, xf - 120, xf - 30, 44));
  forged.push(G.cylX(30, xf - 182, xf - 120, 40));
  forged.push(G.cylX(42, xr, xr + 28, 48));
  const body = new THREE.Mesh(G.merge(forged), M.crankForged);
  const flange = new THREE.Mesh(G.cylX(72, xr + 28, xr + 40, 64), M.crankForged);
  ctx.tag(flange, 'crank', 'flywheel'); group.add(flange);
  const journals = new THREE.Mesh(G.merge(polished), M.crankJournal);
  [body, journals].forEach(m => { ctx.tag(m, 'crank', 'crank'); group.add(m); });

  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0c0e });
  const holes = [];
  E.mainX.forEach(x => { const g = G.cylX(3.6, -0.5, 0.5, 12); g.rotateZ(Math.PI / 2); g.translate(x, E.mainD / 2, 0); holes.push(g); });
  for (let k = 0; k < 4; k++) for (const dx of [-18.5, 18.5]) {
    const g = G.cylX(3.4, -0.5, 0.5, 12); g.rotateZ(Math.PI / 2); g.translate(0, E.pinD / 2, 0);
    g.rotateX(E.pinAngle[k] + 0.9 * Math.PI);
    g.translate(E.pinX[k] + dx, E.r * Math.cos(E.pinAngle[k]), E.r * Math.sin(E.pinAngle[k]));
    holes.push(g);
  }
  const hm = new THREE.Mesh(G.merge(holes), holeMat); ctx.tag(hm, 'crank', 'crank'); group.add(hm);

  const gc = E.gears.crank;
  const crankGear = new THREE.Mesh(BUILD_V8.gearGeo(gc.z, E.module, gc.phase, E.gearX - E.gearW / 2, E.gearX + E.gearW / 2, { bore: 42 }), M.crankGear);
  ctx.tag(crankGear, 'crankGear', 'gears'); group.add(crankGear);
  const fz = E.front.gearZ, fPhase = 0;
  const frontGear = new THREE.Mesh(BUILD_V8.gearGeo(fz, E.module, fPhase, E.front.gearX - 10, E.front.gearX + 10,
    { bore: 40, holes: 5, holeR: 16, holeAt: 64 }), M.oilGear);
  ctx.tag(frontGear, 'oilPump', 'aux'); group.add(frontGear);
  E.front.crankPhase = fPhase;

  const pv = [[36, 0], [36, 40], [62, 40], [62, 36], [84, 34], [101, 34]];
  for (const yc of [26, 10]) pv.push([101, yc + 7.5], [90, yc + 2.5], [90, yc - 2.5], [101, yc - 7.5]);
  pv.push([101, 2], [84, 2], [62, 4], [62, 0], [36, 0]);
  const pg = G.lathe(pv, 80, 0, undefined, true);
  G.toX(pg); pg.translate(E.beltX - 18, 0, 0);
  const pulley = new THREE.Mesh(pg, M.crankPulley);
  ctx.tag(pulley, 'pulley', 'aux'); group.add(pulley);
  const dg = G.lathe([[30, 0], [140, 0], [140, 34], [30, 34], [30, 0]], 96, 0, undefined, true);
  G.toX(dg); dg.translate(xf - 180, 0, 0);
  const damper = new THREE.Mesh(dg, M.damper);
  ctx.tag(damper, 'pulley', 'aux'); group.add(damper);
  const ringPts = [];
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const g = G.hexPrism(14, 7); G.toX(g); g.translate(xf - 186, 95 * Math.cos(a), 95 * Math.sin(a)); ringPts.push(g); }
  const noseBolt = G.hexPrism(36, 14); G.toX(noseBolt); noseBolt.translate(xf - 196, 0, 0);
  const bolts = new THREE.Mesh(G.merge([...ringPts, noseBolt]), M.noseBolt);
  ctx.tag(bolts, 'crank', 'crank'); group.add(bolts);

  const fx = xr + 40;
  const fw = G.lathe([[44, 0], [96, 0], [104, 8], [200, 8], [206, 0], [240, 0], [240, 62], [226, 62], [226, 60],
    [128, 60], [120, 54], [96, 54], [96, 40], [44, 40], [44, 0]], 112, 0, undefined, true);
  G.toX(fw); fw.translate(fx, 0, 0);
  const flywheel = new THREE.Mesh(fw, M.flywheel);
  ctx.tag(flywheel, 'flywheel', 'flywheel'); group.add(flywheel);
  const face = G.lathe([[128, 60.2], [225, 60.2], [225, 61], [128, 61], [128, 60.2]], 112, 0, undefined, true);
  G.toX(face); face.translate(fx, 0, 0);
  const fwFace = new THREE.Mesh(face, M.flywheelFace); ctx.tag(fwFace, 'flywheel', 'flywheel'); group.add(fwFace);
  const ring = G.extrudeX(G.ringGearShape(150, 241, 248, 236), fx + 2, fx + 20, { curveSegments: 64 });
  const ringGear = new THREE.Mesh(ring, M.ringGear); ctx.tag(ringGear, 'flywheel', 'flywheel'); group.add(ringGear);
  const fb = [];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; const g = G.hexPrism(16, 8); G.toX(g); g.translate(fx + 62, 58 * Math.cos(a), 58 * Math.sin(a)); fb.push(g); }
  const fwBolts = new THREE.Mesh(G.merge(fb), M.noseBolt); ctx.tag(fwBolts, 'flywheel', 'flywheel'); group.add(fwBolts);

  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const fixed = new THREE.Group();
  const shells = [];
  E.mainX.forEach(x => { for (const up of [true, false]) shells.push(halfShell(E.mainD / 2 + 0.05, E.mainD / 2 + 2.4, x - 18, x + 18, up)); });
  const ms = new THREE.Mesh(G.merge(shells), M.bearingMain); ctx.tag(ms, 'bearingMain', 'crank'); fixed.add(ms);
  const x4 = E.mainX[4], thr = [];
  for (const up of [true, false]) {
    thr.push(halfShell(49, 66, x4 - E.mainW / 2 - 0.2, x4 - E.mainW / 2 + 2.4, up));
    thr.push(halfShell(49, 66, x4 + E.mainW / 2 - 2.4, x4 + E.mainW / 2 + 0.2, up));
  }
  const tm = new THREE.Mesh(G.merge(thr), M.thrust); ctx.tag(tm, 'thrust', 'crank'); fixed.add(tm);
  fixed.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return { group, fixed, update(theta) { group.rotation.x = theta; } };
};
})();
