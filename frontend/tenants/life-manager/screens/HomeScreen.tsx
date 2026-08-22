import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import DocumentCreateForm from '@/tenants/life-manager/components/document-create-form';
import DocumentList from '@/tenants/life-manager/components/document-list';
import ProtonConnectPanel from '@/tenants/life-manager/components/proton-connect-panel';
import { useTenant } from '@/lib/tenant/TenantContext';
import { useTenantBranding } from '@/lib/tenant/TenantThemeContext';

export default function HomeScreen() {
  const { tenant } = useTenant();
  const { copy, assets, headerBackground } = useTenantBranding();
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);

  return (
    <ParallaxScrollView
      headerBackgroundColor={headerBackground}
      headerImage={
        <Image
          source={assets.headerImage}
          style={styles.headerImage}
          contentFit="cover"
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">
          {tenant.displayName}
          {copy.homeTitleSuffix}
        </ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Documents</ThemedText>
        <ProtonConnectPanel />
        <DocumentCreateForm
          onDocumentCreated={() => setDocumentsRefreshKey((key) => key + 1)}
        />
        <DocumentList refreshKey={documentsRefreshKey} />
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
  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
});
