// Place lookup (Open-Meteo geocoding) and the visitor's saved home location.

import { getJSON } from '../dom.js';
import { getSettings, setSetting } from '../store.js';

export async function geocode(name, { signal } = {}) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const data = await getJSON(url, { signal });
  const r = data?.results?.[0];
  if (!r) return null;
  const region = r.country_code === 'US' && r.admin1 ? r.admin1 : r.country;
  return {
    name: region && region !== r.name ? `${r.name}, ${region}` : r.name,
    lat: r.latitude,
    lon: r.longitude,
    tz: r.timezone,
  };
}

export const homeLocation = () => getSettings().home;

export function saveHome(place) {
  return setSetting('home', place);
}

export function locateMe() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location isn’t available in this browser.')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ name: 'Your location', lat: pos.coords.latitude, lon: pos.coords.longitude, tz: null }),
      (err) => reject(new Error(err.code === 1 ? 'Location permission was denied.' : 'Your location couldn’t be found.')),
      { timeout: 10000, maximumAge: 600000 },
    );
  });
}
