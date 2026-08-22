import { BlurView } from 'expo-blur';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';

const BLUR_INTENSITY = 40;

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onRequestClose?: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  onRequestClose,
}: ConfirmDialogProps) {
  const palette = useColorPalette();
  const colorScheme = useColorScheme() ?? 'light';
  const handleRequestClose = onRequestClose ?? onCancel;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        blurRoot: {
          flex: 1,
        },
        dimOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.25)',
        },
        centered: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        },
        card: {
          backgroundColor: palette.background,
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 340,
          gap: 16,
        },
        message: {
          opacity: 0.8,
        },
        actions: {
          flexDirection: 'row',
          gap: 12,
          marginTop: 8,
        },
        actionButton: {
          flex: 1,
          padding: 12,
        },
      }),
    [palette]
  );

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={handleRequestClose}
      accessibilityViewIsModal
    >
      <BlurView intensity={BLUR_INTENSITY} tint={colorScheme} style={styles.blurRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />
        <View style={styles.dimOverlay} pointerEvents="none" />
        <View style={styles.centered} pointerEvents="box-none">
          <View style={styles.card} pointerEvents="auto">
            <ThemedText type="title">{title}</ThemedText>
            <ThemedText style={styles.message}>{message}</ThemedText>
            <View style={styles.actions}>
              <Button
                variant="outline"
                label={cancelLabel}
                onPress={onCancel}
                accessibilityLabel={cancelLabel}
                style={styles.actionButton}
              />
              <Button
                variant={destructive ? 'destructive' : 'primary'}
                label={confirmLabel}
                onPress={onConfirm}
                accessibilityLabel={confirmLabel}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}
