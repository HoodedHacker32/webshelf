"""Share prices for Webshelf, shared by every visitor.

Caddy sends /market/quote and /market/time_series here. Each answer is kept
for a while (a price for 5 minutes, a chart for 10 minutes to a day), so a
thousand people looking at Apple cost about as much as one. Requests to Twelve
Data are kept inside its free plan (8 a minute, 800 a day, both settable);
when they run out, the last answer kept is served, however old.

Optional: FINNHUB_KEY (free plan: 60 requests a minute, no daily cap) answers
price requests for US shares, leaving Twelve Data for charts.

Standard library only, so it runs on the Python already in the SearXNG image.
"""

import json
import os
import re
import threading
import time
import urllib.parse
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TD = 'https://api.twelvedata.com'
TD_KEY = os.environ.get('TWELVE_DATA_KEY') or 'demo'
FH_KEY = os.environ.get('FINNHUB_KEY') or None
PER_MINUTE = int(os.environ.get('TWELVE_DATA_PER_MINUTE', '8'))
PER_DAY = int(os.environ.get('TWELVE_DATA_PER_DAY', '800'))
US = {'XNAS', 'XNYS', 'ARCX', 'BATS', 'XASE', 'IEXG', 'XNGS', 'XNCM', 'XNMS'}
ALLOWED = {'symbol', 'mic_code', 'interval', 'outputsize', 'order', 'start_date'}
FRESH = {'quote': 300, '5min': 600, '30min': 1800, '1day': 3 * 3600, '1week': 12 * 3600, '1month': 24 * 3600}

cache = {}            # key -> (saved at, body bytes)
lock = threading.Lock()
recent = []           # times of Twelve Data requests in the last minute
day = {'date': None, 'used': 0}


def budget():
    """Take one Twelve Data request from the allowance, if any is left."""
    now = time.time()
    today = time.strftime('%Y-%m-%d', time.gmtime(now))
    with lock:
        if day['date'] != today:
            day['date'], day['used'] = today, 0
        recent[:] = [t for t in recent if now - t < 60]
        if day['used'] >= PER_DAY - 5 or len(recent) >= PER_MINUTE:
            return False
        recent.append(now)
        day['used'] += 1
        return True


def spent_for_today():
    with lock:
        day['used'] = PER_DAY


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Webshelf share prices (github.com/HoodedHacker32/webshelf)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as err:
        # Twelve Data says why in the body ("run out of API credits for the day").
        try:
            return {'status': 'error', **json.loads(err.read().decode('utf-8'))}
        except ValueError:
            return {'status': 'error', 'message': str(err)}


def from_finnhub(params):
    data = fetch(f"https://finnhub.io/api/v1/quote?symbol={urllib.parse.quote(params['symbol'])}&token={FH_KEY}")
    if not data or not data.get('t'):
        return None
    # Twelve Data's shape, so the page reads either the same way.
    return {
        'symbol': params['symbol'], 'close': data['c'], 'change': data['d'], 'percent_change': data['dp'],
        'open': data['o'], 'high': data['h'], 'low': data['l'], 'previous_close': data['pc'],
        'timestamp': data['t'], 'is_market_open': time.time() - data['t'] < 20 * 60, 'source': 'finnhub',
    }


def answer(path, params):
    key = path + '?' + urllib.parse.urlencode(sorted(params.items()))
    fresh_for = FRESH.get('quote' if path == 'quote' else params.get('interval', ''), 600)
    with lock:
        kept = cache.get(key)
    if kept and time.time() - kept[0] < fresh_for:
        return kept[1]
    body = None
    try:
        if path == 'quote' and FH_KEY and params.get('mic_code') in US:
            data = from_finnhub(params)
            if data:
                body = json.dumps(data).encode()
        if body is None and budget():
            data = fetch(f'{TD}/{path}?{urllib.parse.urlencode({**params, "apikey": TD_KEY})}')
            if data.get('status') == 'error':
                if 'for the day' in str(data.get('message', '')):
                    spent_for_today()
            else:
                body = json.dumps(data).encode()
    except Exception:  # noqa: BLE001 - any failure falls back to what's kept
        body = None
    if body is not None:
        with lock:
            cache[key] = (time.time(), body)
            if len(cache) > 5000:
                for k in sorted(cache, key=lambda k: cache[k][0])[:1000]:
                    del cache[k]
        return body
    if kept:
        return kept[1]
    return json.dumps({'status': 'error', 'message': 'Share prices are busy; try again in a minute.'}).encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 - the standard library's name
        url = urllib.parse.urlparse(self.path)
        path = url.path.strip('/')
        params = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items() if k in ALLOWED}
        if path not in ('quote', 'time_series') or not re.fullmatch(r'[A-Za-z0-9.\-^=/]{1,20}', params.get('symbol', '')):
            self.send_response(404)
            self.end_headers()
            return
        body = answer(path, params)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'public, max-age=60')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # no request logs: searches stay unrecorded
        pass


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8090), Handler).serve_forever()
