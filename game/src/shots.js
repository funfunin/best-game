// The screenshot scenes behind ?shot=start|play|storm|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (hold a guard ring around the core, aim at the nearest shard, fire when lined up), so
// every frame is what a short game really looks like and the same seed always gives the
// same frame. The end scene plays well for a while, then stops firing, so the core falls
// the way it does for a player who stops watching it.

import { CORE, FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const END_GOOD_SECONDS = 18;
const END_LIMIT_SECONDS = 600;
/** Play/storm scenes stop when the field is busy, not at a fixed time: a wave at least this
 * far in, with at least this many shards alive, is what a good action frame looks like. */
const PLAY_TARGET = { wave: 3, shards: 9, limitSeconds: 150 };
const STORM_TARGET = { wave: 5, shards: 11, limitSeconds: 200 };
const SAMPLE = 1 / 30;

/** Shards alive and inside the field (ones still flying in from the edge do not count). */
function activeShards(state) {
  let n = 0;
  for (let i = 0; i < state.shards.length; i += 1) {
    const s = state.shards[i];
    if (s.active && s.x > -10 && s.x < FIELD.width + 10 && s.y > -10 && s.y < FIELD.height + 10) n += 1;
  }
  return n;
}

/** Where the pilot wants to be: on the core's guard ring, on the side the threat comes from. */
function guardPoint(ship, threat) {
  const angle = Math.atan2(threat.y - CORE.y, threat.x - CORE.x);
  return { x: CORE.x + Math.cos(angle) * 250, y: CORE.y + Math.sin(angle) * 250 };
}

/** The autopilot's control for one step: thrust toward the guard point, aim at the nearest shard.
 * A light mote close by is worth a detour: gathering it heals the core. */
function autopilot(state) {
  const ship = state.ship;
  let nearest = null;
  let nearestD = Infinity;
  for (let i = 0; i < state.shards.length; i += 1) {
    const s = state.shards[i];
    if (!s.active) continue;
    const d = Math.hypot(s.x - ship.x, s.y - ship.y);
    if (d < nearestD) { nearestD = d; nearest = s; }
  }
  let mote = null;
  let moteD = Infinity;
  for (let i = 0; i < state.motes.length; i += 1) {
    const m = state.motes[i];
    if (!m.active) continue;
    const d = Math.hypot(m.x - ship.x, m.y - ship.y);
    if (d < moteD) { moteD = d; mote = m; }
  }
  const dest = mote !== null && moteD < 190 ? { x: mote.x, y: mote.y } : nearest === null ? { x: 640, y: 300 } : guardPoint(ship, nearest);
  const dx = dest.x - ship.x;
  const dy = dest.y - ship.y;
  const d = Math.hypot(dx, dy);
  const aim = nearest === null ? { x: 640, y: 120 } : { x: nearest.x, y: nearest.y };
  const aimAngle = Math.atan2(aim.y - ship.y, aim.x - ship.x);
  const angleDiff = Math.abs(((aimAngle - ship.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return {
    thrust: d > 36 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 },
    aim,
    firing: nearest !== null && nearestD < 620 && angleDiff < 0.2,
  };
}

/** A pilot that has stopped playing: no thrust, no fire, the core on its own. */
function idlePilot() {
  return { thrust: { x: 0, y: 0 }, aim: { x: 640, y: 120 }, firing: false };
}

/**
 * Set `world` to the named scene (start, play, storm or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'storm' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, idlePilot(), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const goodSeconds = END_GOOD_SECONDS;
  if (name === 'play' || name === 'storm') {
    // Play until the field is busy (target wave, enough shards alive), then hold half a
    // second more so bullets and bursts are in flight for the frame.
    const target = name === 'storm' ? STORM_TARGET : PLAY_TARGET;
    let over = false;
    let busy = false;
    for (let index = 0; index < target.limitSeconds / STEP; index += 1) {
      const result = world.step(STEP, autopilot(world.state), false);
      if (result.events & EVENT_OVER) { over = true; break; }
      if (world.state.wave >= target.wave && activeShards(world.state) >= target.shards) {
        busy = true;
        break;
      }
    }
    if (!over && busy) {
      for (let index = 0; index < 0.5 / STEP; index += 1) {
        const result = world.step(STEP, autopilot(world.state), false);
        if (result.events & EVENT_OVER) { over = true; break; }
      }
    }
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const limit = END_LIMIT_SECONDS;
  let over = false;
  for (let index = 0; index < limit / STEP; index += 1) {
    const control = index * STEP > goodSeconds ? idlePilot() : autopilot(world.state);
    const result = world.step(STEP, control, false);
    if (result.events & EVENT_OVER) { over = true; break; }
  }
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
