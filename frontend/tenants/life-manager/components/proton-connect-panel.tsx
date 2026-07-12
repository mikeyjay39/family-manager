import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

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
  const [totp, setTotp] = useState('');

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
          backgroundColor: palette.tint,
          borderRadius: 8,
          paddingVertical: 12,
          alignItems: 'center',
        },
        buttonSecondary: {
          backgroundColor: withAlpha(palette.icon, 0.2),
        },
        buttonText: {
          color: palette.onTint,
          fontWeight: '600',
        },
        buttonTextSecondary: {
          color: palette.text,
        },
        connectedText: {
          fontSize: 14,
          color: palette.text,
        },
      }),
    [palette]
  );

  if (!isSupported) {
    return null;
  }

  const handleConnect = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Proton Drive', 'Enter your Proton email and password.');
      return;
    }
    try {
      await connect({
        email: email.trim(),
        password,
        totp: totp.trim() || undefined,
      });
      setPassword('');
      setTotp('');
    } catch (error) {
      Alert.alert(
        'Proton connection failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      Alert.alert(
        'Proton disconnect failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  if (session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Proton Drive</Text>
        <Text style={styles.connectedText}>Connected as {session.email}</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => void handleDisconnect()}
          accessibilityRole="button"
          accessibilityLabel="Disconnect Proton Drive"
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Disconnect</Text>
        </TouchableOpacity>
      </View>
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
        placeholder="Proton password"
        placeholderTextColor={palette.icon}
      />
      <Text style={styles.label}>2FA code (if enabled)</Text>
      <TextInput
        style={styles.input}
        value={totp}
        onChangeText={setTotp}
        keyboardType="number-pad"
        placeholder="Optional TOTP"
        placeholderTextColor={palette.icon}
      />
      <TouchableOpacity
        style={styles.button}
        onPress={() => void handleConnect()}
        disabled={isConnecting}
        accessibilityRole="button"
        accessibilityLabel="Connect Proton Drive"
      >
        {isConnecting ? (
          <ActivityIndicator color={palette.onTint} />
        ) : (
          <Text style={styles.buttonText}>Connect Proton Drive</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
