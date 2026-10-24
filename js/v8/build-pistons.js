/* v8/build-pistons.js — 8 bowl-in-crown diesel pistons (поз. 5) with rings (поз. 37), floating
   pins (поз. 25) and valve pockets; 8 rods (поз. 4) paired side by side on the 4 pins, with
   big-end shells (поз. 35); 8 wet liners (поз. 24). Parts are built in the bank-local frame
   (x along the crank, y along the cylinder axis, z toward the vee); left-bank copies are the
   same geometry turned 180° about the cylinder axis — exactly how identical heads mount. */
(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};

BUILD_V8.bankQuat = function (E, c, extraX) {          // local frame → world for cylinder c
  const C = E.cyl[c];
  const m = new THREE.Matrix4().makeRotationX(C.beta);
  if (C.sgn < 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  if (extraX) m.multiply(new THREE.Matrix4().makeRotationX(extraX));
  return new THREE.Quaternion().setFromRotationMatrix(m);
};

function pistonGeometries(E) {
  const R = E.pistonR, g = {};
  // body: ω-bowl in the crown, three ring grooves, full skirt, hollow underside
  const bowl = [[0, -10], [4, -11.5], [10, -16], [17, -21.5], [24, -23], [30, -21], [34.5, -15.5], [37, -8], [39, -2.5], [41.5, 0]];
  const belt = [[R - 0.8, 0], [R, -0.8], [R, -11], [58.2, -11], [58.2, -14], [R, -14], [R, -21], [58.2, -21], [58.2, -24], [R, -24],
    [R, -31], [58.2, -31], [58.2, -37], [R, -37], [R, -138], [R - 1.2, -E.pistonH], [57, -E.pistonH], [57, -62], [46, -52], [34, -44], [0, -44]];
  g.body = G.lathe(bowl.concat(belt), 56, 0, undefined, true);
  // pin bosses + struts
  const parts = [];
  for (const s of [-1, 1]) {
    const boss = G.cylX(31, s < 0 ? -57 : 21, s < 0 ? -21 : 57, 32); boss.translate(0, -E.compH, 0); parts.push(boss);
    const strut = new THREE.BoxGeometry(30, 40, 26); strut.translate(s * 39, -64, 0); parts.push(strut);
  }
  g.bosses = G.merge(parts);
  // rings
  const ringAt = (y0, y1, gap) => G.lathe([[58.4, y0], [R + 0.15, y0], [R + 0.15, y1], [58.4, y1], [58.4, y0]], 56, gap, Math.PI * 2 - 2 * gap, true);
  g.rings = G.merge([ringAt(-13.8, -11.2, 0.01), ringAt(-23.8, -21.2, 0.01), ringAt(-36.8, -31.2, 0.006)]);
  // floating pin + circlips
  const pin = G.lathe([[E.pinID / 2, 0], [E.pinOD / 2, 0], [E.pinOD / 2, 104], [E.pinID / 2, 104], [E.pinID / 2, 0]], 36, 0, undefined, true);
  G.toX(pin); pin.translate(-52, -E.compH, 0);
  const clipL = new THREE.TorusGeometry(22.5, 1.2, 6, 32); clipL.rotateY(Math.PI / 2); clipL.translate(-52.6, -E.compH, 0);
  const clipR = clipL.clone(); clipR.translate(105.2, 0, 0);
  g.pin = G.merge([pin, clipL, clipR]);
  // valve pockets: the part of each pocket outside the bowl lip, as a dark floor + rim strip
  const fill = [], rim = [];
  for (const [dx, rr] of [[-E.valveDX, E.valveHeadR.in + 2], [E.valveDX, E.valveHeadR.ex + 2]]) {
    const cz = E.valveS, N = 96;
    for (let k = 0; k < N; k++) {
      const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2;
      const P = (r, a) => [dx + r * Math.cos(a), cz + r * Math.sin(a)];
      const inside = p => { const d = Math.hypot(p[0], p[1]); return d > 41.8 && d < R - 1.2; };
      const p0 = P(rr, a0), p1 = P(rr, a1), q0 = P(rr - 1.6, a0), q1 = P(rr - 1.6, a1);
      if (inside(p0) && inside(p1) && inside(q0) && inside(q1)) {
        const v = p => [p[0], 0.08, p[1]];
        rim.push(...v(q0), ...v(p0), ...v(p1), ...v(q0), ...v(p1), ...v(q1));
      }
      // floor: fan from the pocket centre, clipped to the crown annulus (coarse polygon test)
      for (let j = 0; j < 6; j++) {
        const r0 = (rr - 1.6) * j / 6, r1 = (rr - 1.6) * (j + 1) / 6;
        const a = P(r0, a0), b = P(r1, a0), c = P(r1, a1), d = P(r0, a1);
        if ([a, b, c, d].every(inside)) { const v = p => [p[0], 0.05, p[1]]; fill.push(...v(a), ...v(b), ...v(c), ...v(a), ...v(c), ...v(d)); }
      }
    }
  }
  const mk = arr => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); geo.computeVertexNormals(); return geo; };
  g.pocketFloor = mk(fill); g.pocketRim = mk(rim);
  return g;
}

