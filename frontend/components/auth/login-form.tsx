import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';

const ERROR_COLOR = '#c00';

type FieldErrors = {
  username?: string;
  password?: string;
};

type LoginFormProps = {
  onSubmit: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loading?: boolean;
};

function validateFields(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!username.trim()) {
    errors.username = 'Username is required.';
  }
  if (!password.trim()) {
    errors.password = 'Password is required.';
  }
  return errors;
}

export function LoginForm({ onSubmit, loading: externalLoading = false }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const palette = useColorPalette();
  const isBusy = loading || externalLoading;

  const handleLogin = async () => {
    const errors = validateFields(username, password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setLoading(true);
    try {
      const result = await onSubmit(username, password);
      if (!result.success) {
        setSubmitError(result.error ?? 'Unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (fieldErrors.username) {
      setFieldErrors((prev) => ({ ...prev, username: undefined }));
    }
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (submitError) {
      setSubmitError(null);
    }
  };

  return (
    <View style={styles.formContainer}>
      <ThemedText style={styles.label}>Username</ThemedText>
      <TextInput
        style={[
          styles.input,
          fieldErrors.username ? styles.inputWithError : styles.inputDefaultSpacing,
          {
            backgroundColor: palette.background,
            borderColor: fieldErrors.username ? ERROR_COLOR : palette.icon,
            color: palette.text,
          },
        ]}
        value={username}
        onChangeText={handleUsernameChange}
        placeholder="Enter your username"
        placeholderTextColor={palette.icon}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isBusy}
        accessibilityLabel="Username input"
        accessibilityHint={
          fieldErrors.username ?? 'Enter your username to log in'
        }
        accessibilityState={{ invalid: !!fieldErrors.username }}
      />
      {fieldErrors.username ? (
        <ThemedText style={styles.errorText}>{fieldErrors.username}</ThemedText>
      ) : null}

      <ThemedText style={styles.label}>Password</ThemedText>
      <TextInput
        style={[
          styles.input,
          fieldErrors.password ? styles.inputWithError : styles.inputDefaultSpacing,
          {
            backgroundColor: palette.background,
            borderColor: fieldErrors.password ? ERROR_COLOR : palette.icon,
            color: palette.text,
          },
        ]}
        value={password}
        onChangeText={handlePasswordChange}
        placeholder="Enter your password"
        placeholderTextColor={palette.icon}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isBusy}
        returnKeyType="go"
        onSubmitEditing={() => {
          if (!isBusy) {
            void handleLogin();
          }
        }}
        accessibilityLabel="Password input"
        accessibilityHint={
          fieldErrors.password ?? 'Enter your password to log in'
        }
        accessibilityState={{ invalid: !!fieldErrors.password }}
      />
      {fieldErrors.password ? (
        <ThemedText style={styles.errorText}>{fieldErrors.password}</ThemedText>
      ) : null}

      {submitError ? (
        <ThemedText accessibilityRole="alert" style={styles.submitErrorText}>
          {submitError}
        </ThemedText>
      ) : null}

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: palette.tint,
            opacity: isBusy ? 0.6 : 1,
          },
        ]}
        onPress={() => void handleLogin()}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel="Sign in button"
        accessibilityHint="Tap to sign in with your credentials"
      >
        {isBusy ? (
          <ActivityIndicator color={palette.onTint} />
        ) : (
          <ThemedText style={[styles.buttonText, { color: palette.onTint }]}>
            Sign In
          </ThemedText>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputDefaultSpacing: {
    marginBottom: 20,
  },
  inputWithError: {
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: ERROR_COLOR,
    marginBottom: 14,
  },
  submitErrorText: {
    fontSize: 14,
    color: ERROR_COLOR,
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
