// Keyboard and pointer input. WASD or the arrow keys thrust the ship; the mouse aims it and
// holding the button (or Space) fires. One-shot presses (start, restart, pause, mute) are
// queued as bit flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const FIRE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, fire: false };
  const mouse = { x: 640, y: 200, down: false };
  let actions = 0;

  function toGame(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const offsetX = (rect.width - 1280 * scale) / 2;
    const offsetY = (rect.height - 720 * scale) / 2;
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (FIRE.has(event.code)) {
      keys.fire = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (FIRE.has(event.code)) keys.fire = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.fire = false;
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = toGame(event);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toGame(event);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    /** Thrust direction as a unit-ish vector {x, y} (diagonals normalised). */
    thrust() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** Whether the fire button (mouse or Space) is held right now. */
    firing() {
      return mouse.down || keys.fire;
    },
    /** Where the mouse is pointing, in game coordinates. */
    aim() {
      return { x: mouse.x, y: mouse.y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
