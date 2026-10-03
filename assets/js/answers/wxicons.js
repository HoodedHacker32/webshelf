// Weather condition icons, drawn for Webshelf. Colours come from tokens.css.

const sun = (cx, cy, r) => {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 5); const y1 = cy + Math.sin(a) * (r + 5);
    const x2 = cx + Math.cos(a) * (r + 10); const y2 = cy + Math.sin(a) * (r + 10);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');
  return `<g class="wx-sun"><circle cx="${cx}" cy="${cy}" r="${r}"/><g class="wx-rays">${rays}</g></g>`;
};

const moon = (cx, cy, r) => `<path class="wx-moon" d="M${cx + r * 0.35} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.65} ${r * 1.55}A${r * 0.8} ${r * 0.8} 0 0 1 ${cx + r * 0.35} ${cy - r}z"/>`;

const cloud = (dx = 0, dy = 0, cls = 'wx-cloud') => `<g class="${cls}" transform="translate(${dx} ${dy})">
  <circle cx="24" cy="38" r="9"/><circle cx="34" cy="31" r="12"/><circle cx="45" cy="38" r="8"/>
  <rect x="22" y="36" width="25" height="11" rx="5"/></g>`;

const drops = (cls, lines) => `<g class="${cls}">${lines}</g>`;

const ICONS = {
  sun: sun(32, 32, 11),
  moon: moon(30, 32, 13),
  partly: sun(23, 23, 8) + cloud(2, 4),
  partlyNight: moon(22, 22, 9) + cloud(2, 4),
  cloud: cloud(-3, -4),
  fog: drops('wx-fog', '<line x1="14" y1="24" x2="50" y2="24"/><line x1="10" y1="33" x2="54" y2="33"/><line x1="16" y1="42" x2="48" y2="42"/>'),
  drizzle: cloud(-3, -8) + drops('wx-rain', '<line x1="24" y1="46" x2="23" y2="50"/><line x1="33" y1="46" x2="32" y2="50"/><line x1="42" y1="46" x2="41" y2="50"/>'),
  rain: cloud(-3, -8, 'wx-cloud is-dark') + drops('wx-rain', '<line x1="24" y1="44" x2="21" y2="54"/><line x1="33" y1="44" x2="30" y2="54"/><line x1="42" y1="44" x2="39" y2="54"/>'),
  snow: cloud(-3, -8) + drops('wx-snow', '<circle cx="23" cy="48" r="2.4"/><circle cx="33" cy="52" r="2.4"/><circle cx="43" cy="48" r="2.4"/>'),
  storm: cloud(-3, -8, 'wx-cloud is-dark') + '<path class="wx-bolt" d="M33 41l-7 11h6l-3 9 10-13h-6l4-7z"/>',
};

// WMO weather interpretation codes, as used by Open-Meteo.
const CODES = {
  0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'partly'], 3: ['Cloudy', 'cloud'],
  45: ['Fog', 'fog'], 48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'drizzle'], 53: ['Drizzle', 'drizzle'], 55: ['Heavy drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'drizzle'], 57: ['Freezing drizzle', 'drizzle'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Light showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'], 86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm with hail', 'storm'], 99: ['Thunderstorm with hail', 'storm'],
};

export function describe(code, isDay = true) {
  const [text, kind] = CODES[code] ?? ['Unknown', 'cloud'];
  let k = kind;
  if (!isDay && kind === 'sun') { k = 'moon'; }
  if (!isDay && kind === 'partly') { k = 'partlyNight'; }
  return { text: !isDay && code <= 1 ? (code === 0 ? 'Clear' : 'Mostly clear') : text, kind: k };
}

export function wxIcon(kind, size = 64, label = '') {
  return `<svg class="wx-icon" width="${size}" height="${size}" viewBox="0 0 64 64" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${ICONS[kind] ?? ICONS.cloud}</svg>`;
}
