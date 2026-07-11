#!/usr/bin/env bash
# Deploy the prod Docker Compose stack on Lightsail after CI pushes images to ECR.
# Invoked by GitHub Actions over SSH or manually on the instance.
set -euo pipefail

: "${ECR_PASSWORD:?ECR_PASSWORD is required}"
: "${ECR_REGISTRY:?ECR_REGISTRY is required}"
: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.prod.env}"
COMPOSE_PROFILE="${COMPOSE_PROFILE:-prod}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "error: neither 'docker compose' nor 'docker-compose' is available" >&2
  exit 1
fi

compose() {
  "${COMPOSE[@]}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --profile "${COMPOSE_PROFILE}" "$@"
}

echo "${ECR_PASSWORD}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

cd "${DEPLOY_PATH}"

echo "Deploying prod stack (:latest images) for commit ${GITHUB_SHA}"

compose pull
compose up -d
# Nginx resolves upstream hostnames once at startup; when only backend/frontend
# images change, their containers get new IPs but gateway may stay running → 502. This 
# forces gateway to restart and resolve the new IPs.
compose up -d --force-recreate --no-deps gateway
compose ps
