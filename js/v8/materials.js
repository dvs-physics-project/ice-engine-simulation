/* v8/materials.js — PBR materials for the V8 (one per part type, so any part can be lit up on
   its own), two palettes, the ghost materials for the castings, and the model's own
   specification. The drawing «ДВС КР 09.00.00.00 СБ» carries position numbers but no
   specification table, so the numbering here is the model's own. Depends on THREE. */
(function () {
'use strict';
const M = {};
const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();
M.srgb = srgb;

/* ---------------- palettes: [hex, metalness, roughness] ---------------- */
const METAL = {
  crankForged:  ['#6f757e', 0.92, 0.44], crankJournal: ['#e0e4e9', 1.0, 0.12], noseBolt: ['#8a9097', 1.0, 0.35],
  flywheel:     ['#4e535a', 0.85, 0.55], flywheelFace: ['#c4c9ce', 1.0, 0.22], ringGear: ['#9aa0a7', 1.0, 0.3],
  damper:       ['#2b2e33', 0.55, 0.5],  crankPulley:  ['#9ea4ab', 0.95, 0.32],
  rod:          ['#7e8a9b', 0.9, 0.36],  rodBolt:      ['#3b3f45', 0.9, 0.4],   rodBush: ['#c79a55', 1.0, 0.3],
  bearingMain:  ['#cfae78', 1.0, 0.28],  bearingRod:   ['#cfae78', 1.0, 0.28],  thrust:  ['#b98f55', 1.0, 0.3],
  piston:       ['#c7c3bb', 0.7, 0.42],  ring:         ['#2c2f34', 0.9, 0.35],  pin:     ['#e3e6ea', 1.0, 0.12],
  liner:        ['#8d9298', 0.85, 0.5],  linerBore:    ['#c9ced3', 1.0, 0.2],   oring:   ['#1b1d20', 0.0, 0.6],
  camshaft:     ['#6d7279', 0.9, 0.45],  camLobe:      ['#d9dde1', 1.0, 0.13],
  crankGear:    ['#a9afb6', 1.0, 0.26],  idlerGear:    ['#a2a8af', 1.0, 0.28],  camGear: ['#b4bac1', 1.0, 0.24], pumpGear: ['#a9afb6', 1.0, 0.26],
  tappet:       ['#d4d8dd', 1.0, 0.16],  pushrod:      ['#9aa1a9', 1.0, 0.25],
  rocker:       ['#7b828b', 0.9, 0.38],  rockerShaft:  ['#d0d4d9', 1.0, 0.16],  adjScrew: ['#5a6068', 1.0, 0.3],
  valveIn:      ['#c3c7cc', 1.0, 0.2],   valveEx:      ['#a28b72', 0.95, 0.32],
  spring:       ['#3d6b55', 0.6, 0.38],  retainer:     ['#9ea4ab', 1.0, 0.28],
  injector:     ['#b7bcc2', 0.9, 0.3],   hpLine:       ['#c8ccd1', 1.0, 0.22],
  pumpCam:      ['#d0d4d9', 1.0, 0.16],  plunger:      ['#e6e9ec', 1.0, 0.1],
  turbineWheel: ['#5b5550', 0.9, 0.42],  compWheel:    ['#d8dbdf', 1.0, 0.16],  turboCore: ['#6a6f76', 0.85, 0.5],
  fanBlade:     ['#26292e', 0.15, 0.55], fanHub:       ['#3b3f45', 0.6, 0.45],  coupling: ['#8c939b', 0.85, 0.42],
  vbelt:        ['#1e2024', 0.0, 0.85],  altBody:      ['#b8bdc2', 0.8, 0.42],  altPulley: ['#8f959c', 1.0, 0.32],
  oilGear:      ['#9aa0a7', 1.0, 0.3],   pickup:       ['#7f858c', 0.9, 0.45],  strainer: ['#5a5f66', 0.8, 0.6],
  starterBody:  ['#2f3338', 0.5, 0.45],  gasket:       ['#a3a7ad', 0.85, 0.42],
};
const NODES = {
  crankForged:  ['#d99a2b', 0.85, 0.38], crankJournal: ['#f1d18a', 1.0, 0.16], noseBolt: ['#c9a24d', 1.0, 0.35],
  flywheel:     ['#4f5a68', 0.8, 0.5],   flywheelFace: ['#9fb0c4', 1.0, 0.25], ringGear: ['#c7d2de', 1.0, 0.3],
  damper:       ['#7a4d21', 0.4, 0.5],   crankPulley:  ['#e2553f', 0.7, 0.35],
  rod:          ['#3d74d9', 0.7, 0.32],  rodBolt:      ['#1e3b75', 0.8, 0.4],   rodBush: ['#e5b462', 1.0, 0.3],
  bearingMain:  ['#e7b85c', 1.0, 0.25],  bearingRod:   ['#e7b85c', 1.0, 0.25],  thrust:  ['#f08a3a', 0.9, 0.3],
  piston:       ['#d7dbe0', 0.65, 0.38], ring:         ['#e2553f', 0.6, 0.35],  pin:     ['#62c3e8', 0.8, 0.2],
  liner:        ['#6d8fb8', 0.6, 0.45],  linerBore:    ['#a9c3e2', 0.9, 0.25],  oring:   ['#2a2d33', 0.0, 0.6],
  camshaft:     ['#7b5ad6', 0.75, 0.4],  camLobe:      ['#b9a2ff', 0.9, 0.2],
  crankGear:    ['#e2553f', 0.7, 0.35],  idlerGear:    ['#f07f5a', 0.7, 0.35],  camGear: ['#e2553f', 0.7, 0.35], pumpGear: ['#ff9b72', 0.7, 0.35],
  tappet:       ['#9be0c8', 0.9, 0.2],   pushrod:      ['#56c7a8', 0.8, 0.28],
  rocker:       ['#8a6ee0', 0.7, 0.35],  rockerShaft:  ['#c9bbff', 0.9, 0.2],   adjScrew: ['#4a3a8a', 0.9, 0.35],
  valveIn:      ['#2bb5c9', 0.8, 0.25],  valveEx:      ['#e0783a', 0.8, 0.3],
  spring:       ['#7cc75a', 0.45, 0.35], retainer:     ['#2a8f6a', 0.8, 0.3],
  injector:     ['#58b368', 0.7, 0.35],  hpLine:       ['#8fd694', 0.8, 0.3],
  pumpCam:      ['#b8f2a6', 0.9, 0.2],   plunger:      ['#e6ffd9', 0.9, 0.15],
  turbineWheel: ['#c25b2e', 0.8, 0.4],   compWheel:    ['#3fb3d9', 0.9, 0.25],  turboCore: ['#2e6f8a', 0.6, 0.45],
  fanBlade:     ['#3fb3d9', 0.3, 0.45],  fanHub:       ['#1f5f78', 0.6, 0.45],  coupling: ['#5fc9e8', 0.7, 0.4],
  vbelt:        ['#24272c', 0.0, 0.8],   altBody:      ['#9aa7b8', 0.6, 0.45],  altPulley: ['#e2553f', 0.7, 0.35],
  oilGear:      ['#ffcf73', 0.9, 0.3],   pickup:       ['#e9973d', 0.6, 0.4],   strainer: ['#a86a24', 0.6, 0.55],
  starterBody:  ['#59616d', 0.5, 0.45],  gasket:       ['#8d96a3', 0.6, 0.5],
};
M.palettes = { metal: METAL, nodes: NODES };
M.paletteName = 'metal';

const DOUBLE = new Set(['bearingMain', 'bearingRod', 'thrust', 'piston', 'ring', 'strainer', 'gasket', 'rodBush', 'oring', 'liner', 'linerBore']);
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
const GHOSTS = ['block', 'head', 'cover', 'pan', 'flyhousing', 'frontcover', 'intake', 'exhaust', 'turbo', 'pump', 'oilpump', 'ports'];
GHOSTS.forEach(k => {
  M.ghost[k] = new THREE.MeshStandardMaterial({ color: srgb('#5d78d9'), metalness: 0.1, roughness: 0.6,
    transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  M.ghost[k].userData.key = 'ghost-' + k;
  M.ghost[k].userData.baseOpacity = 0.06;
  M.ghostEdges[k] = new THREE.LineBasicMaterial({ color: srgb('#2638b8'), transparent: true, opacity: 0.45, depthWrite: false });
  M.ghostEdges[k].userData.baseOpacity = 0.45;
});
[['ports', 0.11], ['turbo', 0.16], ['pump', 0.2], ['oilpump', 0.24], ['intake', 0.08], ['exhaust', 0.12]].forEach(([k, o]) => {
  M.ghost[k].userData.baseOpacity = o; M.ghost[k].opacity = o;
});
M.setInk = function (dark) {
  const fill = srgb(dark ? '#5b7fe0' : '#4a66cc'), edge = srgb(dark ? '#9fbcff' : '#2235b0');
  GHOSTS.forEach(k => { M.ghost[k].color.copy(fill); M.ghostEdges[k].color.copy(edge);
    M.ghostEdges[k].userData.baseOpacity = dark ? 0.38 : 0.45; M.ghostEdges[k].opacity = M.ghostEdges[k].userData.baseOpacity; });
};

/* ---------------- the model's specification ---------------- */
M.parts = {
  block:      { pos: '1',  name: 'Блок цилиндров', qty: '1', layer: 'housing', ghost: ['block'],
                desc: 'Блок V-образный с развалом 90°. Гильзы мокрые, распредвал — в развале над коленвалом. Показан прозрачным.' },
  head:       { pos: '2',  name: 'Головка цилиндра', qty: '8', layer: 'housing', ghost: ['head', 'ports'],
                desc: 'Отдельная головка на каждый цилиндр: два клапана, форсунка, впускной канал со стороны развала, выпускной — снаружи. Обе стороны ставятся одинаковые головки, развёрнутые на 180°.' },
  crank:      { pos: '3',  name: 'Вал коленчатый', qty: '1', layer: 'crank', mats: ['crankForged', 'crankJournal', 'noseBolt'],
                desc: 'Пять коренных и четыре шатунные шейки Ø80, радиус кривошипа 65 мм (ход 130). Кривошипы в двух плоскостях под 90°: 1 и 4 напротив друг друга, 2 и 3 тоже. На каждой шейке — два шатуна.' },
  rod:        { pos: '4',  name: 'Шатун', qty: '8', layer: 'pistons', mats: ['rod', 'rodBolt', 'rodBush'],
                desc: 'Межосевое расстояние 250 мм. Шатуны левого и правого ряда сидят рядом на одной шейке — поэтому ряды сдвинуты вдоль вала на 37 мм.' },
  piston:     { pos: '5',  name: 'Поршень', qty: '8', layer: 'pistons', mats: ['piston'],
                desc: 'Ø125, камера сгорания в днище (тороидальная, «ω»), выточки под клапаны глубиной 4 мм — в перекрытии клапаны не касаются поршня (запас не менее 4,4 мм).' },
  flywheel:   { pos: '6',  name: 'Маховик с венцом', qty: '1', layer: 'flywheel', mats: ['flywheel', 'flywheelFace', 'ringGear'],
                desc: 'Ø480 с зубчатым венцом стартера. Стоит за задним торцом блока, за шестернями привода.' },
  turbo:      { pos: '7',  name: 'Турбокомпрессор', qty: '2', layer: 'air', ghost: ['turbo'], mats: ['turbineWheel', 'compWheel', 'turboCore'],
                desc: 'По одному на ряд. Отработавшие газы крутят колесо турбины, на одном валу с ним — колесо компрессора, которое нагнетает воздух во впускной трубопровод. На экране ротор замедлен сильнее всего: на деле он вращается в 40–50 раз быстрее коленвала.' },
  injPump:    { pos: '8',  name: 'Насос топливный высокого давления', qty: '1', layer: 'fuel', ghost: ['pump'], mats: ['pumpCam', 'plunger'],
                desc: 'V-образный, 8 секций. Вал насоса вращается вдвое медленнее коленвала; каждый плунжер подаёт топливо к своей форсунке за 16° до ВМТ такта сжатия.' },
  oilPump:    { pos: '9',  name: 'Насос масляный', qty: '1', layer: 'aux', ghost: ['oilpump'], mats: ['oilGear'],
                desc: 'Шестерённый, внизу у переднего торца. Приводится шестернёй на носке коленвала 1 : 1.' },
  fan:        { pos: '10', name: 'Вентилятор с гидромуфтой', qty: '1', layer: 'aux', mats: ['fanBlade', 'fanHub', 'coupling'],
                desc: 'Вентилятор Ø600 на выходном валу гидромуфты. Входной шкив вращается ремнём, сам вентилятор отстаёт на 3 % — это проскальзывание муфты.' },
  alternator: { pos: '11', name: 'Генератор', qty: '1', layer: 'aux', mats: ['altBody', 'altPulley'],
                desc: 'Шкив Ø80 против Ø190 у коленвала — генератор вращается в 2,4 раза быстрее.' },
  starter:    { pos: '12', name: 'Стартер', qty: '1', layer: 'aux', mats: ['starterBody'],
                desc: 'На картере маховика; при пуске шестерня стартера входит в венец маховика.' },
  camshaft:   { pos: '13', name: 'Вал распределительный', qty: '1', layer: 'valvetrain', mats: ['camshaft', 'camLobe'],
                desc: 'Один вал на оба ряда, 16 кулачков, 5 опор. Подъём кулачка 8,5 мм; профиль рассчитан под плоский толкатель. Фазы: впуск 13° до ВМТ — 49° после НМТ, выпуск 66° до НМТ — 10° после ВМТ.' },
  crankGear:  { pos: '14', name: 'Шестерня коленчатого вала', qty: '1', layer: 'gears', mats: ['crankGear'],
                desc: 'z = 24, модуль 4. Начало цепочки шестерён на заднем торце блока.' },
  idlerGear:  { pos: '15', name: 'Шестерня промежуточная', qty: '1', layer: 'gears', mats: ['idlerGear'],
                desc: 'z = 30. Меняет направление вращения, так что распредвал крутится в ту же сторону, что и коленвал.' },
  camGear:    { pos: '16', name: 'Шестерня распределительного вала', qty: '1', layer: 'gears', mats: ['camGear'],
                desc: 'z = 48 — вдвое больше шестерни коленвала, отсюда передаточное отношение 2 : 1.' },
  pumpGear:   { pos: '17', name: 'Шестерня привода ТНВД', qty: '1', layer: 'gears', mats: ['pumpGear'],
                desc: 'z = 48, в зацеплении с шестернёй распредвала: вал насоса делает пол-оборота на оборот коленвала.' },
  tappet:     { pos: '18', name: 'Толкатель', qty: '16', layer: 'valvetrain', mats: ['tappet'],
                desc: 'Грибовидный, с плоской тарелкой. Ось толкателя параллельна оси цилиндра своего ряда.' },
  pushrod:    { pos: '19', name: 'Штанга толкателя', qty: '16', layer: 'valvetrain', mats: ['pushrod'],
                desc: 'Длина 363 мм между центрами сфер. Положение коромысла рассчитывается из условия, что длина штанги не меняется.' },
  rocker:     { pos: '20', name: 'Коромысло с осью', qty: '16', layer: 'valvetrain', mats: ['rocker', 'rockerShaft', 'adjScrew'],
                desc: 'Плечи 40 и 59 мм: подъём клапана в 1,47 раза больше подъёма кулачка (12,5 мм против 8,5).' },
  valveIn:    { pos: '21', name: 'Клапан впускной', qty: '8', layer: 'valvetrain', mats: ['valveIn'],
                desc: 'Тарелка Ø46.' },
  valveEx:    { pos: '22', name: 'Клапан выпускной', qty: '8', layer: 'valvetrain', mats: ['valveEx'],
                desc: 'Тарелка Ø40, работает горячее впускного.' },
  springs:    { pos: '23', name: 'Пружины клапанов', qty: '32', layer: 'valvetrain', mats: ['spring', 'retainer'],
                desc: 'Наружная и внутренняя на каждом клапане, сверху тарелка с сухарями.' },
  liner:      { pos: '24', name: 'Гильза цилиндра', qty: '8', layer: 'pistons', mats: ['liner', 'linerBore', 'oring'],
                desc: '«Мокрая» гильза Ø125: снаружи омывается охлаждающей жидкостью, внизу уплотнена резиновыми кольцами.' },
  pin:        { pos: '25', name: 'Палец поршневой', qty: '8', layer: 'pistons', mats: ['pin'],
                desc: 'Плавающий, Ø50, со стопорными кольцами.' },
  cover:      { pos: '26', name: 'Крышка головки цилиндра', qty: '8', layer: 'housing', ghost: ['cover'],
                desc: 'Закрывает коромысла и пружины своего цилиндра.' },
  pan:        { pos: '27', name: 'Поддон картера', qty: '1', layer: 'housing', ghost: ['pan'],
                desc: 'Глубокая часть впереди, под маслоприёмником.' },
  flyhousing: { pos: '28', name: 'Картер маховика', qty: '1', layer: 'housing', ghost: ['flyhousing'],
                desc: 'Закрывает шестерни привода и маховик; на нём стоит стартер.' },
  intake:     { pos: '29', name: 'Трубопровод впускной', qty: '1', layer: 'air', ghost: ['intake'],
                desc: 'Ресивер в развале блока с патрубками к каждой головке; воздух в него нагнетают турбокомпрессоры.' },
  exhaust:    { pos: '30', name: 'Коллектор выпускной', qty: '2', layer: 'air', ghost: ['exhaust'],
                desc: 'По наружной стороне каждого ряда, ведёт газы к турбине своего ряда.' },
  pickup:     { pos: '31', name: 'Маслоприёмник', qty: '1', layer: 'aux', mats: ['pickup', 'strainer'],
                desc: 'Трубка с сеткой в глубокой части поддона.' },
  pulley:     { pos: '32', name: 'Шкив коленвала с гасителем', qty: '1', layer: 'aux', mats: ['crankPulley', 'damper'],
                desc: 'Двухручьевой шкив Ø190 и гаситель крутильных колебаний на носке вала.' },
  belt:       { pos: '33', name: 'Ремни привода', qty: '2', layer: 'aux', mats: ['vbelt'],
                desc: 'Два клиновых ремня: коленвал → генератор → гидромуфта вентилятора. Длина по расчёту 1288 мм.' },
  bearingMain:{ pos: '34', name: 'Вкладыши коренные', qty: '5 компл.', layer: 'crank', mats: ['bearingMain'],
                desc: 'Пять пар вкладышей коренных опор.' },
  bearingRod: { pos: '35', name: 'Вкладыши шатунные', qty: '8 компл.', layer: 'pistons', mats: ['bearingRod'],
                desc: 'По паре на каждый шатун; на одной шейке работают два шатуна.' },
  thrust:     { pos: '36', name: 'Полукольца упорные', qty: '4', layer: 'crank', mats: ['thrust'],
                desc: 'У задней коренной опоры, держат вал от осевого смещения.' },
  rings:      { pos: '37', name: 'Кольца поршневые', qty: '8 компл.', layer: 'pistons', mats: ['ring'],
                desc: 'Два компрессионных и маслосъёмное на каждом поршне.' },
  injector:   { pos: '38', name: 'Форсунка', qty: '8', layer: 'fuel', mats: ['injector'],
                desc: 'Распылитель с четырьмя отверстиями направлен в камеру в днище поршня.' },
  hpLines:    { pos: '39', name: 'Трубки высокого давления', qty: '8', layer: 'fuel', mats: ['hpLine'],
                desc: 'От секций ТНВД к форсункам. Подсвечиваются в момент подачи топлива в свой цилиндр.' },
  gasket:     { pos: '40', name: 'Прокладка головки', qty: '8', layer: 'housing', mats: ['gasket'],
                desc: 'Под каждой головкой своя металлоасбестовая прокладка с окантовкой отверстия под гильзу.' },
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

window.MAT_V8 = M;
})();
