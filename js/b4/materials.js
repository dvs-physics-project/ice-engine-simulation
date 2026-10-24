/* b4/materials.js — PBR materials for the boxer (one per part type, so any part can be lit up on
   its own), two palettes, the ghost materials for the castings, and the specification. The
   sheets carry position numbers but no specification table: numbers are taken from the
   leaders where the part is unambiguous; the rest of the parts are listed without a number. */
(function () {
'use strict';
const M = {};
const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();
M.srgb = srgb;

/* ---------------- palettes: [hex, metalness, roughness] ---------------- */
const METAL = {
  crankForged:  ['#717780', 0.92, 0.42], crankJournal: ['#e1e5ea', 1.0, 0.12], noseBolt: ['#8a9097', 1.0, 0.35],
  flywheel:     ['#50555c', 0.85, 0.55], flywheelFace: ['#c4c9ce', 1.0, 0.22], ringGear: ['#9aa0a7', 1.0, 0.3],
  crankSprocket:['#b8bec5', 1.0, 0.25], caseBolt:     ['#5d636b', 1.0, 0.35],
  rod:          ['#808b9b', 0.9, 0.35],  rodBolt:      ['#3b3f45', 0.9, 0.4],   rodBush: ['#c79a55', 1.0, 0.3],
  bearingMain:  ['#cfae78', 1.0, 0.28],  bearingRod:   ['#cfae78', 1.0, 0.28],  thrust:  ['#b98f55', 1.0, 0.3],
  piston:       ['#c9c6bf', 0.7, 0.42],  ring:         ['#2c2f34', 0.9, 0.35],  pin:     ['#e3e6ea', 1.0, 0.12],
  camshaft:     ['#6e737a', 0.9, 0.45],  camLobe:      ['#dadee2', 1.0, 0.13],  camPulley: ['#9aa0a8', 1.0, 0.3],
  rocker:       ['#7d848d', 0.9, 0.36],  rockerShaft:  ['#d0d4d9', 1.0, 0.16],  adjScrew: ['#5a6068', 1.0, 0.3],
  valveIn:      ['#c3c7cc', 1.0, 0.2],   valveEx:      ['#a28b72', 0.95, 0.32],
  spring:       ['#3d6b55', 0.6, 0.38],  retainer:     ['#9ea4ab', 1.0, 0.28],
  belt:         ['#24262b', 0.0, 0.78],  beltTooth:    ['#2a2c31', 0.0, 0.8],
  idler:        ['#b9bec4', 1.0, 0.25],  tensRoller:   ['#c3c8ce', 1.0, 0.22],  tensArm: ['#5d636b', 0.9, 0.4], tensBody: ['#3a3e44', 0.8, 0.45],
  pumpPulley:   ['#a7adb4', 1.0, 0.28],  pumpBody:     ['#8e949b', 0.8, 0.45],
  oilRotor:     ['#a1a7ae', 1.0, 0.3],   pickup:       ['#7f858c', 0.9, 0.45],  strainer: ['#5a5f66', 0.8, 0.6],
  oilFilter:    ['#2b4f8f', 0.45, 0.4],  sensor:       ['#b59a62', 1.0, 0.3],
  sparkMetal:   ['#aeb4ba', 1.0, 0.3],   sparkCeramic: ['#f1efe9', 0.0, 0.35],  sparkBoot: ['#1d1f23', 0.0, 0.6],
  injector:     ['#3c3f45', 0.6, 0.45],  fuelRail:     ['#b7bcc2', 0.9, 0.3],
  mount:        ['#4a4f56', 0.8, 0.5],   mountRubber:  ['#18191c', 0.0, 0.7],
  gasket:       ['#a3a7ad', 0.85, 0.42], headBolt:     ['#868c93', 1.0, 0.32],
};
const NODES = {
  crankForged:  ['#d99a2b', 0.85, 0.38], crankJournal: ['#f1d18a', 1.0, 0.16], noseBolt: ['#c9a24d', 1.0, 0.35],
  flywheel:     ['#4f5a68', 0.8, 0.5],   flywheelFace: ['#9fb0c4', 1.0, 0.25], ringGear: ['#c7d2de', 1.0, 0.3],
  crankSprocket:['#e2553f', 0.7, 0.35],  caseBolt:     ['#9fb0c4', 0.9, 0.3],
  rod:          ['#3d74d9', 0.7, 0.32],  rodBolt:      ['#1e3b75', 0.8, 0.4],   rodBush: ['#e5b462', 1.0, 0.3],
  bearingMain:  ['#e7b85c', 1.0, 0.25],  bearingRod:   ['#e7b85c', 1.0, 0.25],  thrust:  ['#f08a3a', 0.9, 0.3],
  piston:       ['#d7dbe0', 0.65, 0.38], ring:         ['#e2553f', 0.6, 0.35],  pin:     ['#62c3e8', 0.8, 0.2],
  camshaft:     ['#7b5ad6', 0.75, 0.4],  camLobe:      ['#b9a2ff', 0.9, 0.2],   camPulley: ['#e2553f', 0.7, 0.35],
  rocker:       ['#8a6ee0', 0.7, 0.35],  rockerShaft:  ['#c9bbff', 0.9, 0.2],   adjScrew: ['#4a3a8a', 0.9, 0.35],
  valveIn:      ['#2bb5c9', 0.8, 0.25],  valveEx:      ['#e0783a', 0.8, 0.3],
  spring:       ['#7cc75a', 0.45, 0.35], retainer:     ['#2a8f6a', 0.8, 0.3],
  belt:         ['#2b2e34', 0.0, 0.75],  beltTooth:    ['#ff9b72', 0.2, 0.6],
  idler:        ['#f07f5a', 0.7, 0.35],  tensRoller:   ['#ffb37a', 0.7, 0.35],  tensArm: ['#a35a2a', 0.7, 0.4], tensBody: ['#6b3c1f', 0.6, 0.45],
  pumpPulley:   ['#3fb3d9', 0.8, 0.3],   pumpBody:     ['#2e6f8a', 0.6, 0.45],
  oilRotor:     ['#ffcf73', 0.9, 0.3],   pickup:       ['#e9973d', 0.6, 0.4],   strainer: ['#a86a24', 0.6, 0.55],
  oilFilter:    ['#2f6fd6', 0.5, 0.4],   sensor:       ['#f5c542', 0.9, 0.3],
  sparkMetal:   ['#58b368', 0.7, 0.35],  sparkCeramic: ['#e8ffe8', 0.0, 0.4],   sparkBoot: ['#1f5c2a', 0.2, 0.55],
  injector:     ['#58b368', 0.7, 0.35],  fuelRail:     ['#8fd694', 0.8, 0.3],
  mount:        ['#59616d', 0.6, 0.45],  mountRubber:  ['#20242a', 0.0, 0.7],
  gasket:       ['#8d96a3', 0.6, 0.5],   headBolt:     ['#c9bbff', 0.9, 0.3],
};
M.palettes = { metal: METAL, nodes: NODES };
M.paletteName = 'metal';

const DOUBLE = new Set(['bearingMain', 'bearingRod', 'thrust', 'piston', 'ring', 'strainer', 'gasket', 'rodBush', 'belt']);
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
    if (!P[k]) return;
    const [c, m, r] = P[k];
    M.mat[k].color.copy(srgb(c)); M.mat[k].metalness = m; M.mat[k].roughness = r;
  });
};
M.hw = {
  alu:   new THREE.MeshStandardMaterial({ color: srgb('#b9bec4'), metalness: 0.75, roughness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: srgb('#8c9299'), metalness: 1.0, roughness: 0.35 }),
  dark:  new THREE.MeshStandardMaterial({ color: srgb('#2c3036'), metalness: 0.6, roughness: 0.5 }),
};

