// Instant answers. The first module whose match() accepts the query renders
// a card above the results. Order matters: specific triggers come first.

import * as breakout from './breakout.js';
import * as timer from './timer.js';
import * as coin from './coin.js';
import * as dice from './dice.js';
import * as random from './random.js';
import * as colour from './colour.js';
import * as calculator from './calculator.js';
import * as currency from './currency.js';
import * as units from './units.js';
import * as time from './time.js';
import * as weather from './weather.js';
import * as dictionary from './dictionary.js';
import * as market from './market.js';
import * as sports from './sports.js';
import * as qr from './qr.js';
import * as percent from './percent.js';
import * as lyrics from './lyrics.js';
import * as tracking from './tracking.js';
import * as leader from './leader.js';

const MODULES = [qr, tracking, leader, percent, lyrics, breakout, timer, coin, dice, random, colour, calculator, currency, units, time, weather, dictionary, sports, market];
// market is last: a bare ticker ("nvda") is only claimed after every other answer passes.

export function findAnswer(query) {
  for (const mod of MODULES) {
    let args = null;
    try { args = mod.match(query); } catch { args = null; }
    if (args) return { mod, args };
  }
  return null;
}
