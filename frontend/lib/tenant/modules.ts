import type { TenantModule } from '@/lib/tenant/types';

const moduleLoaders: Record<string, () => TenantModule> = {
  'life-manager': () => require('@/tenants/life-manager/config').lifeManagerTenant,
  'test-tenant': () => require('@/tenants/test-tenant/config').testTenant,
};

const cache = new Map<string, TenantModule>();

export function getTenantById(tenantId: string): TenantModule | undefined {
  const cached = cache.get(tenantId);
  if (cached) {
    return cached;
  }

  const load = moduleLoaders[tenantId];
  if (!load) {
    return undefined;
  }

  const tenantModule = load();
  cache.set(tenantId, tenantModule);
  return tenantModule;
}

/** Clear cached modules — for tests. */
export function resetTenantModuleCache(): void {
  cache.clear();
}
