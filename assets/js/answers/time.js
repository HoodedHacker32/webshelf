// Time in a place: big clock, date and UTC offset. Places resolve through
// Open-Meteo's geocoder, which returns each place's time zone.

import { h } from '../dom.js';
import { geocode } from './geo.js';

export function match(query) {
  const q = query.trim().toLowerCase().replace(/[?!.]+$/, '');
  if (/^(time|current time|what time is it|what's the time|what is the time|local time|time now)$/.test(q)) return { place: '' };
  const m = /^(?:what(?:'s| is)? the |current |local )?time(?: is it)?(?: now)? (?:in|at) (.+)$/.exec(q)
    || /^what time is it (?:in|at) (.+)$/.exec(q)
    || /^(.+?) (?:local )?time(?: now)?$/.exec(q);
  if (!m) return null;
  const place = m[1].trim();
  if (!place || /\b(zone|zones|table|travel|machine|series|signature|complexity|limit|lord|management)\b/.test(place)) return null;
  return { place };
}

export async function render({ place }, { signal }) {
  let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let name = 'your location';
  if (place) {
    const where = await geocode(place, { signal });
    if (!where?.tz) return null;
    tz = where.tz;
    name = where.name;
  }

  const clock = h('p', { class: 'time-big num' });
  const date = h('p', { class: 'time-date' });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz });
  const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
  const offsetFmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' });

  const tick = () => {
    const now = new Date();
    clock.textContent = timeFmt.format(now);
    const offset = offsetFmt.formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? '';
    date.textContent = `${dateFmt.format(now)} (${offset})`;
  };
  tick();
  let shown = false;
  const timer = setInterval(() => {
    if (clock.isConnected) shown = true;
    else if (shown) { clearInterval(timer); return; }
    tick();
  }, 1000);

  return h('section', { class: 'answer time', 'aria-label': `Time in ${name}` },
    clock, date, h('p', { class: 'time-where' }, `Time in ${name}`));
}
