// Sports scores: a team's latest results, its next match and where it stands,
// from ESPN's public site feeds (keyless; browsers may read them). Asked for
// with a sports word ("arsenal score", "lakers schedule", "how did leinster
// do", "arsenal vs chelsea"), so ordinary searches never go to ESPN.

import { h } from '../dom.js';

const SEARCH = 'https://site.web.api.espn.com/apis/search/v2';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports';

const WORDS = '(?:score|scores|live score|result|results|fixtures?|schedule|game|match|next (?:game|match)|last (?:game|match)|standings?|league table)';
const WHEN = '(?: (?:today|tonight|yesterday|last night|this week(?:end)?))?';
// Scores, results and schedules of other kinds ("credit score", "election
// results", "bus schedule", "squid game"), which never go to ESPN.
const NOT_SPORT = /\b(?:credit|sat|act|iq|gpa|film|movie|exam|exams|test|tests|lab|blood|election|elections|poll|polls|lotto|lottery|leaving cert|junior cert|search|bin|bins|bus|train|rail|luas|dart|tv|flight|flights|school|class|work|shift|squid|video|board|card|word|puzzle|crossword|wordle|chess)\b/;

const LEAGUE = /(?:^|\s)(?:premier|premiership|la liga|serie a|bundesliga|ligue 1|eredivisie|nba|nfl|nhl|mlb|mls|wnba|ncaa|gaa|urc|league|cup|championship|division|conference|world cup|euros|six nations)$/;

export function match(query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
  if (NOT_SPORT.test(q)) return null;
  let m = new RegExp(`^(.+?) (?:vs\\.?|v\\.?|versus) (.+?)(?: ${WORDS})?${WHEN}$`).exec(q);
  if (m) return { team: m[1], other: m[2] };
  m = new RegExp(`^(?:how did|did|when do|when does|when is|who do|who does|who are) (?:the )?(.+?) (?:do|win|lose|draw|play|playing|play next|next play)${WHEN}$`).exec(q);
  if (m) return { team: m[1] };
  m = new RegExp(`^(?:the )?(.+?) (?:${WORDS})${WHEN}$`).exec(q);
  // A competition ("premier league table", "nba scores") isn't a team.
  if (m && m[1].split(' ').length <= 4 && !LEAGUE.test(m[1])) return { team: m[1] };
  return null;
}

