"""Refresh the ranking data in assets/data/. Run: python tools/update_lists.py

- top-sites.txt: the 50,000 most popular websites, most popular first, from
  the Tranco list (https://tranco-list.eu), a research ranking that combines
  several sources and resists manipulation. Free to use; cite Le Pochat et al.,
  NDSS 2019.
- ai-sites.txt: sites that mass-produce AI-generated content, from the
  uBlockOrigin HUGE AI Blocklist (CC0,
  https://github.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist).
"""
import io
import json
import pathlib
import urllib.request
import zipfile

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "data"
TOP = 50_000


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Webshelf list updater"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read()


def top_sites():
    latest = json.loads(get("https://tranco-list.eu/api/lists/date/latest"))
    raw = get(f"https://tranco-list.eu/download_daily/{latest['list_id']}")
    try:
        text = zipfile.ZipFile(io.BytesIO(raw)).read("top-1m.csv").decode()
    except zipfile.BadZipFile:
        text = raw.decode()
    domains = [line.split(",", 1)[1].strip() for line in text.splitlines()[:TOP] if "," in line]
    header = f"# Tranco list {latest['list_id']} ({latest['created_on'][:10]}), top {len(domains)}. https://tranco-list.eu\n"
    (OUT / "top-sites.txt").write_text(header + "\n".join(domains) + "\n", encoding="utf-8")
    return len(domains)


def ai_sites():
    text = get("https://raw.githubusercontent.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist/main/noai_hosts.txt").decode()
    hosts = sorted({parts[1] for parts in (l.split() for l in text.splitlines()) if len(parts) >= 2 and parts[0] == "0.0.0.0"})
    header = "# uBlockOrigin HUGE AI Blocklist (CC0). https://github.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist\n"
    (OUT / "ai-sites.txt").write_text(header + "\n".join(hosts) + "\n", encoding="utf-8")
    return len(hosts)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    print("top sites:", top_sites())
    print("AI sites:", ai_sites())
