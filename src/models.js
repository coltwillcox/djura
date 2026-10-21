import * as THREE from 'three';
import { C } from './palette.js';
import { drawPixelText } from './pixelfont.js';

// Svi modeli su od kutija i valjaka — low-poly, kao da je 1993.
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  }
  return matCache.get(key);
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export function box(w, h, d, color, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

export function cyl(rt, rb, h, color, seg = 8, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

const shadowGeo = new THREE.CircleGeometry(0.45, 10).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
export function blobShadow(scale = 1) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.position.y = 0.02;
  m.scale.setScalar(scale);
  m.renderOrder = -1;
  return m;
}

function limb(w, h, d, color, px, py, parent, tipColor) {
  const pivot = new THREE.Group();
  pivot.position.set(px, py, 0);
  box(w, h, d, color, 0, -h / 2, 0, pivot);
  if (tipColor) box(w * 1.02, 0.12, d * 1.1, tipColor, 0, -h + 0.06, 0.02, pivot);
  parent.add(pivot);
  return pivot;
}

/**
 * Lik od kockica. opts: shirt, pants, skin, hair, hat, mustache, glasses,
 * stripes, carry ('suitcase'|'moneybag'|'bag'), shoes, belly, scale
 */
export function makeCharacter(o = {}) {
  const shirt = o.shirt ?? C.blue;
  const pants = o.pants ?? C.grayD;
  const skin = o.skin ?? C.skin;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.add(blobShadow(o.scale ?? 1));

  const legL = limb(0.22, 0.7, 0.24, pants, -0.15, 0.7, body, o.shoes ?? C.black);
  const legR = limb(0.22, 0.7, 0.24, pants, 0.15, 0.7, body, o.shoes ?? C.black);

  const torsoW = o.belly ? 0.72 : 0.6;
  const torso = box(torsoW, 0.56, o.belly ? 0.48 : 0.36, shirt, 0, 0.98, 0, body);
  if (o.stripes) {
    for (let i = 0; i < 3; i++) box(torsoW + 0.02, 0.07, (o.belly ? 0.48 : 0.36) + 0.02, o.stripes, 0, 0.8 + i * 0.16, 0, body);
  }
  if (o.tie) box(0.08, 0.36, 0.02, o.tie, 0, 1.03, (o.belly ? 0.25 : 0.19), body);
  if (o.badge) box(0.1, 0.1, 0.02, C.gold, -0.15, 1.12, 0.19, body);
  if (o.tracksuit) {
    box(0.04, 0.56, 0.37, C.white, -torsoW / 2, 0.98, 0, body);
    box(0.04, 0.56, 0.37, C.white, torsoW / 2, 0.98, 0, body);
  }

  const armL = limb(0.17, 0.55, 0.2, o.sleeves ?? shirt, -(torsoW / 2 + 0.09), 1.24, body, skin);
  const armR = limb(0.17, 0.55, 0.2, o.sleeves ?? shirt, torsoW / 2 + 0.09, 1.24, body, skin);

  const head = new THREE.Group();
  head.position.y = 1.48;
  body.add(head);
  box(0.42, 0.42, 0.4, skin, 0, 0, 0, head);
  // oči
  box(0.06, 0.07, 0.02, C.black, -0.09, 0.04, 0.205, head);
  box(0.06, 0.07, 0.02, C.black, 0.09, 0.04, 0.205, head);
  box(0.07, 0.08, 0.06, o.skinD ?? C.skinD, 0, -0.03, 0.22, head); // nos
  if (o.hair !== null) box(0.44, 0.12, 0.42, o.hair ?? C.hair, 0, 0.2, -0.01, head);
  if (o.hairBack !== false && o.hair !== null) box(0.44, 0.3, 0.08, o.hair ?? C.hair, 0, 0.06, -0.2, head);
  if (o.mustache) box(0.28, 0.07, 0.04, o.mustache === true ? C.mustache : o.mustache, 0, -0.1, 0.215, head);
  if (o.beard) box(0.44, 0.16, 0.42, o.beard, 0, -0.15, 0.01, head);
  if (o.glasses) box(0.36, 0.08, 0.03, C.black, 0, 0.04, 0.215, head);
  if (o.mask) box(0.44, 0.1, 0.03, C.black, 0, 0.05, 0.21, head);

  switch (o.hat) {
    case 'police':
      box(0.48, 0.14, 0.48, C.police, 0, 0.27, 0, head);
      box(0.4, 0.05, 0.16, C.black, 0, 0.21, 0.27, head);
      box(0.08, 0.08, 0.02, C.gold, 0, 0.28, 0.25, head);
      break;
    case 'cap':
      box(0.44, 0.1, 0.44, o.hatColor ?? C.red, 0, 0.26, 0, head);
      box(0.4, 0.04, 0.2, o.hatColor ?? C.red, 0, 0.22, 0.28, head);
      break;
    case 'scarf':
      box(0.48, 0.3, 0.46, o.hatColor ?? C.purple, 0, 0.14, -0.02, head);
      box(0.12, 0.12, 0.08, o.hatColor ?? C.purple, 0, -0.18, -0.12, head);
      break;
    case 'fedora':
      box(0.62, 0.04, 0.62, o.hatColor ?? C.black, 0, 0.23, 0, head);
      box(0.42, 0.18, 0.42, o.hatColor ?? C.black, 0, 0.34, 0, head);
      box(0.43, 0.05, 0.43, C.redD, 0, 0.28, 0, head);
      break;
    case 'beret':
      box(0.5, 0.08, 0.5, o.hatColor ?? C.black, 0.04, 0.27, 0, head);
      box(0.05, 0.08, 0.05, o.hatColor ?? C.black, 0.04, 0.35, 0, head);
      break;
    case 'beanie':
      box(0.46, 0.18, 0.44, o.hatColor ?? C.black, 0, 0.22, 0, head);
      break;
  }

  let carry = null;
  if (o.carry === 'suitcase') {
    carry = new THREE.Group();
    box(0.18, 0.42, 0.55, o.carryColor ?? C.brown, 0, -0.75, 0, carry);
    box(0.04, 0.06, 0.18, C.black, 0, -0.5, 0, carry);
    armR.add(carry);
  } else if (o.carry === 'moneybag') {
    carry = new THREE.Group();
    box(0.36, 0.36, 0.36, C.wood, 0, -0.75, 0, carry);
    box(0.14, 0.12, 0.14, C.wood, 0, -0.52, 0, carry);
    box(0.16, 0.16, 0.02, C.money, 0, -0.75, 0.19, carry);
    armR.add(carry);
  } else if (o.carry === 'bag') {
    carry = new THREE.Group();
    box(0.12, 0.28, 0.36, o.carryColor ?? C.pink, 0, -0.62, 0, carry);
    armL.add(carry);
  }

  if (o.scale) root.scale.setScalar(o.scale);

  // indikator "!" iznad glave
  const alert = new THREE.Group();
  box(0.12, 0.34, 0.12, C.red, 0, 0.25, 0, alert);
  box(0.12, 0.12, 0.12, C.red, 0, -0.05, 0, alert);
  alert.position.y = 2.25;
  alert.visible = false;
  root.add(alert);

  // zvezdice kad je ošamućen
  const stars = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = box(0.12, 0.12, 0.12, C.yellow);
    s.userData.a = (i / 3) * Math.PI * 2;
    stars.add(s);
  }
  stars.position.y = 1.95;
  stars.visible = false;
  root.add(stars);

  return {
    root, body, head, legL, legR, armL, armR, alert, stars, torso,
    phase: Math.random() * 6,
    animate(dt, speed, t) {
      this.phase += dt * speed * 3.2;
      const sw = Math.sin(this.phase) * Math.min(1, speed / 2) * 0.8;
      legL.rotation.x = sw;
      legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.8;
      armR.rotation.x = carry && o.carry !== 'bag' ? sw * 0.2 : sw * 0.8;
      body.position.y = Math.abs(Math.sin(this.phase)) * 0.06 * Math.min(1, speed / 2);
      if (alert.visible) alert.rotation.y += dt * 4;
      if (stars.visible) {
        for (const s of stars.children) {
          const a = s.userData.a + t * 5;
          s.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
        }
      }
    },
  };
}

