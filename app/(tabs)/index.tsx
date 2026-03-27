import React from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useProjectList } from '@/hooks/useProjects';

export default function ProjectListScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { projects, loading, refresh, create, remove } = useProjectList();

  // Refresh when screen comes into focus (e.g., after editing)
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function handleCreate() {
    const project = await create();
    router.push(`/project/${project.id}`);
  }

  function handleDelete(id: string, name: string) {
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${name}"?`)) {
        remove(id);
      }
    } else {
      Alert.alert('Delete Project', `Delete "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
      ]);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Plywood Cut Planner</Text>

      {projects.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
          <Text style={[styles.emptyIcon, { color: colors.secondaryText }]}>
            🪵
          </Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No projects yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
            Create your first cutting plan to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/project/${item.id}`)}
              onLongPress={() => handleDelete(item.id, item.name)}
            >
              <View style={[styles.projectInfo, { backgroundColor: colors.card }]}>
                <Text style={[styles.projectName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.projectDate, { color: colors.secondaryText }]}>
                  {formatDate(item.updatedAt)}
                </Text>
              </View>
              <Text style={[styles.arrow, { color: colors.secondaryText }]}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.tint }]}
        onPress={handleCreate}
      >
        <Text style={styles.fabText}>+ New Project</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 17,
    fontWeight: '600',
  },
  projectDate: {
    fontSize: 13,
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    fontWeight: '300',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
