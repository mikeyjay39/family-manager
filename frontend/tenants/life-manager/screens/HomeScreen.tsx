import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import DocumentCreateForm from '@/tenants/life-manager/components/document-create-form';
import DocumentList from '@/tenants/life-manager/components/document-list';
import ProtonConnectPanel from '@/tenants/life-manager/components/proton-connect-panel';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/lib/tenant/TenantContext';
import { useTenantBranding } from '@/lib/tenant/TenantThemeContext';

export default function HomeScreen() {
  const { logout } = useAuth();
  const { tenant } = useTenant();
  const { copy, assets, headerBackground } = useTenantBranding();
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  const performLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleConfirmLogout = () => {
    setLogoutDialogVisible(false);
    void performLogout();
  };

  return (
    <>
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
          <Button
            label="Log Out"
            onPress={() => setLogoutDialogVisible(true)}
            accessibilityLabel="Log out button"
            accessibilityHint="Tap to log out of your account"
            style={styles.logoutButton}
          />
        </ThemedView>
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Documents</ThemedText>
          <ProtonConnectPanel />
          <DocumentCreateForm />
          <DocumentList />
        </ThemedView>
      </ParallaxScrollView>
      <ConfirmDialog
        visible={logoutDialogVisible}
        title="Log Out"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setLogoutDialogVisible(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
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
  logoutButton: {
    padding: 12,
    marginTop: 8,
  },
});
