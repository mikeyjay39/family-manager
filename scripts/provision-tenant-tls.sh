#!/usr/bin/env bash
# Issue missing Let's Encrypt certs for prod tenants (run on the server before gateway start).
# Idempotent: skips hostnames that already have a cert. Renewal is handled by host cron.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TENANTS_FILE="${REPO_ROOT}/nginx/tenants.prod.json"
WEBROOT="${REPO_ROOT}/nginx/certbot/webroot"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.prod.env}"
GATEWAY_CONTAINER="${GATEWAY_CONTAINER:-life_manager_gateway}"

if command -v jq >/dev/null 2>&1; then
  list_hostnames() {
    jq -r '.[].hostname' "${TENANTS_FILE}"
  }
elif command -v python3 >/dev/null 2>&1; then
  list_hostnames() {
    python3 -c '
import json, sys
for tenant in json.load(open(sys.argv[1])):
    print(tenant["hostname"])
' "${TENANTS_FILE}"
  }
else
  echo "error: jq or python3 is required" >&2
  exit 1
fi

if [[ ! -f "${TENANTS_FILE}" ]]; then
  echo "error: missing ${TENANTS_FILE}" >&2
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

: "${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL in ${ENV_FILE}}"

mkdir -p "${WEBROOT}"

certbot_cmd=(certbot certonly
  --webroot
  -w "${WEBROOT}"
  --non-interactive
  --agree-tos
  -m "${LETSENCRYPT_EMAIL}"
  --keep-until-expiring
)

issued_any=false

while IFS= read -r hostname; do
  cert_dir="/etc/letsencrypt/live/${hostname}"
  if [[ -f "${cert_dir}/fullchain.pem" && -f "${cert_dir}/privkey.pem" ]]; then
    echo "cert exists: ${hostname}"
    continue
  fi

  echo "issuing cert: ${hostname}"
  if ! command -v certbot >/dev/null 2>&1; then
    echo "error: certbot not found on PATH" >&2
    exit 1
  fi

  if [[ "$(id -u)" -ne 0 ]]; then
    sudo "${certbot_cmd[@]}" -d "${hostname}"
  else
    "${certbot_cmd[@]}" -d "${hostname}"
  fi
  issued_any=true
done < <(list_hostnames)

if [[ "${issued_any}" == "true" ]] && docker ps --format '{{.Names}}' | grep -qx "${GATEWAY_CONTAINER}"; then
  echo "reloading nginx in ${GATEWAY_CONTAINER}"
  docker exec "${GATEWAY_CONTAINER}" nginx -s reload
fi

echo "provision-tenant-tls: done"
