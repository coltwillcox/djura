// Tastatura + dodirni džojstik. Akcije: move (vektor), sprint, arrest, whistle, pause, confirm.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'arrest', KeyJ: 'arrest',
  KeyE: 'whistle', KeyK: 'whistle',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm', NumpadEnter: 'confirm',
  KeyM: 'mute',
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.isTouch = false;

    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!this.held.has(a)) this.pressed.add(a);
      this.held.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => this.held.clear());

    this.setupTouch();
  }

  setupTouch() {
    const root = document.getElementById('touch');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let stickId = null;
    let origin = null;

    window.addEventListener('touchstart', () => {
      if (!this.isTouch) {
        this.isTouch = true;
        root.classList.add('on');
        document.body.classList.add('touch');
      }
    }, { passive: true });

    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      origin = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
      this.updateStick(t, origin, knob);
    });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === stickId) this.updateStick(t, origin, knob);
    });
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null;
          this.touchMove = { x: 0, y: 0 };
          knob.style.transform = 'translate(-50%, -50%)';
        }
      }
    };
    stick.addEventListener('touchend', endStick);
    stick.addEventListener('touchcancel', endStick);

    for (const btn of root.querySelectorAll('[data-action]')) {
      const a = btn.dataset.action;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.pressed.add(a);
        this.held.add(a);
        btn.classList.add('down');
      });
      const up = (e) => {
        e.preventDefault();
        this.held.delete(a);
        btn.classList.remove('down');
      };
      btn.addEventListener('touchend', up);
      btn.addEventListener('touchcancel', up);
    }
  }

  updateStick(t, o, knob) {
    let dx = t.clientX - o.x;
    let dy = t.clientY - o.y;
    const len = Math.hypot(dx, dy);
    if (len > o.r) { dx = (dx / len) * o.r; dy = (dy / len) * o.r; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const n = Math.min(1, len / o.r);
    this.touchMove = len > 4 ? { x: (dx / o.r), y: (dy / o.r), n } : { x: 0, y: 0 };
  }

  move() {
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    x += this.touchMove.x;
    y += this.touchMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  down(a) { return this.held.has(a); }
  hit(a) { return this.pressed.has(a); }
  endFrame() { this.pressed.clear(); }
}
