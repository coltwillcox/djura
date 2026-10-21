import { C } from './palette.js';
import { makeCharacter } from './models.js';
import { DOORS, ESCAPE_Z, GATES } from './world.js';
import { CRIMINAL_NAMES, pick } from './levels.js';

const rand = (a, b) => a + Math.random() * (b - a);

class Actor {
  constructor(look) {
    this.model = makeCharacter(look);
    this.root = this.model.root;
    this.pos = { x: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.radius = 0.38 * (look.scale ?? 1);
    this.speedNow = 0;
    this.dead = false;
    this.stun = 0;
  }

  steer(dx, dz, speed, dt, accel = 10) {
    const k = Math.min(1, dt * accel);
    this.vel.x += (dx * speed - this.vel.x) * k;
    this.vel.z += (dz * speed - this.vel.z) * k;
  }

  integrate(dt, world) {
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    world.collide(this.pos, this.radius);
  }

  sync(dt, t) {
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    if (this.speedNow > 0.2) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * 12);
    }
    this.root.position.set(this.pos.x, 0, this.pos.z);
    this.model.stars.visible = this.stun > 0;
    this.model.animate(dt, this.stun > 0 ? 0 : this.speedNow, t);
  }

  distTo(o) {
    return Math.hypot(this.pos.x - o.pos.x, this.pos.z - o.pos.z);
  }
}

// ---------------- ĐURA ----------------
export class Player extends Actor {
  constructor() {
    super({
      shirt: C.policeL, pants: C.police, hat: 'police', mustache: true, badge: true,
      sleeves: C.policeL, hair: C.hair,
    });
    this.reset();
  }

  reset() {
    this.pos = { x: 0, z: 1.8 };
    this.vel = { x: 0, z: 0 };
    this.stamina = 1;
    this.boost = 0;
    this.stun = 0;
    this.whistles = 1;
    this.cooldown = 0;
    this.lunge = 0;
    this.root.rotation.set(0, Math.PI, 0);
  }

  update(dt, input, world) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.boost = Math.max(0, this.boost - dt);
    if (this.stun > 0) {
      this.stun -= dt;
      this.steer(0, 0, 0, dt, 4);
    } else {
      const m = input.move();
      const moving = Math.hypot(m.x, m.y) > 0.1;
      const sprinting = input.down('sprint') && moving && this.stamina > 0.02;
      if (sprinting) this.stamina = Math.max(0, this.stamina - dt * 0.4);
      else this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.18 : 0.3));
      let speed = sprinting ? 7.2 : 4.6;
      if (this.boost > 0) speed *= 1.35;
      this.steer(m.x, m.y, speed, dt, 14);
    }
    if (this.lunge > 0) {
      this.lunge -= dt;
      const f = this.root.rotation.y;
      this.vel.x += Math.sin(f) * 30 * dt;
      this.vel.z += Math.cos(f) * 30 * dt;
    }
    this.integrate(dt, world);
    // Đura ne sme na pistu (nema pasoš), ali može da stane u sam izlaz
    if (this.pos.z < -9.0) this.pos.z = -9.0;
    if (this.pos.z > 13.8) this.pos.z = 13.8;
  }
}

// ---------------- PUTNICI ----------------
const CIV_LOOKS = [
  () => ({ shirt: C.purple, pants: C.purple, skin: C.skin, hat: 'scarf', hatColor: pick([C.red, C.purple, C.green]), hair: null, carry: 'bag', carryColor: C.brown, kind: 'baka' }),
  () => ({ shirt: pick([C.yellow, C.cyan, C.pink, C.orange]), pants: C.white, hat: 'cap', hatColor: pick([C.red, C.blue, C.white]), glasses: Math.random() < 0.5, carry: 'suitcase', carryColor: pick([C.red, C.blue, C.green]) }),
  () => ({ shirt: C.white, pants: C.grayD, tie: pick([C.red, C.blue]), carry: 'suitcase', carryColor: C.black, hair: pick([C.hair, C.gray]) }),
  () => ({ shirt: pick([C.pink, C.red, C.green]), pants: C.blue, hair: pick([C.yellow, C.hair, C.orange]), carry: 'bag', carryColor: pick([C.pink, C.white]) }),
  () => ({ shirt: C.greenD, pants: C.brown, mustache: C.white, hair: C.white, hat: 'beret', hatColor: C.grayD, carry: 'suitcase', carryColor: C.brown, kind: 'deda' }),
  () => ({ shirt: pick([C.blue, C.cyan, C.red]), pants: C.grayD, hair: pick([C.hair, C.black]), hat: Math.random() < 0.4 ? 'beanie' : undefined, hatColor: pick([C.black, C.red]) }),
];

export function civilianLook() {
  return pick(CIV_LOOKS)();
}

