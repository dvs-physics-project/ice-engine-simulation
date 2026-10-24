(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let k = p.length - 1; k >= 0; k--) { const q = p[k]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
const circ = (cy, cz, r, n) => Array.from({ length: n }, (_, k) => [cy + r * Math.cos(k / n * Math.PI * 2), cz + r * Math.sin(k / n * Math.PI * 2)]);

BUILD_V8.housings = function (ctx) {
  const E = ctx.E, MM = ctx.M;
  const out = { meshes: [], edges: [] };
  const ghost = (geo, key, part, edgeAngle) => {
    const m = new THREE.Mesh(geo, MM.ghost[key]); m.renderOrder = 2; ctx.tag(m, part, 'housing');
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeAngle || 24), MM.ghostEdges[key]);
    e.renderOrder = 3; e.userData.pickable = false; ctx.tag(e, part, 'housing');
    out.meshes.push(m); out.edges.push(e);
    return m;
  };
  const yz = pts => G.shapeFromPts(pts);
  const XB0 = -362, XB1 = 360;

  const deckIn = E.bankPoint(0, 0, E.deck, 140), deckOut = E.bankPoint(0, 0, E.deck, -95);
  const prof = [[-119, 0], [-119, -157], [22.6, -157], [deckOut[1], deckOut[2]], [deckIn[1], deckIn[2]], [260, -62]];
  const blockPts = prof.concat(prof.slice(1).reverse().map(([y, z]) => [y, -z]));
  ghost(G.extrudeX(yz(blockPts), XB0, XB1), 'block', 'block', 20);
  const bores = [];
  for (let c = 0; c < 8; c++) {
    const g = new THREE.CylinderGeometry(76.5, 76.5, E.deck - 160, 48, 1, true); g.translate(0, (E.deck + 160) / 2, 0);
    G.applyQ(g, BUILD_V8.bankQuat(E, c)); g.translate(E.cyl[c].x, 0, 0); bores.push(g);
  }
  ghost(G.merge(bores), 'block', 'block', 40);
  const caps = [];
  E.mainX.forEach(x => {
    const s = new THREE.Shape();
    s.moveTo(0, -150); s.lineTo(0, -51); s.absarc(0, 0, 51, -Math.PI / 2, -Math.PI * 1.5, true);
    s.lineTo(0, 150); s.lineTo(-62, 150); s.lineTo(-62, -150); s.closePath();
    const g = G.extrudeX(s, x - 18, x + 18, { curveSegments: 16 });
    caps.push(g);
    for (const z of [-58, 58]) { const b = G.hexPrism(22, 12); b.rotateX(Math.PI); b.translate(x, -62, z); caps.push(b); }
    for (const z of [-157, 157]) { const b = G.hexPrism(19, 10); b.rotateX(z > 0 ? Math.PI / 2 : -Math.PI / 2); b.translate(x, -36, z); caps.push(b); }
  });
  ghost(G.merge(caps), 'block', 'block', 30);

  const headProf = [[E.fireFace, -95], [E.fireFace, 140], [E.headTop - 14, 140], [E.headTop, 126], [E.headTop, -80], [E.headTop - 15, -95]];
  const headGeo = G.extrudeX(G.shapeFromPts(headProf), -82, 82, { curveSegments: 1 });
  const coverProf = [[E.headTop + 1.5, -55]];
  for (let k = 0; k <= 8; k++) { const t = Math.PI / 2 * k / 8; coverProf.push([596 + 22 * Math.sin(t), -33 - 22 * Math.cos(t)]); }
  for (let k = 0; k <= 8; k++) { const t = Math.PI / 2 * k / 8; coverProf.push([596 + 22 * Math.cos(t), 118 + 22 * Math.sin(t)]); }
  coverProf.push([E.headTop + 1.5, 140]);
  const coverGeo = G.extrudeX(G.shapeFromPts(coverProf), -76, 76, { curveSegments: 1 });
  const capGeo = (() => { const g = G.lathe([[0, 0], [26, 0], [28, 4], [28, 14], [0, 14]], 32); g.translate(30, 617, 40); return g; })();
  const gk = G.roundRect(164, 235, 10);
  gk.holes.push(G.circlePath(0, -22.5, 64.5, true));
  for (const x of [-30, 30]) gk.holes.push(G.circlePath(x, E.camS - 22.5, 9.5, true));
  const gasketGeo = new THREE.ExtrudeGeometry(gk, { depth: E.gasket, bevelEnabled: false, curveSegments: 24 });
  gasketGeo.rotateX(Math.PI / 2); gasketGeo.translate(0, E.deck + E.gasket, 22.5);
  const chan = [];
  for (const x of [-30, 30]) { const g = new THREE.CylinderGeometry(10, 10, E.headTop - E.fireFace, 20, 1, true); g.translate(x, (E.headTop + E.fireFace) / 2, E.camS); chan.push(g); }
  const boss = new THREE.CylinderGeometry(15, 15, 112, 24, 1, true); boss.translate(0, 56, 0);
  G.applyQ(boss, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 15 * Math.PI / 180)); boss.translate(0, E.fireFace - 2, -2);
  chan.push(boss);
  const heads = [], covers = [], inner = [], gaskets = [];
  for (let c = 0; c < 8; c++) {
    const q = BUILD_V8.bankQuat(E, c), x = E.cyl[c].x;
    const place = g => { const h = g.clone(); G.applyQ(h, q); h.translate(x, 0, 0); return h; };
    heads.push(place(headGeo)); covers.push(place(coverGeo), place(capGeo)); inner.push(place(G.merge(chan)));
    gaskets.push(place(gasketGeo));
  }
  ghost(G.merge(heads), 'head', 'head', 20);
  ghost(G.merge(inner), 'head', 'head', 50);
  ghost(G.merge(covers), 'cover', 'cover', 22);
  const gm = new THREE.Mesh(G.merge(gaskets), MM.mat.gasket); ctx.tag(gm, 'gasket', 'housing'); gm.receiveShadow = true;
  out.gaskets = gm;

  const panProf = [[XB0, -119], [XB0, -360], [XB0 + 17, -377], [-100, -377], [-80, -360], [-40, -250], [300, -232], [338, -205], [XB1, -160], [XB1, -119]];
  const panGeo = new THREE.ExtrudeGeometry(G.shapeFromPts(panProf), { depth: 300, bevelEnabled: false });
  panGeo.translate(0, 0, -150);
  ghost(panGeo, 'pan', 'pan', 20);
  const drain = G.hexPrism(24, 12); drain.rotateX(Math.PI); drain.translate(-200, -377, 60);
  const dm = new THREE.Mesh(drain, MM.hw.steel); ctx.tag(dm, 'pan', 'housing'); out.meshes.push(dm);

  const platePts = hull(circ(0, 0, 282, 64).concat([[478, -118], [478, 118], [430, -150], [430, 150]]));
  const plate = G.extrudeX(yz(platePts), XB1, XB1 + 35, { curveSegments: 1 });
  const bell = G.lathe([[282, 0], [282, 100], [300, 100], [300, 108], [270, 108]], 96);
  G.toX(bell); bell.translate(XB1 + 35, 0, 0);
  const starterBoss = new THREE.CylinderGeometry(60, 60, 30, 32, 1, true); starterBoss.rotateZ(Math.PI / 2); starterBoss.translate(XB1 + 4, -120, -237);
  ghost(G.merge([plate, bell, starterBoss]), 'flyhousing', 'flyhousing', 24);

  const fc = yz(hull(circ(0, 0, 108, 48).concat(circ(E.front.oilPumpY, 0, 106, 48))));
  fc.holes.push(G.circlePath(0, 0, 41, true));
  ghost(G.extrudeX(fc, -396, XB0, { curveSegments: 1 }), 'frontcover', 'frontcover', 24);
  return out;
};
})();
