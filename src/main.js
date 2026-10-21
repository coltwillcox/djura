import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/press-start-2p/latin-ext-400.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-ext-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/pixelify-sans/latin-ext-700.css';
import './style.css';
import * as THREE from 'three';
import { RetroRenderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { World, GATES } from './world.js';
import { Player, Civilian, Criminal, Boss } from './entities.js';
import { LEVELS, BOSSES, LINES, DESTINATIONS, ENDING, KUM_NAMES, fill, pick } from './levels.js';
import { C } from './palette.js';
import { mat, makeBurek, makeWhistle, makeMoney, blobShadow } from './models.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privatni prozor */ } },
};

const particleGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const ringGeo = new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2);

class Game {
  constructor() {
    this.renderer = new RetroRenderer(document.getElementById('view'));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C.sky);
    this.camera = new THREE.PerspectiveCamera(42, 320 / 224, 0.5, 200);
    this.renderer.onResize = (a) => { this.camera.aspect = a; this.camera.updateProjectionMatrix(); };
    this.renderer.resize();
    this.camTarget = new THREE.Vector3(0, 0, 3);
    this.shake = 0;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 12, 8);
    this.scene.add(sun);

    this.world = new World(this.scene);
    this.player = new Player();
    this.player.height = 2.4;
    this.input = new Input();
    this.audio = new Audio();
    this.ui = new UI();
    this.ui.onType = () => this.audio.sfx('blip');

    this.npcs = [];
    this.particles = [];
    this.projectiles = [];
    this.pickups = [];
    this.time = 0;
    this.score = 0;
    this.highscore = store.get('djura-hi', 0);
    this.unlocked = store.get('djura-unlocked', 0);
    this.menuSel = 0;
    this.kum = pick(KUM_NAMES);

    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    document.getElementById('dialog').addEventListener('pointerdown', () => this.ui.advanceDialog());
    document.getElementById('screen').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) this.menuAction(b.dataset.act);
    });

    this.titleScreen();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ================= EKRANI =================
  titleScreen() {
    this.state = 'title';
    this.clearLevel();
    this.world.clearBossMode();
    this.cfg = { civilians: 14 };
    for (let i = 0; i < 12; i++) this.spawnCivilian(true);
    this.ui.showHud(false);
    this.audio.playMusic('title');
    const items = [['new', 'NOVA IGRA']];
    if (this.unlocked > 0) items.push(['continue', `NASTAVI (NIVO ${this.unlocked + 1})`]);
    items.push(['controls', 'KONTROLE'], ['mute', this.audio.muted ? 'ZVUK: ISKLJUČEN' : 'ZVUK: UKLJUČEN']);
    this.menu(items, `
      <div class="logo">
        <div class="l1"><span class="dj" aria-label="Đ">D</span>URO,</div>
        <div class="l2">BLOKIRAJ</div>
        <div class="l3">AERODROM!</div>
      </div>`, `
      <div class="hi">REKORD ${String(this.highscore).padStart(6, '0')}</div>
      <div class="credits">Po motivima filma „Balkanski špijun“ (1984)</div>`, 'title');
  }

  menu(items, head = '', foot = '', cls = '') {
    this.menuItems = items;
    this.menuSel = Math.min(this.menuSel, items.length - 1);
    this.menuHead = head; this.menuFoot = foot; this.menuCls = cls;
    this.renderMenu();
  }

  renderMenu() {
    const btns = this.menuItems.map(([act, label], i) =>
      `<button data-act="${act}" class="${i === this.menuSel ? 'sel' : ''}">${i === this.menuSel ? '▶ ' : ''}${label}</button>`).join('');
    this.ui.screen(`${this.menuHead}<div class="menu">${btns}</div>${this.menuFoot}`, this.menuCls);
  }

  menuInput() {
    if (!this.menuItems) return;
    const n = this.menuItems.length;
    if (this.input.hit('up')) { this.menuSel = (this.menuSel + n - 1) % n; this.audio.sfx('blip'); this.renderMenu(); }
    if (this.input.hit('down')) { this.menuSel = (this.menuSel + 1) % n; this.audio.sfx('blip'); this.renderMenu(); }
    if (this.input.hit('confirm') || this.input.hit('arrest')) this.menuAction(this.menuItems[this.menuSel][0]);
  }

  menuAction(act) {
    this.audio.unlock();
    this.audio.sfx('blip');
    this.menuItems = null;
    this.menuSel = 0;
    switch (act) {
      case 'new': this.score = 0; this.kum = pick(KUM_NAMES); this.startLevel(0); break;
      case 'continue': this.score = 0; this.kum = pick(KUM_NAMES); this.startLevel(this.unlocked); break;
      case 'controls': this.controlsScreen(); break;
      case 'mute': this.audio.toggleMute(); this.titleScreen(); break;
      case 'title': this.titleScreen(); break;
      case 'retry': this.score = this.levelStartScore; this.startLevel(this.levelIdx); break;
      case 'next':
        if (this.levelIdx + 1 >= LEVELS.length) this.endingScreen();
        else this.startLevel(this.levelIdx + 1);
        break;
      case 'resume': this.ui.hideScreen(); this.state = 'play'; break;
    }
  }

  controlsScreen() {
    this.state = 'menu';
    this.menu([['title', 'NAZAD']], `
      <h2>KONTROLE</h2>
      <table class="keys">
        <tr><td>WASD / STRELICE</td><td>Kretanje</td></tr>
        <tr><td>SHIFT</td><td>Trčanje</td></tr>
        <tr><td>SPACE / J</td><td>Hapšenje</td></tr>
        <tr><td>E / K</td><td>Pištaljka</td></tr>
        <tr><td>P / ESC</td><td>Pauza</td></tr>
        <tr><td>M</td><td>Zvuk</td></tr>
      </table>
      <div class="tips">
        <p><b class="red">Kriminalci</b> beže ka izlazima A, B i C. Uhvati ih pre ukrcavanja!</p>
        <p><b class="yel">Putnike</b> ne diraj — tri žalbe građana i letiš iz službe.</p>
        <p><b class="cya">Bos</b> se ne da uhapsiti dok je aerodrom otvoren. Stani na prekidače i spusti sve rampe!</p>
        <p><b class="gold">Burek</b> daje brzinu. <b class="gray">Pištaljka</b> sve zamrzne.</p>
      </div>`, '', 'controls');
  }

  endingScreen() {
    this.state = 'ending';
    this.ui.showHud(false);
    this.saveHigh();
    this.audio.playMusic('title');
    this.menu([['title', 'GLAVNI MENI']], `
      <h1 class="gold">ČESTITAMO!</h1>
      <div class="ending">${ENDING.map((l, i) => `<p style="animation-delay:${i * 0.8}s">${fill(l, this)}</p>`).join('')}</div>
      <div class="big">POENI ${String(this.score).padStart(6, '0')}</div>
      <div class="hi">REKORD ${String(this.highscore).padStart(6, '0')}</div>`, '', 'ending');
  }

  saveHigh() {
    if (this.score > this.highscore) {
      this.highscore = this.score;
      store.set('djura-hi', this.score);
    }
  }

  // ================= NIVO =================
  clearLevel() {
    for (const n of this.npcs) this.scene.remove(n.root);
    for (const p of this.particles) this.scene.remove(p.mesh);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.npcs = []; this.particles = []; this.projectiles = []; this.pickups = [];
    this.boss = null;
    this.scene.remove(this.player.root);
    this.ui.clearWorldText();
  }

  startLevel(idx) {
    this.clearLevel();
    this.levelIdx = idx;
    this.levelStartScore = this.score;
    const L = { ...LEVELS[idx] };
    L.name = fill(L.name, this);
    L.briefing = L.briefing.map((t) => fill(t, this));
    this.cfg = L;
    this.bossDef = L.boss ? { ...BOSSES[L.boss], name: fill(BOSSES[L.boss].name, this) } : null;
    this.stats = {
      arrests: 0, escapes: 0, complaints: 0, spawned: 0,
      total: this.bossDef ? this.bossDef.minions : L.criminals,
    };
    this.spawnT = 1.5;
    this.civT = 0;
    this.burekT = 10;
    this.whistleT = 22;
    this.combo = 0;
    this.comboT = 0;
    this.endT = 0;
    this.bossT = 2.0;

    if (this.bossDef) this.world.setupBossMode(this.bossDef.switches);
    else this.world.clearBossMode();

    this.player.reset();
    this.scene.add(this.player.root);
    this.player.sync(0, 0);
    this.camTarget.set(0, 0, 3);
    for (let i = 0; i < L.civilians; i++) this.spawnCivilian(true);

    this.ui.hideScreen();
    this.ui.showHud(true);
    this.updateHud();
    this.state = 'briefing';
    this.audio.playMusic('title');
    this.ui.dialog('NAČELNIK (RADIO)', L.briefing).then(() => {
      this.state = 'play';
      this.ui.banner(`NIVO ${idx + 1}`, L.name, 2.2);
      this.audio.playMusic(this.bossDef ? 'boss' : 'game');
    });
  }

  spawnCivilian(scatter = false) {
    const c = new Civilian(this.world);
    if (scatter) c.scatter(this.world);
    this.npcs.push(c);
    this.scene.add(c.root);
    c.sync(0, 0);
    return c;
  }

  spawnCriminal(type) {
    const c = new Criminal(this.world, type, this.cfg.speed ?? 1);
    c.height = c.type === 'debeli' ? 2.6 : 2.3;
    this.npcs.push(c);
    this.scene.add(c.root);
    this.stats.spawned++;
    if (!c.hidden) this.ui.feed(`${c.name} ulazi u terminal!`, 'warn');
    return c;
  }

  pickType() {
    const entries = Object.entries(this.cfg.types);
    const sum = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * sum;
    for (const [t, w] of entries) { r -= w; if (r <= 0) return t; }
    return entries[0][0];
  }

  // ================= PETLJA =================
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    const inp = this.input;
    if (inp.hit('mute')) {
      const m = this.audio.toggleMute();
      this.ui.feed(m ? 'Zvuk isključen' : 'Zvuk uključen');
    }

    switch (this.state) {
      case 'title':
      case 'menu':
      case 'ending':
      case 'levelEnd':
      case 'gameover':
        this.menuInput();
        this.ambient(dt);
        break;
      case 'briefing':
        if (inp.hit('confirm') || inp.hit('arrest')) this.ui.advanceDialog();
        this.ambient(dt);
        break;
      case 'paused':
        this.menuInput();
        if (inp.hit('pause')) this.menuAction('resume');
        break;
      case 'play':
        if (inp.hit('pause')) {
          this.state = 'paused';
          this.menu([['resume', 'NASTAVI'], ['retry', 'PONOVI NIVO'], ['title', 'GLAVNI MENI']], '<h1>PAUZA</h1><p class="sub">Đura pije kafu...</p>', '', 'pause');
          break;
        }
        this.play(dt);
        break;
    }

    this.updateCamera(dt);
    this.world.updatePlanes(dt);
    this.world.updateBarriers(dt);
    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera, dt);
    const tracked = this.state === 'play' ? this.npcs.filter((n) => (n.kind === 'crim' && !n.hidden && !n.arrested) || (n.kind === 'boss' && !n.arrested)) : [];
    this.ui.update(dt, this.camera, this.renderer.canvas, tracked);
  }

  ambient(dt) {
    // putnici šetaju i dok traje meni ili brifing
    const ctx = this.ctx();
    for (const n of this.npcs) {
      if (n.kind !== 'civ') { n.sync(dt, this.time); continue; }
      n.update(dt, ctx);
      n.sync(dt, this.time);
    }
    this.cleanup();
    this.civT -= dt;
    const civs = this.npcs.filter((n) => n.kind === 'civ').length;
    if (civs < (this.cfg?.civilians ?? 10) && this.civT <= 0) { this.spawnCivilian(); this.civT = 1.2; }
  }

  ctx() {
    if (this._ctx) return this._ctx;
    this._ctx = {
      world: this.world,
      player: this.player,
      say: (n, t, cls) => this.ui.say(n, t, cls),
      emitDollar: (p) => this.emitDollar(p),
      reveal: (c) => {
        this.ui.say(c, 'Provaljen sam!', 'crim');
        this.ui.feed(`Maskirani ${c.name} je provaljen!`, 'warn');
        c.height = 2.3;
      },
      spooked: (c) => { if (Math.random() < 0.3) this.ui.say(c, pick(LINES.spooked), 'crim', 1.2); },
      escaped: (c) => this.criminalEscaped(c),
      bossPanic: (b) => {
        this.ui.banner('AERODROM BLOKIRAN!', 'Sad ga hapsi, Đuro!', 2.5);
        this.ui.say(b, b.def.lines.panic, 'boss');
        this.audio.sfx('alarm');
      },
      bossThrow: (b) => this.bossThrow(b),
      bossEscaped: (b) => this.bossEscaped(b),
    };
    return this._ctx;
  }

  play(dt) {
    const p = this.player;
    const ctx = this.ctx();
    const inp = this.input;

    p.update(dt, inp, this.world);
    if (inp.hit('arrest') && p.cooldown <= 0 && p.stun <= 0) this.tryArrest();
    if (inp.hit('whistle') && p.stun <= 0) this.useWhistle();

    // kombo ističe
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    this.spawning(dt);

    for (const n of this.npcs) {
      if (n.arrested) {
        n.arrestT -= dt;
        n.steer(0, 0, 0, dt);
        if (n.arrestT <= 0) { n.dead = true; this.poof(n.pos, C.white); }
      } else {
        n.update(dt, ctx);
      }
    }
    this.separate();
    for (const n of this.npcs) n.sync(dt, this.time);
    p.sync(dt, this.time);

    if (this.bossDef) this.updateSwitches(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.cleanup();
    this.checkEnd(dt);
    this.updateHud();
  }

  spawning(dt) {
    const s = this.stats;
    const crims = this.npcs.filter((n) => n.kind === 'crim' && !n.arrested).length;
    this.spawnT -= dt;
    if (this.bossDef) {
      if (!this.boss) {
        this.bossT -= dt;
        if (this.bossT <= 0) {
          const b = new Boss(this.world, this.bossDef, this.cfg.speed ?? 1);
          b.height = 3.0;
          this.boss = b;
          this.npcs.push(b);
          this.scene.add(b.root);
          this.ui.banner(this.bossDef.name.toUpperCase(), 'je ušao u terminal!', 2.2);
          this.ui.say(b, this.bossDef.lines.enter, 'boss', 3);
          this.audio.sfx('alarm');
        }
      }
      if (this.boss && s.spawned < s.total && this.spawnT <= 0) {
        this.spawnT = 7;
        const m = this.spawnCriminal(pick(['sitan', 'trenerka']));
        this.ui.say(m, 'Šefe, čekaj me!', 'crim');
      }
    } else if (s.spawned < s.total && crims < this.cfg.concurrent && this.spawnT <= 0) {
      this.spawnT = this.cfg.interval * (0.75 + Math.random() * 0.5);
      this.spawnCriminal(this.pickType());
    }
    this.civT -= dt;
    const civs = this.npcs.filter((n) => n.kind === 'civ').length;
    if (civs < this.cfg.civilians && this.civT <= 0) { this.spawnCivilian(); this.civT = 1.4; }
  }

  separate() {
    const all = [...this.npcs.filter((n) => !n.dead), this.player];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const r = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        // bos gura sve, ostali dele pola-pola
        const wa = a.kind === 'boss' ? 0.1 : b.kind === 'boss' ? 0.9 : 0.5;
        a.pos.x -= dx * push * wa; a.pos.z -= dz * push * wa;
        b.pos.x += dx * push * (1 - wa); b.pos.z += dz * push * (1 - wa);
      }
    }
  }

  cleanup() {
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      if (this.npcs[i].dead) {
        this.scene.remove(this.npcs[i].root);
        this.npcs.splice(i, 1);
      }
    }
  }

  // ================= AKCIJE =================
  tryArrest() {
    const p = this.player;
    p.cooldown = 0.4;
    p.lunge = 0.1;
    let best = null, bestD = Infinity;
    for (const n of this.npcs) {
      if (n.dead || n.arrested) continue;
      const reach = n.kind === 'boss' ? 2.0 : 1.6;
      const d = p.distTo(n);
      // kriminalci imaju prednost pred putnicima na istoj udaljenosti
      const score = d - (n.kind === 'crim' && !n.hidden ? 0.4 : 0);
      if (d < reach && score < bestD) { bestD = score; best = n; }
    }
    if (!best) { this.audio.sfx('miss'); return; }

    if (best.kind === 'civ') return this.wrongArrest(best);
    if (best.kind === 'boss') return this.hitBoss(best);

    // kriminalac
    if (best.hp > 1) {
      best.hp--;
      best.stun = 0.7;
      this.knock(best, 5);
      this.audio.sfx('bounce');
      this.ui.say(best, pick(LINES.debeliHit), 'crim');
      return;
    }
    this.arrestCriminal(best);
  }

  arrestCriminal(c) {
    c.arrested = true;
    c.arrestT = 0.9;
    c.model.alert.visible = false;
    c.model.armL.rotation.x = c.model.armR.rotation.x = 0.5;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 4;
    const pts = (c.type === 'maskiran' ? 150 : c.type === 'debeli' ? 200 : 100) * this.combo;
    this.score += pts;
    this.stats.arrests++;
    this.audio.sfx('arrest');
    this.audio.sfx('cuffs');
    this.ui.say(this.player, pick(LINES.arrest), 'cop', 1.4);
    setTimeout(() => !c.dead && this.ui.say(c, pick(LINES.crimArrested), 'crim', 1.6), 350);
    this.ui.floatText(c.pos, `+${pts}`, 'pts');
    this.ui.feed(`UHAPŠEN: ${c.name}`, 'good');
    this.poof(c.pos, C.yellow, 8);
  }

  wrongArrest(c) {
    this.stats.complaints++;
    this.score = Math.max(0, this.score - 150);
    this.combo = 0;
    this.comboT = 0;
    c.annoyed = 1.6;
    this.audio.sfx('wrong');
    const line = c.look.kind === 'baka' ? 'Sine, ja sam baba!' : c.look.kind === 'deda' ? 'Ja sam bio u partizanima!' : pick(LINES.civArrested);
    this.ui.say(c, line, 'civ');
    this.ui.floatText(c.pos, '-150', 'neg');
    this.ui.feed(`ŽALBA GRAĐANA! (${this.stats.complaints}/3)`, 'bad');
  }

  hitBoss(b) {
    const p = this.player;
    if (b.state !== 'panic' || b.stun > 0) {
      if (b.stun > 0 && b.state === 'panic') return;
      // ne može dok je aerodrom otvoren
      this.knock(p, 9, b);
      p.stun = 0.8;
      this.audio.sfx('bounce');
      this.ui.say(b, b.def.lines.shove, 'boss');
      this.ui.feed('Ima veze! Prvo BLOKIRAJ AERODROM!', 'warn');
      return;
    }
    b.hp--;
    b.stun = 1.3;
    this.knock(b, 7);
    this.shake = 0.4;
    this.renderer.flash = 0.35;
    this.audio.sfx('bossHit');
    this.poof(b.pos, C.yellow, 10);
    if (b.hp <= 0) {
      b.arrested = true;
      b.arrestT = 2.2;
      b.stun = 99;
      this.score += 2000;
      this.ui.floatText(b.pos, '+2000', 'pts');
      this.ui.say(b, b.def.lines.arrested, 'boss', 3);
      this.ui.banner('UHAPŠEN!', b.def.name, 2.5);
      this.audio.sfx('arrest');
      this.endT = 2.6;
    } else {
      this.score += 300;
      this.ui.floatText(b.pos, '+300', 'pts');
      this.ui.say(b, b.def.lines.hit[(b.def.hp - b.hp - 1) % b.def.lines.hit.length], 'boss');
    }
  }

  knock(target, force, from = this.player) {
    const dx = target.pos.x - from.pos.x, dz = target.pos.z - from.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    target.vel.x = (dx / l) * force;
    target.vel.z = (dz / l) * force;
  }

  useWhistle() {
    const p = this.player;
    if (p.whistles <= 0) { this.ui.feed('Nema pištaljke!', 'bad'); this.audio.sfx('miss'); return; }
    p.whistles--;
    this.audio.sfx('whistle');
    this.ui.say(p, pick(LINES.whistle), 'cop', 1.2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.8 }));
    ring.position.set(p.pos.x, 0.1, p.pos.z);
    this.scene.add(ring);
    this.particles.push({ mesh: ring, life: 0.5, max: 0.5, ring: true });
    for (const n of this.npcs) {
      if (n.dead || n.arrested || p.distTo(n) > 7.5) continue;
      if (n.kind === 'crim') {
        n.stun = 2.6;
        if (n.hidden) { n.hidden = false; this.ctx().reveal(n); }
      } else if (n.kind === 'boss') n.stun = Math.max(n.stun, 1.0);
      else n.stun = 0.8;
    }
  }

  criminalEscaped(c) {
    if (c.dead) return;
    c.dead = true;
    this.stats.escapes++;
    this.combo = 0;
    this.world.takeOff(c.gate);
    this.audio.sfx('escape');
    this.ui.feed(`${c.name} je pobegao ${pick(DESTINATIONS)}!`, 'bad');
    this.ui.banner('POBEGAO!', `${this.stats.escapes}/${this.cfg.maxEscapes}`, 1.4);
  }

  bossThrow(b) {
    const p = this.player;
    const T = Math.min(1.1, Math.max(0.45, b.distTo(p) / 10));
    const tx = p.pos.x + p.vel.x * T * 0.6, tz = p.pos.z + p.vel.z * T * 0.6;
    const m = makeMoney();
    m.position.set(b.pos.x, 2, b.pos.z);
    this.scene.add(m);
    const g = 18;
    this.projectiles.push({
      mesh: m, x: b.pos.x, y: 2, z: b.pos.z,
      vx: (tx - b.pos.x) / T, vz: (tz - b.pos.z) / T, vy: (g * T) / 2 - 2 / T, g,
    });
    this.audio.sfx('throw');
    if (Math.random() < 0.4) this.ui.say(b, pick(['Evo ti pare, pusti me!', 'Mito? Ne, poklon!', 'Uzmi, ima još!']), 'boss', 1.5);
  }

  bossEscaped(b) {
    if (b.dead) return;
    b.dead = true;
    this.world.takeOff(GATES.reduce((bi, g, i) => (Math.abs(g.x - b.pos.x) < Math.abs(GATES[bi].x - b.pos.x) ? i : bi), 0));
    this.audio.sfx('escape');
    this.fail(`${b.def.name} je pobegao!`, b.def.lines.escaped);
  }

  emitDollar(pos) {
    const m = makeMoney();
    m.scale.setScalar(0.6);
    m.position.set(pos.x, 1.2, pos.z);
    this.scene.add(m);
    this.particles.push({ mesh: m, life: 1.2, max: 1.2, vx: 0, vy: 1.2, vz: 0, spin: 4, nograv: true });
  }

  poof(pos, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(particleGeo, mat(color));
      m.position.set(pos.x, 1, pos.z);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.particles.push({ mesh: m, life: 0.6, max: 0.6, vx: Math.cos(a) * s, vy: 3 + Math.random() * 3, vz: Math.sin(a) * s, spin: 8 });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const m = p.mesh;
      if (p.ring) {
        const k = 1 - p.life / p.max;
        m.scale.setScalar(1 + k * 7);
        m.material.opacity = 0.8 * (1 - k);
      } else {
        if (!p.nograv) p.vy -= 15 * dt;
        m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
        m.rotation.y += p.spin * dt; m.rotation.x += p.spin * 0.5 * dt;
        m.scale.setScalar((p.nograv ? 0.6 : 1) * Math.min(1, p.life / p.max * 2));
      }
      if (p.life <= 0) {
        this.scene.remove(m);
        if (p.ring) m.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  updateProjectiles(dt) {
    const pl = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y += dt * 10;
      p.mesh.rotation.x += dt * 7;
      const hit = p.y < 1.8 && Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z) < 0.75 && pl.stun <= 0;
      if (hit) {
        pl.stun = 1.3;
        this.audio.sfx('stun');
        this.ui.say(pl, pick(['Jedan, dva, tri... hiljadu...', 'Ne primam mito! ...ali da prebrojim.', 'Pare?! Stani malo...']), 'cop', 1.4);
        this.poof({ x: p.x, z: p.z }, C.money, 8);
      }
      if (hit || p.y < 0.1) {
        if (!hit) this.poof({ x: p.x, z: p.z }, C.money, 4);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updatePickups(dt) {
    const pl = this.player;
    this.burekT -= dt;
    this.whistleT -= dt;
    const spawn = (kind) => {
      const pos = this.world.randomFreePoint();
      const g = new THREE.Group();
      const item = kind === 'burek' ? makeBurek() : makeWhistle();
      item.position.y = 0.6;
      g.add(item);
      g.add(blobShadow(0.8));
      g.position.set(pos.x, 0, pos.z);
      this.scene.add(g);
      this.pickups.push({ kind, mesh: g, item, pos, life: 14 });
    };
    if (this.burekT <= 0) { this.burekT = 16 + Math.random() * 8; if (!this.pickups.some((p) => p.kind === 'burek')) spawn('burek'); }
    if (this.whistleT <= 0) { this.whistleT = 26 + Math.random() * 10; if (pl.whistles < 3) spawn('whistle'); }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      p.item.rotation.y += dt * 3;
      p.item.position.y = 0.6 + Math.sin(this.time * 4) * 0.12;
      p.mesh.visible = p.life > 3 || Math.floor(p.life * 8) % 2 === 0;
      const got = Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) < 1.0;
      if (got) {
        this.audio.sfx('pickup');
        if (p.kind === 'burek') {
          pl.boost = 7;
          pl.stamina = 1;
          this.ui.say(pl, pick(LINES.burek), 'cop', 1.5);
          this.ui.feed('BUREK! Đura je brži 7 sekundi.', 'good');
        } else {
          pl.whistles++;
          this.ui.feed('Nova pištaljka! (taster E)', 'good');
        }
        this.score += 50;
        this.ui.floatText(p.pos, '+50', 'pts');
      }
      if (got || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  updateSwitches(dt) {
    const pl = this.player;
    const reopen = this.bossDef.reopen;
    for (const sw of this.world.switches) {
      const on = Math.hypot(sw.x - pl.pos.x, sw.z - pl.pos.z) < 1.0;
      const b = this.world.barriers[sw.gate];
      if (on && !sw.used) {
        sw.hold += dt;
        sw.btn.position.y = 0.86 - Math.min(1, sw.hold / 0.5) * 0.08;
        if (sw.hold >= 0.5) {
          sw.used = true;
          const was = b.closed;
          b.closed = true;
          b.timer = reopen;
          this.audio.sfx('gate');
          this.shake = 0.15;
          const id = GATES[sw.gate].id;
          if (!was) {
            this.ui.feed(`Rampa ${id} spuštena!`, 'good');
            this.ui.say(pl, pick([`Izlaz ${id} zatvoren!`, 'Nema prolaza!', 'Blokirano!']), 'cop', 1.2);
          } else this.ui.feed(`Rampa ${id} produžena!`, 'good');
          this.score += was ? 0 : 100;
        }
      } else if (!on) {
        sw.hold = 0;
        sw.used = false;
        sw.btn.position.y = 0.86;
      }
      if (b.closed) {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.closed = false;
          this.audio.sfx('gateOpen');
          this.ui.feed(`Sindikat je podigao rampu ${GATES[sw.gate].id}!`, 'bad');
        }
      }
      sw.pad.material = mat(b.closed ? C.green : C.yellow);
    }
  }

  // ================= KRAJ NIVOA =================
  checkEnd(dt) {
    const s = this.stats;
    if (s.escapes >= this.cfg.maxEscapes) return this.fail('Previše ih je pobeglo!', 'Načelnik: "Đuro, pa gde si ti bio?!"');
    if (s.complaints >= 3) return this.fail('Suspendovan si!', 'Tri žalbe građana. Načelnik: "Idi kući, Đuro."');
    if (this.bossDef) {
      if (this.endT > 0) { this.endT -= dt; if (this.endT <= 0) this.levelComplete(); }
      return;
    }
    const alive = this.npcs.some((n) => n.kind === 'crim');
    if (s.spawned >= s.total && !alive) this.levelComplete();
  }

  levelComplete() {
    this.state = 'levelEnd';
    const s = this.stats;
    const bonusClean = s.escapes === 0 ? 500 : 0;
    const bonusPolite = s.complaints === 0 ? 300 : 0;
    this.score += bonusClean + bonusPolite;
    this.saveHigh();
    this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length - 1, this.levelIdx + 1));
    store.set('djura-unlocked', this.unlocked);
    this.audio.stopMusic();
    this.audio.sfx('win');
    this.ui.showHud(false);
    const last = this.levelIdx + 1 >= LEVELS.length;
    this.menu([['next', last ? 'KRAJ IGRE' : 'SLEDEĆI NIVO'], ['title', 'GLAVNI MENI']], `
      <h1 class="gold">NIVO ZAVRŠEN!</h1>
      <p class="sub">${this.cfg.name}</p>
      <table class="stats">
        <tr><td>Uhapšeno</td><td>${this.bossDef ? this.bossDef.name : s.arrests}</td></tr>
        <tr><td>Pobeglo</td><td>${s.escapes}</td></tr>
        <tr><td>Žalbe građana</td><td>${s.complaints}</td></tr>
        <tr><td>Bonus "Niko nije pobegao"</td><td>${bonusClean}</td></tr>
        <tr><td>Bonus "Kulturan policajac"</td><td>${bonusPolite}</td></tr>
        <tr class="tot"><td>POENI</td><td>${this.score}</td></tr>
      </table>`, '', 'result');
  }

  fail(title, sub) {
    if (this.state !== 'play') return;
    this.state = 'gameover';
    this.saveHigh();
    this.audio.stopMusic();
    this.audio.sfx('lose');
    this.ui.showHud(false);
    this.menu([['retry', 'POKUŠAJ PONOVO'], ['title', 'GLAVNI MENI']], `
      <h1 class="red">${title}</h1>
      <p class="sub">${sub}</p>
      <div class="big">POENI ${String(this.score).padStart(6, '0')}</div>`, '', 'fail');
  }

  updateHud() {
    const s = this.stats;
    const p = this.player;
    let boss = null;
    if (this.bossDef) {
      const gates = this.world.barriers.map((b, i) => `${GATES[i].id}:${b.closed ? Math.ceil(b.timer) : '--'}`).join(' ');
      const b = this.boss;
      boss = {
        name: this.bossDef.name.toUpperCase(),
        hp: b ? Math.max(0, b.hp) : this.bossDef.hp,
        max: this.bossDef.hp,
        state: `RAMPE ${gates}`,
      };
    }
    this.ui.setHud({
      level: `NIVO ${this.levelIdx + 1}`,
      score: this.score,
      arrests: s.total ? `${s.arrests}/${s.total}` : '-',
      escapes: `${s.escapes}/${this.cfg.maxEscapes}`,
      complaints: `${s.complaints}/3`,
      stamina: p.stamina,
      whistles: p.whistles,
      boost: p.boost,
      combo: this.combo,
      boss,
    });
  }

  // ================= KAMERA =================
  updateCamera(dt) {
    const cam = this.camera;
    if (this.state === 'title' || this.state === 'menu' || this.state === 'ending') {
      const a = this.time * 0.08;
      cam.position.set(Math.sin(a) * 20, 15, 4 + Math.cos(a) * 16);
      cam.lookAt(0, 0, -1);
      return;
    }
    const p = this.player.pos;
    const tx = Math.max(-9, Math.min(9, p.x));
    const tz = Math.max(-5.5, Math.min(9, p.z));
    const k = Math.min(1, dt * 5);
    this.camTarget.x += (tx - this.camTarget.x) * k;
    this.camTarget.z += (tz - this.camTarget.z) * k;
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake -= dt;
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
    }
    cam.position.set(this.camTarget.x + sx, 13 + sy, this.camTarget.z + 9.5);
    cam.lookAt(this.camTarget.x + sx, 0, this.camTarget.z - 1.5);
  }
}

Promise.all([
  document.fonts.load('8px "Press Start 2P"', 'Đ'),
  document.fonts.load('10px "Pixelify Sans"', 'ČĆŠŽĐ'),
  document.fonts.load('bold 10px "Pixelify Sans"', 'ČĆŠŽĐ'),
]).catch(() => {}).finally(() => {
  window.game = new Game();
});
