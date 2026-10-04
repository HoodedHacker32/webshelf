"""Build the pixel-art logo files: logos/pixel-lockup.svg and logos/pixel-icon.svg.

The icon is drawn on a 48 x 48 grid (cobweb, three books, shelf). The name is
"webShelf" in Redaction 35 (the pixel-degraded cut of Redaction, already in
assets/fonts), rasterised onto the same grid so the letters are made of the
same pixels as the books, then stored as shapes: the SVG needs no font.
"Shelf" is emboldened the way bitmap systems did it: each letter drawn again
one pixel to the right.

Rasterising needs a browser for the font, so this runs Playwright against the
local preview server:  python tools/build_pixel_logo.py
"""
import math
import pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "http://localhost:8417"
INK = "ink"
BLUE = {"main": "#3399FF", "light": "#99CCFF", "dark": "#0066CC", "label": "#CCE5FF"}
GREEN = {"main": "#33CC33", "light": "#99FF99", "dark": "#009900", "label": "#CCFFCC"}
ORANGE = {"main": "#FF9900", "light": "#FFCC66", "dark": "#CC6600", "label": "#FFE5B3"}


def icon_pixels():
    """{(x, y): colour}, with INK for the parts that follow the text colour,
    and ('blue', colour) for the leaning book, which the site animates."""
    px = {}
    for i in range(2, 19):
        px[(2, i)] = INK
        px[(i, 2)] = INK
    for i in range(2, 14):
        px[(i, i)] = INK
    # Each ring is made of separate threads, one between each pair of spokes
    # (left edge to diagonal, diagonal to top edge), each sagging in towards the
    # corner, so they meet at the diagonal in a scallop, as in the owner's drawing.
    corner = (2, 2)
    for d in (8, 15):
        left, diag, top = (2, 2 + d), (2 + d * 0.72, 2 + d * 0.72), (2 + d, 2)
        for p0, p1 in ((left, diag), (diag, top)):
            mid = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
            ctrl = (mid[0] + (corner[0] - mid[0]) * 0.32, mid[1] + (corner[1] - mid[1]) * 0.32)
            for i in range(61):
                t = i / 60
                x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * ctrl[0] + t * t * p1[0]
                y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * ctrl[1] + t * t * p1[1]
                px[(round(x), round(y))] = INK

    def book(x0, top, lean, c, tag=None):
        for y in range(top, 40):
            o = round((39 - y) * lean)
            for x in range(8):
                colour = c["main"]
                if x == 0:
                    colour = c["light"]
                if x == 7 or y == top:
                    colour = c["dark"]
                if y in (top + 3, top + 4, 34, 35) and 0 < x < 7:
                    colour = c["dark"]
                if top + 8 <= y <= top + 11 and 2 <= x <= 5:
                    colour = c["label"]
                px[(x0 + x + o, y)] = (tag, colour) if tag else colour

    book(5, 16, 0.27, BLUE, "blue")
    book(19, 10, 0, GREEN)
    book(29, 12, 0, ORANGE)
    for x in range(2, 44):
        px[(x, 40)] = "#CC9966"
        for y in (41, 42, 43):
            px[(x, y)] = "#996633"
        px[(x, 44)] = "#663300"
    return px


RASTER = """
async ({ parts, size }) => {
  const face = new FontFace('Redaction 35', 'url(/assets/fonts/redaction-35-latin-400-normal.woff2)');
  await face.load();
  document.fonts.add(face);
  const canvas = document.createElement('canvas');
  canvas.width = 220; canvas.height = 48;
  const g = canvas.getContext('2d');
  g.font = `${size}px "Redaction 35"`;
  g.textBaseline = 'alphabetic';
  const out = [];
  let x = 0;
  for (const { text, bold, tag } of parts) {
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#000';
    g.fillText(text, 1, 37);
    if (bold) g.fillText(text, 2, 37);
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let right = 0;
    for (let yy = 0; yy < canvas.height; yy++) for (let xx = 0; xx < canvas.width; xx++) {
      if (data[(yy * canvas.width + xx) * 4 + 3] > 110) { out.push([x + xx, yy, tag]); right = Math.max(right, xx); }
    }
    x += right + 2;
  }
  return out;
}
"""


def text_pixels(page):
    pixels = page.evaluate(RASTER, {"size": 27, "parts": [
        {"text": "web", "bold": False, "tag": "web"},
        {"text": "Shelf", "bold": True, "tag": "shelf"},
    ]})
    return {(x, y): tag for x, y, tag in pixels}


def runs(px, keyfn):
    """Merge each row's neighbouring pixels of the same kind into one rect."""
    rows = {}
    for (x, y), v in px.items():
        rows.setdefault(y, []).append((x, keyfn(v)))
    out = []
    for y in sorted(rows):
        cells = sorted(rows[y])
        start, prev, kind = cells[0][0], cells[0][0], cells[0][1]
        for x, k in cells[1:] + [(None, None)]:
            if x is not None and x == prev + 1 and k == kind:
                prev = x
                continue
            out.append((start, y, prev - start + 1, kind))
            if x is not None:
                start, prev, kind = x, x, k
    return out


def rect(x, y, w, kind):
    if kind == INK:
        return f'<rect x="{x}" y="{y}" width="{w}" height="1"/>'
    r, g, b = int(kind[1:3], 16), int(kind[3:5], 16), int(kind[5:7], 16)
    return f'<rect x="{x}" y="{y}" width="{w}" height="1" style="fill:rgb({r},{g},{b})"/>'


def svg_doc(width, body, label):
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg viewBox="0 0 {width} 48" width="{width * 4}" height="192" xmlns="http://www.w3.org/2000/svg" '
        f'shape-rendering="crispEdges" role="img" aria-label="{label}">\n'
        f'{body}\n</svg>\n'
    )


def icon_body(px):
    blue = {k: v[1] for k, v in px.items() if isinstance(v, tuple)}
    rest = {k: v for k, v in px.items() if not isinstance(v, tuple)}
    return (
        '  <!-- Cobweb (follows the text colour), books and shelf. -->\n  <g>'
        + "".join(rect(*r) for r in runs(rest, lambda v: v))
        + '</g>\n  <!-- The leaning blue book, rocked by the site while it loads. -->\n  <g data-book="blue">'
        + "".join(rect(*r) for r in runs(blue, lambda v: v))
        + "</g>"
    )


def main():
    icon = icon_pixels()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"{BASE}/index.html")
        text = text_pixels(page)
        browser.close()

    left = 52
    web = {(x + left, y): INK for (x, y), tag in text.items() if tag == "web"}
    shelf = {(x + left, y): INK for (x, y), tag in text.items() if tag == "shelf"}
    width = max(x for x, _ in text) + left + 2
    lockup = svg_doc(width, icon_body(icon)
        + '\n  <!-- "web" (lighter) and "Shelf": Redaction 35 on the pixel grid. -->\n  <g opacity="0.62">'
        + "".join(rect(*r) for r in runs(web, lambda v: v)) + '</g>\n  <g>'
        + "".join(rect(*r) for r in runs(shelf, lambda v: v)) + "</g>", "Webshelf")
    (ROOT / "logos" / "pixel-lockup.svg").write_text(lockup, encoding="utf-8")
    (ROOT / "logos" / "pixel-icon.svg").write_text(
        svg_doc(46, icon_body(icon), "Webshelf").replace('viewBox="0 0 46 48" width="184" height="192"', 'viewBox="0 0 46 48" width="184" height="192"'),
        encoding="utf-8")
    print("lockup width", width, "| sizes", len(lockup), "bytes")


if __name__ == "__main__":
    main()
