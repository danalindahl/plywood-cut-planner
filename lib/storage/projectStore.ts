import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { Project } from '../../types';
import { createNewProject } from '../defaults';

// ---- Helpers ----

const PROJECTS_INDEX_KEY = '@cutplanner/projects';

function projectKey(id: string): string {
  return `@cutplanner/project/${id}`;
}

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ---- Local Storage (fallback when not logged in) ----

async function localGetIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function localSetIndex(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(ids));
}

async function localListProjects(): Promise<
  { id: string; name: string; folder: string; updatedAt: string }[]
> {
  const ids = await localGetIndex();
  const projects: { id: string; name: string; folder: string; updatedAt: string }[] = [];
  for (const id of ids) {
    const raw = await AsyncStorage.getItem(projectKey(id));
    if (raw) {
      const p: Project = JSON.parse(raw);
      projects.push({ id: p.id, name: p.name, folder: p.folder || '', updatedAt: p.updatedAt });
    }
  }
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return projects;
}

async function localLoadProject(id: string): Promise<Project | null> {
  const raw = await AsyncStorage.getItem(projectKey(id));
  return raw ? (JSON.parse(raw) as Project) : null;
}

async function localSaveProject(project: Project): Promise<void> {
  const now = new Date().toISOString();
  const updated = { ...project, updatedAt: now };
  await AsyncStorage.setItem(projectKey(updated.id), JSON.stringify(updated));
  const ids = await localGetIndex();
  if (!ids.includes(updated.id)) {
    ids.push(updated.id);
    await localSetIndex(ids);
  }
}

async function localDeleteProject(id: string): Promise<void> {
  await AsyncStorage.removeItem(projectKey(id));
  const ids = await localGetIndex();
  await localSetIndex(ids.filter((i) => i !== id));
}

// ---- Supabase Storage (when logged in) ----

async function cloudListProjects(): Promise<
  { id: string; name: string; folder: string; updatedAt: string }[]
> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, folder, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    folder: r.folder || '',
    updatedAt: r.updated_at,
  }));
}

async function cloudLoadProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data?.data as Project;
}

async function cloudSaveProject(project: Project): Promise<void> {
  const now = new Date().toISOString();
  const updated = { ...project, updatedAt: now };

  const { error } = await supabase
    .from('projects')
    .upsert({
      id: updated.id,
      name: updated.name,
      folder: updated.folder || '',
      data: updated,
      updated_at: now,
    });

  if (error) throw error;
}

async function cloudDeleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---- Public API (auto-selects local or cloud) ----

async function isLoggedIn(): Promise<boolean> {
  const user = await getUser();
  return !!user;
}

export async function listProjects(): Promise<
  { id: string; name: string; folder: string; updatedAt: string }[]
> {
  if (await isLoggedIn()) {
    return cloudListProjects();
  }
  return localListProjects();
}

export async function loadProject(id: string): Promise<Project | null> {
  if (await isLoggedIn()) {
    return cloudLoadProject(id);
  }
  return localLoadProject(id);
}

export async function saveProject(project: Project): Promise<void> {
  if (await isLoggedIn()) {
    return cloudSaveProject(project);
  }
  return localSaveProject(project);
}

export async function deleteProject(id: string): Promise<void> {
  if (await isLoggedIn()) {
    return cloudDeleteProject(id);
  }
  return localDeleteProject(id);
}

export async function createProject(): Promise<Project> {
  const project = createNewProject();
  await saveProject(project);
  return project;
}

/**
 * Migrate local projects to cloud after signing in.
 */
export async function migrateLocalToCloud(): Promise<number> {
  const localProjects = await localListProjects();
  let migrated = 0;

  for (const item of localProjects) {
    const project = await localLoadProject(item.id);
    if (project) {
      try {
        await cloudSaveProject(project);
        migrated++;
      } catch (e) {
        // Skip projects that fail (e.g., duplicates)
      }
    }
  }

  // Clear local storage after successful migration
  if (migrated > 0) {
    for (const item of localProjects) {
      await AsyncStorage.removeItem(projectKey(item.id));
    }
    await AsyncStorage.removeItem(PROJECTS_INDEX_KEY);
  }

  return migrated;
}
