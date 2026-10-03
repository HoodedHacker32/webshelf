---
version: 1
slug: "search-html"
primary_target: "search.html"
related_targets: ["index.html","settings.html"]
---

## Scope

The search surfaces of Webshelf: results page (`search.html`, primary), homepage (`index.html`) and settings (`settings.html`). Visitor mode: Operate. Phones and desktops are equal targets; light and dark themes are both required.

## Audience and job

People who want search the way it was before AI summaries. Job: type a query, scan a results list or use an instant answer, leave. Constraint: static site, browser-callable free data only, no AI anywhere.

## Direction contract

THESIS: Browser White with toolbar. A white page that feels like the web people already know (underlined link blue, visited purple, a Times-style serif, plain addresses), with the browser era living only in its controls: a pale grey toolbar band, sunken fields, raised buttons, grooved rules. It refuses Google's look, the AI-era chat aesthetic, and any style that gets in the way of seeing results or images.

OWN-WORLD: Light: white page #ffffff, toolbar band #e7e7e7, ink #111111, meta #5b5b5b, link #0000ee, visited #551a8b, active link red, bevel greys (white highlight, #8a8a8a shadow, #3c3c3c deep edge), raised plates #f3f3f3. Dark: page #17171a, toolbar #24242a, ink #f0f0ea, link #8fb2ff, visited #cfa6ff, the same bevel grammar in charcoal. Type: Redaction (body, titles, italic), Redaction 35 pixel cut for button and label text, Courier Prime for addresses. Navy selection highlight, dotted focus outline. Images always full colour. The owner's lockup exactly as drawn; black parts turn light in dark mode.

STORY: The visitor recognises an honest web page, types, reads underlined results with addresses in plain sight, uses a tool inline when one answers the query, and leaves. Sources are named on every card.

FIRST VIEWPORT: A pale grey toolbar band holds the owner's lockup at left, a sunken search field and a raised Search button, and a Settings link at right; a grooved rule closes it. Below on white: a status line in the pixel cut, an instant answer when one matches, then numbered underlined results with monospace addresses, with a full-colour image strip after the third result when the query has images (nothing is ever inserted above results already on screen); the topic panel as a raised plate at right on wide screens; below 1100px a fixed-height compact card after the first result (thumbnail, title, one-line description, "More about …" opens the full account). Topic searches (a person, place, work or organisation with a Wikipedia article) follow the late Google entity layout: a full-width header with the name, description, up to three sunken photos and two raised quick-fact tiles (age, spouse, founded, height); then results with works carousels (TV shows, books, films, albums) after the third result; the About panel at right holds the description, a facts table, profiles and "People also search for". Signature move: the bevel grammar (sunken = where you type or look, raised = what you press or read about), applied with restraint to every control and answer card. Motion grammar: one moment only, the logo's leaning blue book rocks once while results load (none under reduced motion).

FORM: Steered direction, pinned by the owner over three decision rounds on 2026-10-02/03 (seed cb6daf0f, re-roll 1 and two steered rounds): "Browser White with toolbar", chosen from the decision page. Owner's steers: "safer", "less grey, more white, I want it to still look like the web people are used to", images must not be greyscaled or dithered ("when style starts to affect usability there's a problem"), and the lockup must not be altered (the extended-shelf experiment was rejected). Build path: code-led (no image generation); decision comp `.impeccable/mocks/decision/white2-b.webp` is the critique reference.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Web results source: placeholder provider (Mwmbl) until the owner picks one API as the backend.
