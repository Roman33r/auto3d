import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const C = {
  steel: 0x9ba39f, darkSteel: 0x303633, aluminum: 0xc3c8c3, black: 0x171b19,
  rubber: 0x111412, bronze: 0xad8b4d, copper: 0xa56848, green: 0xc9f45b,
  engine: 0x707673, red: 0xa84636, blue: 0x526f78, spring: 0x737d75
};

function material(color, metalness = .55, roughness = .42) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 1.15 });
}
function mesh(geometry, mat, parent, position = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...position); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function box(parent, size, pos, mat) {
  const radius = Math.min(.025, Math.min(...size) * .12);
  return mesh(new RoundedBoxGeometry(...size, 1, radius), mat, parent, pos);
}
function cyl(parent, r, length, pos, mat, axis = 'y', segments = 24) {
  const m = mesh(new THREE.CylinderGeometry(r, r, length, segments), mat, parent, pos);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  return m;
}
function rod(parent, a, b, radius, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
  const m = mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 10), mat, parent);
  m.position.copy(va.add(vb).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
function gearGeometry(radius, depth, teeth = 20, holeRatio = .2) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = radius * ((i % 4 === 0 || i % 4 === 3) ? .86 : 1);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, radius * holeRatio, 0, Math.PI * 2, true); shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1 });
  g.center(); return g;
}
function gear(parent, radius, depth, pos, mat, axis = 'x', holeRatio = .2) {
  const g = mesh(gearGeometry(radius, depth, Math.max(14, Math.round(radius * 65)), holeRatio), mat, parent, pos);
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  if (axis === 'y') g.rotation.x = Math.PI / 2;
  return g;
}
function torus(parent, radius, tube, pos, mat, rotation = [0, 0, 0], arc = Math.PI * 2) {
  const m = mesh(new THREE.TorusGeometry(radius, tube, 10, 36, arc), mat, parent, pos); m.rotation.set(...rotation); return m;
}
function pipe(parent, points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, 40, radius, 8, false), mat, parent);
}
function spring(parent, pos, height = .62, radius = .115, mat) {
  const points = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100, a = t * Math.PI * 12;
    points.push(new THREE.Vector3(Math.cos(a) * radius, t * height, Math.sin(a) * radius));
  }
  const s = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, .023, 7, false), mat, parent, pos);
  return s;
}

function bolt(parent, pos, mat, axis = 'y', radius = .026) {
  const washer = cyl(parent, radius * 1.35, .008, pos, mat, axis, 20);
  const p = [...pos]; p[axis === 'x' ? 0 : axis === 'z' ? 2 : 1] += .012;
  return cyl(parent, radius, .022, p, mat, axis, 6);
}
function bearing(parent, radius, pos, mat, dark, axis = 'x') {
  const g = new THREE.Group(); g.position.set(...pos); parent.add(g);
  const rotation = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  torus(g, radius, radius * .17, [0, 0, 0], mat, rotation);
  torus(g, radius * .55, radius * .12, [0, 0, 0], mat, rotation);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, r = radius * .76;
    const p = axis === 'x' ? [0, Math.cos(a) * r, Math.sin(a) * r] : axis === 'z' ? [Math.cos(a) * r, Math.sin(a) * r, 0] : [Math.cos(a) * r, 0, Math.sin(a) * r];
    mesh(new THREE.SphereGeometry(radius * .1, 8, 6), mat, g, p);
  }
  return g;
}
function tireGeometry(radius, width) {
  const points = [
    new THREE.Vector2(radius * .57, -width * .38), new THREE.Vector2(radius * .69, -width * .5),
    new THREE.Vector2(radius * .88, -width * .46), new THREE.Vector2(radius * .98, -width * .28),
    new THREE.Vector2(radius, -width * .18), new THREE.Vector2(radius, width * .18),
    new THREE.Vector2(radius * .98, width * .28), new THREE.Vector2(radius * .88, width * .46),
    new THREE.Vector2(radius * .69, width * .5), new THREE.Vector2(radius * .57, width * .38)
  ];
  const g = new THREE.LatheGeometry(points, 64); g.rotateX(Math.PI / 2); return g;
}
function surfaceTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(128, 128);
  for (let i = 0; i < image.data.length; i += 4) { const v = 185 + Math.random() * 65; image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255; }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 4); return texture;
}

export class VehicleModel {
  constructor(scene, type = 'carb') {
    this.scene = scene; this.type = type; this.root = new THREE.Group(); this.parts = new Map();
    this.wheels = []; this.steerNodes = []; this.pistons = []; this.gears = []; this.springs = []; this.valves = []; this.xrayMeshes = [];
    this.phase = 0; this.wheelPhase = 0; this.explode = 0; this.explodeTarget = 0; this.highlighted = null; this.xray = false;
    scene.add(this.root);
    this.mat = {
      steel: material(C.steel), dark: material(C.darkSteel), alum: material(C.aluminum, .8, .28), black: material(C.black, .25),
      rubber: material(C.rubber, .05, .8), bronze: material(C.bronze, .7, .3), copper: material(C.copper),
      green: material(C.green, .35), engine: material(C.engine, .72), red: material(C.red, .45), blue: material(C.blue), spring: material(C.spring),
      paper: material(0xb8a67d, .05, .9), oil: material(0x17150d, .1, .18), plastic: material(0x252a28, .05, .65)
    };
    this.surface = surfaceTexture();
    Object.values(this.mat).forEach(mat => { if (mat.metalness > .2) { mat.roughnessMap = this.surface; mat.bumpMap = this.surface; mat.bumpScale = .0015; } });
    this.buildFrame(); this.buildEngine(); this.buildTransmission(); this.buildWheels(); this.buildSuspension(); this.buildSteering(); this.buildBrakes(); this.buildSystems();
    for (const [id, group] of this.parts) group.traverse(o => { if (o.isMesh) o.userData.partId = id; });
    this.root.traverse(o => { if (o.isMesh) { o.userData.originalMaterial = o.material; } });
  }

