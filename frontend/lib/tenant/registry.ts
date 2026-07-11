import type { TenantMeta } from '@/lib/tenant/types';
import { lifeManagerTenantMeta } from '@/tenants/life-manager/meta';
import { testTenantMeta } from '@/tenants/test-tenant/meta';

const REGISTERED_TENANT_METAS: readonly TenantMeta[] = [
  lifeManagerTenantMeta,
  testTenantMeta,
];

const tenantIdByHostname = new Map<string, string>();

for (const meta of REGISTERED_TENANT_METAS) {
  for (const hostname of meta.hostnames) {
    const normalized = normalizeHostname(hostname);
    if (tenantIdByHostname.has(normalized)) {
      throw new Error(
        `Hostname "${hostname}" is registered to multiple tenants (${tenantIdByHostname.get(normalized)} and ${meta.id})`
      );
    }
    tenantIdByHostname.set(normalized, meta.id);
  }
}

export const DEFAULT_TENANT_ID = lifeManagerTenantMeta.id;

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function getRegisteredTenantMetas(): readonly TenantMeta[] {
  return REGISTERED_TENANT_METAS;
}

export function getTenantIdForHostname(hostname: string): string | undefined {
  return tenantIdByHostname.get(normalizeHostname(hostname));
}

export function isRegisteredTenantId(tenantId: string): boolean {
  return REGISTERED_TENANT_METAS.some((meta) => meta.id === tenantId);
}

export function getTenantMetaById(tenantId: string): TenantMeta | undefined {
  return REGISTERED_TENANT_METAS.find((meta) => meta.id === tenantId);
}
