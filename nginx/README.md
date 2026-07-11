# Nginx gateway (prod)

Prod vhosts are **generated** from [`tenants.prod.json`](tenants.prod.json) and committed as [`generated/tenant-servers.conf.template`](generated/tenant-servers.conf.template).

## Add or change a prod tenant

1. Edit `tenants.prod.json` and frontend/backend tenant code (use the **add-tenant** Cursor skill).
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
