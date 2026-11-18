// Everything the player sees: the starfield, the glowing core, the warden-ship, shards,
// bullets, motes, particles, the HUD, and the title / pause / win / game-over screens.
// The renderer paints a fixed 1280x720 logical field, scaled to fit the window.

import { CORE, FIELD, FONT, MOTE, PALETTE, POWERUP, SHIP, WAVE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const POWERUP_COLORS = { spread: '#ff9d5c', rapid: '#4de8ff', aegis: '#5cffb1', mend: '#ffd166' };
const POWERUP_GLYPHS = { spread: '✦', rapid: '≫', aegis: '◈', mend: '+' };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function jaggedPolygon(ctx, x, y, radius, angle, phase, points) {
  ctx.beginPath();
  for (let i = 0; i < points; i += 1) {
    const a = angle + (i / points) * Math.PI * 2;
    const r = radius * (0.72 + 0.28 * Math.sin(i * 2.7 + phase));
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height) * 1;
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  }

  function drawBackground(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.spaceTop);
    grad.addColorStop(1, PALETTE.spaceBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-60, -60, FIELD.width + 120, FIELD.height + 120);

    // Two slow nebulae, fixed in place.
    const nebA = ctx.createRadialGradient(280, 150, 10, 280, 150, 320);
    nebA.addColorStop(0, 'rgba(90, 60, 180, 0.28)');
    nebA.addColorStop(1, 'rgba(90, 60, 180, 0)');
    ctx.fillStyle = nebA;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const nebB = ctx.createRadialGradient(1020, 560, 10, 1020, 560, 340);
    nebB.addColorStop(0, 'rgba(20, 90, 140, 0.30)');
    nebB.addColorStop(1, 'rgba(20, 90, 140, 0)');
    ctx.fillStyle = nebB;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Twinkling stars, drifting almost imperceptibly with their depth.
    for (let i = 0; i < state.stars.length; i += 1) {
      const s = state.stars[i];
      const alpha = 0.35 + 0.55 * Math.abs(Math.sin(state.time * s.twinkle + s.phase));
      ctx.globalAlpha = alpha * s.depth;
      ctx.fillStyle = '#dfe8ff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawCore(state) {
    const hpFrac = state.coreHp / CORE.maxHp;
    const pulse = 1 + 0.05 * Math.sin(state.time * 2.4);
    const glow = ctx.createRadialGradient(CORE.x, CORE.y, 4, CORE.x, CORE.y, CORE.radius * 3.1);
    const hot = hpFrac > 0.5 ? 'rgba(255, 209, 102, 0.5)' : 'rgba(255, 92, 92, 0.5)';
    glow.addColorStop(0, hot);
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(CORE.x - CORE.radius * 3.2, CORE.y - CORE.radius * 3.2, CORE.radius * 6.4, CORE.radius * 6.4);

    // Orbit rings.
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i += 1) {
      ctx.beginPath();
      ctx.arc(CORE.x, CORE.y, CORE.radius + 14 + i * 12, state.time * (0.3 + i * 0.2), state.time * (0.3 + i * 0.2) + Math.PI * 1.5);
      ctx.stroke();
    }

    // The orb itself: bright heart, dimming as it loses light.
    const orb = ctx.createRadialGradient(CORE.x - 12, CORE.y - 14, 4, CORE.x, CORE.y, CORE.radius * pulse);
    orb.addColorStop(0, PALETTE.coreHot);
    orb.addColorStop(0.55, hpFrac > 0.25 ? PALETTE.core : '#c25a4a');
    orb.addColorStop(1, hpFrac > 0.25 ? '#b8860b' : '#5e2222');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, CORE.radius * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Cracks show as the core weakens.
    if (hpFrac < 0.6) {
      ctx.strokeStyle = 'rgba(40, 10, 10, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CORE.x - 20, CORE.y - 26);
      ctx.lineTo(CORE.x - 4, CORE.y - 6);
      ctx.lineTo(CORE.x - 18, CORE.y + 14);
      ctx.moveTo(CORE.x + 22, CORE.y - 10);
      ctx.lineTo(CORE.x + 6, CORE.y + 8);
      ctx.lineTo(CORE.x + 20, CORE.y + 24);
      ctx.stroke();
    }

    // HP arc around the core.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, CORE.radius + 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hpFrac > 0.5 ? PALETTE.green : hpFrac > 0.25 ? PALETTE.gold : PALETTE.danger;
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, CORE.radius + 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac);
    ctx.stroke();
  }

  function drawShip(state) {
    const ship = state.ship;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    // Engine glow.
    const flame = 10 + Math.random() * 8;
    const grad = ctx.createLinearGradient(-SHIP.radius, 0, -SHIP.radius - flame - 12, 0);
    grad.addColorStop(0, 'rgba(77, 232, 255, 0.9)');
    grad.addColorStop(1, 'rgba(77, 232, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-SHIP.radius + 4, -6);
    ctx.lineTo(-SHIP.radius - flame, 0);
    ctx.lineTo(-SHIP.radius + 4, 6);
    ctx.closePath();
    ctx.fill();
    // Hull.
    ctx.fillStyle = PALETTE.ship;
    ctx.beginPath();
    ctx.moveTo(SHIP.radius + 8, 0);
    ctx.lineTo(-SHIP.radius, -11);
    ctx.lineTo(-SHIP.radius + 6, 0);
    ctx.lineTo(-SHIP.radius, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.shipDark;
    ctx.beginPath();
    ctx.moveTo(SHIP.radius - 2, 0);
    ctx.lineTo(-SHIP.radius + 8, -6);
    ctx.lineTo(-SHIP.radius + 8, 6);
    ctx.closePath();
    ctx.fill();
    // Cockpit.
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Aegis ring.
    if (ship.aegis) {
      ctx.strokeStyle = 'rgba(92, 255, 177, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, SHIP.radius + 12 + 2 * Math.sin(state.time * 4), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawShards(state) {
    for (let i = 0; i < state.shards.length; i += 1) {
      const s = state.shards[i];
      if (!s.active) continue;
      ctx.save();
      ctx.shadowColor = s.hue;
      ctx.shadowBlur = 12;
      ctx.fillStyle = s.hue;
      ctx.globalAlpha = 0.92;
      jaggedPolygon(ctx, s.x, s.y, s.radius, s.angle, s.phase, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      jaggedPolygon(ctx, s.x, s.y, s.radius * 0.55, s.angle + 0.6, s.phase, 7);
      ctx.fill();
      // Hit points as pips for the tough ones.
      if (s.hp >= 3) {
        ctx.fillStyle = '#ffffff';
        for (let p = 0; p < s.hp; p += 1) {
          ctx.beginPath();
          ctx.arc(s.x - (s.hp - 1) * 5 + p * 10, s.y - s.radius - 8, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  function drawBullets(state) {
    ctx.save();
    ctx.shadowColor = PALETTE.bullet;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(174, 246, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.fillStyle = PALETTE.bullet;
    for (let i = 0; i < state.bullets.length; i += 1) {
      const b = state.bullets[i];
      if (!b.active) continue;
      // A short trail behind each bolt, so fire reads even in a still frame.
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMotes(state) {
    ctx.save();
    for (let i = 0; i < state.motes.length; i += 1) {
      const m = state.motes[i];
      if (!m.active) continue;
      const blink = 0.6 + 0.4 * Math.sin(state.time * 6 + m.x);
      ctx.globalAlpha = Math.min(1, m.life) * blink;
      ctx.fillStyle = PALETTE.gold;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-MOTE.radius / 1.4, -MOTE.radius / 1.4, MOTE.radius * 1.4, MOTE.radius * 1.4);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPowerups(state) {
    for (let i = 0; i < state.powerups.length; i += 1) {
      const p = state.powerups[i];
      if (!p.active) continue;
      const color = POWERUP_COLORS[p.kind];
      const pulse = 1 + 0.12 * Math.sin(p.pulse * 5);
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(8, 12, 30, 0.9)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(ctx, p.x - POWERUP.radius * pulse, p.y - POWERUP.radius * pulse, POWERUP.radius * 2 * pulse, POWERUP.radius * 2 * pulse, 7);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(POWERUP_GLYPHS[p.kind], p.x, p.y + 1);
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups(state) {
    ctx.save();
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < state.popups.length; i += 1) {
      const p = state.popups[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }

  function drawHud(state, screen, muted) {
    const pad = 18;
    // Top-left: score.
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, pad, pad);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`KILLS ${state.kills}   •   MOTES ${state.motesGot}`, pad, pad + 34);

    // Top-centre: wave.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 26px ${FONT}`;
    const waveLabel = state.wave === 0 ? 'WAVE —' : state.endless ? `WAVE ${state.wave} · ENDLESS` : `WAVE ${state.wave} / ${WAVE.max}`;
    ctx.fillText(waveLabel, FIELD.width / 2, pad);
    if (state.waveState === 'lull' && state.wave > 0 && !state.won) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `14px ${FONT}`;
      ctx.fillText('next wave incoming…', FIELD.width / 2, pad + 34);
    }

    // Top-right: core integrity bar.
    const barW = 210;
    const barX = FIELD.width - pad - barW;
    ctx.textAlign = 'right';
    ctx.fillStyle = state.coreHp > 50 ? PALETTE.text : PALETTE.danger;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`CORE ${Math.ceil(state.coreHp)}%`, FIELD.width - pad, pad + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, barX, pad + 30, barW, 12, 6);
    ctx.fill();
    const hpFrac = state.coreHp / 100;
    ctx.fillStyle = hpFrac > 0.5 ? PALETTE.green : hpFrac > 0.25 ? PALETTE.gold : PALETTE.danger;
    if (hpFrac > 0) {
      roundRect(ctx, barX, pad + 30, Math.max(12, barW * hpFrac), 12, 6);
      ctx.fill();
    }
    if (state.ship.aegis) {
      ctx.fillStyle = PALETTE.green;
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText('◈ AEGIS READY', FIELD.width - pad, pad + 50);
    }

    // Bottom-left: combo.
    if (state.combo >= 2) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(`COMBO x${(1 + Math.min(state.combo, 8) * 0.25).toFixed(2)}  (${state.combo})`, pad, FIELD.height - pad);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
      const cw = 140;
      roundRect(ctx, pad, FIELD.height - pad - 34, cw, 6, 3);
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      roundRect(ctx, pad, FIELD.height - pad - 34, cw * (state.comboTimer / 4), 6, 3);
      ctx.fill();
    }

    // Bottom-right: active weapon timers + controls hint.
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    const timers = [];
    if (state.time < state.ship.spreadUntil) timers.push(`TRIPLE ${Math.ceil(state.ship.spreadUntil - state.time)}s`);
    if (state.time < state.ship.rapidUntil) timers.push(`RAPID ${Math.ceil(state.ship.rapidUntil - state.time)}s`);
    if (timers.length > 0) {
      ctx.fillStyle = PALETTE.green;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(timers.join('   '), FIELD.width - pad, FIELD.height - pad - 22);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`WASD move  •  mouse aim  •  click / Space fire  •  P pause  •  M ${muted ? 'unmute' : 'mute'}`, FIELD.width - pad, FIELD.height - pad);
    ctx.restore();

    // Wave banner.
    if (state.bannerTimer > 0 && state.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.bannerTimer);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold 44px ${FONT}`;
      ctx.shadowColor = 'rgba(120, 180, 255, 0.9)';
      ctx.shadowBlur = 24;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(state.banner, FIELD.width / 2, 168);
      ctx.restore();
    }
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 18, 0.45)';
    ctx.fillRect(-60, -60, FIELD.width + 120, FIELD.height + 120);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Eyebrow.
    ctx.fillStyle = PALETTE.ship;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText('T H E   L A S T   S T A R - C O R E   N E E D S   Y O U', FIELD.width / 2, 132);
    // Title.
    ctx.font = `bold 92px ${FONT}`;
    ctx.shadowColor = 'rgba(77, 232, 255, 0.85)';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NOVA WARDEN', FIELD.width / 2, 216);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `italic 24px ${FONT}`;
    ctx.fillText('Hold the light. Break the dark. Ten waves.', FIELD.width / 2, 282);

    drawPanel(FIELD.width / 2 - 330, 322, 660, 168);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('Shards fly in from the dark to eat the core. Shoot them down.', FIELD.width / 2, 352);
    ctx.fillText('Gather their light motes to heal the core. Grab power-ups.', FIELD.width / 2, 384);
    ctx.fillText('Survive all 10 waves and the core endures. If it falls, so do you.', FIELD.width / 2, 416);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('WASD / arrows — fly      Mouse — aim      Click / Space — fire', FIELD.width / 2, 458);

    // Start prompt, pulsing.
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 548);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText(`BEST SCORE  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 596);
    }
    ctx.restore();
  }

  function drawPaused() {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 18, 0.6)';
    ctx.fillRect(-60, -60, FIELD.width + 120, FIELD.height + 120);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 320);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('Press P or click to keep flying', FIELD.width / 2, 388);
    ctx.restore();
  }

  function drawOver(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 2, 6, 0.62)';
    ctx.fillRect(-60, -60, FIELD.width + 120, FIELD.height + 120);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `bold 74px ${FONT}`;
    ctx.shadowColor = 'rgba(255, 92, 92, 0.8)';
    ctx.shadowBlur = 30;
    ctx.fillText('THE LIGHT WENT OUT', FIELD.width / 2, 218);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `22px ${FONT}`;
    ctx.fillText('The core fell dark — but wardens fly again.', FIELD.width / 2, 292);

    drawPanel(FIELD.width / 2 - 250, 330, 500, 150);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 368);
    ctx.font = `19px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Wave ${state.wave}  •  ${state.kills} shards broken  •  ${state.motesGot} motes gathered`, FIELD.width / 2, 412);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText(`BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 450);

    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 548);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawWin(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 6, 0.55)';
    ctx.fillRect(-60, -60, FIELD.width + 120, FIELD.height + 120);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 74px ${FONT}`;
    ctx.shadowColor = 'rgba(255, 209, 102, 0.9)';
    ctx.shadowBlur = 30;
    ctx.fillText('THE CORE ENDURES', FIELD.width / 2, 218);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `22px ${FONT}`;
    ctx.fillText('Ten waves broken against your watch. The light holds.', FIELD.width / 2, 292);

    drawPanel(FIELD.width / 2 - 250, 330, 500, 150);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 368);
    ctx.font = `19px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${state.kills} shards broken  •  ${state.motesGot} motes gathered`, FIELD.width / 2, 412);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText(`BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 450);

    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText('PRESS C TO KEEP FLYING — ENDLESS MODE', FIELD.width / 2, 540);
    ctx.fillText('PRESS R TO START OVER', FIELD.width / 2, 578);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  return {
    draw(state, screen, best, muted) {
      fit();
      ctx.save();
      // Screen shake on core hits.
      if (state.shake > 0) {
        const mag = state.shake;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }
      drawBackground(state);
      drawCore(state);
      drawMotes(state);
      drawPowerups(state);
      drawBullets(state);
      drawShards(state);
      drawShip(state);
      drawParticles(state);
      drawPopups(state);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_WIN || screen === SCREEN_OVER) {
        drawHud(state, screen, muted);
      }
      // Red flash on a core hit.
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 60, 60, ${state.flash * 0.35})`;
        ctx.fillRect(-60, -60, FIELD.width + 120, FIELD.height + 120);
      }
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);
      ctx.restore();
    },
  };
}
