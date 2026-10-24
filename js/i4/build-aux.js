(function () {
'use strict';
window.BUILD_I4 = window.BUILD_I4 || {};
const V3 = THREE.Vector3;

function gerotor(n, e, Ro, rp) {
  const rays = 300, steps = 1100, inner = [];
  const pins = [];
  for (let s = 0; s < steps; s++) {
    const th = s / steps * Math.PI * 2;
    const ca = Math.cos(-th), sa = Math.sin(-th);
    const ou = -e * ca, ov = -e * sa;
    const rel = -th / (n + 1);
    for (let k = 0; k <= n; k++) {
      const a = rel + k / (n + 1) * Math.PI * 2;
      pins.push(ou + Ro * Math.cos(a), ov + Ro * Math.sin(a));
    }
  }
  const rp2 = rp * rp;
  for (let r = 0; r < rays; r++) {
    const t = r / rays * Math.PI * 2, du = Math.cos(t), dv = Math.sin(t);
    let best = Ro + rp;
    for (let j = 0; j < pins.length; j += 2) {
      const cu = pins[j], cv = pins[j + 1], b = du * cu + dv * cv;
      if (b <= 0) continue;
      const disc = b * b - (cu * cu + cv * cv - rp2);
      if (disc < 0) continue;
      const sHit = b - Math.sqrt(disc);
      if (sHit > 0 && sHit < best) best = sHit;
    }
    inner.push([best * du, best * dv]);
  }
  const outer = [];
  for (let r = 0; r < 420; r++) {
    const t = r / 420 * Math.PI * 2, du = Math.cos(t), dv = Math.sin(t);
    let best = Ro + 0.6 * rp;
    for (let k = 0; k <= n; k++) {
      const a = k / (n + 1) * Math.PI * 2, cu = Ro * Math.cos(a), cv = Ro * Math.sin(a), b = du * cu + dv * cv;
      const disc = b * b - (cu * cu + cv * cv - rp2);
      if (disc < 0) continue;
      const sHit = b - Math.sqrt(disc);
      if (sHit > 0 && sHit < best) best = sHit;
    }
    outer.push([(best + 0.25) * du, (best + 0.25) * dv]);
  }
  return { inner, outer };
}
const along = (geo, from, dir) => {
  G.applyQ(geo, new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir.clone().normalize()));
  geo.translate(from.x, from.y, from.z);
  return geo;
};

BUILD_I4.aux = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { fixed: [], crankChildren: [] };
  const solid = (geo, mat, part, layer) => {
    const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, layer || 'aux');
    m.castShadow = m.receiveShadow = true; return m;
  };

  const housing = G.smoothShape([[50, -46], [58, 0], [50, 46], [10, 64], [-44, 60], [-70, 30], [-74, -6], [-58, -50], [-8, -64]], 120);
  housing.holes.push(G.circlePath(0, 0, 21.5, true));
  const hGeo = G.extrudeX(housing, -202, -182, { curveSegments: 20 });
  const hMesh = new THREE.Mesh(hGeo, MM.ghost.oilpump); hMesh.renderOrder = 2; ctx.tag(hMesh, 'oilPump', 'aux');
  const hEdges = new THREE.LineSegments(new THREE.EdgesGeometry(hGeo, 30), MM.ghostEdges.oilpump);
  hEdges.renderOrder = 3; hEdges.userData.pickable = false; ctx.tag(hEdges, 'oilPump', 'aux');
  out.fixed.push(hMesh, hEdges);
  const ecc = 3.2, gr = gerotor(6, ecc, 33, 7);
  const innerShape = G.shapeFromPts(gr.inner);
  innerShape.holes.push(G.circlePath(0, 0, 20.05, true));
  const inner = solid(G.extrudeX(innerShape, -197, -187, { curveSegments: 20 }), M.oilRotor, 'oilPump');
  out.crankChildren.push(inner);
  const outerShape = new THREE.Shape(); outerShape.absarc(0, 0, 44, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); gr.outer.forEach((p, k) => k ? hole.lineTo(p[0], p[1]) : hole.moveTo(p[0], p[1])); hole.closePath();
  outerShape.holes.push(hole);
  const outerRotor = solid(G.extrudeX(outerShape, -197, -187, { curveSegments: 48 }), M.oilRotor, 'oilPump');
  const outerG = new THREE.Group(); outerG.position.set(0, -ecc, 0); outerG.add(outerRotor);
  out.fixed.push(outerG);

  const pickupCurve = new THREE.CatmullRomCurve3([
    new V3(-192, -54, 4), new V3(-190, -84, 4), new V3(-172, -114, 2), new V3(-140, -128, 0),
    new V3(-116, -132, 0), new V3(-108, -146, 0)], false, 'centripetal');
  const pick = solid(G.merge([
    new THREE.TubeGeometry(pickupCurve, 64, 7, 14, false),
    G.cylBetween(3, new V3(-150, -126, 0), new V3(-150, -60, 34), 10),
  ]), M.pickup, 'pickup');
  const strainer = G.merge([
    G.lathe([[7, 0], [12, -2.5], [42, -10], [42, -13.5], [7.5, -13.5]], 56, 0, undefined, true),
  ]);
  strainer.translate(-108, -146, 0);
  const mesh = G.lathe([[0, 0], [40.5, 0], [40.5, 0.6], [0, 0.6]], 56, 0, undefined, true);
  mesh.translate(-108, -160.2, 0);
  const strainMesh = solid(G.merge([strainer, mesh]), M.strainer, 'pickup');
  out.fixed.push(pick, strainMesh);

  const fDir = new V3(0, -Math.sin(22 * E.DEG), Math.cos(22 * E.DEG));
  const fBase = new V3(-40, 35, 79);
  const can = G.lathe([[0, 8], [33, 8], [37.5, 10], [38, 12], [38, 84], [36.5, 90], [24, 94], [0, 95]], 56);
  const flutes = [];
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const b = new THREE.BoxGeometry(5, 7, 5);
    b.translate(24 * Math.cos(a), 94.5, 24 * Math.sin(a)); flutes.push(b); }
  const boss = G.lathe([[0, 0], [30, 0], [30, 8], [0, 8]], 40, 0, undefined, true);
  const filter = solid(along(G.merge([can, ...flutes]), fBase, fDir), M.oilFilter, 'oilFilter');
  const filterBoss = solid(along(boss, fBase, fDir), MM.hw.alu, 'oilFilter');
  out.fixed.push(filter, filterBoss);

  const ks = G.merge([
    G.lathe([[0, 0], [13, 0], [13, 12], [9, 15], [0, 15]], 40),
    (() => { const b = new THREE.BoxGeometry(14, 10, 22); b.translate(0, 8, 18); return b; })(),
    (() => { const g = G.hexPrism(12, 6); g.translate(0, 15, 0); return g; })(),
  ]);
  out.fixed.push(solid(along(ks, new V3(0, 120, -71), new V3(0, 0, -1)), M.knock, 'knock'));

  const dipCurve = new THREE.CatmullRomCurve3([new V3(58, -150, -54), new V3(58, -60, -76), new V3(60, 40, -88), new V3(62, 112, -96)], false, 'centripetal');
  const dip = G.merge([
    new THREE.TubeGeometry(dipCurve, 48, 3.4, 10, false),
    (() => { const t = new THREE.TorusGeometry(9, 2.4, 10, 28); t.rotateY(Math.PI / 2); t.translate(62, 127, -97); return t; })(),
    (() => { const c = new THREE.CylinderGeometry(4.6, 4.6, 10, 16); c.translate(62, 114, -96); return c; })(),
  ]);
  out.fixed.push(solid(dip, M.dipstick, 'dipstick'));

  const outCurve = new THREE.CatmullRomCurve3([new V3(196, 262, -20), new V3(226, 262, -24), new V3(252, 250, -30), new V3(266, 226, -34)]);
  const outlet = G.merge([
    (() => { const b = new THREE.BoxGeometry(14, 46, 40); b.translate(197, 260, -20); return b; })(),
    new THREE.TubeGeometry(outCurve, 40, 15, 20, false),
    (() => { const c = G.lathe([[0, 0], [8, 0], [8, 12], [5, 14], [0, 14]], 24); c.translate(214, 276, -20); return c; })(),
    (() => { const g = G.hexPrism(14, 6); g.translate(214, 272, -20); return g; })(),
  ]);
  out.fixed.push(solid(outlet, M.outlet, 'outlet'));

  const tipY = E.headY + 20.5;
  const plugMetal = [], plugCeramic = [], boots = [];
  for (let i = 0; i < 4; i++) {
    const x = E.cylX[i];
    const g = [];
    g.push((() => { const c = new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10); c.translate(0, 1.3, 0); return c; })());
    g.push((() => { const b = new THREE.BoxGeometry(1.6, 6, 2.6); b.translate(4.6, 1.5, 0); return b; })());
    g.push((() => { const b = new THREE.BoxGeometry(5, 1.3, 2.6); b.translate(2.6, -1.0, 0); return b; })());
    g.push(G.lathe([[2.2, 4], [7, 4], [7, 23], [5, 23]], 32, 0, undefined, true));
    for (let k = 0; k < 9; k++) { const t = new THREE.TorusGeometry(7, 0.45, 5, 28); t.rotateX(Math.PI / 2); t.translate(0, 6 + k * 1.9, 0); g.push(t); }
    g.push((() => { const h = G.hexPrism(16, 7); h.translate(0, 24, 0); return h; })());
    g.push((() => { const c = new THREE.CylinderGeometry(2.8, 2.8, 6, 12); c.translate(0, 63, 0); return c; })());
    const metal = G.merge(g); metal.translate(x, tipY, 0); plugMetal.push(metal);
    const cer = [[0, 1.6], [2.4, 1.8], [4.0, 6], [4.6, 31]];
    for (let k = 0; k < 6; k++) { const y = 33 + k * 4.4; cer.push([5.2, y], [5.9, y + 1.2], [5.9, y + 2.4], [5.2, y + 3.6]); }
    cer.push([5.2, 60], [3, 60.5], [0, 60.5]);
    const ce = G.lathe(cer, 32); ce.translate(x, tipY, 0); plugCeramic.push(ce);
    const bootH = 368 - (tipY + 50);
    const boot = G.lathe([[8, 0], [10.5, 3], [10.5, bootH], [0, bootH]], 32);
    boot.translate(x, tipY + 50, 0); boots.push(boot);
    const head = new THREE.ExtrudeGeometry(G.roundRect(30, 44, 7), { depth: 16, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2, curveSegments: 6 });
    head.rotateX(-Math.PI / 2); head.translate(x, 368, 0); boots.push(head);
    const plug = new THREE.BoxGeometry(14, 10, 12); plug.translate(x, 378, -27); boots.push(plug);
  }
  out.fixed.push(solid(G.merge(plugMetal), M.sparkMetal, 'spark'), solid(G.merge(plugCeramic), M.sparkCeramic, 'spark'),
    solid(G.merge(boots), M.sparkBoot, 'spark'));
  out.sparkTips = E.cylX.map(x => new V3(x, tipY - 0.4, 0));

  const dInj = new V3(0, Math.cos(38 * E.DEG), -Math.sin(38 * E.DEG));
  const railC = new V3(0, 232, -68).addScaledVector(dInj, 76);
  const injBody = [], injSeal = [];
  for (let i = 0; i < 4; i++) {
    const tip = new V3(E.cylX[i], 232, -68);
    const b = G.merge([
      G.lathe([[0, 0], [3.2, 0], [3.2, 7], [7.6, 9], [7.6, 46], [5.2, 48], [5.2, 60], [0, 60]], 28),
      (() => { const c = new THREE.BoxGeometry(12, 10, 9); c.translate(9, 38, 0); return c; })(),
    ]);
    injBody.push(along(b, tip, dInj));
    const o1 = new THREE.TorusGeometry(5.6, 1.3, 8, 24); o1.rotateX(Math.PI / 2); o1.translate(0, 8, 0);
    const o2 = new THREE.TorusGeometry(5.4, 1.2, 8, 24); o2.rotateX(Math.PI / 2); o2.translate(0, 50, 0);
    injSeal.push(along(G.merge([o1, o2]), tip, dInj));
    const cup = new THREE.CylinderGeometry(8.4, 8.4, 16, 24, 1);
    cup.translate(0, -8, 0);
    injSeal.push(along(cup, new V3(E.cylX[i], railC.y, railC.z), dInj));
  }
  const rail = G.merge([
    G.cylX(9.5, -182, 168, 28).translate(0, railC.y, railC.z),
    G.cylX(12.5, -198, -182, 28).translate(0, railC.y, railC.z),
    G.cylX(5.5, 168, 190, 16).translate(0, railC.y, railC.z),
    ...injSeal,
  ]);
  out.fixed.push(solid(G.merge(injBody), M.injector, 'fuel'), solid(rail, M.fuelRail, 'fuel'));

  out.update = function (theta) { outerRotor.rotation.x = theta * 6 / 7; };
  return out;
};
})();
