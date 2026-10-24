/* b4/build-gas.js — the working gas: each cylinder's charge between the piston crown and the pent
   roof (colour = temperature, density = pressure), the spark at the plug gap at 10° before TDC,
   the flame that follows, and flow particles: throttle → plenum → runner → port → valve throat,
   and valve throat → exhaust port → downpipe → collector. A particle advances only while — and
   as fast as — the real valve lift lets the gas through; motion follows Δθ, so scrubbing the
   crank backwards runs the flow backwards. */
(function () {
'use strict';
window.BUILD_B4 = window.BUILD_B4 || {};
const V3 = THREE.Vector3;

const TEMP = [[300, [60, 110, 210]], [700, [70, 200, 255]], [1200, [255, 220, 90]], [1800, [255, 130, 40]], [2600, [255, 246, 232]]];
function tempRGB(T) {
  T = Math.max(TEMP[0][0], Math.min(TEMP[TEMP.length - 1][0], T));
  for (let i = 0; i < TEMP.length - 1; i++) {
    const [t0, c0] = TEMP[i], [t1, c1] = TEMP[i + 1];
    if (T <= t1) { const f = (T - t0) / (t1 - t0); return c0.map((c, k) => (c + (c1[k] - c) * f) / 255); }
  }
  return TEMP[TEMP.length - 1][1].map(c => c / 255);
}
function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

BUILD_B4.gas = function (ctx, vt, air, sparkTips) {
  const E = ctx.E, DEG = Math.PI / 180;
  const out = { chambers: [], objects: [] };

  /* ---------- chambers, in the bank frame: top cap on the pent roof, wall, floor on the crown ---------- */
  const R = E.bore / 2 - 0.4, K = 56, RINGS = 6;
  const tI = Math.tan(E.vt.in.angle), tE = Math.tan(E.vt.ex.angle);
  const roof = s => Math.max(E.fireFace, E.ridgeA - (s >= 0 ? s * tI : -s * tE));
  for (let c = 0; c < 4; c++) {
    const pos = [], idx = [], floor = [];
    const push = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };
    const top = [], cTop = push(0, roof(0), 0);
    for (let r = 1; r <= RINGS; r++) {
      const row = [];
      for (let k = 0; k < K; k++) { const a = k / K * Math.PI * 2, rr = R * r / RINGS, s = rr * Math.sin(a); row.push(push(rr * Math.cos(a), roof(s), s)); }
      top.push(row);
    }
    for (let k = 0; k < K; k++) idx.push(cTop, top[0][k], top[0][(k + 1) % K]);
    for (let r = 0; r < RINGS - 1; r++) for (let k = 0; k < K; k++) {
      const a = top[r][k], b = top[r][(k + 1) % K], cc = top[r + 1][k], d = top[r + 1][(k + 1) % K];
      idx.push(a, cc, d, a, d, b);
    }
    const wallTop = top[RINGS - 1], wallBot = [];
    for (let k = 0; k < K; k++) { const a = k / K * Math.PI * 2; const v = push(R * Math.cos(a), E.fireFace - 20, R * Math.sin(a)); wallBot.push(v); floor.push(v); }
    for (let k = 0; k < K; k++) { const a = wallTop[k], b = wallTop[(k + 1) % K], cc = wallBot[k], d = wallBot[(k + 1) % K]; idx.push(a, d, cc, a, b, d); }
    const cBot = push(0, E.fireFace - 20, 0); floor.push(cBot);
    for (let k = 0; k < K; k++) idx.push(cBot, wallBot[(k + 1) % K], wallBot[k]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a7ad0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4; mesh.frustumCulled = false;
    mesh.position.set(E.cyl[c].x, 0, 0); mesh.quaternion.copy(BUILD_B4.bankQuat(E, c));
    ctx.tag(mesh, 'gas:' + c, 'gas');
    out.objects.push(mesh);
    out.chambers.push({ mesh, geo, mat, floor, state: null });
  }

  /* ---------- spark at the plug gap, flame kernel, one shared flash light ---------- */
  const sparkTex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(190,220,255,0.9)'], [0.6, 'rgba(120,160,255,0.25)'], [1, 'rgba(120,160,255,0)']]);
  const flameTex = glowTexture([[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,190,90,0.85)'], [0.7, 'rgba(255,110,40,0.3)'], [1, 'rgba(255,90,30,0)']]);
  const sprite = (tex, p, c) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    s.position.copy(p); s.renderOrder = 6; s.userData.pickable = false; ctx.tag(s, 'gas:' + c, 'gas'); out.objects.push(s); return s;
  };
  out.sparks = sparkTips.map((p, c) => sprite(sparkTex, p, c));
  out.flames = sparkTips.map((p, c) => { const A = E.axisOf(c); return sprite(flameTex, p.clone().add(new V3(0, -A.y * 7, -A.z * 7)), c); });
  out.flash = new THREE.PointLight(0xffb066, 0, 340, 2);
  out.objects.push(out.flash);

  /* ---------- flow particles ---------- */
  const parts = [], rnd = s => (Math.random() - 0.5) * s;
  for (let c = 0; c < 4; c++) for (let j = 0; j < 2; j++) {
    for (let k = 0; k < 9; k++) parts.push({ kind: 'in', c, j, curve: vt.ports.in[c][j], t: (k + Math.random() * 0.6) / 9, jit: new V3(rnd(7), rnd(7), rnd(7)) });
    for (let k = 0; k < 8; k++) parts.push({ kind: 'ex', c, j, curve: vt.ports.ex[c][j], t: (k + Math.random() * 0.6) / 8, jit: new V3(rnd(6), rnd(6), rnd(6)) });
  }
  for (let c = 0; c < 4; c++) {
    for (let k = 0; k < 22; k++) parts.push({ kind: 'run', c, curve: air.flows.intake[c], t: (k + Math.random() * 0.7) / 22, jit: new V3(rnd(16), rnd(16), rnd(16)) });
    for (let k = 0; k < 36; k++) parts.push({ kind: 'pipe', c, curve: air.flows.exhaust[c], t: (k + Math.random() * 0.7) / 36, jit: new V3(rnd(16), rnd(16), rnd(16)) });
  }
  for (let k = 0; k < 40; k++) parts.push({ kind: 'thr', curve: air.flows.throttle, t: (k + Math.random() * 0.7) / 40, jit: new V3(rnd(30), rnd(30), rnd(46)) });
  const lens = new Map();
  parts.forEach(q => { if (!lens.has(q.curve)) lens.set(q.curve, q.curve.getLength()); q.len = lens.get(q.curve); });
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(parts.length * 3), pCol = new Float32Array(parts.length * 3), pA = new Float32Array(parts.length);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(pA, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { size: { value: 8.0 }, scale: { value: 400 } },
    vertexShader: `attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float size; uniform float scale;
      void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard;
        gl_FragColor = vec4(vC, vA * (1.0 - r * 3.2)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.renderOrder = 5; points.frustumCulled = false;
  ctx.tag(points, 'flow', 'gas'); points.userData.pickable = false;
  out.points = points; out.objects.push(points);

  const tmp = new V3();
  const IN_COL = [0.45, 0.78, 1.0], EX_COL = [1.0, 0.55, 0.2], EX_COLD = [0.55, 0.5, 0.5];
  const lo = Math.log10(E.gas.Pin * 0.8), hi = Math.log10(E.P3);
  const sparkLen = 14, burn = 60;
  out.update = function (theta, dTheta) {
    const deg = theta / DEG;
    let flashI = 0, flashC = -1;
    for (let c = 0; c < 4; c++) {
      const k = E.kin(c, theta), ch = out.chambers[c], st = E.thermo(E.phaseOf(c, deg));
      const p = ch.geo.attributes.position;
      ch.floor.forEach(j => p.setY(j, k.crown + 0.25));
      p.needsUpdate = true; ch.geo.computeBoundingSphere();
      const col = tempRGB(st.T);
      ch.mat.color.setRGB(col[0], col[1], col[2]).convertSRGBToLinear();
      ch.mat.opacity = 0.16 + 0.5 * Math.max(0, Math.min(1, (Math.log10(st.P) - lo) / (hi - lo)));
      ch.state = st;
      // spark from E.spark for a few degrees; the flame kernel grows after it and burns into the expansion
      const d = st.phase - E.spark;
      const on = d >= 0 && d < sparkLen ? Math.pow(1 - d / sparkLen, 1.2) : 0;
      out.sparks[c].material.opacity = on; out.sparks[c].scale.setScalar(20 + 40 * on);
      const f = d - 4, fl = f >= 0 && f < burn ? Math.sin(Math.PI * Math.min(1, f / burn)) * (1 - f / (burn * 1.3)) : 0;
      out.flames[c].material.opacity = Math.max(0, fl) * 0.95;
      out.flames[c].scale.setScalar(18 + 64 * Math.min(1, Math.max(0, f) / 30));
      const kk = Math.max(on, fl * 0.8);
      if (kk > flashI) { flashI = kk; flashC = c; }
    }
    out.flash.intensity = flashI * 3.0;
    if (flashC >= 0) out.flash.position.copy(out.flames[flashC].position);
    const Lf = vt.lifts, inMax = E.valveLiftMax.in, exMax = E.valveLiftMax.ex;
    let total = 0; for (let c = 0; c < 4; c++) total += Lf[c * 2] / inMax / 4;
    for (let j = 0; j < parts.length; j++) {
      const q = parts[j];
      let lift, speed, active, fade, col;
      if (q.kind === 'in' || q.kind === 'run') {
        lift = Lf[q.c * 2 + (q.j || 0)] / inMax;
        speed = (q.kind === 'in' ? 140 : 230) * lift; active = Math.min(1, lift * 5); col = IN_COL;
      } else if (q.kind === 'ex' || q.kind === 'pipe') {
        lift = Lf[8 + q.c * 2 + (q.j || 0)] / exMax;
        speed = (q.kind === 'ex' ? 180 : 320) * lift; active = Math.min(1, lift * 5); col = active > 0.05 ? EX_COL : EX_COLD;
      } else { speed = 120 + 420 * total; active = 0.35 + 0.65 * Math.min(1, total * 4); col = IN_COL; }
      q.t += speed * dTheta / q.len * 3;
      q.t -= Math.floor(q.t);
      fade = Math.min(1, q.t * 9) * Math.min(1, (1 - q.t) * 7);
      q.curve.getPointAt(q.t, tmp);
      pPos[j * 3] = tmp.x + q.jit.x * 0.6; pPos[j * 3 + 1] = tmp.y + q.jit.y * 0.6; pPos[j * 3 + 2] = tmp.z + q.jit.z * 0.6;
      pCol[j * 3] = col[0]; pCol[j * 3 + 1] = col[1]; pCol[j * 3 + 2] = col[2];
      pA[j] = fade * (0.15 + 0.85 * active);
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true;
  };
  return out;
};
})();
