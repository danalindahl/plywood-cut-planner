import { useState, useEffect, useCallback } from 'react';
import {
  listProjects,
  loadProject,
  saveProject,
  deleteProject,
  createProject,
} from '@/lib/storage/projectStore';
import { Project } from '@/types';

export interface ProjectListItem {
  id: string;
  name: string;
  folder: string;
  updatedAt: string;
}

export function useProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listProjects();
    setProjects(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (): Promise<Project> => {
    const p = await createProject();
    await refresh();
    return p;
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      await deleteProject(id);
      await refresh();
    },
    [refresh]
  );

  return { projects, loading, refresh, create, remove };
}

export function useProject(id: string | null) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setProject(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await loadProject(id);
      if (!cancelled) {
        setProject(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = useCallback(
    async (updated: Project) => {
      setProject(updated);
      await saveProject(updated);
    },
    []
  );

  return { project, loading, save };
}
