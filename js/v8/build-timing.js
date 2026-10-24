/* v8/build-timing.js — the rear gear train (all spur, module 4, true involute teeth):
   поз. 14 crank gear z24 (built with the crankshaft), поз. 15 idler z30, поз. 16 camshaft gear
   z48, поз. 17 injection-pump drive gear z48. Every gear is cut with a tooth phase that puts a
   tooth of one gear into a gap of its mate (spec.js E.meshPhase), and turns at exactly
   −z_driver/z_driven of its driver, so the teeth stay meshed at every crank angle. */
(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};

BUILD_V8.timing = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat, g = E.gears;
  const out = { objects: [] };
  const w = E.gearW / 2;
  const solid = (geo, mat, part, layer) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, layer || 'gears'); m.castShadow = m.receiveShadow = true; return m; };

  /* поз. 15 idler on a stub axle bolted to the block's rear face */
  const idler = new THREE.Group();
  idler.position.set(E.gearX, g.idler.y, g.idler.zc);
  idler.add(solid(BUILD_V8.gearGeo(g.idler.z, E.module, g.idler.phase, -w, w, { bore: 22, holes: 5, holeR: 11, holeAt: 36 }), M.idlerGear, 'idlerGear'));
  idler.add(solid(G.tubeX(22, 30, -w - 2, w + 2, 40), M.idlerGear, 'idlerGear'));
  const axle = new THREE.Group();
  axle.position.copy(idler.position);
  axle.add(solid(G.merge([
    G.cylX(21.9, 360 - E.gearX, w + 3, 32),
    G.tubeX(8, 30, w + 3, w + 7, 40),
    (() => { const b = G.hexPrism(17, 7); G.toX(b); b.translate(w + 7, 0, 0); return b; })(),
  ]), MM.hw.steel, 'idlerGear'));
  out.idler = idler;
  out.objects.push(idler, axle);

  /* поз. 16 camshaft gear: added to the camshaft group (turns with it) */
  out.camGear = solid(BUILD_V8.gearGeo(g.cam.z, E.module, g.cam.phase, E.gearX - w, E.gearX + w,
    { bore: 20, holes: 6, holeR: 17, holeAt: 58 }), M.camGear, 'camGear');
  out.camGear.add(solid(G.tubeX(20, 34, E.gearX - w - 3, E.gearX + w + 1.5, 48), M.camGear, 'camGear'));

  /* поз. 17 injection-pump drive gear: added to the pump rotor */
  out.pumpGear = solid(BUILD_V8.gearGeo(g.pump.z, E.module, g.pump.phase, E.gearX - w, E.gearX + w,
    { bore: 16, holes: 6, holeR: 17, holeAt: 58 }), M.pumpGear, 'pumpGear');
  out.pumpGear.add(solid(G.merge([G.tubeX(16, 34, E.gearX - w - 6, E.gearX + w + 1.5, 48),
    (() => { const b = G.hexPrism(22, 8); G.toX(b); b.translate(E.gearX + w + 1.5, 0, 0); return b; })()]), M.pumpGear, 'pumpGear'));

  out.update = function (theta) {
    idler.rotation.x = E.gearRatio.idler * theta;
  };
  return out;
};
})();
