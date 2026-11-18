// The simulation: one warden-ship, the star-core it guards, and the shards that fly in from
// the dark to eat the core's light. Fixed 1/60 s steps, pooled entities (nothing is allocated
// while playing), waves that grow, light motes that heal the core, and power-ups. The loop in
// main.js feeds it a control { thrust, aim, firing } and plays the sounds it names.

import { COMBO, CORE, FIELD, MOTE, POOLS, POWERUP, SHARD_KINDS, SHIP, STEP, WAVE } from './config.js';
import { pick, range } from './random.js';

export const EVENT_CORE_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_WAVE = 8;
export const EVENT_CLEAR = 16;

const SHARD_ORDER = ['pebble', 'dart', 'shard', 'splitter', 'brute'];
const POWERUP_KINDS = ['spread', 'rapid', 'aegis', 'mend'];
const POWERUP_LABELS = { spread: 'TRIPLE SHOT', rapid: 'RAPID FIRE', aegis: 'AEGIS SHIELD', mend: 'CORE MEND +25' };

function makePool(size, make) {
  const pool = [];
  for (let i = 0; i < size; i += 1) pool.push(make());
  return pool;
}

function freeSlot(pool) {
  for (let i = 0; i < pool.length; i += 1) {
    if (!pool[i].active) return pool[i];
  }
  return null;
}

