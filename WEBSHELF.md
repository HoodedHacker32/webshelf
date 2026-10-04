# Webshelf

An open-source search engine front end that brings back the look and behaviour of Google search from about 2020 to early 2023, before AI Overviews. Results first, and no AI anywhere: no summaries, no AI tab, no AI mode.

Hosted as a static GitHub Pages site on a `github.io` subdomain (no custom domain planned).

- **Name:** Webshelf. Chosen by the owner on 2026-10-02. Naming is closed; do not reopen it.
- **Owner:** a logo designer, who is building this as an open-source project.
- **Logo and visual identity:** the owner's own work. Files go in [`logos/`](logos/). Do not design, sketch or suggest logos, wordmarks, icons or brand visuals. Names, research and reference material are fine.

---

## 1. Decisions so far

| Decision | Detail |
|---|---|
| Target era | Google desktop search from January 2020 (the redesign) to April 2023. The newest "classic" look is about November 2022 to April 2023. Google first showed its AI search prototype (SGE) on 10 May 2023, Bard became Gemini in February 2024, AI Overviews launched in May 2024. |
| AI | None at all. No AI tab or mode either (owner, 2026-10-02). |
| Hosting | GitHub Pages, open source. Domains do not matter. |
| Name | Webshelf (see section 3 for the known conflict). |
| Logo | Owner designs it. A shelf of books plus a cobweb is the concept they have in mind. |
| Fonts | The owner asked about Titillium Web and Josefin Sans. Both are under the SIL Open Font License 1.1, so they can be used in logos, including commercially. See the font notes below. |
| Logo files | `logos/logo.svg` (mark, the favicon), `icon.svg` (mark with name), `wordmark.svg`, `lockup.svg` (homepage and toolbar). Used exactly as drawn; only the black parts follow the text colour in dark mode, and the leaning blue book rocks once while results load. The owner rejected extending the shelf across the page. |
| Stack | Plain static HTML, CSS and JavaScript (ES modules), no build step. See section 6. |
| Look | **Browser White with toolbar**, chosen by the owner through Impeccable's direction rounds on 2026-10-02/03: a white page that reads like the web people know (underlined link blue, visited purple, Redaction serif, Courier Prime addresses); the browser era lives only in the controls (pale grey toolbar band, sunken fields, raised buttons, grooved rules). Full-colour images. Light and dark themes. Recorded in `.impeccable/surfaces/search-html.md` and `DESIGN.md`. |
| Instant answers | Kept: calculator, unit converter, currency, weather, time zones, dictionary, timer and stopwatch, coin flip, dice, random number, colour picker. |
| Easter eggs and games | All removed except Atari Breakout (query `atari breakout`). |
| "I'm Feeling Lucky" | Not included. |
| Stocks | Market summary card with chart. Shares: Twelve Data (free key in `assets/js/config.js`; the placeholder `demo` key only covers AAPL). Coins: CoinGecko, keyless. Yahoo, Stooq, Nasdaq and Cboe all block browser calls. |
| Ranking | Webshelf ranks results itself (`assets/js/rank.js`, rules only, no AI): engine agreement (reciprocal-rank fusion), Tranco top-50,000 popularity, all-words and title match, navigational addresses, and the official website from Wikidata or MusicBrainz (added first if no engine found it). AI content farms (HUGE AI Blocklist) are left out. Lists refresh with `tools/update_lists.py`. |
| Bands | MusicBrainz panel (official site, Listen, Profiles) when Wikipedia has no article. |
| Posters | TV from TVmaze by IMDb id; films use the poster image Wikipedia's article uses. No keys or accounts. |
| Tabs | All, Images (Openverse, Commons fallback), Videos (YouTube links via Mwmbl, Dailymotion, PeerTube via SepiaSearch, Internet Archive). |
| Results backend | Our own SearXNG server on Oracle Cloud's Always Free tier, behind Caddy (`server/`, walkthrough in `server/README.md`). Until `BACKEND_URL` is set in `assets/js/config.js`, the site uses Mwmbl directly. |

### Font notes (SIL OFL 1.1; not legal advice)
- Commercial use is allowed. No credit is needed in or beside a logo.
- Converting text to outlines and redrawing, cutting or joining letters is the owner's own artwork. The licence's rules on modified versions only apply if an edited **font file** is shared.
- **Titillium Web:** copyright 2009-2011 Accademia di Belle Arti di Urbino and students of its MA in Visual Design. No Reserved Font Name.
- **Josefin Sans:** copyright 2010 The Josefin Sans Project Authors. Reserved Font Name "Josefin Sans", so an edited font file would have to be renamed.
- If a font file is handed to someone, include the OFL and copyright notice with it. Vector outlines need no paperwork.

---

## 2. Research: classic Google, from the Wayback Machine

Everything is in [`research/`](research/). See [`research/README.md`](research/README.md) for the folder map.

