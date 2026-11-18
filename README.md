# NOVA WARDEN — defend the last star-core

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/funfunin/best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard)
[![reward](https://make.fun/badge/best-game-01/funfunin/best-game/reward.svg)](https://make.fun/bounty/best-game-01)

An original offline browser game, built for [make.fun's best-game-01 bounty](https://make.fun/bounty/best-game-01) ($1,000 in USDC). No build step, no network: serve `game/` with any static server and open `game/index.html`.

## The game

The last star-core in the sector is dying, and shards fly in from the dark to eat what light is left. You fly the warden-ship that guards it.

- **Goal:** survive all **10 waves**. Clear wave 10 and the core endures — you win. If the core's light hits 0%, the light goes out and the run ends.
- **Shoot the shards** before they reach the core. Five kinds, each with its own speed, toughness and glow: pebbles, darts, shards, splitters (break into two pebbles) and armored brutes.
- **Gather light motes** from destroyed shards: each one heals the core and scores. Chain kills without a core hit to build a **combo multiplier** (up to x3).
- **Power-ups** drop rarely: Triple Shot, Rapid Fire, Aegis Shield (blocks one core hit) and Core Mend (+25% light).
- **Endless mode:** after winning, press C to keep flying against ever-growing waves.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Fly the warden-ship |
| Mouse | Aim |
| Click / Space | Fire (hold to keep firing) |
| P / Esc | Pause |
| R | Restart |
| C (on the win screen) | Continue in endless mode |
| M | Mute / unmute |

The HUD shows score, kills, motes, wave, core integrity, combo and active weapon timers. Best score is kept in the browser. All sound is synthesized live with WebAudio — no audio files.

## How it is built

- `game/index.html` — the page; a full-window canvas, nothing else.
- `game/src/config.js` — every tuning number and colour in one place.
- `game/src/random.js` — seeded RNG, so a `?seed=N` game always plays the same.
- `game/src/input.js` — keyboard + pointer input (thrust, aim, fire, one-shot actions).
- `game/src/world.js` — the simulation: ship, core, waves, shards, motes, power-ups, particles, scoring and combos. Fixed 1/60 s steps, pooled entities.
- `game/src/render.js` — everything drawn: starfield, glowing core, ship, shards, HUD and the title / pause / win / game-over screens.
- `game/src/audio.js` — synthesized laser, explosion, pickup and wave sounds plus an ambient pad. No audio files.
- `game/src/shots.js` — the autopilot that stages the screenshots (`?shot=start|play|storm|end`).
- `game/src/main.js` — boot and the one loop; the title → play → pause → win / game-over state machine.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored `vendor/makefun-game.ts`.

## Screenshots

Real renders of the game's own code in headless Chromium (seeded, via `?shot=…`):

1. `1-start.jpg` — title screen over the live attract-mode game.
2. `2-play.jpg` — wave 4 in progress, HUD, combo and a core hit.
3. `3-storm.jpg` — wave 5, 100+ kills, brutes and splitters closing in.
4. `4-end.jpg` — game over: the light went out, with score and restart.

## Play it

```sh
# any static server pointed at game/, for example:
python3 -m http.server --directory game 8080
# then open http://localhost:8080
```

`?seed=N` fixes the shard pattern; `?shot=start|play|storm|end&seed=N` stages a screenshot scene instead of the loop.
