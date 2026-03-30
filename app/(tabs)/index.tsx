import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useProjectList, ProjectListItem } from '@/hooks/useProjects';
import { useAuthContext } from '@/lib/AuthContext';
import { migrateLocalToCloud } from '@/lib/storage/projectStore';

interface Section {
  title: string;
  data: ProjectListItem[];
}

export default function ProjectListScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuthContext();
  const { projects, loading, refresh, create, remove, rename } = useProjectList();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [migrating, setMigrating] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      // Auto-migrate local projects to cloud on first sign-in
      if (user && !migrating) {
        setMigrating(true);
        migrateLocalToCloud().then((count) => {
          if (count > 0) refresh();
          setMigrating(false);
        }).catch(() => setMigrating(false));
      }
    }, [refresh, user])
  );

  const sections = useMemo((): Section[] => {
    const folderMap = new Map<string, ProjectListItem[]>();
    for (const p of projects) {
      const folder = p.folder || '';
      if (!folderMap.has(folder)) folderMap.set(folder, []);
      folderMap.get(folder)!.push(p);
    }

    const result: Section[] = [];
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
    if (folder && folder !== 'Unfiled') {
      (global as any).__newProjectFolder = folder;
    }
    router.push(`/project/${project.id}`);
  }

  async function handleNewFolder() {
    const folderName = newFolderName.trim();
    if (!folderName) return;
    setShowNewFolder(false);
    setNewFolderName('');
    const project = await create();
    (global as any).__newProjectFolder = folderName;
    router.push(`/project/${project.id}`);
  }

  function handleDelete(id: string, name: string) {
    setMenuOpenId(null);
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${name}"? This cannot be undone.`)) {
        remove(id);
      }
    } else {
      Alert.alert('Delete Project', `Delete "${name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
      ]);
    }
  }

  function handleStartRename(id: string, currentName: string) {
    setMenuOpenId(null);
    setRenameId(id);
    setRenameText(currentName);
  }

  async function handleFinishRename() {
    if (renameId && renameText.trim()) {
      await rename(renameId, renameText.trim());
    }
    setRenameId(null);
    setRenameText('');
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
      {/* Nav bar */}
      <View style={[styles.navBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.navTitle, { color: colors.tint }]}>Plywood Cut Planner</Text>
        {user ? (
          <View style={[styles.navRight, { backgroundColor: colors.card }]}>
            <Text style={[styles.navEmail, { color: colors.secondaryText }]} numberOfLines={1}>
              {user.email}
            </Text>
            {migrating && <Text style={{ color: colors.tint, fontSize: 11 }}>Syncing...</Text>}
            <TouchableOpacity onPress={signOut} style={[styles.navBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.secondaryText, fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/auth')}
            style={[styles.navSignIn, { backgroundColor: colors.tint }]}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

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
                style={[styles.menuBtn, { borderLeftColor: colors.border }]}
                onPress={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
              >
                <Text style={[styles.menuDots, { color: colors.secondaryText }]}>⋯</Text>
              </TouchableOpacity>

              {/* Dropdown menu */}
              {menuOpenId === item.id && (
                <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleStartRename(item.id, item.name)}
                  >
                    <Text style={[styles.dropdownText, { color: colors.text }]}>Rename</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuOpenId(null);
                      router.push(`/project/${item.id}`);
                    }}
                  >
                    <Text style={[styles.dropdownText, { color: colors.text }]}>Edit</Text>
                  </TouchableOpacity>
                  <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleDelete(item.id, item.name)}
                  >
                    <Text style={[styles.dropdownText, { color: colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Rename modal */}
      {renameId && (
        <Modal transparent animationType="fade" visible>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setRenameId(null)}
          >
            <View style={[styles.renameModal, { backgroundColor: colors.card }]}>
              <Text style={[styles.renameTitle, { color: colors.text }]}>Rename Project</Text>
              <TextInput
                style={[styles.renameInput, { color: colors.text, borderColor: colors.border }]}
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={handleFinishRename}
                placeholder="Project name"
                placeholderTextColor={colors.secondaryText}
              />
              <View style={[styles.renameButtons, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={[styles.renameBtn, { borderColor: colors.border }]}
                  onPress={() => setRenameId(null)}
                >
                  <Text style={{ color: colors.secondaryText, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renameBtn, { backgroundColor: colors.tint }]}
                  onPress={handleFinishRename}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* New Folder modal */}
      {showNewFolder && (
        <Modal transparent animationType="fade" visible>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowNewFolder(false)}
          >
            <View style={[styles.renameModal, { backgroundColor: colors.card }]}>
              <Text style={[styles.renameTitle, { color: colors.text }]}>New Folder</Text>
              <TextInput
                style={[styles.renameInput, { color: colors.text, borderColor: colors.border }]}
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={handleNewFolder}
                placeholder="Folder name"
                placeholderTextColor={colors.secondaryText}
              />
              <View style={[styles.renameButtons, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={[styles.renameBtn, { borderColor: colors.border }]}
                  onPress={() => setShowNewFolder(false)}
                >
                  <Text style={{ color: colors.secondaryText, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renameBtn, { backgroundColor: colors.tint }]}
                  onPress={handleNewFolder}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <TouchableOpacity
        style={styles.privacyLink}
        onPress={() => router.push('/privacy')}
      >
        <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Privacy Policy</Text>
      </TouchableOpacity>

      <View style={[styles.fabRow, { backgroundColor: 'transparent' }]}>
        <TouchableOpacity
          style={[styles.fabSecondary, { borderColor: colors.tint }]}
          onPress={() => { setNewFolderName(''); setShowNewFolder(true); }}
        >
          <Text style={[styles.fabSecondaryText, { color: colors.tint }]}>+ Folder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.tint }]}
          onPress={() => handleCreate()}
        >
          <Text style={styles.fabText}>+ New Project</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48, // safe area for mobile
    borderBottomWidth: 1,
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navEmail: {
    fontSize: 12,
    maxWidth: 160,
  },
  navBtn: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  navSignIn: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
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
    overflow: 'visible',
    position: 'relative',
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
  menuBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderLeftWidth: 1,
  },
  menuDots: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 140,
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 15,
  },
  dropdownDivider: {
    height: 1,
    marginHorizontal: 12,
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
  privacyLink: {
    position: 'absolute',
    bottom: 85,
    alignSelf: 'center',
  },
  fabRow: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 10,
  },
  fab: {
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
  fabSecondary: {
    borderRadius: 30,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fabSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameModal: {
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  renameButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  renameBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
