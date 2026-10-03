// Timer and stopwatch, in one tabbed card.

import { h, svg } from '../dom.js';
import { icon } from '../icons.js';

export function match(query) {
  const q = query.trim().toLowerCase().replace(/[?!.]+$/, '');
  if (/^(stopwatch|stop watch|online stopwatch|start stopwatch)$/.test(q)) return { mode: 'stopwatch', seconds: 0 };
  if (!/\b(timer|countdown|count down)\b/.test(q)) return null;
  if (/^(timer|countdown|online timer|set (a )?timer|start (a )?timer|countdown timer)$/.test(q)) return { mode: 'timer', seconds: 300 };
  let seconds = 0;
  const units = { h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, s: 1, sec: 1, secs: 1, second: 1, seconds: 1 };
  const re = /(\d+(?:\.\d+)?)\s*-?\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g;
  let m;
  while ((m = re.exec(q))) seconds += parseFloat(m[1]) * units[m[2]];
  if (!seconds) {
    const bare = /\b(\d+)\b/.exec(q);
    if (bare) seconds = Number(bare[1]) * 60;
  }
  if (!seconds) return null;
  return { mode: 'timer', seconds: Math.min(Math.round(seconds), 99 * 3600 + 59 * 60 + 59) };
}

const pad = (n) => String(n).padStart(2, '0');

function beep(ctx) {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t + i * 0.3);
    g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.3 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.3 + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t + i * 0.3);
    o.stop(t + i * 0.3 + 0.22);
  }
}

export function render({ mode, seconds }) {
  const tabs = h('div', { class: 'tm-tabs', role: 'tablist', 'aria-label': 'Timer or stopwatch' });
  const panels = h('div', { class: 'tm-panels' });
  const timerPanel = timer(seconds);
  const watchPanel = stopwatch();
  timerPanel.id = `tm-timer-${Math.random().toString(36).slice(2, 7)}`;
  watchPanel.id = `${timerPanel.id}-sw`;
  panels.append(timerPanel, watchPanel);

  const tabBtn = (id, label, ico, panel) => {
    const b = h('button', { class: 'tm-tab', type: 'button', role: 'tab', 'aria-controls': panel.id }, svg(icon(ico, 'icon-18')), label);
    b.addEventListener('click', () => select(id));
    b.dataset.id = id;
    return b;
  };
  tabs.append(tabBtn('timer', 'Timer', 'hourglass', timerPanel), tabBtn('stopwatch', 'Stopwatch', 'stopwatch', watchPanel));

  const select = (id) => {
    [...tabs.children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    timerPanel.hidden = id !== 'timer';
    watchPanel.hidden = id !== 'stopwatch';
  };
  select(mode);
  if (mode === 'stopwatch') watchPanel.start();

  return h('section', { class: 'answer answer-card tm', 'aria-label': 'Timer and stopwatch' }, tabs, panels);
}

function timer(initial) {
  let total = initial;      // configured length, seconds
  let left = initial * 1000; // remaining, ms
  let endAt = 0;
  let running = false;
  let ringing = false;
  let raf = 0;
  let sound = true;
  let audio = null;
  let ringTimer = 0;
  let editing = '';

  const display = h('button', { class: 'tm-display num', type: 'button', 'aria-label': 'Edit timer length' });
  const progress = h('div', { class: 'tm-progress' }, h('div', { class: 'tm-progress-bar' }));
  const start = h('button', { class: 'btn btn-primary btn-small tm-start', type: 'button' }, 'Start');
  const reset = h('button', { class: 'btn btn-outline btn-small', type: 'button' }, 'Reset');
  const mute = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Turn sound off', 'aria-pressed': 'true' }, svg(icon('volumeOn', 'icon-20')));
  const live = h('p', { class: 'visually-hidden', role: 'status' });

  const parts = (ms) => {
    const s = Math.ceil(ms / 1000);
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  };

  const paint = () => {
    let hh; let mm; let ss;
    if (editing !== '') {
      const d = editing.padStart(6, '0').slice(-6);
      [hh, mm, ss] = [Number(d.slice(0, 2)), Number(d.slice(2, 4)), Number(d.slice(4, 6))];
    } else {
      [hh, mm, ss] = parts(left);
    }
    const seg = (n, u) => [h('span', { class: 'tm-n' }, hh || u !== 'h' ? pad(n) : ''), h('span', { class: 'tm-u' }, u)];
    display.replaceChildren(
      ...(hh ? seg(hh, 'h') : []),
      ...(hh || mm ? [h('span', { class: 'tm-n' }, hh ? pad(mm) : String(mm)), h('span', { class: 'tm-u' }, 'm')] : []),
      h('span', { class: 'tm-n' }, hh || mm ? pad(ss) : String(ss)), h('span', { class: 'tm-u' }, 's'),
    );
    display.classList.toggle('is-editing', editing !== '');
    display.classList.toggle('is-ringing', ringing);
    progress.firstChild.style.transform = `scaleX(${total ? Math.max(0, left / (total * 1000)) : 0})`;
    start.textContent = ringing ? 'OK' : running ? 'Stop' : 'Start';
  };

  const frame = () => {
    left = Math.max(0, endAt - performance.now());
    if (left === 0) { running = false; ring(); }
    paint();
    if (running) raf = requestAnimationFrame(frame);
  };

  const ring = () => {
    ringing = true;
    live.textContent = 'Time’s up';
    if (sound) {
      try {
        audio ??= new AudioContext();
        beep(audio);
        ringTimer = setInterval(() => beep(audio), 1500);
      } catch { /* no audio available */ }
    }
  };

  const stopRing = () => {
    ringing = false;
    clearInterval(ringTimer);
    left = total * 1000;
  };

  const commitEdit = () => {
    if (editing === '') return;
    const d = editing.padStart(6, '0').slice(-6);
    total = Number(d.slice(0, 2)) * 3600 + Number(d.slice(2, 4)) * 60 + Number(d.slice(4, 6));
    left = total * 1000;
    editing = '';
  };

  start.addEventListener('click', () => {
    if (ringing) { stopRing(); paint(); return; }
    commitEdit();
    if (running) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (left > 0) {
      try { audio ??= new AudioContext(); } catch { /* sound optional */ }
      running = true;
      endAt = performance.now() + left;
      raf = requestAnimationFrame(frame);
    }
    paint();
  });

  reset.addEventListener('click', () => {
    running = false;
    cancelAnimationFrame(raf);
    stopRing();
    editing = '';
    paint();
  });

  mute.addEventListener('click', () => {
    sound = !sound;
    mute.setAttribute('aria-pressed', String(sound));
    mute.setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
    mute.replaceChildren(svg(icon(sound ? 'volumeOn' : 'volumeOff', 'icon-20')));
    if (!sound) clearInterval(ringTimer);
  });

  // Click the time, then type digits; they fill in from the right like the original.
  display.addEventListener('click', () => {
    if (running || ringing) return;
    const [hh, mm, ss] = parts(left);
    editing = `${hh ? pad(hh) : ''}${pad(mm)}${pad(ss)}`.replace(/^0+/, '') || '0';
    paint();
  });
  display.addEventListener('keydown', (e) => {
    if (editing === '') return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); editing = (editing === '0' ? '' : editing).concat(e.key).slice(-6); paint(); }
    else if (e.key === 'Backspace') { e.preventDefault(); editing = editing.slice(0, -1) || '0'; paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); commitEdit(); start.click(); }
    else if (e.key === 'Escape') { editing = ''; paint(); }
  });
  display.addEventListener('blur', () => { commitEdit(); paint(); });

  paint();
  return h('div', { class: 'tm-panel', role: 'tabpanel' }, display, progress,
    h('div', { class: 'tm-actions' }, start, reset, h('span', { class: 'tm-spacer' }), mute), live);
}

