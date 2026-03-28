import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    if (!url || !key) {
      console.warn('[DB] Supabase credentials not set — using in-memory fallback');
      return createMockClient();
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

function createMockClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get: (_target, prop) => {
      if (prop === 'from') {
        return (_table: string) => ({
          insert: async (data: any) => ({ data, error: null }),
          select: async () => ({ data: [], error: null }),
          update: async () => ({ data: [], error: null }),
          delete: async () => ({ data: [], error: null }),
          upsert: async (data: any) => ({ data, error: null }),
          gte: function() { return this; },
          lte: function() { return this; },
          eq: function() { return this; },
          in: function() { return this; },
          order: function() { return this; },
          limit: function() { return this; },
        });
      }
      return () => {};
    }
  });
}
