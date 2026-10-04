"""Render the PNG icons and the social preview image from the pixel logo.

  assets/icons/icon-192.png, icon-512.png  app icons (web manifest)
  assets/icons/apple-touch-icon.png        180 x 180, for iOS home screens
  assets/icons/og-image.png                1200 x 630, link previews

Run after tools/build_pixel_logo.py, with the local preview server running:
  python tools/build_icons.py
"""
import pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icons"
BASE = "http://localhost:8417"

ICON = """<body style="margin:0;background:#fff;display:grid;place-items:center;width:{s}px;height:{s}px">
<img src="{base}/logos/pixel-icon.svg" style="width:{w}px;image-rendering:pixelated"></body>"""
CARD = """<body style="margin:0;background:#fff;display:grid;place-items:center;width:1200px;height:630px">
<img src="{base}/logos/pixel-lockup.svg" style="width:880px;image-rendering:pixelated"></body>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
            page = browser.new_page(viewport={"width": size, "height": size})
            # Whole pixels: the 46-wide grid scaled by an integer, with a margin.
            scale = max(1, int(size * 0.78) // 46)
            page.set_content(ICON.format(s=size, w=46 * scale, base=BASE))
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / name))
        page = browser.new_page(viewport={"width": 1200, "height": 630})
        page.set_content(CARD.format(base=BASE))
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "og-image.png"))
        browser.close()
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
