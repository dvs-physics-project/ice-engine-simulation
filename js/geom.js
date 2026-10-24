/* geom.js — geometry builders shared by every part module.
   Conventions: lathe & cylinder primitives are built along +Y and turned onto +X with toX();
   2-D profiles drawn in the (u,v) = (Y,Z) plane are extruded along X with extrudeX().
   Depends on THREE (r128) + THREE.BufferGeometryUtils. */
(function () {
'use strict';
const G = {};
const V3 = THREE.Vector3;

// Y-axis primitive → X axis (+Y maps to +X)
G.toX = geo => { geo.rotateZ(-Math.PI / 2); return geo; };
// r128 BufferGeometry has no applyQuaternion()
G.applyQ = (geo, q) => geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));

// shape (x,y,z) → world (X=z, Y=x, Z=y): a profile drawn in (u,v)=(Y,Z), extruded along X
const SHAPE_TO_YZ = new THREE.Matrix4().set(
  0, 0, 1, 0,
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 0, 1);
G.shapeToYZ = geo => geo.applyMatrix4(SHAPE_TO_YZ);

G.extrudeX = function (shape, x0, x1, opts) {
  const o = Object.assign({ depth: x1 - x0, bevelEnabled: false, curveSegments: 24 }, opts || {});
  if (o.bevelEnabled) o.depth = Math.max(0.01, (x1 - x0) - 2 * (o.bevelThickness || 0));
  const geo = new THREE.ExtrudeGeometry(shape, o);
  geo.translate(0, 0, x0 + (o.bevelEnabled ? (o.bevelThickness || 0) : 0));
  return G.shapeToYZ(geo);
};

// lathe from [r, y] pairs (axis Y). LatheGeometry smooths normals across shared profile
// points, which rounds off every machined shoulder; with sharp=true each interior point is
// doubled so neighbouring faces keep their own normals and edges stay crisp.
G.lathe = function (pts, seg, phiStart, phiLength, sharp) {
  let p2 = pts;
  if (sharp) {
    p2 = [];
    pts.forEach((p, k) => { p2.push(p); if (k > 0 && k < pts.length - 1) p2.push([p[0], p[1]]); });
  }
  return new THREE.LatheGeometry(p2.map(p => new THREE.Vector2(p[0], p[1])), seg || 48,
    phiStart || 0, phiLength === undefined ? Math.PI * 2 : phiLength);
};

// solid cylinder along X from x0 to x1
G.cylX = function (r, x0, x1, seg, open) {
  const geo = new THREE.CylinderGeometry(r, r, x1 - x0, seg || 32, 1, !!open);
  G.toX(geo); geo.translate((x0 + x1) / 2, 0, 0);
  return geo;
};
// tube (annulus) along X, inner radius ri, outer ro
G.tubeX = function (ri, ro, x0, x1, seg) {
  const geo = G.lathe([[ri, 0], [ro, 0], [ro, x1 - x0], [ri, x1 - x0], [ri, 0]], seg || 40, 0, undefined, true);
  G.toX(geo); geo.translate(x0, 0, 0);
  return geo;
};
// generic cylinder between two points
G.cylBetween = function (r, a, b, seg) {
  const d = new V3().subVectors(b, a), len = d.length();
  const geo = new THREE.CylinderGeometry(r, r, len, seg || 16);
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
  G.applyQ(geo, q);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
};
G.hexPrism = function (acrossFlats, h) {         // axis Y, base at y=0
  const R = acrossFlats / Math.sqrt(3);
  const geo = new THREE.CylinderGeometry(R, R, h, 6, 1);
  geo.translate(0, h / 2, 0);
  return geo;
};
// rounded box (soft-edged block) via extruded rounded rectangle, profile in (x,y), depth z
G.roundRect = function (w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
G.circlePath = function (cx, cy, r, ccw) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, !!ccw);
  return p;
};
G.shapeFromPts = function (pts) {               // pts: [[x,y],…] closed polygon
  const s = new THREE.Shape();
  pts.forEach((p, k) => k ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
  s.closePath();
  return s;
};
// smooth closed shape through points (Catmull-Rom sampled)
G.smoothShape = function (pts, samples) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(p[0], p[1], 0)), true, 'centripetal');
  const sp = curve.getSpacedPoints(samples || 160);
  sp.pop();
  return G.shapeFromPts(sp.map(p => [p.x, p.y]));
};

// helical coil spring, axis +Y from y=wireR to y=height−wireR, closed & ground end coils.
// Built at its real installed height: compression is then a mild per-instance Y scale
// (≥0.8), which keeps the wire section and normals close to true.
G.coilSpring = function (meanR, wireR, activeTurns, height, handed, radialSeg, perTurn) {
  const endTurns = 0.85, total = activeTurns + 2 * endTurns, h = handed || 1;
  const wire = wireR * 2, hEnd = endTurns * wire * 1.05;
  const curve = new THREE.Curve();
  curve.getPoint = function (t, target) {
    const turn = t * total;
    let y;
    if (turn < endTurns) y = turn / endTurns * hEnd;
    else if (turn > total - endTurns) y = (height - 2 * wireR) - (total - turn) / endTurns * hEnd;
    else y = hEnd + (turn - endTurns) / activeTurns * ((height - 2 * wireR) - 2 * hEnd);
    const a = turn * Math.PI * 2;
    return (target || new V3()).set(meanR * Math.cos(a), y + wireR, h * meanR * Math.sin(a));
  };
  return new THREE.TubeGeometry(curve, Math.round(total * (perTurn || 24)), wireR, radialSeg || 7, false);
};

