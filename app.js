import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VehicleModel } from './models.js';
import { VEHICLES, PARTS, CATEGORY_NAMES, partsFor, getPart } from './parts.js';

const $ = id => document.getElementById(id);
const state = { vehicle: 'carb', gas: 0, brake: 0, clutch: 0, steering: 0, speed: 0, rpm: 850, gear: 'N', driveMode: '4H', diffLock: false, running: true };
const input = { gas: false, brake: false, clutch: false, left: false, right: false };
let renderer, scene, camera, controls, model, selectedId = 'clutch', labelsEnabled = true, autoRotate = false;
let cameraGoal = null, toastTimer, demoTimers = [], demoSteeringActive = false, activeCategory = 'all', pointerDown = null;
const canvas = $('scene'), viewer = $('viewer'), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const labelIds = ['engine', 'carburetor', 'injectors', 'clutch', 'gearbox', 'transferCase', 'differential', 'steeringRack', 'wheels'];

function initScene() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x1a1d1b, .025);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
    camera = new THREE.PerspectiveCamera(38, 1, .1, 100); camera.position.set(6.7, 4.5, 6.8);
    controls = new OrbitControls(camera, canvas); controls.target.set(0, .9, 0); controls.enableDamping = true; controls.dampingFactor = .065;
    controls.minDistance = 2.2; controls.maxDistance = 16; controls.maxPolarAngle = Math.PI * .48; controls.autoRotateSpeed = .7;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xe8edf0, 0x242725, 1.2));
    const key = new THREE.DirectionalLight(0xf3f1ea, 2.5); key.position.set(3, 8, 5); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5; key.shadow.bias = -.0005; scene.add(key);
    const rim = new THREE.DirectionalLight(0xdde5e6, 1.5); rim.position.set(-5, 4, -4); scene.add(rim);
    const fill = new THREE.DirectionalLight(0x9fb9c4, 1.4); fill.position.set(1, 2, -5); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x20231f, roughness: 1, metalness: 0, transparent: true, opacity: .62 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = .02; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(16, 40, 0x424a39, 0x32382d); grid.position.y = .025; grid.material.transparent = true; grid.material.opacity = .32; scene.add(grid);
    const contact = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshBasicMaterial({ color: 0x090c08, transparent: true, opacity: .22, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = .035; contact.scale.set(1, .52, 1); scene.add(contact);
    model = new VehicleModel(scene, state.vehicle); model.setHighlight(selectedId);
    resetCamera(false);
    new ResizeObserver(resizeScene).observe(viewer); resizeScene();
    renderer.setAnimationLoop(animate);
    setTimeout(() => $('loading').classList.add('done'), 450);
    window.__atlas = { state, get model() { return model; }, selectPart, setVehicle };
  } catch (error) {
    console.error(error); $('loading').hidden = true; $('webglError').hidden = false;
  }
}

function resizeScene() {
  if (!renderer) return;
  const width = viewer.clientWidth, height = viewer.clientHeight;
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}

function defaultCameraPosition() {
  return viewer.clientWidth < 500 ? new THREE.Vector3(9.5, 6.1, 9.6) : new THREE.Vector3(5.8, 3.9, 5.9);
}
function resetCamera(animated = true) {
  if (!camera) return;
  if (animated) cameraGoal = { target: new THREE.Vector3(0, .9, 0), position: defaultCameraPosition() };
  else { camera.position.copy(defaultCameraPosition()); controls.target.set(0, .9, 0); controls.update(); }
}

