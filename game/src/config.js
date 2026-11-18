// Every tuning number and colour for NOVA WARDEN, in one place. The arena is a fixed
// 1280x720 logical field; the renderer scales it to the window, so no rule below depends
// on the screen size. The star-core sits at the centre and must survive ten waves.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The star-core at the middle of the arena. */
export const CORE = { x: 640, y: 360, radius: 46, maxHp: 100 };

/** The warden-ship the player flies. */
export const SHIP = {
  radius: 16,
  thrust: 1500,
  maxSpeed: 430,
  drag: 2.4,
  fireInterval: 0.14,
  bulletSpeed: 760,
  bulletRadius: 5,
  bulletDamage: 1,
};

/** Shard kinds: what flies in from the dark to eat the core's light. */
export const SHARD_KINDS = {
  pebble: { radius: 13, hp: 1, speed: 62, damage: 6, score: 50, motes: 1, hue: '#ff9d5c' },
  dart: { radius: 10, hp: 1, speed: 165, damage: 4, score: 80, motes: 1, hue: '#ff5c8a' },
  shard: { radius: 24, hp: 2, speed: 84, damage: 10, score: 120, motes: 2, hue: '#c77dff' },
  splitter: { radius: 27, hp: 2, speed: 72, damage: 12, score: 150, motes: 2, hue: '#5cffb1' },
  brute: { radius: 40, hp: 5, speed: 46, damage: 18, score: 300, motes: 3, hue: '#ff5c5c' },
};

/** How many shards a wave throws, and how the mix changes as waves go on. */
export const WAVE = {
  count: 12,
  perWave: 5,
  max: 10,
  clearBonus: 250,
  betweenSeconds: 2.5,
  spawnInterval: 0.6,
  spawnIntervalMin: 0.3,
};

/** Light motes: the sparks a destroyed shard leaves behind. Picking one up heals the core. */
export const MOTE = { radius: 7, heal: 2, score: 25, life: 9, magnet: 150 };

/** Power-ups, dropped rarely by destroyed shards. */
export const POWERUP = {
  dropChance: 0.07,
  radius: 16,
  life: 12,
  spreadSeconds: 12,
  rapidSeconds: 10,
};

export const COMBO = { windowSeconds: 4, max: 8 };

/** How many of each pool the simulation pre-allocates, once, at boot. */
export const POOLS = { shards: 96, bullets: 128, motes: 96, powerups: 8, particles: 320, popups: 24 };

export const PALETTE = {
  spaceTop: '#070a1e',
  spaceBottom: '#160b2e',
  nebulaA: '#2a1a5e',
  nebulaB: '#0e2a4a',
  core: '#ffd166',
  coreHot: '#fff3c4',
  ship: '#4de8ff',
  shipDark: '#1b7fa8',
  bullet: '#aef6ff',
  text: '#eef2ff',
  muted: '#9aa3c7',
  danger: '#ff5c5c',
  panel: 'rgba(10, 14, 34, 0.72)',
  panelEdge: 'rgba(120, 160, 255, 0.35)',
  gold: '#ffd166',
  green: '#5cffb1',
  pink: '#ff5c8a',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-warden.best';
