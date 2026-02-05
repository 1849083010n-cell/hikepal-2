import { createClient } from '@supabase/supabase-js';

// TODO: 1. Go to Supabase Dashboard -> Project Settings -> API
// TODO: 2. Copy "Project URL" and paste it below inside the quotes
const SUPABASE_URL: string = 'YOUR_SUPABASE_PROJECT_URL_HERE';

// TODO: 3. Copy "anon public" key and paste it below inside the quotes
const SUPABASE_ANON_KEY: string = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Check if the user has configured the keys
export const isSupabaseConfigured = SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL_HERE' && !SUPABASE_URL.includes('YOUR_SUPABASE');

// To prevent the app from crashing with "Error: Invalid supabaseUrl" before the user configures it,
// we fall back to a dummy URL if it's not configured. The createClient function requires a valid URL format (http/https).
const validUrl = isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co';
const validKey = isSupabaseConfigured ? SUPABASE_ANON_KEY : 'placeholder-key';

export const supabase = createClient(validUrl, validKey);