function projectLabels() {
  if (!model || !labelsEnabled) return;
  const width = viewer.clientWidth, height = viewer.clientHeight;
  const visibleLabels = [];
  for (const el of $('sceneLabels').children) {
    const id = el.dataset.part, pos = model.getPartPosition(id);
    if (!pos) { el.style.display = 'none'; continue; }
    pos.project(camera);
    const x = (pos.x * .5 + .5) * width, y = (-pos.y * .5 + .5) * height;
    const visible = pos.z < 1 && x > 25 && x < width - 90 && y > 65 && y < height - 45;
    el.style.display = visible ? '' : 'none'; el.style.left = `${x}px`; el.dataset.y = y;
    el.classList.toggle('selected', id === selectedId);
    if (visible) visibleLabels.push(el);
  }
  visibleLabels.sort((a, b) => Number(a.dataset.y) - Number(b.dataset.y));
  let previousY = 64;
  for (const el of visibleLabels) {
    const y = Math.max(Number(el.dataset.y), previousY + 27);
    el.style.top = `${Math.min(y, height - 48)}px`; previousY = y;
  }
}

function rebuildLabels() {
  $('sceneLabels').innerHTML = '';
  for (const id of labelIds) {
    if (!model.parts.has(id)) continue;
    const p = getPart(id); if (!p) continue;
    const b = document.createElement('button'); b.className = 'scene-label'; b.dataset.part = id; b.textContent = p.name;
    b.addEventListener('click', () => selectPart(id)); $('sceneLabels').appendChild(b);
  }
}

function getPick(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(model.root, true);
  let shellFallback = null;
  for (const hit of hits) {
    let o = hit.object;
    while (o && o !== model.root) {
      if (o.userData.partId && getPart(o.userData.partId)) {
        if (model.xray && hit.object.userData.xrayShell) { shellFallback ||= o.userData.partId; break; }
        return o.userData.partId;
      }
      o = o.parent;
    }
  }
  return shellFallback;
}

canvas.addEventListener('pointerdown', e => { pointerDown = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!pointerDown || Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5) return;
  const id = getPick(e); if (id) selectPart(id);
});
canvas.addEventListener('pointermove', e => {
  if (!model || e.buttons) { $('partTooltip').style.display = 'none'; return; }
  const id = getPick(e); canvas.style.cursor = id ? 'pointer' : 'grab';
  if (id) {
    const rect = viewer.getBoundingClientRect(), tip = $('partTooltip'); tip.textContent = `${getPart(id).name} · нажмите для описания`; tip.style.display = 'block';
    tip.style.left = `${Math.min(e.clientX - rect.left + 13, rect.width - 210)}px`; tip.style.top = `${e.clientY - rect.top + 13}px`;
  } else $('partTooltip').style.display = 'none';
});
canvas.addEventListener('pointerleave', () => { $('partTooltip').style.display = 'none'; });

const icons = {
  engine: '<path d="M9 14h25v22H9zM14 10h15v4M5 20h4m25 3h5v9h-5M14 36v4m15-4v4M14 20h15m-15 6h15"/>',
  transmission: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="6"/><path d="M24 8v6m0 20v6M8 24h6m20 0h6M13 13l4 4m14 14 4 4M35 13l-4 4M17 31l-4 4"/>',
  chassis: '<path d="M10 12h28v24H10zM16 12v24m16-24v24M6 19h36M6 29h36"/><circle cx="16" cy="19" r="3"/><circle cx="32" cy="29" r="3"/>',
  electrical: '<path d="m27 5-14 22h10l-3 16 15-23H25l2-15Z"/>'
};
function selectPart(id, showDetail = true) {
  const part = getPart(id); if (!part || !partsFor(state.vehicle).includes(part)) return;
  selectedId = id; if (model) model.setHighlight(id);
  if (showDetail) switchInspector('details');
  $('partCategory').textContent = part.categoryName.toUpperCase();
  $('partNumber').textContent = `${String(partsFor(state.vehicle).indexOf(part) + 1).padStart(2, '0')} / ${partsFor(state.vehicle).length}`;
  $('partIcon').innerHTML = `<svg viewBox="0 0 48 48">${icons[part.category]}</svg>`;
  $('partTitle').textContent = part.name; $('partSubtitle').textContent = part.subtitle; $('partDescription').textContent = part.description;
  $('partFailure').textContent = part.failure;
  $('operationSteps').innerHTML = part.steps.map(s => `<li>${s}</li>`).join('');
  $('partDamage').innerHTML = part.damage.map(s => `<li>${s}</li>`).join('');
  $('partDetail').scrollTop = 0;
  document.querySelectorAll('.catalog-item').forEach(el => el.classList.toggle('active', el.dataset.part === id));
  updatePartState();
}

