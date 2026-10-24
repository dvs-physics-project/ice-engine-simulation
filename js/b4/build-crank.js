/* b4/build-crank.js — поз. 1 crankshaft (5 mains, 4 throws, 8 webs with counterweights; seen
   from the front the throws of cylinders 1 and 4 point at the right bank, 2 and 3 at the left),
   поз. 10 crank sprocket (22 teeth, timing mark) and the nose bolt, the gerotor seat, поз. 6
   flywheel Ø344 with the starter ring gear; static main shells split on the vertical joint of
   the block halves, thrust half-rings at the centre main. Everything that turns with the crank
   lives in one group rotated by θ about X. */
(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};

// local frame of cylinder c (x along the crank, y = a out along the bore, z = s up) → world.
// The left bank is the right bank turned 180° about the vertical, so its local x runs to −X.
BUILD_B4.bankQuat = function (E, c, extraX) {
  const C = E.cyl[c];
  const m = new THREE.Matrix4().makeRotationX(C.beta);
  if (C.sgn < 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  if (extraX) m.multiply(new THREE.Matrix4().makeRotationX(extraX));
  return new THREE.Quaternion().setFromRotationMatrix(m);
};
BUILD_B4.local = function (E, c, lx, a, s, target) {
  const C = E.cyl[c], p = E.bankPoint(c, C.x + (C.sgn > 0 ? lx : -lx), a, s);
  return (target || new THREE.Vector3()).set(p[0], p[1], p[2]);
};
// half bearing shell, split on the vertical plane of the block joint: side +1 → the Z > 0 half
BUILD_B4.halfShellV = function (ri, ro, x0, x1, side) {
  const gap = 0.02, len = Math.PI - 2 * gap;
  const geo = G.lathe([[ri, 0], [ro, 0], [ro, x1 - x0], [ri, x1 - x0], [ri, 0]], 44, side > 0 ? -Math.PI / 2 + gap : Math.PI / 2 + gap, len, true);
  G.toX(geo); geo.translate(x0, 0, 0);
  return geo;
};
// half shell split across its own +Y axis (rod big ends)
BUILD_B4.halfShell = function (ri, ro, x0, x1, upper) {
  const gap = 0.02, len = Math.PI - 2 * gap;
  const geo = G.lathe([[ri, 0], [ro, 0], [ro, x1 - x0], [ri, x1 - x0], [ri, 0]], 40, upper ? Math.PI + gap : gap, len, true);
  G.toX(geo); geo.translate(x0, 0, 0);
  return geo;
};
BUILD_B4.markMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a2a').convertSRGBToLinear() });

// web: boss round the crank pin, waist at the main journal, counterweight opposite the pin
function webShape(E) {
  const r = E.r, Rb = 31, Rcw = 64, half = 56 * Math.PI / 180, pts = [];
  for (let a = -80; a <= 80; a += 5) { const t = a * Math.PI / 180; pts.push([r + Rb * Math.cos(t), Rb * Math.sin(t)]); }
  pts.push([16, 34], [-6, 41]);
  for (let k = 0; k <= 22; k++) { const a = Math.PI - half + 2 * half * k / 22; pts.push([Rcw * Math.cos(a), Rcw * Math.sin(a)]); }
  pts.push([-6, -41], [16, -34]);
  return G.smoothShape(pts, 200);
}

BUILD_B4.crank = function (ctx) {
  const E = ctx.E, M = ctx.M.mat;
  const group = new THREE.Group();
  group.name = 'crankshaft';
  const forged = [], polished = [];

  /* webs: each main journal runs straight into the web of its neighbouring throw */
  const ws = webShape(E), bev = 1.2;
  for (let k = 0; k < 4; k++) {
    const xp = E.pinX[k], th = E.pinAngle[k];
    for (const x0 of [xp - E.pinW / 2 - E.webT, xp + E.pinW / 2]) {
      const geo = new THREE.ExtrudeGeometry(ws, { depth: E.webT - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 6 });
      geo.rotateZ(th);
      geo.translate(0, 0, x0 + bev);
      G.shapeToYZ(geo);
      forged.push(geo);
    }
  }
  /* journals */
  E.mainX.forEach(x => polished.push(G.cylX(E.mainD / 2, x - E.mainW / 2, x + E.mainW / 2, 56)));
  for (let k = 0; k < 4; k++) {
    const g = G.cylX(E.pinD / 2, E.pinX[k] - E.pinW / 2, E.pinX[k] + E.pinW / 2, 52);
    g.translate(0, E.r * Math.cos(E.pinAngle[k]), E.r * Math.sin(E.pinAngle[k]));
    polished.push(g);
  }
  /* nose: seal land, gerotor seat, sprocket seat; tail: seal land + flywheel flange */
  const xf = E.mainX[0] - E.mainW / 2, xr = E.mainX[4] + E.mainW / 2;
  forged.push(G.cylX(22, -137, xf, 44));
  forged.push(G.cylX(20, -151, -137, 44));
  forged.push(G.cylX(17, -179.5, -151, 40));
  forged.push(G.cylX(50, xr, 140, 56));
  forged.push(G.cylX(62, 140, E.flywheelX, 64));
  const body = new THREE.Mesh(G.merge(forged), M.crankForged);
  const journals = new THREE.Mesh(G.merge(polished), M.crankJournal);
  [body, journals].forEach(m => { ctx.tag(m, 'crank', 'crank'); group.add(m); });

  // oil holes in the journals (dark dots riding round with the crank)
  const holes = [];
  E.mainX.forEach(x => { const g = G.cylX(2.8, -0.4, 0.4, 12); g.rotateZ(Math.PI / 2); g.translate(x, E.mainD / 2, 0); holes.push(g); });
  for (let k = 0; k < 4; k++) {
    const g = G.cylX(2.6, -0.4, 0.4, 12); g.rotateZ(Math.PI / 2); g.translate(0, E.pinD / 2, 0);
    g.rotateX(E.pinAngle[k] + 0.62 * Math.PI);
    g.translate(E.pinX[k], E.r * Math.cos(E.pinAngle[k]), E.r * Math.sin(E.pinAngle[k]));
    holes.push(g);
  }
  const hm = new THREE.Mesh(G.merge(holes), new THREE.MeshBasicMaterial({ color: 0x0b0c0e }));
  ctx.tag(hm, 'crank', 'crank'); group.add(hm);

  /* поз. 10 crank sprocket, 22 teeth, groove phase locked to the belt; mark at 12 o'clock */
  const Rc = E.pd(E.z.crank) / 2, bx = E.beltX;
  const sprocket = new THREE.Mesh(G.merge([
    G.extrudeX(G.timingPulleyShape(E.z.crank, Rc, { phase: ctx.belt.phase.crank, holes: [G.circlePath(0, 0, 17, true)] }), bx - 13, bx + 13, { curveSegments: 20 }),
    G.tubeX(17, Rc + 4.5, bx - 14.6, bx - 13, 56),
    G.tubeX(17, Rc + 4.5, bx + 13, bx + 14.6, 56),
  ]), M.crankSprocket);
  ctx.tag(sprocket, 'crankSprocket', 'timing'); group.add(sprocket);
  const mark = new THREE.Mesh((() => { const s = new THREE.Shape(); s.moveTo(Rc + 4.2, -2.4); s.lineTo(Rc + 4.2, 2.4); s.lineTo(Rc - 1.5, 0); s.closePath();   // shape (x, y) = (Y, Z): 12 o'clock
    return G.extrudeX(s, bx - 15.1, bx - 14.5); })(), BUILD_B4.markMat());
  ctx.tag(mark, 'crankSprocket', 'timing'); group.add(mark);
  const bolt = new THREE.Mesh(G.merge([
    G.tubeX(0, 17, -182.5, -179.5, 40),
    (() => { const g = G.hexPrism(22, 9); G.toX(g); g.translate(-191.5, 0, 0); return g; })(),
  ]), M.noseBolt);
  ctx.tag(bolt, 'crank', 'crank'); group.add(bolt);

  /* поз. 6 flywheel: hub on the flange, thin web, heavy rim, clutch face, ring gear, bolts */
  const fx = E.flywheelX, R6 = 168;
  const fw = G.lathe([[22, 0], [70, 0], [74, 4], [140, 4], [146, 0], [R6 - 4, 0], [R6, 4], [R6, 28], [R6 - 3, 30],
    [92, 30], [88, 26], [70, 26], [66, 22], [22, 22], [22, 0]], 112, 0, undefined, true);
  G.toX(fw); fw.translate(fx, 0, 0);
  const flywheel = new THREE.Mesh(fw, M.flywheel);
  const face = G.lathe([[92.5, 30.05], [R6 - 3.5, 30.05], [R6 - 3.5, 30.7], [92.5, 30.7], [92.5, 30.05]], 112, 0, undefined, true);
  G.toX(face); face.translate(fx, 0, 0);
  const fwFace = new THREE.Mesh(face, M.flywheelFace);
  const ringGear = new THREE.Mesh(G.extrudeX(G.ringGearShape(132, R6 + 0.4, R6 + 5.6, R6 - 3), fx + 15, fx + 29, { curveSegments: 64 }), M.ringGear);
  const fb = [];
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; const g = G.hexPrism(14, 7); G.toX(g); g.translate(fx + 22, 45 * Math.cos(a), 45 * Math.sin(a)); fb.push(g); }
  const fwBolts = new THREE.Mesh(G.merge(fb), M.noseBolt);
  [flywheel, fwFace, ringGear, fwBolts].forEach(m => { ctx.tag(m, 'flywheel', 'crank'); group.add(m); });

  group.traverse(o => { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });

  /* static: main shells (split on the block joint), thrust half-rings at the centre main */
  const fixed = new THREE.Group();
  const shells = [];
  E.mainX.forEach(x => {
    const w = x === 0 ? 6.8 : 9;
    for (const side of [1, -1]) shells.push(BUILD_B4.halfShellV(E.mainD / 2 + 0.05, E.mainD / 2 + 2.2, x - w, x + w, side));
  });
  const ms = new THREE.Mesh(G.merge(shells), M.bearingMain); ctx.tag(ms, 'bearingMain', 'crank'); fixed.add(ms);
  const thr = [BUILD_B4.halfShellV(31, 44, 7, 9.35, -1), BUILD_B4.halfShellV(31, 44, -9.35, -7, -1)];
  const tm = new THREE.Mesh(G.merge(thr), M.thrust); ctx.tag(tm, 'thrust', 'crank'); fixed.add(tm);
  fixed.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return { group, fixed, update(theta) { group.rotation.x = theta; } };
};
})();