function stopwatch() {
  let elapsed = 0;
  let since = 0;
  let running = false;
  let raf = 0;
  const laps = [];

  const display = h('p', { class: 'tm-display num', 'aria-live': 'off' });
  const start = h('button', { class: 'btn btn-primary btn-small', type: 'button' }, 'Start');
  const lap = h('button', { class: 'btn btn-outline btn-small', type: 'button', disabled: true }, 'Lap');
  const reset = h('button', { class: 'btn btn-outline btn-small', type: 'button' }, 'Reset');
  const lapList = h('ol', { class: 'tm-laps num' });

  const now = () => (running ? elapsed + performance.now() - since : elapsed);
  const fmt = (ms) => {
    const cs = Math.floor(ms / 10) % 100;
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60;
    return { hh, mm, ss, cs };
  };
  const paint = () => {
    const { hh, mm, ss, cs } = fmt(now());
    display.replaceChildren(
      ...(hh ? [h('span', { class: 'tm-n' }, String(hh)), h('span', { class: 'tm-u' }, 'h')] : []),
      ...(hh || mm ? [h('span', { class: 'tm-n' }, hh ? pad(mm) : String(mm)), h('span', { class: 'tm-u' }, 'm')] : []),
      h('span', { class: 'tm-n' }, hh || mm ? pad(ss) : String(ss)), h('span', { class: 'tm-u' }, 's'),
      h('span', { class: 'tm-cs' }, pad(cs)),
    );
    start.textContent = running ? 'Stop' : 'Start';
    lap.disabled = !running;
  };
  const frame = () => { paint(); if (running) raf = requestAnimationFrame(frame); };

  const panel = h('div', { class: 'tm-panel', role: 'tabpanel' }, display, h('div', { class: 'tm-progress is-flat' }),
    h('div', { class: 'tm-actions' }, start, lap, reset), lapList);

  panel.start = () => {
    if (running) return;
    running = true;
    since = performance.now();
    raf = requestAnimationFrame(frame);
  };

  start.addEventListener('click', () => {
    if (running) {
      elapsed = now();
      running = false;
      cancelAnimationFrame(raf);
      paint();
    } else {
      panel.start();
    }
  });
  lap.addEventListener('click', () => {
    const t = now();
    const prev = laps.at(-1) ?? 0;
    laps.push(t);
    const f = fmt(t - prev);
    lapList.prepend(h('li', null, h('span', null, `Lap ${laps.length}`),
      h('span', null, `${f.hh ? `${f.hh}:${pad(f.mm)}` : f.mm}:${pad(f.ss)}.${pad(f.cs)}`)));
  });
  reset.addEventListener('click', () => {
    running = false;
    cancelAnimationFrame(raf);
    elapsed = 0;
    laps.length = 0;
    lapList.replaceChildren();
    paint();
  });

  paint();
  return panel;
}
