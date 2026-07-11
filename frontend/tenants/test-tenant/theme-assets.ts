import type { ImageSourcePropType } from 'react-native';

import type { TenantThemeAssets } from '@/lib/tenant/theme/types';

const testAssets: TenantThemeAssets = {
  logo: 'test-icon' as ImageSourcePropType,
  headerImage: 'test-header-image' as ImageSourcePropType,
};

export const testTenantThemeAssets: TenantThemeAssets =
  process.env.VITEST === 'true'
    ? testAssets
    : {
        logo: require('@/assets/images/icon.png'),
        headerImage: require('@/assets/images/partial-react-logo.png'),
      };
