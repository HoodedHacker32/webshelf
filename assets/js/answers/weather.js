// Weather card: current conditions, an hourly chart and an 8-day strip.
// Forecasts come from Open-Meteo (free, keyless, CORS-enabled).

import { h, svg, getJSON } from '../dom.js';
import { icon } from '../icons.js';
import { tempUnit } from '../store.js';
import { geocode, homeLocation, saveHome, locateMe } from './geo.js';
import { describe, wxIcon } from './wxicons.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function match(query) {
  let q = query.trim().toLowerCase().replace(/[?!.]+$/, '');
  if (!/\b(weather|forecast)\b/.test(q) && !/^(will it|is it going to) (rain|snow)\b/.test(q)) return null;
  let day = null;
  q = q.replace(/\b(today|tonight|now)\b/, () => { day = 0; return ''; });
  q = q.replace(/\btomorrow\b/, () => { day = 1; return ''; });
  q = q.replace(new RegExp(`\\b(on\\s+)?(${DAYS.join('|')})\\b`), (_, __, d) => { day = d; return ''; });
  const place = q
    .replace(/^(will it|is it going to) (rain|snow)/, '')
    .replace(/\b(the\s+)?(weather|forecast)\b/g, '')
    .replace(/\b(what'?s|what is|how is|how's|in|for|at|near me|like|this week|10 day|7 day|local)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { place, day };
}

