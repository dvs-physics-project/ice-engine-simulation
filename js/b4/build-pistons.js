/* b4/build-pistons.js — поз. 4 pistons Ø83 (flat crown with the four valve reliefs cut 2.6 mm
   deep, the assembly arrow pointing at the timing drive), rings, floating pins Ø23; four rods
   (143.5 mm centres, I-beam, bolted caps with nuts) each on its own crank pin, big-end shells.
   Pistons are built in the bank-local frame (x along the crank, y = a out along the bore, z = s
   up) and placed by the bank quaternion; the left bank's copies are the same parts turned 180°
   about the vertical. */
(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};

// outline of the union of two overlapping discs (star-shaped from any point of their lens)
function unionOutline(c1, r1, c2, r2, n) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), P = [c1[0] + dx / d * a, c1[1] + dy / d * a];
  const pts = [];
  const add = (c, r, o, ro) => { for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2, p = [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
    if (Math.hypot(p[0] - o[0], p[1] - o[1]) >= ro) pts.push(p); } };
  add(c1, r1, c2, r2); add(c2, r2, c1, r1);
  pts.sort((p, q) => Math.atan2(p[1] - P[1], p[0] - P[0]) - Math.atan2(q[1] - P[1], q[0] - P[0]));
  return pts;
}

function pistonGeometries(E) {
  const R = E.pistonR, H = E.pistonH, top = -E.pocketDepth, g = {};
  // body under the crown plate: ring grooves, full skirt, hollow underside
  g.body = G.lathe([[0, top], [R - 0.4, top], [R, top - 0.5], [R, -5.1], [R - 3.2, -5.1], [R - 3.2, -6.4], [R, -6.4],
    [R, -9.6], [R - 3.2, -9.6], [R - 3.2, -10.9], [R, -10.9], [R, -14.1], [R - 3.6, -14.1], [R - 3.6, -16.9], [R, -16.9],
    [R, -H + 0.8], [R - 0.8, -H], [R - 3.4, -H], [R - 3.4, -20], [27, -12], [0, -11]], 64, 0, undefined, true);
  // crown plate with the valve reliefs: intake and exhaust reliefs of one side run together
  const pocket = { in: { s: 14.8, r: 17.0 }, ex: { s: -14.2, r: 14.8 } };
  const crown = new THREE.Shape(); crown.absarc(0, 0, R - 0.4, 0, Math.PI * 2, false);
  for (const xs of [-1, 1]) {
    const pts = unionOutline([xs * E.vt.in.dx, pocket.in.s], pocket.in.r, [xs * E.vt.ex.dx, pocket.ex.s], pocket.ex.r, 160);
    const h = new THREE.Path(); pts.forEach((p, k) => k ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1])); h.closePath();
    crown.holes.push(h);
  }
  g.crown = new THREE.ExtrudeGeometry(crown, { depth: E.pocketDepth, bevelEnabled: false, curveSegments: 64 });
  g.crown.rotateX(Math.PI / 2);                      // shape (x, s) → local (x, ·, s); plate spans y = −2.6 … 0
  // pin bosses (bored through) and the struts under the crown
  const parts = [];
  for (const s of [-1, 1]) {
    const b = G.tubeX(E.pinOD / 2 + 0.05, 15, s < 0 ? -(R - 3.6) : 11, s < 0 ? -11 : R - 3.6, 32); b.translate(0, -E.compH, 0); parts.push(b);
    const st = new THREE.BoxGeometry(24, 9, 16); st.translate(s * 24, -15.5, 0); parts.push(st);
  }
  g.bosses = G.merge(parts);
  const ringAt = (y0, y1, rin, gap) => G.lathe([[rin, y0], [R + 0.05, y0], [R + 0.05, y1], [rin, y1], [rin, y0]], 64, gap, Math.PI * 2 - 2 * gap, true);
  g.rings = G.merge([ringAt(-6.35, -5.15, R - 3.1, 0.012), ringAt(-10.85, -9.65, R - 3.1, 0.012), ringAt(-16.85, -14.15, R - 3.5, 0.008)]);
  const pin = G.lathe([[E.pinID / 2, 0], [E.pinOD / 2, 0], [E.pinOD / 2, 70], [E.pinID / 2, 70], [E.pinID / 2, 0]], 36, 0, undefined, true);
  G.toX(pin); pin.translate(-35, -E.compH, 0);
  const clip = new THREE.TorusGeometry(11.2, 0.8, 6, 28); clip.rotateY(Math.PI / 2);
  g.pin = G.merge([pin, clip.clone().translate(-35.8, -E.compH, 0), clip.translate(35.8, -E.compH, 0)]);
  // assembly arrow, pointing at the timing drive (local −x on the right bank)
  const ar = G.shapeFromPts([[-8, 0], [-3, 3.4], [-3, 1.2], [8, 1.2], [8, -1.2], [-3, -1.2], [-3, -3.4]]);
  g.arrowR = new THREE.ShapeGeometry(ar); g.arrowR.rotateX(-Math.PI / 2); g.arrowR.translate(0, 0.06, 0);
  g.arrowL = g.arrowR.clone(); g.arrowL.rotateY(Math.PI);
  return g;
}