function countActive(pool) {
  let n = 0;
  for (let i = 0; i < pool.length; i += 1) if (pool[i].active) n += 1;
  return n;
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    wave: 0,
    coreHp: CORE.maxHp,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    motesGot: 0,
    endless: false,
    over: false,
    won: false,
    shake: 0,
    flash: 0,
    banner: '',
    bannerTimer: 0,
    waveState: 'lull',
    lullTimer: 1.2,
    spawnQueue: [],
    spawnTimer: 0,
    ship: { x: 640, y: 540, vx: 0, vy: 0, angle: -Math.PI / 2, fireTimer: 0, spreadUntil: 0, rapidUntil: 0, aegis: false, trailTimer: 0 },
    bullets: makePool(POOLS.bullets, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 })),
    shards: makePool(POOLS.shards, () => ({ active: false, kind: 'pebble', x: 0, y: 0, vx: 0, vy: 0, speed: 60, radius: 13, hp: 1, damage: 6, score: 50, motes: 1, hue: '#fff', wobble: 0, phase: 0, spin: 0, angle: 0 })),
    motes: makePool(POOLS.motes, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 })),
    powerups: makePool(POOLS.powerups, () => ({ active: false, kind: 'spread', x: 0, y: 0, vx: 0, vy: 0, life: 0, pulse: 0 })),
    particles: makePool(POOLS.particles, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' })),
    popups: makePool(POOLS.popups, () => ({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff' })),
    stars: [],
  };

  // A fixed starfield, seeded once so the backdrop never changes mid-game.
  for (let i = 0; i < 130; i += 1) {
    state.stars.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      size: range(random, 0.6, 2.2),
      twinkle: range(random, 0.5, 2.5),
      phase: random() * Math.PI * 2,
      depth: range(random, 0.25, 1),
    });
  }

  function burst(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i += 1) {
      const p = freeSlot(state.particles);
      if (!p) return;
      const angle = random() * Math.PI * 2;
      const v = range(random, speed * 0.25, speed);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = range(random, 0.35, 0.8);
      p.life = p.maxLife;
      p.size = range(random, size * 0.5, size * 1.4);
      p.color = color;
    }
  }

  function popup(x, y, text, color) {
    const p = freeSlot(state.popups);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.text = text;
    p.life = 1.1;
    p.color = color;
  }

  function showBanner(text, seconds) {
    state.banner = text;
    state.bannerTimer = seconds;
  }

  function spawnShard(kind) {
    const def = SHARD_KINDS[kind];
    const s = freeSlot(state.shards);
    if (!s) return;
    // Pick an edge point outside the field and aim at the core, with a little wobble.
    const edge = Math.floor(random() * 4);
    const margin = 40;
    if (edge === 0) { s.x = range(random, 0, FIELD.width); s.y = -margin; }
    else if (edge === 1) { s.x = FIELD.width + margin; s.y = range(random, 0, FIELD.height); }
    else if (edge === 2) { s.x = range(random, 0, FIELD.width); s.y = FIELD.height + margin; }
    else { s.x = -margin; s.y = range(random, 0, FIELD.height); }
    const toCore = Math.atan2(CORE.y - s.y, CORE.x - s.x);
    const speed = def.speed * range(random, 0.85, 1.2);
    s.speed = speed;
    s.vx = Math.cos(toCore) * speed;
    s.vy = Math.sin(toCore) * speed;
    s.active = true;
    s.kind = kind;
    s.radius = def.radius * range(random, 0.9, 1.1);
    s.hp = def.hp;
    s.damage = def.damage;
    s.score = def.score;
    s.motes = def.motes;
    s.hue = def.hue;
    s.wobble = range(random, 12, 42);
    s.phase = random() * Math.PI * 2;
    s.spin = range(random, -1.4, 1.4);
    s.angle = random() * Math.PI * 2;
  }

  function buildWave(n) {
    const count = WAVE.count + (n - 1) * WAVE.perWave;
    const queue = [];
    for (let i = 0; i < count; i += 1) {
      const roll = random();
      let kind = 'pebble';
      if (n >= 4 && roll < 0.1) kind = 'brute';
      else if (n >= 3 && roll < 0.28) kind = 'splitter';
      else if (n >= 2 && roll < 0.48) kind = 'dart';
      else if (roll < 0.78) kind = 'shard';
      queue.push(kind);
    }
    // Shuffle so the kinds arrive mixed.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    return queue;
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = buildWave(n);
    state.spawnTimer = 0.4;
    state.waveState = 'active';
    showBanner(`WAVE ${n}`, 1.8);
  }

  function dropMotes(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const m = freeSlot(state.motes);
      if (!m) return;
      const angle = random() * Math.PI * 2;
      const v = range(random, 30, 110);
      m.active = true;
      m.x = x;
      m.y = y;
      m.vx = Math.cos(angle) * v;
      m.vy = Math.sin(angle) * v;
      m.life = MOTE.life;
    }
  }

  function dropPowerup(x, y) {
    const p = freeSlot(state.powerups);
    if (!p) return;
    p.active = true;
    p.kind = pick(random, POWERUP_KINDS);
    p.x = x;
    p.y = y;
    p.vx = range(random, -25, 25);
    p.vy = range(random, -25, 25);
    p.life = POWERUP.life;
    p.pulse = 0;
  }

  function destroyShard(s, sounds) {
    s.active = false;
    state.kills += 1;
    const mult = 1 + Math.min(state.combo, COMBO.max) * 0.25;
    const gained = Math.round(s.score * mult);
    state.score += gained;
    state.combo += 1;
    state.comboTimer = COMBO.windowSeconds;
    popup(s.x, s.y, `+${gained}`, s.hue);
    burst(s.x, s.y, s.hue, s.kind === 'brute' ? 26 : 14, s.kind === 'brute' ? 260 : 200, 3.4);
    burst(s.x, s.y, '#ffffff', 5, 120, 2);
    sounds.push('explosion');
    dropMotes(s.x, s.y, s.motes);
    if (random() < POWERUP.dropChance) dropPowerup(s.x, s.y);
    if (s.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const child = freeSlot(state.shards);
        if (!child) break;
        const angle = random() * Math.PI * 2;
        child.active = true;
        child.kind = 'pebble';
        child.x = s.x + Math.cos(angle) * 14;
        child.y = s.y + Math.sin(angle) * 14;
        child.speed = SHARD_KINDS.pebble.speed * range(random, 0.9, 1.25);
        child.vx = Math.cos(angle) * 120;
        child.vy = Math.sin(angle) * 120;
        child.radius = 13;
        child.hp = 1;
        child.damage = 6;
        child.score = 50;
        child.motes = 1;
        child.hue = SHARD_KINDS.pebble.hue;
        child.wobble = 20;
        child.phase = random() * Math.PI * 2;
        child.spin = range(random, -2, 2);
        child.angle = random() * Math.PI * 2;
      }
    }
  }

  function coreHit(s, sounds) {
    s.active = false;
    if (state.ship.aegis) {
      state.ship.aegis = false;
      showBanner('AEGIS ABSORBED THE HIT', 1.6);
      burst(CORE.x, CORE.y, '#4de8ff', 22, 240, 3);
      popup(CORE.x, CORE.y - 70, 'BLOCKED', '#4de8ff');
      sounds.push('powerup');
      return EVENT_CORE_HIT;
    }
    state.coreHp = Math.max(0, state.coreHp - s.damage);
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 14;
    state.flash = 0.45;
    burst(CORE.x, CORE.y, '#ff5c5c', 20, 260, 3.6);
    popup(CORE.x, CORE.y - 70, `-${s.damage}`, '#ff5c5c');
    sounds.push('coreHit');
    if (state.coreHp <= 0) {
      state.over = true;
      burst(CORE.x, CORE.y, '#ffd166', 60, 420, 5);
      burst(CORE.x, CORE.y, '#ff5c5c', 40, 320, 4);
      sounds.push('lose');
      return EVENT_CORE_HIT | EVENT_OVER;
    }
    return EVENT_CORE_HIT;
  }

  function fireBullet(angle, sounds) {
    const b = freeSlot(state.bullets);
    if (!b) return;
    const ship = state.ship;
    const nose = SHIP.radius + 8;
    b.active = true;
    b.x = ship.x + Math.cos(angle) * nose;
    b.y = ship.y + Math.sin(angle) * nose;
    b.vx = Math.cos(angle) * SHIP.bulletSpeed + ship.vx * 0.3;
    b.vy = Math.sin(angle) * SHIP.bulletSpeed + ship.vy * 0.3;
    b.life = 1.1;
    sounds.push('laser');
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.wave = 0;
    state.coreHp = CORE.maxHp;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.motesGot = 0;
    state.endless = false;
    state.over = false;
    state.won = false;
    state.shake = 0;
    state.flash = 0;
    state.banner = '';
    state.bannerTimer = 0;
    state.waveState = 'lull';
    state.lullTimer = 1.2;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    const ship = state.ship;
    ship.x = 640;
    ship.y = 540;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    ship.fireTimer = 0;
    ship.spreadUntil = 0;
    ship.rapidUntil = 0;
    ship.aegis = false;
    ship.trailTimer = 0;
    for (const pool of [state.bullets, state.shards, state.motes, state.powerups, state.particles, state.popups]) {
      for (let i = 0; i < pool.length; i += 1) pool[i].active = false;
    }
  }

  function step(dt, control, attract) {
    const sounds = [];
    let events = 0;
    const ship = state.ship;
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    if (attract) {
      // Title-screen demo: the ship circles the core on its own, firing at shards; the
      // core cannot die here, so the backdrop stays alive behind the title.
      const orbit = state.time * 0.45;
      const targetX = CORE.x + Math.cos(orbit) * 210;
      const targetY = CORE.y + Math.sin(orbit) * 150;
      ship.vx = (targetX - ship.x) * 2.2;
      ship.vy = (targetY - ship.y) * 2.2;
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      let nearest = null;
      let nearestD = Infinity;
      for (let i = 0; i < state.shards.length; i += 1) {
        const s = state.shards[i];
        if (!s.active) continue;
        const d = Math.hypot(s.x - ship.x, s.y - ship.y);
        if (d < nearestD) { nearestD = d; nearest = s; }
      }
      if (nearest) {
        ship.angle = Math.atan2(nearest.y - ship.y, nearest.x - ship.x);
        ship.fireTimer -= dt;
        if (ship.fireTimer <= 0 && nearestD < 520) {
          ship.fireTimer = SHIP.fireInterval * 1.4;
          fireBullet(ship.angle, []);
        }
      }
      if (state.spawnQueue.length === 0 && countActive(state.shards) < 5) {
        state.spawnQueue = buildWave(2);
      }
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
        spawnShard(state.spawnQueue.shift());
        state.spawnTimer = 0.9;
      }
    } else {
      // Player flight.
      ship.vx += control.thrust.x * SHIP.thrust * dt;
      ship.vy += control.thrust.y * SHIP.thrust * dt;
      const drag = Math.exp(-SHIP.drag * dt);
      ship.vx *= drag;
      ship.vy *= drag;
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > SHIP.maxSpeed) {
        ship.vx = (ship.vx / speed) * SHIP.maxSpeed;
        ship.vy = (ship.vy / speed) * SHIP.maxSpeed;
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      if (ship.x < SHIP.radius) { ship.x = SHIP.radius; ship.vx = Math.abs(ship.vx) * 0.5; }
      if (ship.x > FIELD.width - SHIP.radius) { ship.x = FIELD.width - SHIP.radius; ship.vx = -Math.abs(ship.vx) * 0.5; }
      if (ship.y < SHIP.radius) { ship.y = SHIP.radius; ship.vy = Math.abs(ship.vy) * 0.5; }
      if (ship.y > FIELD.height - SHIP.radius) { ship.y = FIELD.height - SHIP.radius; ship.vy = -Math.abs(ship.vy) * 0.5; }
      ship.angle = Math.atan2(control.aim.y - ship.y, control.aim.x - ship.x);

      // Thruster trail.
      ship.trailTimer -= dt;
      if (speed > 60 && ship.trailTimer <= 0) {
        ship.trailTimer = 0.03;
        const p = freeSlot(state.particles);
        if (p) {
          p.active = true;
          p.x = ship.x - Math.cos(ship.angle) * SHIP.radius;
          p.y = ship.y - Math.sin(ship.angle) * SHIP.radius;
          p.vx = -ship.vx * 0.15 + range(random, -15, 15);
          p.vy = -ship.vy * 0.15 + range(random, -15, 15);
          p.maxLife = 0.35;
          p.life = 0.35;
          p.size = 2.6;
          p.color = '#4de8ff';
        }
      }

      // Firing.
      ship.fireTimer -= dt;
      if (control.firing && ship.fireTimer <= 0) {
        const interval = state.time < ship.rapidUntil ? SHIP.fireInterval * 0.5 : SHIP.fireInterval;
        ship.fireTimer = interval;
        if (state.time < ship.spreadUntil) {
          fireBullet(ship.angle - 0.16, sounds);
          fireBullet(ship.angle, sounds);
          fireBullet(ship.angle + 0.16, sounds);
        } else {
          fireBullet(ship.angle, sounds);
        }
      }

      // Waves.
      if (state.waveState === 'lull') {
        state.lullTimer -= dt;
        if (state.lullTimer <= 0 && !state.over) {
          if (state.won && !state.endless) {
            // Won and waiting: the loop pauses here until the player chooses.
          } else {
            startWave(state.wave + 1);
            events |= EVENT_WAVE;
            sounds.push('waveHorn');
          }
        }
      } else {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
          spawnShard(state.spawnQueue.shift());
          const interval = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval - state.wave * 0.05);
          state.spawnTimer = interval;
        }
        if (state.spawnQueue.length === 0 && countActive(state.shards) === 0 && !state.over) {
          state.waveState = 'lull';
          state.lullTimer = WAVE.betweenSeconds;
          const bonus = WAVE.clearBonus + state.wave * 50;
          state.score += bonus;
          popup(CORE.x, CORE.y - 80, `WAVE CLEAR +${bonus}`, '#ffd166');
          events |= EVENT_CLEAR;
          if (state.wave >= WAVE.max && !state.won) {
            state.won = true;
            state.waveState = 'lull';
            state.lullTimer = 999;
            sounds.push('win');
            events |= EVENT_WIN;
          }
        }
      }
    }

    // Bullets fly, and hit shards.
    for (let i = 0; i < state.bullets.length; i += 1) {
      const b = state.bullets[i];
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (let j = 0; j < state.shards.length; j += 1) {
        const s = state.shards[j];
        if (!s.active) continue;
        const dx = s.x - b.x;
        const dy = s.y - b.y;
        const r = s.radius + SHIP.bulletRadius;
        if (dx * dx + dy * dy < r * r) {
          b.active = false;
          s.hp -= SHIP.bulletDamage;
          burst(b.x, b.y, '#aef6ff', 3, 90, 1.8);
          if (s.hp <= 0) destroyShard(s, sounds);
          break;
        }
      }
    }

    // Shards home toward the core, wobbling as they go: their velocity is re-aimed every
    // step, so a shard can never drift off and stall a wave.
    for (let i = 0; i < state.shards.length; i += 1) {
      const s = state.shards[i];
      if (!s.active) continue;
      const toCore = Math.atan2(CORE.y - s.y, CORE.x - s.x);
      const px = -Math.sin(toCore);
      const py = Math.cos(toCore);
      const wob = Math.sin(state.time * 2.2 + s.phase) * s.wobble;
      s.vx = Math.cos(toCore) * s.speed + px * wob;
      s.vy = Math.sin(toCore) * s.speed + py * wob;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.angle += s.spin * dt;
      // Safety net: a shard impossibly far out is removed rather than soft-locking a wave.
      if (s.x < -500 || s.x > FIELD.width + 500 || s.y < -500 || s.y > FIELD.height + 500) {
        s.active = false;
        continue;
      }
      const dCore = Math.hypot(CORE.x - s.x, CORE.y - s.y);
      if (dCore < CORE.radius + s.radius * 0.7) {
        if (attract) {
          s.active = false;
          burst(s.x, s.y, '#ffd166', 8, 140, 2.4);
        } else {
          events |= coreHit(s, sounds);
          if (state.over) break;
        }
      }
    }

    // Motes drift, get magnetised, and heal the core when the ship gathers them.
    for (let i = 0; i < state.motes.length; i += 1) {
      const m = state.motes[i];
      if (!m.active) continue;
      m.life -= dt;
      if (m.life <= 0) { m.active = false; continue; }
      const dx = ship.x - m.x;
      const dy = ship.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < MOTE.magnet) {
        const pull = 900 * (1 - d / MOTE.magnet) + 120;
        m.vx += (dx / (d || 1)) * pull * dt;
        m.vy += (dy / (d || 1)) * pull * dt;
      }
      m.vx *= Math.exp(-1.2 * dt);
      m.vy *= Math.exp(-1.2 * dt);
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (d < SHIP.radius + MOTE.radius + 8) {
        m.active = false;
        state.motesGot += 1;
        state.coreHp = Math.min(CORE.maxHp, state.coreHp + MOTE.heal);
        state.score += MOTE.score;
        burst(m.x, m.y, '#ffd166', 4, 80, 2);
        sounds.push('pickup');
      }
    }

    // Power-ups drift and wait to be collected.
    for (let i = 0; i < state.powerups.length; i += 1) {
      const p = state.powerups[i];
      if (!p.active) continue;
      p.life -= dt;
      p.pulse += dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-0.8 * dt);
      p.vy *= Math.exp(-0.8 * dt);
      const d = Math.hypot(ship.x - p.x, ship.y - p.y);
      if (d < SHIP.radius + POWERUP.radius + 6) {
        p.active = false;
        if (p.kind === 'spread') ship.spreadUntil = state.time + POWERUP.spreadSeconds;
        else if (p.kind === 'rapid') ship.rapidUntil = state.time + POWERUP.rapidSeconds;
        else if (p.kind === 'aegis') ship.aegis = true;
        else if (p.kind === 'mend') state.coreHp = Math.min(CORE.maxHp, state.coreHp + 25);
        showBanner(POWERUP_LABELS[p.kind], 1.6);
        popup(p.x, p.y, POWERUP_LABELS[p.kind], '#5cffb1');
        burst(p.x, p.y, '#5cffb1', 16, 180, 2.6);
        sounds.push('powerup');
      }
    }

    // Particles fade, popups float up.
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-1.6 * dt);
      p.vy *= Math.exp(-1.6 * dt);
    }
    for (let i = 0; i < state.popups.length; i += 1) {
      const p = state.popups[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.y -= 34 * dt;
    }

    if (state.over) events |= EVENT_OVER;
    return { events, sounds };
  }

  return { state, reset, step };
}