  shell(object, opacity = .12) {
    object.userData.xrayShell = true; object.userData.xrayOpacity = opacity; this.xrayMeshes.push(object); return object;
  }
  part(id, pos = [0, 0, 0], explode = [0, .3, 0]) {
    const g = new THREE.Group(); g.name = id; g.position.set(...pos); g.userData.partId = id;
    g.userData.base = g.position.clone(); g.userData.explode = new THREE.Vector3(...explode);
    this.root.add(g); this.parts.set(id, g); return g;
  }
  subpart(parent, id) { parent.userData.partId = id; parent.traverse(o => { if (o.isMesh) o.userData.partId = id; }); }
  buildFrame() {
    const g = new THREE.Group(); this.root.add(g); const m = this.mat;
    for (const z of [-.64, .64]) {
      box(g, [5.0, .15, .14], [0, .55, z], m.dark);
      box(g, [.4, .25, .18], [2.15, .65, z], m.dark);
    }
    for (const x of [-2, -1.1, .1, 1.2, 2]) box(g, [.12, .12, 1.35], [x, .55, 0], m.dark);
    box(g, [1.4, .1, 1.25], [-1.15, .64, 0], m.dark);
    for (const x of [-2.35, 2.35]) box(g, [.15, .25, 1.65], [x, .65, 0], m.steel);
  }
  buildEngine() {
    const m = this.mat, type = this.type;
    const block = this.part('engine', [1.35, 1.13, 0], [.25, .3, 0]);
    const housing = m.engine.clone(), liner = m.alum.clone();
    this.shell(box(block, [.9, .53, .12], [0, .01, -.265], housing), .1);
    this.shell(box(block, [.1, .53, .5], [-.4, .01, 0], housing), .1);
    this.shell(box(block, [.1, .53, .5], [.4, .01, 0], housing), .1);
    this.shell(box(block, [.86, .13, .58], [0, -.34, 0], m.dark), .1);
    this.shell(box(block, [.9, .07, .61], [0, .51, 0], m.alum), .1);
    this.shell(box(block, [.82, .17, .54], [0, .64, 0], m.engine), .12);
    for (const z of [-.16, 0, .16]) box(block, [.64, .022, .018], [0, .738, z], m.alum);
    for (const x of [-.32, 0, .32]) for (const z of [-.23, .23]) bolt(block, [x, .74, z], m.steel, 'y', .014);
    cyl(block, .065, .035, [-.27, .745, -.1], m.black);
    for (let i = 0; i < 4; i++) {
      const x = -.31 + i * .205;
      this.shell(cyl(block, .137, .43, [x, .27, 0], liner, 'y', 40), .09);
      torus(block, .139, .012, [x, .485, 0], m.steel, [Math.PI / 2, 0, 0]);
      torus(block, .139, .012, [x, .06, 0], m.steel, [Math.PI / 2, 0, 0]);
      bolt(block, [x, .57, -.24], m.steel, 'y', .018); bolt(block, [x, .57, .24], m.steel, 'y', .018);
    }
    for (let i = 0; i < 8; i++) bolt(block, [-.36 + (i % 4) * .24, -.255, i < 4 ? -.3 : .3], m.steel, 'y', .017);
    for (let i = 0; i < 5; i++) box(block, [.025, .38, .64], [-.36 + i * .18, .03, 0], m.engine);
    const pistons = this.part('pistons', [1.35, 1.42, 0], [.25, .85, 0]);
    for (let i = 0; i < 4; i++) {
      const pg = new THREE.Group(); pg.position.x = -.31 + i * .205; pistons.add(pg);
      cyl(pg, .103, .13, [0, 0, 0], m.alum, 'y', 40);
      cyl(pg, .099, .018, [0, .073, 0], m.steel, 'y', 40);
      for (const y of [.048, .022, -.005]) torus(pg, .104, .006, [0, y, 0], m.dark, [Math.PI / 2, 0, 0]);
      cyl(pg, .026, .19, [0, -.025, 0], m.steel, 'z', 20);
      rod(pg, [0, -.08, 0], [0, -.36, 0], .029, m.steel);
      box(pg, [.065, .19, .035], [0, -.2, 0], m.steel);
      torus(pg, .059, .018, [0, -.37, 0], m.bronze, [0, Math.PI / 2, 0]);
      for (const z of [-.055, .055]) bolt(pg, [0, -.37, z], m.dark, 'z', .014);
      this.pistons.push({ node: pg, offset: i % 2 ? Math.PI : 0 });
    }
    const crank = this.part('crankshaft', [1.35, .87, 0], [.15, -.45, 0]); this.crank = new THREE.Group(); crank.add(this.crank);
    cyl(this.crank, .052, 1.08, [0, 0, 0], m.steel, 'x', 32);
    for (let i = 0; i < 5; i++) {
      const x = -.45 + i * .225;
      cyl(this.crank, .082, .07, [x, 0, 0], m.steel, 'x', 32);
      bearing(crank, .105, [x, 0, 0], m.steel, m.dark, 'x');
      if (i < 4) {
        const sign = i % 2 ? -1 : 1;
        cyl(this.crank, .045, .18, [x + .09, sign * .11, 0], m.bronze, 'x', 28);
        const weight = box(this.crank, [.06, .22, .17], [x, -sign * .11, 0], m.dark); weight.rotation.x = .25 * sign;
        bolt(this.crank, [x + .04, -sign * .15, 0], m.steel, 'x', .014);
      }
    }
    const cam = this.part('camshaft', [1.35, 1.69, -.03], [.15, .95, -.2]); this.cam = new THREE.Group(); cam.add(this.cam);
    cyl(this.cam, .033, .95, [0, 0, -.13], m.steel, 'x', 24);
    for (let i = 0; i < 8; i++) {
      const x = -.36 + i * .105;
      const c = cyl(this.cam, .068, .04, [x, 0, -.13], m.bronze, 'x', 24); c.scale.z = 1.5;
      const valve = new THREE.Group(); valve.position.set(x, -.15, i % 2 ? .13 : -.29); cam.add(valve);
      cyl(valve, .012, .28, [0, -.12, 0], m.steel, 'y', 12);
      cyl(valve, .052, .018, [0, -.27, 0], m.dark, 'y', 24);
      spring(valve, [0, -.2, 0], .16, .032, m.spring);
      cyl(valve, .043, .018, [0, -.025, 0], m.steel, 'y', 20);
      this.valves.push({ node: valve, offset: i * Math.PI / 4, baseY: -.15 });
    }
    const timing = this.part('timing', [1.91, 1.23, 0], [.65, .35, 0]); this.timingGears = [];
    this.timingGears.push(gear(timing, .18, .055, [0, -.34, 0], m.steel), gear(timing, .25, .055, [0, .48, 0], m.bronze));
    pipe(timing, [[.01, -.49, -.15], [.01, .49, -.25], [.01, .7, 0], [.01, .48, .25], [.01, -.49, .15], [.01, -.49, -.15]], .014, m.dark);
    for (let i = 0; i < 34; i++) {
      const a = i / 34 * Math.PI * 2, y = .06 + Math.cos(a) * .56, z = Math.sin(a) * .22;
      const link = box(timing, [.045, .035, .022], [.015, y, z], i % 2 ? m.steel : m.dark); link.rotation.x = -a;
      cyl(timing, .008, .052, [.015, y, z], m.bronze, 'x', 8);
    }
    cyl(timing, .045, .1, [0, .48, 0], m.steel, 'x'); bolt(timing, [.065, .48, 0], m.dark, 'x', .025);
    const intake = this.part('intake', [1.35, 1.5, .54], [0, .5, .65]);
    for (let i = 0; i < 4; i++) {
      const x = -.31 + i * .205;
      pipe(intake, [[x, .02, -.24], [x, .12, -.08], [x * .7, .16, .05], [0, .13, .13]], .043, m.alum);
      torus(intake, .052, .009, [x, .02, -.23], m.dark, [Math.PI / 2, 0, 0]);
    }
    this.shell(cyl(intake, .15, .46, [0, .13, .13], m.alum, 'x', 36), .15);
    pipe(intake, [[-.35, .15, .13], [-.42, .32, .1], [-.2, .38, -.2]], .012, m.rubber);
    if (type === 'carb') {
      const carb = this.part('carburetor', [1.32, 1.79, .52], [.05, .9, .65]);
      this.shell(box(carb, [.32, .24, .29], [0, 0, 0], m.alum), .1);
      for (const x of [-.075, .075]) {
        cyl(carb, .06, .28, [x, .05, 0], m.dark, 'y', 28);
        torus(carb, .063, .01, [x, .2, 0], m.bronze, [Math.PI / 2, 0, 0]);
      }
      this.shell(box(carb, [.15, .17, .23], [.235, -.04, 0], m.alum), .12);
      cyl(carb, .032, .2, [.24, .04, 0], m.steel, 'z', 20);
      cyl(carb, .165, .17, [0, .29, 0], m.paper, 'y', 48);
      for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; box(carb, [.012, .17, .018], [Math.cos(a) * .164, .29, Math.sin(a) * .164], m.paper).rotation.y = -a; }
      this.shell(cyl(carb, .2, .025, [0, .39, 0], m.alum, 'y', 48), .15);
      cyl(carb, .2, .025, [0, .19, 0], m.dark, 'y', 48); bolt(carb, [0, .42, 0], m.dark, 'y', .025);
      this.throttle = new THREE.Group(); carb.add(this.throttle);
      cyl(this.throttle, .057, .012, [-.075, .035, 0], m.bronze, 'y', 28); cyl(this.throttle, .057, .012, [.075, .035, 0], m.bronze, 'y', 28);
      rod(this.throttle, [-.19, .035, 0], [.19, .035, 0], .012, m.steel);
      rod(carb, [.15, .03, .08], [.28, .02, .14], .012, m.steel); spring(carb, [.18, -.02, .13], .12, .017, m.steel);
      pipe(carb, [[.25, .04, .12], [.36, .12, .12], [.4, .16, -.12]], .015, m.copper);
    } else {
      const inj = this.part('injectors', [1.35, 1.7, .44], [.1, .95, .65]);
      cyl(inj, .032, .8, [0, .06, 0], m.steel, 'x', 24);
      for (let i = 0; i < 4; i++) {
        const x = -.31 + i * .205;
        cyl(inj, .027, .14, [x, -.02, 0], m.bronze, 'y', 20); cyl(inj, .036, .055, [x, .065, 0], m.dark, 'y', 16);
        box(inj, [.065, .055, .065], [x, .12, 0], m.plastic); pipe(inj, [[x, .12, 0], [x, .2, -.08], [0, .22, -.16]], .009, m.rubber);
        bolt(inj, [x, .09, .04], m.steel, 'y', .012);
      }
      const throttle = cyl(intake, .115, .13, [.46, .13, .13], m.alum, 'x', 32); this.throttle = throttle;
      cyl(intake, .075, .135, [.46, .13, .13], m.dark, 'x', 32);
    }
  }
  buildTransmission() {
    const m = this.mat, type = this.type;
    const clutch = this.part('clutch', [.76, 1.02, 0], [.35, .1, 0]); this.clutchDiscs = [];
    const fly = new THREE.Group(); clutch.add(fly); this.flywheel = fly;
    cyl(fly, .32, .085, [0, 0, 0], m.steel, 'x', 48); gear(fly, .345, .05, [-.05, 0, 0], m.dark, 'x', .72);
    cyl(fly, .09, .105, [0, 0, 0], m.dark, 'x', 32);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; bolt(fly, [-.055, Math.cos(a) * .15, Math.sin(a) * .15], m.dark, 'x', .016); }
    const drivenGroup = new THREE.Group(); drivenGroup.position.x = -.095; clutch.add(drivenGroup); this.clutchDriven = drivenGroup;
    cyl(drivenGroup, .21, .035, [0, 0, 0], m.dark, 'x', 40); cyl(drivenGroup, .065, .11, [0, 0, 0], m.bronze, 'x', 28);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const pad = box(drivenGroup, [.05, .095, .065], [0, Math.cos(a) * .24, Math.sin(a) * .24], m.bronze); pad.rotation.x = a;
      const rivet = cyl(drivenGroup, .009, .055, [-.01, Math.cos(a) * .24, Math.sin(a) * .24], m.steel, 'x', 8); rivet.rotation.x = a;
    }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; torus(drivenGroup, .025, .007, [-.025, Math.cos(a) * .125, Math.sin(a) * .125], m.steel, [0, Math.PI / 2, 0]); }
    this.pressurePlate = new THREE.Group(); this.pressurePlate.position.x = -.17; clutch.add(this.pressurePlate);
    this.shell(cyl(this.pressurePlate, .29, .065, [0, 0, 0], m.alum, 'x', 48), .09); torus(this.pressurePlate, .16, .025, [-.04, 0, 0], m.steel, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rod(this.pressurePlate, [-.06, Math.cos(a) * .08, Math.sin(a) * .08], [-.07, Math.cos(a) * .24, Math.sin(a) * .24], .011, m.spring); }
    bearing(clutch, .075, [-.32, 0, 0], m.steel, m.dark, 'x');
    const gb = this.part('gearbox', type === 'inject' ? [.85, .91, 0] : [.05, .91, 0], [-.25, .25, 0]);
    const gbHousing = m.alum.clone();
    this.shell(box(gb, [.74, .45, .12], [0, .01, -.22], gbHousing), .09);
    this.shell(box(gb, [.74, .1, .48], [0, -.21, 0], gbHousing), .09);
    this.shell(box(gb, [.09, .45, .48], [-.34, .01, 0], gbHousing), .09);
    this.shell(box(gb, [.09, .45, .48], [.34, .01, 0], gbHousing), .09);
    this.shell(box(gb, [.77, .055, .54], [0, .26, 0], m.dark), .1);
    for (let i = 0; i < 5; i++) box(gb, [.025, .37, .54], [-.27 + i * .135, .015, 0], m.alum);
    cyl(gb, .038, .9, [0, .03, .13], m.steel, 'x', 28); cyl(gb, .038, .82, [0, -.08, -.13], m.steel, 'x', 28);
    bearing(gb, .075, [-.37, .03, .13], m.steel, m.dark, 'x'); bearing(gb, .075, [.37, .03, .13], m.steel, m.dark, 'x');
    bearing(gb, .065, [-.37, -.08, -.13], m.steel, m.dark, 'x'); bearing(gb, .065, [.37, -.08, -.13], m.steel, m.dark, 'x');
    for (let i = 0; i < 5; i++) {
      const r = .1 + i * .018;
      const a = gear(gb, r, .065, [-.25 + i * .125, .03, .13], m.bronze);
      const b = gear(gb, .22 - r * .5, .065, [-.25 + i * .125, -.08, -.13], m.steel);
      torus(gb, r * .68, .012, [-.25 + i * .125 + .045, .03, .13], m.steel, [0, Math.PI / 2, 0]);
      cyl(gb, r * .38, .09, [-.25 + i * .125, .03, .13], m.dark, 'x', 24);
      this.gears.push({ a, b, ratio: .5 + i * .3 });
    }
    this.shiftFork = new THREE.Group(); gb.add(this.shiftFork);
    torus(this.shiftFork, .085, .018, [0, .03, .13], m.green, [0, Math.PI / 2, 0], Math.PI * 1.5);
    rod(this.shiftFork, [0, .05, .13], [0, .38, .13], .018, m.steel);
    for (const z of [-.12, 0, .12]) cyl(gb, .012, .68, [0, .34, z], m.steel, 'x', 12);
    cyl(gb, .09, .14, [.44, .03, .13], m.dark, 'x', 28); bolt(gb, [.52, .03, .13], m.steel, 'x', .025);
    if (type === 'carb') this.buildRearDrive(false);
    if (type === 'inject') this.buildFrontDrive();
    if (type === 'jeep') { this.buildTransfer(); this.buildRearDrive(true); this.buildFrontDrive(true); }
  }
  differentialDetails(diff, dg, radius) {
    const m = this.mat;
    const housing = mesh(new THREE.SphereGeometry(radius * .82, 32, 20), m.dark, dg); housing.scale.set(1.18, 1, 1); this.shell(housing, .08);
    gear(dg, radius, .065, [0, 0, 0], m.bronze, 'z', .56);
    cyl(dg, radius * .58, .12, [0, 0, 0], m.dark, 'z', 32);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; bolt(dg, [Math.cos(a) * radius * .75, Math.sin(a) * radius * .75, .045], m.steel, 'z', .013); }
    for (const z of [-.075, .075]) {
      const side = mesh(new THREE.CylinderGeometry(radius * .22, radius * .36, .07, 24), m.steel, dg, [0, 0, z]); side.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2, x = Math.cos(a) * radius * .28, y = Math.sin(a) * radius * .28;
      const satellite = mesh(new THREE.CylinderGeometry(radius * .1, radius * .19, .065, 18), m.bronze, dg, [x, y, 0]);
      satellite.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, 0).normalize());
    }
    gear(diff, radius * .37, .08, [radius * .85, 0, 0], m.steel, 'x');
    cyl(diff, radius * .18, radius * .9, [radius * 1.12, 0, 0], m.dark, 'x', 24);
    bearing(diff, radius * .31, [0, 0, -.15], m.steel, m.dark, 'z'); bearing(diff, radius * .31, [0, 0, .15], m.steel, m.dark, 'z');
  }
  buildRearDrive(jeep) {
    const m = this.mat;
    const shaft = this.part('driveshaft', [-.94, .82, 0], [0, -.05, -.45]); this.rearShaft = new THREE.Group(); shaft.add(this.rearShaft);
    cyl(this.rearShaft, .052, jeep ? 1.2 : 1.55, [0, 0, 0], m.steel, 'x');
    for (const x of [jeep ? -.63 : -.81, jeep ? .63 : .81]) {
      cyl(this.rearShaft, .095, .12, [x, 0, 0], m.dark, 'x');
      box(this.rearShaft, [.12, .28, .05], [x, 0, 0], m.steel); box(this.rearShaft, [.12, .05, .28], [x, 0, 0], m.steel);
    }
    const diff = this.part('differential', [-1.73, .66, 0], [-.4, .1, 0]);
    const dg = new THREE.Group(); diff.add(dg); this.rearDiff = dg;
    this.differentialDetails(diff, dg, .29);
    cyl(diff, .045, 1.88, [0, 0, 0], m.steel, 'z', 28);
    for (const z of [-.62, .62]) { cyl(diff, .07, .18, [0, 0, z], m.dark, 'z', 28); bearing(diff, .075, [0, 0, z], m.steel, m.dark, 'z'); }
    cyl(diff, .07, .26, [.31, 0, 0], m.dark, 'x', 28);
  }
  buildFrontDrive(jeep = false) {
    const m = this.mat;
    const diff = this.part(jeep ? 'frontAxle' : 'differential', [1.72, .67, 0], [.4, .05, 0]);
    const d = new THREE.Group(); diff.add(d); this.frontDiff = d;
    this.differentialDetails(diff, d, .245);
    cyl(diff, .04, 1.85, [0, 0, 0], m.steel, 'z', 28);
    for (const z of [-.48, .48]) { cyl(diff, .09, .09, [0, 0, z], m.dark, 'z', 28); bearing(diff, .075, [0, 0, z], m.steel, m.dark, 'z'); }
    if (jeep) {
      const shaft = this.part('frontDrive', [.91, .77, -.17], [.1, -.15, -.65]); this.frontShaft = new THREE.Group(); shaft.add(this.frontShaft);
      cyl(this.frontShaft, .045, 1.4, [0, 0, 0], m.steel, 'x');
      for (const x of [-.73, .73]) { box(shaft, [.09, .24, .045], [x, 0, 0], m.steel); box(shaft, [.09, .045, .24], [x, 0, 0], m.steel); }
    }
  }
  buildTransfer() {
    const m = this.mat, tc = this.part('transferCase', [-.05, .82, 0], [0, .65, .5]);
    this.shell(box(tc, [.48, .4, .48], [0, 0, 0], m.alum), .08);
    for (const x of [-.22, .22]) for (const z of [-.2, .2]) bolt(tc, [x, .22, z], m.steel, 'y', .018);
    this.transferGears = [gear(tc, .18, .075, [-.12, .04, .14], m.bronze), gear(tc, .23, .075, [.13, -.02, -.12], m.steel)];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; box(tc, [.035, .035, .025], [Math.cos(a) * .18, Math.sin(a) * .18, .02], m.dark).rotation.z = a; }
    bearing(tc, .07, [-.24, .04, .14], m.steel, m.dark, 'x'); bearing(tc, .085, [.24, -.02, -.12], m.steel, m.dark, 'x');
    this.transferFork = new THREE.Group(); tc.add(this.transferFork); rod(this.transferFork, [0, .05, .15], [0, .36, .15], .018, m.green);
  }
  buildWheels() {
    const m = this.mat, wg = this.part('wheels', [0, 0, 0], [0, 0, .3]);
    const radius = this.type === 'jeep' ? .52 : .46, width = this.type === 'jeep' ? .28 : .24;
    for (const x of [-1.75, 1.75]) for (const z of [-1.02, 1.02]) {
      const steer = new THREE.Group(); steer.position.set(x, radius + .035, z); wg.add(steer);
      const roll = new THREE.Group(); steer.add(roll); this.wheels.push({ roll, steer, front: x > 0, side: Math.sign(z), baseZ: z });
      if (x > 0) this.steerNodes.push(steer);
      const tire = mesh(tireGeometry(radius, width), m.rubber, roll); this.shell(tire, .055);
      for (const side of [-1, 1]) {
        torus(roll, radius * .77, .005, [0, 0, side * width * .43], m.plastic);
        torus(roll, radius * .66, .007, [0, 0, side * width * .47], m.plastic);
        torus(roll, radius * .59, .018, [0, 0, side * width * .43], m.alum);
      }
      const treadGeometry = new RoundedBoxGeometry(.044, .018, width * .24, 1, .004);
      const tread = new THREE.InstancedMesh(treadGeometry, m.rubber, 120); tread.castShadow = true;
      const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
      let index = 0;
      for (let row = -1; row <= 1; row++) for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2 + (row === 0 ? 0 : Math.PI / 40);
        const pos = new THREE.Vector3(Math.cos(a) * (radius + .002), Math.sin(a) * (radius + .002), row * width * .27);
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2 + row * .13); matrix.compose(pos, q, scale); tread.setMatrixAt(index++, matrix);
      }
      roll.add(tread); this.shell(tread, .04);
      cyl(roll, radius * .54, width * .65, [0, 0, 0], m.dark, 'z', 48);
      torus(roll, radius * .55, .025, [0, 0, Math.sign(z) * width * .36], m.alum);
      cyl(roll, .08, width * .78, [0, 0, 0], m.alum, 'z', 32);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        for (const split of [-.09, .09]) {
          const angle = a + split, r = radius * .33;
          const spoke = box(roll, [radius * .34, .034, .035], [Math.cos(angle) * r, Math.sin(angle) * r, Math.sign(z) * width * .36], m.alum); spoke.rotation.z = angle;
        }
        const lugA = a + .3;
        bolt(roll, [Math.cos(lugA) * .105, Math.sin(lugA) * .105, Math.sign(z) * width * .47], m.steel, 'z', .014);
      }
      cyl(roll, .048, .025, [0, 0, Math.sign(z) * width * .48], m.dark, 'z', 28);
      const valveAngle = .7;
      cyl(roll, .009, .055, [Math.cos(valveAngle) * radius * .52, Math.sin(valveAngle) * radius * .52, Math.sign(z) * width * .45], m.rubber, 'z', 10);
      cyl(steer, .105, .16, [0, 0, 0], m.dark, 'z', 32);
    }
  }
  buildSuspension() {
    const m = this.mat, sp = this.part('suspension', [0, 0, 0], [0, -.25, .15]);
    for (const x of [-1.75, 1.75]) for (const z of [-.79, .79]) {
      const s = spring(sp, [x, .62, z], .57, .105, m.spring); this.springs.push({ node: s, front: x > 0 });
      rod(sp, [x - .25, .55, z * .8], [x, .65, z * 1.28], .035, m.dark);
      rod(sp, [x + .25, .55, z * .8], [x, .65, z * 1.28], .035, m.dark);
    }
    const sh = this.part('shockAbsorbers', [0, 0, 0], [0, .15, .6]);
    for (const x of [-1.75, 1.75]) for (const z of [-.79, .79]) {
      cyl(sh, .045, .38, [x, .91, z], m.steel); this.shell(cyl(sh, .075, .32, [x, .69, z], m.blue), .1);
      cyl(sh, .022, .24, [x, .69, z], m.steel); cyl(sh, .06, .025, [x, .69, z], m.dark);
      for (const yy of [.57, .78]) torus(sh, .077, .012, [x, yy, z], m.steel, [Math.PI / 2, 0, 0]);
      torus(sh, .06, .015, [x, 1.14, z], m.dark, [Math.PI / 2, 0, 0]);
    }
  }
  buildSteering() {
    const m = this.mat, rack = this.part('steeringRack', [1.48, .75, 0], [.25, -.05, .45]); this.rackSlider = new THREE.Group(); rack.add(this.rackSlider);
    cyl(this.rackSlider, .045, 1.23, [0, 0, 0], m.steel, 'z', 28);
    this.shell(box(rack, [.22, .18, .62], [0, 0, 0], m.alum), .12);
    gear(rack, .09, .08, [-.08, .09, 0], m.bronze, 'x');
    for (const z of [-.58, .58]) {
      rod(this.rackSlider, [0, 0, z * .65], [.19, -.05, z * 1.4], .023, m.steel);
      mesh(new THREE.SphereGeometry(.045, 16, 10), m.dark, this.rackSlider, [.19, -.05, z * 1.4]);
      for (let i = 0; i < 5; i++) torus(rack, .065 + i * .004, .012, [0, 0, Math.sign(z) * (.31 + i * .035)], m.rubber);
    }
    for (const z of [-.2, .2]) { box(rack, [.12, .15, .055], [0, -.12, z], m.dark); bolt(rack, [0, -.19, z], m.steel, 'y', .018); }
    const col = this.part('steeringColumn', [-.55, 1.45, -.42], [-.35, .5, -.2]);
    const end = [2.03, -.7, .42];
    rod(col, [0, 0, 0], [.72, -.25, .15], .028, m.steel); rod(col, [.72, -.25, .15], [1.4, -.49, .29], .026, m.steel); rod(col, [1.4, -.49, .29], end, .026, m.steel);
    for (const p of [[.72, -.25, .15], [1.4, -.49, .29], end]) {
      mesh(new THREE.SphereGeometry(.055, 16, 12), m.dark, col, p); box(col, [.1, .12, .035], p, m.steel); box(col, [.1, .035, .12], p, m.steel);
    }
    rod(col, [1.72, -.63, .34], [1.72, -.82, .34], .022, m.dark); box(col, [.22, .035, .18], [1.72, -.82, .34], m.dark);
    const orient = new THREE.Group(); col.add(orient); orient.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, .35, -.18).normalize());
    this.steeringWheel3D = new THREE.Group(); orient.add(this.steeringWheel3D);
    torus(this.steeringWheel3D, .245, .024, [0, 0, 0], m.rubber);
    torus(this.steeringWheel3D, .245, .026, [0, 0, 0], m.plastic, [0, 0, 0], Math.PI * .5).rotation.z = Math.PI * .75;
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + Math.PI / 2;
      rod(this.steeringWheel3D, [0, 0, 0], [Math.cos(a) * .215, Math.sin(a) * .215, 0], .018, m.alum);
    }
    cyl(this.steeringWheel3D, .065, .07, [0, 0, 0], m.dark, 'z', 32); cyl(this.steeringWheel3D, .038, .075, [0, 0, 0], m.alum, 'z', 24);
    box(col, [.12, .09, .11], [.08, -.1, .04], m.plastic);
  }
  buildBrakes() {
    const m = this.mat, calipers = this.part('brakes', [0, 0, 0], [0, .1, .5]); this.brakePads = [];
    const discs = this.part('brakeDiscs', [0, 0, 0], [0, .1, .2]); this.discs = [];
    const wheelY = (this.type === 'jeep' ? .52 : .46) + .035;
    for (const x of [-1.75, 1.75]) for (const z of [-.92, .92]) {
      const disc = cyl(discs, .275, .026, [x, wheelY, z], m.steel, 'z', 48); this.discs.push(disc);
      torus(discs, .25, .012, [x, wheelY, z + .016], m.steel); torus(discs, .25, .012, [x, wheelY, z - .016], m.steel);
      cyl(discs, .105, .07, [x, wheelY, z], m.dark, 'z', 32);
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2;
        cyl(discs, .011, .032, [x + Math.cos(a) * .215, wheelY + Math.sin(a) * .215, z], m.black, 'z', 8);
        if (i % 2 === 0) rod(discs, [x + Math.cos(a) * .13, wheelY + Math.sin(a) * .13, z], [x + Math.cos(a + .16) * .245, wheelY + Math.sin(a + .16) * .245, z], .009, m.dark);
      }
      const c = box(calipers, [.16, .23, .14], [x + .21, wheelY + .055, z], m.red);
      for (const px of [x + .17, x + .25]) cyl(calipers, .037, .145, [px, wheelY + .06, z], m.red, 'z', 20);
      for (const py of [wheelY - .035, wheelY + .14]) bolt(calipers, [x + .21, py, z + Math.sign(z) * .08], m.steel, 'z', .014);
      const inner = box(calipers, [.11, .17, .022], [x + .19, wheelY + .035, z - .04], m.bronze);
      const outer = box(calipers, [.11, .17, .022], [x + .19, wheelY + .035, z + .04], m.bronze);
      pipe(calipers, [[x + .24, wheelY + .14, z], [x + .28, wheelY + .3, z * .92], [x, 1.0, z * .82]], .012, m.rubber);
      this.brakePads.push({ inner, outer, iz: inner.position.z, oz: outer.position.z });
    }
    cyl(calipers, .16, .18, [.58, 1.08, -.42], m.dark, 'x', 36);
    cyl(calipers, .045, .32, [.84, 1.08, -.42], m.alum, 'x', 28);
    box(calipers, [.2, .13, .16], [.83, 1.22, -.42], m.plastic); cyl(calipers, .035, .025, [.83, 1.3, -.42], m.black);
    for (const z of [-.45, -.36]) pipe(calipers, [[.9, 1.08, z], [1.0, .9, z], [.4, .62, z], [-1.7, .6, z]], .008, m.copper);
    pipe(calipers, [[1.0, .9, -.45], [1.45, .7, -.45], [1.7, .62, 0]], .008, m.copper);
  }
  buildSystems() {
    const m = this.mat, type = this.type;
    const rad = this.part('radiator', [2.12, 1.12, 0], [.55, .25, 0]);
    this.shell(box(rad, [.13, .62, 1.12], [0, 0, 0], m.dark), .08);
    box(rad, [.18, .1, 1.25], [0, .36, 0], m.alum); box(rad, [.18, .1, 1.25], [0, -.36, 0], m.alum);
    for (const z of [-.59, .59]) box(rad, [.2, .68, .07], [0, 0, z], m.dark);
    for (let i = 0; i < 25; i++) box(rad, [.16, .54, .012], [0, 0, -.5 + i * .042], m.steel);
    for (let i = 0; i < 9; i++) box(rad, [.17, .012, 1.04], [0, -.24 + i * .06, 0], m.alum);
    cyl(rad, .055, .035, [0, .435, -.4], m.steel, 'y', 24); bolt(rad, [0, .46, -.4], m.dark, 'y', .018);
    const fan = this.part('coolingFan', [1.97, 1.12, 0], [.25, .35, -.55]); this.fan = new THREE.Group(); fan.add(this.fan);
    torus(fan, .35, .025, [.04, 0, 0], m.dark, [0, Math.PI / 2, 0]);
    cyl(this.fan, .08, .12, [0, 0, 0], m.dark, 'x', 28);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const blade = box(this.fan, [.035, .26, .08], [0, Math.cos(a) * .19, Math.sin(a) * .19], m.black); blade.rotation.x = a; }
    pipe(fan, [[.03, .32, -.42], [-.3, .36, -.45], [-.48, .16, -.38]], .045, m.rubber);
    const oil = this.part('lubrication', [1.32, .72, .34], [.1, -.45, .45]);
    cyl(oil, .12, .2, [0, 0, 0], m.dark, 'x'); gear(oil, .085, .07, [-.11, 0, 0], m.bronze); pipe(oil, [[0, 0, 0], [-.3, -.1, 0], [-.3, -.28, 0]], .025, m.steel);
    const pump = this.part('fuelPump', type === 'carb' ? [1.45, .95, -.43] : [-1.65, .86, 0], [0, .2, -.6]);
    cyl(pump, .12, .16, [0, 0, 0], m.alum, 'x'); pipe(pump, [[0, 0, 0], [.1, .22, -.1], [.3, .25, -.1]], .018, m.copper);
    const tank = this.part('fuelTank', [-1.78, .83, 0], [-.45, .15, 0]); this.shell(box(tank, [.72, .35, 1.1], [0, 0, 0], m.dark), .08);
    for (const x of [-.23, .23]) box(tank, [.035, .37, 1.13], [x, 0, 0], m.steel);
    for (const z of [-.25, .25]) box(tank, [.62, .25, .018], [0, 0, z], m.alum);
    cyl(tank, .065, .04, [-.18, .2, -.32], m.dark); pipe(tank, [[-.18, .2, -.32], [-.35, .35, -.45], [-.45, .42, -.45]], .035, m.rubber);
    const exhaust = this.part('exhaust', [0, .38, -.48], [0, -.45, -.45]);
    pipe(exhaust, [[1.55, .83, .15], [1.3, .55, 0], [.8, 0, 0], [-1.5, 0, 0], [-2.55, .05, -.1]], .055, m.copper);
    cyl(exhaust, .13, .65, [-1.45, 0, 0], m.steel, 'x'); cyl(exhaust, .1, .5, [-.4, 0, 0], m.dark, 'x');
    const battery = this.part('battery', [1.7, .94, -.43], [.15, .5, -.5]);
    battery.userData.focusLocal = new THREE.Vector3(0, .02, 0);
    box(battery, [.54, .045, .43], [0, -.18, 0], m.dark);
    this.shell(box(battery, [.44, .29, .34], [0, 0, 0], m.plastic), .07);
    this.shell(box(battery, [.46, .035, .36], [0, .16, 0], m.dark), .1);
    for (const x of [-.145, 0, .145]) for (const z of [-.085, .085]) {
      cyl(battery, .025, .018, [x, .19, z], m.black, 'y', 16);
      const electrolyte = m.oil.clone(); electrolyte.transparent = true; electrolyte.opacity = .18; electrolyte.depthWrite = false;
      cyl(battery, .052, .21, [x, -.01, z], electrolyte, 'y', 20);
      for (let p = 0; p < 5; p++) box(battery, [.075, .16, .008], [x, -.015, z - .03 + p * .015], p % 2 ? m.steel : m.copper);
    }
    for (const x of [-.15, .15]) {
      cyl(battery, .026, .055, [x, .21, -.1], x < 0 ? m.red : m.steel, 'y', 20);
      torus(battery, .027, .007, [x, .24, -.1], m.dark, [Math.PI / 2, 0, 0]);
    }
    box(battery, [.035, .035, .4], [0, .205, 0], m.steel);
    for (const z of [-.17, .17]) bolt(battery, [0, .22, z], m.steel, 'y', .014);
    box(battery, [.28, .1, .008], [0, .02, .174], m.red);
    pipe(battery, [[-.15, .24, -.1], [-.28, .28, -.13], [-.4, .17, -.08], [-.48, -.1, .15]], .016, m.red);
    pipe(battery, [[.15, .24, -.1], [.28, .21, -.13], [.3, -.12, -.18]], .016, m.rubber);
    const alt = this.part('alternator', [1.87, .94, .47], [.55, .05, .45]); this.alternator = new THREE.Group(); alt.add(this.alternator);
    this.shell(cyl(this.alternator, .14, .28, [0, 0, 0], m.alum, 'x', 36), .1); cyl(this.alternator, .07, .34, [0, 0, 0], m.dark, 'x', 28);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      box(this.alternator, [.2, .025, .04], [0, Math.cos(a) * .13, Math.sin(a) * .13], m.dark).rotation.x = a;
      torus(this.alternator, .085, .009, [-.06 + (i % 3) * .06, 0, 0], m.copper, [0, Math.PI / 2, 0]);
    }
    bearing(alt, .06, [.18, 0, 0], m.steel, m.dark, 'x');
  }

  setExploded(value) { this.explodeTarget = value ? 1 : 0; }
  setXray(value) {
    this.xray = value;
    for (const object of this.xrayMeshes) this.updateMeshMaterial(object);
    if (this.highlighted && this.parts.has(this.highlighted)) this.parts.get(this.highlighted).traverse(object => { if (object.isMesh && !object.userData.xrayShell) this.updateMeshMaterial(object); });
  }
  updateMeshMaterial(object) {
    if (!object.isMesh || !object.userData.originalMaterial) return;
    if (object.material !== object.userData.originalMaterial) object.material.dispose();
    const mat = object.userData.originalMaterial.clone();
    if (this.xray && object.userData.xrayShell) {
      mat.transparent = true; mat.opacity = object.userData.xrayOpacity || .1; mat.depthWrite = false; mat.side = THREE.DoubleSide;
      mat.color.set(0x8fa9a2); mat.emissive = new THREE.Color(0x142a27); mat.emissiveIntensity = .35;
    }
    if (this.highlighted === object.userData.partId) {
      const shellHighlight = this.xray && object.userData.xrayShell;
      mat.emissive = new THREE.Color(this.xray && !shellHighlight ? 0x25301a : 0x6b842d);
      mat.emissiveIntensity = this.xray && !shellHighlight ? .08 : .55;
    }
    object.material = mat;
  }
  setHighlight(id) {
    if (this.highlighted === id) return;
    const previous = this.highlighted; this.highlighted = id;
    this.root.traverse(object => { if (object.isMesh && (object.userData.partId === previous || object.userData.partId === id)) this.updateMeshMaterial(object); });
  }
  getPartPosition(id) {
    const p = this.parts.get(id); if (!p) return null;
    if (p.userData.focusLocal) return p.localToWorld(p.userData.focusLocal.clone());
    const box3 = new THREE.Box3().setFromObject(p), center = box3.getCenter(new THREE.Vector3()); return center;
  }
  update(state, dt) {
    const t = Math.min(dt, .05), rpm = state.rpm || 850, running = state.running !== false;
    this.phase += t * rpm / 60 * Math.PI * 2 * .18;
    this.explode += (this.explodeTarget - this.explode) * Math.min(1, t * 5);
    for (const [id, p] of this.parts) {
      const target = p.userData.base.clone().addScaledVector(p.userData.explode, this.explode); p.position.lerp(target, Math.min(1, t * 6));
    }
    const driveFactor = state.gear === 'N' ? 0 : 1;
    const wheelSpeed = state.speed / 3.6 / (this.type === 'jeep' ? .52 : .46);
    this.wheelPhase += wheelSpeed * t;
    if (this.crank) this.crank.rotation.x = this.phase;
    if (this.flywheel) this.flywheel.rotation.x = this.phase;
    if (this.cam) this.cam.rotation.x = this.phase * .5;
    if (this.timingGears) { this.timingGears[0].rotation.x = this.phase; this.timingGears[1].rotation.x = -this.phase * .5; }
    for (const p of this.pistons) p.node.position.y = Math.sin(this.phase + p.offset) * .13;
    for (const v of this.valves) v.node.position.y = v.baseY - Math.max(0, Math.sin(this.phase * .5 + v.offset)) * .035;
    if (this.steeringWheel3D) this.steeringWheel3D.rotation.z = -state.steering * Math.PI * 2.5;
    if (this.fan) this.fan.rotation.x += t * (running ? 9 + state.gas * 18 : 0);
    if (this.alternator) this.alternator.rotation.x = this.phase * 1.8;
    if (this.throttle) this.throttle.rotation.x = state.gas * .85;
    if (this.pressurePlate) this.pressurePlate.position.x = -.17 - state.clutch * .16;
    if (this.clutchDriven) this.clutchDriven.rotation.x += t * (state.clutch > .5 ? state.speed * .06 : rpm * .002);
    const gearNumber = ['1', '2', '3', '4', '5'].indexOf(state.gear);
    if (this.shiftFork) { this.shiftFork.position.x += ((gearNumber < 0 ? 0 : -.25 + gearNumber * .125) - this.shiftFork.position.x) * t * 8; this.shiftFork.position.z = state.clutch * .08; }
    for (const g of this.gears) { const speed = (rpm * .002 + state.speed * .025) * driveFactor; g.a.rotation.x += t * speed * g.ratio; g.b.rotation.x -= t * speed; }
    const reverse = state.gear === 'R' ? -1 : 1;
    for (const w of this.wheels) {
      w.roll.rotation.z = -this.wheelPhase * reverse;
      if (w.front) w.steer.rotation.y = -state.steering * .48 * (w.side > 0 ? .93 : 1.07);
      w.steer.position.z = w.baseZ + Math.sign(w.baseZ) * this.explode * .35;
    }
    if (this.rearShaft) this.rearShaft.rotation.x += t * wheelSpeed * driveFactor * reverse;
    if (this.frontShaft) this.frontShaft.rotation.x += t * wheelSpeed * driveFactor * reverse * (state.driveMode === '2H' ? 0 : 1);
    if (this.rearDiff) this.rearDiff.rotation.z += t * wheelSpeed * driveFactor * reverse;
    if (this.frontDiff) this.frontDiff.rotation.z += t * wheelSpeed * driveFactor * reverse;
    if (this.transferGears) for (const g of this.transferGears) g.rotation.x += t * wheelSpeed * driveFactor * (state.driveMode === '4L' ? .5 : 1);
    if (this.transferFork) this.transferFork.position.y = state.driveMode === '4L' ? -.08 : state.driveMode === '2H' ? .08 : 0;
    if (this.rackSlider) this.rackSlider.position.z = state.steering * .22;
    for (const p of this.brakePads) { p.inner.position.z = p.iz + state.brake * .018; p.outer.position.z = p.oz - state.brake * .018; }
    for (const s of this.springs) s.node.scale.y = 1 - state.brake * (s.front ? .13 : -.035) - Math.abs(state.steering) * .025;
    this.root.rotation.z = -state.brake * .013; this.root.rotation.x = state.steering * Math.min(state.speed / 80, 1) * .025;
  }
  dispose() {
    this.scene.remove(this.root);
    const geometries = new Set(), materials = new Set();
    this.root.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); if (o.userData.originalMaterial) materials.add(o.userData.originalMaterial); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); this.surface.dispose();
  }
}
