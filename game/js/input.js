// input.js — keyboard and mouse state, in logical arena coordinates.
// Menus are drawn on the canvas, so clicks are queued here with their
// position and consumed by the UI once per frame.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 480, y: 270, down: false };
    this.clicks = [];
    this.pressed = new Set();

    addEventListener('keydown', (e) => {
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressed.add(e.code);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousemove', (e) => this.setMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.setMouse(e);
      this.mouse.down = true;
      this.clicks.push({ x: this.mouse.x, y: this.mouse.y });
    });
    addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.setMouse(t);
      this.mouse.down = true;
      this.clicks.push({ x: this.mouse.x, y: this.mouse.y });
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { this.setMouse(e.touches[0]); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', () => { this.mouse.down = false; });
  }

  setMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
    this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  justPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  moveAxis() {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.clicks.length = 0;
  }
}