// Display helpers (data is fetched in metric and converted here).
const temp = (c, unit) => Math.round(unit === 'f' ? (c * 9) / 5 + 32 : c);
const wind = (kmh, unit) => (unit === 'f' ? `${Math.round(kmh / 1.609344)} mph` : `${Math.round(kmh)} km/h`);
const hourLabel = (iso) => {
  const hr = Number(iso.slice(11, 13));
  const text = new Date(Date.UTC(2000, 0, 1, hr)).toLocaleTimeString(undefined, { hour: 'numeric', timeZone: 'UTC' });
  return /^\d+$/.test(text) ? `${text.padStart(2, '0')}:00` : text; // 24-hour locales
};
const dayDate = (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const weekday = (iso, style = 'short') => dayDate(iso).toLocaleDateString(undefined, { weekday: style, timeZone: 'UTC' });

async function forecast(place, signal) {
  const params = new URLSearchParams({
    latitude: place.lat, longitude: place.lon, timezone: 'auto', forecast_days: 8,
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });
  return getJSON(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
}

export async function render({ place, day }, ctx) {
  let where = null;
  if (place) {
    where = await geocode(place, ctx);
    if (!where) return null; // not a place; let the results speak for themselves
  } else {
    where = homeLocation();
  }
  if (!where) return askLocation(day, ctx);
  return card(where, day, ctx);
}

function askLocation(day, ctx) {
  const input = h('input', { class: 'field', type: 'text', placeholder: 'City or town', 'aria-label': 'City or town', autocomplete: 'address-level2' });
  const status = h('p', { class: 'answer-note', role: 'status' });
  const section = h('section', { class: 'answer answer-card wx-ask', 'aria-label': 'Weather' });

  const use = async (place) => {
    saveHome(place);
    const next = await card(place, day, ctx);
    section.replaceWith(next);
  };

  const form = h('form', { class: 'wx-ask-form' }, input,
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Show weather'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    status.textContent = 'Finding that place…';
    try {
      const place = await geocode(input.value.trim(), ctx);
      if (!place) { status.textContent = `No place called “${input.value.trim()}” was found. Check the spelling or try a nearby city.`; return; }
      await use(place);
    } catch {
      status.textContent = 'The weather service couldn’t be reached. Try again in a moment.';
    }
  });

  const locate = h('button', { class: 'btn', type: 'button' }, svg(icon('myLocation', 'icon-18')), 'Use my location');
  locate.addEventListener('click', async () => {
    status.textContent = 'Asking your browser for your location…';
    try { await use(await locateMe()); } catch (err) { status.textContent = err.message; }
  });

  section.append(
    h('h2', { class: 'answer-title' }, 'Weather'),
    h('p', { class: 'wx-ask-copy' }, 'Where are you? Your location stays in this browser and is only sent to Open-Meteo to fetch the forecast.'),
    form,
    h('div', { class: 'wx-ask-alt' }, locate),
    status,
  );
  return section;
}

async function card(where, wantDay, { signal }) {
  const data = await forecast(where, signal);
  const unitRef = { u: tempUnit() };
  const daily = data.daily;
  const hourly = data.hourly;
  const nowIso = data.current.time;

  let selected = 0;
  if (typeof wantDay === 'number') selected = Math.min(wantDay, daily.time.length - 1);
  else if (typeof wantDay === 'string') {
    const target = DAYS.indexOf(wantDay);
    const idx = daily.time.findIndex((t) => dayDate(t).getUTCDay() === target);
    selected = idx >= 0 ? idx : 0;
  }
  let tab = 'temp';

  const nameLine = h('p', { class: 'wx-where' },
    'Weather for ', h('strong', null, where.name), ' · ', h('a', { href: 'settings.html#location' }, 'Change location'));

  const iconBox = h('div', { class: 'wx-now-icon' });
  const tempBig = h('span', { class: 'wx-temp num' });
  const unitC = h('button', { class: 'wx-unit', type: 'button', 'aria-label': 'Show Celsius' }, '°C');
  const unitF = h('button', { class: 'wx-unit', type: 'button', 'aria-label': 'Show Fahrenheit' }, '°F');
  const stats = h('dl', { class: 'wx-stats' });
  const headDay = h('p', { class: 'wx-day' });
  const headDesc = h('p', { class: 'wx-desc' });
  const tabs = h('div', { class: 'wx-tabs', role: 'tablist', 'aria-label': 'Hourly forecast' });
  const chart = h('div', { class: 'wx-chart', role: 'tabpanel', tabindex: '0' });
  const strip = h('div', { class: 'wx-days', role: 'radiogroup', 'aria-label': 'Day' });

  const hoursFor = (i) => {
    const date = daily.time[i];
    let idx = hourly.time.map((t, k) => (t.startsWith(date) ? k : -1)).filter((k) => k >= 0);
    if (i === 0) idx = idx.filter((k) => hourly.time[k].slice(11, 13) >= nowIso.slice(11, 13)).concat(
      hourly.time.map((t, k) => (t.startsWith(daily.time[1]) ? k : -1)).filter((k) => k >= 0)).slice(0, 24);
    return idx.filter((_, n) => n % 3 === 0).slice(0, 8);
  };

  const noonIndex = (i) => hourly.time.findIndex((t) => t === `${daily.time[i]}T12:00`);

  const draw = () => {
    const u = unitRef.u;
    let codeV; let isDay; let t; let precip; let humidity; let windV; let label;
    if (selected === 0) {
      const c = data.current;
      const hi = hourly.time.findIndex((x) => x.slice(0, 13) === nowIso.slice(0, 13));
      codeV = c.weather_code; isDay = Boolean(c.is_day); t = c.temperature_2m;
      precip = hourly.precipitation_probability[hi] ?? daily.precipitation_probability_max[0];
      humidity = c.relative_humidity_2m; windV = c.wind_speed_10m;
      label = `${weekday(nowIso, 'long')} ${new Date(Date.UTC(2000, 0, 1, Number(nowIso.slice(11, 13)), Number(nowIso.slice(14, 16)))).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })}`;
    } else {
      const k = noonIndex(selected);
      codeV = daily.weather_code[selected]; isDay = true; t = hourly.temperature_2m[k] ?? daily.temperature_2m_max[selected];
      precip = daily.precipitation_probability_max[selected]; humidity = hourly.relative_humidity_2m[k]; windV = hourly.wind_speed_10m[k];
      label = weekday(daily.time[selected], 'long');
    }
    const d = describe(codeV, isDay);
    iconBox.innerHTML = wxIcon(d.kind, 64, d.text);
    tempBig.textContent = String(temp(t, u));
    unitC.classList.toggle('is-on', u === 'c'); unitC.setAttribute('aria-pressed', String(u === 'c'));
    unitF.classList.toggle('is-on', u === 'f'); unitF.setAttribute('aria-pressed', String(u === 'f'));
    stats.replaceChildren(
      h('div', null, h('dt', null, 'Precipitation:'), h('dd', { class: 'num' }, `${precip ?? 0}%`)),
      h('div', null, h('dt', null, 'Humidity:'), h('dd', { class: 'num' }, humidity == null ? '–' : `${humidity}%`)),
      h('div', null, h('dt', null, 'Wind:'), h('dd', { class: 'num' }, windV == null ? '–' : wind(windV, u))),
    );
    headDay.textContent = label;
    headDesc.textContent = d.text;

    [...tabs.children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    chart.replaceChildren(hourlyChart(hoursFor(selected), tab, u, hourly));

    [...strip.children].forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === selected));
      b.tabIndex = i === selected ? 0 : -1;
      b.querySelector('.wx-hi').textContent = `${temp(daily.temperature_2m_max[i], u)}°`;
      b.querySelector('.wx-lo').textContent = `${temp(daily.temperature_2m_min[i], u)}°`;
    });
  };

  for (const [id, text] of [['temp', 'Temperature'], ['precip', 'Precipitation'], ['wind', 'Wind']]) {
    const b = h('button', { class: 'wx-tab', type: 'button', role: 'tab', 'data-tab': id }, text);
    b.addEventListener('click', () => { tab = id; draw(); });
    tabs.append(b);
  }

  daily.time.forEach((iso, i) => {
    const d = describe(daily.weather_code[i], true);
    const b = h('button', {
      class: 'wx-dayitem', type: 'button', role: 'radio',
      'aria-label': `${weekday(iso, 'long')}: ${d.text}`,
    },
    h('span', { class: 'wx-dayname' }, i === 0 ? weekday(iso) : weekday(iso)),
    svg(wxIcon(d.kind, 48)),
    h('span', { class: 'wx-range num' }, h('span', { class: 'wx-hi' }), ' ', h('span', { class: 'wx-lo' })));
    b.addEventListener('click', () => { selected = i; draw(); });
    b.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      selected = (selected + step + daily.time.length) % daily.time.length;
      draw();
      strip.children[selected].focus();
    });
    strip.append(b);
  });

  unitC.addEventListener('click', () => { unitRef.u = 'c'; draw(); });
  unitF.addEventListener('click', () => { unitRef.u = 'f'; draw(); });

  draw();

  return h('div', { class: 'answer wx-wrap' },
    nameLine,
    h('section', { class: 'answer-card wx', 'aria-label': `Weather for ${where.name}` },
      h('div', { class: 'wx-head' },
        h('div', { class: 'wx-now' },
          iconBox,
          h('div', { class: 'wx-tempbox' }, tempBig, h('span', { class: 'wx-units' }, unitC, h('span', { class: 'wx-sep', 'aria-hidden': 'true' }, '|'), unitF)),
          stats),
        h('div', { class: 'wx-label' }, h('h2', { class: 'wx-title' }, 'Weather'), headDay, headDesc)),
      tabs,
      chart,
      strip,
      h('p', { class: 'answer-source' }, 'Forecast from ', h('a', { href: 'https://open-meteo.com/' }, 'Open-Meteo'), ' (CC BY 4.0)')));
}

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