export class Civilian extends Actor {
  constructor(world, look = civilianLook()) {
    super(look);
    this.kind = 'civ';
    this.look = look;
    this.baseSpeed = rand(1.4, 2.0) * (look.kind === 'baka' ? 0.7 : 1);
    this.spawnAtDoor();
    this.plan = [];
    const nPoi = Math.random() < 0.7 ? 1 + ((Math.random() * 2) | 0) : 0;
    for (let i = 0; i < nPoi; i++) this.plan.push({ poi: pick(world.pois) });
    this.plan.push({ gate: (Math.random() * GATES.length) | 0 });
    this.wait = 0;
    this.annoyed = 0;
  }

  spawnAtDoor(z = 15.6) {
    this.pos = { x: pick(DOORS) + rand(-0.8, 0.8), z };
  }

  // za početak nivoa — rasporedi putnike po hali
  scatter(world) {
    const p = world.randomFreePoint();
    this.pos = { x: p.x, z: p.z };
  }

  update(dt, ctx) {
    const { world } = ctx;
    if (this.stun > 0) {
      this.stun -= dt;
      this.steer(0, 0, 0, dt);
      this.integrate(dt, world);
      return;
    }
    if (this.annoyed > 0) {
      this.annoyed -= dt;
      this.steer(0, 0, 0, dt);
      this.integrate(dt, world);
      return;
    }
    const step = this.plan[0];
    if (!step) { this.dead = true; return; }
    if (this.wait > 0) {
      this.wait -= dt;
      this.steer(0, 0, 0, dt);
      if (this.wait <= 0) this.plan.shift();
      this.integrate(dt, world);
      return;
    }
    let dist;
    if (step.gate !== undefined) {
      const open = world.barriers[step.gate].closed ? world.openGates() : [step.gate];
      if (!open.length) {
        // sve zatvoreno — šetkaj i čekaj
        this.plan.unshift({ poi: pick(world.pois) });
        return;
      }
      dist = world.field('gate' + open.join(''), world.gateTargets(open));
    } else {
      dist = world.field('poi' + step.poi.x + ',' + step.poi.z, [step.poi]);
    }
    const f = world.flowDir(dist, this.pos.x, this.pos.z);
    if (step.poi && f.d < 1.2) {
      this.wait = rand(1.5, 4);
    }
    this.steer(f.x, f.z, this.baseSpeed, dt, 6);
    this.integrate(dt, world);
    if (this.pos.z < ESCAPE_Z) this.dead = true; // ukrcao se
  }
}

// ---------------- KRIMINALCI ----------------
const CRIM_LOOKS = {
  sitan: () => ({ shirt: C.white, stripes: C.black, pants: C.grayD, mask: true, hat: 'beanie', hatColor: C.black, carry: 'moneybag' }),
  trenerka: () => ({ shirt: pick([C.blue, C.redD, C.black, C.purple]), pants: C.black, tracksuit: true, hair: null, hairBack: false, glasses: true, carry: 'bag', carryColor: C.black }),
  debeli: () => ({ shirt: C.orange, pants: C.brown, belly: true, mustache: true, glasses: true, hat: 'cap', hatColor: C.white, carry: 'suitcase', carryColor: C.gold, scale: 1.2 }),
};

export class Criminal extends Actor {
  constructor(world, type, speedMul = 1) {
    const disguise = type === 'maskiran';
    const look = disguise ? civilianLook() : CRIM_LOOKS[type]();
    super(look);
    this.kind = 'crim';
    this.type = type;
    this.name = pick(CRIMINAL_NAMES);
    this.hidden = disguise;
    this.hp = type === 'debeli' ? 2 : 1;
    this.base = { sitan: 2.3, trenerka: 2.6, maskiran: 2.1, debeli: 1.8 }[type] * speedMul;
    this.spookMul = { sitan: 1.5, trenerka: 1.75, maskiran: 1.6, debeli: 1.15 }[type];
    this.spookR = type === 'debeli' ? 3 : 4.5;
    this.spooked = false;
    this.gate = (Math.random() * GATES.length) | 0;
    this.pos = { x: pick(DOORS) + rand(-0.8, 0.8), z: 15.6 };
    this.dollarT = rand(0.5, 1.5);
    this.dodgeSide = Math.random() < 0.5 ? -1 : 1;
    this.wanderT = rand(0, 3);
  }

