import * as THREE from 'three';
import { C, mdCss } from './palette.js';
import { box, cyl, mat, makePlane, makeBarrier, makeSwitch, makeTextSign } from './models.js';

// Mapa terminala (pogled odozgo, -z je sever, ka pisti):
//   z = -8   stakleni zid sa tri izlaza (A, B, C) ka avionima
//   z = 15   ulazna vrata (tu se pojavljuju putnici i kriminalci)
export const BOUNDS = { xMin: -17.6, xMax: 17.6, zMin: -8, zMax: 14.6 };
export const WALL_Z = -8;
export const ESCAPE_Z = -9.4;
export const GATES = [
  { id: 'A', x: -11, dest: 'KIPAR' },
  { id: 'B', x: 0, dest: 'DUBAI' },
  { id: 'C', x: 11, dest: 'PANAMA' },
];
export const GATE_HALF = 1.5;
export const DOORS = [-10, 0, 10];

const CELL = 0.5;
const GX0 = -18, GZ0 = -10.5;
const GW = 72, GH = 52;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = []; // {x, z, hx, hz}
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildWalls();
    this.buildProps();
    this.buildPlanes();
    this.buildBarriers();
    this.buildGrid();
    this.fields = new Map();
    this.pois = [
      { name: 'trafika', x: -13, z: 10.5 },
      { name: 'pekara', x: 13, z: 10.5 },
      { name: 'šalter', x: -10, z: 5.3 },
      { name: 'šalter', x: 10, z: 5.3 },
      { name: 'klupa', x: -5.5, z: -2.4 },
      { name: 'klupa', x: 5.5, z: -2.4 },
      { name: 'tabla', x: 0, z: 2 },
    ];
  }

  // ---------- izgradnja ----------
  buildGround() {
    // kockasti pod terminala
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const x = cv.getContext('2d');
    x.fillStyle = mdCss(6, 6, 5); x.fillRect(0, 0, 16, 16);
    x.fillStyle = mdCss(4, 4, 5); x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 12);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 23.5), new THREE.MeshLambertMaterial({ map: tex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 3.25);
    this.group.add(floor);

    // crveni tepih ka izlazima
    for (const g of GATES) box(3, 0.02, 4, C.redD, g.x, 0.01, -6, this.group);

    // pista
    const tarmac = box(160, 0.1, 60, C.tarmac, 0, -0.06, -38, this.group);
    tarmac.position.y = -0.065;
    box(160, 0.1, 40, C.grass, 0, -0.08, -88, this.group);
    box(160, 0.1, 30, C.grass, 0, -0.08, 30, this.group);
    for (let i = -14; i <= 14; i++) box(2.2, 0.03, 0.25, C.yellow, i * 5, 0.0, -24, this.group);
    for (const g of GATES) box(0.25, 0.03, 8, C.yellow, g.x, 0.0, -13, this.group);
  }

  addObstacle(x, z, hx, hz) {
    this.obstacles.push({ x, z, hx, hz });
  }

  buildWalls() {
    const g = this.group;
    // bočni zidovi
    box(0.6, 3, 24, C.wall, -18.3, 1.5, 3.2, g);
    box(0.6, 3, 24, C.wall, 18.3, 1.5, 3.2, g);
    box(0.62, 0.4, 24, C.wallD, -18.3, 0.2, 3.2, g);
    box(0.62, 0.4, 24, C.wallD, 18.3, 0.2, 3.2, g);

    // stakleni zid sa izlazima
    const glassMat = new THREE.MeshLambertMaterial({ color: C.glass, transparent: true, opacity: 0.45 });
    const edges = [-18.6, ...GATES.flatMap((gt) => [gt.x - GATE_HALF, gt.x + GATE_HALF]), 18.6];
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i], b = edges[i + 1];
      const w = b - a, cx = (a + b) / 2;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, 0.2), glassMat);
      glass.position.set(cx, 1.5, WALL_Z);
      g.add(glass);
      box(w, 0.3, 0.5, C.wallD, cx, 0.15, WALL_Z, g);
      box(w, 0.25, 0.5, C.wallD, cx, 2.8, WALL_Z, g);
      for (let px = a; px <= b + 0.01; px += Math.max(1, w / Math.ceil(w / 3))) box(0.15, 2.6, 0.3, C.wallD, px, 1.4, WALL_Z, g);
      this.addObstacle(cx, WALL_Z, w / 2, 0.3);
    }
    for (const gt of GATES) {
      // ram izlaza + detektor metala + natpis
      box(0.3, 2.9, 0.6, C.grayD, gt.x - GATE_HALF - 0.1, 1.45, WALL_Z, g);
      box(0.3, 2.9, 0.6, C.grayD, gt.x + GATE_HALF + 0.1, 1.45, WALL_Z, g);
      box(3.4, 0.4, 0.6, C.grayD, gt.x, 3.0, WALL_Z, g);
      box(0.2, 2.2, 0.5, C.gray, gt.x - 0.9, 1.1, WALL_Z + 1.2, g);
      box(0.2, 2.2, 0.5, C.gray, gt.x + 0.9, 1.1, WALL_Z + 1.2, g);
      box(2.0, 0.25, 0.5, C.gray, gt.x, 2.25, WALL_Z + 1.2, g);
      const sign = makeTextSign(`IZLAZ ${gt.id}`, 2.6, 0.6, mdCss(0, 1, 5), mdCss(7, 7, 0));
      sign.position.set(gt.x, 3.6, WALL_Z + 0.05);
      g.add(sign);
      const dest = makeTextSign(gt.dest, 2.6, 0.5, mdCss(0, 0, 0), mdCss(7, 4, 0));
      dest.position.set(gt.x, 4.15, WALL_Z + 0.05);
      g.add(dest);
    }

    // južni zid sa vratima (nizak, da ne zaklanja kameru)
    const doorEdges = [-18.6, ...DOORS.flatMap((d) => [d - 1.4, d + 1.4]), 18.6];
    for (let i = 0; i < doorEdges.length; i += 2) {
      const a = doorEdges[i], b = doorEdges[i + 1];
      box(b - a, 0.8, 0.4, C.wallD, (a + b) / 2, 0.4, 15.1, g);
      this.addObstacle((a + b) / 2, 15.2, (b - a) / 2, 0.3);
    }
    for (const d of DOORS) {
      box(2.8, 0.03, 1.2, C.grayD, d, 0.02, 14.6, g);
      const s = makeTextSign('ULAZ', 1.6, 0.4, mdCss(0, 4, 0), mdCss(7, 7, 7));
      s.position.set(d, 1.2, 15.15);
      s.rotation.x = -0.6;
      g.add(s);
    }
  }

  buildProps() {
    const g = this.group;
    // šalteri za čekiranje
    for (const side of [-1, 1]) {
      const cx = side * 10;
      box(8, 1.0, 1.0, C.wood, cx, 0.5, 3.5, g);
      box(8.1, 0.12, 1.1, C.grayL, cx, 1.05, 3.5, g);
      box(8, 0.5, 0.8, C.black, cx, 0.25, 2.6, g); // traka za prtljag
      for (let i = 0; i < 4; i++) {
        const n = (side < 0 ? 1 : 5) + i;
        const s = makeTextSign(`ŠALTER ${n}`, 1.7, 0.4, mdCss(0, 1, 5), mdCss(7, 7, 7));
        s.position.set(cx - 3 + i * 2, 1.9, 3.6);
        g.add(s);
        box(0.1, 0.7, 0.1, C.gray, cx - 3 + i * 2, 1.4, 3.6, g);
      }
      this.addObstacle(cx, 3.2, 4, 0.9);
    }

    // klupe
    for (const [x, z] of [[-5.5, -3.5], [5.5, -3.5], [-14, -3.5], [14, -3.5]]) {
      box(4, 0.15, 0.8, C.blue, x, 0.45, z, g);
      box(4, 0.6, 0.15, C.blue, x, 0.75, z - 0.35, g);
      for (const dx of [-1.7, 1.7]) box(0.15, 0.45, 0.6, C.grayD, x + dx, 0.22, z, g);
      this.addObstacle(x, z, 2, 0.45);
    }

    // stubovi
    for (const [x, z] of [[-15.5, 3.5], [15.5, 3.5]]) {
      cyl(0.45, 0.45, 4, C.wall, 8, x, 2, z, g);
      cyl(0.5, 0.5, 0.3, C.wallD, 8, x, 0.15, z, g);
      this.addObstacle(x, z, 0.45, 0.45);
    }

    // saksije
    for (const [x, z] of [[0, 6.5], [-4, -6], [4, -6], [-16.8, -6.8], [16.8, -6.8]]) {
      cyl(0.4, 0.3, 0.6, C.brown, 8, x, 0.3, z, g);
      box(0.7, 0.8, 0.7, C.green, x, 1.0, z, g);
      box(0.4, 0.5, 0.4, C.greenD, x + 0.1, 1.5, z - 0.1, g);
      this.addObstacle(x, z, 0.4, 0.4);
    }

    // trafika
    box(4, 2.2, 3, C.blue, -15.8, 1.1, 10.3, g);
    box(4.2, 0.2, 3.4, C.red, -15.8, 2.3, 10.4, g);
    box(2.6, 0.8, 0.1, C.yellow, -15.8, 1.3, 11.85, g);
    const tr = makeTextSign('TRAFIKA', 2.6, 0.5, mdCss(7, 0, 0), mdCss(7, 7, 7));
    tr.position.set(-15.8, 2.7, 11.9);
    g.add(tr);
    this.addObstacle(-15.8, 10.3, 2, 1.5);

    // pekara
    box(4, 2.2, 3, C.wood, 15.8, 1.1, 10.3, g);
    box(4.2, 0.2, 3.4, C.orange, 15.8, 2.3, 10.4, g);
    for (let i = 0; i < 4; i++) cyl(0.25, 0.25, 0.1, C.gold, 8, 14.6 + i * 0.6, 1.25, 11.9, g);
    const pk = makeTextSign('PEKARA BUREK', 3.2, 0.5, mdCss(7, 5, 0), mdCss(2, 1, 0));
    pk.position.set(15.8, 2.7, 11.9);
    g.add(pk);
    this.addObstacle(15.8, 10.3, 2, 1.5);

    // tabla sa letovima
    box(5, 1.6, 0.3, C.black, 0, 3.2, -0.2, g);
    box(0.2, 2.4, 0.2, C.gray, -2, 1.2, -0.2, g);
    box(0.2, 2.4, 0.2, C.gray, 2, 1.2, -0.2, g);
    const rows = ['KIPAR    ODLAZAK', 'DUBAI    ODLAZAK', 'PANAMA   KASNI', 'ZEMUN    OTKAZAN'];
    rows.forEach((r, i) => {
      const s = makeTextSign(r, 4.6, 0.32, mdCss(0, 0, 0), mdCss(7, 6, 0));
      s.position.set(0, 3.75 - i * 0.37, -0.04);
      g.add(s);
    });
    this.addObstacle(-2, -0.2, 0.2, 0.2);
    this.addObstacle(2, -0.2, 0.2, 0.2);

    // veliki natpis
    const title = makeTextSign('AERODROM BEOGRAD', 10, 1.0, mdCss(0, 0, 3), mdCss(7, 7, 7));
    title.position.set(0, 5.3, WALL_Z - 0.3);
    g.add(title);
  }

  buildPlanes() {
    const liveries = [[C.white, C.blue], [C.white, C.red], [C.grayL, C.green]];
    this.planes = GATES.map((gt, i) => {
      const p = makePlane(...liveries[i]);
      const home = new THREE.Vector3(gt.x + 3, 0, -15.5 - (i % 2) * 1.5);
      p.position.copy(home);
      this.group.add(p);
      return { mesh: p, home, state: 'parked', t: 0 };
    });
    // putnički mostovi
    for (const gt of GATES) box(1.6, 1.2, 5, C.gray, gt.x, 1.8, -10.8, this.group);
  }

  takeOff(gateIndex) {
    const pl = this.planes[gateIndex];
    if (pl.state !== 'parked') return;
    pl.state = 'taxi';
    pl.t = 0;
  }

  updatePlanes(dt) {
    for (const pl of this.planes) {
      if (pl.state === 'parked') continue;
      pl.t += dt;
      const m = pl.mesh;
      if (pl.state === 'taxi') {
        const speed = Math.min(30, pl.t * pl.t * 6);
        m.position.x += speed * dt;
        if (pl.t > 1.4) m.position.y += (pl.t - 1.4) * dt * 9;
        m.rotation.z = Math.min(0.25, Math.max(0, (pl.t - 1.4) * 0.3));
        if (pl.t > 5) { pl.state = 'gone'; pl.t = 0; m.visible = false; }
      } else if (pl.state === 'gone' && pl.t > 4) {
        m.position.copy(pl.home);
        m.rotation.set(0, 0, 0);
        m.visible = true;
        pl.state = 'parked';
      }
    }
  }

  buildBarriers() {
    this.barriers = GATES.map((gt) => {
      const b = makeBarrier();
      b.root.position.set(gt.x - GATE_HALF + 0.1, 0, WALL_Z + 0.55);
      b.root.visible = false;
      this.group.add(b.root);
      return { ...b, closed: false, timer: 0, anim: 0 };
    });
    this.switches = [];
  }

  setupBossMode(switchSpots) {
    for (const b of this.barriers) { b.root.visible = true; b.closed = false; b.anim = 0; b.timer = 0; }
    for (const s of this.switches) this.group.remove(s.root);
    const colors = [C.red, C.yellow, C.cyan];
    this.switches = switchSpots.map((p, i) => {
      const sw = makeSwitch(colors[i]);
      sw.root.position.set(p.x, 0, p.z);
      this.group.add(sw.root);
      const sign = makeTextSign(`RAMPA ${GATES[i].id}`, 1.8, 0.4, mdCss(0, 0, 0), mdCss(7, 7, 0));
      sign.position.set(0, 2.6, 0);
      sign.rotation.x = -0.7;
      sw.root.add(sign);
      return { ...sw, gate: i, hold: 0, x: p.x, z: p.z };
    });
    this.fields.clear();
  }

  clearBossMode() {
    for (const b of this.barriers) { b.root.visible = false; b.closed = false; b.anim = 0; b.arm.rotation.z = Math.PI / 2 - 0.05; }
    for (const s of this.switches) this.group.remove(s.root);
    this.switches = [];
    this.fields.clear();
  }

  updateBarriers(dt) {
    for (const b of this.barriers) {
      const target = b.closed ? 1 : 0;
      b.anim += (target - b.anim) * Math.min(1, dt * 8);
      b.arm.rotation.z = (Math.PI / 2 - 0.05) * (1 - b.anim);
    }
  }

  openGates() {
    return GATES.map((_, i) => i).filter((i) => !this.barriers[i].closed);
  }

  // ---------- kolizije ----------
  collide(p, r) {
    for (const o of this.obstacles) {
      const cx = Math.max(o.x - o.hx, Math.min(p.x, o.x + o.hx));
      const cz = Math.max(o.z - o.hz, Math.min(p.z, o.z + o.hz));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          // centar unutar kutije: izbaci po najkraćoj osi
          const px = o.hx - Math.abs(p.x - o.x) + r;
          const pz = o.hz - Math.abs(p.z - o.z) + r;
          if (px < pz) p.x += Math.sign(p.x - o.x || 1) * px;
          else p.z += Math.sign(p.z - o.z || 1) * pz;
        }
      }
    }
    // zatvorene rampe su zid
    for (let i = 0; i < GATES.length; i++) {
      if (!this.barriers[i].closed) continue;
      const gx = GATES[i].x;
      if (Math.abs(p.x - gx) < GATE_HALF + r && p.z < WALL_Z + 0.4 + r && p.z > WALL_Z - 1.5) {
        p.z = WALL_Z + 0.4 + r;
      }
    }
    p.x = Math.max(BOUNDS.xMin, Math.min(BOUNDS.xMax, p.x));
  }

  blocked(x, z, r = 0.35) {
    for (const o of this.obstacles) {
      if (Math.abs(x - o.x) < o.hx + r && Math.abs(z - o.z) < o.hz + r) return true;
    }
    return x < BOUNDS.xMin || x > BOUNDS.xMax;
  }

  // ---------- mreža i polja toka ----------
  buildGrid() {
    this.grid = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const x = GX0 + (i + 0.5) * CELL;
        const z = GZ0 + (j + 0.5) * CELL;
        let b = this.blocked(x, z, 0.4);
        if (z > 15) b = !DOORS.some((d) => Math.abs(x - d) < 1.2) || b;
        this.grid[j * GW + i] = b ? 1 : 0;
      }
    }
  }

  cellOf(x, z) {
    const i = Math.max(0, Math.min(GW - 1, Math.floor((x - GX0) / CELL)));
    const j = Math.max(0, Math.min(GH - 1, Math.floor((z - GZ0) / CELL)));
    return [i, j];
  }

  gateCellBlocked(i, j) {
    // zatvorena rampa blokira ćelije u otvoru
    const x = GX0 + (i + 0.5) * CELL;
    const z = GZ0 + (j + 0.5) * CELL;
    if (z > WALL_Z + 0.6) return false;
    for (let g = 0; g < GATES.length; g++) {
      if (this.barriers[g].closed && Math.abs(x - GATES[g].x) < GATE_HALF + 0.3) return true;
    }
    return false;
  }

  // Dijkstra od ciljnih tačaka; ključ keširanja uključuje stanje rampi
  field(key, targets) {
    const stateKey = key + '|' + this.barriers.map((b) => (b.closed ? 1 : 0)).join('');
    if (this.fields.has(stateKey)) return this.fields.get(stateKey);
    if (this.fields.size > 300) this.fields.clear();
    const dist = new Float32Array(GW * GH).fill(Infinity);
    const open = [];
    for (const t of targets) {
      const [i, j] = this.cellOf(t.x, t.z);
      const k = j * GW + i;
      if (this.gateCellBlocked(i, j)) continue;
      dist[k] = 0;
      open.push(k);
    }
    // jednostavan binarni hip
    const heap = [];
    const push = (k) => {
      heap.push(k);
      let n = heap.length - 1;
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (dist[heap[p]] <= dist[heap[n]]) break;
        [heap[p], heap[n]] = [heap[n], heap[p]];
        n = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let n = 0;
        for (;;) {
          const l = n * 2 + 1, r = l + 1;
          let m = n;
          if (l < heap.length && dist[heap[l]] < dist[heap[m]]) m = l;
          if (r < heap.length && dist[heap[r]] < dist[heap[m]]) m = r;
          if (m === n) break;
          [heap[m], heap[n]] = [heap[n], heap[m]];
          n = m;
        }
      }
      return top;
    };
    open.forEach(push);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const k = pop();
      const i = k % GW, j = (k / GW) | 0;
      for (const [di, dj, c] of dirs) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        const nk = nj * GW + ni;
        if (this.grid[nk] || this.gateCellBlocked(ni, nj)) continue;
        if (di && dj && (this.grid[j * GW + ni] || this.grid[nj * GW + i])) continue;
        const nd = dist[k] + c;
        if (nd < dist[nk]) { dist[nk] = nd; push(nk); }
      }
    }
    this.fields.set(stateKey, dist);
    return dist;
  }

  gateTargets(indices) {
    const pts = [];
    for (const gi of indices) {
      for (let dx = -1; dx <= 1; dx += 0.5) pts.push({ x: GATES[gi].x + dx, z: -10 });
    }
    return pts;
  }

  // vraća pravac (x,z) niz polje i preostalu udaljenost
  flowDir(dist, x, z) {
    const [i, j] = this.cellOf(x, z);
    const here = dist[j * GW + i];
    let best = here, bi = i, bj = j;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        if (di && dj && (this.grid[j * GW + ni] || this.grid[nj * GW + i])) continue;
        const d = dist[nj * GW + ni];
        if (d < best) { best = d; bi = ni; bj = nj; }
      }
    }
    if (best === here) return { x: 0, z: 0, d: here * CELL };
    const tx = GX0 + (bi + 0.5) * CELL, tz = GZ0 + (bj + 0.5) * CELL;
    const dx = tx - x, dz = tz - z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l, d: best * CELL };
  }

  randomFreePoint(rng = Math.random) {
    for (let k = 0; k < 200; k++) {
      const x = -16 + rng() * 32;
      const z = -6 + rng() * 19;
      if (!this.blocked(x, z, 0.8)) return { x, z };
    }
    return { x: 0, z: 1 };
  }
}
