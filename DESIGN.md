---
name: Webshelf
description: An AI-free search engine that looks like the web people already know, with the browser era living only in its controls.
colors:
  link-blue: "#0000ee"
  visited-purple: "#551a8b"
  active-red: "#d40000"
  navy-selection: "#000080"
  selection-ink: "#ffffff"
  ink: "#111111"
  ink-2: "#2b2b2b"
  meta-grey: "#5b5b5b"
  page-white: "#ffffff"
  toolbar-grey: "#e7e7e7"
  plate-grey: "#f3f3f3"
  field-white: "#ffffff"
  hover-grey: "#ececec"
  pressed-grey: "#d8d8d8"
  bevel-hi: "#ffffff"
  bevel-lit: "#d2d2d2"
  bevel-mid: "#c6c6c6"
  bevel-lo: "#8a8a8a"
  bevel-deep: "#3c3c3c"
  rise-green: "#0b7a24"
  fall-red: "#b3141a"
  danger-red: "#b3141a"
  dark-link-blue: "#8fb2ff"
  dark-visited-purple: "#cfa6ff"
  dark-active-red: "#ff7a6b"
  dark-selection-blue: "#3a5bd9"
  dark-ink: "#f0f0ea"
  dark-ink-2: "#d8d8d2"
  dark-meta-grey: "#a4a49e"
  dark-page: "#17171a"
  dark-toolbar: "#24242a"
  dark-plate: "#1f1f24"
  dark-field: "#0e0e10"
  dark-hover: "#2c2c33"
  dark-pressed: "#33333b"
  dark-bevel-hi: "#3a3a42"
  dark-bevel-lo: "#0c0c0e"
  dark-bevel-deep: "#050506"
typography:
  display:
    fontFamily: "Redaction, \"Times New Roman\", Times, serif"
    fontSize: "52px"
    fontWeight: 400
    lineHeight: 1.1
  big-answer:
    fontFamily: "Redaction, \"Times New Roman\", Times, serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "Redaction, \"Times New Roman\", Times, serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
  title-card:
    fontFamily: "Redaction, \"Times New Roman\", Times, serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Redaction, \"Times New Roman\", Times, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Redaction, \"Times New Roman\", Times, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Redaction, \"Times New Roman\", Times, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "\"Redaction 35\", Redaction, \"Times New Roman\", serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1
  label-xs:
    fontFamily: "\"Redaction 35\", Redaction, \"Times New Roman\", serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "\"Courier Prime\", \"Courier New\", monospace"
    fontSize: "14px"
    fontWeight: 400
rounded:
  none: "0"
spacing:
  gutter: "16px"
  page-margin: "36px"
  page-margin-phone: "14px"
  lead-in: "clamp(36px, calc(100vw - 1068px), 250px)"
  center-width: "660px"
  rhs-gap: "52px"
  rhs-width: "320px"
  result-gap: "22px"
components:
  button:
    backgroundColor: "{colors.toolbar-grey}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.hover-grey}"
  button-pressed:
    backgroundColor: "{colors.pressed-grey}"
    padding: "1px 17px 0 19px"
  button-small:
    padding: "0 12px"
    height: "30px"
  field:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "4px 8px"
    height: "36px"
  search-field:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "4px 36px 4px 10px"
    height: "38px"
  toolbar:
    backgroundColor: "{colors.toolbar-grey}"
    padding: "12px 36px"
  raised-plate:
    backgroundColor: "{colors.plate-grey}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
  topic-panel:
    backgroundColor: "{colors.plate-grey}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "10px"
    width: "{spacing.rhs-width}"
  result-title:
    textColor: "{colors.link-blue}"
    typography: "{typography.title}"
  result-address:
    textColor: "{colors.meta-grey}"
    typography: "{typography.mono}"
  listbox-row-selected:
    backgroundColor: "{colors.navy-selection}"
    textColor: "{colors.selection-ink}"
    height: "32px"
  footer:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.meta-grey}"
    typography: "{typography.label}"
    padding: "12px 36px 16px"
---

# Design System: Webshelf

## Overview

**Creative North Star: "Browser White with Toolbar"**