**Published board:** https://claude.ai/artifact/6rDHBppXhTUfdoFAsxzQxS (private; opens for the owner only). It shows the screenshots by feature, design tokens and the query catalogue. Its "Name ideas" section is out of date; ignore it.

### What is ready
| Item | Count | Location |
|---|---|---|
| Full-page screenshots (1440px wide) | 99 | `research/screenshots/` |
| Raw archived HTML with Google's real markup and inline CSS | 100 | `research/html/` |
| Queries that have a usable capture | 97 of 142 tried | `research/index/captures*.json` |
| Design tokens from the April 2022 CSS | 1 file | `research/design-tokens-2022.md` |
| Catalogue of features and the queries that trigger them | 1 file | `research/feature-test-queries.md` |
| Scripts used to find and capture pages | 5 files | `research/tools/` |

Files are named `<query>_<yyyymmdd>`. Dates run from January 2019 to the end of April 2023. One exception: `cats-vid_20230720` (Videos tab) was captured after SGE appeared; the Videos tab is probably unaffected, but check before copying it.

### What the captures cover
Homepage (October 2021 and March 2023); stocks (AAPL, Tesla, Nvidia knowledge panel); calculator (2+2, 5*5, 100/4, calculator); dictionary; translate; unit converter; currency and Bitcoin; weather; time zone, timer, stopwatch; coin flip, dice, random number, spinner, colour picker, metronome, guitar tuner, breathing exercise, bubble level; knowledge panels for people (Gordon Ramsay, Obama, Elon Musk, Taylor Swift, Drake, Billie Eilish, the Beatles), companies (Apple, Nvidia), places (Eiffel Tower, France), film, TV and book; sports (Premier League, Manchester United, Lakers, World Cup); news, COVID and election results; flights; local pack ("near me"); shopping; recipes; nutrition; health; image pack; video tab; easter eggs (barrel roll, askew, recursion, anagram, Thanos, zerg rush, blue moon, Friends); games (Snake, Pac-Man, Minesweeper, Solitaire, dinosaur game).

### Gaps (no usable capture found)
These were rarely archived in the full desktop layout:
- **Featured snippets** (the answer box above results): "how tall is mount everest", "how to tie a tie", "how to boil an egg", "what is the capital of australia" and others. This is the biggest gap.
- **Direct answers:** "how old is the queen", "who is the president of the united states", and similar.
- **Graphing** (`sin(x)`, `graph x^2`), **math solver**, **Images tab** (cats, eiffel tower), **News tab** for nvidia, **Maps tab**, **video carousel**.
- **Spelling correction** ("speling"), **holiday dates** ("when is easter"), **tic tac toe**, **google in 1998**, **tuner**, **flight status**, **"flights to paris"**.
- **Currency:** "1 usd to eur", "dollar to euro" (USD to GBP and EUR to USD exist).

If more are needed, the Wayback Machine may hold them under different phrasings, or they can be built from the descriptions in `feature-test-queries.md`.

### How the captures were made (and why some were rejected)
- The CDX index at `web.archive.org/cdx/search/cdx` listed captures of `google.com/search?q=<query>`; the newest English capture before 1 May 2023 was preferred.
- Google often served the archive's crawler a stripped-down legacy layout (capitalised tabs, card-style results, no charts). Real desktop pages contain the `#rcnt` results container, and only those were kept. The homepage had the same problem; the two kept homepages are the full versions.
- **Screenshots must be taken with JavaScript enabled** and with requests to non-archive hosts blocked. With JavaScript off, Google shows a "turn on JavaScript" page, and the archive's replay fails on its own scripts. `research/tools/shoot.py` does this.
- `research/html/nvidia_20201111.html` is a German-language capture; the other Nvidia files are English.
- **archive.org rate-limits hard.** It blocked this IP for about an hour after a burst of parallel requests. Use one request every few seconds, single-threaded. `research/tools/wayback.py` caches responses and backs off.
- Scripts expect to be run from the scratch directory they were written in. `find_captures*.py` reads a `PROJECT` environment variable for the output folder and imports `wayback.py`; adjust paths before reuse.

### Design tokens (April 2022, from archived CSS)
Full table in `research/design-tokens-2022.md`. Key values:
- Body: Roboto/Arial, 14px, line-height 1.58. Result titles 20px. Headings use Google Sans (proprietary; Outfit, Manrope or Figtree are open substitutes).
- Text `#202124`, secondary `#70757a`, snippet `#4d5156`, link `#1a0dab`, visited `#609`, accent `#1a73e8`, surface `#f8f9fa`, divider `#dadce0`.
- Search box: 44px tall, 690px wide, radius 24px, shadow `0 2px 5px 1px rgba(64,60,67,.16)`.
- Results column about 652px; knowledge panel about 370px with a 1px border and 8px radius.

---

## 3. Name: history and known risk

**Chosen: Webshelf.** The owner picked it for the logo possibilities (a shelf of books and a cobweb) and the idea of a library or shelf of the web.