/* ---------------- ghosts for the castings ---------------- */
M.ghost = {}; M.ghostEdges = {};
const GHOSTS = ['block', 'headR', 'headL', 'cover', 'pan', 'tcover', 'intake', 'exhaust', 'ports', 'oilpump'];
GHOSTS.forEach(k => {
  M.ghost[k] = new THREE.MeshStandardMaterial({ color: srgb('#5d78d9'), metalness: 0.1, roughness: 0.6,
    transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  M.ghost[k].userData.key = 'ghost-' + k;
  M.ghost[k].userData.baseOpacity = 0.06;
  M.ghostEdges[k] = new THREE.LineBasicMaterial({ color: srgb('#2638b8'), transparent: true, opacity: 0.45, depthWrite: false });
  M.ghostEdges[k].userData.baseOpacity = 0.45;
});
[['ports', 0.11], ['intake', 0.09], ['exhaust', 0.12], ['oilpump', 0.22], ['tcover', 0.1]].forEach(([k, o]) => {
  M.ghost[k].userData.baseOpacity = o; M.ghost[k].opacity = o;
});
M.setInk = function (dark) {
  const fill = srgb(dark ? '#5b7fe0' : '#4a66cc'), edge = srgb(dark ? '#9fbcff' : '#2235b0');
  GHOSTS.forEach(k => { M.ghost[k].color.copy(fill); M.ghostEdges[k].color.copy(edge);
    M.ghostEdges[k].userData.baseOpacity = dark ? 0.38 : 0.45; M.ghostEdges[k].opacity = M.ghostEdges[k].userData.baseOpacity; });
};

/* ---------------- specification ---------------- */
M.parts = {
  crank:       { pos: '1',  name: 'Вал коленчатый', qty: '1', layer: 'crank', mats: ['crankForged', 'crankJournal', 'noseBolt'],
                 desc: 'Пять коренных шеек Ø60 и четыре шатунные Ø52, радиус кривошипа 41,5 мм (ход 83). Кривошипы 1 и 4 смотрят в одну сторону, 2 и 3 — в другую: противолежащие поршни 1–2 и 3–4 движутся зеркально и гасят силы инерции друг друга.' },
  block:       { pos: '2',  name: 'Блок цилиндров', qty: '1', layer: 'housing', ghost: ['block'],
                 desc: 'Две половины с разъёмом по вертикальной плоскости через ось коленвала; каждая несёт свой ряд цилиндров Ø83 и половины пяти коренных опор. Показан прозрачным.' },
  headGasket:  { pos: '3',  name: 'Прокладка головки цилиндров', qty: '2', layer: 'housing', mats: ['gasket'],
                 desc: 'Металлическая, по одной на каждый ряд; толщина в сжатом виде 1,2 мм.' },
  piston:      { pos: '4',  name: 'Поршень', qty: '4', layer: 'pistons', mats: ['piston'],
                 desc: 'Ø83, плоское днище с выточками под клапаны глубиной 2,6 мм: в перекрытии клапаны проходят от поршня не ближе 2,4 мм. Стрелка на днище обращена к приводу ГРМ (п. 5 технических требований).' },
  flywheel:    { pos: '6',  name: 'Маховик', qty: '1', layer: 'crank', mats: ['flywheel', 'flywheelFace', 'ringGear'],
                 desc: 'Ø344 с зубчатым венцом стартера, на заднем фланце коленвала. Болты ставятся на герметик и затягиваются моментом 84 Н·м.' },
  mount:       { pos: '7',  name: 'Опора двигателя', qty: '2', layer: 'aux', mats: ['mount', 'mountRubber'],
                 desc: 'Резинометаллическая подушка под каждым рядом цилиндров.' },
  sensor:      { pos: '8',  name: 'Датчик давления масла', qty: '1', layer: 'aux', mats: ['sensor'],
                 desc: 'Ввёрнут в масляную магистраль рядом с фильтром, на правой половине блока.' },
  crankSprocket:{ pos: '10', name: 'Шкив зубчатый коленчатого вала', qty: '1', layer: 'timing', mats: ['crankSprocket'],
                 desc: '22 зуба. Метка на шкиве совпадает с меткой на крышке масляного насоса, когда поршень 1 в ВМТ такта сжатия — в этом положении ставят ремень.' },
  headL:       { pos: '12', name: 'Головка цилиндров левая', qty: '1', layer: 'housing', ghost: ['headL'],
                 desc: 'Цилиндры 2 и 4. Один распредвал, 8 клапанов, шатровая камера сгорания со свечой в центре. Впускные каналы выходят вверх, выпускные — вниз.' },
  headR:       { pos: '13', name: 'Головка цилиндров правая', qty: '1', layer: 'housing', ghost: ['headR'],
                 desc: 'Цилиндры 1 и 3 — та же конструкция, что у левой, в зеркальном исполнении.' },
  belt:        { pos: '14', name: 'Ремень зубчатый', qty: '1', layer: 'timing', mats: ['belt', 'beltTooth'],
                 desc: 'Один ремень на оба распредвала и насос охлаждающей жидкости. Путь ремня рассчитан по касательным, натяжитель поставлен так, что длина ровно 201 зуб (1915 мм).' },
  oilPump:     { pos: '15', name: 'Насос масляный', qty: '1', layer: 'aux', ghost: ['oilpump'], mats: ['oilRotor'],
                 desc: 'Героторный: внутренний ротор сидит прямо на носке коленвала, наружный обкатывается вокруг него с отношением 6 : 7. На крышке — установочная метка.' },
  tcover:      { pos: '17', name: 'Крышка защитная зубчатого ремня', qty: '1', layer: 'housing', ghost: ['tcover'],
                 desc: 'На виде А чертежа снята; в модели включается флажком под списком слоёв.' },
  idler:       { pos: '18', name: 'Ролик обводной', qty: '3', layer: 'timing', mats: ['idler'],
                 desc: 'Гладкие ролики работают по спинке ремня и увеличивают его охват шкивов.' },
  pickup:      { pos: '19', name: 'Маслоприёмник', qty: '1', layer: 'aux', mats: ['pickup', 'strainer'],
                 desc: 'Трубка с сетчатым фильтром у дна поддона.' },
  pan:         { pos: '20', name: 'Поддон картера', qty: '1', layer: 'housing', ghost: ['pan'],
                 desc: 'Штампованный, со сливной пробкой М20×1,5; глубокая часть — спереди.' },
  oilFilter:   { pos: '21', name: 'Фильтр масляный', qty: '1', layer: 'aux', mats: ['oilFilter'],
                 desc: 'Полнопоточный, на правой половине блока снизу.' },
  intake:      { pos: '22', name: 'Трубопровод впускной', qty: '1', layer: 'air', ghost: ['intake'],
                 desc: 'Ресивер с дроссельным патрубком над двигателем и четыре изогнутых патрубка к головкам.' },
  injector:    { pos: '23', name: 'Форсунка', qty: '4', layer: 'air', mats: ['injector', 'fuelRail'],
                 desc: 'По одной в патрубке каждого цилиндра у головки, струя направлена на впускные клапаны.' },
  pump:        { pos: '24', name: 'Насос охлаждающей жидкости', qty: '1', layer: 'timing', mats: ['pumpPulley', 'pumpBody'],
                 desc: 'Зубчатый шкив на 24 зуба приводится тем же ремнём, что и распредвалы.' },
  caseBolt:    { pos: '34, 35', name: 'Болт стяжной с гайкой', qty: '10', layer: 'housing', mats: ['caseBolt'],
                 desc: 'Стягивают половины блока через коренные опоры: на каждой опоре один болт над коленвалом и один под ним.' },
  headBolt:    { pos: '38', name: 'Болт крепления головки', qty: '12', layer: 'housing', mats: ['headBolt'],
                 desc: 'По шесть на головку. Затягиваются в четыре приёма: 20 Н·м, 82 Н·м, затем дважды доворачиваются на 90° (п. 3 технических требований).' },
  rod:         { pos: '—',  name: 'Шатун', qty: '4', layer: 'pistons', mats: ['rod', 'rodBush', 'rodBolt'],
                 desc: 'Межосевое расстояние 143,5 мм. У каждого шатуна своя шейка, поэтому левый ряд цилиндров сдвинут назад на полшага — 54 мм.' },
  pin:         { pos: '—',  name: 'Палец поршневой', qty: '4', layer: 'pistons', mats: ['pin'], desc: 'Плавающий, Ø23.' },
  rings:       { pos: '—',  name: 'Кольца поршневые', qty: '4 компл.', layer: 'pistons', mats: ['ring'], desc: 'Два компрессионных и маслосъёмное.' },
  camshaft:    { pos: '—',  name: 'Вал распределительный', qty: '2', layer: 'valvetrain', mats: ['camshaft', 'camLobe'],
                 desc: 'По одному в каждой головке, 8 кулачков, опоры Ø27. Профиль кулачка построен как огибающая площадки коромысла, поэтому кулачок касается её точно при любом угле.' },
  camPulley:   { pos: '—',  name: 'Шкив распределительного вала', qty: '2', layer: 'timing', mats: ['camPulley'],
                 desc: '44 зуба — вдвое больше, чем у шкива коленвала: распредвал делает пол-оборота на оборот коленвала. Метки на шкивах смотрят вверх при ВМТ цилиндра 1; болт шкива — 81 Н·м.' },
  tensioner:   { pos: '—',  name: 'Натяжитель ремня автоматический', qty: '1', layer: 'timing', mats: ['tensRoller', 'tensArm', 'tensBody'],
                 desc: 'Гидравлический упор прижимает рычаг с роликом к спинке ремня.' },
  rocker:      { pos: '—',  name: 'Коромысло с регулировочным винтом', qty: '16', layer: 'valvetrain', mats: ['rocker', 'adjScrew'],
                 desc: 'Качается на оси; площадка опирается на кулачок, винт с шаровым концом нажимает на клапан. Тепловой зазор по чертежу — 0,2 мм на впуске и 0,35 мм на выпуске, в модели он выбран.' },
  rockerShaft: { pos: '—',  name: 'Ось коромысел', qty: '4', layer: 'valvetrain', mats: ['rockerShaft'],
                 desc: 'Две оси в каждой головке — впускных и выпускных коромысел; держатся в корпусах подшипников распредвала.' },
  valveIn:     { pos: '—',  name: 'Клапан впускной', qty: '8', layer: 'valvetrain', mats: ['valveIn'], desc: 'Тарелка Ø33, наклон 22° к оси цилиндра, подъём 9,5 мм.' },
  valveEx:     { pos: '—',  name: 'Клапан выпускной', qty: '8', layer: 'valvetrain', mats: ['valveEx'], desc: 'Тарелка Ø28, наклон 17°, подъём 8,5 мм.' },
  springs:     { pos: '—',  name: 'Пружина клапана с тарелкой', qty: '16', layer: 'valvetrain', mats: ['spring', 'retainer'], desc: 'Сжимается ровно на величину подъёма клапана.' },
  spark:       { pos: '—',  name: 'Свеча зажигания', qty: '4', layer: 'aux', mats: ['sparkMetal', 'sparkCeramic', 'sparkBoot'],
                 desc: 'В центре шатровой камеры, между четырьмя клапанами; колодец выходит через торец головки под углом 24° к оси цилиндра.' },
  bearingMain: { pos: '—',  name: 'Вкладыши коренные', qty: '5 компл.', layer: 'crank', mats: ['bearingMain'], desc: 'Разъём вкладышей — по плоскости разъёма блока.' },
  bearingRod:  { pos: '—',  name: 'Вкладыши шатунные', qty: '4 компл.', layer: 'pistons', mats: ['bearingRod'], desc: 'По паре на каждый шатун.' },
  thrust:      { pos: '—',  name: 'Полукольца упорные', qty: '2', layer: 'crank', mats: ['thrust'], desc: 'У средней коренной опоры, держат коленвал от осевого смещения.' },
  exhaust:     { pos: '—',  name: 'Коллектор выпускной', qty: '2', layer: 'air', ghost: ['exhaust'], desc: 'Трубы уходят вниз из каждой головки и под двигателем поворачивают назад.' },
  cover:       { pos: '—',  name: 'Крышка головки цилиндров', qty: '2', layer: 'housing', ghost: ['cover'], desc: 'На виде Б чертежа снята.' },
};
M.partOfMat = {};
Object.keys(M.parts).forEach(id => (M.parts[id].mats || []).forEach(k => { M.partOfMat[k] = id; }));

/* ---------------- highlight ---------------- */
let lit = null;
M.highlight = function (partId, color) {
  M.clearHighlight();
  const p = M.parts[partId];
  if (!p) return;
  const c = srgb(color || '#ff7a1a');
  lit = { partId, mats: [], ghosts: [] };
  (p.mats || []).forEach(k => { const m = M.mat[k]; m.emissive.copy(c); m.emissiveIntensity = 0.45; lit.mats.push(m); });
  (p.ghost || []).forEach(k => { const m = M.ghost[k]; m.emissive.copy(c); m.emissiveIntensity = 0.6;
    m.opacity = Math.min(0.5, m.userData.baseOpacity * 3.4); lit.ghosts.push(m); M.ghostEdges[k].opacity = 0.95; });
};
M.clearHighlight = function () {
  if (!lit) return;
  lit.mats.forEach(m => { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 1; });
  lit.ghosts.forEach(m => { m.emissive.setRGB(0, 0, 0); m.opacity = m.userData.baseOpacity * (m.userData.boost || 1); });
  (M.parts[lit.partId].ghost || []).forEach(k => { M.ghostEdges[k].opacity = M.ghostEdges[k].userData.baseOpacity; });
  lit = null;
};
M.pulse = function (t) {
  if (!lit) return;
  const k = 0.32 + 0.18 * Math.sin(t * 4);
  lit.mats.forEach(m => { m.emissiveIntensity = k; });
};

window.MAT_B4 = M;
})();
