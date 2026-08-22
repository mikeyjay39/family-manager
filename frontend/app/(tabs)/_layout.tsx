import { Tabs, router } from 'expo-router';
import React, { useState } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';

export default function TabLayout() {
  const palette = useColorPalette();
  const { logout } = useAuth();
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  const handleConfirmLogout = () => {
    setLogoutDialogVisible(false);
    void (async () => {
      await logout();
      router.replace('/login');
    })();
  };

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: palette.tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="logout"
          options={{
            title: 'Log Out',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="rectangle.portrait.and.arrow.right" color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setLogoutDialogVisible(true);
            },
          }}
        />
      </Tabs>
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