/* rod in its own frame: origin = big-end centre, +Y toward the small end, X = crank axis */
function rodGeometries(E) {
  const L = E.rodLen, rb = E.rodBig / 2, g = {};
  const key = [[42, 48], [58, 30], [78, 23], [110, 20], [170, 17.5], [212, 16]];
  const w = x => {
    if (x <= key[0][0]) return key[0][1];
    for (let j = 0; j < key.length - 1; j++) if (x <= key[j + 1][0]) {
      const t = (x - key[j][0]) / (key[j + 1][0] - key[j][0]); return key[j][1] + (key[j + 1][1] - key[j][1]) * t;
    }
    return key[key.length - 1][1];
  };
  const eyeR = 35, eyeA = Math.PI - Math.asin(16 / eyeR);
  const outline = () => {
    const pts = [[0, 66], [16, 66], [30, 61]];
    for (let x = 42; x <= 212; x += 5) pts.push([x, w(x)]);
    for (let k = 0; k <= 28; k++) { const a = eyeA - (2 * eyeA) * k / 28; pts.push([L + eyeR * Math.cos(a), eyeR * Math.sin(a)]); }
    for (let x = 212; x >= 42; x -= 5) pts.push([x, -w(x)]);
    pts.push([30, -61], [16, -66], [0, -66], [0, -rb]);
    for (let k = 1; k < 28; k++) { const a = -Math.PI / 2 + Math.PI * k / 28; pts.push([rb * Math.cos(a), rb * Math.sin(a)]); }
    pts.push([0, rb]);
    return pts;
  };
  const web = G.shapeFromPts(outline());
  web.holes.push(G.circlePath(L, 0, 27.5, true));
  const parts = [G.extrudeX(web, -7, 7, { curveSegments: 24 })];
  const be = [[0, 66], [16, 66], [30, 61], [42, 48], [52, 36], [58, 0], [52, -36], [42, -48], [30, -61], [16, -66], [0, -66], [0, -rb]];
  for (let k = 1; k < 28; k++) { const a = -Math.PI / 2 + Math.PI * k / 28; be.push([rb * Math.cos(a), rb * Math.sin(a)]); }
  be.push([0, rb]);
  parts.push(G.extrudeX(G.shapeFromPts(be), -E.rodW / 2, E.rodW / 2, { bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 1, curveSegments: 12 }));
  const eye = new THREE.Shape(); eye.absarc(L, 0, eyeR, 0, Math.PI * 2, false); eye.holes.push(G.circlePath(L, 0, 27.5, true));
  parts.push(G.extrudeX(eye, -17, 17, { bevelEnabled: true, bevelThickness: 1, bevelSize: 0.7, bevelSegments: 1, curveSegments: 40 }));
  for (const s of [-1, 1]) {                                   // I-beam flanges
    const pts = [];
    for (let x = 46; x <= 214; x += 4) pts.push([x, s * w(x)]);
    for (let x = 214; x >= 46; x -= 4) pts.push([x, s * (w(x) - 5.5)]);
    parts.push(G.extrudeX(G.shapeFromPts(pts), -13, 13));
  }
  g.rod = G.merge(parts);
  const cap = [[0, 66], [-26, 66], [-26, 46]];
  for (let k = 0; k <= 22; k++) { const a = Math.PI * 0.742 + Math.PI * 0.516 * k / 22; cap.push([57 * Math.cos(a), 57 * Math.sin(a)]); }
  cap.push([-26, -46], [-26, -66], [0, -66], [0, -rb]);
  for (let k = 1; k < 28; k++) { const a = -Math.PI / 2 - Math.PI * k / 28; cap.push([rb * Math.cos(a), rb * Math.sin(a)]); }
  cap.push([0, rb]);
  g.cap = G.extrudeX(G.shapeFromPts(cap), -E.rodW / 2, E.rodW / 2, { bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 1, curveSegments: 12 });
  const bolts = [];
  for (const z of [-53, 53]) {
    const shank = new THREE.CylinderGeometry(6.5, 6.5, 66, 14); shank.translate(0, 2, z); bolts.push(shank);
    const head = G.hexPrism(19, 9); head.translate(0, -36, z); bolts.push(head);
  }
  g.bolts = G.merge(bolts);
  const bush = G.lathe([[25.05, 0], [27.5, 0], [27.5, 34], [25.05, 34], [25.05, 0]], 40, 0, undefined, true);
  G.toX(bush); bush.translate(-17, L, 0);
  g.bush = bush;
  g.shells = G.merge([BUILD_V8.halfShell(40.05, rb, -E.rodW / 2 + 0.6, E.rodW / 2 - 0.6, true), BUILD_V8.halfShell(40.05, rb, -E.rodW / 2 + 0.6, E.rodW / 2 - 0.6, false)]);
  return g;
}

