(function () {
'use strict';
window.BUILD_I4 = window.BUILD_I4 || {};
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
BUILD_I4.tempRGB = tempRGB;

BUILD_I4.gas = function (ctx, ports, sparkTips) {
  const E = ctx.E;
  const out = { chambers: [] };
  const R = E.bore / 2 - 0.4, K = 56, RINGS = 6;
  const roofY = z => E.seatY - (Math.abs(z) - E.seatZ) * Math.tan(E.valveAngle);

  for (let i = 0; i < 4; i++) {
    const pos = [], idx = [], bottomIdx = [];
    const push = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };
    const cx = E.cylX[i];
    const top = [];
    const cTop = push(cx, roofY(0), 0);
    for (let r = 1; r <= RINGS; r++) {
      const row = [];
      for (let k = 0; k < K; k++) { const a = k / K * Math.PI * 2, rr = R * r / RINGS, z = rr * Math.sin(a);
        row.push(push(cx + rr * Math.cos(a), roofY(z), z)); }
      top.push(row);
    }
    for (let k = 0; k < K; k++) idx.push(cTop, top[0][(k + 1) % K], top[0][k]);
    for (let r = 0; r < RINGS - 1; r++) for (let k = 0; k < K; k++) {
      const a = top[r][k], b = top[r][(k + 1) % K], c = top[r + 1][k], d = top[r + 1][(k + 1) % K];
      idx.push(a, b, d, a, d, c);
    }
    const wallTop = [], wallBot = [];
    for (let k = 0; k < K; k++) { const a = k / K * Math.PI * 2, z = R * Math.sin(a);
      wallTop.push(push(cx + R * Math.cos(a), roofY(z), z));
      const b = push(cx + R * Math.cos(a), 0, z); wallBot.push(b); bottomIdx.push(b); }
    for (let k = 0; k < K; k++) { const a = wallTop[k], b = wallTop[(k + 1) % K], c = wallBot[k], d = wallBot[(k + 1) % K];
      idx.push(a, c, d, a, d, b); }
    const cBot = push(cx, 0, 0); bottomIdx.push(cBot);
    for (let k = 0; k < K; k++) idx.push(cBot, wallBot[k], wallBot[(k + 1) % K]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a7ad0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    ctx.tag(mesh, 'gas:' + i, 'gas');
    out.chambers.push({ mesh, geo, mat, bottomIdx });
  }

  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(190,220,255,0.9)');
    gr.addColorStop(0.6, 'rgba(120,160,255,0.25)'); gr.addColorStop(1, 'rgba(120,160,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  })();
  out.sparks = sparkTips.map((p, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    s.position.copy(p); s.scale.set(26, 26, 1); s.renderOrder = 6;
    ctx.tag(s, 'gas:' + i, 'gas'); s.userData.pickable = false;
    return s;
  });
  const flameTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,190,90,0.85)');
    gr.addColorStop(0.7, 'rgba(255,110,40,0.3)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  out.flames = sparkTips.map((p, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(p).add(new V3(0, -6, 0)); s.renderOrder = 6;
    ctx.tag(s, 'gas:' + i, 'gas'); s.userData.pickable = false;
    return s;
  });
  out.flash = new THREE.PointLight(0xffb066, 0, 300, 2);

  const perBranch = { in: 16, ex: 14 };
  const parts = [];
  for (const side of ['in', 'ex']) for (let i = 0; i < 4; i++) for (let b = 0; b < 2; b++) {
    const curve = ports[side][i][b];
    const n = perBranch[side];
    for (let k = 0; k < n; k++) parts.push({ side, i, curve, t: (k + Math.random() * 0.6) / n,
      jitter: new V3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9) });
  }
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(parts.length * 3), pCol = new Float32Array(parts.length * 3), pA = new Float32Array(parts.length);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(pA, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { size: { value: 7.0 }, scale: { value: 400 } },
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
  out.points = points;

  const tmp = new V3();
  const IN_COL = [0.45, 0.78, 1.0], EX_COL = [1.0, 0.55, 0.2], EX_COLD = [0.55, 0.5, 0.5];
  out.update = function (theta, dTheta, lifts, rpmFactor) {
    for (let i = 0; i < 4; i++) {
      const k = E.kin(i, theta), ch = out.chambers[i];
      const st = E.thermo(E.phaseOf(i, theta * 180 / Math.PI));
      const p = ch.geo.attributes.position;
      ch.bottomIdx.forEach(j => p.setY(j, k.crownY + 0.25));
      p.needsUpdate = true;
      ch.geo.computeBoundingSphere();
      const c = tempRGB(st.T);
      ch.mat.color.setRGB(c[0], c[1], c[2]).convertSRGBToLinear();
      const lp = Math.log10(st.P), lo = Math.log10(E.gas.Pin * 0.8), hi = Math.log10(E.P3);
      ch.mat.opacity = 0.16 + 0.5 * Math.max(0, Math.min(1, (lp - lo) / (hi - lo)));
      ch.state = st;
    }
    let flashI = 0, flashAt = null;
    for (let i = 0; i < 4; i++) {
      const ph = E.phaseOf(i, theta * 180 / Math.PI);
      const d = ph - 352;
      const on = d >= 0 && d < 14 ? Math.pow(1 - d / 14, 1.2) : 0;
      out.sparks[i].material.opacity = on;
      out.sparks[i].scale.setScalar(22 + 46 * on);
      const f = ph - 356, fl = f >= 0 && f < 46 ? Math.sin(Math.PI * Math.min(1, f / 46)) * (1 - f / 60) : 0;
      out.flames[i].material.opacity = Math.max(0, fl) * 0.95;
      out.flames[i].scale.setScalar(20 + 70 * Math.min(1, Math.max(0, f) / 30));
      const k = Math.max(on, fl * 0.8);
      if (k > flashI) { flashI = k; flashAt = out.sparks[i].position; }
    }
    out.flash.intensity = flashI * 3.0;
    if (flashAt) out.flash.position.copy(flashAt);
    for (let j = 0; j < parts.length; j++) {
      const q = parts[j];
      const lift = lifts[(q.side === 'in' ? 0 : 8) + q.i * 2];
      const rate = 0.95 * (lift / E.camLift);
      if (q.side === 'in') q.t += rate * dTheta; else q.t += rate * dTheta * 1.25;
      q.t -= Math.floor(q.t);
      const u = q.side === 'in' ? q.t : 1 - q.t;
      q.curve.getPointAt(u, tmp);
      const fade = q.side === 'in' ? Math.min(1, (1 - q.t) * 6) * Math.min(1, q.t * 8) : Math.min(1, q.t * 8) * Math.min(1, (1 - q.t) * 5);
      const active = Math.min(1, lift / 2.5);
      pPos[j * 3] = tmp.x + q.jitter.x * 0.6; pPos[j * 3 + 1] = tmp.y + q.jitter.y * 0.6; pPos[j * 3 + 2] = tmp.z + q.jitter.z * 0.6;
      const col = q.side === 'in' ? IN_COL : (active > 0.05 ? EX_COL : EX_COLD);
      pCol[j * 3] = col[0]; pCol[j * 3 + 1] = col[1]; pCol[j * 3 + 2] = col[2];
      pA[j] = fade * (0.18 + 0.82 * active);
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true;
  };
  return out;
};
})();
