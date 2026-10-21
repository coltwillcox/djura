import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const v = new THREE.Vector3();

// portret načelnika kao pikselni SVG
const PORTRAIT = [
  '....GGGG....',
  '...GGGGGG...',
  '..GSSSSSSG..',
  '..SSSSSSSS..',
  '..SEESSEES..',
  '..SSSSNSSS..',
  '..SMMMMMMS..',
  '..SSSMMSSS..',
  '...SSSSSS...',
  '..BBBYYBBB..',
  '.BBBBYYBBBB.',
  'BBBYBBBBYBBB',
];
const PORTRAIT_COLORS = { G: '#acacac', S: '#ffae74', E: '#000', N: '#ce7434', M: '#575757', B: '#0034ae', Y: '#ffae00' };

function pixelArt(rows, colors) {
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[ch]}"/>`;
  }));
  return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

export class UI {
  constructor() {
    this.hud = $('hud');
    this.bubbleLayer = $('bubbles');
    this.arrowLayer = $('arrows');
    this.bannerEl = $('banner');
    this.feedEl = $('feed');
    this.dialogEl = $('dialog');
    this.screenEl = $('screen');
    this.bubbles = [];
    this.arrows = [];
    this.bannerT = 0;
    this.dialogState = null;
    this.dialogEl.querySelector('.d-portrait').innerHTML = pixelArt(PORTRAIT, PORTRAIT_COLORS);
  }

  // ---------- HUD ----------
  showHud(on) { this.hud.classList.toggle('on', on); }

  setHud(s) {
    $('h-level').textContent = s.level;
    $('h-score').textContent = String(s.score).padStart(6, '0');
    $('h-arrests').textContent = s.arrests;
    $('h-escapes').textContent = s.escapes;
    $('h-complaints').textContent = s.complaints;
    $('h-stamina').style.width = (s.stamina * 100).toFixed(0) + '%';
    $('h-stamina').classList.toggle('low', s.stamina < 0.25);
    $('h-whistles').textContent = s.whistles;
    $('h-boost').classList.toggle('on', s.boost > 0);
    $('h-combo').textContent = s.combo > 1 ? `KOMBO x${s.combo}` : '';
    const bossBox = $('h-boss');
    if (s.boss) {
      bossBox.classList.add('on');
      $('h-boss-name').textContent = s.boss.name;
      $('h-boss-hp').innerHTML = '■'.repeat(s.boss.hp) + '<i>' + '■'.repeat(s.boss.max - s.boss.hp) + '</i>';
      $('h-boss-state').textContent = s.boss.state;
    } else bossBox.classList.remove('on');
  }

