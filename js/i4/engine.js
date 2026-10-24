/* i4/engine.js — assembles every part module into one scene and owns the per-frame update.
   Exposes window.ENGINE_I4. Depends on THREE r128 (+ OrbitControls, RoomEnvironment,
   BufferGeometryUtils), i4/spec.js (ENG_I4), geom.js (G), i4/materials.js (MAT_I4), i4/build-*.js. */
(function () {
'use strict';
const V3 = THREE.Vector3;
const EN = {};
window.ENGINE_I4 = EN;

EN.init = function (viewport) {
  const E = window.ENG_I4, M = window.MAT_I4;
  EN.E = E;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;   // phones: lighter GPU load
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  viewport.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D-модель двигателя');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3226, 0.35));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.35);
  key.position.set(-420, 760, 520);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -420, right: 420, top: 460, bottom: -330, near: 200, far: 2200 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  key.target.position.set(0, 90, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.45);
  fill.position.set(620, 240, -480);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 5, 9000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.085;
  controls.minDistance = 160; controls.maxDistance = 3200;
  controls.screenSpacePanning = true;

  /* ---------------- build ---------------- */
  const sol = E.solveBelt();
  const ph = BUILD_I4.beltPhases(E, sol);
  const registry = { layer: {}, part: {} };
  const tag = (obj, part, layer) => {
    obj.userData.part = part; obj.userData.layer = layer;
    (registry.layer[layer] = registry.layer[layer] || []).push(obj);
    (registry.part[part] = registry.part[part] || []).push(obj);
    return obj;
  };
  const ctx = { E, M, G: window.G, tag, belt: { sol, phase: ph.phase, sTooth0: ph.sTooth0 } };
  const crank = BUILD_I4.crank(ctx);
  const pist = BUILD_I4.pistons(ctx);
  const vt = BUILD_I4.valvetrain(ctx);
  const tm = BUILD_I4.timing(ctx);
  const hs = BUILD_I4.housings(ctx);
  const aux = BUILD_I4.aux(ctx);
  const gas = BUILD_I4.gas(ctx, vt.ports, aux.sparkTips);

  aux.crankChildren.forEach(m => crank.group.add(m));
  scene.add(crank.group, crank.fixed);
  pist.pistons.forEach(p => scene.add(p));
  pist.rods.forEach(r => scene.add(r));
  vt.cams.forEach(c => scene.add(c.group));
  scene.add(vt.caps, vt.portMesh);
  vt.instanced.forEach(m => scene.add(m));
  vt.static.forEach(m => { m.castShadow = m.receiveShadow = true; scene.add(m); });
  tm.objects.forEach(o => scene.add(o));
  tm.cover.forEach(o => scene.add(o));
  hs.meshes.forEach(m => scene.add(m));
  hs.edges.forEach(m => scene.add(m));
  scene.add(hs.gaskets);
  aux.fixed.forEach(o => scene.add(o));
  gas.chambers.forEach(c => scene.add(c.mesh));
  gas.sparks.forEach(s => scene.add(s));
  gas.flames.forEach(s => scene.add(s));
  scene.add(gas.flash, gas.points);

  // ghost bookkeeping (for section clipping & opacity)
  const ghostMats = Object.values(M.ghost), edgeMats = Object.values(M.ghostEdges);
  const clipTargets = ghostMats.concat(edgeMats, [M.mat.gasket, M.mat.camCap, M.hw.steel]);

  Object.assign(EN, { renderer, scene, camera, controls, crank, pist, vt, tm, hs, aux, gas, registry, sol,
    ctxPhase: ph.phase, sTooth0: ph.sTooth0 });

  /* ---------------- layers & housing modes ---------------- */
  EN.layerOn = { crank: true, pistons: true, valvetrain: true, timing: true, housing: true, aux: true, gas: true };
  EN.timingCover = false;
  EN.housingMode = 'ghost';
  EN.applyVisibility = function () {
    Object.keys(registry.layer).forEach(layer => {
      registry.layer[layer].forEach(o => {
        let vis = EN.layerOn[layer] !== false;
        if (layer === 'housing') vis = vis && EN.housingMode !== 'off';
        if (o.userData.part === 'tcover') vis = vis && EN.timingCover;
        if (EN.isolated) vis = vis && o.userData.part === EN.isolated;
        o.visible = vis;
      });
    });
  };
  const planes = { long: new THREE.Plane(new V3(0, 0, -1), 0), trans: new THREE.Plane(new V3(1, 0, 0), -E.cylX[0]) };
  EN.setHousing = function (mode) {
    EN.housingMode = mode;
    const sec = mode === 'long' || mode === 'trans';
    clipTargets.forEach(m => { m.clippingPlanes = sec ? [planes[mode]] : null; m.needsUpdate = true; });
    ghostMats.forEach(m => { m.userData.boost = sec ? 2.4 : 1; m.opacity = m.userData.baseOpacity * m.userData.boost; });
    EN.applyVisibility(); EN.dirty = true;
  };
  EN.setLayer = function (layer, on) { EN.layerOn[layer] = on; EN.applyVisibility(); EN.dirty = true; };
  EN.setTimingCover = function (on) { EN.timingCover = on; EN.applyVisibility(); EN.dirty = true; };
  EN.setPalette = function (name) {
    M.applyPalette(name); EN.dirty = true;
    M.mat.beltBand.color.copy(M.mat.belt.color); M.mat.beltBand.metalness = M.mat.belt.metalness; M.mat.beltBand.roughness = M.mat.belt.roughness;
  };
  const updateSectionSide = () => {           // always keep the half that faces away from the camera
    if (EN.housingMode === 'long') {
      const s = camera.position.z >= 0 ? -1 : 1;
      planes.long.normal.set(0, 0, s); planes.long.constant = 0;
    } else if (EN.housingMode === 'trans') {
      const s = camera.position.x <= E.cylX[0] ? 1 : -1;
      planes.trans.normal.set(s, 0, 0); planes.trans.constant = -s * E.cylX[0];
    }
  };

  /* ---------------- selection ---------------- */
  EN.selected = null; EN.isolated = null;
  EN.select = function (partId) {
    EN.selected = partId;
    if (partId && M.parts[partId]) M.highlight(partId); else M.clearHighlight();
    EN.dirty = true;
    if (!partId && EN.isolated) EN.isolate(false);
  };
  EN.isolate = function (on) {
    EN.isolated = on && EN.selected ? EN.selected : null;
    EN.applyVisibility(); EN.dirty = true;
  };
  EN.partBox = function (partId) {
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    scene.updateMatrixWorld(true);
    (registry.part[partId] || []).forEach(o => {
      if (o.isInstancedMesh) {
        const m4 = new THREE.Matrix4(), b0 = new THREE.Box3();
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, m4); b0.copy(o.geometry.boundingBox).applyMatrix4(m4).applyMatrix4(o.matrixWorld); box.union(b0); }
      } else if (o.isMesh || o.isLineSegments) { tmp.setFromObject(o); box.union(tmp); }
    });
    return box;
  };

  /* ---------------- picking: solid parts win over the ghost housings in front of them ---------------- */
  const ray = new THREE.Raycaster();
  EN.pick = function (ndcX, ndcY) {
    ray.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const cands = [];
    scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible && o.userData.part && o.userData.pickable !== false && isShown(o)) cands.push(o); });
    const hits = ray.intersectObjects(cands, false);
    if (!hits.length) return null;
    const solid = hits.find(h => !(h.object.material && h.object.material.transparent));
    const h = solid || hits[0];
    return { part: h.object.userData.part, point: h.point };
  };
  const isShown = o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };

  /* ---------------- camera: presets + focus tween ---------------- */
  // presets: a viewing direction, a target and the radius that must stay in frame — the
  // distance is solved for the current stage aspect, so the engine fits on any screen.
  const VIEWS = {
    iso:   { dir: [-0.62, 0.42, 0.66], tgt: [-12, 112, 0], r: 395 },
    front: { dir: [-1, 0.06, 0.0001], tgt: [-215, 140, 0], r: 262 },
    side:  { dir: [0.0001, 0.04, 1], tgt: [-6, 112, 0], r: 330 },
    top:   { dir: [0.0001, 1, 0.0001], tgt: [-6, 112, 0], r: 290 },
    head:  { dir: [-0.6, 0.55, 0.58], tgt: [-90, 262, 0], r: 235 },
  };
  let tween = null;
  EN.flyTo = function (pos, tgt, ms) {
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new V3(...pos), t1: new V3(...tgt), start: performance.now(), dur: ms || 800 };
  };
  const fitDist = r => {
    const v = camera.fov * Math.PI / 360, h = Math.atan(Math.tan(v) * camera.aspect);
    return r / Math.sin(Math.min(v, h));
  };
  EN.view = function (name, instant) {
    const v = VIEWS[name] || VIEWS.iso;
    const d = new V3(...v.dir).normalize().multiplyScalar(fitDist(v.r));
    const pos = new V3(...v.tgt).add(d).toArray();
    if (instant) { camera.position.set(...pos); controls.target.set(...v.tgt); controls.update(); }
    else EN.flyTo(pos, v.tgt);
  };
  EN.focus = function (partId) {
    const box = EN.partBox(partId);
    if (box.isEmpty()) return;
    const c = box.getCenter(new V3()), size = box.getSize(new V3()).length();
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.max(240, fitDist(size * 0.62));
    EN.flyTo(c.clone().addScaledVector(dir, dist).toArray(), c.toArray());
  };
  EN.view('iso', true);

  /* ---------------- theme ink ---------------- */
  EN.setDark = function (dark) { M.setInk(dark); EN.dirty = true; };

  /* ---------------- sizing ---------------- */
  EN.resize = function () {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;                       // hidden tab: keep the last good size
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    gas.points.material.uniforms.scale.value = h * 0.5;
    EN.dirty = true;
  };
  new ResizeObserver(EN.resize).observe(viewport);
  EN.resize();

  /* ---------------- per-frame ---------------- */
  EN.theta = 0;
  EN.update = function (theta, dTheta) {
    EN.theta = theta; EN.dirty = true;
    crank.update(theta);
    pist.update(theta);
    vt.update(theta);
    tm.update(theta);
    aux.update(theta);
    gas.update(theta, dTheta, vt.lifts);
  };
  // render on demand: only while something moves (playback, orbit damping, a camera tween,
  // the selection pulse) or after a state change — a paused engine costs nothing.
  EN.dirty = true;
  EN.invalidate = () => { EN.dirty = true; };
  controls.addEventListener('change', EN.invalidate);
  EN.render = function (now) {
    const moving = tween !== null;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.dur), k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (t >= 1) tween = null;
    }
    controls.update();
    if (!EN.dirty && !moving && !EN.selected) return false;
    updateSectionSide();
    M.pulse(now / 1000);
    renderer.render(scene, camera);
    EN.dirty = false;
    return true;
  };
  EN.applyVisibility();
  EN.update(0, 0);
  return EN;
};
})();