Webshelf looks like the web people already know. The page is plain white, links are underlined #0000ee blue, visited links turn purple and a link flashes red while it is pressed. Body text is a Times-style serif and addresses sit in plain sight in a typewriter monospace. Nothing on the reading surface is styled for its own sake. The browser era shows up only in the controls: a pale grey toolbar band across the top, sunken fields, raised buttons and grooved rules, all with square corners and lit from the top left.

The signature is the bevel grammar. **Raised** means something you press or read about (buttons, answer cards, the topic panel, the "about this result" box). **Sunken** means somewhere you type or look (the search field, inputs, image frames, the calculator display, chart wells). It is used sparingly and the same way everywhere. Dark mode keeps the structure and spacing exactly as they are and only changes the values: a charcoal page, a darker toolbar band, and the same bevels in charcoal.

The owner is a logo designer. The lockup appears exactly as drawn. In dark mode its black parts follow the ink colour and nothing else in it changes. The only brand motion is the leaning blue book in the lockup, which rocks once while results load. Images are always shown in full colour. Nothing in the product is generated by AI.

**Key Characteristics:**
- White page, underlined blue links, purple when visited, red while pressed.
- A pale grey toolbar band holds the lockup, the search field and button, and a Settings link. A grooved rule closes it.
- Raised = things you press or read about. Sunken = where you type or look. Square corners everywhere.
- Redaction serif for reading, its pixel cut Redaction 35 for buttons and labels, Courier Prime for addresses and readouts.
- Numbered results with monospace addresses. The topic panel is a raised plate on the right on wide screens and moves to after the first result on narrower ones, as a fixed-height compact card (76px head: 72px thumbnail, title, one-line description, a "From Wikipedia" credit) with the full account behind a "More about …" button; once opened, the card grows and nothing is truncated.
- Light and dark share one structure. Images are always full colour.

## Colors

The palette is the browser's default page palette plus a family of bevel greys. Colour is reserved for link states and for data.

### Primary
- **Link Blue** (`link-blue`; dark `dark-link-blue`): every link, including result titles, related searches, footer links and source links. Also used for the chart line, the native control accent and the image-frame hover border.
- **Visited Purple** (`visited-purple`; dark `dark-visited-purple`): visited links, and the history rows in the suggestion list.
- **Active Red** (`active-red`; dark `dark-active-red`): a link while it is being pressed. Only there.

### Secondary
- **Navy Selection** (`navy-selection`; dark `dark-selection-blue`): text selection and the highlighted row in the suggestion listbox, with white text (`selection-ink`).
- **Rise Green** (`rise-green`) and **Fall Red** (`fall-red`): rate chart lines and areas, chosen by direction of change.
- **Danger Red** (`danger-red`): a ringing timer and the error state of the settings toast.

