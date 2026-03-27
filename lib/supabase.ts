import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://gcgpyxhbmambxnwgzwvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZ3B5eGhibWFtYnhud2d6d3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzYzODIsImV4cCI6MjA5MDIxMjM4Mn0.qIhbgWlt8YXNBxI3wzRy1wEpz27jxE1tknEH7NqykF8';

let _instance: SupabaseClient | null = null;

function getInstance(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _instance;
}

// Export a proxy that lazily initializes but maintains a single instance
// This avoids `window is not defined` during SSR/static export
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string) {
    const instance = getInstance();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
