// Unit converter: category select, two linked value/unit pairs, formula hint.

import { h } from '../dom.js';

// [id, label, factor to the category's base unit, comma-separated aliases]
const CATEGORIES = {
  length: {
    label: 'Length', noun: 'length',
    units: [
      ['km', 'Kilometre', 1000, 'km,kilometer,kilometers,kilometre,kilometres,kms'],
      ['m', 'Metre', 1, 'm,meter,meters,metre,metres'],
      ['cm', 'Centimetre', 0.01, 'cm,centimeter,centimeters,centimetre,centimetres,cms'],
      ['mm', 'Millimetre', 0.001, 'mm,millimeter,millimeters,millimetre,millimetres'],
      ['um', 'Micrometre', 1e-6, 'µm,um,micrometer,micrometers,micrometre,micrometres,micron,microns'],
      ['nm', 'Nanometre', 1e-9, 'nm,nanometer,nanometers,nanometre,nanometres'],
      ['mi', 'Mile', 1609.344, 'mi,mile,miles'],
      ['yd', 'Yard', 0.9144, 'yd,yard,yards,yds'],
      ['ft', 'Foot', 0.3048, 'ft,foot,feet'],
      ['in', 'Inch', 0.0254, 'in,inch,inches'],
      ['nmi', 'Nautical mile', 1852, 'nmi,nautical mile,nautical miles'],
    ],
  },
  mass: {
    label: 'Mass', noun: 'mass',
    units: [
      ['t', 'Tonne', 1000, 't,tonne,tonnes,metric ton,metric tons'],
      ['kg', 'Kilogram', 1, 'kg,kgs,kilo,kilos,kilogram,kilograms,kilogramme,kilogrammes'],
      ['g', 'Gram', 0.001, 'g,gram,grams,gramme,grammes'],
      ['mg', 'Milligram', 1e-6, 'mg,milligram,milligrams'],
      ['ug', 'Microgram', 1e-9, 'µg,ug,mcg,microgram,micrograms'],
      ['lt', 'Imperial ton', 1016.0469088, 'imperial ton,imperial tons,long ton,long tons'],
      ['st', 'US ton', 907.18474, 'us ton,us tons,short ton,short tons,ton,tons'],
      ['stone', 'Stone', 6.35029318, 'stone,stones'],
      ['lb', 'Pound', 0.45359237, 'lb,lbs,pound,pounds'],
      ['oz', 'Ounce', 0.028349523125, 'oz,ounce,ounces'],
    ],
  },
  temperature: {
    label: 'Temperature', noun: 'temperature',
    units: [
      ['c', 'Degree Celsius', null, 'c,°c,celsius,degrees celsius,degree celsius,centigrade'],
      ['f', 'Fahrenheit', null, 'f,°f,fahrenheit,degrees fahrenheit,degree fahrenheit'],
      ['k', 'Kelvin', null, 'k,kelvin,kelvins'],
    ],
  },
  volume: {
    label: 'Volume', noun: 'volume',
    units: [
      ['usgal', 'US liquid gallon', 3.785411784, 'gallon,gallons,gal,us gallon,us gallons'],
      ['usqt', 'US liquid quart', 0.946352946, 'quart,quarts,qt,us quart'],
      ['uspt', 'US liquid pint', 0.473176473, 'us pint,us pints'],
      ['uscup', 'US legal cup', 0.24, 'cup,cups,us cup,us cups'],
      ['usfloz', 'US fluid ounce', 0.0295735295625, 'fl oz,fluid ounce,fluid ounces,us fluid ounce'],
      ['ustbsp', 'US tablespoon', 0.01478676478125, 'tbsp,tablespoon,tablespoons'],
      ['ustsp', 'US teaspoon', 0.00492892159375, 'tsp,teaspoon,teaspoons'],
      ['m3', 'Cubic metre', 1000, 'm3,m³,cubic meter,cubic meters,cubic metre,cubic metres'],
      ['l', 'Litre', 1, 'l,liter,liters,litre,litres'],
      ['ml', 'Millilitre', 0.001, 'ml,milliliter,milliliters,millilitre,millilitres'],
      ['impgal', 'Imperial gallon', 4.54609, 'imperial gallon,imperial gallons,uk gallon,uk gallons'],
      ['imppt', 'Imperial pint', 0.56826125, 'pint,pints,imperial pint,imperial pints,uk pint'],
      ['impfloz', 'Imperial fluid ounce', 0.0284130625, 'imperial fluid ounce,imperial fluid ounces,uk fl oz'],
      ['ft3', 'Cubic foot', 28.316846592, 'ft3,ft³,cubic foot,cubic feet'],
      ['in3', 'Cubic inch', 0.016387064, 'in3,in³,cubic inch,cubic inches'],
    ],
  },
  speed: {
    label: 'Speed', noun: 'speed',
    units: [
      ['mph', 'Mile per hour', 0.44704, 'mph,miles per hour,mile per hour'],
      ['fps', 'Foot per second', 0.3048, 'ft/s,fps,feet per second,foot per second'],
      ['ms', 'Metre per second', 1, 'm/s,meters per second,metres per second,meter per second,metre per second'],
      ['kmh', 'Kilometre per hour', 1 / 3.6, 'km/h,kmh,kph,kilometers per hour,kilometres per hour'],
      ['kn', 'Knot', 1852 / 3600, 'knot,knots,kn,kt'],
    ],
  },
  area: {
    label: 'Area', noun: 'area',
    units: [
      ['km2', 'Square kilometre', 1e6, 'km2,km²,square kilometer,square kilometers,square kilometre,square kilometres,sq km'],
      ['m2', 'Square metre', 1, 'm2,m²,square meter,square meters,square metre,square metres,sq m'],
      ['mi2', 'Square mile', 2589988.110336, 'mi2,mi²,square mile,square miles,sq mi'],
      ['yd2', 'Square yard', 0.83612736, 'yd2,yd²,square yard,square yards,sq yd'],
      ['ft2', 'Square foot', 0.09290304, 'ft2,ft²,square foot,square feet,sq ft'],
      ['in2', 'Square inch', 0.00064516, 'in2,in²,square inch,square inches,sq in'],
      ['ha', 'Hectare', 1e4, 'ha,hectare,hectares'],
      ['ac', 'Acre', 4046.8564224, 'acre,acres,ac'],
    ],
  },
  time: {
    label: 'Time', noun: 'time',
    units: [
      ['ns', 'Nanosecond', 1e-9, 'ns,nanosecond,nanoseconds'],
      ['us', 'Microsecond', 1e-6, 'µs,microsecond,microseconds'],
      ['msec', 'Millisecond', 1e-3, 'millisecond,milliseconds,msec'],
      ['s', 'Second', 1, 's,sec,secs,second,seconds'],
      ['min', 'Minute', 60, 'min,mins,minute,minutes'],
      ['h', 'Hour', 3600, 'h,hr,hrs,hour,hours'],
      ['d', 'Day', 86400, 'day,days'],
      ['wk', 'Week', 604800, 'wk,week,weeks'],
      ['mo', 'Month', 2629746, 'month,months'],
      ['yr', 'Calendar year', 31536000, 'yr,year,years'],
      ['dec', 'Decade', 315360000, 'decade,decades'],
      ['cent', 'Century', 3153600000, 'century,centuries'],
    ],
  },
  data: {
    label: 'Digital storage', noun: 'data',
    units: [
      ['bit', 'Bit', 0.125, 'bit,bits'],
      ['kbit', 'Kilobit', 125, 'kb,kbit,kilobit,kilobits'],
      ['B', 'Byte', 1, 'byte,bytes'],
      ['kB', 'Kilobyte', 1e3, 'kilobyte,kilobytes'],
      ['KiB', 'Kibibyte', 1024, 'kib,kibibyte,kibibytes'],
      ['Mbit', 'Megabit', 125e3, 'mbit,megabit,megabits'],
      ['MB', 'Megabyte', 1e6, 'mb,megabyte,megabytes'],
      ['MiB', 'Mebibyte', 1048576, 'mib,mebibyte,mebibytes'],
      ['Gbit', 'Gigabit', 1.25e8, 'gbit,gigabit,gigabits'],
      ['GB', 'Gigabyte', 1e9, 'gb,gigabyte,gigabytes'],
      ['GiB', 'Gibibyte', 2 ** 30, 'gib,gibibyte,gibibytes'],
      ['TB', 'Terabyte', 1e12, 'tb,terabyte,terabytes'],
      ['TiB', 'Tebibyte', 2 ** 40, 'tib,tebibyte,tebibytes'],
    ],
  },
};

