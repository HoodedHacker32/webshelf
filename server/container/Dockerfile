# Webshelf search as one container (for Render and similar hosts that provide
# HTTPS): SearXNG with Caddy in front on port 7860.
FROM docker.io/searxng/searxng:latest
COPY --from=docker.io/library/caddy:2-alpine /usr/bin/caddy /usr/bin/caddy
USER root
COPY settings.yml ${__SEARXNG_CONFIG_PATH}/settings.yml
COPY Caddyfile /etc/caddy/Caddyfile
COPY market.py /usr/local/webshelf/market.py
# Caddy's image gives it a file capability for low ports; some hosts refuse to run
# binaries with one ("Operation not permitted"). Port 7860 doesn't need it, so
# copy the binary without it.
RUN mkdir -p /usr/local/bin && cat /usr/bin/caddy > /usr/local/bin/caddy && chmod 755 /usr/local/bin/caddy && rm /usr/bin/caddy && chmod -R a+rwX "$__SEARXNG_CONFIG_PATH" "$__SEARXNG_DATA_PATH" && mkdir -m 777 /tmp/caddy
ENV GRANIAN_HOST=127.0.0.1 XDG_DATA_HOME=/tmp/caddy XDG_CONFIG_HOME=/tmp/caddy
EXPOSE 7860
# A fresh secret key on each start unless SEARXNG_SECRET is set on the host.
ENTRYPOINT ["/bin/sh", "-c", "sed -i \"s/CHANGE_ME/$(head -c 24 /dev/urandom | base64 | tr -dc a-zA-Z0-9)/\" $__SEARXNG_CONFIG_PATH/settings.yml; /usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile & /usr/local/searxng/.venv/bin/python /usr/local/webshelf/market.py & exec /usr/local/searxng/entrypoint.sh"]