/* rod in its own frame: origin = big-end centre, +Y toward the small end, X = crank axis */
function rodGeometries(E) {
  const L = E.rodLen, rb = E.rodBig / 2, g = {};
  const key = [[34, 14], [48, 12], [80, 10.6], [L - 22, 9.4]];
  const w = y => {
    if (y <= key[0][0]) return key[0][1];
    for (let j = 0; j < key.length - 1; j++) if (y <= key[j + 1][0]) { const t = (y - key[j][0]) / (key[j + 1][0] - key[j][0]); return key[j][1] + (key[j + 1][1] - key[j][1]) * t; }
    return key[key.length - 1][1];
  };
  const eyeR = 17, eyeA = Math.PI - Math.asin(9.4 / eyeR), bore = [];
  for (let k = 1; k < 28; k++) { const a = -Math.PI / 2 + Math.PI * k / 28; bore.push([rb * Math.cos(a), rb * Math.sin(a)]); }
  const shoulders = [[0, 43], [15, 43], [17, 41], [26, 30]];
  const outline = [...shoulders];
  for (let y = 34; y <= L - 22; y += 4) outline.push([y, w(y)]);
  for (let k = 0; k <= 28; k++) { const a = eyeA - (2 * eyeA) * k / 28; outline.push([L + eyeR * Math.cos(a), eyeR * Math.sin(a)]); }
  for (let y = L - 22; y >= 34; y -= 4) outline.push([y, -w(y)]);
  outline.push(...shoulders.slice().reverse().map(([y, z]) => [y, -z]), [0, -rb], ...bore, [0, rb]);
  const web = G.shapeFromPts(outline);
  web.holes.push(G.circlePath(L, 0, 13.5, true));
  const parts = [G.extrudeX(web, -3.5, 3.5, { curveSegments: 20 })];
  const be = [...shoulders, [32, 18], [34, 0], [32, -18], ...shoulders.slice().reverse().map(([y, z]) => [y, -z]), [0, -rb], ...bore, [0, rb]];
  parts.push(G.extrudeX(G.shapeFromPts(be), -E.rodW / 2, E.rodW / 2, { bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.7, bevelSegments: 1, curveSegments: 12 }));
  const eye = new THREE.Shape(); eye.absarc(L, 0, eyeR, 0, Math.PI * 2, false); eye.holes.push(G.circlePath(L, 0, 13.5, true));
  parts.push(G.extrudeX(eye, -E.rodW / 2, E.rodW / 2, { bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.6, bevelSegments: 1, curveSegments: 36 }));
  for (const s of [-1, 1]) {                                   // I-beam flanges
    const pts = [];
    for (let y = 30; y <= L - 18; y += 4) pts.push([y, s * w(y)]);
    for (let y = L - 18; y >= 30; y -= 4) pts.push([y, s * (w(y) - 3.6)]);
    parts.push(G.extrudeX(G.shapeFromPts(pts), -8, 8));
  }
  g.rod = G.merge(parts);
  const cap = [[0, 43], [-18, 43]];
  for (let k = 0; k <= 22; k++) { const a = 125 * Math.PI / 180 + (110 * Math.PI / 180) * k / 22; cap.push([40 * Math.cos(a), 40 * Math.sin(a)]); }
  cap.push([-18, -43], [0, -43], [0, -rb]);
  for (let k = 1; k < 28; k++) { const a = -Math.PI / 2 - Math.PI * k / 28; cap.push([rb * Math.cos(a), rb * Math.sin(a)]); }
  cap.push([0, rb]);
  g.cap = G.extrudeX(G.shapeFromPts(cap), -E.rodW / 2, E.rodW / 2, { bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.7, bevelSegments: 1, curveSegments: 12 });
  const bolts = [];
  for (const z of [-35, 35]) {
    const shank = new THREE.CylinderGeometry(4.2, 4.2, 48, 14); shank.translate(0, -3, z); bolts.push(shank);
    const head = G.hexPrism(13, 6); head.translate(0, 15, z); bolts.push(head);
    const nut = G.hexPrism(13, 7); nut.translate(0, -25, z); bolts.push(nut);
  }
  g.bolts = G.merge(bolts);
  const bush = G.lathe([[11.55, 0], [13.5, 0], [13.5, 20], [11.55, 20], [11.55, 0]], 36, 0, undefined, true);
  G.toX(bush); bush.translate(-10, L, 0);
  g.bush = bush;
  g.shells = G.merge([BUILD_B4.halfShell(E.pinD / 2 + 0.05, rb, -9.4, 9.4, true), BUILD_B4.halfShell(E.pinD / 2 + 0.05, rb, -9.4, 9.4, false)]);
  return g;
}

BUILD_B4.pistons = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const pg = pistonGeometries(E), rg = rodGeometries(E);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x3b3a37, side: THREE.DoubleSide });
  const pistons = [], rods = [];
  const add = (grp, geo, mat, part, layer) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, layer || 'pistons'); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
  for (let c = 0; c < 4; c++) {
    const C = E.cyl[c];
    const p = new THREE.Group();
    add(p, pg.body, M.piston, 'piston'); add(p, pg.crown, M.piston, 'piston'); add(p, pg.bosses, M.piston, 'piston');
    add(p, C.sgn > 0 ? pg.arrowR : pg.arrowL, arrowMat, 'piston').castShadow = false;
    add(p, pg.rings, M.ring, 'rings'); add(p, pg.pin, M.pin, 'pin');
    p.quaternion.copy(BUILD_B4.bankQuat(E, c));
    pistons.push(p);
    const r = new THREE.Group();
    add(r, rg.rod, M.rod, 'rod'); add(r, rg.cap, M.rod, 'rod'); add(r, rg.bolts, M.rodBolt, 'rod');
    add(r, rg.bush, M.rodBush, 'rod'); add(r, rg.shells, M.bearingRod, 'bearingRod');
    rods.push(r);
  }
  return {
    pistons, rods,
    update(theta) {
      for (let c = 0; c < 4; c++) {
        const k = E.kin(c, theta), A = E.axisOf(c), C = E.cyl[c];
        pistons[c].position.set(C.x, k.crown * A.y, k.crown * A.z);
        rods[c].position.set(C.x, k.pinY, k.pinZ);
        rods[c].rotation.x = k.rodRot;
      }
    },
  };
};
})();
