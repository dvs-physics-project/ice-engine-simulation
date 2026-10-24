/* build-valvetrain.js — DOHC 16V: поз. 11 camshafts (true flat-follower lobe profile from
   spec.js), поз. 9 cam pulleys, bearing caps, 16 valves with bucket tappets, double springs,
   retainers, guides and seals, plus the head's intake/exhaust ports (ghost tubes, also used
   as the gas-flow paths). Valve, tappet and spring positions are read off the same lift
   function that shaped the lobes, so every lobe touches its tappet exactly. */
(function () {
'use strict';
window.BUILD_I4 = window.BUILD_I4 || {};
const V3 = THREE.Vector3;

BUILD_I4.valvetrain = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { cams: [], ports: { in: [], ex: [] } };

  /* ---------------- camshafts ---------------- */
  const prof = E.lobeProfile(240);
  const lobeShape = G.shapeFromPts(prof);
  const camJournals = [-172, -86, 0, 86, 172];
  for (const s of [-1, 1]) {
    const cg = new THREE.Group();
    cg.position.set(0, E.camY, s * E.camZ);
    const core = [G.cylX(11, -205, 188, 28), G.cylX(10, -232, -205, 28)];
    const polish = [];
    camJournals.forEach((x, k) => polish.push(G.cylX(12.5, x - (k === 0 ? 14 : 10), x + 10, 36)));
    polish.push(G.cylX(17, -159, -156, 36));                       // thrust collar
    for (let i = 0; i < 4; i++) {
      const a = E.lobeAngle(i, s);
      for (const d of [-1, 1]) {
        const x = E.cylX[i] + d * E.valveDX;
        // no bevel: any outward bevel would make the drawn lobe taller than the lift law
        const geo = new THREE.ExtrudeGeometry(lobeShape, { depth: E.lobeW, bevelEnabled: false, curveSegments: 1 });
        geo.rotateZ(a);
        geo.translate(0, 0, x - E.lobeW / 2);
        G.shapeToYZ(geo);
        polish.push(geo);
      }
    }
    const shaft = new THREE.Mesh(G.merge(core), M.camshaft);
    const lobes = new THREE.Mesh(G.merge(polish), M.camLobe);
    [shaft, lobes].forEach(m => { ctx.tag(m, 'camshaft', 'valvetrain'); m.castShadow = m.receiveShadow = true; cg.add(m); });

    /* поз. 9 cam pulley (46 teeth) with spoked web, hub and bolt */
    const R = E.pd(E.z.cam) / 2;
    const phase = ctx.belt.phase[s < 0 ? 'camIn' : 'camEx'];
    const rim = G.timingPulleyShape(E.z.cam, R, { phase, holes: [G.circlePath(0, 0, R - 9, true)] });
    const web = new THREE.Shape(); web.absarc(0, 0, R - 7, 0, Math.PI * 2, false);
    web.holes.push(G.circlePath(0, 0, 10, true));
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + 0.3;
      web.holes.push(G.circlePath(31 * Math.cos(a), 31 * Math.sin(a), 10.5, true));
    }
    const pulley = new THREE.Mesh(G.merge([
      G.extrudeX(rim, E.beltX - 13, E.beltX + 13, { curveSegments: 40 }),
      G.extrudeX(web, E.beltX - 4, E.beltX + 4, { curveSegments: 28 }),
      G.tubeX(10, 18, E.beltX - 10, E.beltX + 15, 40),
    ]), M.camPulley);
    ctx.tag(pulley, 'camPulley', 'timing');
    pulley.castShadow = pulley.receiveShadow = true;
    cg.add(pulley);
    const boltGeo = G.merge([
      (() => { const g = G.hexPrism(17, 8); G.toX(g); g.translate(E.beltX - 22, 0, 0); return g; })(),
      G.tubeX(0, 15, E.beltX - 14, E.beltX - 10, 36),
    ]);
    const bolt = new THREE.Mesh(boltGeo, M.camBolt);
    ctx.tag(bolt, 'camPulley', 'timing');
    cg.add(bolt);
    out.cams.push({ s, group: cg });
  }

  /* ---------------- cam bearing caps (part of the head, поз. 4) ---------------- */
  const capGeos = [];
  for (const s of [-1, 1]) {
    camJournals.forEach((x, k) => {
      const w = k === 0 ? 28 : 18;
      const shp = new THREE.Shape();
      shp.moveTo(0, -25); shp.lineTo(0, -12.6);
      shp.absarc(0, 0, 12.6, -Math.PI / 2, Math.PI / 2, false);   // notch round the journal
      shp.lineTo(0, 25); shp.lineTo(17, 25); shp.quadraticCurveTo(23, 25, 23, 19);
      shp.lineTo(23, -19); shp.quadraticCurveTo(23, -25, 17, -25); shp.closePath();
      const g = G.extrudeX(shp, x - w / 2 - (k === 0 ? 4 : 0), x + w / 2 - (k === 0 ? 4 : 0), { curveSegments: 14 });
      g.translate(0, E.camY, s * E.camZ);
      capGeos.push(g);
      for (const dz of [-17, 17]) {
        const b = G.hexPrism(10, 6); b.translate(x - (k === 0 ? 4 : 0), E.camY + 23, s * E.camZ + dz);
        capGeos.push(b);
      }
    });
  }
  const caps = new THREE.Mesh(G.merge(capGeos), M.camCap);
  ctx.tag(caps, 'head', 'housing');
  caps.castShadow = caps.receiveShadow = true;
  out.caps = caps;

  /* ---------------- valves, tappets, springs (instanced) ---------------- */
  const valveGeo = s => {
    const R = s < 0 ? E.valveHeadR.in : E.valveHeadR.ex, L = E.valveLen, st = E.stemR;
    const pts = [[0, 0], [R, 0], [R, 1.2], [R - 2.4, 3.6]];
    for (let k = 1; k <= 8; k++) {                       // tulip fillet into the stem
      const t = k / 8, a = (R - 2.4) + (st - (R - 2.4)) * (1 - Math.pow(1 - t, 2.2));
      pts.push([a, 3.6 + 13 * t]);
    }
    pts.push([st, L - 7], [st - 0.55, L - 6.4], [st - 0.55, L - 5.4], [st, L - 4.8], [st, L - 0.4], [st - 0.4, L], [0, L]);
    return G.lathe(pts, 32);
  };
  const tappetGeo = G.lathe([[0, 0], [E.tappetR - 0.7, 0], [E.tappetR, -0.7], [E.tappetR, -E.tappetH],
    [E.tappetR - 1.3, -E.tappetH], [E.tappetR - 1.3, -4.2], [0, -4.2]], 40, 0, undefined, true);
  const shimGeo = G.lathe([[0, 0.02], [12.2, 0.02], [12.2, 0.32], [0, 0.32]], 40, 0, undefined, true);
  const springH = E.springTop - E.springSeat;
  const outerSpring = G.coilSpring(11.4, 1.65, 5.2, springH, 1, 7);
  const innerSpring = G.coilSpring(7.7, 1.2, 6.4, springH, -1, 6);
  const retainerGeo = G.lathe([[2.4, -4.2], [3.6, -4.2], [5.6, 0], [13.4, 0], [13.4, 1.4], [10.8, 2.0],
    [6.6, 5.8], [3.3, 5.8], [2.4, -4.2]], 36, 0, undefined, true);
  const seatGeo = G.lathe([[5.6, -1.2], [13.6, -1.2], [13.6, 0], [5.6, 0], [5.6, -1.2]], 36, 0, undefined, true);
  const guideGeo = G.lathe([[E.stemR + 0.05, 0], [5.4, 0], [5.4, 26], [E.stemR + 0.05, 26]], 24, 0, undefined, true);
  const sealGeo = G.lathe([[3.0, 0], [6.4, 0], [6.4, 5], [4.2, 6.5], [3.0, 6.5], [3.0, 0]], 24, 0, undefined, true);

  const N = 8;
  const mk = (geo, mat, part, count, layer) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ctx.tag(m, part, layer || 'valvetrain');
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const valves = { '-1': mk(valveGeo(-1), M.valveIn, 'valveIn', N), '1': mk(valveGeo(1), M.valveEx, 'valveEx', N) };
  const tappets = mk(tappetGeo, M.tappet, 'tappet', 16);
  const shims = mk(shimGeo, M.shim, 'tappet', 16);
  const springsO = mk(outerSpring, M.spring, 'springs', 16);
  const springsI = mk(innerSpring, M.spring, 'springs', 16);
  const retainers = mk(retainerGeo, M.retainer, 'springs', 16);
  const rubber = new THREE.MeshStandardMaterial({ color: MM.srgb('#17191c'), roughness: 0.65, metalness: 0 });
  const staticParts = [];   // seats, guides, seals: built once
  const seatG = [], guideG = [], sealG = [];

  const valveList = [];
  for (const s of [-1, 1]) {
    const ax = E.valveAxis(s), axis = new V3(0, ax.y, ax.z);
    const q = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), s * E.valveAngle);
    for (let i = 0; i < 4; i++) for (const d of [-1, 1]) {
      const seat = new V3(E.cylX[i] + d * E.valveDX, E.seatY, s * E.seatZ);
      valveList.push({ s, i, d, seat, axis, q, idxSide: i * 2 + (d > 0 ? 1 : 0), idxAll: (s < 0 ? 0 : 8) + i * 2 + (d > 0 ? 1 : 0) });
      const place = (geo, along) => {
        const g2 = geo.clone(); G.applyQ(g2, q);
        const p = seat.clone().addScaledVector(axis, along); g2.translate(p.x, p.y, p.z); return g2;
      };
      seatG.push(place(seatGeo, E.springSeat));
      guideG.push(place(guideGeo, E.springSeat - 24));
      sealG.push(place(sealGeo, E.springSeat + 0.2));
    }
  }
  const seatsMesh = new THREE.Mesh(G.merge(seatG), M.retainer); ctx.tag(seatsMesh, 'springs', 'valvetrain');
  const guidesMesh = new THREE.Mesh(G.merge(guideG), M.guide); ctx.tag(guidesMesh, 'head', 'valvetrain');
  const sealsMesh = new THREE.Mesh(G.merge(sealG), rubber); ctx.tag(sealsMesh, 'head', 'valvetrain');
  staticParts.push(seatsMesh, guidesMesh, sealsMesh);

  /* ---------------- ports (ghost tubes, paths for the flow particles) ---------------- */
  const portGeos = [];
  for (const s of [-1, 1]) {
    const rad = s < 0 ? 11.5 : 10;
    const ax = E.valveAxis(s);
    for (let i = 0; i < 4; i++) {
      const pair = [];
      for (const d of [-1, 1]) {
        const x = E.cylX[i];
        const throat = new V3(x + d * E.valveDX, E.seatY + 4.5 * ax.y, s * E.seatZ + 4.5 * ax.z);
        const pts = [
          new V3(x + d * 5, E.headY + 34, s * 112),
          new V3(x + d * 7, E.headY + 33, s * 84),
          new V3(x + d * 12, E.headY + 30, s * 58),
          new V3(x + d * 17.5, E.headY + 24, s * 36),
          throat,
        ];
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        pair.push(curve);
        portGeos.push(new THREE.TubeGeometry(curve, 36, rad, 14, false));
      }
      out.ports[s < 0 ? 'in' : 'ex'].push(pair);
    }
  }
  const ports = new THREE.Mesh(G.merge(portGeos), MM.ghost.ports);
  ctx.tag(ports, 'head', 'housing');
  ports.renderOrder = 2;
  out.portMesh = ports;

  out.instanced = [valves['-1'], valves['1'], tappets, shims, springsO, springsI, retainers];
  out.static = staticParts;

  const m4 = new THREE.Matrix4(), pos = new V3(), scl = new V3(1, 1, 1), one = new V3(1, 1, 1);
  out.lifts = new Float32Array(16);
  out.update = function (theta) {
    out.cams.forEach(c => { c.group.rotation.x = theta / 2; });
    for (const v of valveList) {
      const lift = E.valveLift(v.i, v.s, theta);
      out.lifts[v.idxAll] = lift;
      pos.copy(v.seat).addScaledVector(v.axis, -lift);
      m4.compose(pos, v.q, one); valves[v.s].setMatrixAt(v.idxSide, m4);
      pos.copy(v.seat).addScaledVector(v.axis, E.tappetTop - lift);
      m4.compose(pos, v.q, one); tappets.setMatrixAt(v.idxAll, m4); shims.setMatrixAt(v.idxAll, m4);
      pos.copy(v.seat).addScaledVector(v.axis, E.springSeat);
      scl.set(1, (springH - lift) / springH, 1);
      m4.compose(pos, v.q, scl); springsO.setMatrixAt(v.idxAll, m4); springsI.setMatrixAt(v.idxAll, m4);
      pos.copy(v.seat).addScaledVector(v.axis, E.springTop - lift);
      m4.compose(pos, v.q, one); retainers.setMatrixAt(v.idxAll, m4);
    }
    out.instanced.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  };
  return out;
};
})();
