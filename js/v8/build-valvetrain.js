(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};
const V3 = THREE.Vector3;

BUILD_V8.local = function (E, c, lx, a, s, target) {
  const C = E.cyl[c], p = E.bankPoint(c, C.x + (C.sgn > 0 ? lx : -lx), a, s);
  return (target || new V3()).set(p[0], p[1], p[2]);
};

function rockerGeometry(E) {
  const P = E.rockerP, T = { s: E.rockerT0.s - P.s, a: E.rockerT0.a - P.a }, V = { s: E.rockerV0.s - P.s, a: E.rockerV0.a - P.a };
  const pts = [];
  for (let k = 0; k <= 10; k++) { const t = Math.PI * (1.18 + 0.64 * k / 10); pts.push([V.s + E.padR * Math.cos(t), V.a + E.padR * Math.sin(t)]); }
  pts.push([V.s + 14, V.a - 4.5], [-16, -7.5], [-11, -13.5], [0, -16.5], [11, -13.5], [18, -9], [T.s - 9, T.a + 7.5],
    [T.s + 1, T.a + 6], [T.s + 9, T.a + 7.5], [T.s + 11.5, T.a + 13.5], [T.s + 9, T.a + 20], [T.s - 2, T.a + 21],
    [16, 11.5], [9, 16.5], [0, 17.5], [-9, 16.5], [-17, 11.5], [V.s + 16, V.a + 4.5], [V.s + 4, V.a + 8.5], [V.s - 4, V.a + 7.5]);
  const shape = G.shapeFromPts(pts.map(p => [p[1], p[0]]));
  shape.holes.push(G.circlePath(0, 0, 11.6, true));
  const body = G.extrudeX(shape, -8, 8, { curveSegments: 18, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 1 });
  const boss = G.tubeX(11.6, 17, -12, 12, 40);
  const screwX = T.s;
  const screw = [];
  const sh = new THREE.CylinderGeometry(5, 5, 32, 16); sh.translate(0, T.a + 15, screwX); screw.push(sh);
  const nut = G.hexPrism(15, 6.5); nut.translate(0, T.a + 21.5, screwX); screw.push(nut);
  const tipSlot = new THREE.CylinderGeometry(4.2, 4.2, 4, 14); tipSlot.translate(0, T.a + 32, screwX); screw.push(tipSlot);
  const ball = new THREE.SphereGeometry(6, 18, 12); ball.translate(0, T.a, screwX); screw.push(ball);
  return { body: G.merge([body, boss]), screw: G.merge(screw) };
}

