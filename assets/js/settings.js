import { SITE } from './config.js';
import { h, $, $$ } from './dom.js';
import { getSettings, setSetting, clearHistory, DEFAULTS } from './store.js';
import { createSearchbox } from './searchbox.js';
import { PROVIDERS, currentProvider } from './providers/index.js';
import { geocode, locateMe } from './answers/geo.js';
import { mountLogos } from './logo.js';
import { applyTheme } from './theme.js';

document.title = `Settings - ${SITE.name}`;
$('#settings-search').replaceChildren(createSearchbox());
mountLogos();

const saved = $('#saved');
let savedTimer;
function save(name, value) {
  const ok = setSetting(name, value);
  clearTimeout(savedTimer);
  saved.classList.toggle('is-error', !ok);
  saved.textContent = ok
    ? 'Saved in this browser'
    : 'This browser is blocking site storage (a private window or blocked site data), so settings can’t be saved.';
  saved.classList.add('is-visible');
  if (ok) savedTimer = setTimeout(() => saved.classList.remove('is-visible'), 2200);
  return ok;
}

/* Provider ------------------------------------------------------------ */

const current = currentProvider().id;
$('#provider-options').replaceChildren(...Object.values(PROVIDERS).map((p) => {
  const input = h('input', { type: 'radio', name: 'provider', value: p.id, checked: p.id === current });
  input.addEventListener('change', () => save('provider', p.id));
  return h('label', { class: 'radio radio-block' }, input,
    h('span', null, h('span', { class: 'radio-title' }, p.id === SITE.defaultProvider ? `${p.name} (default)` : p.name),
      h('span', { class: 'radio-help' }, p.about)));
}));

/* Switches ------------------------------------------------------------ */

const settings = getSettings();
for (const input of $$('[data-setting]')) {
  const key = input.dataset.setting;
  input.checked = Boolean(settings[key] ?? DEFAULTS[key]);
  input.addEventListener('change', () => save(key, input.checked));
}

for (const radio of $$('input[name="theme"]')) {
  radio.checked = radio.value === (settings.theme ?? 'auto');
  radio.addEventListener('change', () => {
    save('theme', radio.value);
    applyTheme(radio.value);
  });
}

for (const radio of $$('input[name="tempUnit"]')) {
  radio.checked = radio.value === settings.tempUnit;
  radio.addEventListener('change', () => save('tempUnit', radio.value));
}

/* History ------------------------------------------------------------- */

$('#clear-history').addEventListener('click', () => {
  clearHistory();
  $('#history-status').textContent = 'Search history cleared.';
});

/* Location ------------------------------------------------------------ */

const homeCurrent = $('#home-current');
const homeStatus = $('#home-status');
const showHome = () => {
  const home = getSettings().home;
  homeCurrent.replaceChildren(home
    ? h('span', null, 'Currently: ', h('strong', null, home.name))
    : h('span', null, 'No location set.'));
  $('#home-clear').hidden = !home;
};

const setHome = (place) => {
  if (save('home', place)) homeStatus.textContent = `Location set to ${place.name}.`;
  showHome();
};

$('#home-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = e.target.place.value.trim();
  if (!name) { e.target.place.focus(); return; }
  homeStatus.textContent = 'Finding that place…';
  try {
    const place = await geocode(name);
    if (!place) { homeStatus.textContent = `No place called “${name}” was found. Check the spelling or try a nearby city.`; return; }
    setHome(place);
    e.target.reset();
  } catch {
    homeStatus.textContent = 'The location service couldn’t be reached. Try again in a moment.';
  }
});

$('#home-locate').addEventListener('click', async () => {
  homeStatus.textContent = 'Asking your browser for your location…';
  try { setHome(await locateMe()); } catch (err) { homeStatus.textContent = err.message; }
});

$('#home-clear').addEventListener('click', () => {
  save('home', null);
  homeStatus.textContent = 'Location removed.';
  showHome();
});

showHome();

/* Privacy list -------------------------------------------------------- */

const SERVICES = [
  ['Webshelf’s search server (on Render, in the US)', 'Every search, which it passes on to Bing and Mwmbl, plus film and TV titles for posters (from TMDB) and share symbols for prices (from Twelve Data). It keeps no record of searches; Render, its host, may keep standard request logs for a short time.'],
  ['Mwmbl', 'Every search, directly, when the search server is waking up.'],
  ['MusicBrainz', 'Short searches that aren’t on Wikipedia, to recognise bands and artists.'],
  ['Openverse, Dailymotion, SepiaSearch, the Internet Archive', 'Searches on the Images and Videos tabs.'],
  ['CoinGecko and Twelve Data', 'Searches for a share or cryptocurrency price.'],
  ['Wikipedia and Wikidata', 'Every search, for the knowledge panel, “Did you mean” and related searches. Also what you type, if suggestions are on.'],
  ['Wiktionary', 'Words you look up with “define”.'],
  ['Open-Meteo', 'Place names or your saved location, for weather and time searches.'],
  ['Frankfurter', 'Currency codes, for currency conversions.'],
  ['Wikimedia Commons', 'Every search that isn’t answered by a tool, for the image strip.'],
  ['The websites in your results', 'Only when you click a result.'],
];
$('#privacy-list').replaceChildren(...SERVICES.map(([who, what]) => h('div', { class: 'privacy-item' }, h('dt', null, who), h('dd', null, what))));
