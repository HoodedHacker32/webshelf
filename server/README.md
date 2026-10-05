# Webshelf search server

Webshelf's web results come from this server: [SearXNG](https://docs.searxng.org), which asks several independent search engines at once and merges what they find. [Caddy](https://caddyserver.com) sits in front of it. Caddy provides HTTPS, lets the Webshelf site read the results, and holds the Twelve Data key for share prices.

There are two ways to run it:

- **The live setup: one container on Render** (`container/`). Render builds `container/Dockerfile` from this repo (root directory `server/container`, free plan, Virginia region, environment variable `PORT=7860`). Render provides HTTPS, so Caddy only adds the browser-access headers and the share-price proxy. The free plan sleeps after 15 minutes without visits; the site falls back to Mwmbl while it wakes, and `.github/workflows/keep-awake.yml` visits it through the day. Optional environment variable: `TWELVE_DATA_KEY` (without it, share prices use Twelve Data's `demo` key, which only covers AAPL).
- **A virtual machine** (`compose.yaml`, `setup.sh`), for example Oracle Cloud's Always Free tier, which needs a card to sign up. Steps below.

Both use the same engine list.

| File | What it does |
|---|---|
| `compose.yaml` | Runs SearXNG, Valkey (SearXNG's rate limiter store) and Caddy. |
| `Caddyfile` | HTTPS, browser access for the Webshelf site only, and the `/market/` proxy to Twelve Data. |
| `searxng/settings.yml` | Which engines are used, JSON output, safe search, the rate limiter. |
| `searxng/limiter.toml` | Rate-limiter settings. |
| `setup.sh` | Installs Docker, opens the firewall, writes `.env` and starts everything. |

`.env` is created on the server and never committed. It holds the secret key and the Twelve Data key.

## 1. Create the server (Oracle Cloud)

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/). Oracle asks for a card to verify you, but Always Free resources are never charged.
2. **Pick your home region carefully, because it can't be changed later.** Always Free servers only run in the home region. From Ireland, *UK South (London)*, *Netherlands Northwest (Amsterdam)* or *Germany Central (Frankfurt)* are close. If one is full, the others often have room.
3. In the console, go to **Compute → Instances → Create instance**:
   - **Image:** Canonical Ubuntu 24.04.
   - **Shape:** Ampere `VM.Standard.A1.Flex` with 1 OCPU and 6 GB memory, which is plenty. If Oracle says *Out of capacity*, try again later or another availability domain. `VM.Standard.E2.1.Micro` (1 GB) also works, just more slowly.
   - **Networking:** keep "Assign a public IPv4 address" on.
   - **SSH keys:** download the private key, or paste your own public key.
4. Open the web ports. Go to **Networking → Virtual cloud networks →** your VCN **→ Security Lists → Default Security List → Add Ingress Rules** and add two rules:
   - Source `0.0.0.0/0`, TCP, destination port `80`
   - Source `0.0.0.0/0`, TCP, destination port `443`
5. Note the instance's **public IP address**.

Oracle may reclaim Always Free servers that sit almost completely idle for a week. A search server that people use won't be idle. Upgrading the account to Pay As You Go removes that rule and still costs nothing within the Always Free limits.

## 2. Copy this folder to the server and run setup

From the Webshelf folder on your computer (PowerShell works). Replace the key path and IP:

```bash
scp -i path/to/ssh-key.key -r server ubuntu@YOUR_IP:~/webshelf-server
ssh -i path/to/ssh-key.key ubuntu@YOUR_IP
```

Then, on the server:

```bash
cd ~/webshelf-server && chmod +x setup.sh && ./setup.sh
```

The script:

- installs Docker
- opens ports 80 and 443 in the server's own firewall, because Oracle's Ubuntu image blocks them even after step 4
- asks for your Twelve Data key (press Enter to skip)
- starts everything and runs a test search

It finishes by printing the server's address, such as `https://203-0-113-7.sslip.io`. [sslip.io](https://sslip.io) turns the IP address into a hostname, so HTTPS works without buying a domain. To use your own domain instead, point it at the IP and run `./setup.sh search.yourdomain.org`.

## 3. Point Webshelf at it

In `assets/js/config.js`, set `BACKEND_URL` to the printed address:

```js
const BACKEND_URL = 'https://203-0-113-7.sslip.io';
```

Web results then come from the server, and share prices go through it with the key it holds. Mwmbl stays available in Settings.

## Looking after it

| Task | Command (in `~/webshelf-server`) |
|---|---|
| See what's happening | `sudo docker compose logs --tail 100 -f` |
| Update SearXNG and Caddy | `sudo docker compose pull && sudo docker compose up -d` |
| Change engines | Edit `searxng/settings.yml`, then `sudo docker compose restart searxng` |
| Add or change the Twelve Data key | Edit `.env`, then `sudo docker compose up -d caddy` |
| See which engines are failing | Open `https://YOUR_HOST/stats` |

Engines were tested one by one from Render (October 2026). **Bing** answers (in English only from a US region, which is why the live server runs in Virginia), as do **Mwmbl**, **Wikipedia** and **Wikidata**; Bing Images and Bing Videos, Openverse, Wikimedia Commons, YouTube, Dailymotion, SepiaSearch (PeerTube) and Vimeo cover the Images and Videos tabs. Google (access denied), Startpage and Qwant (CAPTCHAs), Mojeek and DuckDuckGo (timeouts) are blocked from cloud addresses and left out; Brave rate-limits and is kept in case it recovers; Yahoo returned unrelated spam. Bing ranks above Mwmbl (engine weights 2 and 0.4).

Retested 5 October 2026: Bing, asked by a server, now searches only the first word of a query ("gordon ramsay restaurants" returns Gordon Food Service), with SearXNG 2026.10.4, which already carries the upstream fix for this. Yep and Mojeek deny access, DuckDuckGo still times out, Yahoo returns Bing's results and Qwant shows a CAPTCHA. Webshelf's ranking (`assets/js/rank.js`) splits the server's list back into each engine's own order and trusts an engine less on a search when its top results lack the searched words, so Mwmbl leads when Bing has gone astray. Bing also ignores `site:` and `filetype:` from a server; Webshelf filters by them itself. SearXNG pauses any engine that starts failing and retries it later.

Only `https://hoodedhacker32.github.io` and `http://localhost:8417` can read results from a browser. To change that, edit `ALLOWED_ORIGINS` in `.env` and restart Caddy.
