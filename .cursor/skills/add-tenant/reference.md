# Add tenant — reference

## File map

| Path | Role |
|------|------|
| `nginx/tenants.prod.json` | Prod tenant registry (hostname, mountPath, scope) |
| `nginx/generated/tenant-servers.conf.template` | Generated nginx vhosts (committed) |
| `scripts/generate-nginx-tenant-servers.sh` | Local generator |
| `scripts/provision-tenant-tls.sh` | Server deploy — issue missing certs |
| `scripts/deploy-prod-lightsail.sh` | Calls provision before gateway recreate |

## Per-tenant TLS (separate certs)

Each `hostname` in `tenants.prod.json` gets its own Let's Encrypt cert at:

```text
/etc/letsencrypt/live/<hostname>/fullchain.pem
/etc/letsencrypt/live/<hostname>/privkey.pem
```

Generated nginx references those paths. Gateway will not start HTTPS for a hostname until `provision-tenant-tls.sh` has run on the server.

## First deploy of a new tenant

1. User: DNS A record live
2. Merge PR with registry + generated nginx + app code
3. Server: `git pull` (via CI deploy)
4. `provision-tenant-tls.sh` issues cert for new hostname
5. Gateway recreate loads new vhost config

## Local dev (no TLS)

Use `?tenant=<id>` or `<id>.localhost` in `/etc/hosts` — see `docs/development_faq.md`.

## Gateway container name

Compose: `life_manager_gateway` (not `nginx-container`).