### Neutral
- **Ink** (`ink`; dark `dark-ink`): primary text, bold query matches, the focus outline, and the lockup's black parts in dark mode.
- **Ink 2** (`ink-2`; dark `dark-ink-2`): snippets, topic-panel prose, secondary values.
- **Meta Grey** (`meta-grey`; dark `dark-meta-grey`): result numbers, addresses, status line, source lines, help text, placeholders.
- **Page White** (`page-white`; dark `dark-page`): the page and the footer.
- **Toolbar Grey** (`toolbar-grey`; dark `dark-toolbar`): the toolbar band, buttons, tabs, and function keys.
- **Plate Grey** (`plate-grey`; dark `dark-plate`): raised plates, meaning answer cards, the topic panel, tab pages and the toast.
- **Field White** (`field-white`; dark `dark-field`): sunken surfaces such as inputs, image frames, wells and the calculator display. In dark mode it goes darker than the page so sunken surfaces still read as recessed.
- **Hover Grey** / **Pressed Grey** (`hover-grey`, `pressed-grey`; dark `dark-hover`, `dark-pressed`): the hover and pressed fills for buttons and keys.
- **Bevel greys** (`bevel-hi`, `bevel-lit`, `bevel-mid`, `bevel-lo`, `bevel-deep`; dark equivalents): bevel edges, grooved rules and the scrollbar thumb. `bevel-lit` (#d2d2d2) is the lit edge of a sunken surface, because a white edge would disappear against the white page.

Instant answers have their own illustration tokens in `assets/css/tokens.css`: weather sun, cloud, rain, snow and bolt; chart grid; and the six Breakout brick rows. Only the answer each token names uses it.

### Named Rules
**The Default Web Rule.** Links are underlined (1px, 2px offset, 2px on hover), blue, purple once visited and red while pressed. Don't restyle them as buttons or remove the underline on the reading surface.

**The Tokens Only Rule.** Every colour comes from `assets/css/tokens.css`, which defines both themes. The only literals are the colour picker's own black, white and hue gradients, which are data rather than palette.

## Typography

**Body Font:** Redaction (with "Times New Roman", Times, serif), in regular, italic and bold
**UI Font:** Redaction 35, the pixel cut (with Redaction, "Times New Roman", serif)
**Mono Font:** Courier Prime (with "Courier New", monospace)

**Character:** Body text is a Times-style serif, so a page reads like an ordinary web document. The pixel cut is used only for controls and small labels, which keeps the browser-era feel in the controls. Courier Prime makes addresses and numeric readouts look like plain text in an address bar. All fonts are self-hosted under the OFL.

### Hierarchy
- **Display** (400, 52px, 1.1): clocks, the timer and the current temperature. Timer digits and the random-number output use the same size in Courier Prime.
- **Big Answer** (700, 40px, 1.1): the converted currency amount.
- **Headline** (700, 30px, 1.1 to 1.2): topic-panel title, settings page title, dictionary headword, calculator readout (in mono).
- **Title Card** (700, 24px, 1.2): instant-answer headings.
- **Title** (400, 20px, 1.3): result titles (matched terms in bold), the search field text, and section headings at 700 weight.
- **Body** (400, 17px, 1.5): snippets, prose and fields. Snippets clamp to three lines at a maximum width of 64ch.
- **Body Small** (400, 15px): topic-panel prose and facts, the "about this result" text, and some tool details.
- **Label** (Redaction 35, 15px): buttons, tabs, the status line, toolbar links, footer, result numbers.
- **Label XS** (Redaction 35, 13px): source lines, dates, "about" and "Remove" text links, the more-images link.
- **Mono** (Courier Prime, 14px): result addresses, the topic-panel website, calculator history, laps and chart axes (11 to 12px in charts).

Numbers that update in place use tabular figures.

### Named Rules
**The Pixel Cut Is For Controls Rule.** Redaction 35 is for button, tab and label text and small UI lines. Don't use it for reading text or headings.

**The Address In Plain Sight Rule.** Every result shows its address in Courier Prime Meta Grey, with no favicon disc or breadcrumb styling.

## Layout

The results page is a sticky toolbar band above a four-track grid. The tracks are a lead-in of `clamp(36px, 100vw - 1068px, 250px)`, a 660px centre column, a 52px gap and a 320px topic panel. The page margin is 36px. Results are numbered in the lead-in, with each number hanging 10px left of its title. Results are 22px apart. The status line ("Results for ...") is the first line on the page, followed by any instant answer, then the results. The image strip (110px tall frames, scrolling sideways) sits after the third result, and the results list waits up to 1.5 s for the instant answer and topic panel, so nothing ever lands above results already on screen (zero layout shift).

The toolbar grid has a 186px column for the lockup, a search field and button in the centre column, and a Settings link at the far right. Its padding is 12px. A grooved bottom edge (`bevel-lo` line over a `bevel-hi` line) closes it.

The homepage is centred. The lockup is `min(380px, 78vw)` wide, the search box is up to 620px wide 44px below it with 44px controls, and a short Redaction 35 note sits underneath. Settings is a single column that lines up with the results column. Its sections are separated by grooved rules.

Responsive behaviour:
- **At 1099px and below:** the topic panel leaves the right track and sits after the first result as a compact card whose frame is placed as soon as the topic is known, so filling it in never shifts results. The lead-in becomes `max(40px, page-margin + 26px)`.
- **At 759px and below:** the page margin is 14px, the lead-in is 38px, and the toolbar is no longer sticky. The toolbar stacks into two rows: the lockup (132px) and Settings, then a full-width search box. Image frames drop to 92px.
- **At 520px and below (homepage):** the Search button moves below the field, centred, with a minimum width of 140px.
- **Coarse pointers:** buttons, fields, icon buttons, listbox rows and radio/check rows are at least 44px.

Spacing is set per element rather than on a strict scale. Most values fall between 2 and 30px, with 8, 10, 12, 14 and 22px the most common.

### Named Rules
**The Results First Rule.** Nothing pushes the first result below the fold except an instant answer that directly answers the query. When the topic panel is not in the right track, it comes after the first result.

## Elevation & Depth

Depth comes from bevels, not soft shadows. Light comes from the top left. Raised surfaces have light top and left edges and dark bottom and right edges. Sunken surfaces reverse that. The one shadow that is not a bevel edge is a hard 2px drop under the suggestion listbox, the classic floating-menu shadow.

### Shadow Vocabulary
- **Raised plate** (`border: 2px solid; border-color: bevel-hi bevel-lo bevel-lo bevel-hi; box-shadow: 1px 1px 0 bevel-deep`): answer cards, topic panel, tab pages, "about" box, error box, toast.
- **Raised control** (`border-color: bevel-hi bevel-deep bevel-deep bevel-hi; box-shadow: inset -1px -1px 0 bevel-lo`): buttons, keys, tabs, range and day buttons. When pressed it inverts to `bevel-deep bevel-hi bevel-hi bevel-deep` with `inset 1px 1px 0 bevel-lo`, and the label shifts 1px down and right.
- **Sunken** (`border-color: bevel-lo bevel-lit bevel-lit bevel-lo; box-shadow: inset 1px 1px 0 bevel-deep`): fields, the search field, wells, the calculator display, progress tracks. Image frames and chart wells use the same border without the inset line.
- **Groove** (`border-top: 1px bevel-lo; border-bottom/box-shadow: 1px bevel-hi`): the toolbar's bottom edge, the footer's top edge, settings section heads, the topic-panel source divider, the time answer's divider.
- **Listbox drop** (`box-shadow: 2px 2px 0 rgba(0,0,0,0.35)`; dark 0.7): the suggestion listbox only, which also has a 1px `bevel-deep` border.

### Named Rules
**The Raised Or Sunken Rule.** Something you press or read about is raised. Somewhere you type or look is sunken. Ask which one an element is before styling it, and don't give the same element both treatments.

**The Restraint Rule.** Bevels belong on controls and cards only. Reading text, results and the page itself stay flat on white.

## Shapes

All corners are square (`rounded.none`) on every control, card, field and frame. Borders are 2px bevels or 1px grooves. The default action button also has a 1px `bevel-deep` outline, the way default buttons used to. Selected tabs rise 2px and join the page beneath them. The coin in the coin-flip answer is the only round shape, because it is an object rather than a control.

## Components

### Buttons
Raised grey keys in the pixel cut.
- **Shape:** square, 36px tall (30px small, 44px on the homepage and on coarse pointers), 18px side padding.
- **Default:** Toolbar Grey with a raised-control bevel and Ink text in Redaction 35 15px.
- **Default action:** the same button plus a 1px `bevel-deep` outline (Search, Set location, primary answer actions).
- **Hover / Pressed:** Hover Grey on hover. When pressed the bevel inverts, the fill turns Pressed Grey and the label shifts 1px.
- **Focus:** a 2px dotted Ink outline offset 2px, used throughout the system.
- **Disabled:** Meta Grey text.
- **Icon button:** transparent and 36px. On hover it gains the raised bevel and the Toolbar Grey fill.

### Inputs / Fields
- **Style:** a sunken Field White box, 36px tall, square, 17px Redaction text, Meta Grey placeholder.
- **Search field:** 38px (44px on the homepage) with 20px text and a Meta Grey clear button inside the right edge.
- **Focus:** the dotted Ink outline, which is suppressed when the field was focused automatically.
- **Radio / checkbox:** native controls at 18px using the Link Blue accent colour.

### Suggestion Listbox (signature)
A classic listbox directly under the field: Field White, a 1px `bevel-deep` border and the listbox drop shadow. Rows are 32px with Meta Grey glyphs and the completion in bold. History rows are Visited Purple with an underlined "Remove". The highlighted row is a full-width Navy Selection bar with white text.

### Cards / Containers
- **Corner Style:** square.
- **Background:** Plate Grey.
- **Shadow Strategy:** the raised-plate bevel (see Elevation & Depth).
- **Internal Padding:** 12px 14px for answer cards and 10px for the topic panel.
- **Source line:** every card ends with a Label XS Meta Grey line naming its data source.

### Result (signature)
A number in Meta Grey Redaction 35 hangs in the lead-in. Next is a 20px underlined Link Blue title (matched terms bold) that wraps instead of truncating. Below it are the Courier Prime Meta Grey address and a small underlined "about" text button that opens a raised box, then a three-line Ink 2 snippet with matched terms bold in Ink.

### Topic Panel (signature)
A 320px raised plate. It holds a sunken 190px full-colour image frame (logos and drawings are shown whole and contained, not cropped), a 30px bold title, an italic Meta Grey subtitle, the website in Courier Prime, 15px Ink 2 prose, bold fact labels, and a grooved divider above the source line naming Wikipedia and Wikidata and their licences.

### Tabs
Raised Toolbar Grey tabs in the pixel cut, 2px apart. The selected tab rises 2px, takes the Plate Grey fill and joins its tab page (used in weather, timer and similar answers).

### Navigation
- **Toolbar:** Toolbar Grey band, sticky on wide screens, with a grooved bottom edge. Settings is a plain underlined link.
- **Footer:** white, with a grooved top edge, 15px Redaction 35 Meta Grey text, the results-source note on the left and Privacy and Settings links on the right.

### Lockup and Motion
The owner's `logos/lockup.svg` is inlined so that its unstyled (black) paths can take `currentColor` = Ink. Its coloured paths are never touched. In the toolbar it is 186px wide (132px on phones), and on the homepage it is `min(380px, 78vw)`. The leaning blue book rocks once while results load: `rotate(-7deg)` at 35% and back, over 700ms on `cubic-bezier(0.16, 1, 0.3, 1)`, pivoting on its bottom-left corner. It is skipped under reduced motion. Other motion is functional and belongs to tools: the settings toast fades and rises 8px over 200ms, the coin flips over 1.1s, the dice shake for 360ms, and a finished timer blinks. All of it collapses under `prefers-reduced-motion`.

### Instant Answers
Working tools on raised plates inside the results column, built only from the bevel vocabulary. The calculator has seven columns: Field White digit keys, Toolbar Grey function keys, and an outlined equals key. The display is sunken and uses Courier Prime. There are also unit and currency converters (sunken mono value fields, raised range buttons, a sunken chart well), weather (hourly chart, raised day buttons), time, dictionary, timer and stopwatch, coin, dice, random number, colour picker and Atari Breakout.

## Do's and Don'ts

### Do:
- **Do** keep the page white (#17171a in dark) and the links underlined blue, purple when visited and red while pressed.
- **Do** decide raised or sunken before styling anything: raised for what you press or read about, sunken for where you type or look.
- **Do** keep every corner square and every depth cue a bevel or groove.
- **Do** use Redaction for reading, Redaction 35 for controls and labels, and Courier Prime for addresses and readouts.
- **Do** show images in full colour, in sunken frames.
- **Do** use the lockup exactly as drawn. In dark mode only its black parts change, following Ink.
- **Do** keep light and dark identical in structure and spacing. Change values only, through `assets/css/tokens.css`.
- **Do** name the data source on every answer card and on the topic panel.

### Don't:
- **Don't** greyscale, dither, tint or filter result or panel images. Style must never get in the way of finding an image.
- **Don't** alter, recolour (beyond the black parts following Ink), crop or redraw the lockup, and never extend the shelf across the page or toolbar. The owner rejected that.
- **Don't** add any motion other than the book rocking once while results load, apart from tool feedback inside an answer.
- **Don't** round corners, add soft drop shadows, or put the hard listbox drop under anything except a floating list.
- **Don't** bevel the reading surface. Results, snippets and prose stay flat on white.
- **Don't** add an AI summary, AI tab, AI mode, or anything generated by AI.
- **Don't** borrow another search engine's look; Webshelf must not read as a Google copy.

## Topic pages

When a search names something with a Wikipedia article (a person, place, work or organisation) and no instant answer applies, the results page follows the late Google entity layout, built only from Wikipedia, Wikidata and Wikimedia Commons.

- **Header.** It spans the results and panel columns, under the status line. It holds the name (30px, bold), the Wikidata description (italic, meta), and a fixed-height row (210px; 168px on phones) of up to three sunken photos plus two raised quick-fact tiles.
  - **Tiles.** People get an Age tile (or "Died, aged N"); other subjects get their first two facts. Wikidata's inception date is skipped when an opening date exists.
  - **Photos.** JPEG photographs only, compared by file stem so one photo never appears twice. Signatures, logos, maps, flags and coats of arms are skipped.
  - **Phones.** The tiles come first in the sideways-scrolling row.
- **About panel.** It's a raised plate titled "About". It holds the official website, the Wikipedia extract with a link, a facts table (meta labels, grooved row rules), Profiles as raised buttons (Instagram, X, Facebook, YouTube and TikTok, from Wikidata), "People also search for" (up to four relatives, portraits first, initials as fallback), and the source line. Below 1100px it's a fixed-height card after the first result showing the first two facts, with "More about …" opening the rest.
- **Works carousels.** TV shows, Books, Films, Albums and Songs.
  - **Data.** Books are searched as works, not printed editions. Film and TV credits only appear for people with an on-screen occupation.
  - **Cards.** A 116px sunken cover (a free-licence image on the `--image-ground` backdrop) with the title link and year. A card with no cover shows its title once, set inside the box.
  - **No covers at all.** The carousel becomes a two-column text list.
  - **Paging.** Raised previous/next chevron buttons for mouse users; touch screens just swipe.
- **Placement and stability.**
  - The header and panel frames are placed as soon as the topic is known and fill in without changing size.
  - Results wait until the carousels are placed after the third result. The limit is 2.5 s on topic pages, counted from when the topic is known, because the header and photos already show; it's 1.5 s elsewhere, with an absolute ceiling of 4 s.
  - If the carousels arrive later still, they only go where the spot is below the screen.
  - The status line sits above the header.
  - Measured layout shift is 0 at 1440px and at most 0.019 at 390px. The toolbar's search row is held at its final height, so building the search box moves nothing.

## Answers and questions (no AI)

- **Answer box (facts).** Questions with a known shape, such as "how tall is mount everest", "gordon ramsay age", "capital of france" and "who invented the telephone", get a raised plate above the results. It holds a breadcrumb (subject › fact, pixel cut, meta), the answer large (`--text-3xl` bold; `--text-xl` when it's longer than 28 characters), an optional note (for example "Born 8 November 1966"), and links to the Wikidata record and the Wikipedia article. Answers come only from Wikidata statements. For roles someone can leave (spouse, CEO, head of state or government, residence), an ended statement is never shown as current: if every statement has ended, there's no box. Deprecated values, sizes without a unit, a subject listed as its own location and visitor counts more than 15 years old are skipped. When Wikidata holds several values the note says so ("Wikidata lists 4"). The box's accessible name is the question itself. Names fall back to Wikidata's language-neutral labels.
- **Timing.** A fact or definition search holds its results for up to 4 s while the answer loads. An answer that arrives after the results are on screen is dropped rather than pushing them down.
- **Quoted definition.** "What is X" / "who is X" quotes the first two sentences of X's own Wikipedia article, word for word, in a raised plate with a 1px left rule and the subject's words in bold, then "Quoted from X on Wikipedia". It's only shown when the article title is the thing asked about. Open-ended "why" and "how" questions get no answer box: picking passages by keyword rules proved unreliable, and doing it properly needs a trained model, which Webshelf doesn't use.
- **Questions about X.** After result 2 there's a list of up to four `<details>` rows (44px tall, grooved rules, an SVG chevron that turns when open). It's labelled honestly as "Questions about X", not "People also ask", because it's built only from questions Wikidata or Wikipedia can answer. Opening a row loads its answer into a sunken well, with its source and a "Search this question" link; Wikipedia openings are set as a cited blockquote. Rows have a pressed state. Questions never repeat what the page already shows: on a topic page, anything in the header tiles or the facts table is left out. The questions come from Wikidata properties (age, spouse, children, occupation, notable work, birthplace, nationality, education, awards for people; opening date, founding date, founder, CEO, headquarters, products, staff, architect, visitors, location, height, population, capital, language, area and leaders for everything else). Wording follows the property: an opening date is "When did X open?", not "founded". "The" is added only when Wikipedia's own first sentence uses it ("the Eiffel Tower", "the telephone").
- **Spelling.** "Did you mean" only appears when none of Wikipedia's top articles shares a word with the search.

## Tabs, Images and Videos

- **Tabs.** All, Images and Videos sit under the search box as a classic tab control: inactive tabs are raised chrome-grey tabs; the current tab is white, bold and taller, and breaks through the toolbar's bottom edge into the page. Each tab is its own page (`search.html`, `images.html`, `videos.html`) sharing the toolbar, and a search from a tab stays on that tab. On phones the tabs run on their own row and scroll sideways if they ever outgrow it.
- **Images.** Justified rows: every tile is 180px tall (110px on phones) and as wide as its shape, with the title and site underneath. Images are never cropped into squares, recoloured or dithered. A tile opens a raised viewer window over a dimmed page: the large image on the image ground, its title, creator and licence (both linked), "Visit <site>" and "Open full image". Arrow keys page through the images. Openverse supplies openly licensed images; Wikimedia Commons fills in if Openverse refuses.
- **Videos.** The web result shape (title, address, snippet) with a 168×94 sunken thumbnail, a play mark and the running time in a dark tag, and a meta line "Site · channel · age". Sources take turns (YouTube, Dailymotion, PeerTube, Internet Archive) so no one site fills the page. On phones the thumbnail goes full width above the text.

## Market summary

- Shares ("aapl", "apple stock", "$tsla", "nasdaq: nvda") and coins ("bitcoin", "eth price") get a raised plate: "Market summary › Name", exchange and ticker, the price large, the change in green or red with ▲/▼, the time and the source, then range buttons (1D to Max), a sunken chart and a two-column table of key figures. The 1D chart has a dashed previous-close rule. The chart is drawn at its shown width so its axis text stays its real size.
- A bare ticker only counts when it is a real symbol and not a dictionary word, so "cat" and "meta" stay ordinary searches. Shares need a Twelve Data key (`MARKET.twelveDataKey` in `assets/js/config.js`); without a working key the card is simply left out.

## Phones

- Below 760px the page has 16px gutters and results use the full width: each result's number moves into its title line.
- The topic header keeps its 210px: a row of photos (first one wider) with the quick-fact tiles in a row beneath. Free cover images that aren't poster-shaped (usually logos) are fitted inside the cover frame rather than cropped.

## Ranking and band panels

- **Ranked results.** The footer names the engines used ("Web results from Bing and Mwmbl, ranked by Webshelf") and links to Settings → How results are ranked. It also says how many AI content-farm results were left out. An official website added because no engine found it reads "<Name> – official website", with "Official website, as listed by MusicBrainz/Wikidata" in its About line.
- **Band panel.** For a band or artist with no Wikipedia article, the About plate is titled with the artist's name and carries a one-line description (Band · country · since year), the official site, **Listen** and **Profiles** rows of small raised buttons, and "From MusicBrainz (CC0)". It uses the same compact card on phones, credited "From MusicBrainz".
- **Posters.** Film and TV covers are posters (TVmaze for TV, the Wikipedia article's poster for films); a "Posters from TVmaze" credit sits under a carousel that uses them. Non-poster images are still fitted inside the frame.

## Images, videos and answer-box searches (October 2026 pass)

- **Images tab.** Two usage-rights buttons sit above the grid: "All images" (default: Bing Images, Openverse and Commons through the search server) and "Free to reuse" (openly licensed only, from Openverse, with creator and licence). The current one is pressed in. A question searches for its subject ("how tall is the eiffel tower" shows the tower, not clip art of "tall"). If a thumbnail fails, the original image loads instead.
- **Image row on the All tab.** Up to twelve Bing images after result 3, each opening the Images tab, with "More images for …" under them; Commons is the fallback. Its request starts with the page so it's ready with the results.
- **Videos tab.** Bing Videos (which covers YouTube) leads, three results per turn, then Dailymotion, PeerTube and Vimeo through the server; the Internet Archive takes a turn, matched on titles only.
- **Web results under answer boxes.** When an answer box understood the search, the web results are searched with a clean version of it: "EUR to GBP exchange rate", "convert miles to kilometers", "AAPL stock".
- **Topic header.** Commons photos load at 500px; a lone fact tile centres its text.

