/* ui.js — the page: main menu with the three engine tabs, and one controller per engine (built
   lazily the first time its tab opens). A controller owns its own copy of the drawing-sheet
   layout: animation loop, transport (play / step / scrub the crank angle), readouts and charts,
   the specification table ↔ 3D selection, hover/click picking and the leader callouts (выноски).
   Engine-specific numbers, labels and anchor points live in PROFILES. */
(function () {
'use strict';
const V3 = THREE.Vector3;
const DEG = Math.PI / 180;
const NS = 'http://www.w3.org/2000/svg';
const STROKE_VAR = { intake: '--intake', compression: '--compression', power: '--power', exhaust: '--exhaust' };
const fmt = (v, d) => v.toFixed(d).replace('.', ',');
const local = (objFn, x, y, z) => s => new V3(x, y, z * s).applyMatrix4(objFn(s).matrixWorld);
const fixed = (x, y, z) => s => new V3(x, y, z === undefined ? 0 : z * s);
const at = (x, y, z) => () => new V3(x, y, z);

/* ================================================================ profiles ==== */
const PROFILES = {
  i4: {
    E: () => window.ENG_I4, M: () => window.MAT_I4, ENGINE: () => window.ENGINE_I4,
    title: 'Рядный 4-цилиндровый, 16 клапанов', code: 'КП.2011.00.00.00.СБ · 3D',
    stamp: ['КП.2011.00.00.00.СБ', 'Рядный двигатель<br>четырёхцилиндровый'],
    specLine: E => `<span><b>Ø72 × 69</b> мм</span><span><b>${Math.round(E.displacementCC)}</b> см³</span><span>ε <b>10,5</b></span><span><b>DOHC 16V</b></span><span>порядок <b>1-3-4-2</b></span>`,
    rpm: { min: 700, max: 6500, step: 50, def: 2400 }, slow: [200, 60, 20], slowDef: 60,
    nCyl: 4, compact: false,
    views: [['iso', 'Общий'], ['front', 'Привод ГРМ'], ['side', 'Продольный'], ['head', 'Головка'], ['top', 'Сверху']],
    housing: [['ghost', 'Прозрачный корпус'], ['long', 'Разрез А–А'], ['trans', 'Разрез Б–Б'], ['off', 'Без корпуса']],
    layers: [['crank', 'Коленвал, маховик'], ['pistons', 'Поршни, шатуны'], ['valvetrain', 'Распредвалы, клапаны'],
      ['timing', 'Ремень ГРМ, шкивы'], ['aux', 'Смазка, охлаждение, топливо'], ['gas', 'Газы и потоки']],
    extraToggle: { label: 'Кожух ремня ГРМ', set: (EN, on) => EN.setTimingCover(on) },
    specGroups: [
      ['Сборочные единицы', ['block', 'crank', 'rod', 'head', 'flywheel', 'pickup', 'oilPump', 'pan']],
      ['Детали', ['camPulley', 'crankPulley', 'camshaft', 'pin', 'cover', 'gasket']],
      ['Прочие изделия', ['outlet', 'bearingRod', 'bearingMain', 'thrust', 'tensioner', 'belt', 'accPulley', 'rings', 'coolantPump', 'oilFilter', 'knock']],
      ['Без позиции, в составе сборок', ['piston', 'valveIn', 'valveEx', 'springs', 'tappet', 'spark', 'fuel', 'dipstick']],
    ],
    lifts: (EN, c) => [EN.vt.lifts[c * 2], EN.vt.lifts[8 + c * 2]],
    lift: { yMax: 9, yTicks: [0, 2, 4, 6, 8], marker: { at: 352, label: 'искра' }, fn: E => (s, a) => E.liftAtPhase(s === 'in' ? -1 : 1, a) },
    liftLegend: '<span><i style="background:var(--intake)"></i>впускные клапаны</span><span><i style="background:var(--power)"></i>выпускные клапаны</span><span><i style="background:var(--ink)"></i>поршень</span>',
    pv: { vMax: 330, vTicks: [0, 100, 200, 300], pLo: 0.5, pHi: 100, pTicks: [0.5, 1, 2, 5, 10, 20, 50, 100] },
    silhouette: { x: [-277, 266], y: [-170, 400], z: [-176, 176], c: [-10, 110, 0] },
    footer: 'Размеры сняты с чертежа КП.2011.00.00.00.СБ. Кинематика точная: профиль кулачков задаёт подъём клапанов, ремень длиной ровно 137 зубьев. Термодинамика — упрощённый цикл Отто.',
    callouts(E, EN) {
      const sol = EN.sol, pul = k => sol.pulleys.find(p => p.key === k);
      const runEx = sol.path.pieces.find(pc => pc.type === 'seg' && pc.k === 3);
      const beltPt = runEx ? new V3(E.beltX, runEx.p1.u + runEx.du * runEx.len * 0.5, runEx.p1.v + runEx.dv * runEx.len * 0.5) : new V3(E.beltX, 200, 110);
      return [
        ['1', 'block', fixed(120, 120, 73)], ['2', 'crank', local(() => EN.crank.group, -149, -50, 0)], ['3', 'rod', local(() => EN.pist.rods[2], 8.5, 70, 0)],
        ['4', 'head', fixed(40, 300, 109)], ['5', 'flywheel', fixed(224, 70, 70)], ['6', 'pickup', fixed(-150, -126, 0)],
        ['7', 'oilPump', fixed(-202, -40, 42)], ['8', 'pan', fixed(-60, -150, 80)], ['9', 'camPulley', s => new V3(E.beltX - 13, E.camY + 42, s * E.camZ)],
        ['10', 'crankPulley', fixed(E.beltX - 14, -26, 6)], ['11', 'camshaft', s => new V3(52, E.camY + 10, s * E.camZ)],
        ['12', 'pin', local(() => EN.pist.pistons[0], 29.5, -33, 0)], ['13', 'cover', fixed(-90, 379, 70)],
        ['14–16', 'gasket', fixed(160, 191, 84)], ['17', 'outlet', fixed(250, 248, -30)],
        ['18', 'bearingRod', local(() => EN.pist.rods[1], 10, -12, 18)], ['19', 'bearingMain', fixed(86, -22, 12)],
        ['20', 'thrust', fixed(-11, 30, 8)], ['21', 'tensioner', () => new V3(E.beltX - 13, pul('tens').u, pul('tens').v)],
        ['22', 'belt', () => beltPt], ['23', 'accPulley', fixed(-264, 55, 20)], ['24', 'rings', local(() => EN.pist.pistons[3], 0, -5.8, 36)],
        ['25', 'coolantPump', () => new V3(-198, pul('pump').u + 40, pul('pump').v + 26)], ['26', 'oilFilter', () => new V3(-40, 35 - 50 * Math.sin(22 * DEG), 79 + 50 * Math.cos(22 * DEG))],
        ['27', 'knock', () => new V3(0, 126, -86)],
      ];
    },
  },

  v8: {
    E: () => window.ENG_V8, M: () => window.MAT_V8, ENGINE: () => window.ENGINE_V8,
    title: 'V-образный 8-цилиндровый дизель', code: 'ДВС КР 09.00.00.00 СБ · 3D',
    stamp: ['ДВС КР 09.00.00.00 СБ', 'Двигатель V-образный<br>восьмицилиндровый'],
    specLine: E => `<span><b>Ø125 × 130</b> мм</span><span><b>${Math.round(E.displacementCC).toLocaleString('ru-RU')}</b> см³</span><span>ε <b>17</b></span><span><b>V8 90°, OHV 16V</b></span><span>порядок <b>1-5-4-2-6-3-7-8</b></span>`,
    rpm: { min: 600, max: 2600, step: 50, def: 1400 }, slow: [60, 30, 10], slowDef: 30,
    nCyl: 8, compact: true,
    views: [['iso', 'Общий'], ['front', 'Спереди'], ['gears', 'Шестерни'], ['side', 'Сбоку'], ['top', 'Сверху']],
    // the rear gear train sits behind the flywheel: that view takes the flywheel off
    onView: (v, api) => { if (v === 'gears') api.setLayer('flywheel', false); },
    housing: [['ghost', 'Прозрачный корпус'], ['long', 'Разрез А–А'], ['trans', 'Разрез Б–Б'], ['off', 'Без корпуса']],
    layers: [['crank', 'Коленвал, вкладыши'], ['flywheel', 'Маховик'], ['pistons', 'Поршни, шатуны, гильзы'], ['valvetrain', 'Распредвал, клапаны'],
      ['gears', 'Шестерни привода'], ['fuel', 'ТНВД, форсунки'], ['air', 'Наддув, коллекторы'], ['aux', 'Вентилятор, генератор, смазка'], ['gas', 'Газы и потоки']],
    specGroups: [
      ['Сборочные единицы', ['block', 'head', 'crank', 'rod', 'piston', 'flywheel', 'turbo', 'injPump', 'oilPump', 'fan', 'alternator', 'starter']],
      ['Детали', ['camshaft', 'crankGear', 'idlerGear', 'camGear', 'pumpGear', 'tappet', 'pushrod', 'rocker', 'valveIn', 'valveEx', 'springs',
        'liner', 'pin', 'cover', 'pan', 'flyhousing', 'intake', 'exhaust', 'pickup', 'pulley']],
      ['Прочие изделия', ['belt', 'bearingMain', 'bearingRod', 'thrust', 'rings', 'injector', 'hpLines', 'gasket']],
    ],
    lifts: (EN, c) => [EN.vt.lifts[c], EN.vt.lifts[8 + c]],
    lift: { yMax: 14, yTicks: [0, 4, 8, 12], marker: { from: 344, to: 368, label: 'впрыск' }, fn: E => (s, a) => E.valveLiftAtPhase(s, a) },
    liftLegend: '<span><i style="background:var(--intake)"></i>впускные клапаны</span><span><i style="background:var(--power)"></i>выпускные клапаны</span><span><i style="background:var(--ink)"></i>поршень</span><span><i style="background:var(--accent);opacity:.35"></i>впрыск топлива</span>',
    pv: { vMax: 1800, vTicks: [0, 500, 1000, 1500], pLo: 1, pHi: 160, pTicks: [1, 2, 5, 10, 20, 50, 100] },
    silhouette: { x: [-611, 640], y: [-377, 620], z: [-430, 430], c: [0, 150, 0] },
    footer: 'Размеры сняты с чертежа ДВС КР 09.00.00.00 СБ. На чертеже нет таблицы спецификации, поэтому нумерация позиций — своя. Кинематика точная: профиль кулачков задаёт подъём толкателей, угол коромысла — из постоянной длины штанги, все шестерни в зацеплении, ремни на точной касательной. Термодинамика — упрощённый смешанный цикл дизеля.',
    callouts(E, EN) {
      const cyl = (s, k) => (s > 0 ? 4 : 0) + k;                        // the bank nearer the viewer
      const L = (k, lx, a, sv) => s => BUILD_V8.local(E, cyl(s, k), lx, a, sv);
      const local = (objFn, x, y, z) => s => new V3(x, y, z).applyMatrix4(objFn(s).matrixWorld);   // bank frames don't mirror
      const lift = (s, k, side) => EN.vt.lifts[(side === 'in' ? 0 : 8) + cyl(s, k)];
      const camL = (s, k) => EN.vt.camLifts[cyl(s, k)];
      const run = EN.aux.beltPath.pieces[EN.aux.beltPath.pieces.length - 1];
      const beltPt = new V3(E.beltX - 8, run.p1.u + run.du * run.len * 0.5, run.p1.v + run.dv * run.len * 0.5);
      return [
        ['1', 'block', fixed(-150, 150, 282)], ['2', 'head', L(1, 20, 478, -95)],
        ['3', 'crank', local(() => EN.crank.group, -30, -105, 0)], ['4', 'rod', local(s => EN.pist.rods[cyl(s, 1)], 0, 130, 0)],
        ['5', 'piston', local(s => EN.pist.pistons[cyl(s, 2)], 0, -70, -62)], ['6', 'flywheel', fixed(431, 175, 165)],
        ['7', 'turbo', fixed(585, 520, 150)], ['8', 'injPump', at(40, 425, 0)], ['9', 'oilPump', at(-337, -160, 50)],
        ['10', 'fan', at(-592, 470, 60)], ['11', 'alternator', at(-410, 222, -232)], ['12', 'starter', at(270, -120, -292)],
        ['13', 'camshaft', at(-170, 195, 0)], ['14', 'crankGear', fixed(388, 20, 46)], ['15', 'idlerGear', at(388, 86, -128)],
        ['16', 'camGear', at(388, 238, 60)], ['17', 'pumpGear', at(388, 430, 60)],
        ['18', 'tappet', s => BUILD_V8.local(E, cyl(s, 0), -30, E.camA + E.camBase + camL(s, 0) + 40, E.camS)],
        ['19', 'pushrod', s => BUILD_V8.local(E, cyl(s, 1), -30, 360, E.camS)],
        ['20', 'rocker', L(2, 30, E.rockerP.a + 15, E.rockerP.s)],
        ['21', 'valveIn', s => BUILD_V8.local(E, cyl(s, 1), -30, 505 - lift(s, 1, 'in'), E.valveS)],
        ['22', 'valveEx', s => BUILD_V8.local(E, cyl(s, 2), 30, 505 - lift(s, 2, 'ex'), E.valveS)],
        ['23', 'springs', L(3, 30, 540, E.valveS - 18)], ['24', 'liner', L(2, 0, 300, -72)],
        ['25', 'pin', local(s => EN.pist.pistons[cyl(s, 1)], 52, -E.compH, 0)], ['26', 'cover', L(3, 0, 618, 40)],
        ['27', 'pan', fixed(-250, -300, 150)], ['28', 'flyhousing', fixed(378, 330, 100)], ['29', 'intake', fixed(-100, 452, 209)],
        ['30', 'exhaust', fixed(0, 267, 420)], ['31', 'pickup', at(-260, -338, 11)], ['32', 'pulley', at(-478, -70, -70)],
        ['33', 'belt', () => beltPt], ['34', 'bearingMain', fixed(170, -40, 26)],
        ['35', 'bearingRod', local(s => EN.pist.rods[cyl(s, 0)], 0, -40, 14)], ['36', 'thrust', fixed(320, 58, 22)],
        ['37', 'rings', local(s => EN.pist.pistons[cyl(s, 3)], 0, -12.5, -62)], ['38', 'injector', L(0, 0, 560, 38)],
        ['39', 'hpLines', s => EN.fuel.lines[cyl(s, 1)].getPointAt(0.55)], ['40', 'gasket', L(3, 70, 414.2, -95)],
      ];
    },
  },

  b4: {
    E: () => window.ENG_B4, M: () => window.MAT_B4, ENGINE: () => window.ENGINE_B4,
    title: 'Оппозитный 4-цилиндровый, 16 клапанов', code: 'Сборочный чертёж, 4 листа · 3D',
    stamp: ['Лит. Д · М 1:1 · листов 4', 'Двигатель оппозитный<br>четырёхцилиндровый'],
    specLine: E => `<span><b>Ø83 × 83</b> мм</span><span><b>${Math.round(E.displacementCC).toLocaleString('ru-RU')}</b> см³</span><span>ε <b>10</b></span><span><b>SOHC 16V</b></span><span>порядок <b>1-3-2-4</b></span>`,
    rpm: { min: 700, max: 6500, step: 50, def: 2400 }, slow: [200, 60, 20], slowDef: 60,
    nCyl: 4, compact: false,
    views: [['iso', 'Общий'], ['front', 'Привод ГРМ'], ['head', 'Головка'], ['top', 'Сверху'], ['low', 'Снизу']],
    housing: [['ghost', 'Прозрачный корпус'], ['long', 'Разрез А–А'], ['trans', 'Разрез Б–Б'], ['off', 'Без корпуса']],
    layers: [['crank', 'Коленвал, маховик'], ['pistons', 'Поршни, шатуны'], ['valvetrain', 'Распредвалы, коромысла, клапаны'],
      ['timing', 'Ремень ГРМ, ролики, насос'], ['air', 'Впуск, выпуск, форсунки'], ['aux', 'Смазка, свечи, опоры'], ['gas', 'Газы и потоки']],
    extraToggle: { label: 'Крышка ремня ГРМ (поз. 17)', set: (EN, on) => EN.setTimingCover(on) },
    specGroups: [
      ['Позиции с выносок чертежа', ['crank', 'block', 'headGasket', 'piston', 'flywheel', 'mount', 'sensor', 'crankSprocket', 'headL', 'headR', 'belt',
        'oilPump', 'tcover', 'idler', 'pickup', 'pan', 'oilFilter', 'intake', 'injector', 'pump', 'caseBolt', 'headBolt']],
      ['Без позиции, в составе сборок', ['rod', 'pin', 'rings', 'bearingRod', 'bearingMain', 'thrust', 'camshaft', 'camPulley', 'rocker', 'rockerShaft',
        'valveIn', 'valveEx', 'springs', 'tensioner', 'spark', 'exhaust', 'cover']],
    ],
    lifts: (EN, c) => [EN.vt.lifts[c * 2], EN.vt.lifts[8 + c * 2]],
    lift: { yMax: 11, yTicks: [0, 2, 4, 6, 8, 10], marker: { at: 350, label: 'искра' }, fn: E => (s, a) => E.valveLiftAtPhase(s, a) },
    liftLegend: '<span><i style="background:var(--intake)"></i>впускные клапаны</span><span><i style="background:var(--power)"></i>выпускные клапаны</span><span><i style="background:var(--ink)"></i>поршень</span>',
    pv: { vMax: 550, vTicks: [0, 100, 200, 300, 400, 500], pLo: 0.5, pHi: 100, pTicks: [0.5, 1, 2, 5, 10, 20, 50, 100] },
    silhouette: { x: [-212, 300], y: [-262, 218], z: [-390, 390], c: [-10, -20, 0] },
    footer: 'Размеры сняты с четырёх листов сборочного чертежа (М 1:1): вид А на привод ГРМ, поперечный и продольный разрезы, вид Б на головку. Спецификации на чертеже нет: номера взяты с выносок, названия деталей — по их виду и месту. Кинематика точная: каждый кулачок построен как огибающая площадки своего коромысла, ремень — ровно 201 зуб на касательных. Термодинамика — упрощённый цикл Отто.',
    callouts(E, EN) {
      const near = (s, r, l) => (s > 0 ? l : r);                       // the bank nearer the viewer
      const pul = k => EN.sol.pulleys.find(p => p.key === k);
      const run = EN.sol.path.pieces.find(pc => pc.type === 'seg' && pc.k === 0);
      const beltPt = new V3(E.beltX - 13, run.p1.u + run.du * run.len * 0.5, run.p1.v + run.dv * run.len * 0.5);
      const onPiston = s => new V3(0, -16, 41.4).applyMatrix4(EN.pist.pistons[near(s, 0, 1)].matrixWorld);
      const inj = s => { const c = near(s, 2, 3); return EN.air.injTips[c].clone().addScaledVector(EN.air.injAxis[c], 30); };
      return [
        ['1', 'crank', local(() => EN.crank.group, 54, 30, 0)], ['2', 'block', s => new V3(40, 80, s * 160)],
        ['3', 'headGasket', s => new V3(-10, 72, s * 218.6)], ['4', 'piston', onPiston],
        ['6', 'flywheel', s => new V3(176, 140, s * 90)], ['7', 'mount', s => new V3(20, -150, s * 196)],
        ['8', 'sensor', at(-108, -112, -146)], ['10', 'crankSprocket', at(E.beltX - 15, 20, -16)],
        ['12', 'headL', at(60, 92, 286)], ['13', 'headR', at(-60, 92, -286)],
        ['14', 'belt', () => beltPt], ['15', 'oilPump', at(E.oilPumpX[0], -70, 40)], ['17', 'tcover', at(-212, 40, -160)],
        ['18', 'idler', () => new V3(E.beltX - 15, pul('idler1').u + 14, pul('idler1').v)], ['19', 'pickup', at(-78, -182, 20)],
        ['20', 'pan', s => new V3(-70, -262, s * 60)], ['21', 'oilFilter', at(-108, -140, -234)],
        ['22', 'intake', s => new V3(-40, 196, s * 30)], ['23', 'injector', inj],
        ['24', 'pump', () => new V3(E.beltX - 15, pul('pump').u - 18, pul('pump').v + 14)],
        ['34, 35', 'caseBolt', s => new V3(54, 52, s * 130)], ['38', 'headBolt', s => new V3(s > 0 ? 138 : -138, 60, s * 336)],
      ];
    },
  },
};

/* ================================================================ controller ==== */
function mount(key, root) {                    // the sheet layout, filled with this engine's labels
  const P = PROFILES[key], E = P.E();
  root.appendChild(document.getElementById('engineTpl').content.cloneNode(true));
  const $ = r => root.querySelector(`[data-role="${r}"]`);
  $('title').textContent = P.title; $('code').textContent = P.code;
  $('stampCode').textContent = P.stamp[0]; $('stampName').innerHTML = P.stamp[1];
  $('specLine').innerHTML = P.specLine(E);
  $('liftLegend').innerHTML = P.liftLegend;
  $('footer').textContent = P.footer;
}

function createController(key, root, saved, shell) {
  const P = PROFILES[key], E = P.E(), M = P.M();
  const $ = r => root.querySelector(`[data-role="${r}"]`);
  const stage = $('stage'), viewport = $('viewport');
  // per-engine ids for the label ↔ control pairs
  $('angle').id = key + '-angle'; $('angleLabel').htmlFor = key + '-angle';
  $('rpm').id = key + '-rpm'; $('rpmLabel').htmlFor = key + '-rpm';
  const rpmIn = $('rpm');
  Object.assign(rpmIn, { min: P.rpm.min, max: P.rpm.max, step: P.rpm.step });
  const fillSeg = (role, list, attr) => { $(role).innerHTML = list.map(([v, t]) => `<button type="button" data-${attr}="${v}" aria-pressed="false">${t}</button>`).join(''); };
  fillSeg('views', P.views, 'view');
  fillSeg('housing', P.housing, 'mode');
  fillSeg('slow', P.slow.map(v => [v, '×' + v]), 'slow');
  fillSeg('cylSel', Array.from({ length: P.nCyl }, (_, i) => [i, '№' + (i + 1)]), 'cyl');
  $('layers').innerHTML = P.layers.map(([l, t]) => `<label><input type="checkbox" id="${key}-layer-${l}" data-layer="${l}" checked>${t}</label>`).join('') +
    (P.extraToggle ? `<label><input type="checkbox" id="${key}-extra" data-role="extra">${P.extraToggle.label}</label>` : '');

  let EN;
  try { EN = P.ENGINE().init(viewport); }
  catch (e) { $('loading').textContent = 'Не удалось запустить 3D: ' + (e && e.message); console.error(e); return null; }
  $('loading').hidden = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = Object.assign({ rpm: P.rpm.def, slow: P.slowDef, theta: 0, playing: !reduce, cyl: 0, palette: 'metal',
    housing: 'ghost', callouts: stage.clientWidth >= 760, layers: {}, extra: false, view: 'iso' }, saved || {});
  let pendingScrub = null;

  /* ---------------- segmented controls ---------------- */
  const seg = (role, attr, onPick) => {
    const box = $(role);
    box.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset[attr]);
    });
    return v => box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset[attr] === String(v))));
  };
  const api = { setLayer: (layer, on) => { EN.setLayer(layer, on); st.layers[layer] = on; const cb = root.querySelector(`[data-layer="${layer}"]`); if (cb) cb.checked = on; refreshSpecRows(); } };
  const setViewBtn = seg('views', 'view', v => { st.view = v; EN.view(v); if (P.onView) P.onView(v, api); });
  EN.controls.addEventListener('start', () => setViewBtn('__none'));
  const setHousingBtn = seg('housing', 'mode', v => { st.housing = v; EN.setHousing(v); refreshSpecRows(); });
  const setSlowBtn = seg('slow', 'slow', v => { st.slow = Number(v); updateSpeedNote(); });
  const setPalBtn = seg('palette', 'pal', v => { st.palette = v; EN.setPalette(v); });
  const setCylBtn = seg('cylSel', 'cyl', v => selectCyl(Number(v)));

  /* ---------------- engine speed ---------------- */
  const updateSpeedNote = () => { $('realSpeed').textContent = `на экране ${Math.round(st.rpm / st.slow)} об/мин`; };
  const setRpm = v => {
    st.rpm = v; rpmIn.value = v;
    $('rpmOut').firstChild.nodeValue = String(v);
    $('powOut').textContent = `${fmt(E.power(v) / 1000, 1)} (${Math.round(E.power(v) / 735.5)} л.с.)`;
    $('trqOut').textContent = fmt(E.torque(v), 0);
    updateSpeedNote();
  };
  rpmIn.addEventListener('input', () => setRpm(Number(rpmIn.value)));

  /* ---------------- transport ---------------- */
  const playBtn = $('playBtn'), angle = $('angle');
  const setPlaying = p => { st.playing = p; playBtn.textContent = p ? '❚❚' : '▶'; playBtn.setAttribute('aria-label', p ? 'Пауза' : 'Пуск'); };
  playBtn.addEventListener('click', () => setPlaying(!st.playing));
  const step = d => { setPlaying(false); pendingScrub = (pendingScrub === null ? st.theta : pendingScrub) + d * DEG; };
  $('stepBack').addEventListener('click', () => step(-5));
  $('stepFwd').addEventListener('click', () => step(5));
  angle.addEventListener('input', () => {
    setPlaying(false);
    const base = Math.floor(st.theta / (4 * Math.PI)) * 4 * Math.PI;
    pendingScrub = base + Number(angle.value) * DEG;
  });
  const keydown = ev => {
    if (ev.target.closest('input, select, textarea')) return;
    if (ev.code === 'Space') { ev.preventDefault(); setPlaying(!st.playing); }
    else if (ev.key === 'ArrowRight') step(ev.shiftKey ? 30 : 5);
    else if (ev.key === 'ArrowLeft') step(ev.shiftKey ? -30 : -5);
    else if (ev.key === 'Escape') select(null);
  };

  /* ---------------- firing strip + cylinder selection ---------------- */
  const firing = $('firing');
  firing.classList.toggle('compact', P.compact);
  for (let i = 0; i < P.nCyl; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.cyl = i;
    b.innerHTML = P.compact ? `<b>${i + 1}</b><span>—</span><i></i>` : `<b>Цил. ${i + 1}</b><span>—</span><i></i>`;
    b.addEventListener('click', () => selectCyl(i));
    firing.appendChild(b);
  }
  function selectCyl(i) {
    st.cyl = i; setCylBtn(i);
    firing.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.cyl) === i)));
    drawCharts(true);
  }

  /* ---------------- specification table ---------------- */
  const tbody = $('spec').querySelector('tbody');
  P.specGroups.forEach(([title, ids]) => {
    const g = document.createElement('tr'); g.className = 'group';
    g.innerHTML = `<td colspan="3">${title}</td>`; tbody.appendChild(g);
    ids.forEach(id => {
      const p = M.parts[id], tr = document.createElement('tr');
      tr.className = 'row'; tr.dataset.part = id; tr.tabIndex = 0;
      tr.innerHTML = `<td class="pos">${p.pos}</td><td>${p.name}</td><td class="qty">${p.qty}</td>`;
      tr.addEventListener('click', () => select(EN.selected === id ? null : id, true));
      tr.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tr.click(); } });
      tbody.appendChild(tr);
    });
  });
  function refreshSpecRows() {
    tbody.querySelectorAll('tr.row').forEach(tr => {
      const id = tr.dataset.part, p = M.parts[id];
      const hidden = EN.layerOn[p.layer] === false || (p.layer === 'housing' && EN.housingMode === 'off');
      tr.classList.toggle('off', hidden);
      tr.classList.toggle('on', EN.selected === id);
    });
  }

  /* ---------------- selection + part card ---------------- */
  const card = $('partCard');
  function select(id, fromTable) {
    if (id && fromTable) {                          // make sure what was picked in the table can be seen
      const p = M.parts[id];
      if (EN.layerOn[p.layer] === false) api.setLayer(p.layer, true);
      if (p.layer === 'housing' && EN.housingMode === 'off') { EN.setHousing('ghost'); st.housing = 'ghost'; setHousingBtn('ghost'); }
    }
    EN.select(id || null);
    $('pcIsolate').setAttribute('aria-pressed', 'false');
    if (id) {
      const p = M.parts[id];
      $('pcPos').textContent = p.pos === '—' ? '·' : p.pos;
      $('pcName').textContent = p.name;
      $('pcQty').textContent = /компл/.test(p.qty) ? p.qty : `${p.qty} шт.`;
      $('pcDesc').textContent = p.desc;
      card.hidden = false;
      placeCard();
      if (fromTable) EN.focus(id);
    } else card.hidden = true;
    refreshSpecRows();
    const row = tbody.querySelector(`tr[data-part="${id}"]`);
    if (row && !fromTable) row.scrollIntoView({ block: 'nearest' });
  }
  const transportBar = $('transport');
  function placeCard() {                       // float just above the transport bar, whatever it wraps to
    const sr = stage.getBoundingClientRect(), tr = transportBar.getBoundingClientRect();
    card.style.bottom = Math.max(12, sr.bottom - tr.top + 12) + 'px';
  }
  new ResizeObserver(() => { if (!card.hidden) placeCard(); }).observe(stage);
  $('pcClose').addEventListener('click', () => select(null));
  $('pcFocus').addEventListener('click', () => EN.selected && EN.focus(EN.selected));
  $('pcIsolate').addEventListener('click', ev => {
    const on = ev.currentTarget.getAttribute('aria-pressed') !== 'true';
    ev.currentTarget.setAttribute('aria-pressed', String(on));
    EN.isolate(on);
    if (on) EN.focus(EN.selected);
  });

  /* ---------------- layers ---------------- */
  root.querySelectorAll('[data-layer]').forEach(cb => {
    if (st.layers[cb.dataset.layer] === false) { cb.checked = false; EN.setLayer(cb.dataset.layer, false); }
    cb.addEventListener('change', () => { st.layers[cb.dataset.layer] = cb.checked; EN.setLayer(cb.dataset.layer, cb.checked); refreshSpecRows(); });
  });
  if (P.extraToggle) {
    const x = $('extra');
    x.checked = st.extra;
    x.addEventListener('change', () => { st.extra = x.checked; P.extraToggle.set(EN, st.extra); });
    P.extraToggle.set(EN, st.extra);
  }

  /* ---------------- picking ---------------- */
  const canvas = EN.renderer.domElement, tip = $('tip');
  let down = null, lastHover = 0, hoverXY = null;
  const ndc = ev => { const r = canvas.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1, ev.clientX - r.left, ev.clientY - r.top]; };
  const label = part => {
    if (part.startsWith('gas:')) return `<b>Цил. ${Number(part.slice(4)) + 1}</b>рабочее тело`;
    const p = M.parts[part]; if (!p) return null;
    return `<b>${p.pos === '—' ? '' : 'поз. ' + p.pos}</b>${p.name}`;
  };
  canvas.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; tip.hidden = true; });
  canvas.addEventListener('pointerup', ev => {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y); down = null;
    if (moved > 6) return;
    const [nx, ny] = ndc(ev), hit = EN.pick(nx, ny);
    if (hit && hit.part.startsWith('gas:')) { selectCyl(Number(hit.part.slice(4))); return; }
    select(hit && M.parts[hit.part] ? (EN.selected === hit.part ? null : hit.part) : null);
  });
  canvas.addEventListener('pointermove', ev => { if (ev.buttons) { tip.hidden = true; return; } hoverXY = ev; });
  canvas.addEventListener('pointerleave', () => { hoverXY = null; tip.hidden = true; canvas.style.cursor = ''; });
  const hover = now => {
    if (!hoverXY || now - lastHover < 90) return;
    lastHover = now;
    const ev = hoverXY; hoverXY = null;
    const [nx, ny, x, y] = ndc(ev), hit = EN.pick(nx, ny), html = hit && label(hit.part);
    if (html) { tip.innerHTML = html; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false; canvas.style.cursor = 'pointer'; }
    else { tip.hidden = true; canvas.style.cursor = ''; }
  };

  /* ---------------- callouts (выноски) ---------------- */
  const svg = $('callouts');
  const topBar = root.querySelector('.stage-top'), stampEl = $('stamp');
  const calloutBtn = $('calloutBtn');
  const setCallouts = on => { st.callouts = on; calloutBtn.setAttribute('aria-pressed', String(on)); svg.style.display = on ? '' : 'none'; EN.invalidate(); };
  calloutBtn.addEventListener('click', () => setCallouts(!st.callouts));
  const CO = P.callouts(E, EN).map(([pos, part, anchor]) => {
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'co');
    const line = document.createElementNS(NS, 'line'), shelf = document.createElementNS(NS, 'line'), dot = document.createElementNS(NS, 'circle');
    const text = document.createElementNS(NS, 'text'), hit = document.createElementNS(NS, 'rect');
    dot.setAttribute('r', '2.6'); hit.setAttribute('class', 'hit'); hit.setAttribute('width', '34'); hit.setAttribute('height', '24');
    text.textContent = pos;
    g.append(line, shelf, dot, hit, text);
    g.addEventListener('click', () => select(EN.selected === part ? null : part, false));
    svg.appendChild(g);
    return { pos, part, at: anchor, g, line, shelf, dot, text, hit, scr: { x: 0, y: 0 } };
  });
  const tmp = new V3(), S = P.silhouette;
  const partShown = part => (EN.registry.part[part] || []).some(o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  function layoutCallouts() {
    if (!st.callouts) return;
    const W = stage.clientWidth, H = stage.clientHeight, sr = stage.getBoundingClientRect();
    if (!W || !H) return;
    const rel = el => { const r = el.getBoundingClientRect(); return { t: r.top - sr.top, b: r.bottom - sr.top, l: r.left - sr.left, r: r.right - sr.left, w: r.width }; };
    const top = rel(topBar).b + 22;
    const tr = rel(transportBar);
    let bottomL = tr.t - 14, bottomR = tr.t - 14;
    const sp = rel(stampEl); if (sp.w > 0) bottomR = Math.min(bottomR, sp.t - 12);
    if (!card.hidden) { const cr = rel(card); bottomL = Math.min(bottomL, cr.t - 12); }
    const sideZ = EN.camera.position.z >= 0 ? 1 : -1;
    tmp.set(...S.c).project(EN.camera);
    const cx = (tmp.x + 1) / 2 * W;
    const Lc = [], Rc = [];
    EN.scene.updateMatrixWorld();
    CO.forEach(c => {
      const shown = partShown(c.part) && (!EN.isolated || EN.isolated === c.part);
      if (!shown) { c.g.style.display = 'none'; return; }
      const p = c.at(sideZ); tmp.copy(p).project(EN.camera);
      if (tmp.z > 1 || tmp.x < -1.2 || tmp.x > 1.2 || tmp.y < -1.2 || tmp.y > 1.2) { c.g.style.display = 'none'; return; }
      c.scr.x = (tmp.x + 1) / 2 * W; c.scr.y = (1 - tmp.y) / 2 * H;
      c.g.style.display = '';
      (c.scr.x < cx ? Lc : Rc).push(c);
    });
    const place = (list, colX, left) => {
      const bottom = left ? bottomL : bottomR;
      list.sort((a, b) => a.scr.y - b.scr.y);
      const n = list.length; if (!n) return;
      const gap = Math.min(25, (bottom - top) / Math.max(1, n - 1));
      list.forEach((c, k) => { c.y = Math.min(bottom, Math.max(top, c.scr.y)); if (k) c.y = Math.max(c.y, list[k - 1].y + gap); });
      for (let k = n - 1; k >= 0; k--) { const lim = k === n - 1 ? bottom : list[k + 1].y - gap; if (list[k].y > lim) list[k].y = lim; }
      list.forEach(c => {
        const sx0 = left ? colX : colX - 30, sx1 = left ? colX + 30 : colX, endX = left ? sx1 : sx0;
        c.line.setAttribute('x1', c.scr.x); c.line.setAttribute('y1', c.scr.y); c.line.setAttribute('x2', endX); c.line.setAttribute('y2', c.y);
        c.shelf.setAttribute('x1', sx0); c.shelf.setAttribute('y1', c.y); c.shelf.setAttribute('x2', sx1); c.shelf.setAttribute('y2', c.y);
        c.dot.setAttribute('cx', c.scr.x); c.dot.setAttribute('cy', c.scr.y);
        c.text.setAttribute('x', (sx0 + sx1) / 2); c.text.setAttribute('y', c.y - 4); c.text.setAttribute('text-anchor', 'middle');
        c.hit.setAttribute('x', sx0 - 2); c.hit.setAttribute('y', c.y - 20);
        c.g.classList.toggle('on', EN.selected === c.part);
      });
    };
    // columns hug the engine's own silhouette (like callouts on a drawing), inside the frame
    let minX = Infinity, maxX = -Infinity;
    for (const x of S.x) for (const y of S.y) for (const z of S.z) {
      tmp.set(x, y, z).project(EN.camera);
      if (tmp.z < 1) { const sx = (tmp.x + 1) / 2 * W; minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); }
    }
    const margin = W < 760 ? 22 : 44;
    place(Lc, Math.max(margin, Math.min(cx - 120, minX - 46)), true);
    place(Rc, Math.min(W - margin, Math.max(cx + 120, maxX + 46)), false);
  }

  /* ---------------- readouts & charts ---------------- */
  const liftCfg = { E, lift: P.lift.fn(E), yMax: P.lift.yMax, yTicks: P.lift.yTicks, marker: P.lift.marker };
  const pvCfg = Object.assign({ E }, P.pv);
  let chartAcc = 0, lastPhase = -1;
  function drawCharts(force) {
    const ch = EN.gas.chambers[st.cyl];
    const phase = E.phaseOf(st.cyl, EN.theta / DEG);
    if (!force && Math.abs(phase - lastPhase) < 0.4) return;
    lastPhase = phase;
    window.CHARTS.drawLift($('liftChart'), phase, liftCfg);
    window.CHARTS.drawPV($('pvChart'), ch.state, pvCfg);
  }
  function readouts() {
    const deg = ((EN.theta / DEG) % 720 + 720) % 720;
    $('angleOut').textContent = `${Math.round(deg)}°`;
    if (document.activeElement !== angle) angle.value = Math.round(deg);
    firing.querySelectorAll('button').forEach((b, i) => {
      const s = EN.gas.chambers[i].state; if (!s) return;
      b.querySelector('span').textContent = E.strokeName[s.stroke];
      b.querySelector('i').style.background = `var(${STROKE_VAR[s.stroke]})`;
      b.title = `Цилиндр ${i + 1}: ${E.strokeName[s.stroke].toLowerCase()}`;
    });
    const s = EN.gas.chambers[st.cyl].state;
    if (s) {
      const pill = $('strokePill');
      pill.style.borderColor = `var(${STROKE_VAR[s.stroke]})`;
      pill.querySelector('i').style.background = `var(${STROKE_VAR[s.stroke]})`;
      $('strokeName').textContent = E.strokeName[s.stroke];
      $('pOut').textContent = fmt(s.P / 1e5, s.P > 1e6 ? 0 : 1);
      $('tOut').textContent = Math.round(s.T);
      $('vOut').textContent = fmt(s.V * 1e6, 0);
      $('xOut').textContent = fmt(E.kin(st.cyl, EN.theta).travel, 1);
      const [li, le] = P.lifts(EN, st.cyl);
      $('liOut').textContent = fmt(Math.max(0, li), 2);
      $('leOut').textContent = fmt(Math.max(0, le), 2);
    }
  }

  /* ---------------- theme ---------------- */
  const applyTheme = dark => { EN.setDark(dark); drawCharts(true); };

  /* ---------------- restore ---------------- */
  setRpm(st.rpm); setSlowBtn(st.slow); setPlaying(st.playing);
  setPalBtn(st.palette); EN.setPalette(st.palette);
  setHousingBtn(st.housing); EN.setHousing(st.housing);
  setCallouts(st.callouts);
  setViewBtn(st.view); EN.view(st.view, true);
  selectCyl(st.cyl);
  applyTheme(shell.isDark());
  refreshSpecRows();
  EN.update(st.theta, 0);
  readouts(); drawCharts(true);

  /* ---------------- per-frame ---------------- */
  let last = performance.now(), uiAcc = 1;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    let dTh = 0;
    if (st.playing) { dTh = st.rpm * 2 * Math.PI / 60 / st.slow * dt; st.theta += dTh; }
    if (pendingScrub !== null) { dTh += pendingScrub - st.theta; st.theta = pendingScrub; pendingScrub = null; }
    if (st.theta > 4 * Math.PI * 400) st.theta -= 4 * Math.PI * 400;
    if (st.theta < 0) st.theta += 4 * Math.PI * 400;
    if (dTh !== 0) EN.update(st.theta, dTh);
    const drawn = EN.render(now);
    hover(now);
    if (drawn) layoutCallouts();
    uiAcc += dt; chartAcc += dt;
    if (uiAcc > 0.07) { uiAcc = 0; readouts(); }
    if (chartAcc > 0.09) { chartAcc = 0; drawCharts(false); }
  }
  return {
    EN, st, select, selectCyl, frame, keydown, applyTheme,
    resume() { last = performance.now(); EN.resize(); EN.dirty = true; if (!card.hidden) placeCard(); },
    snapshot: () => ({ rpm: st.rpm, slow: st.slow, theta: st.theta, playing: st.playing, cyl: st.cyl, palette: st.palette,
      housing: st.housing, callouts: st.callouts, layers: st.layers, extra: st.extra, view: st.view }),
  };
}

