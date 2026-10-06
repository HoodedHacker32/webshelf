// Webshelf's click counter: a Cloudflare Worker with a D1 (SQLite) database.
// See README.md beside it for what it keeps and how to set it up.
//
//   POST /click   {"q": "<32 hex digits>", "u": "https://…", "p": 3}
//                 counts one click (from the Webshelf site only)
//   GET  /counts?q=<32 hex digits>
//                 {"pages": [{"u": "https://…", "n": 12}, …]}, most clicked first
//
// It keeps no IP addresses, cookies or identifiers, and logs no requests.

const ORIGINS = /^(?:https:\/\/hoodedhacker32\.github\.io|http:\/\/localhost:8417)$/;
const CODE = /^[0-9a-f]{32}$/;
const DAILY_CAP = 20;

const UPSERT = `INSERT INTO clicks (q, u, n, pos_sum, day, today_n) VALUES (?1, ?2, 1, ?3, ?4, 1)
  ON CONFLICT (q, u) DO UPDATE SET
    n = n + CASE WHEN day = ?4 AND today_n >= ${DAILY_CAP} THEN 0 ELSE 1 END,
    pos_sum = pos_sum + CASE WHEN day = ?4 AND today_n >= ${DAILY_CAP} THEN 0 ELSE ?3 END,
    today_n = CASE WHEN day = ?4 THEN today_n + 1 ELSE 1 END,
    day = ?4`;

// A web address with no query string or fragment, at most 500 characters.
export function cleanPage(text) {
  if (typeof text !== 'string' || text.length > 500) return null;
  try {
    const u = new URL(text);
    if (!/^https?:$/.test(u.protocol) || u.search || u.hash || u.username || u.password) return null;
    return u.href === text || `${u.href}` === `${text}/` ? text : null;
  } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';
    const cors = ORIGINS.test(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const reply = (status, body = null, extra = {}) => new Response(body, { status, headers: { ...cors, ...extra } });

    if (request.method === 'OPTIONS') {
      return reply(204, null, { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' });
    }

    if (url.pathname === '/click' && request.method === 'POST') {
      // Only the Webshelf site counts clicks.
      if (!ORIGINS.test(origin)) return reply(403);
      const text = await request.text();
      if (text.length > 1000) return reply(413);
      let body;
      try { body = JSON.parse(text); } catch { return reply(400); }
      const page = cleanPage(body?.u);
      const position = Number(body?.p);
      if (!CODE.test(body?.q ?? '') || !page || !Number.isInteger(position) || position < 1 || position > 100) return reply(400);
      const today = new Date().toISOString().slice(0, 10);
      await env.DB.prepare(UPSERT).bind(body.q, page, position, today).run();
      return reply(204);
    }

    if (url.pathname === '/counts' && request.method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      if (!CODE.test(q)) return reply(400);
      const { results } = await env.DB.prepare('SELECT u, n FROM clicks WHERE q = ?1 AND n > 0 ORDER BY n DESC LIMIT 30').bind(q).all();
      return reply(200, JSON.stringify({ pages: results }), { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
    }

    return reply(404);
  },
};
