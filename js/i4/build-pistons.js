/* build-pistons.js — 4 pistons (+ поз. 24 rings, поз. 12 pins) and 4 connecting rods
   (поз. 3, with поз. 18 big-end shells). Each piston/rod is placed every frame from the exact
   crank–slider solution in spec.js, so rod, pin and journal always meet. */
(function () {
'use strict';
window.BUILD_I4 = window.BUILD_I4 || {};

function pistonGeometries(E) {
  const R = E.pistonR, g = {};
  // crown + ring belt, full round; grooves cut to r=32.9
  g.body = G.lathe([
    [0, -7], [29.5, -7], [29.5, -19.5], [R, -19.5],
    [R, -17.2], [32.9, -17.2], [32.9, -14.0], [R, -14.0],
    [R, -11.3], [32.9, -11.3], [32.9, -9.7], [R, -9.7],
    [R, -6.6], [32.9, -6.6], [32.9, -5.0], [R, -5.0],
    [R, -0.9], [R - 0.9, 0], [0, 0]], 64, 0, undefined, true);
  // slipper skirt: only on the thrust faces (±Z), open over the pin bosses
  const skirt = [[33.3, -19.5], [R - 0.05, -19.5], [R - 0.05, -40], [R - 0.3, -52], [33.3, -52], [33.3, -19.5]];
  const span = 100 * Math.PI / 180;
  g.skirt = G.merge([
    G.lathe(skirt, 28, -span / 2, span, true),
    G.lathe(skirt, 28, Math.PI - span / 2, span, true)]);
  // pin bosses + struts up to the crown underside
  const parts = [];
  for (const s of [-1, 1]) {
    const boss = G.cylX(12.6, s < 0 ? -29.2 : 10.8, s < 0 ? -10.8 : 29.2, 28); boss.translate(0, -E.compH, 0); parts.push(boss);
    const strut = new THREE.BoxGeometry(18.4, 24, 11); strut.translate(s * 20, -21, 0); parts.push(strut);
  }
  g.bosses = G.merge(parts);
  // compression rings (with the end gap) and the 3-piece oil ring
  const ringAt = (y0, y1, ri, gap) => G.lathe([[ri, y0], [36, y0], [36, y1], [ri, y1], [ri, y0]], 64, gap, Math.PI * 2 - 2 * gap, true);
  g.rings = G.merge([
    ringAt(-6.5, -5.1, 33.0, 0.012), ringAt(-11.2, -9.8, 33.0, 0.012),
    ringAt(-17.1, -16.3, 33.0, 0.01), ringAt(-14.9, -14.1, 33.0, 0.01),
  ]);
  g.oilExpander = G.lathe([[33.05, -16.3], [35.2, -16.3], [35.2, -14.9], [33.05, -14.9], [33.05, -16.3]], 64, 0, undefined, true);
  // floating pin (hollow) + circlips
  const pin = G.lathe([[4.6, 0], [E.pinD / 2, 0], [E.pinD / 2, 59], [4.6, 59], [4.6, 0]], 32, 0, undefined, true);
  G.toX(pin); pin.translate(-29.5, -E.compH, 0);
  const clipL = new THREE.TorusGeometry(8.0, 0.75, 6, 28); clipL.rotateY(Math.PI / 2); clipL.translate(-29.6, -E.compH, 0);
  const clipR = clipL.clone(); clipR.translate(59.2, 0, 0);
  g.pin = G.merge([pin, clipL, clipR]);
  // valve reliefs: shallow eyebrows where the valve heads pass at overlap TDC
  const strips = [];
  for (const s of [-1, 1]) for (const dx of [-E.valveDX, E.valveDX]) {
    const rr = (s < 0 ? E.valveHeadR.in : E.valveHeadR.ex) + 1.5, cz = s * (E.seatZ + 3.5);
    const inner = rr - 1.6, pts = [];
    for (let k = 0; k <= 64; k++) {
      const a = k / 64 * Math.PI * 2, px = dx + rr * Math.cos(a), pz = cz + rr * Math.sin(a);
      pts.push({ ok: Math.hypot(px, pz) < R - 1.6, a });
    }
    for (let k = 0; k < 64; k++) {
      if (!pts[k].ok || !pts[k + 1].ok) continue;
      const a0 = pts[k].a, a1 = pts[k + 1].a;
      const v = (r, a) => [dx + r * Math.cos(a), 0.06, cz + r * Math.sin(a)];
      const q = [v(inner, a0), v(rr, a0), v(rr, a1), v(inner, a1)];
      strips.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
  }
  const rel = new THREE.BufferGeometry();
  rel.setAttribute('position', new THREE.Float32BufferAttribute(strips, 3));
  rel.computeVertexNormals();
  g.reliefs = rel;
  return g;
}

/* con rod in its own frame: origin = big-end centre, +Y toward the small end, X = crank axis */
function rodGeometries(E) {
  const L = E.rodLen, rb = E.rodBigBore / 2, g = {};
  const w = x => {                               // shank half-width along the rod
    const k = [[24, 26], [32, 15.5], [44, 12.2], [62, 10.4], [90, 8.9], [111, 8.0]];
    for (let j = 0; j < k.length - 1; j++) if (x <= k[j + 1][0]) {
      const t = (x - k[j][0]) / (k[j + 1][0] - k[j][0]); return k[j][1] + (k[j + 1][1] - k[j][1]) * t;
    }
    return 8.0;
  };
  const eyeR = 13.5, eyeA = Math.PI - Math.asin(8.0 / eyeR);
  // outline (shape x = along rod, y = lateral), big-end bore notched out of the parting face
  const outline = (inset) => {
    const pts = [[0, 36], [9, 36], [17, 33.5]];
    for (let x = 24; x <= 111; x += 3) pts.push([x, w(x) - inset]);
    for (let k = 0; k <= 24; k++) { const a = eyeA - (2 * eyeA) * k / 24; pts.push([L + eyeR * Math.cos(a), eyeR * Math.sin(a)]); }
    for (let x = 111; x >= 24; x -= 3) pts.push([x, -w(x) + inset]);
    pts.push([17, -33.5], [9, -36], [0, -36], [0, -rb]);
    for (let k = 1; k < 24; k++) { const a = -Math.PI / 2 + Math.PI * k / 24; pts.push([rb * Math.cos(a), rb * Math.sin(a)]); }
    pts.push([0, rb]);
    return pts;
  };
  const webShape = G.shapeFromPts(outline(0));
  webShape.holes.push(G.circlePath(L, 0, 10.45, true));
  const web = G.extrudeX(webShape, -3.6, 3.6, { curveSegments: 20 });
  // big end, full width (21): rod-side half with bolt bosses
  const be = [[0, 36], [9, 36], [17, 33.5], [24, 26], [30, 16], [32, 0], [30, -16], [24, -26], [17, -33.5], [9, -36], [0, -36], [0, -rb]];
  for (let k = 1; k < 24; k++) { const a = -Math.PI / 2 + Math.PI * k / 24; be.push([rb * Math.cos(a), rb * Math.sin(a)]); }
  be.push([0, rb]);
  const bigEnd = G.extrudeX(G.shapeFromPts(be), -10.5, 10.5, { bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.6, bevelSegments: 1, curveSegments: 12 });
  // small end eye, full width (19)
  const eye = new THREE.Shape(); eye.absarc(L, 0, eyeR, 0, Math.PI * 2, false);
  eye.holes.push(G.circlePath(L, 0, 10.45, true));
  const eyeGeo = G.extrudeX(eye, -9.5, 9.5, { bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.5, bevelSegments: 1, curveSegments: 32 });
  // I-beam flanges along both shank edges
  const flanges = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let x = 27; x <= 112; x += 3) pts.push([x, s * w(x)]);
    for (let x = 112; x >= 27; x -= 3) pts.push([x, s * (w(x) - 3.4)]);
    flanges.push(G.extrudeX(G.shapeFromPts(pts), -8.5, 8.5));
  }
  g.rod = G.merge([web, bigEnd, eyeGeo, ...flanges]);
  // cap (below the parting line)
  const cap = [[0, 36], [-15, 36], [-15, 24.5]];
  for (let k = 0; k <= 20; k++) { const a = Math.PI * 0.739 + (Math.PI * 0.522) * k / 20; cap.push([31 * Math.cos(a), 31 * Math.sin(a)]); }
  cap.push([-15, -24.5], [-15, -36], [0, -36], [0, -rb]);
  for (let k = 1; k < 24; k++) { const a = -Math.PI / 2 - Math.PI * k / 24; cap.push([rb * Math.cos(a), rb * Math.sin(a)]); }
  cap.push([0, rb]);
  g.cap = G.extrudeX(G.shapeFromPts(cap), -10.5, 10.5, { bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.6, bevelSegments: 1, curveSegments: 12 });
  // bolts (along the rod axis) with heads on the rod bosses and nuts under the cap
  const bolts = [];
  for (const z of [-29, 29]) {
    const shank = new THREE.CylinderGeometry(4, 4, 46, 14); shank.translate(0, -1, z); bolts.push(shank);
    const head = G.hexPrism(12, 6); head.translate(0, 20.5, z); bolts.push(head);   // on the rod boss
    const nut = G.hexPrism(13, 7); nut.translate(0, -22, z); bolts.push(nut);       // under the cap
  }
  g.bolts = G.merge(bolts);
  // small-end bush
  const bush = G.lathe([[9.05, 0], [10.45, 0], [10.45, 19], [9.05, 19], [9.05, 0]], 32, 0, undefined, true);
  G.toX(bush); bush.translate(-9.5, L, 0);
  g.bush = bush;
  // поз. 18: big-end shells, split on the parting line
  g.shells = G.merge([BUILD_I4.halfShell(21.05, 22.45, -9.8, 9.8, true), BUILD_I4.halfShell(21.05, 22.45, -9.8, 9.8, false)]);
  return g;
}

BUILD_I4.pistons = function (ctx) {
  const E = ctx.E, M = ctx.M.mat;
  const pg = pistonGeometries(E), rg = rodGeometries(E);
  const reliefMat = new THREE.MeshStandardMaterial({ color: ctx.M.srgb('#5b5852'), metalness: 0.5, roughness: 0.7, side: THREE.DoubleSide });
  const pistons = [], rods = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group();
    const add = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'pistons'); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
    add(pg.body, M.piston, 'piston');
    add(pg.skirt, M.piston, 'piston');
    add(pg.bosses, M.piston, 'piston');
    add(pg.reliefs, reliefMat, 'piston');
    add(pg.rings, M.ring, 'rings');
    add(pg.oilExpander, M.ring, 'rings');
    add(pg.pin, M.pin, 'pin');
    p.position.x = E.cylX[i];
    pistons.push(p);

    const r = new THREE.Group();
    const addR = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'pistons'); m.castShadow = m.receiveShadow = true; r.add(m); return m; };
    addR(rg.rod, M.rod, 'rod');
    addR(rg.cap, M.rod, 'rod');
    addR(rg.bolts, M.rodBolt, 'rod');
    addR(rg.bush, M.rodBush, 'rod');
    addR(rg.shells, M.bearingRod, 'bearingRod');
    r.position.x = E.cylX[i];
    rods.push(r);
  }
  return {
    pistons, rods,
    update(theta) {
      for (let i = 0; i < 4; i++) {
        const k = E.kin(i, theta);
        pistons[i].position.y = k.crownY;
        rods[i].position.set(E.cylX[i], k.py, k.pz);
        rods[i].rotation.x = k.rodAngle;
      }
    },
  };
};
})();
