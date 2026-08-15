import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_PLATFORM_SUPABASE_URL;
const anonKey = import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY;

export const isPlatformSupabaseConfigured = Boolean(url && anonKey);

export const platformSupabase = isPlatformSupabaseConfigured ? createClient(url, anonKey) : null;
