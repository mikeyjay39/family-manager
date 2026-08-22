import type { TenantMeta } from '@/lib/tenant/types';

export const lifeManagerTenantMeta: TenantMeta = {
  id: 'life-manager',
  mountPath: '/life-manager',
  apiV1Prefix: '/life-manager/api/v1',
  displayName: 'Life Manager',
  hostnames: ['life-manager.jeszenka.com', 'life-manager.localhost'],
  theme: {
    headerBackground: { light: '#56C4F5', dark: '#1D3D47' },
    copy: {
      loginSubtitle: 'Sign in to continue',
      homeTitleSuffix: '!',
    },
  },
};
