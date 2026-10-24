(function () {
'use strict';
const V3 = THREE.Vector3;
const EN = {};
window.ENGINE_V8 = EN;

EN.init = function (viewport) {
  const E = window.ENG_V8, M = window.MAT_V8;
  EN.E = E;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  viewport.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D-модель V-образного двигателя');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3226, 0.35));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.35);
  key.position.set(-900, 1500, 1050);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -820, right: 820, top: 820, bottom: -620, near: 400, far: 4200 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.9;
  key.target.position.set(0, 120, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.45);
  fill.position.set(1200, 500, -900);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 8, 16000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.085;
  controls.minDistance = 260; controls.maxDistance = 6400;
  controls.screenSpacePanning = true;

  const registry = { layer: {}, part: {} };
  const tag = (obj, part, layer) => {
    obj.userData.part = part; obj.userData.layer = layer;
    (registry.layer[layer] = registry.layer[layer] || []).push(obj);
    (registry.part[part] = registry.part[part] || []).push(obj);
    return obj;
  };
  const ctx = { E, M, G: window.G, tag };
  const crank = BUILD_V8.crank(ctx);
  const pist = BUILD_V8.pistons(ctx);
  const vt = BUILD_V8.valvetrain(ctx);
  const tm = BUILD_V8.timing(ctx);
  const fuel = BUILD_V8.fuel(ctx);
  const aux = BUILD_V8.aux(ctx);
  const air = BUILD_V8.air(ctx);
  const hs = BUILD_V8.housings(ctx);
  const gas = BUILD_V8.gas(ctx, vt, fuel, air);

  vt.cam.add(tm.camGear);
  fuel.rotor.add(tm.pumpGear);
  scene.add(crank.group, crank.fixed, vt.cam, vt.portMesh);
  pist.pistons.forEach(p => scene.add(p));
  pist.rods.forEach(r => scene.add(r));
  pist.liners.forEach(l => scene.add(l));
  vt.instanced.forEach(m => scene.add(m));
  vt.static.forEach(m => scene.add(m));
  [tm, fuel, aux, air, gas].forEach(mod => mod.objects.forEach(o => scene.add(o)));
  hs.meshes.forEach(m => scene.add(m));
  hs.edges.forEach(m => scene.add(m));
  scene.add(hs.gaskets);

  const ghostMats = Object.values(M.ghost), edgeMats = Object.values(M.ghostEdges);
  const clipTargets = ghostMats.concat(edgeMats, [M.mat.gasket]);

  Object.assign(EN, { renderer, scene, camera, controls, crank, pist, vt, tm, fuel, aux, air, hs, gas, registry });

  EN.layerOn = { crank: true, flywheel: true, pistons: true, valvetrain: true, gears: true, fuel: true, air: true, aux: true, gas: true, housing: true };
  EN.housingMode = 'ghost';
  let cutSide = 0;
  const sideOf = o => {
    if (o.userData.cutSide !== undefined) return o.userData.cutSide;
    const box = new THREE.Box3();
    if (o.isInstancedMesh) {
      const m4 = new THREE.Matrix4(), b0 = new THREE.Box3();
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, m4); b0.copy(o.geometry.boundingBox).applyMatrix4(m4).applyMatrix4(o.matrixWorld); box.union(b0); }
    } else if (o.isMesh || o.isLineSegments || o.isPoints) box.setFromObject(o);
    else if (o.isSprite || o.isLight) box.setFromCenterAndSize(o.getWorldPosition(new V3()), new V3(1, 1, 1));
    o.userData.cutSide = box.isEmpty() ? 0 : box.max.x < X1 - 1 ? -1 : box.min.x > X1 + 1 ? 1 : 0;
    return o.userData.cutSide;
  };
  EN.applyVisibility = function () {
    if (EN.housingMode === 'trans') scene.updateMatrixWorld(true);
    Object.keys(registry.layer).forEach(layer => {
      registry.layer[layer].forEach(o => {
        let vis = EN.layerOn[layer] !== false;
        if (layer === 'housing') vis = vis && EN.housingMode !== 'off';
        if (EN.housingMode === 'trans' && cutSide && sideOf(o) === cutSide) vis = false;
        if (EN.isolated) vis = vis && o.userData.part === EN.isolated;
        o.visible = vis;
      });
    });
  };
  const X1 = E.cyl[0].x;
  const planes = { long: new THREE.Plane(new V3(0, -Math.SQRT1_2, -Math.SQRT1_2), 0), trans: new THREE.Plane(new V3(1, 0, 0), -X1) };
  EN.setHousing = function (mode) {
    EN.housingMode = mode;
    cutSide = mode === 'trans' ? (camera.position.x <= X1 ? -1 : 1) : 0;
    const sec = mode === 'long' || mode === 'trans';
    clipTargets.forEach(m => { m.clippingPlanes = sec ? [planes[mode]] : null; m.needsUpdate = true; });
    ghostMats.forEach(m => { m.userData.boost = sec ? 2.4 : 1; m.opacity = m.userData.baseOpacity * m.userData.boost; });
    EN.applyVisibility(); EN.dirty = true;
  };
  EN.setLayer = function (layer, on) { EN.layerOn[layer] = on; EN.applyVisibility(); EN.dirty = true; };
  EN.setPalette = function (name) { M.applyPalette(name); EN.dirty = true; };
  const updateSectionSide = () => {
    if (EN.housingMode === 'long') {
      const s = camera.position.z >= 0 ? 1 : -1;
      planes.long.normal.set(0, -Math.SQRT1_2, -s * Math.SQRT1_2); planes.long.constant = 0;
    } else if (EN.housingMode === 'trans') {
      const s = camera.position.x <= X1 ? 1 : -1;
      planes.trans.normal.set(s, 0, 0); planes.trans.constant = -s * X1;
      if (cutSide !== -s) { cutSide = -s; EN.applyVisibility(); }
    }
  };

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

  const ray = new THREE.Raycaster();
  const isShown = o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
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

  const VIEWS = {
    iso:   { dir: [-0.35, 0.55, 0.76], tgt: [20, 120, 0], r: 660 },
    front: { dir: [-1, 0.1, 0.0001], tgt: [-470, 150, 0], r: 450 },
    gears: { dir: [1, 0.16, -0.3], tgt: [372, 130, -30], r: 360 },
    side:  { dir: [0.0001, 0.08, -1], tgt: [20, 120, 0], r: 640 },
    top:   { dir: [0.0001, 1, 0.0001], tgt: [20, 180, 0], r: 600 },
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
    const dist = Math.max(300, fitDist(size * 0.62));
    EN.flyTo(c.clone().addScaledVector(dir, dist).toArray(), c.toArray());
  };
  EN.view('iso', true);

  EN.setDark = function (dark) { M.setInk(dark); EN.dirty = true; };

  EN.resize = function () {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    gas.points.material.uniforms.scale.value = h * 0.5;
    EN.dirty = true;
  };
  new ResizeObserver(EN.resize).observe(viewport);
  EN.resize();

  EN.theta = 0;
  EN.update = function (theta, dTheta) {
    EN.theta = theta; EN.dirty = true;
    crank.update(theta);
    pist.update(theta);
    vt.update(theta);
    tm.update(theta);
    fuel.update(theta);
    aux.update(theta);
    air.update(theta);
    gas.update(theta, dTheta);
  };
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
