/* v8/build-air.js — the gas path outside the heads: поз. 29 intake manifolds along the inner
   (vee) side of each bank, поз. 30 exhaust manifolds along the outer side, поз. 7 two
   turbochargers at the rear (ghost volutes, solid rotor: compressor and turbine wheels on one
   shaft), and the pipes between them. Returns the flow paths the gas module animates. */
(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};
const V3 = THREE.Vector3;

// bladed wheel: lathe hub + thin blades from a meridional (r, y) outline, leaned with height
function wheel(blades, hubPts, bladePts, lean, yMax) {
  const parts = [G.lathe(hubPts, 48)];
  const shape = G.shapeFromPts(bladePts);
  for (let k = 0; k < blades; k++) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -0.8);
    const p = g.attributes.position, a0 = k / blades * Math.PI * 2;
    for (let i = 0; i < p.count; i++) {
      const r = p.getX(i), y = p.getY(i), t = p.getZ(i), a = a0 + lean * (y / yMax);
      p.setXYZ(i, r * Math.cos(a) - t * Math.sin(a), y, r * Math.sin(a) + t * Math.cos(a));
    }
    g.computeVertexNormals();
    parts.push(g);
  }
  return G.merge(parts);
}

BUILD_V8.air = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { objects: [], spins: [], flows: { intake: [], exhaust: [] } };
  const ghost = (geo, key, part, edgeAngle) => {
    const m = new THREE.Mesh(geo, MM.ghost[key]); m.renderOrder = 2; ctx.tag(m, part, 'air');
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeAngle || 30), MM.ghostEdges[key]); e.renderOrder = 3; e.userData.pickable = false; ctx.tag(e, part, 'air');
    out.objects.push(m, e);
  };
  const solid = (geo, mat, part) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, 'air'); m.castShadow = m.receiveShadow = true; return m; };
  const curve = pts => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const tube = (pts, r, seg) => new THREE.TubeGeometry(curve(pts), seg || 48, r, 16, false);
  const alongZ = (geo, z) => { geo.rotateX(Math.PI / 2); geo.translate(XT, YT, z); return geo; };
  // turbo layout (|Z| from the engine's centre plane): compressor wheel back at 135, its volute
  // round 137; core 163…210; turbine wheel back at 230, volute round 238, outlet 262…312
  const XT = 585, YT = 470, ZC = 135, ZTW = 230, ZTV = 238;
  out.turbo = { x: XT, y: YT };

  for (const bank of ['R', 'L']) {
    const sz = bank === 'R' ? -1 : 1, c0 = bank === 'R' ? 0 : 4;
    const pI = E.bankPoint(c0, 0, 468, 172), pE = E.bankPoint(c0, 0, 466, -128);
    const YI = pI[1], ZI = pI[2], YE = pE[1], ZE = pE[2];

    /* поз. 29 intake manifold: tube along the bank, closed at the front, flanges to each port */
    const imGeo = G.merge([G.cylX(30, -350, 350, 32, true), G.cylX(30, -356, -350, 32)]);
    imGeo.translate(0, YI, ZI);
    const flanges = [];
    for (let k = 0; k < 4; k++) {
      const c = c0 + k, q = BUILD_V8.bankQuat(E, c), C = E.cyl[c];
      const f = new THREE.BoxGeometry(46, 46, 6); f.translate(-54, 468, 143); G.applyQ(f, q); f.translate(C.x, 0, 0); flanges.push(f);
    }
    ghost(G.merge([imGeo, ...flanges]), 'intake', 'intake', 35);

    /* поз. 30 exhaust manifold + pipe round the back up to the turbine inlet */
    const em = G.cylX(28, -320, 330, 32, true); em.translate(0, YE, ZE);
    const capF = G.cylX(28, -326, -320, 32); capF.translate(0, YE, ZE);
    const ef = [];
    for (let k = 0; k < 4; k++) {
      const c = c0 + k, q = BUILD_V8.bankQuat(E, c), C = E.cyl[c];
      const f = new THREE.BoxGeometry(40, 40, 6); f.translate(34, 466, -97); G.applyQ(f, q); f.translate(C.x, 0, 0); ef.push(f);
    }
    const exPipePts = [new V3(320, YE, ZE), new V3(372, YE + 12, ZE - sz * 6), new V3(450, 300, sz * 380), new V3(520, 360, sz * 320),
      new V3(556, 392, sz * (ZTV + 8)), new V3(XT - 8, YT - 60, sz * ZTV)];
    ghost(G.merge([em, capF, ...ef, tube(exPipePts, 26, 64)]), 'exhaust', 'exhaust', 35);
    const downPts = [new V3(XT, YT, sz * 312), new V3(XT, YT - 30, sz * 334), new V3(XT + 40, YT - 130, sz * 346)];
    ghost(tube(downPts, 30, 24), 'exhaust', 'exhaust', 40);

    /* поз. 7 turbocharger: ghost volutes + compressor outlet pipe to the manifold */
    const comp = new THREE.TorusGeometry(66, 25, 14, 48); comp.translate(XT, YT, sz * (ZC + 2));
    const compBack = alongZ(G.lathe([[0, -5], [72, -5], [72, 5], [0, 5]], 48), sz * (ZC + 9));
    const inlet = alongZ(new THREE.CylinderGeometry(36, 36, 52, 32, 1, true), sz * (ZC - 34));
    const turb = new THREE.TorusGeometry(60, 27, 14, 48); turb.translate(XT, YT, sz * ZTV);
    const tOut = alongZ(new THREE.CylinderGeometry(34, 34, 50, 32, 1, true), sz * 287);
    const coPts = [new V3(XT + 6, YT + 66, sz * (ZC + 2)), new V3(XT - 50, YT + 74, sz * (ZC + 10)), new V3(470, YI + 50, sz * 190),
      new V3(380, YI + 6, ZI), new V3(352, YI, ZI)];
    ghost(G.merge([comp, compBack, inlet, turb, tOut, tube(coPts, 25, 56)]), 'turbo', 'turbo', 40);
    out.objects.push(solid(G.merge([
      alongZ(new THREE.CylinderGeometry(34, 34, 47, 32), sz * 186.5),                      // bearing housing
      (() => { const g = new THREE.CylinderGeometry(9, 9, 60, 12); g.translate(XT, YT - 54, sz * 186.5); return g; })(),   // oil drain
      (() => { const g = new THREE.CylinderGeometry(5, 5, 50, 12); g.translate(XT + 18, YT + 50, sz * 186.5); return g; })(),  // oil feed
    ]), M.turboCore, 'turbo'));

    // rotor in its own frame: +Y along the shaft from the compressor towards the turbine
    const holder = new THREE.Group();
    holder.position.set(XT, YT, sz * ZC);
    holder.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(0, 0, sz));
    const spin = new THREE.Group(); holder.add(spin);
    const cw = wheel(11, [[0, 0], [44, 0], [44, 3], [26, 10], [13, 25], [9, 34], [0, 34]],
      [[42, 3], [42, 11], [33, 21], [27, 34], [10, 34], [13, 25.5], [25, 10.5]], -0.7, 34);
    cw.rotateX(Math.PI);                                                                   // inducer faces the air inlet
    const tw = wheel(12, [[0, 0], [40, 0], [40, 3], [22, 12], [11, 26], [9, 30], [0, 30]],
      [[38, 3], [38, 10], [30, 20], [26, 30], [10, 30], [12, 25], [22, 11.5]], 0.45, 30);
    tw.translate(0, ZTW - ZC, 0);
    spin.add(solid(cw, M.compWheel, 'turbo'), solid(tw, M.turbineWheel, 'turbo'));
    spin.add(solid(G.merge([(() => { const g = new THREE.CylinderGeometry(6, 6, ZTW - ZC + 30, 16); g.translate(0, (ZTW - ZC) / 2, 0); return g; })(),
      (() => { const g = G.hexPrism(12, 8); g.rotateX(Math.PI); g.translate(0, -34, 0); return g; })()]), MM.hw.steel, 'turbo'));
    out.objects.push(holder);
    out.spins.push(spin);

    /* flow paths for the particles */
    out.flows.intake.push(curve([new V3(XT - 150, YT + 150, 0), new V3(XT - 60, YT + 138, 0), new V3(XT, YT + 96, 0), new V3(XT, YT + 22, sz * 12),
      new V3(XT, YT, sz * 64), new V3(XT, YT, sz * (ZC - 30)), new V3(XT, YT + 34, sz * (ZC - 2)), ...coPts,
      new V3(250, YI, ZI), new V3(-340, YI, ZI)]));
    out.flows.exhaust.push(curve([new V3(-310, YE, ZE), new V3(200, YE, ZE), ...exPipePts, new V3(XT, YT - 22, sz * ZTV),
      new V3(XT, YT, sz * 262), ...downPts]));
  }

  /* air inlet crossover between the two compressors, riser to the air cleaner */
  ghost(G.merge([
    alongZ(new THREE.CylinderGeometry(36, 36, 2 * (ZC - 60), 32, 1, true), 0),
    tube([new V3(XT, YT + 20, 0), new V3(XT, YT + 96, 0), new V3(XT - 60, YT + 138, 0), new V3(XT - 150, YT + 150, 0)], 38, 32),
  ]), 'intake', 'intake', 40);

  out.update = function (theta) {
    // the real rotor turns 40–50× faster than the crank; on screen it is slowed far more
    out.spins.forEach(s => { s.rotation.y = 6 * theta; });
  };
  return out;
};
})();