  update(dt, ctx) {
    const { world, player } = ctx;
    if (this.stun > 0) {
      this.stun -= dt;
      this.model.alert.visible = false;
      this.steer(0, 0, 0, dt);
      this.integrate(dt, world);
      return;
    }
    const dP = this.distTo(player);
    if (this.hidden) {
      this.dollarT -= dt;
      if (this.dollarT <= 0) {
        this.dollarT = rand(1.0, 1.8);
        ctx.emitDollar(this.pos);
      }
      if (dP < 2.2) {
        this.hidden = false;
        ctx.reveal(this);
      }
    }
    const wasSpooked = this.spooked;
    this.spooked = !this.hidden && dP < this.spookR;
    if (this.spooked && !wasSpooked) ctx.spooked(this);
    this.model.alert.visible = this.spooked;

    let open = world.openGates();
    if (!open.includes(this.gate)) {
      if (open.length) this.gate = pick(open);
    }
    if (!open.length) {
      // sve rampe dole: luta po hali
      this.wanderT -= dt;
      if (this.wanderT <= 0 || !this.wander) { this.wander = world.randomFreePoint(); this.wanderT = rand(2, 4); }
      open = null;
    }
    const dist = open
      ? world.field('gate' + this.gate, world.gateTargets([this.gate]))
      : world.field('w' + Math.round(this.wander.x) + ',' + Math.round(this.wander.z), [this.wander]);
    const f = world.flowDir(dist, this.pos.x, this.pos.z);
    let dx = f.x, dz = f.z;
    let speed = this.base;
    if (this.spooked) {
      speed *= this.spookMul;
      // beži od Đure, ali i dalje ka izlazu
      const ax = this.pos.x - player.pos.x, az = this.pos.z - player.pos.z;
      const al = Math.hypot(ax, az) || 1;
      const w = Math.max(0, 1 - dP / this.spookR) * 0.9;
      dx += (ax / al) * w;
      dz += (az / al) * w * 0.4;
      if (this.type === 'trenerka' && dP < 2.4) {
        dx += -f.z * this.dodgeSide * 0.9;
        dz += f.x * this.dodgeSide * 0.9;
      }
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
    }
    this.steer(dx, dz, speed, dt, 8);
    this.integrate(dt, world);
    if (this.pos.z < ESCAPE_Z) ctx.escaped(this);
  }
}

// ---------------- BOS ----------------
export class Boss extends Actor {
  constructor(world, def, speedMul = 1) {
    super(def.look);
    this.kind = 'boss';
    this.def = def;
    this.name = def.name;
    this.hp = def.hp;
    this.speedMul = speedMul;
    this.pos = { x: 0, z: 15.6 };
    this.errands = def.errands.map((n) => world.pois.find((p) => p.name === n));
    this.state = 'errand';
    this.wait = 0;
    this.throwT = def.throwEvery;
    this.gate = 1;
    this.panicTarget = null;
    this.panicT = 0;
  }

  update(dt, ctx) {
    const { world, player } = ctx;
    if (this.stun > 0) {
      this.stun -= dt;
      this.steer(0, 0, 0, dt, 5);
      this.integrate(dt, world);
      return;
    }
    const open = world.openGates();
    let dist = null;
    let speed = this.def.speed * this.speedMul;

    if (!open.length) {
      if (this.state !== 'panic') { this.state = 'panic'; ctx.bossPanic(this); }
    } else if (this.state === 'panic') {
      this.state = 'escape';
      ctx.say(this, 'Otvoreno! Bežim!');
    }

    if (this.state === 'errand') {
      const e = this.errands[0];
      if (!e) {
        this.state = 'escape';
      } else if (this.wait > 0) {
        this.wait -= dt;
        if (this.wait <= 0) this.errands.shift();
      } else {
        dist = world.field('poi' + e.x + ',' + e.z, [e]);
        const f = world.flowDir(dist, this.pos.x, this.pos.z);
        if (f.d < 1.4) {
          this.wait = 2.2;
          ctx.say(this, e.name === 'trafika' ? 'Kutiju cigara i loto tiket!' : e.name === 'pekara' ? 'Jedan burek, za poneti!' : e.name === 'šalter' ? 'Biznis klasa, naravno.' : 'Hmm, let za Pariz kasni...');
        }
      }
    }

    if (this.state === 'escape') {
      // uvek najbliži otvoreni izlaz
      dist = world.field('gate' + open.join(''), world.gateTargets(open));
      speed *= 1.15;
    }

    if (this.state === 'panic') {
      speed = this.def.panicSpeed * this.speedMul;
      this.panicT -= dt;
      const dP = this.distTo(player);
      if (!this.panicTarget || this.panicT <= 0 || Math.hypot(this.panicTarget.x - this.pos.x, this.panicTarget.z - this.pos.z) < 1.5) {
        // izaberi tačku daleko od Đure
        let best = null, bestD = -1;
        for (let k = 0; k < 8; k++) {
          const p = world.randomFreePoint();
          const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
          if (d > bestD) { bestD = d; best = p; }
        }
        this.panicTarget = best;
        this.panicT = dP < 3 ? 0.8 : 2.5;
      }
      dist = world.field('w' + Math.round(this.panicTarget.x) + ',' + Math.round(this.panicTarget.z), [this.panicTarget]);
    }

    if ((this.state === 'panic' || this.state === 'escape') && player.stun <= 0) {
      this.throwT -= dt * (this.state === 'panic' ? 1 : 0.5);
      if (this.throwT <= 0 && this.distTo(player) < 11) {
        this.throwT = this.def.throwEvery * rand(0.8, 1.2);
        ctx.bossThrow(this);
      }
    }

    if (dist) {
      const f = world.flowDir(dist, this.pos.x, this.pos.z);
      this.steer(f.x, f.z, speed, dt, 7);
    } else {
      this.steer(0, 0, 0, dt, 6);
    }
    this.integrate(dt, world);
    if (this.pos.z < ESCAPE_Z) ctx.bossEscaped(this);
  }
}
