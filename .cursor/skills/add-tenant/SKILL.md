---
name: add-tenant
description: >-
  Add a new product tenant to life-manager (backend TenantMount, frontend
  registry, nginx TLS routing, committed generated nginx config). Use when
  adding a tenant, second tenant, multitenancy pilot, or prod subdomain like
  foo.jeszenka.com. Requires DNS A record already configured by the user.
disable-model-invocation: true
---

# Add tenant

End-to-end workflow for a new prod tenant. **The user creates the DNS A record manually** before invoking this skill.

## Prerequisites (user — manual)

1. DNS **A record**: `<tenant-id>.jeszenka.com` → prod server public IP
2. Confirm resolution: `dig +short <hostname>` returns the server IP

If DNS is missing, stop and tell the user to add the record first.

## Inputs (ask once)

| Field | Default | Notes |
|-------|---------|-------|
| `tenant_id` | — | kebab-case, matches mount path `/<tenant_id>` |
| `display_name` | derived from id | Shown in UI |
| `hostname` | `<tenant_id>.jeszenka.com` | Prod subdomain |
| `scope` | `auth-only` | `auth-only` or `full` (documents API + UI) |

## Checklist

Copy and track progress:

```text
- [ ] DNS resolves for <hostname>
- [ ] nginx/tenants.prod.json — new entry
- [ ] Backend — TenantMount crate wired in backend/src/lib.rs
- [ ] Backend — separate DB env var (TEST_TENANT_DATABASE_URL pattern: file:./data/<tenant-id>.db)
- [ ] Frontend — tenants/<id>/meta.ts (include prod hostname + .localhost)
- [ ] Frontend — config.ts, screens/, registry.ts, modules.ts
- [ ] ./scripts/generate-nginx-tenant-servers.sh — commit output
- [ ] Tests — backend integration + frontend resolve.test.ts
- [ ] Docs — api.md, architecture.md, development_faq.md, backend/AGENTS.md
- [ ] Remind user: merge/deploy runs provision-tenant-tls on server; cron renews certs
```

## Step-by-step

### 1. Registry

Add to [`nginx/tenants.prod.json`](nginx/tenants.prod.json):

```json
{
  "id": "<tenant_id>",
  "hostname": "<hostname>",
  "mountPath": "/<tenant_id>",
  "scope": "auth-only"
}
```

Only **one** tenant may have `"default": true` (life-manager). That tenant’s cert is used on the nginx catch-all `default_server` (unknown Host / IP-only → `444`); named tenant vhosts are not `default_server`.

### 2. Backend

Follow existing patterns:

| Scope | Reference |
|-------|-----------|
| `auth-only` | [`backend/libs/test-tenant/`](backend/libs/test-tenant/) |
| `full` | [`backend/libs/life-manager/`](backend/libs/life-manager/) |

Wire mount in [`backend/src/lib.rs`](backend/src/lib.rs). Add workspace member in [`backend/Cargo.toml`](backend/Cargo.toml).

Env var naming: `<TENANT_ID_UPPER>_DATABASE_URL` or reuse `TEST_TENANT_DATABASE_URL` pattern — add to `.dev.env`, `.test.env`, `.prod.env`.

### 3. Frontend

Mirror [`frontend/tenants/test-tenant/`](frontend/tenants/test-tenant/) or life-manager for `full` scope.

**Required in `meta.ts`:**

```ts
hostnames: ['<hostname>', '<tenant_id>.localhost'],
mountPath: '/<tenant_id>',
apiV1Prefix: '/<tenant_id>/api/v1',
```

Register in [`frontend/lib/tenant/registry.ts`](frontend/lib/tenant/registry.ts) and [`frontend/lib/tenant/modules.ts`](frontend/lib/tenant/modules.ts).

### 4. Generate nginx (local — commit output)

```bash
./scripts/generate-nginx-tenant-servers.sh
```

Commits [`nginx/generated/tenant-servers.conf.template`](nginx/generated/tenant-servers.conf.template). **Do not hand-edit** the generated file.

The script validates hostnames against frontend `meta.ts` and `mountPath === /<id>`.

### 5. Tests and docs

- Backend: integration tests for auth isolation (see [`backend/tests/test_tenant_auth_tests.rs`](backend/tests/test_tenant_auth_tests.rs))
- Frontend: extend [`frontend/lib/tenant/resolve.test.ts`](frontend/lib/tenant/resolve.test.ts) for hostname and `?tenant=`
- Update agent docs per hub definition of done

### 6. Deploy (server — automatic)

[`scripts/deploy-prod-lightsail.sh`](scripts/deploy-prod-lightsail.sh) runs [`scripts/provision-tenant-tls.sh`](scripts/provision-tenant-tls.sh) before gateway recreate. That issues missing Let's Encrypt certs (separate cert per hostname).

Renewal: host cron (not in repo):

```cron
0 0 * * * certbot renew --webroot -w /home/ec2-user/life-manager/nginx/certbot/webroot --quiet && docker exec life_manager_gateway nginx -s reload
```

Requires `LETSENCRYPT_EMAIL` in `.prod.env`.

## Hard rules

- Never run `generate-nginx-tenant-servers.sh` only on the server — output must be committed from local/CI dev machine.
- Never hand-edit `nginx/generated/tenant-servers.conf.template`.
- Do not run state-changing git commands unless the user asks.
- Do not run `certbot` locally; provisioning is server-only at deploy.

## Additional resources

- TLS and tenant routing: [reference.md](reference.md)