function hourlyChart(idx, tab, u, hourly) {
  const W = 620; const H = 96; const top = 26; const bottom = 76;
  const step = W / idx.length;
  const xs = idx.map((_, i) => step * i + step / 2);
  const root = s('svg', { viewBox: `0 0 ${W} ${H}`, class: `wx-svg is-${tab}`, role: 'img' });
  const labels = [];

  if (tab === 'temp') {
    const vals = idx.map((k) => temp(hourly.temperature_2m[k], u));
    const lo = Math.min(...vals); const hi = Math.max(...vals);
    const y = (v) => bottom - 8 - ((v - lo) / (hi - lo || 1)) * (bottom - top - 24);
    const pts = xs.map((x, i) => [x, y(vals[i])]);
    const line = [[0, pts[0][1]], ...pts, [W, pts.at(-1)[1]]].map(([x, yv], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yv.toFixed(1)}`).join('');
    root.append(s('path', { d: `${line}L${W},${bottom}L0,${bottom}Z`, class: 'wx-area' }), s('path', { d: line, class: 'wx-line' }));
    pts.forEach(([x, yv], i) => root.append(s('text', { x, y: yv - 8, class: 'wx-val', 'text-anchor': 'middle' }, String(vals[i]))));
    labels.push(...vals.map((v, i) => `${hourLabel(hourly.time[idx[i]])} ${v}°`));
  } else if (tab === 'precip') {
    idx.forEach((k, i) => {
      const p = hourly.precipitation_probability[k] ?? 0;
      const hgt = Math.max(2, (p / 100) * (bottom - top - 12));
      root.append(s('rect', { x: xs[i] - step * 0.35, y: bottom - hgt, width: step * 0.7, height: hgt, class: 'wx-bar' }));
      root.append(s('text', { x: xs[i], y: bottom - hgt - 6, class: 'wx-val', 'text-anchor': 'middle' }, `${p}%`));
      labels.push(`${hourLabel(hourly.time[k])} ${p}%`);
    });
  } else {
    idx.forEach((k, i) => {
      const v = hourly.wind_speed_10m[k];
      const dir = hourly.wind_direction_10m[k] ?? 0;
      const g = s('g', { transform: `translate(${xs[i]} ${bottom - 22}) rotate(${dir + 180})`, class: 'wx-arrow' });
      g.append(s('path', { d: 'M0,-9 L5,4 L0,1 L-5,4 Z' }));
      root.append(g, s('text', { x: xs[i], y: bottom - 44, class: 'wx-val', 'text-anchor': 'middle' }, wind(v, u)));
      labels.push(`${hourLabel(hourly.time[k])} ${wind(v, u)}`);
    });
  }

  idx.forEach((k, i) => root.append(s('text', { x: xs[i], y: H - 4, class: 'wx-hour', 'text-anchor': 'middle' }, hourLabel(hourly.time[k]))));
  root.setAttribute('aria-label', labels.join(', '));
  return root;
}
