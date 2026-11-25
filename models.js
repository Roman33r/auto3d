import * as THREE from 'three';

const C = {
  steel: 0x879087, darkSteel: 0x343b37, aluminum: 0xb7bdb5, black: 0x202522,
  rubber: 0x171b18, bronze: 0xb89355, copper: 0x9c6347, green: 0xc9f45b,
  engine: 0x657269, red: 0x944a3d, blue: 0x607c85, spring: 0x697568
};

function material(color, metalness = .55, roughness = .42) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function mesh(geometry, mat, parent, position = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...position); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function box(parent, size, pos, mat) { return mesh(new THREE.BoxGeometry(...size), mat, parent, pos); }
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
function gearGeometry(radius, depth, teeth = 20) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = radius * ((i % 4 === 0 || i % 4 === 3) ? .86 : 1);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, radius * .2, 0, Math.PI * 2, true); shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1 });
  g.center(); return g;
}
function gear(parent, radius, depth, pos, mat, axis = 'x') {
  const g = mesh(gearGeometry(radius, depth), mat, parent, pos);
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

export class VehicleModel {
  constructor(scene, type = 'carb') {
    this.scene = scene; this.type = type; this.root = new THREE.Group(); this.parts = new Map();
    this.wheels = []; this.steerNodes = []; this.pistons = []; this.gears = []; this.springs = [];
    this.phase = 0; this.wheelPhase = 0; this.explode = 0; this.explodeTarget = 0; this.highlighted = null;
    scene.add(this.root);
    this.mat = {
      steel: material(C.steel), dark: material(C.darkSteel), alum: material(C.aluminum, .8, .28), black: material(C.black, .25),
      rubber: material(C.rubber, .05, .8), bronze: material(C.bronze, .7, .3), copper: material(C.copper),
      green: material(C.green, .35), engine: material(C.engine, .65), red: material(C.red, .3), blue: material(C.blue), spring: material(C.spring)
    };
    this.buildFrame(); this.buildEngine(); this.buildTransmission(); this.buildWheels(); this.buildSuspension(); this.buildSteering(); this.buildBrakes(); this.buildSystems();
    this.root.traverse(o => { if (o.isMesh) { o.userData.originalMaterial = o.material; } });
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
    const housing = m.engine.clone(); housing.transparent = true; housing.opacity = .28; housing.depthWrite = false;
    box(block, [.9, .55, .63], [0, 0, 0], housing);
    box(block, [.82, .12, .58], [0, -.35, 0], m.dark);
    for (let i = 0; i < 4; i++) {
      const x = -.31 + i * .205;
      cyl(block, .135, .42, [x, .29, 0], m.alum, 'y', 24);
      cyl(block, .108, .44, [x, .31, 0], m.black, 'y', 24);
    }
    box(block, [.91, .09, .64], [0, .52, 0], m.alum);
    const pistons = this.part('pistons', [1.35, 1.42, 0], [.25, .85, 0]);
    for (let i = 0; i < 4; i++) {
      const pg = new THREE.Group(); pg.position.x = -.31 + i * .205; pistons.add(pg);
      cyl(pg, .103, .15, [0, 0, 0], m.alum); torus(pg, .104, .008, [0, .04, 0], m.steel, [Math.PI / 2, 0, 0]);
      rod(pg, [0, -.08, 0], [0, -.38, 0], .035, m.bronze);
      this.pistons.push({ node: pg, offset: i % 2 ? Math.PI : 0 });
    }
    const crank = this.part('crankshaft', [1.35, .87, 0], [.15, -.45, 0]); this.crank = new THREE.Group(); crank.add(this.crank);
    cyl(this.crank, .052, 1.08, [0, 0, 0], m.steel, 'x');
    for (let i = 0; i < 5; i++) {
      const x = -.45 + i * .225; cyl(this.crank, .12, .055, [x, 0, 0], m.steel, 'x');
      if (i < 4) {
        const sign = i % 2 ? -1 : 1;
        cyl(this.crank, .045, .17, [x + .09, sign * .11, 0], m.bronze, 'x');
        box(this.crank, [.055, .19, .14], [x, -sign * .1, 0], m.dark);
      }
    }
    const cam = this.part('camshaft', [1.35, 1.69, -.16], [.15, .95, -.2]); this.cam = new THREE.Group(); cam.add(this.cam);
    cyl(this.cam, .035, .95, [0, 0, 0], m.steel, 'x');
    for (let i = 0; i < 8; i++) {
      const c = cyl(this.cam, .075, .045, [-.36 + i * .105, 0, 0], m.bronze, 'x'); c.scale.z = 1.4;
    }
    const timing = this.part('timing', [1.91, 1.23, 0], [.65, .35, 0]); this.timingGears = [];
    this.timingGears.push(gear(timing, .18, .06, [0, -.34, 0], m.steel), gear(timing, .25, .06, [0, .48, 0], m.bronze));
    pipe(timing, [[.02, -.5, -.15], [.02, .49, -.25], [.02, .65, 0], [.02, .48, .25], [.02, -.5, .15], [.02, -.5, -.15]], .018, m.rubber);
    const intake = this.part('intake', [1.35, 1.5, .54], [0, .5, .65]);
    for (let i = 0; i < 4; i++) pipe(intake, [[-.31 + i * .205, .05, -.22], [-.31 + i * .205, .13, 0], [0, .13, .12]], .046, m.alum);
    cyl(intake, .15, .46, [0, .13, .13], m.alum, 'x');
    if (type === 'carb') {
      const carb = this.part('carburetor', [1.32, 1.83, .52], [.05, .9, .65]);
      box(carb, [.35, .26, .3], [0, 0, 0], m.alum); cyl(carb, .14, .13, [0, .18, 0], m.dark);
      cyl(carb, .18, .1, [0, .3, 0], m.alum); this.throttle = new THREE.Group(); carb.add(this.throttle);
      cyl(this.throttle, .12, .018, [0, .04, 0], m.bronze); rod(this.throttle, [-.2, .04, 0], [.2, .04, 0], .018, m.steel);
      box(carb, [.16, .15, .23], [.24, -.08, 0], m.alum);
    } else {
      const inj = this.part('injectors', [1.35, 1.7, .44], [.1, .95, .65]);
      cyl(inj, .035, .8, [0, .06, 0], m.steel, 'x');
      for (let i = 0; i < 4; i++) { cyl(inj, .033, .17, [-.31 + i * .205, 0, 0], m.bronze); box(inj, [.07, .07, .07], [-.31 + i * .205, .1, 0], m.black); }
      const throttle = box(intake, [.12, .25, .25], [.48, .13, .13], m.alum); this.throttle = throttle;
    }
  }
  buildTransmission() {
    const m = this.mat, type = this.type;
    const clutch = this.part('clutch', [.76, 1.02, 0], [.35, .1, 0]); this.clutchDiscs = [];
    const fly = new THREE.Group(); clutch.add(fly); this.flywheel = fly;
    cyl(fly, .32, .09, [0, 0, 0], m.steel, 'x'); gear(fly, .34, .055, [-.05, 0, 0], m.dark);
    const driven = cyl(clutch, .275, .045, [-.095, 0, 0], m.bronze, 'x'); this.clutchDriven = driven;
    this.pressurePlate = new THREE.Group(); this.pressurePlate.position.x = -.17; clutch.add(this.pressurePlate);
    cyl(this.pressurePlate, .29, .07, [0, 0, 0], m.alum, 'x'); torus(this.pressurePlate, .16, .025, [-.04, 0, 0], m.steel, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; rod(this.pressurePlate, [-.06, Math.cos(a) * .1, Math.sin(a) * .1], [-.07, Math.cos(a) * .24, Math.sin(a) * .24], .012, m.spring); }
    const gb = this.part('gearbox', type === 'inject' ? [.85, .91, 0] : [.05, .91, 0], [-.25, .25, 0]);
    const gbHousing = m.alum.clone(); gbHousing.transparent = true; gbHousing.opacity = .24; gbHousing.depthWrite = false;
    box(gb, [.72, .48, .5], [0, 0, 0], gbHousing); box(gb, [.77, .06, .54], [0, .26, 0], m.dark);
    cyl(gb, .038, .82, [0, .03, .13], m.steel, 'x'); cyl(gb, .038, .82, [0, -.08, -.13], m.steel, 'x');
    for (let i = 0; i < 5; i++) {
      const r = .1 + i * .018;
      const a = gear(gb, r, .07, [-.25 + i * .125, .03, .13], m.bronze);
      const b = gear(gb, .22 - r * .5, .07, [-.25 + i * .125, -.08, -.13], m.steel);
      this.gears.push({ a, b, ratio: .5 + i * .3 });
    }
    this.shiftFork = new THREE.Group(); gb.add(this.shiftFork);
    torus(this.shiftFork, .085, .018, [0, .03, .13], m.green, [0, Math.PI / 2, 0], Math.PI * 1.5);
    rod(this.shiftFork, [0, .05, .13], [0, .38, .13], .018, m.steel);
    if (type === 'carb') this.buildRearDrive(false);
    if (type === 'inject') this.buildFrontDrive();
    if (type === 'jeep') { this.buildTransfer(); this.buildRearDrive(true); this.buildFrontDrive(true); }
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
    const sphere = mesh(new THREE.SphereGeometry(.24, 20, 14), m.dark, dg); sphere.scale.set(1.2, 1, 1);
    gear(dg, .29, .07, [0, 0, 0], m.bronze, 'z'); cyl(diff, .045, 1.88, [0, 0, 0], m.steel, 'z');
    cyl(diff, .07, .26, [.31, 0, 0], m.dark, 'x');
  }
  buildFrontDrive(jeep = false) {
    const m = this.mat;
    const diff = this.part(jeep ? 'frontAxle' : 'differential', [1.72, .67, 0], [.4, .05, 0]);
    const d = new THREE.Group(); diff.add(d); this.frontDiff = d;
    const s = mesh(new THREE.SphereGeometry(.21, 18, 12), m.dark, d); s.scale.x = 1.25;
    gear(d, .24, .065, [0, 0, 0], m.bronze, 'z'); cyl(diff, .04, 1.85, [0, 0, 0], m.steel, 'z');
    for (const z of [-.48, .48]) { cyl(diff, .09, .09, [0, 0, z], m.dark, 'z'); }
    if (jeep) {
      const shaft = this.part('frontDrive', [.91, .77, -.17], [.1, -.15, -.65]); this.frontShaft = new THREE.Group(); shaft.add(this.frontShaft);
      cyl(this.frontShaft, .045, 1.4, [0, 0, 0], m.steel, 'x');
      for (const x of [-.73, .73]) { box(shaft, [.09, .24, .045], [x, 0, 0], m.steel); box(shaft, [.09, .045, .24], [x, 0, 0], m.steel); }
    }
  }
  buildTransfer() {
    const m = this.mat, tc = this.part('transferCase', [-.05, .82, 0], [0, .65, .5]);
    box(tc, [.48, .4, .48], [0, 0, 0], m.alum);
    this.transferGears = [gear(tc, .18, .08, [-.12, .04, .14], m.bronze), gear(tc, .23, .08, [.13, -.02, -.12], m.steel)];
    this.transferFork = new THREE.Group(); tc.add(this.transferFork); rod(this.transferFork, [0, .05, .15], [0, .36, .15], .018, m.green);
  }
  buildWheels() {
    const m = this.mat, wg = this.part('wheels', [0, 0, 0], [0, 0, .3]);
    const radius = this.type === 'jeep' ? .52 : .46;
    for (const x of [-1.75, 1.75]) for (const z of [-1.02, 1.02]) {
      const steer = new THREE.Group(); steer.position.set(x, radius + .12, z); wg.add(steer);
      const roll = new THREE.Group(); steer.add(roll); this.wheels.push({ roll, steer, front: x > 0, side: Math.sign(z), baseZ: z });
      if (x > 0) this.steerNodes.push(steer);
      torus(roll, radius - .13, .13, [0, 0, 0], m.rubber);
      torus(roll, radius - .13, .132, [0, 0, 0], m.rubber, [0, 0, 0], Math.PI * 2).scale.set(1, 1, .75);
      cyl(roll, radius - .22, .15, [0, 0, 0], m.steel, 'z', 32);
      cyl(roll, radius - .29, .17, [0, 0, 0], m.dark, 'z', 32);
      cyl(roll, .075, .22, [0, 0, 0], m.alum, 'z');
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const spoke = box(roll, [radius * .38, .035, .04], [Math.cos(a) * radius * .29, Math.sin(a) * radius * .29, Math.sign(z) * .09], m.alum);
        spoke.rotation.z = a;
      }
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2;
        const tread = box(roll, [.055, .022, .2], [Math.cos(a) * (radius - .012), Math.sin(a) * (radius - .012), 0], m.black); tread.rotation.z = a;
      }
      const hub = cyl(steer, .1, .18, [0, 0, 0], m.dark, 'z'); hub.userData.partId = 'wheels';
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
      cyl(sh, .045, .38, [x, .91, z], m.steel); cyl(sh, .075, .32, [x, .69, z], m.blue);
      torus(sh, .06, .015, [x, 1.14, z], m.dark, [Math.PI / 2, 0, 0]);
    }
  }
  buildSteering() {
    const m = this.mat, rack = this.part('steeringRack', [1.48, .75, 0], [.25, -.05, .45]); this.rackSlider = new THREE.Group(); rack.add(this.rackSlider);
    cyl(this.rackSlider, .055, 1.23, [0, 0, 0], m.steel, 'z');
    box(rack, [.2, .17, .62], [0, 0, 0], m.dark);
    for (const z of [-.58, .58]) rod(this.rackSlider, [0, 0, z * .65], [.19, -.05, z * 1.4], .025, m.steel);
    for (const z of [-.35, .35]) cyl(rack, .1, .25, [0, 0, z], m.rubber, 'z');
    const col = this.part('steeringColumn', [1.05, 1.14, -.48], [.1, .65, -.45]);
    rod(col, [0, .62, -.38], [.43, -.38, 0], .033, m.steel); cyl(col, .085, .12, [.43, -.38, 0], m.dark, 'x');
    torus(col, .25, .025, [-.03, .67, -.39], m.black, [.45, 0, .6]);
  }
  buildBrakes() {
    const m = this.mat, calipers = this.part('brakes', [0, 0, 0], [0, .1, .5]); this.brakePads = [];
    const discs = this.part('brakeDiscs', [0, 0, 0], [0, .1, .2]); this.discs = [];
    for (const x of [-1.75, 1.75]) for (const z of [-.92, .92]) {
      const disc = cyl(discs, .29, .035, [x, .58 + (this.type === 'jeep' ? .06 : 0), z], m.steel, 'z', 32); this.discs.push(disc);
      cyl(discs, .13, .045, [x, .58 + (this.type === 'jeep' ? .06 : 0), z], m.dark, 'z');
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cyl(discs, .012, .041, [x + Math.cos(a) * .22, .58 + Math.sin(a) * .22 + (this.type === 'jeep' ? .06 : 0), z], m.black, 'z', 8); }
      const c = box(calipers, [.15, .22, .13], [x + .22, .65 + (this.type === 'jeep' ? .06 : 0), z], m.red);
      const inner = box(calipers, [.1, .17, .025], [x + .2, .62 + (this.type === 'jeep' ? .06 : 0), z - .045], m.bronze);
      const outer = box(calipers, [.1, .17, .025], [x + .2, .62 + (this.type === 'jeep' ? .06 : 0), z + .045], m.bronze);
      this.brakePads.push({ inner, outer, iz: inner.position.z, oz: outer.position.z });
    }
  }
  buildSystems() {
    const m = this.mat, type = this.type;
    const rad = this.part('radiator', [2.12, 1.12, 0], [.55, .25, 0]);
    box(rad, [.13, .67, 1.18], [0, 0, 0], m.dark); box(rad, [.15, .08, 1.25], [0, .37, 0], m.alum); box(rad, [.15, .08, 1.25], [0, -.37, 0], m.alum);
    for (let i = 0; i < 17; i++) box(rad, [.16, .55, .018], [0, 0, -.5 + i * .062], m.steel);
    const fan = this.part('coolingFan', [1.97, 1.12, 0], [.25, .35, -.55]); this.fan = new THREE.Group(); fan.add(this.fan);
    cyl(this.fan, .08, .12, [0, 0, 0], m.dark, 'x');
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const blade = box(this.fan, [.035, .26, .08], [0, Math.cos(a) * .19, Math.sin(a) * .19], m.black); blade.rotation.x = a; }
    pipe(fan, [[.03, .32, -.42], [-.3, .36, -.45], [-.48, .16, -.38]], .045, m.rubber);
    const oil = this.part('lubrication', [1.32, .72, .34], [.1, -.45, .45]);
    cyl(oil, .12, .2, [0, 0, 0], m.dark, 'x'); gear(oil, .085, .07, [-.11, 0, 0], m.bronze); pipe(oil, [[0, 0, 0], [-.3, -.1, 0], [-.3, -.28, 0]], .025, m.steel);
    const pump = this.part('fuelPump', type === 'carb' ? [1.45, .95, -.43] : [-1.65, .86, 0], [0, .2, -.6]);
    cyl(pump, .12, .16, [0, 0, 0], m.alum, 'x'); pipe(pump, [[0, 0, 0], [.1, .22, -.1], [.3, .25, -.1]], .018, m.copper);
    const tank = this.part('fuelTank', [-1.78, .83, 0], [-.45, .15, 0]); box(tank, [.72, .35, 1.1], [0, 0, 0], m.dark);
    for (const x of [-.23, .23]) box(tank, [.035, .37, 1.13], [x, 0, 0], m.steel);
    const exhaust = this.part('exhaust', [0, .38, -.48], [0, -.45, -.45]);
    pipe(exhaust, [[1.55, .83, .15], [1.3, .55, 0], [.8, 0, 0], [-1.5, 0, 0], [-2.55, .05, -.1]], .055, m.copper);
    cyl(exhaust, .13, .65, [-1.45, 0, 0], m.steel, 'x'); cyl(exhaust, .1, .5, [-.4, 0, 0], m.dark, 'x');
    const battery = this.part('battery', [1.72, 1.1, -.63], [.25, .5, -.65]); box(battery, [.45, .38, .35], [0, 0, 0], m.black); box(battery, [.47, .04, .37], [0, .21, 0], m.dark);
    cyl(battery, .028, .06, [-.15, .25, -.1], m.red); cyl(battery, .028, .06, [.15, .25, -.1], m.steel);
    const alt = this.part('alternator', [1.87, .94, .47], [.55, .05, .45]); this.alternator = new THREE.Group(); alt.add(this.alternator);
    cyl(this.alternator, .14, .28, [0, 0, 0], m.alum, 'x'); cyl(this.alternator, .07, .34, [0, 0, 0], m.dark, 'x');
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; box(this.alternator, [.2, .025, .04], [0, Math.cos(a) * .13, Math.sin(a) * .13], m.dark).rotation.x = a; }
  }

  setExploded(value) { this.explodeTarget = value ? 1 : 0; }
  setHighlight(id) {
    if (this.highlighted === id) return;
    if (this.highlighted && this.parts.has(this.highlighted)) this.parts.get(this.highlighted).traverse(o => { if (o.isMesh && o.userData.originalMaterial) o.material = o.userData.originalMaterial; });
    this.highlighted = id;
    if (id && this.parts.has(id)) this.parts.get(id).traverse(o => {
      if (!o.isMesh) return; const mat = o.userData.originalMaterial.clone(); mat.emissive = new THREE.Color(0x6b842d); mat.emissiveIntensity = .5; o.material = mat;
    });
  }
  getPartPosition(id) {
    const p = this.parts.get(id); if (!p) return null;
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
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }
}
