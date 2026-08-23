# Nginx gateway (prod)

Prod vhosts are **generated** from [`tenants.prod.json`](tenants.prod.json) and committed as [`generated/tenant-servers.conf.template`](generated/tenant-servers.conf.template).

## tenants.prod.json fields

[`scripts/generate-nginx-tenant-servers.sh`](../scripts/generate-nginx-tenant-servers.sh) reads only the fields below. All tenants get the same vhost shape (API proxy + frontend proxy). JSON does not support comments — this table is the field reference.

| Field | Used by nginx generator? | Purpose |
|-------|--------------------------|---------|
| `id` | Indirectly (validates `mountPath`) | Tenant identifier; must match frontend `tenants/<id>/` |
| `hostname` | Yes | `server_name`, TLS cert path |
| `mountPath` | Yes | `location <mountPath>/api` proxy block |
| `default` | Yes | Exactly one tenant; its cert is used on the catch-all `default_server` (unknown Host / IP-only) |
| `scope` | **No** | Documentation for add-tenant workflow (`auth-only` \| `full`); does not change generated vhosts |

`scope` does not affect nginx, the backend, or the frontend at runtime. It documents intent for humans and the add-tenant skill. Tenant domain ownership is described in [docs/architecture.md](../docs/architecture.md#tenant-domain-boundaries).

## Add or change a prod tenant

1. Edit `tenants.prod.json` and frontend/backend tenant code (use the **add-tenant** Cursor skill). See [tenants.prod.json fields](#tenantsprodjson-fields) — `scope` is not used by nginx.
2. Run locally:

   ```bash
   ./scripts/generate-nginx-tenant-servers.sh
   ```

3. Commit the updated `generated/tenant-servers.conf.template`.
4. Deploy — [`scripts/provision-tenant-tls.sh`](../scripts/provision-tenant-tls.sh) issues missing Let's Encrypt certs on the server before the gateway restarts.

Do **not** hand-edit the generated file. [`templates/default.conf.template`](templates/default.conf.template) is a pointer only; prod mounts the generated template.

## TLS renewal (server cron)

```cron
0 0 * * * certbot renew --webroot -w /home/ec2-user/life-manager/nginx/certbot/webroot --quiet && docker exec life_manager_gateway nginx -s reload
```

Set `LETSENCRYPT_EMAIL` in `.prod.env`.

## Request hardening

The generator wires two defenses into each tenant vhost (do not hand-edit the generated template):

| Defense | Where | Behavior |
|---------|--------|----------|
| Hostname allowlist | Catch-all `default_server` (`server_name _`) after named tenants | Unknown Host / IP-only requests get `444`; named tenant vhosts keep ACME for Let's Encrypt |
| Junk path drops | [`snippets/drop-junk-locations.conf`](snippets/drop-junk-locations.conf), `include`d in HTTP and HTTPS servers after ACME | Scanner paths (WordPress, `.env`, `.git`, script extensions) get `444` (connection closed) |
| API rate limit | `limit_req_zone` at top of generated config; `limit_req` on `${mountPath}/api` and `/api` only | **10 req/s** per client IP, burst **20**, `nodelay`; excess → **429** |

Edit the snippet to change the denylist (Compose mounts `nginx/snippets` into the gateway; reload nginx after changes). Rate-limit knobs live in [`scripts/generate-nginx-tenant-servers.sh`](../scripts/generate-nginx-tenant-servers.sh) — regenerate and commit the template after changing them.

## Access logs (client IP + Host)

The generated config defines `log_format main_ext` with `$remote_addr`, `host=$host`, and `http_host=$http_host`, then sets `access_log` to that format. Alloy ships gateway stdout to Loki.

| Field | Use |
|-------|-----|
| Leading IP (`$remote_addr`) | Public client IP |
| `host=` | Normalized Host (or `server_name` if Host missing) |
| `http_host=` | Raw `Host` header (domain vs instance IP vs spoof) |

The backend request span also logs `host` and `client_ip` (from `X-Real-IP` / `X-Forwarded-For` set by the gateway).