/* ================================================================ shell: menu + tabs ==== */
function start(saved) {
  saved = saved || {};
  const ctl = {}, panels = {};
  document.querySelectorAll('[data-panel]').forEach(p => { panels[p.dataset.panel] = p; });
  const tabs = document.querySelectorAll('.tabs [role="tab"]');
  const isDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const shell = { isDark };
  let active = null;
  const building = {};

  function show(key) {
    if (!panels[key]) key = 'menu';
    Object.keys(panels).forEach(k => { panels[k].hidden = k !== key; });
    tabs.forEach(t => { const on = t.dataset.tab === key; t.setAttribute('aria-selected', String(on)); t.tabIndex = on || (key === 'menu' && t === tabs[0]) ? 0 : -1; });
    document.querySelector('.home').setAttribute('aria-current', key === 'menu' ? 'page' : 'false');
    document.body.dataset.view = key;
    active = key;
    window.UI = ctl[key] || null;
    if (key === 'menu') return;
    if (ctl[key]) { ctl[key].resume(); return; }
    if (building[key]) return;
    // mount the sheet first so «Собираю двигатель…» is painted, then build the 3D model
    building[key] = true;
    mount(key, panels[key]);
    requestAnimationFrame(() => setTimeout(() => {
      const c = createController(key, panels[key], (saved.engines || {})[key], shell);
      building[key] = false;
      if (!c) return;
      ctl[key] = c;
      if (active === key) { c.resume(); window.UI = c; }
    }, 30));
  }
  document.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => show(el.dataset.tab)));
  // arrow keys move between the tabs
  document.querySelector('.tabs').addEventListener('keydown', ev => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const list = [...tabs], i = list.indexOf(document.activeElement); if (i < 0) return;
    const j = (i + (ev.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length;
    list[j].focus(); show(list[j].dataset.tab); ev.preventDefault();
  });
  addEventListener('keydown', ev => { const c = ctl[active]; if (c && !ev.target.closest('.topbar')) c.keydown(ev); });
  const applyTheme = () => Object.values(ctl).forEach(c => c.applyTheme(isDark()));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.claude?.hot?.snapshot?.(() => {
    const engines = Object.assign({}, saved.engines || {});
    Object.keys(ctl).forEach(k => { engines[k] = ctl[k].snapshot(); });
    return { tab: active, engines };
  });
  window.SHELL = { show, ctl, get active() { return active; } };

  function loop(now) {
    requestAnimationFrame(loop);
    const c = ctl[active];
    if (c) c.frame(now);
  }
  show(saved.tab || 'menu');
  requestAnimationFrame(loop);
}

const boot = () => (window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {}));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
