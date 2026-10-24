(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};
const V3 = THREE.Vector3;
const DEG = Math.PI / 180;

BUILD_V8.fuel = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat, Pp = E.pump;
  const out = { objects: [], lines: [], tips: [], injAxis: [] };
  const solid = (geo, mat, part, layer) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, layer || 'fuel'); m.castShadow = m.receiveShadow = true; return m; };
  const dirV = c => { const a = E.pumpPlunger(c).dir; return new V3(0, Math.cos(a), Math.sin(a)); };
  const pumpPt = (c, r) => dirV(c).multiplyScalar(r).add(new V3(E.pumpPlunger(c).x, E.pumpY, 0));

  const rotor = new THREE.Group();
  rotor.position.set(0, E.pumpY, 0);
  const shaftG = [G.cylX(12, Pp.x0 + 6, Pp.x1, 24), G.cylX(14, Pp.x1, E.gearX - 10, 24)];
  const brg = [G.cylX(17, Pp.x0 + 10, Pp.x0 + 26, 32), G.cylX(17, Pp.x1 - 16, Pp.x1, 32)];
  const coupling = [G.cylX(40, 200, 205, 40), G.cylX(40, 215, 220, 40), G.cylX(30, 205, 215, 32)];
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, b = G.hexPrism(10, 5); G.toX(b); b.translate(220, 28 * Math.cos(a), 28 * Math.sin(a)); coupling.push(b); }
  const lobeShape = G.shapeFromPts(E.pumpLobeProfile(200));
  const lobes = [];
  for (let c = 0; c < 8; c++) {
    const geo = new THREE.ExtrudeGeometry(lobeShape, { depth: Pp.lobeW, bevelEnabled: false, curveSegments: 1 });
    geo.rotateZ(E.pumpLobeAngle(c));
    geo.translate(0, 0, E.pumpPlunger(c).x - Pp.lobeW / 2);
    G.shapeToYZ(geo);
    lobes.push(geo);
  }
  rotor.add(solid(G.merge(shaftG.concat(brg)), MM.hw.steel, 'injPump'));
  rotor.add(solid(G.merge(lobes), M.pumpCam, 'injPump'));
  rotor.add(solid(G.merge(coupling), MM.hw.steel, 'injPump'));
  out.rotor = rotor;
  out.objects.push(rotor);

  const dR = [Math.cos(-Pp.rowAngle), Math.sin(-Pp.rowAngle)], pR = [-dR[1], dR[0]];
  const top = 116, half = 23;
  const corner = (d, p, r, k) => [d[0] * r + p[0] * k, d[1] * r + p[1] * k];
  const outline = [];
  outline.push([half / Math.sin(Pp.rowAngle), 0]);
  outline.push(corner(dR, pR, top, half));
  outline.push(corner(dR, pR, top, -half));
  const outerR = corner(dR, pR, 44, -half), a0 = Math.atan2(outerR[1], outerR[0]), rr = Math.hypot(outerR[0], outerR[1]);
  outline.push(outerR);
  for (let k = 1; k < 24; k++) { const a = a0 - (2 * Math.PI + 2 * a0) * k / 24; outline.push([rr * Math.cos(a), rr * Math.sin(a)]); }
  outline.push([outerR[0], -outerR[1]]);
  outline.push([outline[2][0], -outline[2][1]]);
  outline.push([outline[1][0], -outline[1][1]]);
  const housingGeo = G.extrudeX(G.shapeFromPts(outline), Pp.x0, Pp.x1, { curveSegments: 1 });
  housingGeo.translate(0, E.pumpY, 0);
  const gov = G.lathe([[0, 0], [52, 0], [56, 6], [56, 60], [0, 60]], 48, 0, undefined, true);
  G.toX(gov); gov.translate(Pp.x0 - 60, E.pumpY + 4, 0);
  const pumpGhost = G.merge([housingGeo, gov]);
  const hMesh = new THREE.Mesh(pumpGhost, MM.ghost.pump); hMesh.renderOrder = 2; ctx.tag(hMesh, 'injPump', 'fuel');
  const hEdges = new THREE.LineSegments(new THREE.EdgesGeometry(pumpGhost, 28), MM.ghostEdges.pump);
  hEdges.renderOrder = 3; hEdges.userData.pickable = false; ctx.tag(hEdges, 'injPump', 'fuel');
  out.objects.push(hMesh, hEdges);
  out.ghost = [MM.ghost.pump];

  const barrel = G.merge([
    G.lathe([[6.2, 74], [12, 74], [12, 104], [10, 104], [10, 112], [6.2, 112], [6.2, 74]], 28, 0, undefined, true),
    (() => { const h = G.hexPrism(19, 8); h.translate(0, 112, 0); return h; })(),
    G.lathe([[0, 120], [4.5, 120], [4.5, 124], [0, 124]], 16, 0, undefined, true),
  ]);
  const tappetGeo = G.lathe([[0, 0], [Pp.tappetR - 0.5, 0], [Pp.tappetR, 0.5], [Pp.tappetR, 3], [11, 4.5], [11, 20], [0, 20]], 32, 0, undefined, true);
  const plungerGeo = G.lathe([[0, 20], [5, 20], [5, 70], [0, 70]], 16, 0, undefined, true);
  const springGeo = G.coilSpring(10.5, 1.6, 4.6, 32, 1, 6);
  const mkI = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ctx.tag(m, 'injPump', 'fuel'); m.castShadow = m.receiveShadow = true; return m; };
  const iTap = mkI(tappetGeo, M.pumpCam, 8), iPl = mkI(plungerGeo, M.plunger, 8), iSp = mkI(springGeo, MM.hw.dark, 8);
  const barrels = [];
  const qOf = c => new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dirV(c));
  for (let c = 0; c < 8; c++) {
    const b = barrel.clone(); G.applyQ(b, qOf(c)); const p0 = pumpPt(c, 0); b.translate(p0.x, p0.y, p0.z); barrels.push(b);
  }
  out.objects.push(solid(G.merge(barrels), M.plunger, 'injPump'), iTap, iPl, iSp);

  const tilt = 15 * DEG;
  const injGeo = G.merge([
    G.lathe([[0, 0], [2.2, 0.6], [3.2, 2.5], [3.6, 6], [4.6, 7], [4.6, 22], [10, 22], [11, 24], [11, 50], [10, 52], [12.5, 52],
      [12.5, 140], [11, 144], [9, 146], [9, 158], [6, 160], [0, 160]], 32, 0, undefined, true),
    (() => { const t = G.lathe([[0, 160], [3, 160], [3, 168], [0, 168]], 12); return t; })(),
    (() => { const t = new THREE.CylinderGeometry(6, 6, 24, 16); t.rotateX(Math.PI / 2); t.translate(0, 128, 12); return t; })(),
    (() => { const h = G.hexPrism(17, 8); h.rotateX(Math.PI / 2); h.translate(0, 128, 18); return h; })(),
  ]);
  const injs = [];
  for (let c = 0; c < 8; c++) {
    const q = BUILD_V8.bankQuat(E, c, tilt), tip = BUILD_V8.local(E, c, 0, E.fireFace - 2, -2);
    const gq = injGeo.clone(); G.applyQ(gq, q); gq.translate(tip.x, tip.y, tip.z); injs.push(gq);
    out.tips.push(tip);
    out.injAxis.push(new V3(0, 1, 0).applyQuaternion(q));
  }
  out.objects.push(solid(G.merge(injs), M.injector, 'injector'));

  const pulseMat = [];
  const lineGeos = [];
  for (let c = 0; c < 8; c++) {
    const C = E.cyl[c], xp = E.pumpPlunger(c).x, sz = C.sgn;
    const fit = (a, s) => BUILD_V8.local(E, c, 0, a, s);
    const ia = E.fireFace - 2 + 128 * Math.cos(tilt) - 26 * Math.sin(tilt), is = -2 + 128 * Math.sin(tilt) + 26 * Math.cos(tilt);
    const lerp = t => C.x + (xp - C.x) * t;
    const pts = [fit(ia, is), fit(ia + 0.5, is + 20), fit(531, 118), fit(533, 152),
      new V3(lerp(0.3), 503, -sz * 216), new V3(lerp(0.75), 494, -sz * 140), pumpPt(c, 140), pumpPt(c, 124)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    lineGeos.push(new THREE.TubeGeometry(curve, 96, 3.2, 8, false));
    const pm = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pulse = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 4.4, 8, false), pm);
    pulse.renderOrder = 5; pulse.userData.pickable = false; ctx.tag(pulse, 'hpLines', 'fuel');
    pulseMat.push(pm); out.objects.push(pulse);
    out.lines.push(curve);
  }
  out.objects.push(solid(G.merge(lineGeos), M.hpLine, 'hpLines'));

  const m4 = new THREE.Matrix4(), one = new V3(1, 1, 1), scl = new V3(1, 1, 1), qs = [];
  for (let c = 0; c < 8; c++) qs.push(qOf(c));
  out.plunger = new Float32Array(8);
  out.update = function (theta) {
    rotor.rotation.x = -E.kappa * theta;
    const deg = theta / DEG;
    for (let c = 0; c < 8; c++) {
      const L = E.plungerLift(c, theta);
      out.plunger[c] = L;
      m4.compose(pumpPt(c, Pp.base + L), qs[c], one); iTap.setMatrixAt(c, m4); iPl.setMatrixAt(c, m4);
      scl.set(1, (32 - L) / 32, 1);
      m4.compose(pumpPt(c, Pp.base + 20 + L), qs[c], scl); iSp.setMatrixAt(c, m4);
      const ph = E.phaseOf(c, deg), d0 = E.inject.start - 6, d1 = E.inject.end;
      const on = ph >= d0 && ph <= d1 ? Math.sin(Math.PI * (ph - d0) / (d1 - d0)) : 0;
      pulseMat[c].opacity = 0.9 * on;
    }
    iTap.instanceMatrix.needsUpdate = iPl.instanceMatrix.needsUpdate = iSp.instanceMatrix.needsUpdate = true;
  };
  return out;
};
})();