  // ---------- natpisi ----------
  banner(text, sub = '', dur = 2) {
    this.bannerEl.innerHTML = `<div class="b-main">${text}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
    this.bannerEl.classList.remove('pop');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('on', 'pop');
    this.bannerT = dur;
  }

  feed(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'feed-item ' + cls;
    el.textContent = text;
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > 4) this.feedEl.lastChild.remove();
    setTimeout(() => el.classList.add('fade'), 3500);
    setTimeout(() => el.remove(), 4200);
  }

  say(target, text, cls = '', dur = 2.2) {
    // jedan oblačić po liku
    const old = this.bubbles.find((b) => b.target === target);
    if (old) { old.el.remove(); this.bubbles.splice(this.bubbles.indexOf(old), 1); }
    const el = document.createElement('div');
    el.className = 'bubble ' + cls;
    el.textContent = text;
    this.bubbleLayer.appendChild(el);
    this.bubbles.push({ target, el, t: dur, h: target.height ?? 2.3 });
  }

  floatText(pos, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'floater ' + cls;
    el.textContent = text;
    this.bubbleLayer.appendChild(el);
    this.bubbles.push({ target: { pos: { ...pos } }, el, t: 1.1, h: 2.0, rise: 0 });
  }

  clearWorldText() {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
    for (const a of this.arrows) a.remove();
    this.arrows = [];
  }

  // pozicioniranje oblačića i strelica ka kriminalcima van ekrana
  update(dt, camera, canvas, tracked) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t -= dt;
      if (b.rise !== undefined) b.rise += dt * 1.5;
      if (b.t <= 0 || b.target.dead) {
        b.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      v.set(b.target.pos.x, b.h + (b.rise ?? 0), b.target.pos.z).project(camera);
      b.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      b.el.style.opacity = b.t < 0.3 ? b.t / 0.3 : 1;
    }

    while (this.arrows.length < tracked.length) {
      const el = document.createElement('div');
      el.className = 'arrow';
      this.arrowLayer.appendChild(el);
      this.arrows.push(el);
    }
    for (let i = 0; i < this.arrows.length; i++) {
      const el = this.arrows[i];
      const t = tracked[i];
      if (!t) { el.style.display = 'none'; continue; }
      v.set(t.pos.x, 1, t.pos.z).project(camera);
      const sx = (v.x + 1) / 2, sy = (1 - v.y) / 2;
      const inside = sx > 0.02 && sx < 0.98 && sy > 0.05 && sy < 0.97 && v.z < 1;
      if (inside) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.className = 'arrow' + (t.kind === 'boss' ? ' boss' : '');
      const cx = sx - 0.5, cy = sy - 0.5;
      const ang = Math.atan2(cy, cx);
      const m = 0.46 / Math.max(Math.abs(cx), Math.abs(cy));
      const px = 0.5 + cx * Math.min(1, m), py = 0.5 + cy * Math.min(1, m);
      el.style.transform = `translate(${Math.min(0.96, Math.max(0.04, px)) * w}px, ${Math.min(0.94, Math.max(0.08, py)) * h}px) translate(-50%, -50%) rotate(${ang}rad)`;
    }

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.bannerEl.classList.remove('on');
    }
    this.tickDialog(dt);
  }

  // ---------- radio dijalog (kucanje slovo po slovo) ----------
  dialog(speaker, lines, portrait = 'nacelnik') {
    return new Promise((resolve) => {
      this.dialogEl.classList.add('on');
      this.dialogEl.querySelector('.d-name').textContent = speaker;
      this.dialogEl.querySelector('.d-portrait').className = 'd-portrait ' + portrait;
      this.dialogState = { lines: [...lines], cur: '', idx: 0, t: 0, resolve };
      this.dialogEl.querySelector('.d-text').textContent = '';
    });
  }

  dialogActive() { return !!this.dialogState; }

  tickDialog(dt) {
    const d = this.dialogState;
    if (!d) return;
    const line = d.lines[0] ?? '';
    d.t += dt;
    const n = Math.min(line.length, Math.floor(d.t * 45));
    if (n !== d.idx) {
      d.idx = n;
      this.dialogEl.querySelector('.d-text').textContent = line.slice(0, n);
      if (n % 3 === 0) this.onType?.();
    }
    this.dialogEl.querySelector('.d-next').style.visibility = n >= line.length ? 'visible' : 'hidden';
  }

  advanceDialog() {
    const d = this.dialogState;
    if (!d) return;
    const line = d.lines[0] ?? '';
    if (d.idx < line.length) { d.t = 999; return; }
    d.lines.shift();
    d.t = 0; d.idx = 0;
    if (!d.lines.length) {
      this.dialogState = null;
      this.dialogEl.classList.remove('on');
      d.resolve();
    }
  }

  // ---------- ekrani ----------
  screen(html, cls = '') {
    this.bannerT = 0;
    this.bannerEl.classList.remove('on');
    this.screenEl.className = 'on ' + cls;
    this.screenEl.innerHTML = html;
  }

  hideScreen() {
    this.screenEl.className = '';
    this.screenEl.innerHTML = '';
  }
}
