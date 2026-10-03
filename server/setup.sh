#!/usr/bin/env bash
# Sets up the Webshelf search server on a fresh Ubuntu 22.04/24.04 machine
# (written for Oracle Cloud's Always Free tier). Run from this folder:
#
#   ./setup.sh                    # uses <your-ip>.sslip.io as the address
#   ./setup.sh search.example.org # or a hostname you already point here
#
# Safe to run again: it keeps an existing .env (and so the same secret key).

set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n== %s\n' "$*"; }

say "Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
fi

say "Opening ports 80 and 443 in the server's own firewall"
# Oracle's Ubuntu images ship iptables rules that reject everything except SSH,
# even after the ports are opened in the Oracle console. Insert ours before them.
# Our rules go just above the first REJECT rule (or at the end if there is none).
allow() { # protocol port
  sudo iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null && return
  local at
  at="$(sudo iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" {print $1; exit}')"
  if [ -n "$at" ]; then sudo iptables -I INPUT "$at" -p "$1" --dport "$2" -j ACCEPT
  else sudo iptables -A INPUT -p "$1" --dport "$2" -j ACCEPT; fi
}
allow tcp 80
allow tcp 443
allow udp 443
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save
else
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
  sudo netfilter-persistent save
fi

if [ ! -f .env ]; then
  say "Writing .env"
  host="${1:-}"
  if [ -z "$host" ]; then
    ip="$(curl -fsS https://api.ipify.org)"
    host="${ip//./-}.sslip.io"
  fi
  read -r -p "Twelve Data API key for share prices (Enter to skip): " td_key || true
  cat > .env <<EOF
SEARX_HOST=${host}
SEARXNG_SECRET=$(openssl rand -hex 32)
TWELVE_DATA_KEY=${td_key:-}
# Pages allowed to read results in a browser: the GitHub Pages site and a local copy.
ALLOWED_ORIGINS=^(https://hoodedhacker32\.github\.io|http://localhost:8417)$
EOF
  chmod 600 .env
fi

say "Starting SearXNG, Valkey and Caddy"
sudo docker compose pull
sudo docker compose up -d

host="$(grep '^SEARX_HOST=' .env | cut -d= -f2)"
say "Waiting for the HTTPS certificate"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "https://${host}/healthz" 2>/dev/null; then break; fi
  sleep 4
done

say "Test search"
# The rate limiter turns away requests that don't look like a browser's, so the
# test sends the headers a browser would.
if curl -fsS --compressed -A 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'     -H 'Accept: application/json, text/html' -H 'Accept-Language: en'     -H 'Origin: https://hoodedhacker32.github.io' -H 'Sec-Fetch-Mode: cors'     "https://${host}/search?q=webshelf&format=json" | head -c 300; then
  printf '\n\nDone. Put this in assets/js/config.js as BACKEND_URL:\n  https://%s\n' "$host"
else
  printf '\nThe server is up but the test search failed. See: sudo docker compose logs --tail 50\n'
fi
