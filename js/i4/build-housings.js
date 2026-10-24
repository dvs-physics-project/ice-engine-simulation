/* build-housings.js — the castings as ghosts with blueprint edge lines: поз. 1 block (+ bores,
   main bearing caps), поз. 4 head (+ spark-plug wells), поз. 13 two cam covers, поз. 8 oil
   pan; and поз. 14–16 gaskets as thin solid layers. Profiles are traced off the drawing's
   transverse (front) section and extruded along the engine; the pan off the longitudinal one. */
(function () {
'use strict';
window.BUILD_I4 = window.BUILD_I4 || {};
const V3 = THREE.Vector3;

BUILD_I4.housings = function (ctx) {
  const E = ctx.E, MM = ctx.M;
  const out = { meshes: [], edges: [] };
  const ghost = (geo, key, part, edgeAngle) => {
    const m = new THREE.Mesh(geo, MM.ghost[key]);
    m.renderOrder = 2;
    ctx.tag(m, part, 'housing');
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeAngle || 24), MM.ghostEdges[key]);
    e.renderOrder = 3;
    ctx.tag(e, part, 'housing');
    e.userData.pickable = false;
    out.meshes.push(m); out.edges.push(e);
    return m;
  };
  // profile given as [Z, Y] pairs (like the front view) → shape in (u,v) = (Y, Z)
  const zyShape = pts => G.shapeFromPts(pts.map(([z, y]) => [y, z]));

  /* ---------- поз. 1 block ---------- */
  const blockProfile = [[72, 190], [72, 140], [70, 100], [72, 60], [78, 20], [82, -20], [84, -59],
    [-84, -59], [-82, -20], [-78, 20], [-72, 60], [-70, 100], [-72, 140], [-72, 190]];
  ghost(G.extrudeX(zyShape(blockProfile), E.blockFront, E.blockRear), 'block', 'block', 20);
  // bores
  for (let i = 0; i < 4; i++) {
    const bore = new THREE.CylinderGeometry(E.bore / 2 + 0.2, E.bore / 2 + 0.2, 120, 64, 1, true);
    bore.translate(E.cylX[i], E.deckY - 60, 0);
    const m = new THREE.Mesh(bore, MM.ghost.block); m.renderOrder = 2; ctx.tag(m, 'block', 'housing'); out.meshes.push(m);
    for (const y of [E.deckY, E.deckY - 120]) {
      const pts = [];
      for (let k = 0; k <= 72; k++) { const a = k / 72 * Math.PI * 2; pts.push(new V3(E.cylX[i] + 36.2 * Math.cos(a), y, 36.2 * Math.sin(a))); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), MM.ghostEdges.block);
      l.renderOrder = 3; ctx.tag(l, 'block', 'housing'); l.userData.pickable = false; out.edges.push(l);
    }
  }
  // main bearing caps with their bolts
  const capGeos = [];
  E.mainX.forEach((x, k) => {
    const w = (k === 0 || k === 4) ? 22 : 20;
    const s = new THREE.Shape();
    s.moveTo(0, -46); s.lineTo(0, -25.8);
    s.absarc(0, 0, 25.8, -Math.PI / 2, -Math.PI * 1.5, true);      // notch round the shell (lower half)
    s.lineTo(0, 46); s.lineTo(-40, 46); s.quadraticCurveTo(-52, 46, -52, 34);
    s.lineTo(-52, -34); s.quadraticCurveTo(-52, -46, -40, -46); s.closePath();
    capGeos.push(G.extrudeX(s, x - w / 2, x + w / 2, { curveSegments: 16 }));
    for (const z of [-36, 36]) { const b = G.hexPrism(14, 8); b.rotateX(Math.PI); b.translate(x, -52, z); capGeos.push(b); }
  });
  ghost(G.merge(capGeos), 'caps', 'block', 30);

  /* ---------- поз. 4 head (+ spark-plug wells) ---------- */
  const H = E.headY;
  const headProfile = [[84, H], [84, 246], [90, 254], [101, 286], [108, 300], [110, 318], [110, 340],
    [-110, 340], [-110, 316], [-106, 300], [-98, 284], [-90, 266], [-86, 252], [-86, H]];
  ghost(G.extrudeX(zyShape(headProfile), -195, 190), 'head', 'head', 20);
  const wells = [];
  for (let i = 0; i < 4; i++) {
    const w = new THREE.CylinderGeometry(13, 13, 136, 40, 1, true);
    w.translate(E.cylX[i], 228 + 68, 0);
    wells.push(w);
  }
  ghost(G.merge(wells), 'head', 'head', 40);

  /* ---------- поз. 13 two cam covers (exhaust +Z, intake −Z) with the oil filler ---------- */
  for (const s of [1, -1]) {
    const prof = [[112, 340], [112, 352], [104, 368], [88, 380], [50, 382], [34, 376], [28, 362], [28, 340]]
      .map(([z, y]) => [s * z, y]);
    ghost(G.extrudeX(zyShape(s > 0 ? prof : prof.reverse()), -195, 188), 'cover', 'cover', 22);
  }
  const filler = G.merge([
    (() => { const g = new THREE.CylinderGeometry(25, 25, 12, 40, 1, true); g.translate(90, 387, 68); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(30, 30, 7, 40); g.translate(90, 396.5, 68); return g; })(),
  ]);
  ghost(filler, 'cover', 'cover', 30);

  /* ---------- поз. 8 oil pan: longitudinal profile, extruded across the engine ---------- */
  const panProfile = [[-211.6, -59], [-206.6, -82], [-183.3, -141], [-164.2, -165], [-152, -168],
    [-72.4, -168], [-18, -141], [19.5, -127], [76, -98.5], [146.7, -87], [170, -75], [182, -59]];
  const panShape = G.shapeFromPts(panProfile);
  const panGeo = new THREE.ExtrudeGeometry(panShape, { depth: 160, bevelEnabled: false });
  panGeo.translate(0, 0, -80);
  ghost(panGeo, 'pan', 'pan', 20);
  const drain = G.hexPrism(17, 9); drain.rotateX(Math.PI); drain.translate(-110, -168, -40);
  const drainMesh = new THREE.Mesh(drain, MM.hw.steel); ctx.tag(drainMesh, 'pan', 'housing'); out.meshes.push(drainMesh);

  /* ---------- поз. 14–16 gaskets ---------- */
  const gk = [];
  const hg = G.roundRect(372, 168, 14);
  for (let i = 0; i < 4; i++) hg.holes.push(G.circlePath(E.cylX[i], 0, 37, true));
  for (let i = 0; i < 5; i++) for (const z of [-58, 58]) hg.holes.push(G.circlePath(E.mainX[i], z, 5.5, true));
  const headGasket = new THREE.ExtrudeGeometry(hg, { depth: E.gasket, bevelEnabled: false, curveSegments: 20 });
  headGasket.rotateX(Math.PI / 2); headGasket.translate(0, E.headY, 0);       // shape (X,Z) → plate at the deck
  gk.push(headGasket);
  for (const s of [1, -1]) {                                                  // cam-cover gaskets (×2)
    const f = G.roundRect(383, 84, 8); f.holes.push(G.roundRect(371, 72, 4));
    const g = new THREE.ExtrudeGeometry(f, { depth: 1.4, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(Math.PI / 2); g.translate(-3.5, 341.4, s * 70);
    gk.push(g);
  }
  const pg = G.roundRect(394, 168, 10); pg.holes.push(G.roundRect(372, 146, 6));   // pan gasket
  const panGasket = new THREE.ExtrudeGeometry(pg, { depth: 1.4, bevelEnabled: false, curveSegments: 6 });
  panGasket.rotateX(Math.PI / 2); panGasket.translate(-14.8, -57.6, 0);
  gk.push(panGasket);
  const gaskets = new THREE.Mesh(G.merge(gk), MM.mat.gasket);
  ctx.tag(gaskets, 'gasket', 'housing');
  gaskets.receiveShadow = true;
  out.gaskets = gaskets;
  return out;
};
})();
