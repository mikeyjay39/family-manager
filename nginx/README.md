# Nginx gateway (prod)

Prod vhosts are **generated** from [`tenants.prod.json`](tenants.prod.json) and committed as [`generated/tenant-servers.conf.template`](generated/tenant-servers.conf.template).

## tenants.prod.json fields

[`scripts/generate-nginx-tenant-servers.sh`](../scripts/generate-nginx-tenant-servers.sh) reads only the fields below. All tenants get the same vhost shape (API proxy + frontend proxy). JSON does not support comments — this table is the field reference.

| Field | Used by nginx generator? | Purpose |
|-------|--------------------------|---------|
| `id` | Indirectly (validates `mountPath`) | Tenant identifier; must match frontend `tenants/<id>/` |
| `hostname` | Yes | `server_name`, TLS cert path |
| `mountPath` | Yes | `location <mountPath>/api` proxy block |
| `default` | Yes | `default_server` on ports 80/443 (exactly one tenant) |
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
