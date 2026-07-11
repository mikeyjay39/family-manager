# TLS (HTTPS) in front of the backend

The Axum backend listens for **plain HTTP** only. It does not load certificates or terminate TLS in-process.

For HTTPS you typically:

1. Run a **reverse proxy** (Nginx, Caddy, Traefik, a cloud load balancer, etc.) that holds the TLS certificate and key.
2. Proxy to the backend over HTTP on your internal network (for example `http://127.0.0.1:${APP_PORT}`).
3. Configure the frontend `EXPO_PUBLIC_API_BASE_URL` / `extra.apiUrl` to the **public HTTPS origin** clients use.

## Production: Let's Encrypt (per-tenant hostnames)

Prod TLS is terminated at the **gateway** with **separate certs per tenant hostname**. See [`../../nginx/README.md`](../../nginx/README.md):

- Registry: `nginx/tenants.prod.json`
- Generate locally: `./scripts/generate-nginx-tenant-servers.sh` → commit `nginx/generated/tenant-servers.conf.template`
- Issue certs on server at deploy: `scripts/provision-tenant-tls.sh`
- Renewal: host cron + `docker exec life_manager_gateway nginx -s reload`

## Local setup: nginx TLS termination with self-signed localhost certs

The Compose `gateway` service is configured to:

- Listen on `80` and redirect to HTTPS.
- Listen on `443` with TLS.
- Read cert files from `./nginx/certs` mounted to `/etc/nginx/certs` in the container.

### 1) Generate localhost cert/key

From the repository root:

```sh
mkdir -p nginx/certs
openssl req -x509 -newkey rsa:4096 \
  -keyout nginx/certs/localhost.key \
  -out nginx/certs/localhost.crt \
  -days 365 -nodes -subj "/CN=localhost"
```

### 2) Start prod profile

```sh
./build_and_start_app.sh prod
```

### 3) Verify redirect and HTTPS proxying

```sh
curl -I http://localhost
curl -k https://localhost/api/health
curl -k https://localhost/
```

Expected behavior:

- `http://localhost` responds with redirect to `https://localhost/...`.
- `https://localhost/api/health` reaches the backend through nginx.
- `https://localhost/` serves the frontend.

## Troubleshooting

- If the browser shows certificate errors, fix trust/config on the **proxy**, not in this repo’s Rust binary.
- If API calls fail from the app, ensure `EXPO_PUBLIC_API_BASE_URL` matches the scheme and host the client actually uses (HTTPS after the proxy, HTTP only for direct local development).
