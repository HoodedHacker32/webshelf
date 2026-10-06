"""Share prices for Webshelf, from Yahoo Finance's public chart and search
feeds, shared by every visitor.

Caddy sends /market/search and /market/chart here. Each answer is kept for a
while (today's chart for 2 minutes, longer charts for up to a day, a symbol
search for a day), so a thousand people looking at Apple cost about as much as
one. Requests to Yahoo are held to a gentle pace (60 a minute, settable); if
Yahoo is slow, refuses or is out of reach, the last answer kept is served,
however old.

No keys. Standard library only, so it runs on the Python already in the
SearXNG image.
"""

import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']
PER_MINUTE = int(os.environ.get('YAHOO_PER_MINUTE', '60'))
# Chart ranges the card offers, each with its interval and how long it's kept.
RANGES = {
    '1d': ('5m', 120), '5d': ('30m', 600), '1mo': ('1d', 3600), '6mo': ('1d', 3 * 3600),
    'ytd': ('1d', 3 * 3600), '1y': ('1d', 6 * 3600), '5y': ('1wk', 12 * 3600), 'max': ('1mo', 24 * 3600),
}
SEARCH_FRESH = 24 * 3600
SYMBOL = re.compile(r'[A-Za-z0-9.\-^=]{1,20}')
TYPES = {'EQUITY', 'ETF', 'INDEX', 'MUTUALFUND'}
# Browsers' own request headers; Yahoo turns away scripts that don't send them.
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
}

cache = {}            # key -> (saved at, body bytes)
lock = threading.Lock()
recent = []           # times of requests to Yahoo in the last minute
pause = {'until': 0}  # after Yahoo says "too many requests", wait


def allowed():
    """Take one request from the per-minute allowance, if any is left."""
    now = time.time()
    with lock:
        if now < pause['until']:
            return False
        recent[:] = [t for t in recent if now - t < 60]
        if len(recent) >= PER_MINUTE:
            return False
        recent.append(now)
        return True


def fetch(path):
    for host in HOSTS:
        try:
            req = urllib.request.Request(host + path, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=8) as res:
                return json.loads(res.read().decode('utf-8'))
        except urllib.error.HTTPError as err:
            if err.code == 429:
                with lock:
                    pause['until'] = time.time() + 300
                return None
            if err.code == 404:
                return {}
        except (urllib.error.URLError, TimeoutError, ValueError):
            pass
    return None


def search(text):
    data = fetch('/v1/finance/search?' + urllib.parse.urlencode(
        {'q': text, 'quotesCount': 10, 'newsCount': 0, 'listsCount': 0, 'enableFuzzyQuery': 'false'}))
    if data is None:
        return None
    return {'quotes': [
        {'symbol': q['symbol'], 'name': q.get('longname') or q.get('shortname') or q['symbol'],
         'exchange': q.get('exchDisp') or q.get('exchange'), 'type': q.get('quoteType')}
        for q in data.get('quotes', []) if q.get('symbol') and q.get('quoteType') in TYPES
    ]}


def chart(symbol, span):
    interval = RANGES[span][0]
    data = fetch(f'/v8/finance/chart/{urllib.parse.quote(symbol)}?' + urllib.parse.urlencode(
        {'range': span, 'interval': interval, 'includePrePost': 'false'}))
    if data is None:
        return None
    result = ((data.get('chart') or {}).get('result') or [None])[0]
    if not result:
        return {'error': 'Unknown symbol'}
    meta = result.get('meta', {})
    quote = ((result.get('indicators') or {}).get('quote') or [{}])[0]
    times = result.get('timestamp') or []
    closes = quote.get('close') or []
    opens = [v for v in (quote.get('open') or []) if v is not None]
    keep = ('symbol', 'currency', 'exchangeName', 'fullExchangeName', 'instrumentType', 'longName', 'shortName',
            'regularMarketPrice', 'regularMarketTime', 'regularMarketDayHigh', 'regularMarketDayLow',
            'regularMarketVolume', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'previousClose', 'chartPreviousClose',
            'exchangeTimezoneName', 'currentTradingPeriod')
    return {
        'meta': {k: meta[k] for k in keep if k in meta},
        'open': opens[0] if span == '1d' and opens else None,
        'points': [[t, round(c, 4)] for t, c in zip(times, closes) if c is not None],
    }


def answer(key, fresh_for, make):
    with lock:
        kept = cache.get(key)
    if kept and time.time() - kept[0] < fresh_for:
        return kept[1]
    data = None
    if allowed():
        try:
            data = make()
        except Exception:  # noqa: BLE001 - any failure falls back to what's kept
            data = None
    if data is not None:
        body = json.dumps(data, separators=(',', ':')).encode()
        with lock:
            cache[key] = (time.time(), body)
            if len(cache) > 5000:
                for k in sorted(cache, key=lambda k: cache[k][0])[:1000]:
                    del cache[k]
        return body
    if kept:
        return kept[1]
    return json.dumps({'error': 'Share prices are busy; try again in a minute.'}).encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 - the standard library's name
        url = urllib.parse.urlparse(self.path)
        path = url.path.strip('/')
        params = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}
        body = None
        if path == 'search':
            text = params.get('q', '').strip()[:60]
            if text:
                body = answer('s:' + text.lower(), SEARCH_FRESH, lambda: search(text))
        elif path == 'chart':
            symbol, span = params.get('symbol', ''), params.get('range', '1d')
            if SYMBOL.fullmatch(symbol) and span in RANGES:
                body = answer(f'c:{symbol.upper()}:{span}', RANGES[span][1], lambda: chart(symbol, span))
        if body is None:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'public, max-age=60')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # no request logs: searches stay unrecorded
        pass


if __name__ == '__main__':
    host = os.environ.get('MARKET_HOST', '127.0.0.1')
    ThreadingHTTPServer((host, int(os.environ.get('MARKET_PORT', '8090'))), Handler).serve_forever()
