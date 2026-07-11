import type { TenantModule } from '@/lib/tenant/types';
import HomeScreen from '@/tenants/test-tenant/screens/HomeScreen';
import { testTenantMeta } from '@/tenants/test-tenant/meta';
import { testTenantThemeAssets } from '@/tenants/test-tenant/theme-assets';

export const testTenant: TenantModule = {
  ...testTenantMeta,
  theme: {
    ...testTenantMeta.theme,
    assets: testTenantThemeAssets,
  },
  screens: {
    Home: HomeScreen,
  },
};
