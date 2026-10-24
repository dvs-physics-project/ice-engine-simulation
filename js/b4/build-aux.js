(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};
const V3 = THREE.Vector3;

function gerotor(n, e, Ro, rp) {
  const pins = [], inner = [], rp2 = rp * rp;
  for (let s = 0; s < 1100; s++) {
    const th = s / 1100 * Math.PI * 2, ou = -e * Math.cos(-th), ov = -e * Math.sin(-th), rel = -th / (n + 1);
    for (let k = 0; k <= n; k++) { const a = rel + k / (n + 1) * Math.PI * 2; pins.push(ou + Ro * Math.cos(a), ov + Ro * Math.sin(a)); }
  }
  for (let r = 0; r < 300; r++) {
    const t = r / 300 * Math.PI * 2, du = Math.cos(t), dv = Math.sin(t);
    let best = Ro + rp;
    for (let j = 0; j < pins.length; j += 2) {
      const cu = pins[j], cv = pins[j + 1], b = du * cu + dv * cv; if (b <= 0) continue;
      const disc = b * b - (cu * cu + cv * cv - rp2); if (disc < 0) continue;
      const sHit = b - Math.sqrt(disc); if (sHit > 0 && sHit < best) best = sHit;
    }
    inner.push([best * du, best * dv]);
  }
  const outer = [];
  for (let r = 0; r < 420; r++) {
    const t = r / 420 * Math.PI * 2, du = Math.cos(t), dv = Math.sin(t);
    let best = Ro + 0.6 * rp;
    for (let k = 0; k <= n; k++) {
      const a = k / (n + 1) * Math.PI * 2, cu = Ro * Math.cos(a), cv = Ro * Math.sin(a), b = du * cu + dv * cv;
      const disc = b * b - (cu * cu + cv * cv - rp2); if (disc < 0) continue;
      const sHit = b - Math.sqrt(disc); if (sHit > 0 && sHit < best) best = sHit;
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

BUILD_B4.aux = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { fixed: [], crankChildren: [], sparkTips: [] };
  const solid = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'aux'); m.castShadow = m.receiveShadow = true; return m; };
  const [P0, P1] = E.oilPumpX;

  const hs = G.smoothShape([[56, 0], [50, 40], [22, 60], [-30, 64], [-78, 56], [-104, 30], [-110, -18], [-96, -58], [-44, -70], [12, -62], [46, -36]], 140);
  hs.holes.push(G.circlePath(0, 0, 22.5, true));
  const hGeo = G.extrudeX(hs, P0, P1, { curveSegments: 24 });
  const hMesh = new THREE.Mesh(hGeo, MM.ghost.oilpump); hMesh.renderOrder = 2; ctx.tag(hMesh, 'oilPump', 'aux');
  const hEdges = new THREE.LineSegments(new THREE.EdgesGeometry(hGeo, 30), MM.ghostEdges.oilpump);
  hEdges.renderOrder = 3; hEdges.userData.pickable = false; ctx.tag(hEdges, 'oilPump', 'aux');
  out.fixed.push(hMesh, hEdges);
  const ecc = 3.2, gr = gerotor(6, ecc, 33, 7);
  const innerShape = G.shapeFromPts(gr.inner); innerShape.holes.push(G.circlePath(0, 0, 20.05, true));
  out.crankChildren.push(solid(G.extrudeX(innerShape, P0 + 3, P1 - 3, { curveSegments: 20 }), M.oilRotor, 'oilPump'));
  const outerShape = new THREE.Shape(); outerShape.absarc(0, 0, 44, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); gr.outer.forEach((p, k) => k ? hole.lineTo(p[0], p[1]) : hole.moveTo(p[0], p[1])); hole.closePath();
  outerShape.holes.push(hole);
  const outerRotor = solid(G.extrudeX(outerShape, P0 + 3, P1 - 3, { curveSegments: 48 }), M.oilRotor, 'oilPump');
  const outerG = new THREE.Group(); outerG.position.set(0, -ecc, 0); outerG.add(outerRotor);
  out.fixed.push(outerG);
  const cm = new THREE.Shape(); cm.moveTo(52, -3); cm.lineTo(52, 3); cm.lineTo(44.5, 0); cm.closePath();
  const coverMark = new THREE.Mesh(G.extrudeX(cm, P0 - 0.8, P0), BUILD_B4.markMat());
  ctx.tag(coverMark, 'oilPump', 'aux'); out.fixed.push(coverMark);

  const pc = new THREE.CatmullRomCurve3([new V3(-96, -110, 32), new V3(-92, -140, 30), new V3(-78, -182, 20), new V3(-58, -222, 6), new V3(-46, -236, 0)], false, 'centripetal');
  const flange = G.lathe([[0, 0], [16, 0], [16, 3], [0, 3]], 24); flange.translate(-96, -112, 32);
  out.fixed.push(solid(G.merge([new THREE.TubeGeometry(pc, 48, 7, 14, false), flange]), M.pickup, 'pickup'));
  const strainer = G.lathe([[7, 0], [12, -2], [40, -9], [40, -12.5], [7.5, -12.5]], 56, 0, undefined, true); strainer.translate(-46, -236, 0);
  const mesh = G.lathe([[0, 0], [39.5, 0], [39.5, 0.6], [0, 0.6]], 56, 0, undefined, true); mesh.translate(-46, -249.2, 0);
  out.fixed.push(solid(G.merge([strainer, mesh]), M.strainer, 'pickup'));

  const fTop = new V3(-108, -85, -200), down = new V3(0, -1, 0);
  const can = G.lathe([[0, 10], [31, 10], [34, 12.5], [34, 80], [32.5, 86], [21, 90], [0, 91]], 56);
  const flutes = Array.from({ length: 12 }, (_, k) => { const a = k / 12 * Math.PI * 2, b = new THREE.BoxGeometry(5, 7, 5); b.translate(21 * Math.cos(a), 90.5, 21 * Math.sin(a)); return b; });
  out.fixed.push(solid(along(G.merge([can, ...flutes]), fTop, down), M.oilFilter, 'oilFilter'));
  out.fixed.push(solid(along(G.lathe([[0, 0], [30, 0], [30, 10], [0, 10]], 40, 0, undefined, true), fTop, down), MM.hw.alu, 'oilFilter'));
  const sensor = G.merge([
    G.lathe([[0, 0], [6, 0], [6, 9], [0, 9]], 20),
    (() => { const h = G.hexPrism(22, 7); h.translate(0, 9, 0); return h; })(),
    G.lathe([[0, 16], [13, 16], [13, 34], [10, 38], [0, 38]], 32),
    (() => { const t = new THREE.CylinderGeometry(3, 3, 8, 12); t.translate(0, 42, 0); return t; })(),
  ]);
  out.fixed.push(solid(along(sensor, new V3(-108, -85, -146), down), M.sensor, 'sensor'));

  const mountParts = [], rubber = [];
  for (const zs of [-1, 1]) {
    const x = 20, z = zs * 167;
    const hanger = new THREE.BoxGeometry(56, 34, 52); hanger.translate(x, -102, z); mountParts.push(hanger);
    const rib = new THREE.BoxGeometry(8, 30, 70); rib.translate(x, -100, zs * 132); mountParts.push(rib);
    const plate = new THREE.BoxGeometry(64, 5, 64); plate.translate(x, -121.5, z); mountParts.push(plate);
    const base = new THREE.BoxGeometry(72, 6, 72); base.translate(x, -181, z); mountParts.push(base);
    const stud = new THREE.CylinderGeometry(6, 6, 22, 12); stud.translate(x, -195, z); mountParts.push(stud);
    const cush = G.lathe([[0, 0], [24, 0], [29, 6], [29, 20], [24, 26], [27, 30], [29, 38], [29, 48], [24, 54], [0, 54]], 40);
    cush.translate(x, -178, z); rubber.push(cush);
  }
  out.fixed.push(solid(G.merge(mountParts), M.mount, 'mount'), solid(G.merge(rubber), M.mountRubber, 'mount'));

  const metal = [], ceramic = [], boots = [];
  for (let c = 0; c < 4; c++) {
    const q = BUILD_B4.bankQuat(E, c, E.plugAngle), tip = BUILD_B4.local(E, c, 0, E.plugTip[0], E.plugTip[1]);
    const place = g => { G.applyQ(g, q); g.translate(tip.x, tip.y, tip.z); return g; };
    const m = [
      (() => { const g = new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10); g.translate(0, 1.3, 0); return g; })(),
      (() => { const g = new THREE.BoxGeometry(1.6, 5.4, 2.6); g.translate(4.4, 1.8, 0); return g; })(),
      (() => { const g = new THREE.BoxGeometry(5, 1.3, 2.6); g.translate(2.4, -0.6, 0); return g; })(),
      G.lathe([[2.2, 4], [7, 4], [7, 21], [5, 21]], 32, 0, undefined, true),
      (() => { const h = G.hexPrism(16, 8); h.translate(0, 21, 0); return h; })(),
      (() => { const g = new THREE.CylinderGeometry(2.8, 2.8, 6, 12); g.translate(0, 62, 0); return g; })(),
    ];
    for (let k = 0; k < 8; k++) { const t = new THREE.TorusGeometry(7, 0.45, 5, 28); t.rotateX(Math.PI / 2); t.translate(0, 5.5 + k * 1.9, 0); m.push(t); }
    metal.push(place(G.merge(m)));
    const cer = [[0, 1.6], [2.4, 1.8], [4.0, 6], [4.6, 29]];
    for (let k = 0; k < 6; k++) { const y = 31 + k * 4.4; cer.push([5.2, y], [5.9, y + 1.2], [5.9, y + 2.4], [5.2, y + 3.6]); }
    cer.push([5.2, 58], [3, 58.6], [0, 58.6]);
    ceramic.push(place(G.lathe(cer, 32)));
    boots.push(place(G.lathe([[7, 46], [9, 49], [9, 160], [11.5, 164], [11.5, 178], [8, 182], [0, 182]], 32)));
    out.sparkTips.push(BUILD_B4.local(E, c, 0, E.plugTip[0] - 0.5, E.plugTip[1]));
  }
  out.fixed.push(solid(G.merge(metal), M.sparkMetal, 'spark'), solid(G.merge(ceramic), M.sparkCeramic, 'spark'), solid(G.merge(boots), M.sparkBoot, 'spark'));

  out.update = function (theta) { outerRotor.rotation.x = theta * 6 / 7; };
  return out;
};
})();
