# Webshelf search on Hugging Face Spaces: SearXNG with Caddy in front (port 7860).
FROM docker.io/searxng/searxng:latest
COPY --from=docker.io/library/caddy:2-alpine /usr/bin/caddy /usr/bin/caddy
USER root
COPY settings.yml ${__SEARXNG_CONFIG_PATH}/settings.yml
COPY Caddyfile /etc/caddy/Caddyfile
RUN chmod -R a+rwX "$__SEARXNG_CONFIG_PATH" "$__SEARXNG_DATA_PATH" && mkdir -m 777 /tmp/caddy
ENV GRANIAN_HOST=127.0.0.1 XDG_DATA_HOME=/tmp/caddy XDG_CONFIG_HOME=/tmp/caddy
EXPOSE 7860
# A fresh secret key on each start unless SEARXNG_SECRET is set as a Space secret.
ENTRYPOINT ["/bin/sh", "-c", "sed -i \"s/CHANGE_ME/$(head -c 24 /dev/urandom | base64 | tr -dc a-zA-Z0-9)/\" $__SEARXNG_CONFIG_PATH/settings.yml; caddy run --config /etc/caddy/Caddyfile --adapter caddyfile & exec /usr/local/searxng/entrypoint.sh"]
