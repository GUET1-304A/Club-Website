#!/bin/bash
set -euo pipefail
test "$(id -u)" = 0
frontend=304aistudio-frontend-1
docker image inspect certbot/certbot:latest >/dev/null
curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
    https://acme-v02.api.letsencrypt.org/directory >/dev/null
restore_frontend() { docker start "$frontend" >/dev/null; }
docker stop "$frontend" >/dev/null
trap restore_frontend EXIT
docker run --rm -p 80:80 \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/lib/letsencrypt:/var/lib/letsencrypt \
    certbot/certbot:latest certonly --standalone --non-interactive \
    --expand --reuse-key --key-type ecdsa --cert-name 304aistudio.cn \
    -d 304aistudio.cn -d www.304aistudio.cn -d investment.304aistudio.cn -d airi.304aistudio.cn
install -m 0644 /etc/letsencrypt/live/304aistudio.cn/fullchain.pem /srv/304aistudio/deploy/certs/fullchain.pem
install -m 0600 /etc/letsencrypt/live/304aistudio.cn/privkey.pem /srv/304aistudio/deploy/certs/privkey.pem
restore_frontend
trap - EXIT
openssl x509 -in /srv/304aistudio/deploy/certs/fullchain.pem -noout -dates -ext subjectAltName
