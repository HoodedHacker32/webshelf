// Lyrics: "bohemian rhapsody lyrics", "lyrics to yellow coldplay". Song lyrics
// are copyrighted, and Google paid licensing companies to show them. No free
// source is licensed to let another site display them, so this card names the
// song (from MusicBrainz, the open music database) and links to sites that
// are licensed to show the words.

import { h, getJSON } from '../dom.js';

export function match(query) {
  const q = query.trim().replace(/\s+/g, ' ');
  const m = /^(?:lyrics (?:to |of |for )?(.+)|(.+?) (?:song )?lyrics)$/i.exec(q);
  const song = (m?.[1] ?? m?.[2] ?? '').trim();
  if (/^(?:song|songs|the|a|music|best|new|my)$/i.test(song)) return null;
  return song && song.length >= 2 && song.split(' ').length <= 10 ? { song } : null;
}

export async function render({ song }, { signal }) {
  const data = await getJSON(`https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(song)}&limit=40&fmt=json`, { signal, timeout: 6000 }).catch(() => null);
  // A famous song has many recordings (live versions, remasters, covers). The
  // artist with the most of them among the best matches is the one people mean;
  // their earliest release is the original.
  const hits = (data?.recordings ?? []).filter((r) => r.score >= 80 && r['artist-credit']?.length);
  const artistOf = (r) => r['artist-credit'].map((c) => `${c.name}${c.joinphrase ?? ''}`).join('');
  const counts = new Map();
  for (const r of hits) counts.set(artistOf(r), (counts.get(artistOf(r)) ?? 0) + 1);
  const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const hit = hits.filter((r) => artistOf(r) === main)
    .sort((a, b) => String(a['first-release-date'] || '9999').localeCompare(String(b['first-release-date'] || '9999')))[0];
  const title = hit?.title ?? song;
  const artist = hit ? artistOf(hit) : null;
  const year = hit?.['first-release-date']?.slice(0, 4);
  const q = encodeURIComponent([title, artist].filter(Boolean).join(' '));
  const link = (href, label) => h('a', { class: 'btn btn-small', href, rel: 'noreferrer' }, label);
  return h('section', { class: 'answer lyrics raised', 'aria-label': `Lyrics for ${title}` },
    h('p', { class: 'factbox-path' }, 'Lyrics'),
    h('h2', { class: 'lyrics-title' }, title),
    artist ? h('p', { class: 'lyrics-by' }, `Song by ${artist}${year ? ` · ${year}` : ''}`) : '',
    h('p', { class: 'lyrics-note' }, 'Song lyrics are copyrighted, so Webshelf links to sites licensed to show them rather than copying them here.'),
    h('p', { class: 'lyrics-links' }, link(`https://genius.com/search?q=${q}`, 'Genius'), link(`https://www.musixmatch.com/search?query=${q}`, 'Musixmatch')),
    hit ? h('p', { class: 'answer-source' }, 'Song details from ', h('a', { href: `https://musicbrainz.org/recording/${hit.id}`, rel: 'noreferrer' }, 'MusicBrainz')) : '');
}