// toothed belt pulley outline (outward grooves for an HTD-style belt), in the shape plane
G.timingPulleyShape = function (z, pitchR, opts) {
  const o = Object.assign({ backOff: 0.7, grooveDepth: 3.6, grooveW: 5.4, holes: [], phase: 0 }, opts || {});
  const Ro = pitchR - o.backOff, Rg = Ro - o.grooveDepth;
  const s = new THREE.Shape(), n = z, step = Math.PI * 2 / n;
  const halfG = (o.grooveW / 2) / Ro;                  // groove half-width (angle at the OD)
  const pts = [];
  for (let k = 0; k < n; k++) {
    const c = o.phase + k * step;                      // groove centre
    // land from previous groove end to this groove start
    const g0 = c - halfG, g1 = c + halfG;
    pts.push([Ro * Math.cos(g0 - 0.04 * step), Ro * Math.sin(g0 - 0.04 * step)]);
    // rounded groove: semicircle-ish bottom
    for (let m = 0; m <= 6; m++) {
      const t = m / 6, a = g0 + (g1 - g0) * t;
      const depth = Math.sin(Math.PI * t);
      const rr = Ro - (Ro - Rg) * Math.pow(depth, 0.55);
      pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    pts.push([Ro * Math.cos(g1 + 0.04 * step), Ro * Math.sin(g1 + 0.04 * step)]);
  }
  pts.forEach((p, k) => k ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
  s.closePath();
  o.holes.forEach(h => s.holes.push(h));
  return s;
};

// starter ring gear (outward involute-ish teeth)
G.ringGearShape = function (z, rootR, tipR, innerR) {
  const s = new THREE.Shape(), step = Math.PI * 2 / z, pts = [];
  for (let k = 0; k < z; k++) {
    const a = k * step;
    pts.push([rootR * Math.cos(a), rootR * Math.sin(a)]);
    pts.push([rootR * Math.cos(a + step * 0.18), rootR * Math.sin(a + step * 0.18)]);
    pts.push([tipR * Math.cos(a + step * 0.34), tipR * Math.sin(a + step * 0.34)]);
    pts.push([tipR * Math.cos(a + step * 0.62), tipR * Math.sin(a + step * 0.62)]);
    pts.push([rootR * Math.cos(a + step * 0.78), rootR * Math.sin(a + step * 0.78)]);
  }
  pts.forEach((p, k) => k ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
  s.closePath();
  s.holes.push(G.circlePath(0, 0, innerR, true));
  return s;
};

// lobed outline r(φ) = R0 + A·f(cos(nφ)) for gerotor rotors (smooth, convex lobes)
G.lobedShape = function (n, R0, A, samples, holeR) {
  const s = new THREE.Shape(), N = samples || 240;
  for (let k = 0; k < N; k++) {
    const t = k / N * Math.PI * 2;
    const c = Math.cos(n * t);
    const r = R0 + A * (c >= 0 ? Math.pow(c, 0.7) : -Math.pow(-c, 1.4));
    const x = r * Math.cos(t), y = r * Math.sin(t);
    k ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  if (holeR) s.holes.push(G.circlePath(0, 0, holeR, true));
  return s;
};

// involute spur gear outline (shape plane), teeth centred at phase + 2πk/z. Profile from the
// base circle (radial below it, down to the root circle) up to the tip, root arcs between.
G.involuteGearShape = function (z, m, opts) {
  const o = Object.assign({ alpha: 20 * Math.PI / 180, phase: 0, holes: [], backlash: 0.05 }, opts || {});
  const R = m * z / 2, Rb = R * Math.cos(o.alpha), Ra = R + m, Rf = R - 1.25 * m;
  const inv = a => Math.tan(a) - a;
  const half = Math.PI / (2 * z) - o.backlash / R;
  const r0 = Math.max(Rb, Rf), N = 7, flank = [];
  for (let i = 0; i <= N; i++) {
    const r = r0 + (Ra - r0) * i / N, ar = Math.acos(Math.min(1, Rb / r));
    flank.push([r, half + inv(o.alpha) - inv(ar)]);
  }
  const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const pts = [];
  for (let k = 0; k < z; k++) {
    const c = o.phase + k * 2 * Math.PI / z;
    if (Rf < r0 - 0.01) pts.push(P(Rf, c - flank[0][1]));
    for (let i = 0; i <= N; i++) pts.push(P(flank[i][0], c - flank[i][1]));
    for (let i = N; i >= 0; i--) pts.push(P(flank[i][0], c + flank[i][1]));
    if (Rf < r0 - 0.01) pts.push(P(Rf, c + flank[0][1]));
    const a0 = c + flank[0][1], a1 = c + 2 * Math.PI / z - flank[0][1];
    for (let j = 1; j < 4; j++) pts.push(P(Rf, a0 + (a1 - a0) * j / 4));
  }
  const s = new THREE.Shape();
  pts.forEach((p, k) => k ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
  s.closePath();
  o.holes.forEach(h => s.holes.push(h));
  return s;
};

// merge geometries of mixed index state (BufferGeometryUtils needs them uniform)
G.merge = function (list) {
  const prepared = list.filter(Boolean).map(g => {
    let geo = g.index ? g.toNonIndexed() : g;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    // keep only position/normal/uv so attribute sets match
    Object.keys(geo.attributes).forEach(k => { if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k); });
    geo.clearGroups();
    return geo;
  });
  const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(prepared, false);
  return merged;
};

window.G = G;
})();