function updatePartState() {
  const p = getPart(selectedId); if (!p) return;
  let text = 'Узел в норме · готов к работе', load = Math.round(state.gas * 75 + state.speed * .15);
  if (selectedId === 'clutch') text = state.clutch > .5 ? 'Сцепление выключено · поток разомкнут' : 'Сцепление включено · момент передаётся';
  if (selectedId === 'gearbox') text = state.gear === 'N' ? 'Нейтраль · валы разъединены' : `Включена ${state.gear === 'R' ? 'задняя' : state.gear + '-я'} передача`;
  if (selectedId === 'brakes' || selectedId === 'brakeDiscs') { text = state.brake ? 'Торможение · колодки прижаты' : 'Суппорты отпущены'; load = state.brake * 100; }
  if (selectedId === 'steeringRack' || selectedId === 'steeringColumn') text = `Угол поворота колёс · ${Math.round(state.steering * 32)}°`;
  if (selectedId === 'transferCase') text = `Режим ${state.driveMode} · ${state.driveMode === '4L' ? 'понижающий ряд' : state.driveMode === '2H' ? 'задний мост' : 'оба моста'}`;
  if (selectedId === 'carburetor' || selectedId === 'injectors') text = `Подача топлива · ${Math.round(state.gas * 100)}% дросселя`;
  if (selectedId === 'pistons' || selectedId === 'crankshaft' || selectedId === 'camshaft') text = `Вращение · ${Math.round(state.rpm)} об/мин`;
  $('partState').textContent = text; $('partLoad').textContent = `Нагрузка ${Math.min(100, Math.max(0, Math.round(load)))}%`;
}

function switchInspector(tab) {
  const details = tab === 'details';
  $('detailsTab').classList.toggle('active', details); $('catalogTab').classList.toggle('active', !details);
  $('detailsTab').setAttribute('aria-selected', details); $('catalogTab').setAttribute('aria-selected', !details);
  $('partDetail').hidden = !details; $('catalog').hidden = details;
  if (!details) renderCatalog();
}
function renderCatalog() {
  const query = $('partSearch').value.trim().toLowerCase();
  const parts = partsFor(state.vehicle).filter(p => (activeCategory === 'all' || p.category === activeCategory) && (p.name + p.categoryName).toLowerCase().includes(query));
  $('catalogList').innerHTML = parts.length ? parts.map(p => `<button class="catalog-item ${p.id === selectedId ? 'active' : ''}" data-part="${p.id}"><span class="catalog-item-index">${String(PARTS.indexOf(p) + 1).padStart(2, '0')}</span><span><b>${p.name}</b><small>${CATEGORY_NAMES[p.category]}</small></span><span>↗</span></button>`).join('') : '<p class="part-subtitle">Ничего не найдено. Измените запрос или фильтр.</p>';
}

