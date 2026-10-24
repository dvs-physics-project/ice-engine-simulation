/* b4/build-air.js — поз. 22 intake: plenum over the crankcase with the throttle body at the front,
   four runners arching over to the head flanges (as in the cross-section); поз. 23 injectors in
   the runners aimed at the intake valves, fuel rails and the crossover line; exhaust downpipes
   from the bottom of each head into a collector per bank running back under the engine. The
   tubes double as the flow paths for the gas particles. */
(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};
const V3 = THREE.Vector3;

BUILD_B4.air = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { objects: [], flows: { intake: [], throttle: null, exhaust: [] }, injTips: [], injAxis: [] };
  const ghost = (geo, key, part, angle) => {
    const m = new THREE.Mesh(geo, MM.ghost[key]); m.renderOrder = 2; ctx.tag(m, part, 'air');
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle || 30), MM.ghostEdges[key]);
    e.renderOrder = 3; e.userData.pickable = false; ctx.tag(e, part, 'air');
    out.objects.push(m, e); return m;
  };
  const solid = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'air'); m.castShadow = m.receiveShadow = true; out.objects.push(m); return m; };
  const L = (c, a, s, lx) => BUILD_B4.local(E, c, lx || 0, a, s);
  const curve = pts => new THREE.CatmullRomCurve3(pts, false, 'centripetal');

  /* ---------- поз. 22 plenum + throttle body + runners ---------- */
  const PY = 158, PX = [-112, 128];
  const plenum = G.extrudeX(G.roundRect(76, 116, 24), PX[0], PX[1], { curveSegments: 6 }); plenum.translate(0, PY, 0);
  const throttle = G.merge([G.tubeX(27, 31, -152, PX[0], 40), G.tubeX(27, 38, -158, -152, 40)]).translate(0, PY + 2, 0);
  const runners = [], flanges = [];
  for (let c = 0; c < 4; c++) {
    const pts = [L(c, 30, PY), L(c, 88, PY + 8), L(c, 160, PY + 26), L(c, 228, PY + 18), L(c, 268, PY - 10), L(c, 284, 116), L(c, 287, 92)];
    runners.push(new THREE.TubeGeometry(curve(pts.slice(1)), 48, 20, 16, false));
    const f = G.lathe([[0, 0], [27, 0], [27, 6], [0, 6]], 28); G.applyQ(f, BUILD_B4.bankQuat(E, c, Math.PI / 2));
    const p = L(c, 287, 86); f.translate(p.x, p.y, p.z); flanges.push(f);
    out.flows.intake.push(curve([new V3(E.cyl[c].x, PY + 4, 0), ...pts.slice(1)]));
  }
  ghost(G.merge([plenum, throttle]), 'intake', 'intake', 24);
  ghost(G.merge(runners.concat(flanges)), 'intake', 'intake', 40);
  // throttle plate, half open
  const plate = new THREE.CylinderGeometry(26.6, 26.6, 1.6, 40); plate.rotateZ(Math.PI / 2); plate.rotateY(0.6); plate.translate(-136, PY + 2, 0);
  const spindle = G.cylBetween(2.6, new V3(-136, PY + 2, -36), new V3(-136, PY + 2, 36), 10);
  solid(G.merge([plate, spindle]), MM.hw.alu, 'intake');
  out.flows.throttle = curve([new V3(-190, PY + 2, 0), new V3(-150, PY + 2, 0), new V3(-100, PY, 0), new V3(0, PY, 0), new V3(PX[1] - 12, PY, 0)]);

  /* ---------- поз. 23 injectors (in each runner by the flange), rails, crossover ---------- */
  const injA = 40 * Math.PI / 180, inj = [], seals = [], rails = [], railEnds = { R: [], L: [] };
  for (let c = 0; c < 4; c++) {
    const C = E.cyl[c], tip = L(c, 292, 100), q = BUILD_B4.bankQuat(E, c, injA);
    const ax = new V3(0, 1, 0).applyQuaternion(q);
    out.injTips.push(tip); out.injAxis.push(ax);
    const b = G.merge([
      G.lathe([[0, 0], [3.2, 0], [3.2, 7], [7.6, 9], [7.6, 46], [5.2, 48], [5.2, 62], [0, 62]], 28),
      (() => { const g = new THREE.BoxGeometry(12, 10, 9); g.translate(0, 38, 9); return g; })(),
    ]);
    G.applyQ(b, q); b.translate(tip.x, tip.y, tip.z); inj.push(b);
    const o = new THREE.TorusGeometry(5.6, 1.3, 8, 24); o.rotateX(Math.PI / 2); o.translate(0, 8, 0);
    const cup = new THREE.CylinderGeometry(9, 9, 14, 24); cup.translate(0, 58, 0);
    const s = G.merge([o, cup]); G.applyQ(s, q); s.translate(tip.x, tip.y, tip.z); seals.push(s);
    railEnds[C.bank].push(tip.clone().addScaledVector(ax, 58));
  }
  for (const b of ['R', 'L']) {
    const [p, r] = railEnds[b].sort((u, v) => u.x - v.x), y = p.y, z = p.z;
    rails.push(G.cylX(8, p.x - 34, r.x + 30, 20).translate(0, y, z));
    rails.push(G.cylX(10.5, p.x - 52, p.x - 34, 20).translate(0, y, z));        // pressure damper
    railEnds[b].far = new V3(r.x + 30, y, z);
  }
  // crossover: off the rear ends of both rails, round behind the plenum
  const R0 = railEnds.R.far, L0 = railEnds.L.far, xb = PX[1] + 26;
  const cross = curve([R0, new V3(R0.x + 30, R0.y + 4, R0.z * 0.9), new V3(xb, PY + 4, -120), new V3(xb + 4, PY + 8, 0),
    new V3(xb, PY + 4, 120), new V3(L0.x + 24, L0.y + 4, L0.z * 0.9), L0]);
  rails.push(new THREE.TubeGeometry(cross, 64, 3.6, 10, false));
  solid(G.merge(inj), M.injector, 'injector');
  solid(G.merge(seals.concat(rails)), M.fuelRail, 'injector');

  /* ---------- exhaust: downpipe per cylinder, collector per bank running back under the engine ---------- */
  const pipes = [], coll = [];
  for (const b of ['R', 'L']) {
    const zs = b === 'R' ? -1 : 1, cyls = b === 'R' ? [0, 2] : [1, 3];
    const xf = E.cyl[cyls[0]].x, xr = E.cyl[cyls[1]].x;
    const cpts = [new V3(xf - 10, -214, zs * 250), new V3(xr + 20, -216, zs * 248), new V3(140, -224, zs * 214), new V3(186, -234, zs * 150),
      new V3(232, -238, zs * 126), new V3(300, -238, zs * 126)];
    coll.push(new THREE.TubeGeometry(curve(cpts), 80, 22, 16, false));
    for (const c of cyls) {
      const C = E.cyl[c];
      const dpts = [L(c, 266, -97), L(c, 265, -128), L(c, 260, -162), L(c, 254, -190), new V3(C.x + 16, -212, zs * 249)];
      pipes.push(new THREE.TubeGeometry(curve(dpts), 40, 17, 14, false));
      const fl = G.lathe([[0, 0], [26, 0], [26, 6], [0, 6]], 28); G.applyQ(fl, BUILD_B4.bankQuat(E, c, -Math.PI / 2));
      const p = L(c, 266, -96); fl.translate(p.x, p.y, p.z); pipes.push(fl);
      const tail = cpts.filter(p => p.x > C.x + 16);
      out.flows.exhaust[c] = curve(dpts.concat(tail));
    }
  }
  ghost(G.merge(pipes.concat(coll)), 'exhaust', 'exhaust', 40);
  out.update = function () {};
  return out;
};
})();
