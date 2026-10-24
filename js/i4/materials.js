/* materials.js — PBR materials (one per part type, so a part can be highlighted on its own),
   two palettes ('metal' = realistic finishes, 'nodes' = each assembly in its own colour),
   the ghost material for housings, and the part registry keyed to the drawing's
   specification (поз. 1–27). Depends on THREE. */
(function () {
'use strict';
const M = {};
const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();
M.srgb = srgb;

/* ---------------- palettes: [hex, metalness, roughness] per material key ---------------- */
const METAL = {
  crankForged:   ['#7d838c', 0.92, 0.42], crankJournal: ['#dfe3e8', 1.0, 0.13],
  flywheel:      ['#55595f', 0.85, 0.55], flywheelFace: ['#c9cdd2', 1.0, 0.22], ringGear: ['#9aa0a7', 1.0, 0.3],
  crankPulley:   ['#a7adb4', 0.95, 0.3],  accPulley:    ['#2f3237', 0.6, 0.45],  noseBolt: ['#8a9097', 1.0, 0.35],
  rod:           ['#8b97a8', 0.9, 0.34],  rodBolt:      ['#3b3f45', 0.9, 0.4],   rodBush:  ['#c79a55', 1.0, 0.3],
  bearingMain:   ['#cfae78', 1.0, 0.28],  bearingRod:   ['#cfae78', 1.0, 0.28],  thrust:   ['#b98f55', 1.0, 0.3],
  piston:        ['#c9c6bf', 0.7, 0.42],  ring:         ['#2c2f34', 0.9, 0.35],  pin:      ['#e3e6ea', 1.0, 0.12],
  camshaft:      ['#73787f', 0.9, 0.45],  camLobe:      ['#d6dade', 1.0, 0.14],  camPulley:['#b3b9c0', 0.95, 0.28],
  camBolt:       ['#7e848b', 1.0, 0.35],
  valveIn:       ['#c3c7cc', 1.0, 0.2],   valveEx:      ['#a28b72', 0.95, 0.32],
  spring:        ['#3d6b55', 0.6, 0.38],  retainer:     ['#9ea4ab', 1.0, 0.28],  tappet:   ['#d4d8dd', 1.0, 0.16],
  shim:          ['#eef0f2', 1.0, 0.09],
  guide:         ['#a4865c', 0.9, 0.4],
  sparkCeramic:  ['#f1efe8', 0.0, 0.32],  sparkMetal:   ['#a9aeb4', 1.0, 0.3],   sparkBoot:['#1d1f22', 0.0, 0.6],
  injector:      ['#232528', 0.1, 0.45],  fuelRail:     ['#aeb3b9', 0.9, 0.35],
  belt:          ['#202226', 0.0, 0.82],  beltTooth:    ['#26282c', 0.0, 0.78],
  tensRoller:    ['#d9dde1', 1.0, 0.18],  tensArm:      ['#3a3e44', 0.7, 0.45],
  pumpPulley:    ['#a7adb4', 0.95, 0.3],  pumpBody:     ['#b6bbc1', 0.75, 0.5],
  oilPumpBody:   ['#b9bec4', 0.6, 0.5],   oilRotor:     ['#8f959c', 1.0, 0.3],
  pickup:        ['#7f858c', 0.9, 0.45],  strainer:     ['#5a5f66', 0.8, 0.6],
  oilFilter:     ['#1f4fa8', 0.35, 0.42], knock:        ['#1b1d20', 0.0, 0.5],   dipstick: ['#d18a1e', 0.2, 0.45],
  outlet:        ['#b6bbc1', 0.75, 0.5],  gasket:       ['#3c3f45', 0.25, 0.7],
  camCap:        ['#c3c8ce', 0.75, 0.42],
};
const NODES = {
  crankForged:   ['#d99a2b', 0.85, 0.38], crankJournal: ['#f1d18a', 1.0, 0.16],
  flywheel:      ['#4f5a68', 0.8, 0.5],   flywheelFace: ['#9fb0c4', 1.0, 0.25], ringGear: ['#c7d2de', 1.0, 0.3],
  crankPulley:   ['#e2553f', 0.7, 0.35],  accPulley:    ['#36404d', 0.5, 0.45], noseBolt: ['#c9a24d', 1.0, 0.35],
  rod:           ['#3d74d9', 0.7, 0.32],  rodBolt:      ['#1e3b75', 0.8, 0.4],   rodBush:  ['#e5b462', 1.0, 0.3],
  bearingMain:   ['#e7b85c', 1.0, 0.25],  bearingRod:   ['#e7b85c', 1.0, 0.25],  thrust:   ['#f08a3a', 0.9, 0.3],
  piston:        ['#d7dbe0', 0.65, 0.38], ring:         ['#e2553f', 0.6, 0.35],  pin:      ['#62c3e8', 0.8, 0.2],
  camshaft:      ['#7b5ad6', 0.75, 0.4],  camLobe:      ['#b9a2ff', 0.9, 0.2],  camPulley:['#e2553f', 0.7, 0.35],
  camBolt:       ['#4a3a8a', 0.9, 0.35],
  valveIn:       ['#2bb5c9', 0.8, 0.25],  valveEx:      ['#e0783a', 0.8, 0.3],
  spring:        ['#7cc75a', 0.45, 0.35], retainer:     ['#2a8f6a', 0.8, 0.3],   tappet:   ['#9be0c8', 0.9, 0.2],
  shim:          ['#d8fff0', 0.9, 0.15],
  guide:         ['#c9a45e', 0.8, 0.4],
  sparkCeramic:  ['#f6f3ea', 0.0, 0.3],   sparkMetal:   ['#e8c548', 0.9, 0.3],   sparkBoot:['#2a2d33', 0.0, 0.6],
  injector:      ['#2f6f3a', 0.2, 0.4],   fuelRail:     ['#58b368', 0.7, 0.35],
  belt:          ['#24272c', 0.0, 0.8],   beltTooth:    ['#f0a234', 0.1, 0.6],
  tensRoller:    ['#f2c94c', 0.9, 0.25],  tensArm:      ['#6d5a2a', 0.6, 0.45],
  pumpPulley:    ['#e2553f', 0.7, 0.35],  pumpBody:     ['#3fb3d9', 0.5, 0.45],
  oilPumpBody:   ['#e9973d', 0.5, 0.45],  oilRotor:     ['#ffcf73', 0.9, 0.3],
  pickup:        ['#e9973d', 0.6, 0.4],   strainer:     ['#a86a24', 0.6, 0.55],
  oilFilter:     ['#f07f2a', 0.35, 0.4],  knock:        ['#3a3f47', 0.1, 0.5],   dipstick: ['#ffd04a', 0.2, 0.45],
  outlet:        ['#3fb3d9', 0.5, 0.45],  gasket:       ['#4a4f58', 0.2, 0.7],
  camCap:        ['#a99be0', 0.6, 0.42],
};
M.palettes = { metal: METAL, nodes: NODES };
M.paletteName = 'metal';

const DOUBLE = new Set(['bearingMain', 'bearingRod', 'thrust', 'piston', 'ring', 'strainer', 'gasket', 'rodBush']);
M.mat = {};
Object.keys(METAL).forEach(k => {
  const [c, m, r] = METAL[k];
  M.mat[k] = new THREE.MeshStandardMaterial({ color: srgb(c), metalness: m, roughness: r,
    side: DOUBLE.has(k) ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: 1.0 });
  M.mat[k].userData.key = k;
});
M.applyPalette = function (name) {
  const P = M.palettes[name] || METAL;
  M.paletteName = name;
  Object.keys(M.mat).forEach(k => {
    if (!P[k]) return;                         // derived materials (e.g. the belt band) follow their source
    const [c, m, r] = P[k];
    M.mat[k].color.copy(srgb(c)); M.mat[k].metalness = m; M.mat[k].roughness = r;
  });
};

/* hardware that belongs to no single part: never highlighted, never repainted */
M.hw = {
  alu:   new THREE.MeshStandardMaterial({ color: srgb('#b9bec4'), metalness: 0.75, roughness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: srgb('#8c9299'), metalness: 1.0, roughness: 0.35 }),
};

/* ---------------- ghost material for housings (theme-tinted, see setInk) ---------------- */
M.ghost = {};
M.ghostEdges = {};
const GHOSTS = ['block', 'head', 'cover', 'pan', 'tcover', 'ports', 'caps', 'oilpump'];
GHOSTS.forEach(k => {
  M.ghost[k] = new THREE.MeshStandardMaterial({ color: srgb('#5d78d9'), metalness: 0.1, roughness: 0.6,
    transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  M.ghost[k].userData.key = 'ghost-' + k;
  M.ghost[k].userData.baseOpacity = 0.07;
  M.ghostEdges[k] = new THREE.LineBasicMaterial({ color: srgb('#2638b8'), transparent: true, opacity: 0.5, depthWrite: false });
  M.ghostEdges[k].userData.baseOpacity = 0.5;
});
M.ghost.ports.userData.baseOpacity = 0.12; M.ghost.ports.opacity = 0.12;
M.ghost.caps.userData.baseOpacity = 0.32;  M.ghost.caps.opacity = 0.32;
M.ghost.oilpump.userData.baseOpacity = 0.28; M.ghost.oilpump.opacity = 0.28;
M.setInk = function (dark) {
  const fill = srgb(dark ? '#5b7fe0' : '#4a66cc');
  const edge = srgb(dark ? '#9fbcff' : '#2235b0');
  GHOSTS.forEach(k => { M.ghost[k].color.copy(fill); M.ghostEdges[k].color.copy(edge);
    M.ghostEdges[k].userData.baseOpacity = dark ? 0.42 : 0.5; M.ghostEdges[k].opacity = M.ghostEdges[k].userData.baseOpacity; });
};

/* ---------------- part registry: drawing specification + the parts it groups --------------- */
// layer: which "Слои" toggle owns it; mats: material keys painted for highlight
M.parts = {
  block:      { pos: '1',  name: 'Блок картера', qty: '1', layer: 'housing', ghost: ['block', 'caps'],
                desc: 'Чугунный блок с цилиндрами Ø72, рубашкой охлаждения и пятью опорами коленвала. Показан прозрачным, чтобы был виден механизм.' },
  crank:      { pos: '2',  name: 'Вал коленчатый', qty: '1', layer: 'crank', mats: ['crankForged', 'crankJournal', 'noseBolt'],
                desc: 'Пять коренных и четыре шатунные шейки, радиус кривошипа 34,5 мм (ход 69). Восемь щёк с противовесами; кривошипы 1–4 и 2–3 развёрнуты на 180°.' },
  rod:        { pos: '3',  name: 'Шатун', qty: '4', layer: 'pistons', mats: ['rod', 'rodBolt', 'rodBush'],
                desc: 'Двутавровый стержень, межосевое 122 мм. Разъёмная нижняя головка с крышкой на двух болтах, в верхней — бронзовая втулка.' },
  head:       { pos: '4',  name: 'Головка блока', qty: '1', layer: 'housing', ghost: ['head', 'ports'], mats: ['camCap', 'guide'],
                desc: 'Четыре клапана на цилиндр, шатровая камера сгорания, клапаны наклонены на 28°. Впуск со стороны форсунок, выпуск — с противоположной.' },
  flywheel:   { pos: '5',  name: 'Маховик', qty: '1', layer: 'crank', mats: ['flywheel', 'flywheelFace', 'ringGear'],
                desc: 'Ø267 мм, с напрессованным зубчатым венцом стартера. Сглаживает неравномерность крутящего момента между вспышками.' },
  pickup:     { pos: '6',  name: 'Приёмник масла', qty: '1', layer: 'aux', mats: ['pickup', 'strainer'],
                desc: 'Трубка с сетчатым фильтром в глубокой части поддона, подводит масло к насосу.' },
  oilPump:    { pos: '7',  name: 'Насос масляный', qty: '1', layer: 'aux', ghost: ['oilpump'], mats: ['oilRotor'],
                desc: 'Шестерённый насос с внутренним зацеплением (героторный). Внутренний ротор сидит на носке коленвала, наружный обкатывается вокруг него.' },
  pan:        { pos: '8',  name: 'Поддон', qty: '1', layer: 'housing', ghost: ['pan'],
                desc: 'Штампованный поддон: глубокий маслосборник спереди, под приёмником, и мелкая часть к маховику.' },
  camPulley:  { pos: '9',  name: 'Шестерня распредвала', qty: '2', layer: 'timing', mats: ['camPulley', 'camBolt'],
                desc: 'Зубчатый шкив, 46 зубьев. Вдвое больше шкива коленвала — поэтому распредвалы вращаются в два раза медленнее.' },
  crankPulley:{ pos: '10', name: 'Шестерня коленвала', qty: '1', layer: 'timing', mats: ['crankPulley'],
                desc: 'Ведущий зубчатый шкив ремня ГРМ, 23 зуба, с ребордами, удерживающими ремень.' },
  camshaft:   { pos: '11', name: 'Вал распределительный', qty: '2', layer: 'valvetrain', mats: ['camshaft', 'camLobe'],
                desc: 'Впускной и выпускной валы, по 8 кулачков. Профиль кулачка рассчитан под плоский толкатель: подъём 8 мм, фаза 241° по углу коленвала (при подъёме 1 мм).' },
  pin:        { pos: '12', name: 'Палец поршневой', qty: '4', layer: 'pistons', mats: ['pin'],
                desc: 'Плавающий палец Ø18, зафиксирован стопорными кольцами в бобышках поршня.' },
  cover:      { pos: '13', name: 'Крышка распредвала', qty: '2', layer: 'housing', ghost: ['cover'],
                desc: 'Две крышки — над впускным и выпускным валами. Между ними колодцы свечей зажигания.' },
  gasket:     { pos: '14–16', name: 'Прокладки', qty: '4', layer: 'housing', mats: ['gasket'],
                desc: 'Прокладка головки блока (14), прокладки крышек распредвалов (15, две шт.), прокладка поддона (16).' },
  outlet:     { pos: '17', name: 'Патрубок', qty: '1', layer: 'aux', mats: ['outlet'],
                desc: 'Выходной патрубок системы охлаждения на задней стенке головки, с датчиком температуры.' },
  bearingRod: { pos: '18', name: 'Подшипник шатунный', qty: '4 компл.', layer: 'pistons', mats: ['bearingRod'],
                desc: 'Тонкостенные вкладыши нижней головки шатуна, по паре на шейку.' },
  bearingMain:{ pos: '19', name: 'Подшипник коренной', qty: '5 компл.', layer: 'crank', mats: ['bearingMain'],
                desc: 'Вкладыши пяти коренных опор. Верхние — в блоке, нижние — в крышках опор.' },
  thrust:     { pos: '20', name: 'Полукольцо', qty: '2', layer: 'crank', mats: ['thrust'],
                desc: 'Упорные полукольца по обе стороны средней коренной опоры — не дают валу смещаться вдоль оси.' },
  tensioner:  { pos: '21', name: 'Ролик натяжной', qty: '1', layer: 'timing', mats: ['tensRoller', 'tensArm'],
                desc: 'Давит на ремень с тыльной стороны на ведомой ветви. Его положение подобрано так, что длина ремня — ровно 137 зубьев.' },
  belt:       { pos: '22', name: 'Ремень ГРМ', qty: '1', layer: 'timing', mats: ['belt', 'beltTooth'],
                desc: 'Зубчатый ремень шириной 25 мм, шаг 8 мм, 137 зубьев. Связывает коленвал, оба распредвала и насос охлаждения.' },
  accPulley:  { pos: '23', name: 'Шкив генератора', qty: '1', layer: 'aux', mats: ['accPulley'],
                desc: 'Ручьевой шкив Ø130 на носке коленвала, от него поликлиновым ремнём приводится генератор.' },
  rings:      { pos: '24', name: 'Кольца поршневые', qty: '4 компл.', layer: 'pistons', mats: ['ring'],
                desc: 'Два компрессионных и одно маслосъёмное кольцо на каждом поршне.' },
  coolantPump:{ pos: '25', name: 'Насос охлаждения', qty: '1', layer: 'aux', mats: ['pumpBody', 'pumpPulley'],
                desc: 'Центробежный насос на передней стенке блока, приводится тем же ремнём ГРМ.' },
  oilFilter:  { pos: '26', name: 'Фильтр масляный', qty: '1', layer: 'aux', mats: ['oilFilter'],
                desc: 'Полнопоточный фильтр на кронштейне с выпускной стороны блока.' },
  knock:      { pos: '27', name: 'Датчик детонации', qty: '1', layer: 'aux', mats: ['knock'],
                desc: 'Пьезодатчик на стенке блока со стороны впуска, ловит вибрацию от детонации.' },
  // parts shown on the drawing inside assemblies, without their own position number
  piston:     { pos: '—',  name: 'Поршень', qty: '4', layer: 'pistons', mats: ['piston'],
                desc: 'Литой алюминиевый поршень Ø72 с плоским днищем и выточками под клапаны; юбка — только на нагруженных сторонах.' },
  valveIn:    { pos: '—',  name: 'Клапан впускной', qty: '8', layer: 'valvetrain', mats: ['valveIn'],
                desc: 'Тарелка Ø27. Открывается кулачком через стаканный толкатель; подъём берётся прямо из профиля кулачка.' },
  valveEx:    { pos: '—',  name: 'Клапан выпускной', qty: '8', layer: 'valvetrain', mats: ['valveEx'],
                desc: 'Тарелка Ø23, работает горячее впускного — отсюда цвета побежалости.' },
  springs:    { pos: '—',  name: 'Пружины клапанов', qty: '32', layer: 'valvetrain', mats: ['spring', 'retainer'],
                desc: 'Наружная и внутренняя пружина на каждом клапане, сухари и тарелка сверху.' },
  tappet:     { pos: '—',  name: 'Толкатель клапана', qty: '16', layer: 'valvetrain', mats: ['tappet', 'shim'],
                desc: 'Стаканный толкатель: кулачок давит на его донышко, а не на сам клапан.' },
  spark:      { pos: '—',  name: 'Свеча зажигания', qty: '4', layer: 'aux', mats: ['sparkCeramic', 'sparkMetal', 'sparkBoot'],
                desc: 'В центре шатровой камеры. Искра проскакивает в ВМТ такта сжатия — по порядку 1-3-4-2.' },
  fuel:       { pos: '—',  name: 'Форсунки и топливная рампа', qty: '4 + 1', layer: 'aux', mats: ['injector', 'fuelRail'],
                desc: 'Форсунки впрыскивают топливо во впускные каналы перед клапанами.' },
  dipstick:   { pos: '—',  name: 'Указатель уровня масла', qty: '1', layer: 'aux', mats: ['dipstick'],
                desc: 'Щуп с метками min/max уходит в поддон со стороны впуска.' },
};
// reverse index: material key → part id
M.partOfMat = {};
Object.keys(M.parts).forEach(id => (M.parts[id].mats || []).forEach(k => { M.partOfMat[k] = id; }));

/* ---------------- highlight (emissive tint on every material of a part) ---------------- */
let lit = null;
M.highlight = function (partId, color) {
  M.clearHighlight();
  const p = M.parts[partId];
  if (!p) return;
  const c = srgb(color || '#ff7a1a');
  lit = { partId, mats: [], ghosts: [] };
  (p.mats || []).forEach(k => { const m = M.mat[k]; m.emissive.copy(c); m.emissiveIntensity = 0.45; lit.mats.push(m); });
  (p.ghost || []).forEach(k => { const m = M.ghost[k]; m.emissive.copy(c); m.emissiveIntensity = 0.6;
    m.opacity = Math.min(0.5, m.userData.baseOpacity * 3.2); lit.ghosts.push(m);
    M.ghostEdges[k].opacity = 0.95; });
};
M.clearHighlight = function () {
  if (!lit) return;
  lit.mats.forEach(m => { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 1; });
  lit.ghosts.forEach(m => { m.emissive.setRGB(0, 0, 0); m.opacity = m.userData.baseOpacity; });
  (M.parts[lit.partId].ghost || []).forEach(k => { M.ghostEdges[k].opacity = M.ghostEdges[k].userData.baseOpacity; });
  lit = null;
};
M.pulse = function (t) {                      // gentle breathing of the highlight
  if (!lit) return;
  const k = 0.32 + 0.18 * Math.sin(t * 4);
  lit.mats.forEach(m => { m.emissiveIntensity = k; });
};

window.MAT_I4 = M;
})();
