export class InputController {
  constructor() {
    this.dx = 0;
    this.dz = 0;
    this.turbo = false;
    this.shoot = false;
    this.keys = {};

    this.bindKeyboard();
    this.bindTouch();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.shoot = true;
      if (e.shiftKey) this.turbo = true;
      this.evalKeyboard();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.shoot = false;
      if (!e.shiftKey) this.turbo = false;
      this.evalKeyboard();
    });
  }

  evalKeyboard() {
    let x = 0, z = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    const len = Math.hypot(x, z);
    if (len > 0) {
      this.dx = x / len;
      this.dz = z / len;
    } else {
      this.dx = 0;
      this.dz = 0;
    }
  }

  bindTouch() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const btnTurbo = document.getElementById('btn-touch-turbo');
    const btnShoot = document.getElementById('btn-touch-shoot');

    if (!zone || !knob) return;

    let touchId = null;
    let cx = 0, cy = 0;
    const maxR = 40;

    zone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const rect = zone.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      this.updateJoystick(t.clientX, t.clientY, cx, cy, maxR, knob);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (touchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          this.updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY, cx, cy, maxR, knob);
          break;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touchId = null;
          this.dx = 0;
          this.dz = 0;
          knob.style.transform = 'translate(-50%, -50%)';
          break;
        }
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    btnTurbo.addEventListener('touchstart', (e) => { e.preventDefault(); this.turbo = true; });
    btnTurbo.addEventListener('touchend', (e) => { e.preventDefault(); this.turbo = false; });

    btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); this.shoot = true; });
    btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); this.shoot = false; });
  }

  updateJoystick(clientX, clientY, cx, cy, maxR, knob) {
    let x = clientX - cx;
    let y = clientY - cy;
    const dist = Math.hypot(x, y);

    if (dist > maxR) {
      x = (x / dist) * maxR;
      y = (y / dist) * maxR;
    }

    knob.style.transform = 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px))';
    this.dx = x / maxR;
    this.dz = y / maxR;
  }
}