/* b4/build-housings.js — castings as ghosts with blueprint edges: поз. 2 block (two halves split
   on the vertical plane through the crank axis: cylinder barrels, five main bulkheads), поз. 13 /
   12 heads (profile from the cross-section: pent-roof face, intake bosses up, exhaust down),
   their covers, поз. 20 oil pan (deep at the front, sloping up to the rear); solid поз. 3 head
   gaskets, поз. 38 head bolts and поз. 34/35 case through-bolts with nuts. Bank profiles are
   drawn in (a, s) and mapped to (Y, Z) per side; X ranges come from the longitudinal section. */
(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};

BUILD_B4.housings = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { meshes: [], edges: [], solids: [] };
  const ghost = (geo, key, part, edgeAngle) => {
    const m = new THREE.Mesh(geo, MM.ghost[key]); m.renderOrder = 2; ctx.tag(m, part, 'housing');
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeAngle || 24), MM.ghostEdges[key]);
    e.renderOrder = 3; e.userData.pickable = false; ctx.tag(e, part, 'housing');
    out.meshes.push(m); out.edges.push(e);
    return m;
  };
  const solid = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'housing'); m.castShadow = m.receiveShadow = true; out.solids.push(m); return m; };
  const toYZ = (b, a, s) => [s, b === 'R' ? -a : a];
  const bankShape = (b, pts) => G.shapeFromPts(pts.map(([a, s]) => toYZ(b, a, s)));
  const [XB0, XB1] = E.blockX;

  /* ---------- поз. 2 block: two halves, barrels, main bulkheads ---------- */
  const half = [[0, 86], [62, 86], [92, 80], [E.deck, 80], [E.deck, -85], [112, -85], [112, -112], [0, -112]];   // (|Z|, Y)
  const barrels = [], bulk = [];
  for (const b of ['R', 'L']) {
    ghost(G.extrudeX(G.shapeFromPts(half.map(([z, y]) => [y, b === 'R' ? -z : z])), XB0, XB1, { curveSegments: 1 }), 'block', 'block', 20);
  }
  for (let c = 0; c < 4; c++) {
    const g = new THREE.CylinderGeometry(E.bore / 2 + 1, E.bore / 2 + 1, E.deck - 92, 48, 1, true); g.translate(0, (E.deck + 92) / 2, 0);
    G.applyQ(g, BUILD_B4.bankQuat(E, c)); g.translate(E.cyl[c].x, 0, 0); barrels.push(g);
  }
  ghost(G.merge(barrels), 'block', 'block', 40);
  E.mainX.forEach(x => {
    const s = G.shapeFromPts([[-112, -108], [-112, 108], [80, 108], [80, -108]]);
    s.holes.push(G.circlePath(0, 0, E.mainD / 2 + 2.4, true));
    bulk.push(G.extrudeX(s, x - 9.4, x + 9.4, { curveSegments: 24 }));
  });
  ghost(G.merge(bulk), 'block', 'block', 30);

  /* ---------- поз. 34, 35 case through-bolts: one above and one below the crank at every main ---------- */
  const cb = [];
  E.mainX.forEach(x => {
    for (const y of [52, -52]) {
      const sh = new THREE.CylinderGeometry(5, 5, 238, 14); sh.rotateX(Math.PI / 2); sh.translate(x, y, 0); cb.push(sh);
      const head = G.hexPrism(16, 9); head.rotateX(Math.PI / 2); head.translate(x, y, -128); cb.push(head);
      const nut = G.hexPrism(16, 10); nut.rotateX(Math.PI / 2); nut.translate(x, y, 118); cb.push(nut);
    }
  });
  solid(G.merge(cb), M.caseBolt, 'caseBolt');

  /* ---------- heads (поз. 13 right, 12 left), covers, gaskets, head bolts ---------- */
  const headProf = [[E.fireFace, -80], [E.fireFace, 80], [246, 86], [252, 92], [318, 92], [324, 86], [334, 80], [334, -74], [326, -84],
    [296, -84], [290, -96], [242, -96], [236, -84], [226, -80]];
  const coverProf = [[334, -80]];
  for (let k = 0; k <= 8; k++) { const t = Math.PI / 2 * k / 8; coverProf.push([364 + 22 * Math.sin(t), -58 - 22 * Math.cos(t)]); }
  for (let k = 0; k <= 8; k++) { const t = Math.PI / 2 * k / 8; coverProf.push([364 + 22 * Math.cos(t), 62 + 22 * Math.sin(t)]); }
  coverProf.push([334, 84]);
  const gasketMat = M.gasket, boltG = [];
  for (const b of ['R', 'L']) {
    const [x0, x1] = E.headX[b], part = b === 'R' ? 'headR' : 'headL', cyls = b === 'R' ? [0, 2] : [1, 3];
    ghost(G.extrudeX(bankShape(b, headProf), x0, x1, { curveSegments: 1 }), part, part, 20);
    // spark-plug wells and the cam bores show through the head as inner edges
    const inner = [];
    cyls.forEach(c => {
      const w = new THREE.CylinderGeometry(10, 10, 140, 20, 1, true); w.translate(0, 70 + 18, 0);
      G.applyQ(w, BUILD_B4.bankQuat(E, c, E.plugAngle)); const p = BUILD_B4.local(E, c, 0, E.plugTip[0], E.plugTip[1]); w.translate(p.x, p.y, p.z);
      inner.push(w);
    });
    ghost(G.merge(inner), part, part, 60);
    ghost(G.extrudeX(bankShape(b, coverProf), x0 + 3, x1 - 3, { curveSegments: 1 }), 'cover', 'cover', 22);
    // поз. 3 gasket: plate on the deck, fire rings round the bores, bolt holes
    const gk = new THREE.Shape(); gk.moveTo(x0 + 2, -80); gk.lineTo(x1 - 2, -80); gk.lineTo(x1 - 2, 80); gk.lineTo(x0 + 2, 80); gk.closePath();
    cyls.forEach(c => gk.holes.push(G.circlePath(E.cyl[c].x, 0, E.bore / 2 + 0.6, true)));
    const bx = [-1, 0, 1].map(k => (E.cyl[cyls[0]].x + E.cyl[cyls[1]].x) / 2 + k * 111);
    bx.forEach(x => [-60, 60].forEach(s => gk.holes.push(G.circlePath(x, s, 6.5, true))));
    const geo = new THREE.ExtrudeGeometry(gk, { depth: E.gasket, bevelEnabled: false, curveSegments: 32 });
    const sz = b === 'R' ? -1 : 1;                       // shape (x, y = s, z) → world (X, Y, ±(deck + z))
    geo.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, sz, sz * E.deck, 0, 0, 0, 1));
    solid(geo, gasketMat, 'headGasket').castShadow = false;
    // поз. 38 head bolts: shank along the bore axis from the block into the head, washer and head on top
    bx.forEach(x => [-60, 60].forEach(s => {
      const parts = [new THREE.CylinderGeometry(5.5, 5.5, 186, 12), (() => { const w = G.lathe([[5.6, 0], [11, 0], [11, 2.5], [5.6, 2.5], [5.6, 0]], 24, 0, undefined, true); w.translate(0, 93, 0); return w; })(),
        (() => { const h = G.hexPrism(14, 8); h.translate(0, 95.5, 0); return h; })()];
      const g = G.merge(parts); g.translate(0, 237, 0);           // shank a 144…330, head 332…340
      g.rotateX(b === 'R' ? -Math.PI / 2 : Math.PI / 2);         // +Y (out along the bore) → ∓Z
      boltG.push({ g, b, x, s });
    }));
  }
  boltG.forEach(({ g, b, x, s }) => { g.translate(x, s, 0); });
  solid(G.merge(boltG.map(o => o.g)), M.headBolt, 'headBolt');

  /* ---------- поз. 20 oil pan: longitudinal profile, extruded across; drain plug М20×1,5 ---------- */
  const panProf = [[XB0, -112], [XB0, -252], [XB0 + 9, -262], [-24, -262], [6, -250], [64, -176], [104, -134], [XB1, -122], [XB1, -112]];
  const pan = new THREE.ExtrudeGeometry(G.shapeFromPts(panProf), { depth: 212, bevelEnabled: false });
  pan.translate(0, 0, -106);
  ghost(pan, 'pan', 'pan', 20);
  const plug = G.merge([G.hexPrism(24, 10), G.lathe([[0, 0], [10, 0], [10, 3], [0, 3]], 24).translate(0, 10, 0)]);
  plug.rotateX(Math.PI); plug.translate(-90, -262, -60);
  solid(plug, MM.hw.steel, 'pan');
  return out;
};
})();
