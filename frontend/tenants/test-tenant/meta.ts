import type { TenantMeta } from '@/lib/tenant/types';

export const testTenantMeta: TenantMeta = {
  id: 'test-tenant',
  mountPath: '/test-tenant',
  apiV1Prefix: '/test-tenant/api/v1',
  displayName: 'Test Tenant',
  hostnames: ['test-tenant.jeszenka.com', 'test-tenant.localhost'],
  theme: {
    headerBackground: { light: '#E8D5B7', dark: '#3D2F1F' },
    light: { tint: '#B8860B' },
    dark: { tint: '#DAA520' },
    copy: {
      loginSubtitle: 'Sign in to the test tenant pilot',
      homeTitleSuffix: ' (pilot)',
    },
  },
};