function setVehicle(type) {
  if (!VEHICLES[type]) return;
  state.vehicle = type; state.gear = 'N'; state.speed = 0; state.rpm = 850; state.driveMode = '4H';
  document.querySelectorAll('.vehicle-tab').forEach(b => { const on = b.dataset.vehicle === type; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
  $('modelName').textContent = VEHICLES[type].name; $('driveText').textContent = VEHICLES[type].drive;
  $('jeepOptions').hidden = type !== 'jeep'; $('partCount').textContent = partsFor(type).length;
  if (model) model.dispose(); model = new VehicleModel(scene, type); model.setXray($('xrayBtn').getAttribute('aria-pressed') === 'true'); selectedId = 'clutch'; model.setHighlight(selectedId);
  rebuildLabels(); selectPart('clutch'); updateGearUI(); resetCamera(); renderCatalog();
  document.querySelectorAll('[data-drive]').forEach(b => b.classList.toggle('active', b.dataset.drive === '4H'));
  toast(`Модель собрана: ${type === 'carb' ? 'карбюраторная классика' : type === 'inject' ? 'инжекторный передний привод' : 'внедорожник с раздаткой'}`);
}

function updateGearUI() {
  document.querySelectorAll('[data-gear]').forEach(b => b.classList.toggle('active', b.dataset.gear === state.gear));
  $('transmissionText').textContent = state.gear === 'N' ? 'Нейтраль' : state.gear === 'R' ? 'Задний ход' : `${state.gear}-я передача`;
}
function setGear(gear) {
  if (state.speed > 2 && state.clutch < .6) { toast('Сначала выжмите сцепление'); pulseControl('clutch'); return; }
  if (gear === 'R' && state.speed > 3) { toast('Остановите автомобиль перед включением заднего хода'); return; }
  state.gear = gear; updateGearUI(); selectPart('gearbox', false);
  toast(gear === 'N' ? 'Нейтральная передача' : `${gear === 'R' ? 'Задняя' : gear + '-я'} передача включена`);
}
function resetDrive() {
  input.gas = input.brake = input.clutch = input.left = input.right = false;
  state.gas = state.brake = state.clutch = state.steering = state.speed = 0; state.gear = 'N'; state.rpm = 850;
  $('steeringRange').value = 0; updateGearUI(); updateControlUI(); toast('Управление сброшено');
}
function pulseControl(name) {
  const b = $(name + 'Pedal'); if (!b) return; b.animate([{ boxShadow: '0 0 0 0 #c9f45b00' }, { boxShadow: '0 0 0 5px #c9f45b55' }, { boxShadow: '0 0 0 0 #c9f45b00' }], { duration: 650 });
}
function updateControlUI() {
  for (const name of ['gas', 'brake', 'clutch']) $(name + 'Pedal').classList.toggle('pressed', state[name] > .3);
  $('steeringWheel').style.transform = `rotate(${state.steering * 240}deg)`; $('steeringDegrees').textContent = `${Math.round(state.steering * 360)}°`;
}
function toast(text) {
  clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2300);
}

for (const name of ['gas', 'brake', 'clutch']) {
  const b = $(name + 'Pedal');
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); input[name] = true; });
  const release = () => { input[name] = false; };
  b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
}
const controlledKeys = { Space: 'gas', KeyB: 'brake', KeyC: 'clutch' };
window.addEventListener('keydown', e => {
  if (e.target.matches('input')) return;
  if (controlledKeys[e.code]) { e.preventDefault(); input[controlledKeys[e.code]] = true; }
  if (e.code === 'KeyA') { e.preventDefault(); input.left = true; }
  if (e.code === 'KeyD') { e.preventDefault(); input.right = true; }
  if (e.code === 'KeyR') resetDrive();
  if (e.code === 'KeyX') $('xrayBtn').click();
  if (/Digit[1-5]/.test(e.code)) setGear(e.code.slice(-1));
  if (e.code === 'KeyN') setGear('N');
});
window.addEventListener('keyup', e => {
  if (controlledKeys[e.code]) input[controlledKeys[e.code]] = false;
  if (e.code === 'KeyA') input.left = false; if (e.code === 'KeyD') input.right = false;
});
window.addEventListener('blur', () => { for (const k in input) input[k] = false; });
$('steeringRange').addEventListener('input', e => { state.steering = Number(e.target.value) / 100; });
$('gearbox').addEventListener('click', e => { const b = e.target.closest('[data-gear]'); if (b) setGear(b.dataset.gear); });
$('resetDrive').addEventListener('click', resetDrive);
$('detailsTab').addEventListener('click', () => switchInspector('details')); $('catalogTab').addEventListener('click', () => switchInspector('catalog'));
$('partSearch').addEventListener('input', renderCatalog);
$('catalogFilters').addEventListener('click', e => { const b = e.target.closest('[data-category]'); if (!b) return; activeCategory = b.dataset.category; document.querySelectorAll('[data-category]').forEach(x => x.classList.toggle('active', x === b)); renderCatalog(); });
$('catalogList').addEventListener('click', e => { const b = e.target.closest('[data-part]'); if (b) selectPart(b.dataset.part); });
document.querySelectorAll('.vehicle-tab').forEach(b => b.addEventListener('click', () => setVehicle(b.dataset.vehicle)));
$('explodeBtn').addEventListener('click', e => { const b = e.currentTarget, active = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', active); b.classList.toggle('active', active); model?.setExploded(active); toast(active ? 'Узлы разнесены для изучения' : 'Автомобиль собран'); });
$('xrayBtn').addEventListener('click', e => {
  const b = e.currentTarget, active = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', active); b.classList.toggle('active', active); $('xrayBadge').hidden = !active; viewer.classList.toggle('xray-active', active);
  model?.setXray(active); toast(active ? 'Рентген включён: корпуса, шины и баки прозрачны' : 'Рентген выключен');
});
$('labelsBtn').addEventListener('click', e => { labelsEnabled = !labelsEnabled; e.currentTarget.setAttribute('aria-pressed', labelsEnabled); e.currentTarget.classList.toggle('active', labelsEnabled); $('sceneLabels').style.display = labelsEnabled ? '' : 'none'; });
$('resetCamera').addEventListener('click', () => resetCamera());
$('autoRotate').addEventListener('click', e => { autoRotate = !autoRotate; controls.autoRotate = autoRotate; e.currentTarget.classList.toggle('active', autoRotate); e.currentTarget.setAttribute('aria-pressed', autoRotate); });
function syncFullscreenUI() {
  const active = Boolean(document.fullscreenElement) || document.querySelector('.workspace').classList.contains('fullscreen-fallback');
  $('fullscreenBtn').classList.toggle('active', active); $('fullscreenBtn').title = active ? 'Выйти из полноэкранного режима' : 'На весь экран';
  requestAnimationFrame(resizeScene);
}
function setFullscreenFallback(active) {
  document.querySelector('.workspace').classList.toggle('fullscreen-fallback', active);
  document.body.classList.toggle('fullscreen-open', active); syncFullscreenUI();
}
$('fullscreenBtn').addEventListener('click', async () => {
  const root = document.querySelector('.workspace');
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); setFullscreenFallback(false); return; }
  } catch { setFullscreenFallback(false); return; }
  setFullscreenFallback(!root.classList.contains('fullscreen-fallback'));
});
document.addEventListener('fullscreenchange', syncFullscreenUI);
window.addEventListener('keydown', e => { if (e.code === 'Escape' && document.querySelector('.workspace').classList.contains('fullscreen-fallback')) setFullscreenFallback(false); });
$('focusPart').addEventListener('click', () => {
  const pos = model?.getPartPosition(selectedId); if (!pos) return;
  const direction = selectedId === 'battery' ? new THREE.Vector3(-1, .65, -.85).normalize() : camera.position.clone().sub(controls.target).normalize();
  const distance = selectedId === 'battery' ? 1.45 : 2.3;
  cameraGoal = { target: pos, position: pos.clone().addScaledVector(direction, distance).add(new THREE.Vector3(0, .25, 0)) };
});
$('mobileMenu').addEventListener('click', () => document.querySelector('.nav').classList.toggle('open'));
document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => document.querySelector('.nav').classList.remove('open')));
$('jeepOptions').addEventListener('click', e => {
  const drive = e.target.closest('[data-drive]'), diff = e.target.closest('[data-diff]');
  if (drive) { state.driveMode = drive.dataset.drive; document.querySelectorAll('[data-drive]').forEach(b => b.classList.toggle('active', b === drive)); $('driveText').textContent = state.driveMode === '2H' ? 'Задний привод · 2H' : state.driveMode === '4L' ? 'Полный привод · пониженная 4L' : 'Полный привод · 4H'; selectPart('transferCase', false); toast(`Раздатка: режим ${state.driveMode}`); }
  if (diff) { state.diffLock = !state.diffLock; diff.textContent = `Блокировка: ${state.diffLock ? 'вкл.' : 'выкл.'}`; diff.classList.toggle('active', state.diffLock); selectPart('differential', false); toast(state.diffLock ? 'Дифференциал заблокирован · только для скользкого покрытия' : 'Дифференциал разблокирован'); }
});

