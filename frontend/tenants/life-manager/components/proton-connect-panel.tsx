import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { useProtonConnect } from '@/contexts/ProtonConnectContext';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';

const THIRD_PARTY_DISCLOSURE =
  'This is a third-party application not officially supported by Proton.';

export default function ProtonConnectPanel() {
  const { isSupported, session, isConnecting, connect, disconnect } = useProtonConnect();
  const palette = useColorPalette();
  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mailboxPassword, setMailboxPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        connectedRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        },
        disclosure: {
          fontSize: 13,
          color: palette.icon,
          marginBottom: 8,
        },
        label: {
          fontSize: 14,
          color: palette.text,
          marginBottom: 4,
        },
        input: {
          borderWidth: 1,
          borderColor: palette.icon,
          borderRadius: 8,
          padding: 10,
          marginBottom: 8,
          color: palette.text,
          backgroundColor: palette.background,
        },
        connectedText: {
          fontSize: 14,
          color: palette.text,
          flex: 1,
          minWidth: 120,
        },
        disconnectButton: {
          paddingVertical: 10,
          paddingHorizontal: 14,
        },
        errorText: {
          fontSize: 14,
          color: '#c62828',
          marginBottom: 8,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: 24,
        },
        modalCard: {
          backgroundColor: palette.background,
          borderRadius: 12,
          maxHeight: '85%',
          overflow: 'hidden',
        },
        modalScroll: {
          padding: 16,
        },
        modalTitle: {
          fontSize: 20,
          fontWeight: '700',
          marginBottom: 12,
          color: palette.text,
        },
        modalActions: {
          flexDirection: 'row',
          gap: 12,
          padding: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.icon,
        },
        modalActionButton: {
          flex: 1,
          paddingVertical: 12,
        },
      }),
    [palette]
  );

  const clearSensitiveFields = () => {
    setPassword('');
    setMailboxPassword('');
    setTotp('');
    setErrorMessage(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    clearSensitiveFields();
  };

  const handleConnect = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Enter your Proton email and password.');
      return;
    }
    setErrorMessage(null);
    try {
      await connect({
        email: email.trim(),
        password,
        mailboxPassword: mailboxPassword.trim() || undefined,
        totp: totp.trim() || undefined,
      });
      closeModal();
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Unknown error';
      if (/incorrect key passphrase|wrong passphrase|bad passphrase/i.test(message)) {
        message =
          'Could not unlock Proton encryption keys with your login password. If your account uses a separate mailbox password, enter it in the Mailbox password field.';
      }
      console.error('Proton connection failed:', error);
      setErrorMessage(message);
      Alert.alert('Proton connection failed', message);
    }
  };

  const handleDisconnect = async () => {
    setErrorMessage(null);
    try {
      await disconnect();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Proton disconnect failed:', error);
      setErrorMessage(message);
      Alert.alert('Proton disconnect failed', message);
    }
  };

  if (!isSupported) {
    return null;
  }

  if (session) {
    return (
      <View style={styles.connectedRow}>
        <Text style={styles.connectedText}>Connected as {session.email}</Text>
        <Button
          variant="secondary"
          label="Disconnect"
          onPress={() => void handleDisconnect()}
          accessibilityLabel="Disconnect Proton Drive"
          style={styles.disconnectButton}
        />
      </View>
    );
  }

  return (
    <View>
      <Button
        label="Connect Proton Drive"
        onPress={() => setModalVisible(true)}
        disabled={isConnecting}
        accessibilityLabel="Connect Proton Drive"
      />

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Proton Drive (experimental)</Text>
              <Text style={styles.disclosure}>{THIRD_PARTY_DISCLOSURE}</Text>
              <Text style={styles.label}>Proton email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@proton.me"
                placeholderTextColor={palette.icon}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Proton login password"
                placeholderTextColor={palette.icon}
              />
              <Text style={styles.label}>Mailbox password (if different)</Text>
              <TextInput
                style={styles.input}
                value={mailboxPassword}
                onChangeText={setMailboxPassword}
                secureTextEntry
                placeholder="Leave blank if same as login password"
                placeholderTextColor={palette.icon}
              />
              <Text style={styles.disclosure}>
                Proton accounts with a second password need it here to unlock Drive keys.
              </Text>
              <Text style={styles.label}>2FA code (if enabled)</Text>
              <TextInput
                style={styles.input}
                value={totp}
                onChangeText={setTotp}
                keyboardType="number-pad"
                placeholder="Optional TOTP"
                placeholderTextColor={palette.icon}
              />
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                label={isConnecting ? 'Logging in…' : 'Login'}
                onPress={() => void handleConnect()}
                disabled={isConnecting}
                loading={isConnecting}
                accessibilityLabel="Login to Proton Drive"
                style={styles.modalActionButton}
              />
              <Button
                variant="outline"
                label="Cancel"
                onPress={closeModal}
                disabled={isConnecting}
                accessibilityLabel="Cancel Proton Drive login"
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