const ALIASES = new Map();
for (const [cat, def] of Object.entries(CATEGORIES)) {
  for (const [id, label, , aliases] of def.units) {
    for (const a of [...aliases.split(','), label.toLowerCase(), `${label.toLowerCase()}s`]) {
      if (!ALIASES.has(a)) ALIASES.set(a, { cat, id });
    }
  }
}

export function lookupUnit(text) {
  return ALIASES.get(text.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ')) ?? null;
}

const unitDef = (cat, id) => CATEGORIES[cat].units.find((u) => u[0] === id);

function toBase(cat, id, v) {
  if (cat !== 'temperature') return v * unitDef(cat, id)[2];
  if (id === 'c') return v;
  if (id === 'f') return ((v - 32) * 5) / 9;
  return v - 273.15;
}

function fromBase(cat, id, v) {
  if (cat !== 'temperature') return v / unitDef(cat, id)[2];
  if (id === 'c') return v;
  if (id === 'f') return (v * 9) / 5 + 32;
  return v + 273.15;
}

export const convert = (cat, from, to, v) => fromBase(cat, to, toBase(cat, from, v));

export function fmt(v) {
  if (!Number.isFinite(v)) return '';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e15 || abs < 1e-6) return v.toExponential(4).replace('e+', 'e');
  return String(parseFloat(v.toPrecision(6)));
}

