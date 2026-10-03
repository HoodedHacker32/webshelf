// A small SVG line chart with gridlines and a hover/keyboard readout.

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

function niceTicks(min, max, count = 3) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(parseFloat(v.toPrecision(10)));
  return ticks;
}

export function lineChart(points, { height = 150, width = 320, label = '', tone = 'positive', xFormat, tipFormat, baseline = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'chart';
  if (points.length < 2) {
    wrap.textContent = 'Not enough data for a chart.';
    return wrap;
  }

  const padL = 44; const padR = 8; const padT = 22; const padB = 22;
  const ys = points.map((p) => p.y).concat(baseline ? [baseline.y] : []);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0]; const yMax = ticks.at(-1);
  const x0 = points[0].x.getTime(); const x1 = points.at(-1).x.getTime();
  const sx = (t) => padL + ((t - x0) / (x1 - x0 || 1)) * (width - padL - padR);
  const sy = (v) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (height - padT - padB);

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`, class: `chart-svg is-${tone}`, role: 'img', tabindex: '0',
    'aria-label': `${label}. From ${tipFormat(points[0])} to ${tipFormat(points.at(-1))}. Use the arrow keys to read values.`,
  });

  for (const t of ticks) {
    svg.append(el('line', { x1: padL, x2: width - padR, y1: sy(t), y2: sy(t), class: 'chart-grid' }));
    const txt = el('text', { x: padL - 6, y: sy(t) + 4, class: 'chart-axis', 'text-anchor': 'end' });
    txt.textContent = t.toLocaleString(undefined, { maximumFractionDigits: 4 });
    svg.append(txt);
  }

  if (xFormat) {
    for (const p of [points[0], points.at(-1)]) {
      const t = el('text', { x: sx(p.x.getTime()), y: height - 6, class: 'chart-axis', 'text-anchor': p === points[0] ? 'start' : 'end' });
      t.textContent = xFormat(p.x);
      svg.append(t);
    }
  }

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x.getTime()).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const base = sy(yMin);
  svg.append(el('path', { d: `${d}L${sx(x1)},${base}L${sx(x0)},${base}Z`, class: 'chart-area' }));
  svg.append(el('path', { d, class: 'chart-line' }));

  // A reference level, such as the previous close, as a dashed rule.
  if (baseline) {
    svg.append(el('line', { x1: padL, x2: width - padR, y1: sy(baseline.y), y2: sy(baseline.y), class: 'chart-baseline' }));
    const t = el('text', { x: width - padR, y: sy(baseline.y) - 4, class: 'chart-axis', 'text-anchor': 'end' });
    t.textContent = `${baseline.label} ${baseline.y.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    svg.append(t);
  }

  const cursor = el('line', { y1: padT - 4, y2: height - padB, class: 'chart-cursor', visibility: 'hidden' });
  const dot = el('circle', { r: 4, class: 'chart-dot', visibility: 'hidden' });
  const tip = el('text', { y: 12, class: 'chart-tip', visibility: 'hidden' });
  svg.append(cursor, dot, tip);

  let index = points.length - 1;
  const show = (i) => {
    index = Math.max(0, Math.min(points.length - 1, i));
    const p = points[index];
    const x = sx(p.x.getTime());
    for (const n of [cursor, dot, tip]) n.setAttribute('visibility', 'visible');
    cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
    dot.setAttribute('cx', x); dot.setAttribute('cy', sy(p.y));
    tip.textContent = tipFormat(p);
    const anchor = x < width * 0.3 ? 'start' : x > width * 0.7 ? 'end' : 'middle';
    tip.setAttribute('text-anchor', anchor);
    tip.setAttribute('x', anchor === 'start' ? Math.max(x, padL) : anchor === 'end' ? Math.min(x, width - padR) : x);
  };
  const hide = () => { for (const n of [cursor, dot, tip]) n.setAttribute('visibility', 'hidden'); };

  svg.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * width;
    const t = x0 + ((x - padL) / (width - padL - padR)) * (x1 - x0);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x.getTime() - t) < Math.abs(points[best].x.getTime() - t)) best = i;
    }
    show(best);
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('focus', () => show(index));
  svg.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + step); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(points.length - 1); }
  });

  wrap.append(svg);
  return wrap;
}
