/* v8/build-gas.js — the working gas of the diesel: each cylinder's charge between the crown and
   the fire face plus the part trapped in the ω-bowl (colour = temperature, density = pressure);
   the four fuel sprays from the nozzle while the pump delivers; the flame that follows; and flow
   particles in the ports (moving only while — and as fast as — the real valve lift allows), the
   manifolds and the turbochargers. Particles advance with Δθ, so scrubbing backwards reverses
   them. */
(function () {
'use strict';
window.BUILD_V8 = window.BUILD_V8 || {};
const V3 = THREE.Vector3;
const DEG = Math.PI / 180;

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

BUILD_V8.gas = function (ctx, vt, fuel, air) {
  const E = ctx.E;
  const out = { chambers: [], objects: [] };

  /* ---------- chambers: slab (crown → fire face) + bowl charge, in the bank frame ---------- */
  const slabGeo = new THREE.CylinderGeometry(E.pistonR - 0.3, E.pistonR - 0.3, 1, 56, 1, false); slabGeo.translate(0, 0.5, 0);
  const bowl = [[0, -9.4], [4, -10.9], [10, -15.4], [17, -20.9], [24, -22.4], [30, -20.4], [34.2, -15], [36.5, -7.6], [38.4, -2.2], [40.8, 0.25], [0, 0.25]];
  const bowlGeo = G.lathe(bowl, 40);
  const flameTex = glowTexture([[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,190,90,0.85)'], [0.7, 'rgba(255,110,40,0.3)'], [1, 'rgba(255,90,30,0)']]);
  const sprayGeo = new THREE.ConeGeometry(1, 1, 12, 1, true); sprayGeo.rotateX(Math.PI); sprayGeo.translate(0, 0.5, 0);
  for (let c = 0; c < 8; c++) {
    const C = E.cyl[c];
    const frame = new THREE.Group();
    frame.position.set(C.x, 0, 0);
    frame.quaternion.copy(BUILD_V8.bankQuat(E, c));
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a7ad0, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const slab = new THREE.Mesh(slabGeo, mat), bw = new THREE.Mesh(bowlGeo, mat);
    slab.renderOrder = bw.renderOrder = 4;
    ctx.tag(slab, 'gas:' + c, 'gas'); ctx.tag(bw, 'gas:' + c, 'gas');
    frame.add(slab, bw);
    // flame kernel in the bowl
    // the burn happens inside the bowl, behind the crown rim from most angles: drawn on top
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    flame.renderOrder = 6; flame.userData.pickable = false; ctx.tag(flame, 'gas:' + c, 'gas');
    frame.add(flame);
    out.objects.push(frame);
    // sprays: four holes 72° off the nozzle axis, aimed down into the bowl
    const tip = fuel.tips[c], ax = fuel.injAxis[c], u = new V3(1, 0, 0), v = new V3().crossVectors(ax, u).normalize();
    const sprayMat = new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const sprays = [];
    for (let k = 0; k < 4; k++) {
      const ph = (45 + 90 * k) * DEG;
      const dir = new V3().addScaledVector(ax, -Math.cos(72 * DEG)).addScaledVector(u, Math.sin(72 * DEG) * Math.cos(ph)).addScaledVector(v, Math.sin(72 * DEG) * Math.sin(ph)).normalize();
      const m = new THREE.Mesh(sprayGeo, sprayMat);
      m.position.copy(tip); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
      m.scale.set(0.01, 0.01, 0.01); m.renderOrder = 6; m.userData.pickable = false; ctx.tag(m, 'gas:' + c, 'gas');
      sprays.push(m); out.objects.push(m);
    }
    out.chambers.push({ frame, slab, bowl: bw, mat, flame, sprays, sprayMat, state: null });
  }
  out.flash = new THREE.PointLight(0xffb066, 0, 420, 2);
  out.objects.push(out.flash);

  /* ---------- flow particles ---------- */
  const parts = [];
  const rnd = s => (Math.random() - 0.5) * s;
  for (let c = 0; c < 8; c++) {
    for (let k = 0; k < 14; k++) parts.push({ kind: 'in', c, curve: vt.ports.in[c], t: (k + Math.random() * 0.6) / 14, j: new V3(rnd(14), rnd(14), rnd(14)) });
    for (let k = 0; k < 12; k++) parts.push({ kind: 'ex', c, curve: vt.ports.ex[c], t: (k + Math.random() * 0.6) / 12, j: new V3(rnd(12), rnd(12), rnd(12)) });
  }
  for (let b = 0; b < 2; b++) {
    for (let k = 0; k < 70; k++) parts.push({ kind: 'mIn', b, curve: air.flows.intake[b], t: (k + Math.random() * 0.7) / 70, j: new V3(rnd(30), rnd(30), rnd(30)) });
    for (let k = 0; k < 70; k++) parts.push({ kind: 'mEx', b, curve: air.flows.exhaust[b], t: (k + Math.random() * 0.7) / 70, j: new V3(rnd(26), rnd(26), rnd(26)) });
  }
  const lens = new Map();
  parts.forEach(q => { if (!lens.has(q.curve)) lens.set(q.curve, q.curve.getLength()); q.len = lens.get(q.curve); });
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(parts.length * 3), pCol = new Float32Array(parts.length * 3), pA = new Float32Array(parts.length);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(pA, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { size: { value: 13.0 }, scale: { value: 400 } },
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
  out.objects.push(points);

  const tmp = new V3();
  const IN_COL = [0.45, 0.78, 1.0], EX_COL = [1.0, 0.55, 0.2], EX_COLD = [0.55, 0.5, 0.5];
  const lo = Math.log10(E.gas.Pin * 0.8), hi = Math.log10(E.Pz);
  out.update = function (theta, dTheta) {
    const deg = theta / DEG;
    let flashI = 0, flashC = -1;
    for (let c = 0; c < 8; c++) {
      const k = E.kin(c, theta), ch = out.chambers[c], st = E.thermo(E.phaseOf(c, deg));
      ch.slab.position.y = k.crown + 0.3; ch.slab.scale.y = Math.max(0.05, E.fireFace - k.crown - 0.3);
      ch.bowl.position.y = k.crown;
      const col = tempRGB(st.T);
      ch.mat.color.setRGB(col[0], col[1], col[2]).convertSRGBToLinear();
      ch.mat.opacity = 0.16 + 0.5 * Math.max(0, Math.min(1, (Math.log10(st.P) - lo) / (hi - lo)));
      ch.state = st;
      // fuel sprays during delivery (lengthen over ~8°, then collapse when the needle shuts)
      const ph = st.phase, i0 = E.inject.start, i1 = E.inject.end;
      let len = 0, op = 0;
      if (ph >= i0 && ph <= i1 + 6) {
        len = 40 * Math.min(1, (ph - i0) / 8);
        op = ph <= i1 ? 0.75 : 0.75 * (1 - (ph - i1) / 6);
      }
      ch.sprayMat.opacity = op;
      ch.sprays.forEach(m => { m.scale.set(len * 0.11 + 0.01, len + 0.01, len * 0.11 + 0.01); m.visible = op > 0.01; });
      // flame: ignition a few degrees after the start of injection, burns into the expansion
      const f = ph - (i0 + 6), dur = 90;
      const fl = f >= 0 && f < dur ? Math.sin(Math.PI * Math.min(1, f / dur)) * (1 - f / (dur * 1.25)) : 0;
      ch.flame.material.opacity = Math.max(0, fl);
      ch.flame.scale.setScalar(30 + 90 * Math.min(1, Math.max(0, f) / 26));
      ch.flame.position.set(0, k.crown - 6, 0);
      if (fl > flashI) { flashI = fl; flashC = c; }
    }
    out.flash.intensity = flashI * 3.2;
    if (flashC >= 0) out.chambers[flashC].flame.getWorldPosition(out.flash.position);
    // particles
    const L = vt.lifts, bankIn = [0, 0], bankEx = [0, 0];
    for (let c = 0; c < 8; c++) { const b = c < 4 ? 0 : 1; bankIn[b] += L[c] / E.valveLiftMax / 4; bankEx[b] += L[8 + c] / E.valveLiftMax / 4; }
    for (let j = 0; j < parts.length; j++) {
      const q = parts[j];
      let active, speed, u, fade, col;
      if (q.kind === 'in' || q.kind === 'ex') {
        const lift = L[(q.kind === 'in' ? 0 : 8) + q.c] / E.valveLiftMax;
        speed = (q.kind === 'in' ? 160 : 210) * lift; active = Math.min(1, lift * 5);
        q.t += speed * dTheta / q.len * 3;
        q.t -= Math.floor(q.t);
        u = q.t;
        fade = Math.min(1, q.t * 8) * Math.min(1, (1 - q.t) * 6);
        col = q.kind === 'in' ? IN_COL : (active > 0.05 ? EX_COL : EX_COLD);
      } else {
        const flow = q.kind === 'mIn' ? bankIn[q.b] : bankEx[q.b];
        speed = 90 + 260 * flow; active = 0.35 + 0.65 * Math.min(1, flow * 4);
        q.t += speed * dTheta / q.len * 3;
        q.t -= Math.floor(q.t);
        u = q.t;
        fade = Math.min(1, q.t * 14) * Math.min(1, (1 - q.t) * 10);
        col = q.kind === 'mIn' ? IN_COL : EX_COL;
      }
      q.curve.getPointAt(u, tmp);
      pPos[j * 3] = tmp.x + q.j.x * 0.6; pPos[j * 3 + 1] = tmp.y + q.j.y * 0.6; pPos[j * 3 + 2] = tmp.z + q.j.z * 0.6;
      pCol[j * 3] = col[0]; pCol[j * 3 + 1] = col[1]; pCol[j * 3 + 2] = col[2];
      pA[j] = fade * (0.15 + 0.85 * active);
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true;
  };
  return out;
};
})();
