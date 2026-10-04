// Package and flight tracking, as Google had them: recognise a tracking or
// flight number and link to the carrier's own tracking page. (Live tracking
// data needs carrier accounts or paid APIs; the carriers' pages are free.)

import { h } from '../dom.js';

const PARCELS = [
  { re: /^1Z[0-9A-Z]{16}$/i, carrier: 'UPS', url: (n) => `https://www.ups.com/track?tracknum=${n}` },
  { re: /^[A-Z]{2}\d{9}IE$/i, carrier: 'An Post', url: (n) => `https://www.anpost.com/Post-Parcels/Track/History?item=${n}` },
  { re: /^[A-Z]{2}\d{9}GB$/i, carrier: 'Royal Mail', url: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}` },
  { re: /^(?:94|93|92|95)\d{20}$/, carrier: 'USPS', url: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { re: /^[A-Z]{2}\d{9}US$/i, carrier: 'USPS', url: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  // Only with the carrier named: plain digit runs are too common to guess.
  { re: /^(?:\d{12}|\d{15})$/, carrier: 'FedEx', named: /fedex/i, url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { re: /^\d{10}$/, carrier: 'DHL', named: /dhl/i, url: (n) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${n}` },
];
const AIRLINES = new Set(['AA', 'AC', 'AF', 'AS', 'AY', 'B6', 'BA', 'CX', 'DL', 'EI', 'EK', 'EY', 'FR', 'IB', 'JL', 'KL', 'LH', 'LX', 'NH', 'NZ', 'QF', 'QR', 'SK', 'SQ', 'TK', 'U2', 'UA', 'VS', 'WN', 'WS', 'TP', 'OS', 'SN', 'AZ', 'VY', 'W6', 'LO']);

export function match(query) {
  const q = query.trim();
  const bare = q.replace(/^(?:track(?:ing)?|track my|where is my)\s+(?:package|parcel|order|number)?\s*/i, '').replace(/\b(?:fedex|dhl|ups|usps|royal mail|an post)\b/ig, '').replace(/\s+/g, '').toUpperCase();
  for (const p of PARCELS) if (p.re.test(bare) && (!p.named || p.named.test(q))) return { kind: 'parcel', number: bare, carrier: p.carrier, url: p.url(bare) };
  const f = /^(?:flight\s+)?([A-Z0-9]{2})\s?(\d{1,4})(?:\s+(?:flight(?: status)?|status))?$/i.exec(q);
  if (f && (AIRLINES.has(f[1].toUpperCase()) && (/flight|status/i.test(q) || /^[A-Z]{2}\s?\d{2,4}$/i.test(q)))) {
    const code = `${f[1].toUpperCase()}${f[2]}`;
    return { kind: 'flight', code, label: `${f[1].toUpperCase()} ${f[2]}` };
  }
  return null;
}

export function render(a) {
  const link = (href, label) => h('a', { class: 'btn btn-small', href, rel: 'noreferrer' }, label);
  if (a.kind === 'parcel') {
    return h('section', { class: 'answer factbox raised', 'aria-label': `Track ${a.carrier} package` },
      h('p', { class: 'factbox-path' }, `${a.carrier} tracking`),
      h('p', { class: 'factbox-answer num is-long' }, a.number),
      h('p', { class: 'lyrics-links' }, link(a.url, `Track on ${a.carrier}`)),
      h('p', { class: 'answer-note' }, 'The carrier’s own page shows where it is. Webshelf doesn’t look it up.'));
  }
  const fr24 = `https://www.flightradar24.com/data/flights/${a.code.toLowerCase()}`;
  const fa = `https://www.flightaware.com/live/flight/${a.code}`;
  return h('section', { class: 'answer factbox raised', 'aria-label': `Flight ${a.label}` },
    h('p', { class: 'factbox-path' }, 'Flight status'),
    h('p', { class: 'factbox-answer num' }, a.label),
    h('p', { class: 'lyrics-links' }, link(fa, 'FlightAware'), link(fr24, 'Flightradar24')),
    h('p', { class: 'answer-note' }, 'Live times, gates and the map are on these flight trackers.'));
}
