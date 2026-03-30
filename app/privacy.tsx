import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function PrivacyScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
        <Text style={[styles.date, { color: colors.secondaryText }]}>Last updated: March 30, 2026</Text>

        <Text style={[styles.heading, { color: colors.text }]}>What We Collect</Text>
        <Text style={[styles.body, { color: colors.text }]}>
          When you create an account, we store your email address and the projects you create. If you sign in with Google, we receive your name and email from Google. We do not collect any other personal information.
        </Text>

        <Text style={[styles.heading, { color: colors.text }]}>How We Use Your Data</Text>
        <Text style={[styles.body, { color: colors.text }]}>
          Your email is used solely for account authentication. Your project data is stored so you can access it across devices. We do not sell, share, or use your data for advertising.
        </Text>

        <Text style={[styles.heading, { color: colors.text }]}>Data Storage</Text>
        <Text style={[styles.body, { color: colors.text }]}>
          Your data is stored securely on Supabase (our database provider) with row-level security ensuring only you can access your projects. If you use the app without an account, data is stored locally in your browser.
        </Text>

        <Text style={[styles.heading, { color: colors.text }]}>Cookies</Text>
        <Text style={[styles.body, { color: colors.text }]}>
          We use local storage to maintain your login session. We do not use tracking cookies or third-party analytics.
        </Text>

        <Text style={[styles.heading, { color: colors.text }]}>Deleting Your Data</Text>
        <Text style={[styles.body, { color: colors.text }]}>
          You can delete any project from the app at any time. To delete your account entirely, contact us at support@plywoodcutplanner.com.
        </Text>

        <Text style={[styles.heading, { color: colors.text }]}>Contact</Text>
        <Text style={[styles.body, { color: colors.text }]}>
          Questions about this policy? Email support@plywoodcutplanner.com.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: { borderRadius: 12, padding: 24, maxWidth: 600, alignSelf: 'center', width: '100%' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  date: { fontSize: 13, marginBottom: 20 },
  heading: { fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 22 },
});
