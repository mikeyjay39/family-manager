import type { ImageSourcePropType } from 'react-native';

import type { TenantThemeAssets } from '@/lib/tenant/theme/types';

const testAssets: TenantThemeAssets = {
  logo: 'test-icon' as ImageSourcePropType,
  headerImage: 'test-header-image' as ImageSourcePropType,
};

export const lifeManagerThemeAssets: TenantThemeAssets =
  process.env.VITEST === 'true'
    ? testAssets
    : {
        logo: require('./assets/logo.jpeg'),
        headerImage: require('./assets/header-banner.jpeg'),
      };