function formula(cat, from, to) {
  if (from === to) return null;
  if (cat === 'temperature') {
    const f = {
      'c>f': '(°C × 9/5) + 32 = °F', 'f>c': '(°F − 32) × 5/9 = °C',
      'c>k': '°C + 273.15 = K', 'k>c': 'K − 273.15 = °C',
      'f>k': '(°F − 32) × 5/9 + 273.15 = K', 'k>f': '(K − 273.15) × 9/5 + 32 = °F',
    };
    return f[`${from}>${to}`];
  }
  const ratio = unitDef(cat, from)[2] / unitDef(cat, to)[2];
  const noun = CATEGORIES[cat].noun;
  return ratio >= 1
    ? `multiply the ${noun} value by ${fmt(ratio)}`
    : `divide the ${noun} value by ${fmt(1 / ratio)}`;
}

/* Matching ----------------------------------------------------------- */

export function parseConversion(query) {
  const q = query.trim().toLowerCase().replace(/^(convert|how many)\s+/, '').replace(/[?]$/, '');
  const m = /^(-?[\d.,]+\s*)?(.+?)\s+(?:to|in|into|=|as|in to)\s+(.+)$/.exec(q);
  if (!m) return null;
  const amount = m[1] ? parseFloat(m[1].replace(/,/g, '')) : null;
  return { amount, from: m[2].replace(/^(a|an)\s+/, ''), to: m[3] };
}

export function match(query) {
  const q = query.trim().toLowerCase();
  if (/^(unit converter|unit conversion|convert units|conversion calculator)$/.test(q)) {
    return { cat: 'length', from: 'ft', to: 'mi', amount: 1 };
  }
  const p = parseConversion(query);
  if (!p) return null;
  const a = lookupUnit(p.from);
  const b = lookupUnit(p.to);
  if (!a || !b || a.cat !== b.cat) return null;
  return { cat: a.cat, from: a.id, to: b.id, amount: p.amount ?? 1 };
}

/* Card --------------------------------------------------------------- */

export function render({ cat, from, to, amount }) {
  let state = { cat, from, to };

  const catSelect = h('select', { class: 'field units-cat', 'aria-label': 'Unit category' },
    Object.entries(CATEGORIES).map(([id, def]) => h('option', { value: id, selected: id === cat }, def.label)));
  const left = h('input', { class: 'field units-value num', type: 'number', inputmode: 'decimal', step: 'any', 'aria-label': 'Value to convert' });
  const right = h('input', { class: 'field units-value num', type: 'number', inputmode: 'decimal', step: 'any', 'aria-label': 'Converted value' });
  const leftUnit = h('select', { class: 'field units-unit', 'aria-label': 'Convert from' });
  const rightUnit = h('select', { class: 'field units-unit', 'aria-label': 'Convert to' });
  const hint = h('p', { class: 'units-formula' });

  const fillUnits = () => {
    const opts = (selected) => CATEGORIES[state.cat].units.map(([id, label]) => h('option', { value: id, selected: id === selected }, label));
    leftUnit.replaceChildren(...opts(state.from));
    rightUnit.replaceChildren(...opts(state.to));
  };

  const update = (source) => {
    const fromV = parseFloat(left.value);
    const toV = parseFloat(right.value);
    if (source === 'right') {
      left.value = Number.isFinite(toV) ? fmt(convert(state.cat, state.to, state.from, toV)) : '';
    } else {
      right.value = Number.isFinite(fromV) ? fmt(convert(state.cat, state.from, state.to, fromV)) : '';
    }
    const f = formula(state.cat, state.from, state.to);
    hint.replaceChildren(...(f ? [h('span', { class: 'units-formula-tag' }, 'Formula'), ' ', f] : []));
  };

  catSelect.addEventListener('change', () => {
    const units = CATEGORIES[catSelect.value].units;
    state = { cat: catSelect.value, from: units[0][0], to: units[1][0] };
    fillUnits();
    left.value = '1';
    update('left');
  });
  leftUnit.addEventListener('change', () => { state.from = leftUnit.value; update('left'); });
  rightUnit.addEventListener('change', () => { state.to = rightUnit.value; update('left'); });
  left.addEventListener('input', () => update('left'));
  right.addEventListener('input', () => update('right'));

  fillUnits();
  left.value = fmt(amount);
  update('left');

  return h('section', { class: 'answer answer-card units', 'aria-label': 'Unit converter' },
    catSelect,
    h('div', { class: 'units-row' },
      h('div', { class: 'units-side' }, left, leftUnit),
      h('span', { class: 'units-eq', 'aria-hidden': 'true' }, '='),
      h('div', { class: 'units-side' }, right, rightUnit)),
    hint);
}
