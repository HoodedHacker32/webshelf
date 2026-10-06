# Webshelf click counter

Opt-in click counts for Webshelf's ranking: a [Cloudflare Worker](https://developers.cloudflare.com/workers/) with a [D1](https://developers.cloudflare.com/d1/) (SQLite) database. Visitors who turn on "Help improve results by counting my clicks" in Settings send it each web result they click; their searches then fetch the counts, and pages people chose often move up a little (`WEIGHTS.clicks` in `assets/js/rank.js`). Everyone else sends nothing.

| File | What it does |
|---|---|
| `worker.js` | `POST /click` counts one click; `GET /counts?q=` lists a search's most-clicked pages. Accepts clicks from the Webshelf site only. |
| `schema.sql` | The one table: search code, page, clicks, positions added up, last day clicked and clicks that day. |
| `wrangler.toml` | Cloudflare's settings for the Worker. Request logs are off. |

## What it keeps

One row per search code and page: the code (the first 32 hex digits of a SHA-256 hash of `webshelf-clicks-v1:` plus the search, in lower case), the page's address without anything after `?` or `#`, how many clicks it has had, the positions they were made at (added up), and the date of the latest click with that day's count. One page's count for one search rises by at most 20 a day, which slows anyone trying to push a page up; a page can gain at most `WEIGHTS.clicks` (1.5) in the ranking, less than an official site gets.

No IP addresses, cookies, identifiers or request logs. The privacy notice (`privacy.html#clicks`) says the same for visitors.

## Setting it up (free)

Cloudflare's free plan covers it: 100,000 requests a day for Workers, 100,000 database writes and 5 million reads a day for D1.

1. Create a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. In PowerShell, from this folder (`server/clicks`), sign in. A browser window opens to approve it:
   ```
   npx wrangler login
   ```
3. Create the database:
   ```
   npx wrangler d1 create webshelf-clicks
   ```
   Copy the `database_id` it prints into `wrangler.toml`, replacing `PASTE-THE-DATABASE-ID-HERE`.
4. Create the table:
   ```
   npx wrangler d1 execute webshelf-clicks --remote --file schema.sql
   ```
5. Publish the Worker:
   ```
   npx wrangler deploy
   ```
   It prints the Worker's address, like `https://webshelf-clicks.YOUR-NAME.workers.dev`.
6. Put that address in `assets/js/config.js` (`CLICKS.url`), commit and push. The setting appears in Settings once the site updates.

To check it's working: `https://webshelf-clicks.YOUR-NAME.workers.dev/counts?q=00000000000000000000000000000000` should answer `{"pages":[]}`.

## Changing it

- Allowed sites: `ORIGINS` in `worker.js` (the GitHub Pages site and a local copy on port 8417).
- Daily limit per page and search: `DAILY_CAP` in `worker.js`.
- How much clicks count: `WEIGHTS.clicks` in `assets/js/rank.js`; how many clicks a search needs before they count: `CLICKS.minClicks` in `assets/js/config.js`.
- Publish changes with `npx wrangler deploy` again.
- To delete every count: `npx wrangler d1 execute webshelf-clicks --remote --command "DELETE FROM clicks"`.
