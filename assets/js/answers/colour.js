// Colour picker: saturation/value square, hue slider, and editable
// HEX / RGB / CMYK / HSV / HSL fields that all stay in sync.

import { h, svg } from '../dom.js';
import { icon } from '../icons.js';

/* Colour maths ------------------------------------------------------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function hsvToRgb(hh, s, v) {
  const f = (n) => {
    const k = (n + hh / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
}

function rgbToHsv(r, g, b) {
  [r, g, b] = [r, g, b].map((x) => x / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  let hh = 0;
  if (d) {
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60;
    if (hh < 0) hh += 360;
  }
  return [hh, max ? d / max : 0, max];
}

function rgbToHsl(r, g, b) {
  const [hh, s, v] = rgbToHsv(r, g, b);
  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return [hh, sl, l];
}

function hslToRgb(hh, s, l) {
  const v = l + s * Math.min(l, 1 - l);
  return hsvToRgb(hh, v ? 2 * (1 - l / v) : 0, v);
}

function rgbToCmyk(r, g, b) {
  const [rr, gg, bb] = [r, g, b].map((x) => x / 255);
  const k = 1 - Math.max(rr, gg, bb);
  if (k === 1) return [0, 0, 0, 100];
  return [rr, gg, bb].map((x) => Math.round(((1 - x - k) / (1 - k)) * 100)).concat(Math.round(k * 100));
}

function cmykToRgb(c, m, y, k) {
  return [c, m, y].map((x) => Math.round(255 * (1 - x / 100) * (1 - k / 100)));
}

const toHex = (rgb) => `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const nums = (s) => (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);

export function parseColour(text) {
  const t = text.trim().toLowerCase();
  let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (m) {
    const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  m = /^rgb\s*\(?(.+?)\)?$/.exec(t);
  if (m) { const n = nums(m[1]); if (n.length === 3 && n.every((x) => x >= 0 && x <= 255)) return n.map(Math.round); }
  m = /^hsl\s*\(?(.+?)\)?$/.exec(t);
  if (m) { const n = nums(m[1]); if (n.length === 3) return hslToRgb(((n[0] % 360) + 360) % 360, clamp(n[1], 0, 100) / 100, clamp(n[2], 0, 100) / 100); }
  m = /^hsv\s*\(?(.+?)\)?$/.exec(t);
  if (m) { const n = nums(m[1]); if (n.length === 3) return hsvToRgb(((n[0] % 360) + 360) % 360, clamp(n[1], 0, 100) / 100, clamp(n[2], 0, 100) / 100); }
  m = /^cmyk\s*\(?(.+?)\)?$/.exec(t);
  if (m) { const n = nums(m[1]); if (n.length === 4) return cmykToRgb(...n.map((x) => clamp(x, 0, 100))); }
  return null;
}

/* Matching ----------------------------------------------------------- */