function runDemo(type) {
  demoTimers.forEach(clearTimeout); demoTimers = []; demoSteeringActive = false; resetDrive(); viewer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (type === 'clutch') {
    selectPart('clutch'); input.clutch = true; toast('Сцепление выключено: нажимной диск отходит');
    demoTimers.push(setTimeout(() => { input.clutch = false; }, 2800));
  } else if (type === 'gear') {
    selectPart('gearbox'); input.clutch = true; toast('Сцепление выжато · выбираем третью передачу');
    demoTimers.push(setTimeout(() => setGear('3'), 700)); demoTimers.push(setTimeout(() => { input.clutch = false; }, 3000));
  } else {
    selectPart('steeringRack'); toast('Рулевая рейка перемещает тяги и поворачивает колёса'); demoSteeringActive = true;
    const start = performance.now(); const tick = now => { const t = (now - start) / 1000; if (t > 3.2) { state.steering = 0; $('steeringRange').value = 0; demoSteeringActive = false; return; } state.steering = Math.sin(t * 2) * .8; $('steeringRange').value = state.steering * 100; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  }
}
document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => runDemo(b.dataset.demo)));

let lastTime = performance.now();
function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  for (const name of ['gas', 'brake', 'clutch']) state[name] += ((input[name] ? 1 : 0) - state[name]) * Math.min(1, dt * 10);
  if (input.left || input.right) { state.steering += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * dt * 1.2; state.steering = THREE.MathUtils.clamp(state.steering, -1, 1); $('steeringRange').value = state.steering * 100; }
  else if (!$('steeringRange').matches(':active') && !demoSteeringActive) { state.steering *= Math.max(0, 1 - dt * .7); }
  const gearTop = { N: 120, R: 30, 1: 45, 2: 80, 3: 125, 4: 180, 5: 220 }[state.gear];
  if (state.gear !== 'N' && state.clutch < .7) {
    const traction = state.gas * (state.driveMode === '4L' ? 10 : 17) * (state.gear === 'R' ? .65 : 1);
    state.speed += traction * dt; state.speed -= state.speed * .12 * dt; state.speed = Math.min(state.speed, gearTop);
  } else state.speed -= state.speed * .055 * dt;
  if (state.brake > .01) state.speed = Math.max(0, state.speed - state.brake * 55 * dt);
  if (state.gear === 'N' && state.speed < .1) state.speed = 0;
  let targetRpm = 850 + state.gas * 3500;
  if (state.gear !== 'N' && state.clutch < .5 && state.speed > 1) targetRpm = Math.max(900, 900 + state.speed * (state.gear === 'R' ? 45 : 75 / Number(state.gear)) + state.gas * 550);
  state.rpm += (targetRpm - state.rpm) * Math.min(1, dt * 4);
  model.update(state, dt);
  if (cameraGoal) { camera.position.lerp(cameraGoal.position, Math.min(1, dt * 4)); controls.target.lerp(cameraGoal.target, Math.min(1, dt * 4)); if (camera.position.distanceTo(cameraGoal.position) < .02) cameraGoal = null; }
  controls.update(); renderer.render(scene, camera); projectLabels();
  $('speedValue').textContent = Math.round(state.speed); $('rpmValue').textContent = Math.round(state.rpm / 10) * 10; $('rpmBar').style.width = `${Math.min(100, state.rpm / 55)}%`;
  updateControlUI(); updatePartState();
}

selectPart('clutch'); $('partCount').textContent = partsFor(state.vehicle).length; renderCatalog(); initScene(); rebuildLabels();