**Known conflict (the owner has accepted this):**
- [WebShelf](https://apps.apple.com/us/app/webshelf/id1548005930), an iPad app by Steven Sipe of [TechCreations4u](https://www.tc4u-software.com/home/webshelf), organises the web into Libraries, Bookcases, Shelves, Books and Pages. Same name, same space.
- A second App Store app called WebShelf (SHIGEMITSU RYOMA), a [Chrome extension](https://chromewebstore.google.com/detail/webshelf/oeddmgmjpieniladdjlahmpmdanlalcc) that shows bookmarks as a shelf, and about 30 GitHub repos use the name. The `webshelf` account on GitHub is taken.
- No trademark register was searched, because the free ones are behind bot checks. Registration status is unknown.
- The correct legal term is **trademark**, not copyright. Copyright does not protect a name.

**Cheap ways to lower the risk** (not legal advice):
1. Keep the name in one config value so a later rename is a one-line change.
2. Stay off app stores; a plain GitHub Pages site is far less visible to the iPad app's owner.
3. Avoid the iPad app's wording ("libraries", "bookcases", bookmarking features) in descriptions.

**Names the owner rejected:** Verbatim, Cached, Bluelinks, and Spectr (the owner's earlier privacy-search project, which did not work properly; do not reuse it or imitate its style). Dustjacket was judged "not a search engine name". Most of the real-word and coined lists were also rejected.

**Considered but not chosen:** Querty, Lucky, Plainsight, Tenlinks, Rewind, Orrery, Carrel, Calder, Étagère, Pluteus, Cobshelf, Webnook, and the candidates in [`research/names/candidates.md`](research/names/candidates.md), which also records why each excluded name was dropped.

---

## 4. Working preferences (from the owner)
- Never create logos or brand visuals (the reason `logos/` is the owner's folder).
- Stop being clever about naming; prefer volume plus automated checks, then a full check on the one they pick. Done; the name is chosen.
- Do not run long jobs without saying so. A 27-minute local-model run was cut as "too long, will go nowhere".
- Local Ollama is available: `gpt-oss:20b` runs split about 58% CPU / 42% GPU on the 8 GB RTX 5060, so it is slow (about 2 minutes per 70 short items). Avoid the `-cloud` model, which sends prompts to an outside service.

---

## 5. Open questions and next steps

1. **Where do web results come from?** Still undecided (owner, 2026-10-02: "placeholder for now, we'll wire in an API later with more research"). Findings so far, checked on 2026-10-02:
   - Bing's API was retired in August 2025. Google's Custom Search JSON API is closed to new users and shuts down on 1 January 2027.
   - Brave dropped its free tier in February 2026 (now $5 of monthly credit, card required).
   - Mwmbl's v1 API is free, keyless and CORS-enabled, with rough but usable results. It's the current placeholder. Its maintainers plan usage tiers (mwmbl/mwmbl issues 410 to 412).
   - Marginalia gives free non-commercial keys by email. Its shared `public` key is constantly rate-limited.
   - SearXNG needs a server. Free cloud servers get CAPTCHA-blocked by most engines, and the owner rejected the hosting options offered for now.
   - To add a source, write a file in `assets/js/providers/` and register it in `providers/index.js`.
2. **Stocks:** get a free Twelve Data key, or proxy share prices through our own server once it exists.
3. **Design:** settled (see section 1, "Look"). Tokens live in `assets/css/tokens.css`.
4. **Research stays private:** `research/` is git-ignored because it holds archived Google pages; never publish it.
5. **Fill the capture gaps** above if more reference is needed, starting with featured snippets.
6. **Publish:** create the GitHub repository, set `repoUrl` in `assets/js/config.js`, and turn on GitHub Pages.

## 6. The site

Plain static files; open them through any local web server (ES modules don't load from `file://`):

```
python -m http.server 8417
```

| Path | What |
|---|---|
| `index.html`, `search.html`, `settings.html` | Homepage, results page (`search.html?q=`), settings. |
| `assets/css/tokens.css` | Every colour, font, radius and shadow. Placeholders until the owner's palette arrives. |
| `assets/js/config.js` | Site name, repository link, default results provider. |
| `assets/js/providers/` | Web results sources (Mwmbl placeholder, Wikipedia-only). |
| `assets/js/answers/` | Instant answers, one file each; `answers/index.js` sets their order. |
| `assets/js/wiki.js` | Wikipedia and Wikidata: suggestions, "Did you mean", knowledge panel. |
| `PRODUCT.md`, `.impeccable/` | Impeccable's product record, direction contract and review captures. |

Data sources the browser calls, all free: Mwmbl (results), Wikipedia and Wikidata, Wiktionary, Open-Meteo, Frankfurter (European Central Bank rates), Openverse (images), Dailymotion, SepiaSearch and the Internet Archive (videos), CoinGecko (coins) and Twelve Data (shares, needs a free key). Settings and search history live in the visitor's browser only.
