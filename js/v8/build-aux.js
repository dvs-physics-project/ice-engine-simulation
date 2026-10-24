(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};
const V3 = THREE.Vector3;

function vPulley(Rp, hubR, boreR) {
  const top = Rp + 6, bot = Rp - 5, pv = [[boreR, -22], [hubR, -22], [hubR, -18], [top - 4, -18], [top, -17], [top, -15.5]];
  for (const yc of [-8, 8]) pv.push([top, yc - 7.5], [bot, yc - 2.5], [bot, yc + 2.5], [top, yc + 7.5]);
  pv.push([top, 15.5], [top, 17], [top - 4, 18], [hubR, 18], [hubR, 22], [boreR, 22], [boreR, -22]);
  const g = G.lathe(pv, 72, 0, undefined, true); G.toX(g);
  return g;
}

function vBeltGeo(E, path, x0) {
  const n = Math.round(path.length / 3), sec = [[-3, -3.4], [-3, 3.4], [5.5, 7.3], [5.5, -7.3]];
  const pos = [], idx = [];
  const ring = [];
  for (let k = 0; k < n; k++) {
    const q = E.beltSample(path, k / n * path.length), nu = q.tv, nv = -q.tu;
    ring.push(sec.map(([r, x]) => [x0 + x, q.u + nu * r, q.v + nv * r]));
  }
  for (let f = 0; f < 4; f++) {
    const base = pos.length / 3, a = f, b = (f + 1) % 4;
    for (let k = 0; k < n; k++) {
      const A = ring[k][a], B = ring[k][b];
      pos.push(...A, ...B);
    }
    for (let k = 0; k < n; k++) {
      const i0 = base + k * 2, i1 = base + ((k + 1) % n) * 2;
      idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

BUILD_V8.aux = function (ctx) {
  const E = ctx.E, MM = ctx.M, M = MM.mat;
  const out = { objects: [], crankChildren: [] };
  const solid = (geo, mat, part, layer) => { const m = new THREE.Mesh(geo, mat); ctx.tag(m, part, layer || 'aux'); m.castShadow = m.receiveShadow = true; return m; };
  const ghostOf = (geo, key, part, layer) => {
    const m = new THREE.Mesh(geo, MM.ghost[key]); m.renderOrder = 2; ctx.tag(m, part, layer || 'aux');
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), MM.ghostEdges[key]); e.renderOrder = 3; e.userData.pickable = false; ctx.tag(e, part, layer || 'aux');
    out.objects.push(m, e);
  };
  const fan = E.vbelt.find(p => p.key === 'fan'), alt = E.vbelt.find(p => p.key === 'alt'), crk = E.vbelt.find(p => p.key === 'crank');

  const fanIn = new THREE.Group(), fanOut = new THREE.Group();
  fanIn.position.set(0, fan.u, fan.v); fanOut.position.set(0, fan.u, fan.v);
  const inPul = vPulley(fan.R, 34, 18); inPul.translate(E.beltX, 0, 0);
  fanIn.add(solid(inPul, M.coupling, 'fan'));
  fanIn.add(solid(G.tubeX(18, 30, E.beltX + 22, -420, 32), M.coupling, 'fan'));
  const housing = new THREE.Group(); housing.position.copy(fanIn.position);
  const hGeo = G.lathe([[30, 0], [96, 0], [110, 10], [110, 62], [96, 72], [30, 72], [30, 0]], 72, 0, undefined, true);
  G.toX(hGeo); hGeo.translate(-446, 0, 0);
  const ribsGeo = [];
  for (let k = 0; k < 18; k++) { const r = new THREE.BoxGeometry(52, 6, 4); r.translate(-410, 113, 0); r.rotateX(k / 18 * Math.PI * 2); ribsGeo.push(r); }
  housing.add(solid(G.merge([hGeo, ...ribsGeo]), M.coupling, 'fan'));
  fanOut.add(solid(G.merge([G.cylX(16, -580, E.beltX - 22, 24), G.lathe([[0, 0], [62, 0], [66, 6], [66, 26], [40, 30], [0, 30]], 48)
    .rotateZ(-Math.PI / 2).translate(-606, 0, 0)]), M.fanHub, 'fan'));
  const blades = [];
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-44, 70); bladeShape.lineTo(52, 70); bladeShape.quadraticCurveTo(80, 180, 92, 280);
  bladeShape.quadraticCurveTo(40, 304, -40, 286); bladeShape.quadraticCurveTo(-58, 180, -44, 70);
  for (let k = 0; k < 8; k++) {
    const g = new THREE.ExtrudeGeometry(bladeShape, { depth: 3, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1, curveSegments: 12 });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const c = p.getX(i), r = p.getY(i), t = p.getZ(i) - 1.5, ph = (30 - 13 * (r - 70) / 230) * Math.PI / 180;
      p.setXYZ(i, t * Math.cos(ph) - c * Math.sin(ph) - 592, r, c * Math.cos(ph) + t * Math.sin(ph));
    }
    g.computeVertexNormals();
    g.rotateX(k / 8 * Math.PI * 2);
    blades.push(g);
  }
  const spider = G.lathe([[60, 0], [96, 0], [96, 3], [60, 3]], 48, 0, undefined, true); G.toX(spider); spider.translate(-578, 0, 0);
  fanOut.add(solid(G.merge([...blades, spider]), M.fanBlade, 'fan'));
  out.objects.push(fanIn, fanOut, housing);

  const path = E.beltPath(E.vbelt);
  out.beltPath = path;
  const bm = M.vbelt;
  out.objects.push(solid(G.merge([vBeltGeo(E, path, E.beltX - 8), vBeltGeo(E, path, E.beltX + 8)]), bm, 'belt'));
  const markGeo = new THREE.BoxGeometry(11, 1.2, 9);
  const marks = new THREE.InstancedMesh(markGeo, new THREE.MeshStandardMaterial({ color: MM.srgb('#c9cdd2'), roughness: 0.7, metalness: 0 }), 24);
  marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ctx.tag(marks, 'belt', 'aux');
  out.objects.push(marks);

  const altSpin = new THREE.Group(); altSpin.position.set(0, alt.u, alt.v);
  const ap = vPulley(alt.R, 16, 8); ap.translate(E.beltX, 0, 0);
  const altFan = [];
  for (let k = 0; k < 12; k++) { const b = new THREE.BoxGeometry(10, 26, 2.2); b.translate(E.beltX + 34, 50, 0); b.rotateX(k / 12 * Math.PI * 2); altFan.push(b); }
  altFan.push(G.tubeX(14, 66, E.beltX + 28, E.beltX + 30, 48));
  const nut = G.hexPrism(19, 8); G.toX(nut); nut.translate(E.beltX - 30, 0, 0);
  altSpin.add(solid(G.merge([ap, nut]), M.altPulley, 'alternator'), solid(G.merge(altFan), M.altBody, 'alternator'));
  const altBody = new THREE.Group(); altBody.position.copy(altSpin.position);
  const body = G.lathe([[0, 0], [60, 0], [70, 8], [72, 20], [72, 66], [66, 76], [20, 80], [0, 80]], 64, 0, undefined, true);
  G.toX(body); body.translate(E.beltX + 40, 0, 0);
  const finsG = [];
  for (let k = 0; k < 24; k++) { const b = new THREE.BoxGeometry(46, 4, 3); b.translate(E.beltX + 72, 72.5, 0); b.rotateX(k / 24 * Math.PI * 2); finsG.push(b); }
  const lug = new THREE.BoxGeometry(24, 30, 40); lug.translate(E.beltX + 60, 82, 0);
  const term = G.lathe([[0, 0], [5, 0], [5, 12], [0, 12]], 12); G.toX(term); term.translate(E.beltX + 120, 30, 20);
  altBody.add(solid(G.merge([body, ...finsG, lug, term]), M.altBody, 'alternator'));
  out.objects.push(altSpin, altBody);

  const sY = -120, sZ = -237;
  const st = G.merge([
    (() => { const g = G.lathe([[0, 0], [52, 0], [55, 4], [55, 150], [50, 156], [0, 156]], 48); G.toX(g); g.translate(195, sY, sZ); return g; })(),
    (() => { const g = G.lathe([[0, 0], [44, 0], [44, 30], [30, 34], [22, 34], [0, 34]], 40); G.toX(g); g.translate(350, sY, sZ); return g; })(),
    (() => { const g = G.cylX(29, 214, 330, 36); g.translate(0, sY + 78, sZ); return g; })(),
    (() => { const b = new THREE.BoxGeometry(18, 120, 40); b.translate(360, sY + 40, sZ + 30); return b; })(),
  ]);
  out.objects.push(solid(st, M.starterBody, 'starter'));
  const pinion = G.extrudeX(G.involuteGearShape(11, 3.25, { phase: 0, holes: [G.circlePath(0, 0, 8, true)] }), 384, 398, { curveSegments: 12 });
  pinion.translate(0, sY, sZ);
  out.objects.push(solid(pinion, MM.hw.steel, 'starter'));

  const fy = E.front.oilPumpY, fz = E.front.gearZ;
  const drvPhase = E.meshPhase(E.front.crankPhase || 0, fz, { y: 0, zc: 0 }, { y: fy, zc: 0 }, fz);
  const oilDrive = new THREE.Group(); oilDrive.position.set(0, fy, 0);
  oilDrive.add(solid(BUILD_V8.gearGeo(fz, E.module, drvPhase, E.front.gearX - 10, E.front.gearX + 10, { bore: 10, holes: 5, holeR: 16, holeAt: 60 }), M.oilGear, 'oilPump'));
  const pz = 10, pm = 3, pr = pm * pz / 2;
  oilDrive.add(solid(G.merge([G.cylX(10, E.front.gearX - 14, -316, 20),
    G.extrudeX(G.involuteGearShape(pz, pm, { phase: 0, holes: [G.circlePath(0, 0, 9.9, true)] }), -352, -322, { curveSegments: 10 })]), M.oilGear, 'oilPump'));
  const oilIdle = new THREE.Group(); oilIdle.position.set(0, fy, 2 * pr);
  const idlePhase = E.meshPhase(0, pz, { y: 0, zc: 0 }, { y: 0, zc: 2 * pr }, pz);
  oilIdle.add(solid(G.extrudeX(G.involuteGearShape(pz, pm, { phase: idlePhase, holes: [G.circlePath(0, 0, 6, true)] }), -352, -322, { curveSegments: 10 }), M.oilGear, 'oilPump'));
  out.objects.push(oilDrive, oilIdle);
  const pbg = new THREE.ExtrudeGeometry(G.roundRect(84, 56, 16), { depth: 38, bevelEnabled: false, curveSegments: 8 });
  pbg.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  pbg.translate(-356, fy, pr);
  ghostOf(pbg, 'oilpump', 'oilPump');
  const pickCurve = new THREE.CatmullRomCurve3([new V3(-337, fy - 33, pr), new V3(-337, fy - 80, pr), new V3(-318, -320, 8),
    new V3(-260, -338, 0), new V3(-200, -338, 0), new V3(-175, -338, 0)], false, 'centripetal');
  const strainer = G.lathe([[10, 0], [16, -4], [52, -10], [55, -14], [55, -18], [0, -18]], 56, 0, undefined, true);
  strainer.translate(-175, -334, 0);
  const meshDisc = G.lathe([[0, 0], [54, 0], [54, 0.8], [0, 0.8]], 56, 0, undefined, true); meshDisc.translate(-175, -352.6, 0);
  out.objects.push(solid(new THREE.TubeGeometry(pickCurve, 64, 11, 14, false), M.pickup, 'pickup'),
    solid(G.merge([strainer, meshDisc]), M.strainer, 'pickup'));

  const m4 = new THREE.Matrix4(), bx = new V3(1, 0, 0), by = new V3(), bz = new V3(), p0 = new V3();
  out.update = function (theta) {
    const sBelt = theta * crk.R;
    fanIn.rotation.x = sBelt / fan.R;
    fanOut.rotation.x = E.fanSlip * sBelt / fan.R;
    altSpin.rotation.x = sBelt / alt.R;
    oilDrive.rotation.x = -theta;
    oilIdle.rotation.x = theta;
    for (let j = 0; j < 24; j++) {
      const belt = j % 2, q = E.beltSample(path, (j >> 1) / 12 * path.length + sBelt);
      by.set(0, q.tv, -q.tu); bz.set(0, q.tu, q.tv);
      m4.makeBasis(bx, by, bz);
      p0.set(E.beltX + (belt ? 8 : -8), q.u + q.tv * 5.6, q.v - q.tu * 5.6);
      m4.setPosition(p0);
      marks.setMatrixAt(j, m4);
    }
    marks.instanceMatrix.needsUpdate = true;
  };
  return out;
};
})();
