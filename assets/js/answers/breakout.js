// "atari breakout": the one easter egg Webshelf keeps. A small canvas Breakout.

import { h } from '../dom.js';

export function match(query) {
  return /^atari breakout$/i.test(query.trim()) ? {} : null;
}

export function render() {
  const canvas = h('canvas', { class: 'bo-canvas', role: 'img', 'aria-label': 'Breakout game. Move with the mouse or arrow keys; press Space or click to launch.' });
  const status = h('p', { class: 'bo-status num', role: 'status', 'aria-live': 'polite' });
  const card = h('section', { class: 'answer bo', 'aria-label': 'Atari Breakout', tabindex: '0' }, canvas, status);

  const css = getComputedStyle(document.documentElement);
  const tok = (name) => css.getPropertyValue(name).trim();
  const rows = [1, 2, 3, 4, 5, 6].map((n) => tok(`--egg-row-${n}`));
  const ink = tok('--ink'); const meta = tok('--meta'); const paddleInk = tok('--ink');
  const font = tok('--font-ui');

  const W = 640; const H = 420; const COLS = 10; const GAP = 4; const TOP = 56;
  const BW = (W - GAP * (COLS + 1)) / COLS; const BH = 16;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  let bricks; let ball; let paddle; let score = 0; let lives = 3; let level = 1;
  let state = 'ready'; // ready | playing | over | won
  let keys = { left: false, right: false };
  let raf = 0; let last = 0;

  const resetLevel = () => {
    bricks = [];
    rows.forEach((colour, r) => {
      for (let c = 0; c < COLS; c++) {
        bricks.push({ x: GAP + c * (BW + GAP), y: TOP + r * (BH + GAP), alive: true, colour, points: (rows.length - r) * 1 + 1 });
      }
    });
  };
  const resetBall = () => {
    paddle = paddle ?? { x: W / 2 - 45, w: 90 };
    const speed = 300 + (level - 1) * 40;
    ball = { x: paddle.x + paddle.w / 2, y: H - 34, r: 6, vx: speed * 0.6, vy: -speed * 0.8, stuck: true };
  };

  const say = () => {
    const msg = { ready: 'Press Space or click to launch', over: 'Game over · Press Space to play again', won: `Level ${level} cleared · Press Space to continue` }[state];
    status.textContent = `Score ${score} · Lives ${lives} · Level ${level}${msg ? ` · ${msg}` : ''}`;
  };

  const launch = () => {
    if (state === 'over') { score = 0; lives = 3; level = 1; resetLevel(); resetBall(); state = 'ready'; say(); draw(); return; }
    if (state === 'won') { level += 1; resetLevel(); resetBall(); state = 'ready'; say(); draw(); return; }
    if (state === 'ready') { ball.stuck = false; state = 'playing'; say(); last = performance.now(); raf = requestAnimationFrame(loop); }
  };

  const step = (dt) => {
    const pSpeed = 520;
    if (keys.left) paddle.x -= pSpeed * dt;
    if (keys.right) paddle.x += pSpeed * dt;
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
    if (ball.stuck) { ball.x = paddle.x + paddle.w / 2; return; }

    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -1; }
    if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }

    // Paddle: the hit position steers the bounce angle.
    const py = H - 24;
    if (ball.vy > 0 && ball.y + ball.r >= py && ball.y + ball.r <= py + 12 && ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const speed = Math.hypot(ball.vx, ball.vy) * 1.01;
      const angle = hit * (Math.PI / 3);
      ball.vx = speed * Math.sin(angle);
      ball.vy = -speed * Math.cos(angle);
      ball.y = py - ball.r;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + BW && ball.y + ball.r > b.y && ball.y - ball.r < b.y + BH) {
        b.alive = false;
        score += b.points;
        const fromSide = Math.min(Math.abs(ball.x - b.x), Math.abs(ball.x - (b.x + BW))) < Math.min(Math.abs(ball.y - b.y), Math.abs(ball.y - (b.y + BH)));
        if (fromSide) ball.vx *= -1; else ball.vy *= -1;
        say();
        break;
      }
    }

    if (bricks.every((b) => !b.alive)) { state = 'won'; say(); }
    if (ball.y - ball.r > H) {
      lives -= 1;
      if (lives <= 0) state = 'over';
      else { state = 'ready'; resetBall(); }
      say();
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.colour;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, BW, BH, 3); ctx.fill();
    }
    ctx.fillStyle = paddleInk;
    ctx.beginPath(); ctx.roundRect(paddle.x, H - 24, paddle.w, 10, 5); ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.font = `500 14px ${font}`;
    ctx.fillStyle = meta;
    ctx.textAlign = 'left'; ctx.fillText(`Score ${score}`, 8, 24);
    ctx.textAlign = 'right'; ctx.fillText(`Level ${level}`, W - 8, 24);
    const levelWidth = ctx.measureText(`Level ${level}`).width;
    for (let i = 0; i < lives; i++) {
      ctx.beginPath(); ctx.arc(W - 22 - levelWidth - i * 14, 19, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (state !== 'playing') {
      ctx.textAlign = 'center'; ctx.fillStyle = ink; ctx.font = `400 18px ${font}`;
      const line = { ready: 'Click or press Space to launch', over: `Game over · ${score} points`, won: 'Level cleared!' }[state];
      ctx.fillText(line, W / 2, H / 2 + 40);
    }
  };

  const loop = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    if (state === 'playing' && canvas.isConnected && !document.hidden) raf = requestAnimationFrame(loop);
    else if (state === 'playing') { state = 'ready'; ball.stuck = false; say(); }
  };

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    paddle.x = Math.max(0, Math.min(W - paddle.w, ((e.clientX - r.left) / r.width) * W - paddle.w / 2));
    if (state !== 'playing') { if (ball.stuck) ball.x = paddle.x + paddle.w / 2; draw(); }
  });
  canvas.addEventListener('click', () => { card.focus({ preventScroll: true }); launch(); });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); launch(); }
    if (state !== 'playing') { step(1 / 60); draw(); }
  });
  card.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  });

  resetLevel();
  resetBall();
  say();
  draw();
  return card;
}
