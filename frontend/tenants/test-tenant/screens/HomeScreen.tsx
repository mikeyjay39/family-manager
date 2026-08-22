import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { apiV1, authenticatedFetch } from '@/lib/api/client';
import { useTenant } from '@/lib/tenant/TenantContext';
import { useTenantBranding } from '@/lib/tenant/TenantThemeContext';

/**
 * Minimal pilot home for test-tenant multitenancy.
 *
 * sequenceDiagram
 *   participant Home as HomeScreen
 *   participant Auth as AuthContext
 *   participant API as apiV1(/auth/protected)
 *   Home->>Auth: read token
 *   Home->>API: authenticatedFetch smoke check
 *   API-->>Home: 200 + greeting body
 */
export default function HomeScreen() {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const { copy, assets, headerBackground } = useTenantBranding();
  const [protectedStatus, setProtectedStatus] = useState<string>('Checking auth...');

  useEffect(() => {
    let cancelled = false;

    const checkProtectedEndpoint = async () => {
      if (!token) {
        if (!cancelled) {
          setProtectedStatus('Not signed in');
        }
        return;
      }

      try {
        const response = await authenticatedFetch(apiV1('/auth/protected'), { token });
        if (cancelled) {
          return;
        }
        if (response.ok) {
          const body = await response.text();
          setProtectedStatus(`Auth OK: ${body}`);
        } else {
          setProtectedStatus(`Auth check failed (${response.status})`);
        }
      } catch {
        if (!cancelled) {
          setProtectedStatus('Auth check failed');
        }
      }
    };

    void checkProtectedEndpoint();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={headerBackground}
      headerImage={
        <Image source={assets.headerImage} style={styles.reactLogo} />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">
          {tenant.displayName}
          {copy.homeTitleSuffix}
        </ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Multitenancy pilot</ThemedText>
        <ThemedText>
          This tenant uses a separate backend database and auth mount at{' '}
          <ThemedText type="defaultSemiBold">{tenant.apiV1Prefix}</ThemedText>.
        </ThemedText>
        <ThemedText>{protectedStatus}</ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
