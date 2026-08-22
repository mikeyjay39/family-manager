import React from 'react';
import { Image, StyleSheet, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, router } from 'expo-router';

import { SignupForm } from '@/components/auth/signup-form';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/lib/tenant/TenantContext';
import { useTenantBranding } from '@/lib/tenant/TenantThemeContext';

/**
 * Signup flow:
 *   User -> SignupForm -> AuthContext.signup -> POST /auth/signup
 *   Success -> pending approval message -> link back to login
 */
export default function SignupScreen() {
  const { signup, isAuthenticated } = useAuth();
  const { tenant } = useTenant();
  const { assets } = useTenantBranding();
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleSubmit = async (email: string, password: string) => {
    const result = await signup(email, password);
    if (result.success && result.message) {
      setSuccessMessage(result.message);
    }
    return result;
  };

  if (successMessage) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <Image source={assets.logo} style={styles.logo} accessibilityIgnoresInvertColors />
          <ThemedText type="title" style={styles.title}>
            Account Created
          </ThemedText>
          <ThemedText style={styles.successMessage}>{successMessage}</ThemedText>
          <Link href="/login" style={styles.link}>
            <ThemedText type="link">Back to sign in</ThemedText>
          </Link>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Image source={assets.logo} style={styles.logo} accessibilityIgnoresInvertColors />
          <ThemedText type="title" style={styles.title}>
            {tenant.displayName}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.subtitle}>
            Create an account
          </ThemedText>

          <SignupForm onSubmit={handleSubmit} />

          <Link href="/login" style={styles.link}>
            <ThemedText type="link">Already have an account? Sign in</ThemedText>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  logo: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 12,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.7,
  },
  successMessage: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  link: {
    marginTop: 24,
    alignSelf: 'center',
  },
});
