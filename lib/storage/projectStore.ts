import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '../../types';
import { createNewProject } from '../defaults';

const PROJECTS_INDEX_KEY = '@cutplanner/projects';

function projectKey(id: string): string {
  return `@cutplanner/project/${id}`;
}

async function getIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function setIndex(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(ids));
}

export async function listProjects(): Promise<
  { id: string; name: string; folder: string; updatedAt: string }[]
> {
  const ids = await getIndex();
  const projects: { id: string; name: string; folder: string; updatedAt: string }[] = [];

  for (const id of ids) {
    const raw = await AsyncStorage.getItem(projectKey(id));
    if (raw) {
      const p: Project = JSON.parse(raw);
      projects.push({ id: p.id, name: p.name, folder: p.folder || '', updatedAt: p.updatedAt });
    }
  }

  // Sort by most recently updated
  projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return projects;
}

export async function loadProject(id: string): Promise<Project | null> {
  const raw = await AsyncStorage.getItem(projectKey(id));
  return raw ? (JSON.parse(raw) as Project) : null;
}

export async function saveProject(project: Project): Promise<void> {
  const now = new Date().toISOString();
  const updated = { ...project, updatedAt: now };
  await AsyncStorage.setItem(projectKey(updated.id), JSON.stringify(updated));

  // Ensure project is in the index
  const ids = await getIndex();
  if (!ids.includes(updated.id)) {
    ids.push(updated.id);
    await setIndex(ids);
  }
}

export async function deleteProject(id: string): Promise<void> {
  await AsyncStorage.removeItem(projectKey(id));
  const ids = await getIndex();
  await setIndex(ids.filter((i) => i !== id));
}

export async function createProject(): Promise<Project> {
  const project = createNewProject();
  await saveProject(project);
  return project;
}
