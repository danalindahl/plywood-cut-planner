import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuthContext } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { signUp, signIn } = useAuthContext();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSubmit() {
    setError('');
    setSuccessMessage('');

    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        setSuccessMessage('Check your email to confirm your account, then sign in.');
        setIsSignUp(false);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.logo, { color: colors.tint }]}>Plywood Cut Planner</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {isSignUp ? 'Create an account to save your projects' : 'Sign in to access your projects'}
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#ffebee' }]}>
              <Text style={{ color: '#c62828', fontSize: 14 }}>{error}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={[styles.successBox, { backgroundColor: '#e8f5e9' }]}>
              <Text style={{ color: '#2e7d32', fontSize: 14 }}>{successMessage}</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.secondaryText }]}>Email</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.secondaryText}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={[styles.label, { color: colors.secondaryText }]}>Password</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.secondaryText}
            secureTextEntry
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />

          {isSignUp && (
            <>
              <Text style={[styles.label, { color: colors.secondaryText }]}>Confirm Password</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor={colors.secondaryText}
                secureTextEntry
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.tint }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={[styles.dividerRow, { backgroundColor: colors.card }]}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={{ color: colors.secondaryText, fontSize: 13, paddingHorizontal: 12 }}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, { borderColor: colors.border }]}
            onPress={async () => {
              setError('');
              try {
                const redirectTo = 'https://plywoodcutplanner.com';
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo },
                });
                if (error) throw error;
              } catch (err: any) {
                setError(err.message || 'Google sign in failed');
              }
            }}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={[styles.googleText, { color: colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccessMessage('');
            }}
          >
            <Text style={{ color: colors.tint, fontSize: 14 }}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => {
              (global as any).__skipAuth = true;
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
          >
            <Text style={{ color: colors.secondaryText, fontSize: 13 }}>
              Continue without account (data saved locally only)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 16,
    padding: 28,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  submitBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  googleG: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchBtn: {
    alignItems: 'center',
    marginTop: 16,
  },
  skipBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  errorBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  successBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
});
