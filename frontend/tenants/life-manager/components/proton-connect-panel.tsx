import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { useProtonConnect } from '@/contexts/ProtonConnectContext';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';
import { withAlpha } from '@/lib/tenant/theme/color-utils';

const THIRD_PARTY_DISCLOSURE =
  'This is a third-party application not officially supported by Proton.';

export default function ProtonConnectPanel() {
  const { isSupported, session, isConnecting, connect, disconnect } = useProtonConnect();
  const palette = useColorPalette();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mailboxPassword, setMailboxPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 8,
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: withAlpha(palette.icon, 0.35),
          backgroundColor: withAlpha(palette.icon, 0.08),
        },
        title: {
          fontSize: 16,
          fontWeight: '600',
          color: palette.text,
        },
        disclosure: {
          fontSize: 13,
          color: palette.icon,
        },
        label: {
          fontSize: 14,
          color: palette.text,
        },
        input: {
          borderWidth: 1,
          borderColor: palette.icon,
          borderRadius: 8,
          padding: 10,
          color: palette.text,
          backgroundColor: palette.background,
        },
        button: {
          paddingVertical: 12,
        },
        actionRow: {
          flexDirection: 'row',
          gap: 8,
        },
        actionButton: {
          flex: 1,
          paddingVertical: 12,
        },
        connectedText: {
          fontSize: 14,
          color: palette.text,
        },
        errorText: {
          fontSize: 14,
          color: '#c62828',
        },
      }),
    [palette]
  );

  if (!isSupported) {
    return null;
  }

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
      setPassword('');
      setMailboxPassword('');
      setTotp('');
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

  const handleCancel = () => {
    setIsFormExpanded(false);
    setPassword('');
    setMailboxPassword('');
    setTotp('');
    setErrorMessage(null);
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

  if (session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Proton Drive</Text>
        <Text style={styles.connectedText}>Connected as {session.email}</Text>
        <Button
          variant="secondary"
          label="Disconnect"
          onPress={() => void handleDisconnect()}
          accessibilityLabel="Disconnect Proton Drive"
          style={styles.button}
        />
      </View>
    );
  }

  if (!isFormExpanded) {
    return (
      <Button
        label="Connect Proton Drive"
        onPress={() => setIsFormExpanded(true)}
        accessibilityLabel="Connect Proton Drive"
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Proton Drive (experimental)</Text>
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
      <View style={styles.actionRow}>
        <Button
          label="Login"
          onPress={() => void handleConnect()}
          disabled={isConnecting}
          loading={isConnecting}
          accessibilityLabel="Login to Proton Drive"
          style={styles.actionButton}
        />
        <Button
          variant="secondary"
          label="Cancel"
          onPress={handleCancel}
          disabled={isConnecting}
          accessibilityLabel="Cancel Proton Drive login"
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}