export function match(query) {
  const q = query.trim().toLowerCase();
  if (/^(colou?r picker|colou?r selector|hex colou?r( picker)?|rgb colou?r( picker)?|colou?r wheel|rgb to hex|hex to rgb|pick a colou?r)$/.test(q)) return { rgb: [66, 133, 244] };
  const rgb = /^(#[0-9a-f]{6}|#[0-9a-f]{3}|(rgb|hsl|hsv|cmyk)\s*\(.+\))$/.test(q) ? parseColour(q) : null;
  return rgb ? { rgb } : null;
}

/* Card --------------------------------------------------------------- */

export function render({ rgb }) {
  let [hue, sat, val] = rgbToHsv(...rgb);

  const square = h('div', { class: 'cp-square', role: 'slider', tabindex: '0', 'aria-label': 'Saturation and brightness' });
  const handle = h('div', { class: 'cp-handle' });
  square.append(handle);
  const swatch = h('div', { class: 'cp-swatch' });
  const hueIn = h('input', { class: 'cp-hue', type: 'range', min: '0', max: '359', step: '1', 'aria-label': 'Hue' });

  const field = (label, width) => {
    const input = h('input', { class: 'field cp-input num', type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': label });
    const wrap = h('label', { class: `cp-field${width ? ` ${width}` : ''}` }, h('span', { class: 'cp-label' }, label.split(' ')[0]), input);
    return { input, wrap };
  };
  const hex = field('HEX colour value', 'is-wide');
  const fRgb = field('RGB colour value');
  const fCmyk = field('CMYK colour value');
  const fHsv = field('HSV colour value');
  const fHsl = field('HSL colour value');
  const copy = h('button', { class: 'icon-btn cp-copy', type: 'button', 'aria-label': 'Copy HEX value', title: 'Copy' }, svg(icon('copy', 'icon-20')));
  const copied = h('span', { class: 'cp-copied', role: 'status' });

  const paint = (skip) => {
    const rgbNow = hsvToRgb(hue, sat, val);
    const hsl = rgbToHsl(...rgbNow);
    square.style.setProperty('--cp-hue', `hsl(${hue} 100% 50%)`);
    swatch.style.background = toHex(rgbNow);
    handle.style.left = `${sat * 100}%`;
    handle.style.top = `${(1 - val) * 100}%`;
    handle.style.background = toHex(rgbNow);
    square.setAttribute('aria-valuetext', `Saturation ${Math.round(sat * 100)}%, brightness ${Math.round(val * 100)}%`);
    if (skip !== hueIn) hueIn.value = String(Math.round(hue));
    const set = (f, v) => { if (f.input !== skip) f.input.value = v; };
    set(hex, toHex(rgbNow));
    set(fRgb, rgbNow.join(', '));
    set(fCmyk, rgbToCmyk(...rgbNow).map((x) => `${x}%`).join(', '));
    set(fHsv, `${Math.round(hue)}°, ${Math.round(sat * 100)}%, ${Math.round(val * 100)}%`);
    set(fHsl, `${Math.round(hsl[0])}°, ${Math.round(hsl[1] * 100)}%, ${Math.round(hsl[2] * 100)}%`);
  };

  const fromPointer = (e) => {
    const r = square.getBoundingClientRect();
    sat = clamp((e.clientX - r.left) / r.width, 0, 1);
    val = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    paint();
  };
  square.addEventListener('pointerdown', (e) => {
    square.setPointerCapture(e.pointerId);
    fromPointer(e);
    square.focus();
  });
  square.addEventListener('pointermove', (e) => { if (square.hasPointerCapture(e.pointerId)) fromPointer(e); });
  square.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (!moves[e.key]) return;
    e.preventDefault();
    sat = clamp(sat + moves[e.key][0], 0, 1);
    val = clamp(val + moves[e.key][1], 0, 1);
    paint();
  });
  hueIn.addEventListener('input', () => { hue = Number(hueIn.value); paint(hueIn); });

  const bind = (f, prefix) => f.input.addEventListener('input', () => {
    const v = f.input.value.trim();
    const parsed = parseColour(prefix ? `${prefix}(${v.replace(/[°%]/g, '')})` : v);
    f.input.toggleAttribute('aria-invalid', !parsed);
    if (!parsed) return;
    const [nh, ns, nv] = rgbToHsv(...parsed);
    if (ns && nv) hue = nh;
    sat = ns; val = nv;
    paint(f.input);
  });
  bind(hex, null); bind(fRgb, 'rgb'); bind(fCmyk, 'cmyk'); bind(fHsv, 'hsv'); bind(fHsl, 'hsl');
  for (const f of [hex, fRgb, fCmyk, fHsv, fHsl]) f.input.addEventListener('blur', () => { f.input.removeAttribute('aria-invalid'); paint(); });

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(hex.input.value);
      copied.textContent = 'Copied';
    } catch {
      hex.input.select();
      copied.textContent = 'Press Ctrl+C to copy';
    }
    setTimeout(() => { copied.textContent = ''; }, 1600);
  });

  paint();
  hex.wrap.append(copy);

  return h('section', { class: 'answer answer-card cp', 'aria-label': 'Colour picker' },
    h('h2', { class: 'answer-title answer-title-pad' }, 'Colour picker'),
    h('div', { class: 'cp-top' }, square, swatch),
    h('div', { class: 'cp-body' },
      hueIn,
      h('div', { class: 'cp-hexrow' }, hex.wrap, copied),
      h('div', { class: 'cp-grid' }, fRgb.wrap, fCmyk.wrap, fHsv.wrap, fHsl.wrap)));
}
