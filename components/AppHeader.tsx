import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuthContext } from '@/lib/AuthContext';

export default function AppHeader() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user, signOut } = useAuthContext();

  return (
    <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={() => router.replace('/')}>
        <Text style={[styles.title, { color: colors.tint }]}>Plywood Cut Planner</Text>
      </TouchableOpacity>
      {user ? (
        <View style={[styles.right, { backgroundColor: colors.card }]}>
          <Text style={[styles.email, { color: colors.secondaryText }]} numberOfLines={1}>
            {user.email}
          </Text>
          <TouchableOpacity onPress={signOut} style={[styles.btn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.secondaryText, fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => router.push('/auth')}
          style={[styles.signInBtn, { backgroundColor: colors.tint }]}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Sign In</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  email: {
    fontSize: 12,
    maxWidth: 160,
  },
  btn: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  signInBtn: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