BUILD_V8.valvetrain = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { ports: { in: [], ex: [] }, static: [] };

  const cam = new THREE.Group();
  cam.position.set(0, E.camY, 0);
  const camX = E.mainX;
  const core = [G.cylX(17, -352, 352, 32)];
  const polish = [];
  camX.forEach((x, k) => polish.push(G.cylX(E.camJournalR, x - (k === 0 ? 18 : 15), x + 15, 48)));
  core.push(G.cylX(33, -361, -354, 48));
  core.push(G.cylX(20, 352, 388, 36));
  const lobes = { in: G.shapeFromPts(E.lobeProfile(E.camBeta.in, 240)), ex: G.shapeFromPts(E.lobeProfile(E.camBeta.ex, 240)) };
  for (let c = 0; c < 8; c++) for (const side of ['in', 'ex']) {
    const x = E.valveX(c, side);
    const geo = new THREE.ExtrudeGeometry(lobes[side], { depth: E.lobeW, bevelEnabled: false, curveSegments: 1 });
    geo.rotateZ(E.lobeAngle(c, side));
    geo.translate(0, 0, x - E.lobeW / 2);
    G.shapeToYZ(geo);
    polish.push(geo);
  }
  const bolt = G.hexPrism(24, 7); G.toX(bolt); bolt.translate(391, 0, 0);
  const washer = G.tubeX(8, 22, 388.5, 391, 32);
  const shaft = new THREE.Mesh(G.merge(core), M.camshaft);
  const lobeMesh = new THREE.Mesh(G.merge(polish), M.camLobe);
  const camBolt = new THREE.Mesh(G.merge([bolt, washer]), M.noseBolt);
  [shaft, lobeMesh, camBolt].forEach(m => { ctx.tag(m, 'camshaft', 'valvetrain'); m.castShadow = m.receiveShadow = true; cam.add(m); });
  out.cam = cam;

  const Rf = E.tappetFaceR, Rs = E.tappetStemR, Lt = E.tappetLen;
  const tappetGeo = G.lathe([[0, 0], [Rf - 0.6, 0], [Rf, 0.6], [Rf, 4], [Rf - 2.5, 5.5], [Rs + 1, 9], [Rs, 12], [Rs, Lt + 2.2],
    [Rs - 1.6, Lt + 3.4], [6.6, Lt + 3.4], [6.2, Lt], [5.83, Lt - 2.12], [4.75, Lt - 3.99], [3.1, Lt - 5.37], [0, Lt - 6.2]], 28, 0, undefined, true);
  const L = E.pushLen;
  const pushGeo = G.merge([
    new THREE.SphereGeometry(6, 18, 12),
    (() => { const c = new THREE.CylinderGeometry(4.6, 4.6, L - 13, 14, 1, true); c.translate(0, (L - 13) / 2 + 4, 0); return c; })(),
    G.lathe([[4.6, L - 9], [6.5, L - 7.5], [8.6, L - 4.5], [8.6, L + 1.5], [6.4, L + 1.5], [6.25, L],
      [5.4, L - 3.1], [3.1, L - 5.4], [0, L - 6.25]], 22, 0, undefined, true),
  ]);
  const rg = rockerGeometry(E);
  const valveGeo = side => {
    const R = E.valveHeadR[side], Lv = E.valveLen, st = 5;
    const pts = [[0, 0], [R - 0.5, 0], [R, 0.6], [R, 2.4], [R - 3.2, 5.2]];
    for (let k = 1; k <= 9; k++) { const t = k / 9, r = (R - 3.2) + (st - (R - 3.2)) * (1 - Math.pow(1 - t, 2.4)); pts.push([r, 5.2 + 22 * t]); }
    pts.push([st, Lv - 10], [st - 0.8, Lv - 9.2], [st - 0.8, Lv - 7.6], [st, Lv - 6.8], [st, Lv - 0.6], [st - 0.6, Lv], [0, Lv]);
    return G.lathe(pts, 36);
  };
  const springH = E.springHi - E.springLo - 1.6;
  const outerSpring = G.coilSpring(16.5, 2.3, 5.4, springH, 1, 6, 16);
  const innerSpring = G.coilSpring(11, 1.7, 7.2, springH, -1, 5, 16);
  const retainerGeo = G.lathe([[6.4, -7], [8.2, -7], [9.8, -1.5], [19.6, 0], [19.6, 1.8], [16, 2.6], [10.5, 5.5], [7.8, 5.5], [6.4, -7]], 40, 0, undefined, true);
  const keeperGeo = G.lathe([[5.05, -6.5], [6.35, -6.5], [7.75, 4.8], [5.05, 4.8], [5.05, -6.5]], 24, 0, undefined, true);

  const mk = (geo, mat, part, count) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ctx.tag(m, part, 'valvetrain');
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const valves = { in: mk(valveGeo('in'), M.valveIn, 'valveIn', 8), ex: mk(valveGeo('ex'), M.valveEx, 'valveEx', 8) };
  const tappets = mk(tappetGeo, M.tappet, 'tappet', 16);
  const pushrods = mk(pushGeo, M.pushrod, 'pushrod', 16);
  const rockers = mk(rg.body, M.rocker, 'rocker', 16);
  const screws = mk(rg.screw, M.adjScrew, 'rocker', 16);
  const springsO = mk(outerSpring, M.spring, 'springs', 16);
  const springsI = mk(innerSpring, M.spring, 'springs', 16);
  const retainers = mk(retainerGeo, M.retainer, 'springs', 16);
  const keepers = mk(keeperGeo, M.adjScrew, 'springs', 16);
  out.instanced = [valves.in, valves.ex, tappets, pushrods, rockers, screws, springsO, springsI, retainers, keepers];

  const P = E.rockerP;
  const shaftG = [], pedG = [], guideG = [], seatG = [], sealG = [], boltG = [];
  const rubber = new THREE.MeshStandardMaterial({ color: MM.srgb('#16181b'), roughness: 0.65, metalness: 0 });
  const pedShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(E.headTop - P.a, -16); s.lineTo(0, -16);
    s.absarc(0, 0, 16, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(E.headTop - P.a, 16); s.closePath();
    s.holes.push(G.circlePath(0, 0, 11.05, true));
    return s;
  })();
  const valveList = [];
  for (let c = 0; c < 8; c++) {
    const q = BUILD_V8.bankQuat(E, c);
    const sh = G.cylX(11, -60, 60, 28); sh.translate(0, P.a, P.s); shaftG.push({ g: sh, c, q });
    for (const x of [-52, 52]) {
      const pg = G.extrudeX(pedShape, x - 8, x + 8, { curveSegments: 14 }); pg.translate(0, P.a, P.s); pedG.push({ g: pg, c, q });
      const b = G.hexPrism(15, 7); b.translate(x, P.a + 16, P.s); boltG.push({ g: b, c, q });
      const ring = G.tubeX(11, 15, -0.8, 0.8, 24); ring.translate(x > 0 ? 43 : -43, P.a, P.s); shaftG.push({ g: ring, c, q });
    }
    for (const side of ['in', 'ex']) {
      const lx = side === 'in' ? -E.valveDX : E.valveDX;
      valveList.push({ c, side, lx, q, idxSide: c, idxAll: (side === 'in' ? 0 : 8) + c });
      const guide = G.lathe([[5.05, 0], [8, 0], [8, 70], [7, 71], [5.05, 71]], 24, 0, undefined, true);
      guide.translate(lx, E.springLo - 58, E.valveS); guideG.push({ g: guide, c, q });
      const seat = G.lathe([[8.6, 0], [21, 0], [21, 1.6], [8.6, 1.6], [8.6, 0]], 40, 0, undefined, true);
      seat.translate(lx, E.springLo, E.valveS); seatG.push({ g: seat, c, q });
      const seal = G.lathe([[5.2, 0], [9.2, 0], [9.2, 6], [6.6, 8.5], [5.2, 8.5], [5.2, 0]], 24, 0, undefined, true);
      seal.translate(lx, E.springLo + 13, E.valveS); sealG.push({ g: seal, c, q });
    }
  }
  const toWorld = list => G.merge(list.map(({ g, c, q }) => {
    const C = E.cyl[c]; G.applyQ(g, q); g.translate(C.x, 0, 0); return g;
  }));
  const addStatic = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'valvetrain'); m.castShadow = m.receiveShadow = true; out.static.push(m); return m; };
  addStatic(toWorld(shaftG), M.rockerShaft, 'rocker');
  addStatic(toWorld(pedG), MM.hw.alu, 'rocker');
  addStatic(toWorld(boltG), MM.hw.steel, 'rocker');
  addStatic(toWorld(guideG), MM.hw.steel, 'head');
  addStatic(toWorld(seatG), M.retainer, 'springs');
  addStatic(toWorld(sealG), rubber, 'head');

  const portGeos = [];
  const curveOf = (c, pts) => new THREE.CatmullRomCurve3(pts.map(([lx, a, s]) => BUILD_V8.local(E, c, lx, a, s)), false, 'centripetal');
  for (let c = 0; c < 8; c++) {
    const xi = -E.valveDX, xe = E.valveDX;
    const inPts = [[-54, 468, 172], [-54, 468, 140], [-53, 466, 112], [-46, 460, 80], [-36, 450, 50], [xi, 436, 26], [xi, E.valveSeatA + 6, E.valveS]];
    const exPts = [[xe, E.valveSeatA + 6, E.valveS], [xe, 436, 12], [33, 452, -24], [34, 462, -62], [34, 466, -95], [34, 466, -128]];
    const ci = curveOf(c, inPts), ce = curveOf(c, exPts);
    out.ports.in.push(ci); out.ports.ex.push(ce);
    portGeos.push(new THREE.TubeGeometry(curveOf(c, inPts.slice(1)), 40, 16, 14, false));
    portGeos.push(new THREE.TubeGeometry(curveOf(c, exPts.slice(0, 5)), 36, 14.5, 14, false));
  }
  const ports = new THREE.Mesh(G.merge(portGeos), MM.ghost.ports);
  ports.renderOrder = 2;
  ctx.tag(ports, 'head', 'housing');
  out.portMesh = ports;

  const m4 = new THREE.Matrix4(), pos = new V3(), one = new V3(1, 1, 1), scl = new V3(1, 1, 1);
  const qx = new THREE.Quaternion(), qq = new THREE.Quaternion(), X = new V3(1, 0, 0);
  out.lifts = new Float32Array(16);
  out.camLifts = new Float32Array(16);
  out.phi = new Float32Array(16);
  out.update = function (theta) {
    cam.rotation.x = E.kappa * theta;
    for (const vv of valveList) {
      const { c, side, lx, q } = vv, k = vv.idxAll;
      const h = E.camLiftAt(c, side, theta), r = E.rocker(h), lift = r.valve;
      out.lifts[k] = lift; out.camLifts[k] = h; out.phi[k] = r.phi;
      BUILD_V8.local(E, c, lx, E.valveSeatA - lift, E.valveS, pos);
      m4.compose(pos, q, one); valves[side].setMatrixAt(vv.idxSide, m4);
      BUILD_V8.local(E, c, lx, E.springLo + 1.6, E.valveS, pos);
      scl.set(1, (E.springHi - E.springLo - 1.6 - lift) / (E.springHi - E.springLo - 1.6), 1);
      m4.compose(pos, q, scl); springsO.setMatrixAt(k, m4); springsI.setMatrixAt(k, m4);
      BUILD_V8.local(E, c, lx, E.springHi - lift, E.valveS, pos);
      m4.compose(pos, q, one); retainers.setMatrixAt(k, m4); keepers.setMatrixAt(k, m4);
      BUILD_V8.local(E, c, lx, E.camA + E.camBase + h, E.camS, pos);
      m4.compose(pos, q, one); tappets.setMatrixAt(k, m4);
      const Bs = E.camS, Ba = E.pushBot0 + h;
      const t0s = E.rockerT0.s - E.rockerP.s, t0a = E.rockerT0.a - E.rockerP.a;
      const Ts = E.rockerP.s + t0s * Math.cos(r.phi) - t0a * Math.sin(r.phi);
      const Ta = E.rockerP.a + t0s * Math.sin(r.phi) + t0a * Math.cos(r.phi);
      const gam = Math.atan2(Ts - Bs, Ta - Ba);
      BUILD_V8.local(E, c, lx, Ba, Bs, pos);
      qx.setFromAxisAngle(X, gam); qq.copy(q).multiply(qx);
      m4.compose(pos, qq, one); pushrods.setMatrixAt(k, m4);
      BUILD_V8.local(E, c, lx, E.rockerP.a, E.rockerP.s, pos);
      qx.setFromAxisAngle(X, -r.phi); qq.copy(q).multiply(qx);
      m4.compose(pos, qq, one); rockers.setMatrixAt(k, m4); screws.setMatrixAt(k, m4);
    }
    out.instanced.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  };
  return out;
};
})();
