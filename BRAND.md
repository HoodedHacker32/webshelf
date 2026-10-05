# Webshelf brand

Webshelf's code is open source under the GNU AGPL 3.0 (see `LICENSE`). Its
name and logos are not. They are © 2026 HoodedHacker32, all rights reserved,
and this page says how you may use them.

## What the brand covers

- The name **Webshelf**.
- The logo art in `logos/`: the drawn originals (`logo.svg`, `icon.svg`,
  `wordmark.svg`, `lockup.svg`) and the pixel-art versions used on the site
  (`pixel-lockup.svg`, `pixel-icon.svg`).
- Images made from the logo: the icons and social preview image in
  `assets/icons/`.

## Who designed it

The Webshelf name, logo and brand were designed by a human: the project's
owner, a logo designer. The pixel-art logo on the site is the owner's own logo
redrawn on a pixel grid; the owner chose the style and approved every change,
and the redrawing was done in code (`tools/build_pixel_logo.py`). No image
generator was used for any of it.

## Using the name and logo

**Fine without asking**

- Using the unchanged logo or the name to refer to Webshelf: in an article, a
  review, a list of search engines, a link or a button that leads to Webshelf.
- Screenshots of Webshelf that show the logo as it appears.

**Not allowed**

- Using the name or logo for a modified version or a fork of Webshelf,
  whether it's a website, an app or a download.
- Changing the logo (recolouring, redrawing, cropping, adding to it) or using
  parts of it in your own logo.
- Using the name or logo in a way that suggests Webshelf made, approves or is
  connected with something it isn't.
- Using a confusingly similar name or logo for a search product.

## If you fork Webshelf

The AGPL lets you use, change and run the code, as long as you share your
changes under the same licence. Before you publish a fork:

1. Give it a different name. The name is set in one place:
   `SITE.name` in `assets/js/config.js`.
2. Replace the logo files in `logos/` and the icons in `assets/icons/` with
   your own.
3. Point `SITE.repoUrl` and the footer links at your own repository.

Saying your fork is "based on Webshelf", with a link here, is welcome.

## Anything else

For any use not covered here, ask first by opening an issue at
<https://github.com/HoodedHacker32/webshelf/issues>.