function linerGeometries(E) {
  const top = E.deck, bot = 160, g = {};
  g.wall = G.lathe([[62.6, bot], [70, bot], [70, 166], [73, 168], [73, 200], [70, 202], [70, top - 12], [76, top - 10],
    [76, top], [62.6, top], [62.6, bot]], 56, 0, undefined, true);
  const o1 = new THREE.TorusGeometry(73.2, 2.4, 8, 56); o1.rotateX(Math.PI / 2); o1.translate(0, 178, 0);
  const o2 = o1.clone(); o2.translate(0, 13, 0);
  g.orings = G.merge([o1, o2]);
  return g;
}

BUILD_V8.pistons = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const pg = pistonGeometries(E), rg = rodGeometries(E), lg = linerGeometries(E);
  const pocketMat = new THREE.MeshStandardMaterial({ color: MM.srgb('#57534c'), metalness: 0.5, roughness: 0.7, side: THREE.DoubleSide });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x2a2826, side: THREE.DoubleSide });
  // liners: translucent so the pistons inside stay visible
  for (const k of ['liner', 'linerBore']) { M[k].transparent = true; M[k].depthWrite = false; M[k].opacity = k === 'liner' ? 0.2 : 0.14; }
  const pistons = [], rods = [], liners = [];
  for (let c = 0; c < 8; c++) {
    const C = E.cyl[c];
    const p = new THREE.Group();
    const add = (grp, geo, mat, part, layer) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, layer || 'pistons'); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
    add(p, pg.body, M.piston, 'piston'); add(p, pg.bosses, M.piston, 'piston');
    add(p, pg.pocketFloor, pocketMat, 'piston'); add(p, pg.pocketRim, rimMat, 'piston');
    add(p, pg.rings, M.ring, 'rings'); add(p, pg.pin, M.pin, 'pin');
    p.quaternion.copy(BUILD_V8.bankQuat(E, c));
    pistons.push(p);

    const r = new THREE.Group();
    add(r, rg.rod, M.rod, 'rod'); add(r, rg.cap, M.rod, 'rod'); add(r, rg.bolts, M.rodBolt, 'rod');
    add(r, rg.bush, M.rodBush, 'rod'); add(r, rg.shells, M.bearingRod, 'bearingRod');
    r.position.x = C.x;
    rods.push(r);

    const l = new THREE.Group();
    const wall = add(l, lg.wall, M.liner, 'liner'); wall.castShadow = false; wall.renderOrder = 2;
    add(l, lg.orings, M.oring, 'liner');
    const A = E.axisOf(c);
    l.position.set(C.x, 0, 0);
    l.quaternion.copy(BUILD_V8.bankQuat(E, c));
    liners.push(l);
    void A;
  }
  return {
    pistons, rods, liners,
    update(theta) {
      for (let c = 0; c < 8; c++) {
        const k = E.kin(c, theta), A = E.axisOf(c), C = E.cyl[c];
        pistons[c].position.set(C.x, k.crown * A.y, k.crown * A.z);
        rods[c].position.set(C.x, k.pinY, k.pinZ);
        rods[c].rotation.x = k.rodRot;
      }
    },
  };
};
})();