async function json(url, signal) {
  const res = await fetch(url, { signal, referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

async function findTeam(name, signal) {
  const data = await json(`${SEARCH}?query=${encodeURIComponent(name)}&limit=5&type=team`, signal);
  const teams = (data.results ?? []).filter((r) => r.type === 'team').flatMap((r) => r.contents ?? [])
    .filter((c) => c.defaultLeagueSlug && c.sport && /~t:(\d+)/.test(c.uid ?? ''));
  return teams[0] ?? null;
}

const scoreOf = (c) => (typeof c.score === 'object' ? c.score?.displayValue : c.score) ?? '';
// ESPN sends only the asked-for team's badge; football badges sit at an
// address made from the team's number, so opponents get theirs too.
let sport = '';
const logoOf = (team) => team.logos?.[0]?.href ?? team.logo
  ?? (sport === 'soccer' && team.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png` : null);

function row(e, teamId, { featured = false } = {}) {
  const c = e.competitions?.[0];
  if (!c) return null;
  const state = c.status?.type?.state;
  const date = new Date(e.date);
  const when = state === 'in'
    ? h('span', { class: 'sport-live' }, `Live · ${c.status.displayClock ?? c.status.type.shortDetail}`)
    : date.toLocaleString(undefined, state === 'pre'
      ? { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
      : { weekday: 'short', day: 'numeric', month: 'short' });
  // Home side first, as scorelines are written.
  const sides = [...c.competitors].sort((a, b) => (a.homeAway === 'home' ? -1 : 1) - (b.homeAway === 'home' ? -1 : 1));
  const ours = c.competitors.find((x) => x.team?.id === teamId || x.id === teamId);
  const outcome = state === 'post' && ours
    ? (ours.winner ? 'W' : c.competitors.some((x) => x.winner) ? 'L' : 'D')
    : null;
  return h('li', { class: `sport-match${featured ? ' is-featured' : ''}` },
    h('p', { class: 'sport-when' }, when, e.league?.shortName ? ` · ${e.league.shortName}` : '', state === 'post' ? ` · ${c.status.type.shortDetail}` : ''),
    h('div', { class: 'sport-line' },
      ...sides.map((s, i) => h('div', { class: `sport-side${s.winner ? ' is-winner' : ''}${i ? ' is-away' : ''}` },
        logoOf(s.team) ? h('img', { src: logoOf(s.team), alt: '', width: '24', height: '24', loading: 'lazy', referrerpolicy: 'no-referrer' }) : '',
        h('span', { class: 'sport-team' }, s.team.shortDisplayName ?? s.team.displayName),
        state === 'pre' ? '' : h('span', { class: 'sport-score num' }, scoreOf(s)))),
      outcome ? h('span', { class: `sport-outcome is-${outcome}`, title: { W: 'Won', L: 'Lost', D: 'Drew' }[outcome] }, outcome) : ''),
    state === 'pre' && c.venue?.fullName ? h('p', { class: 'sport-venue' }, c.venue.fullName) : '');
}

export async function render({ team: name, other }, { signal }) {
  const team = await findTeam(name, signal);
  if (!team) return null;
  const id = team.uid.match(/~t:(\d+)/)[1];
  sport = team.sport;
  const base = `${SITE}/${team.sport}/${team.defaultLeagueSlug}/teams/${id}`;
  const [info, past, next] = await Promise.all([
    json(base, signal).catch(() => null),
    json(`${base}/schedule`, signal).catch(() => null),
    json(`${base}/schedule?fixture=true`, signal).catch(() => null),
  ]);
  const t = info?.team ?? past?.team;
  if (!t) return null;
  // Some sports (rugby) have no schedule feed: the team's next match still shows.
  const all = [...(past?.events ?? []), ...(next?.events ?? []), ...(t.nextEvent ?? [])];
  const seen = new Set();
  const events = all.filter((e) => !seen.has(e.id) && seen.add(e.id)).sort((a, b) => new Date(a.date) - new Date(b.date));
  const state = (e) => e.competitions?.[0]?.status?.type?.state;
  const live = events.filter((e) => state(e) === 'in');
  const done = events.filter((e) => state(e) === 'post');
  const coming = events.filter((e) => state(e) === 'pre');
  if (!live.length && !done.length && !coming.length) return null;

  // "Arsenal vs Chelsea": that meeting, the latest or the next.
  let featured = null;
  if (other) {
    const o = other.toLowerCase();
    const meets = (e) => e.competitions[0].competitors.some((x) => x.team?.id !== t.id && `${x.team?.displayName} ${x.team?.shortDisplayName} ${x.team?.abbreviation}`.toLowerCase().includes(o));
    featured = live.find(meets) ?? done.filter(meets).at(-1) ?? coming.find(meets) ?? null;
  }
  const recent = done.slice(-3).reverse().filter((e) => e !== featured);
  const upcoming = coming.slice(0, 2).filter((e) => e !== featured);
  const summary = t.record?.items?.[0]?.summary;
  // Either a record ("4-0-1") or recent form, latest last ("LLWWW").
  const record = summary && (/^[WLDT]+$/.test(summary) ? `Form ${summary}` : `Record ${summary}`);
  const logo = logoOf(t);
  const leagueName = events.find((e) => e.league?.name)?.league.name;
  const section = (title, list) => (list.length ? [h('h3', { class: 'sport-heading' }, title), h('ul', { class: 'sport-list' }, list.map((e) => row(e, t.id)))] : []);

  return h('section', { class: 'answer sport raised', 'aria-label': `${t.displayName}: scores and fixtures` },
    h('div', { class: 'sport-head' },
      logo ? h('img', { class: 'sport-logo', src: logo, alt: '', width: '44', height: '44', referrerpolicy: 'no-referrer' }) : '',
      h('div', null,
        h('h2', { class: 'sport-name' }, t.displayName),
        h('p', { class: 'sport-standing' }, [t.standingSummary, record].filter(Boolean).join(' · ')))),
    featured ? h('ul', { class: 'sport-list' }, row(featured, t.id, { featured: true })) : '',
    ...section('Live', live.filter((e) => e !== featured).map((e) => e)),
    ...section('Latest results', recent),
    ...section('Next', upcoming),
    h('p', { class: 'answer-source' }, 'Scores from ', h('a', { href: team.link?.web ?? 'https://www.espn.com', rel: 'noreferrer' }, 'ESPN'),
      leagueName ? ` · ${leagueName} only` : ''));
}

// Web results about the team, not the word "score".
export function webQuery({ team }) {
  return team;
}
