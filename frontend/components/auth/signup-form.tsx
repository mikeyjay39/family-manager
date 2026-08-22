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
const MIN_PASSWORD_LEN = 8;

type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

type SignupFormProps = {
  onSubmit: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loading?: boolean;
};

function validateFields(
  email: string,
  password: string,
  confirmPassword: string
): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Email is required.';
  } else if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password.trim()) {
    errors.password = 'Password is required.';
  } else if (password.length < MIN_PASSWORD_LEN) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LEN} characters.`;
  }

  if (!confirmPassword.trim()) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function SignupForm({ onSubmit, loading: externalLoading = false }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const palette = useColorPalette();
  const isBusy = loading || externalLoading;

  const handleSignup = async () => {
    const errors = validateFields(email, password, confirmPassword);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setLoading(true);
    try {
      const result = await onSubmit(email.trim(), password);
      if (!result.success) {
        setSubmitError(result.error ?? 'Unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
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

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (fieldErrors.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
    if (submitError) {
      setSubmitError(null);
    }
  };

  return (
    <View style={styles.formContainer}>
      <ThemedText style={styles.label}>Email</ThemedText>
      <TextInput
        style={[
          styles.input,
          fieldErrors.email ? styles.inputWithError : styles.inputDefaultSpacing,
          {
            backgroundColor: palette.background,
            borderColor: fieldErrors.email ? ERROR_COLOR : palette.icon,
            color: palette.text,
          },
        ]}
        value={email}
        onChangeText={handleEmailChange}
        placeholder="Enter your email"
        placeholderTextColor={palette.icon}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!isBusy}
        accessibilityLabel="Email input"
        accessibilityHint={fieldErrors.email ?? 'Enter your email address'}
        accessibilityState={{ invalid: !!fieldErrors.email }}
      />
      {fieldErrors.email ? (
        <ThemedText style={styles.errorText}>{fieldErrors.email}</ThemedText>
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
        placeholder="Choose a password"
        placeholderTextColor={palette.icon}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isBusy}
        accessibilityLabel="Password input"
        accessibilityHint={fieldErrors.password ?? 'Choose a password'}
        accessibilityState={{ invalid: !!fieldErrors.password }}
      />
      {fieldErrors.password ? (
        <ThemedText style={styles.errorText}>{fieldErrors.password}</ThemedText>
      ) : null}

      <ThemedText style={styles.label}>Confirm password</ThemedText>
      <TextInput
        style={[
          styles.input,
          fieldErrors.confirmPassword ? styles.inputWithError : styles.inputDefaultSpacing,
          {
            backgroundColor: palette.background,
            borderColor: fieldErrors.confirmPassword ? ERROR_COLOR : palette.icon,
            color: palette.text,
          },
        ]}
        value={confirmPassword}
        onChangeText={handleConfirmPasswordChange}
        placeholder="Re-enter your password"
        placeholderTextColor={palette.icon}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isBusy}
        returnKeyType="go"
        onSubmitEditing={() => {
          if (!isBusy) {
            void handleSignup();
          }
        }}
        accessibilityLabel="Confirm password input"
        accessibilityHint={fieldErrors.confirmPassword ?? 'Re-enter your password'}
        accessibilityState={{ invalid: !!fieldErrors.confirmPassword }}
      />
      {fieldErrors.confirmPassword ? (
        <ThemedText style={styles.errorText}>{fieldErrors.confirmPassword}</ThemedText>
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
        onPress={() => void handleSignup()}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel="Create account button"
        accessibilityHint="Tap to create your account"
      >
        {isBusy ? (
          <ActivityIndicator color={palette.onTint} />
        ) : (
          <ThemedText style={[styles.buttonText, { color: palette.onTint }]}>
            Create Account
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
