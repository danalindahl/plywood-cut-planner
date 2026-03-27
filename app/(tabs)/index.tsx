import React, { useMemo } from 'react';
import {
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useProjectList, ProjectListItem } from '@/hooks/useProjects';

interface Section {
  title: string;
  data: ProjectListItem[];
}

export default function ProjectListScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { projects, loading, refresh, create, remove } = useProjectList();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Group projects by folder
  const sections = useMemo((): Section[] => {
    const folderMap = new Map<string, ProjectListItem[]>();
    for (const p of projects) {
      const folder = p.folder || '';
      if (!folderMap.has(folder)) folderMap.set(folder, []);
      folderMap.get(folder)!.push(p);
    }

    const result: Section[] = [];
    // Named folders first (alphabetical), then unfiled
    const folders = [...folderMap.keys()].sort((a, b) => {
      if (a === '' && b !== '') return 1;
      if (b === '' && a !== '') return -1;
      return a.localeCompare(b);
    });

    for (const folder of folders) {
      result.push({
        title: folder || 'Unfiled',
        data: folderMap.get(folder)!,
      });
    }
    return result;
  }, [projects]);

  async function handleCreate(folder?: string) {
    const project = await create();
    // If creating within a folder, we'll set the folder in the editor
    if (folder && folder !== 'Unfiled') {
      (global as any).__newProjectFolder = folder;
    }
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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            sections.length > 1 || section.title !== 'Unfiled' ? (
              <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
                  {section.title}
                </Text>
                <Text style={[styles.sectionCount, { color: colors.secondaryText }]}>
                  {section.data.length}
                </Text>
              </View>
            ) : null
          )}
          renderItem={({ item }) => (
            <View style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.projectMain}
                onPress={() => router.push(`/project/${item.id}`)}
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
              <TouchableOpacity
                style={[styles.deleteBtn, { borderLeftColor: colors.border }]}
                onPress={() => handleDelete(item.id, item.name)}
              >
                <Text style={[styles.deleteText, { color: colors.danger }]}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.tint }]}
        onPress={() => handleCreate()}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  projectMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  deleteBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderLeftWidth: 1,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '700',
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