export function makePlane(color = C.white, stripe = C.blue) {
  const g = new THREE.Group();
  // trup duž ose x
  const fus = cyl(0.9, 0.9, 9, color, 8);
  fus.rotation.z = Math.PI / 2;
  fus.position.y = 1.4;
  g.add(fus);
  const nose = cyl(0.01, 0.9, 1.6, color, 8);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(5.3, 1.4, 0);
  g.add(nose);
  const tail = cyl(0.9, 0.3, 2, color, 8);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-5.5, 1.6, 0);
  g.add(tail);
  box(9, 0.25, 1.85, stripe, 0, 1.4, 0, g);
  box(2.2, 0.15, 11, color, 0.3, 1.0, 0, g); // krila
  box(1.2, 2.0, 0.2, stripe, -5.8, 2.9, 0, g); // rep
  box(1, 0.12, 3.4, color, -5.8, 1.9, 0, g);
  for (const side of [-1, 1]) cyl(0.35, 0.35, 1.2, C.gray, 8, 0.8, 0.7, side * 2.6, g).rotation.z = Math.PI / 2;
  for (let i = -3; i <= 3; i++) {
    box(0.3, 0.25, 0.02, C.black, i * 1.1, 1.75, 0.89, g);
    box(0.3, 0.25, 0.02, C.black, i * 1.1, 1.75, -0.89, g);
  }
  box(0.5, 0.3, 1.2, C.black, 5.1, 1.9, 0, g); // kokpit
  for (const [x, z] of [[3.5, 0], [-0.5, 1.2], [-0.5, -1.2]]) box(0.2, 0.5, 0.2, C.grayD, x, 0.25, z, g);
  return g;
}

export function makeBarrier() {
  // rampa: stub + crveno-bela motka koja se spušta
  const g = new THREE.Group();
  box(0.4, 1.1, 0.4, C.yellow, 0, 0.55, 0, g);
  const arm = new THREE.Group();
  arm.position.set(0, 1.0, 0);
  for (let i = 0; i < 6; i++) box(0.5, 0.18, 0.18, i % 2 ? C.white : C.red, 0.25 + i * 0.5, 0, 0, arm);
  g.add(arm);
  arm.rotation.z = Math.PI / 2 - 0.05; // podignuta
  return { root: g, arm };
}

export function makeSwitch(color = C.red) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 12), mat(C.yellow));
  pad.position.y = 0.03;
  g.add(pad);
  box(0.5, 0.8, 0.5, C.grayD, 0, 0.4, 0, g);
  const btn = cyl(0.22, 0.22, 0.14, color, 10, 0, 0.86, 0, g);
  return { root: g, btn, pad };
}

export function makeBurek() {
  const g = new THREE.Group();
  const base = cyl(0.42, 0.45, 0.14, C.gold, 10, 0, 0, 0, g);
  cyl(0.3, 0.38, 0.08, C.orange, 10, 0, 0.1, 0, g);
  cyl(0.12, 0.2, 0.06, C.gold, 8, 0, 0.16, 0, g);
  base.position.y = 0;
  return g;
}

export function makeWhistle() {
  const g = new THREE.Group();
  const b = cyl(0.18, 0.18, 0.36, C.grayL, 10, 0, 0, 0, g);
  b.rotation.z = Math.PI / 2;
  box(0.4, 0.12, 0.14, C.grayL, 0.3, 0.06, 0, g);
  box(0.06, 0.06, 0.06, C.red, -0.18, 0.2, 0, g);
  return g;
}

export function makeMoney() {
  const g = new THREE.Group();
  box(0.5, 0.18, 0.3, C.money, 0, 0, 0, g);
  box(0.12, 0.2, 0.32, C.white, 0, 0, 0, g);
  return g;
}

/**
 * Natpis pikselnim fontom. lines: string ili [{ text, color }].
 * texel = veličina jednog piksela fonta u svetu; ~0.1 daje oko 1-2 piksela na ekranu.
 * Boje treba da budu tačne boje palete (mdCss), da ih šejder ne ditheruje.
 */
export function makeTextSign(lines, { bg, fg, border, texel = 0.1, pad = 2, align } = {}) {
  const ls = typeof lines === 'string' ? [{ text: lines, color: fg }] : lines.map((l) => ({ color: fg, ...l }));
  const cv = drawPixelText(ls, { bg, border, pad, align });
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = cv.width * texel, h = cv.height * texel;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.userData.size = { w, h };
  return m;
}
